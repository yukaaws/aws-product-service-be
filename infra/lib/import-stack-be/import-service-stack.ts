
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';


export interface ImportServiceStackProps extends cdk.StackProps {
    catalogItemsQueue: sqs.IQueue;
}


export class ImportServiceStack extends cdk.Stack {
    public readonly importBucket: s3.Bucket;
    constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
        super(scope, id, props);

        this.importBucket = new s3.Bucket(this, 'ImportServiceBucket', {
            bucketName: `import-service-bucket-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Note: only use DESTROY for development
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
        });

        /**
         * Create "uploaded/" folder (prefix)
         */
        new s3deploy.BucketDeployment(this, 'UploadedFolder', {
            destinationBucket: this.importBucket,
            destinationKeyPrefix: 'uploaded',
            sources: [s3deploy.Source.data('README.md', 'Uploaded files go here')],
        });

        /** Lambda */
        const importProductsFile = new NodejsFunction(this, 'ImportProductsFile', {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, '../import-lambda/importProductsFile.ts'),
            handler: 'handler',
            environment: {
                IMPORT_BUCKET: this.importBucket.bucketName,
            },
        });

        /**
         * importFileParser Lambda
         */
        const importFileParser = new NodejsFunction(this, 'ImportFileParser', {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, '../import-lambda/importFileParser.ts'),
            handler: 'handler',
            environment: {
                IMPORT_BUCKET: this.importBucket.bucketName,
                SQS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
            },
        });

        /** IAM permissions */
        this.importBucket.grantPut(importProductsFile);
        this.importBucket.grantReadWrite(importFileParser);
        props.catalogItemsQueue.grantSendMessages(importFileParser)

        /**
         * S3 → Lambda notification
         * Trigger only for uploaded/*
         */
        this.importBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParser),
            { prefix: 'uploaded/' }
        );

        /** API Gateway */
        const api = new apigateway.RestApi(this, 'ImportApi', {
            restApiName: 'Import Service',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['GET'],
            },
        });

        const importResource = api.root.addResource('import');
        importResource.addMethod(
            'GET',
            new apigateway.LambdaIntegration(importProductsFile)
        );

        /** Output */
        new cdk.CfnOutput(this, 'ImportApiUrl', {
            value: api.url,
        });


    }
}
