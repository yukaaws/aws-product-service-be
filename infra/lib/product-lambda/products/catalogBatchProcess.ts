import { SQSHandler } from 'aws-lambda';
import {
    DynamoDBClient,
    QueryCommand,
    UpdateItemCommand,
    TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

const client = new DynamoDBClient({});
const snsClient = new SNSClient({});

/**
 *  Query products by title-index
 *  If product exists
 *      UPDATE stocks SET count = count + incomingCount
 *  If product does NOT exist
 *  TRANSACTION
 *      Put product
 *      Put stock
 */

// Requirements: No scans, Minimal cost, Atomic consistency
export const catalogBatchProcess: SQSHandler = async (event) => {
    console.log('SQS Event:', JSON.stringify(event));

    const batchItemFailures: { itemIdentifier: string }[] = [];
    const createdProducts: any[] = [];

    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body);
            const { title, description = '' } = body;

            // CSV → everything is string
            const price = Number(body.price);
            const count = Number(body.count);


            // validation
            if (
                !body.title ||
                Number.isNaN(price) ||
                Number.isNaN(count) ||
                count <= 0
            ) {
                console.error('Invalid message:', body);
                continue; // do NOT crash batch
            }

            // 1. Query product by title (GSI)
            const queryResult = await client.send(
                new QueryCommand({
                    TableName: process.env.PRODUCTS_TABLE!,
                    IndexName: 'title-index',
                    KeyConditionExpression: '#title = :title',
                    ExpressionAttributeNames: {
                        '#title': 'title',
                    },
                    ExpressionAttributeValues: {
                        ':title': { S: title },
                    },
                    Limit: 1,
                })
            );

            // CASE 1: Product exists → update stock
            if (queryResult.Items && queryResult.Items.length > 0) {
                const productId = queryResult.Items[0].id.S!;

                await client.send(
                    new UpdateItemCommand({
                        TableName: process.env.STOCK_TABLE!,
                        Key: {
                            product_id: { S: productId },
                        },
                        UpdateExpression:
                            'SET #count = if_not_exists(#count, :zero) + :inc',
                        ExpressionAttributeNames: {
                            '#count': 'count',
                        },
                        ExpressionAttributeValues: {
                            ':inc': { N: count.toString() },
                            ':zero': { N: '0' },
                        },
                    })
                );

                console.log(`Stock updated for product ${productId}`);
                continue;
            }

            // CASE 2: Product does NOT exist → create product + stock
            const newProductId = randomUUID();

            await client.send(
                new TransactWriteItemsCommand({
                    TransactItems: [
                        {
                            Put: {
                                TableName: process.env.PRODUCTS_TABLE!,
                                Item: {
                                    id: { S: newProductId },
                                    title: { S: title },
                                    description: { S: description },
                                    price: { N: price.toString() },
                                },
                                ConditionExpression: 'attribute_not_exists(id)',
                            },
                        },
                        {
                            Put: {
                                TableName: process.env.STOCK_TABLE!,
                                Item: {
                                    product_id: { S: newProductId },
                                    count: { N: count.toString() },
                                },
                            },
                        },
                    ],
                })
            );
            
            console.log(`Product created: ${newProductId}`);
            createdProducts.push({
                id: newProductId,
                title,
                description,
                price,
            });
        } catch (error) {
            // No full batch retry
            console.error('Failed record:', record.messageId, error);

            batchItemFailures.push({
                itemIdentifier: record.messageId,
            });
        }
    }

    if (createdProducts) {
        const topicArn = process.env.CREATE_PRODUCT_TOPIC_ARN;

        if (!topicArn) {
            throw new Error('CREATE_PRODUCT_TOPIC_ARN is not set');
        }
        const message = JSON.stringify(
            {
                message: 'Products were successfully created',
                products: createdProducts,
            },
            null,
            2
        );
        await snsClient.send(
            new PublishCommand({
                TopicArn: topicArn,
                Subject: 'New products created',
                Message: message,
            })
        );
        console.error('Publish Topic:', 'New products created', message);
    }

    return { batchItemFailures };
};
