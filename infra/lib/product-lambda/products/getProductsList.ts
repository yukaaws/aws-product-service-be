
import { APIGatewayProxyResult } from 'aws-lambda';
import { products } from './mockProducts';

export const getProductsList = async (): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        body: JSON.stringify(products),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
};
