
// IMPORTANT: mock AWS SDK v3 BEFORE importing the lambda
const sendMock = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');

  return {
    ...actual, // keep real Command classes (GetItemCommand)
    DynamoDBClient: jest.fn(() => ({
      send: sendMock,
    })),
  };
});

// import lambda AFTER mocks
import { getProductsById } from '../lib/product-lambda/products/getProductsById';

describe('getProductsById lambda', () => {
  beforeAll(() => {
    process.env.PRODUCTS_TABLE = 'products-table';
    process.env.STOCK_TABLE = 'stock-table';
  });

  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 200 when product and stock exist', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          id: { S: '1' },
          title: { S: 'Product A' },
          description: { S: 'Nice product' },
          price: { N: '100' },
        },
      })
      .mockResolvedValueOnce({
        Item: {
          product_id: { S: '1' },
          count: { N: '5' },
        },
      });

    const event = {
      pathParameters: { productId: '1' },
    } as any;

    const result = await getProductsById(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      id: '1',
      title: 'Product A',
      description: 'Nice product',
      price: 100,
      count: 5,
    });
  });

  it('returns 200 with count = 0 when stock does not exist', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          id: { S: '2' },
          title: { S: 'Product B' },
          price: { N: '50' },
        },
      })
      .mockResolvedValueOnce({}); // stock not found

    const event = {
      pathParameters: { productId: '2' },
    } as any;

    const result = await getProductsById(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).count).toBe(0);
  });

  it('returns 404 when product does not exist', async () => {
    sendMock
      .mockResolvedValueOnce({}) // product not found
      .mockResolvedValueOnce({}); // stock call still happens

    const event = {
      pathParameters: { productId: '999' },
    } as any;

    const result = await getProductsById(event);

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when productId is missing', async () => {
    const event = {
      pathParameters: null,
    } as any;

    const result = await getProductsById(event);

    expect(result.statusCode).toBe(400);
  });
});
