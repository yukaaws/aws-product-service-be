
import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

export const basicAuthorizer = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Event:', event);

  try {
    const token = event.authorizationToken;
 
  // 401 — no Authorization header
  if (!token) {
    console.error('No tocken');
    // ! DO NOT THROW
    return generatePolicy('user', 'Deny', event.methodArn);
    // throw new Error('Unauthorized');
  }

    // Expected: "Basic base64(login:password)"
    const encodedCredentials = token.split(' ')[1];
    const decoded = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [login, password] = decoded.split(':');

    const expectedPassword = process.env[login];

    // 403 — invalid credentials
    if (!expectedPassword || expectedPassword !== password) {
      console.error('Invalid credentials');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // Authorized
    return generatePolicy(login, 'Allow', event.methodArn);
  } catch (e) {
    console.error('Auth error:', e);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  },
});
