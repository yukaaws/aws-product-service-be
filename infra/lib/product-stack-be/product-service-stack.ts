
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsListLambda = new lambda.Function(
      this,
      'GetProductsListLambda',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'getProductsList.getProductsList', // 'fileName.functionName'
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../product-lambda/products')
        ),
      }
    );
    
    const getProductsByIdLambda = new lambda.Function(
      this,
      'GetProductsByIdLambda',
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'getProductsById.getProductsById',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../product-lambda/products')
        ),
      }
    );


    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
       description: "This API serves the Lambda functions."
    });

    const getProductsListLambdaIntegration = new apigateway.LambdaIntegration(getProductsListLambda, {
    });

    const getProductsByIdLambdaIntegration = new apigateway.LambdaIntegration(getProductsByIdLambda, {
    });

    const products = api.root.addResource('products');
    products.addMethod(
      'GET',
       getProductsListLambdaIntegration
    );
    const productById = products.addResource('{productId}');
    
    productById.addMethod(
      'GET',
      getProductsByIdLambdaIntegration
    );
  }
}
