
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { products } from './mockProducts';

export const getProductsById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Product ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const product = products.find((p) => p.id === productId);

  if (!product) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Product not found' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(product),
    headers: { 'Access-Control-Allow-Origin': '*' },
  };
};
