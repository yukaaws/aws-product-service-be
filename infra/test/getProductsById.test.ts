import { APIGatewayProxyResult } from "aws-lambda";
import { getProductsById } from "../lib/product-lambda/products/getProductsById";


describe('getProductsById', () => {
  it('returns product by id', async () => {
    const event = {
      pathParameters: { productId: 'p1' },
    } as any;

    const result = await getProductsById(event);

    expect(result?.statusCode).toBe(200);
    const body = JSON.parse(result?.body);
    expect(body?.id).toBe('p1');
  });
});
