import {
    DynamoDBClient,
    UpdateItemCommand,
    TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { catalogBatchProcess } from '../lib/product-lambda/products/catalogBatchProcess';
import { SQSBatchResponse } from 'aws-lambda';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-sns');

const mockSend = jest.fn();

(DynamoDBClient.prototype.send as any) = mockSend;
(SNSClient.prototype.send as any) = mockSend;


const invoke = async (event: any) =>
    (await catalogBatchProcess(event, {} as any, () => { })) as SQSBatchResponse;

beforeEach(() => {
    mockSend.mockReset();
    jest.clearAllMocks();

    process.env.PRODUCTS_TABLE = 'products';
    process.env.STOCK_TABLE = 'stocks';
    process.env.CREATE_PRODUCT_TOPIC_ARN = 'arn:sns:test';
});

describe('catalogBatchProcess', () => {

    it('creates new product and publishes SNS', async () => {
        mockSend.mockImplementation((command: any) => {
            const name = command.constructor.name;

            if (name === 'QueryCommand') {
                return Promise.resolve({ Items: [] });
            }

            if (name === 'TransactWriteItemsCommand') {
                return Promise.resolve({});
            }

            if (name === 'PublishCommand') {
                return Promise.resolve({});
            }

            throw new Error(`Unexpected command: ${name}`);
        });

        const event = {
            Records: [
                {
                    messageId: '1',
                    body: JSON.stringify({
                        title: 'p-new',
                        description: 'desc',
                        price: '100',
                        count: '2',
                    }),
                },
            ],
        };

        const result = await invoke(event);

        expect(mockSend).toHaveBeenCalledWith(expect.any(TransactWriteItemsCommand));
        expect(mockSend).toHaveBeenCalledWith(expect.any(PublishCommand));
        expect(result.batchItemFailures).toHaveLength(0);
    });

    it('updates existing product stock', async () => {
        mockSend.mockImplementation((command: any) => {
            const name = command.constructor.name;

            if (name === 'QueryCommand') {
                return Promise.resolve({
                    Items: [{ id: { S: 'existing-id' } }],
                });
            }

            if (name === 'UpdateItemCommand') {
                return Promise.resolve({});
            }

            if (name === 'PublishCommand') {
                return Promise.resolve({});
            }

            throw new Error(`Unexpected command: ${name}`);
        });

        const event = {
            Records: [
                {
                    messageId: '1',
                    body: JSON.stringify({
                        title: 'p-existing',
                        price: '100',
                        count: '3',
                    }),
                },
            ],
        };

        const result = await invoke(event);

        expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateItemCommand));
        expect(result.batchItemFailures).toHaveLength(0);
    });

    it('marks invalid message as failure', async () => {
        const event = {
            Records: [
                {
                    messageId: '1',
                    body: JSON.stringify({
                        title: '',
                        price: 'invalid',
                        count: '0',
                    }),
                },
            ],
        };

        const result = await invoke(event);

        expect(result.batchItemFailures).toEqual([
            { itemIdentifier: '1' },
        ]);
    });

    it('skips CSV header and does not fail', async () => {
        const event = {
            Records: [
                {
                    messageId: '1',
                    body: JSON.stringify({
                        title: 'title',
                        price: 'price',
                        count: 'count',
                    }),
                },
            ],
        };

        const result = await invoke(event);

        expect(result.batchItemFailures).toHaveLength(0);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('handles partial failure correctly', async () => {
        mockSend.mockImplementation((command: any) => {
            const name = command.constructor.name;

            if (name === 'QueryCommand') {
                return Promise.resolve({ Items: [] });
            }

            if (name === 'TransactWriteItemsCommand') {
                return Promise.resolve({});
            }

            if (name === 'PublishCommand') {
                return Promise.resolve({});
            }

            throw new Error(`Unexpected command: ${name}`);
        });

        const event = {
            Records: [
                {
                    messageId: '1',
                    body: JSON.stringify({
                        title: 'valid',
                        price: '100',
                        count: '1',
                    }),
                },
                {
                    messageId: '2',
                    body: JSON.stringify({
                        title: '',
                        price: 'bad',
                        count: '0',
                    }),
                },
            ],
        };

        const result = await invoke(event);

        expect(result.batchItemFailures).toEqual([
            { itemIdentifier: '2' },
        ]);
    });
});
