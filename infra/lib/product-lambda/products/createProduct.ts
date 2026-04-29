
import {
    DynamoDBClient,
    TransactWriteItemsCommand
} from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda/trigger/api-gateway-proxy';
import { randomUUID } from 'crypto';


const client = new DynamoDBClient({});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};


export const createProduct: APIGatewayProxyHandler = async (event) => {
    console.log('EVENT:', event);

    try {


        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Request body is required' }),
            };
        }

        const rawBody = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64').toString('utf-8')
            : event.body;

        if (typeof rawBody !== 'string' || !rawBody.trim().startsWith('{')) {
            console.error('NON-JSON BODY RECEIVED:', rawBody);

            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: 'Request body must be valid JSON',
                    received: rawBody,
                }),
            };
        }

        const body = JSON.parse(rawBody);



        const { title, description, price, count } = body;

        if (
            !title ||
            !Number.isInteger(price) ||
            !Number.isInteger(count) ||
            count <= 0
        ) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Invalid product data' }),
            };
        }

        const id = randomUUID();

        await client.send(
            new TransactWriteItemsCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: process.env.PRODUCTS_TABLE!,
                            Item: {
                                id: { S: id },
                                title: { S: title },
                                description: { S: description ?? '' },
                                price: { N: String(price) },
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: process.env.STOCK_TABLE!,
                            Item: {
                                product_id: { S: id },
                                count: { N: String(count) },
                            },
                        },
                    },
                ],
            })
        );

        return {
            statusCode: 201,
            headers: corsHeaders,
            body: JSON.stringify({ id }),
        };

    } catch (error) {
        console.error('ERROR FULL:', JSON.stringify(error, null, 2));

        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Internal error',
                error: error instanceof Error ? error.message : error,
            }),
        };
    }

};
