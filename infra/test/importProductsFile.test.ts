import { handler } from "../lib/import-lambda/importProductsFile";

// Mock AWS SDK v3 presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url-test'),
}));

// (Optional) Mock S3 client to avoid real AWS usage
jest.mock('@aws-sdk/client-s3', () => {
  const original = jest.requireActual('@aws-sdk/client-s3');

  return {
    ...original,
    S3Client: jest.fn(() => ({
      send: jest.fn(),
    })),
  };
});

describe('importProductsFile lambda', () => {
  it('returns signed URL for file upload', async () => {
    const event = {
      queryStringParameters: {
        name: 'products.csv',
      },
    };

    const result: any = await handler(event as any);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.url).toBe('https://signed-url-test');
  });

  it('returns 400 if filename is missing', async () => {
    const event = {
      queryStringParameters: null,
    };

    const result: any = await handler(event as any);

    expect(result.statusCode).toBe(400);
  });
});
