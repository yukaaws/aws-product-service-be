#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ProductServiceStack } from '../lib/product-stack-be/product-service-stack';
import { ImportServiceStack } from '../lib/import-stack-be/import-service-stack';
import { AuthorizerStack } from '../lib/authorization-stack-be/authorization-service-be';

const app = new cdk.App();

// Cross stack references are only supported for stacks deployed to the same account
// stacks to be in the same AWS account + region
const env = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const authorizerStack = new AuthorizerStack(app, 'AuthorizerStack', {
  env,
})

const productStack = new ProductServiceStack(app, 'ProductServiceStack', {
  env,
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new ImportServiceStack(app, 'ImportServiceStack', {
  catalogItemsQueue: productStack.catalogItemsQueue,
  basicAuthorizerLambdaArn: authorizerStack.basicAuthorizerLambdaArn,
  env,
});

