import { APIGatewayProxyHandler } from 'aws-lambda';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: { queryStringParameters: { name: any; }; }) => {
    try {
        const fileName = event.queryStringParameters?.name;

        if (!fileName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Query parameter "name" is required' }),
            };
        }


        const command = new PutObjectCommand({
            Bucket: process.env.IMPORT_BUCKET,
            Key: `uploaded/${fileName}`,
            ContentType: 'text/csv',
        });

        const signedUrl = await getSignedUrl(s3, command, {
            expiresIn: 60,
        });


        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ url: signedUrl }),
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    }
};
