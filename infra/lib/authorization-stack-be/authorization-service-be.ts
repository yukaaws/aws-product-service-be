import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AuthorizerStack extends cdk.Stack {
    public readonly basicAuthorizerLambdaArn: string;
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        dotenv.config({ path: path.join(__dirname, './.env') });
        /** Lambda */
        const basicAuthorizer = new NodejsFunction(this, 'BasicAuthorizer', {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, '../basic-authorizer-lambda/basicAuthorizer.ts'),
            handler: 'basicAuthorizer',
            environment: {
                yukaaws: process.env.yukaaws!,
            },
        });

        basicAuthorizer.addPermission('AllowApiGatewayInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        });

        this.basicAuthorizerLambdaArn = basicAuthorizer.functionArn;
    }

}