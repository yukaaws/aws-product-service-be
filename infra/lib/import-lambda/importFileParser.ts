
import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import csv from 'csv-parser';

const s3 = new S3Client({});

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
      console.warn('Empty S3 object body');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      (response.Body as NodeJS.ReadableStream)
        .pipe(csv())
        .on('data', (data) => {
          console.log('CSV record:', data);
        })
        .on('end', () => {
          console.log('CSV file processing completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('CSV parsing error', err);
          reject(err);
        });
    });
  }
};
