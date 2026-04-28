
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

export const getProductsById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const productId = event.pathParameters?.productId!;


        if (!productId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Product ID is required' }),
                headers: { 'Access-Control-Allow-Origin': '*' },
            };
        }


        const product = await client.send(
            new GetItemCommand({
                TableName: process.env.PRODUCTS_TABLE,
                Key: { id: { S: productId } }
            })
        );


        const stock = await client.send(
            new GetItemCommand({
                TableName: process.env.STOCK_TABLE,
                Key: { product_id: { S: productId } }
            })
        );



        if (!product.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Product not found' }),
                headers: { 'Access-Control-Allow-Origin': '*' },
            };
        }

        return {
            statusCode: 200,

            body: JSON.stringify({
                id: productId,
                title: product.Item.title.S!,
                description: product.Item.description?.S,
                price: Number(product.Item.price.N),
                count: stock.Item ? Number(stock.Item.count.N) : 0
            }),

            headers: { 'Access-Control-Allow-Origin': '*' },
        };
    }
    catch (e) {
        console.error(e);
        return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Internal error' };
    }

};
