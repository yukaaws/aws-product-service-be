
// Mock AWS SDK v3 BEFORE importing the lambda
const sendMock = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');

  return {
    ...actual, // keep real ScanCommand
    DynamoDBClient: jest.fn(() => ({
      send: sendMock,
    })),
  };
});

// Import lambda AFTER mocks
import { getProductsList } from '../lib/product-lambda/products/getProductsList';

describe('getProductsList lambda', () => {
  beforeAll(() => {
    process.env.PRODUCTS_TABLE = 'products-table';
    process.env.STOCK_TABLE = 'stock-table';
  });

  beforeEach(() => {
    sendMock.mockReset();
  });

  it('returns 200 with products enriched with stock counts', async () => {
    sendMock
      // products table scan
      .mockResolvedValueOnce({
        Items: [
          {
            id: { S: '1' },
            title: { S: 'Product A' },
            description: { S: 'Nice product' },
            price: { N: '100' },
          },
          {
            id: { S: '2' },
            title: { S: 'Product B' },
            price: { N: '50' },
          },
        ],
      })
      // stock table scan
      .mockResolvedValueOnce({
        Items: [
          {
            product_id: { S: '1' },
            count: { N: '5' },
          },
        ],
      });

    const result = await getProductsList();

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toEqual([
      {
        id: '1',
        title: 'Product A',
        description: 'Nice product',
        price: 100,
        count: 5,
      },
      {
        id: '2',
        title: 'Product B',
        description: undefined,
        price: 50,
        count: 0,
      },
    ]);
  });

  it('returns empty array when no products exist', async () => {
    sendMock
      .mockResolvedValueOnce({ Items: [] }) // products
      .mockResolvedValueOnce({ Items: [] }); // stock

    const result = await getProductsList();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  it('returns 500 when DynamoDB throws error', async () => {
    sendMock.mockRejectedValueOnce(new Error('DynamoDB error'));

    const result = await getProductsList();

    expect(result.statusCode).toBe(500);
    expect(result.body).toBe('Internal error');
  });
});
