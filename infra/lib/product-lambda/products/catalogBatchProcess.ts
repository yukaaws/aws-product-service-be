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

async function publishToSNS(
    subject: string,
    payload: object,
    actionType: 'create' | 'update'
) {
    const topicArn = process.env.CREATE_PRODUCT_TOPIC_ARN;
    if (!topicArn) throw new Error('CREATE_PRODUCT_TOPIC_ARN is not set');

    await snsClient.send(
        new PublishCommand({
            TopicArn: topicArn,
            Subject: subject,
            Message: JSON.stringify(payload, null, 2),
            MessageAttributes: {
                actionTypeCategory: {
                    DataType: 'String',
                    StringValue: actionType,
                },
            },
        })
    );
}

export const catalogBatchProcess: SQSHandler = async (event) => {
    console.log('SQS Event:', JSON.stringify(event));

    const batchItemFailures: { itemIdentifier: string }[] = [];
    const createdProducts: any[] = [];
    const updatedProductIds: string[] = [];

    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body);
            const { title, description = '' } = body;

            // Skip CSV header (do not retry)
            if (
                title === 'title' &&
                body.price === 'price' &&
                body.count === 'count'
            ) {
                console.warn('CSV header skipped');
                continue;
            }

            const price = Number(body.price);
            const count = Number(body.count);

            // Validation
            if (!title || Number.isNaN(price) || Number.isNaN(count) || count <= 0) {
                console.error('Invalid message:', body);

                // Retry ONLY real invalid data
                batchItemFailures.push({
                    itemIdentifier: record.messageId,
                });
                continue;
            }

            // -------- FIND PRODUCT BY TITLE --------
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
                })
            );

            // CASE 1: Product exists → UPDATE stock (SAFE ATOMIC)
            if (queryResult.Items && queryResult.Items.length > 0) {
                const productId = queryResult.Items[0].id.S!;

                await client.send(
                    new UpdateItemCommand({
                        TableName: process.env.STOCK_TABLE!,
                        Key: {
                            product_id: { S: productId },
                        },
                        // IMPORTANT FIX: use ADD, not SET
                        UpdateExpression: 'ADD #count :inc',
                        ExpressionAttributeNames: {
                            '#count': 'count',
                        },
                        ExpressionAttributeValues: {
                            ':inc': { N: count.toString() },
                        },
                    })
                );

                updatedProductIds.push(productId);
                continue;
            }

            // CASE 2: Product does not exist → CREATE (transaction)
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
            console.error('Failed record:', record.messageId, error);

            batchItemFailures.push({
                itemIdentifier: record.messageId,
            });
        }
    }

    // SNS notifications
    if (createdProducts.length > 0) {
        await publishToSNS(
            '[New products created]',
            {
                message: 'Products were successfully created',
                products: createdProducts,
            },
            'create'
        );
    }

    if (updatedProductIds.length > 0) {
        await publishToSNS(
            '[Products updated]',
            {
                message: 'Products were successfully updated',
                products: updatedProductIds,
            },
            'update'
        );
    }

    console.log('Batch finished', {
        received: event.Records.length,
        failed: batchItemFailures.length,
        created: createdProducts.length,
        updated: updatedProductIds.length,
    });

    return { batchItemFailures };
};
