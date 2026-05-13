
import { S3Event } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import csv from 'csv-parser';

const s3 = new S3Client({});
const sqs = new SQSClient({});

const { SQS_QUEUE_URL } = process.env;

if (!SQS_QUEUE_URL) {
  throw new Error('SQS_QUEUE_URL environment variable is not set');
}

export const handler = async (event: S3Event): Promise<void> => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file s3://${bucket}/${key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3.send(command);

    if (!response.Body) {
      throw new Error('S3 object body is empty');
    }

    // Parse CSV and send messages to SQS
    await new Promise<void>((resolve, reject) => {
      const stream = response.Body as NodeJS.ReadableStream;
      const sendPromises: Promise<any>[] = [];
      stream
        .pipe(csv())
        .on('data', (record) => {

          console.log(`Sending message to SQS ${JSON.stringify(record)} to url  : ${SQS_QUEUE_URL}`,);
          const sendPromise = sqs.send(
            new SendMessageCommand({
              QueueUrl: SQS_QUEUE_URL,
              MessageBody: JSON.stringify(record),
            })
          );
          sendPromises.push(sendPromise);
        })
        .on('end',
          async () => {
            try {
              // WAIT for ALL sends
              await Promise.all(sendPromises);

              console.log(`All messages sent to SQS: ${sendPromises.length}`);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        )
        .on('error', reject);
    });

    // Move file to parsed/
    const parsedKey = key.replace('uploaded/', 'parsed/');

    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: parsedKey,
      })
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    console.log(`File moved to ${parsedKey}`);
  }
};
