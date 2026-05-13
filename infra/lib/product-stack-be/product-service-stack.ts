
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';


export class ProductServiceStack extends cdk.Stack {
  //  Queue is publicly exposed to other stacks
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(
      this,
      'ProductsTable',
      'products'
    );

    const stockTable = dynamodb.Table.fromTableName(
      this,
      'StockTable',
      'stock'
    );

    const environment = {
      PRODUCTS_TABLE: productsTable.tableName,
      STOCK_TABLE: stockTable.tableName,
    };

    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
    });

    const getProductsListLambda = new NodejsFunction(
      this,
      'GetProductsListLambda',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          '../product-lambda/products/getProductsList.ts'
        ),
        handler: 'getProductsList',
        // less then SQS
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
        },
        environment,
      }
    );

    productsTable.grantReadData(getProductsListLambda);
    stockTable.grantReadData(getProductsListLambda);

    const getProductsByIdLambda = new NodejsFunction(
      this,
      'GetProductsByIdLambda',
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          '../product-lambda/products/getProductsById.ts'
        ),
        handler: 'getProductsById', // exported function name
        bundling: {
          minify: false,
          sourceMap: true,
        },
        environment,
      }
    );

    productsTable.grantReadData(getProductsByIdLambda);
    stockTable.grantReadData(getProductsByIdLambda);


    const createProductLambda = new NodejsFunction(
      this,
      'CreateProductLambda',
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          '../product-lambda/products/createProduct.ts'
        ),
        handler: 'createProduct',
        environment,
      }
    );


    productsTable.grantWriteData(createProductLambda);
    stockTable.grantWriteData(createProductLambda);

    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      description: "This API serves the Lambda functions.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },

    });

    const productSchema: apigateway.JsonSchema = {
      type: apigateway.JsonSchemaType.OBJECT,
      description: 'Product entity returned by Product Service',
      properties: {
        id: {
          type: apigateway.JsonSchemaType.STRING,
          description: 'Unique product identifier',
        },
        title: {
          type: apigateway.JsonSchemaType.STRING,
          description: 'Product title',
        },
        description: {
          type: apigateway.JsonSchemaType.STRING,
          description: 'Product description',
        },
        price: {
          type: apigateway.JsonSchemaType.NUMBER,
          description: 'Product price',
        },
      },
      required: ['id', 'title', 'price'],
    };


    const productModel = new apigateway.Model(this, 'ProductModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'Product',
      schema: productSchema,
    });

    const productsModel = new apigateway.Model(this, 'ProductsModel', {
      restApi: api,
      contentType: 'application/json',
      modelName: 'Products',
      schema: {
        type: apigateway.JsonSchemaType.ARRAY,
        description: 'List of available products',
        items: productSchema,
      },
    });

    const getProductsListLambdaIntegration = new apigateway.LambdaIntegration(getProductsListLambda, {
      proxy: true,
    });

    const getProductsByIdLambdaIntegration = new apigateway.LambdaIntegration(getProductsByIdLambda, {
      proxy: true,
    });

    const products = api.root.addResource('products');
    products.addMethod(
      'GET',
      getProductsListLambdaIntegration,
      {
        methodResponses: [
          {
            statusCode: '200',
            responseModels: {
              'application/json': productsModel,
            },
          },
        ],
      }
    );

    products.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createProductLambda, {
        proxy: true,
      })
    );

    const productById = products.addResource('{productId}');

    productById.addMethod(
      'GET',
      getProductsByIdLambdaIntegration,
      {
        methodResponses: [
          {
            statusCode: '200',
            responseModels: {
              'application/json': productModel,
            },
          },
          {
            statusCode: '404',
          },
        ],
      }
    );

    // Create SQS queue
    this.catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      // MUST be greater than Lambda timeout
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    // Create catalogBatchProcess Lambda
    const catalogBatchProcess = new NodejsFunction(this, 'CatalogBatchProcess', {
      functionName: 'catalogBatchProcess',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(
        __dirname,
        '../product-lambda/products/catalogBatchProcess.ts'
      ),
      handler: 'catalogBatchProcess',

      environment: {
        ...environment,
        CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
      },

    });

    // Grant DynamoDB access:
    // Write permissions (required for TransactWriteItems)
    productsTable.grantWriteData(catalogBatchProcess);
    stockTable.grantWriteData(catalogBatchProcess);

    // Read/Query permissions for GSI (indexes have separate ARNs)
    catalogBatchProcess.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:Query',
        ],
        resources: [
          'arn:aws:dynamodb:us-west-1:332241527431:table/products',
          'arn:aws:dynamodb:us-west-1:332241527431:table/products/index/*',
        ],
      })
    );

    // Connect SQS to Lambda
    catalogBatchProcess.addEventSource(
      new lambdaEventSources.SqsEventSource(this.catalogItemsQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(5), // wait for messages to accumulate
      })
    );

    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: this.catalogItemsQueue.queueUrl,
    });


    // Must confirm both emails from AWS
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('yuka.github+create@gmail.com', {
        filterPolicy: {
          actionTypeCategory: sns.SubscriptionFilter.stringFilter({
            allowlist: ['create'],
          })
        },
      })
    );

    // Must confirm both emails from AWS
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription('yuka.github+update@gmail.com', {
        filterPolicy: {
          actionTypeCategory: sns.SubscriptionFilter.stringFilter({
            allowlist: ['update'],
          }),
        },
      })
    );

    createProductTopic.grantPublish(catalogBatchProcess);
    this.catalogItemsQueue.grantConsumeMessages(catalogBatchProcess);
  }
}
