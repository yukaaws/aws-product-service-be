
import { products } from './mockProducts';

export const getProductsList
 = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify(products),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
