import { getProductsList } from "../lib/product-lambda/products/getProductsList";


describe('getProductsList', () => {
  it('returns list of products', async () => {
    const result = await getProductsList();

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});
