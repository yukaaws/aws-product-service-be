
import { APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};


export const getProductsList = async (): Promise<APIGatewayProxyResult> => {

    try {
        const productsRes = await client.send(
            new ScanCommand({ TableName: process.env.PRODUCTS_TABLE })
        );

        const stockRes = await client.send(
            new ScanCommand({ TableName: process.env.STOCK_TABLE })
        );


        const stockMap = new Map(
            stockRes.Items?.map(
                s => [s.product_id.S, Number(s.count.N)]
            )
        );


        const items = productsRes.Items?.map(p => ({
            id: p.id.S!,
            title: p.title.S!,
            description: p.description?.S,
            price: Number(p.price.N),
            count: stockMap.get(p.id.S!) ?? 0
        })) ?? [];


        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(items),
        };


    } catch (e) {
        console.error(e);
        return { statusCode: 500, headers, body: 'Internal error' };
    }
};
