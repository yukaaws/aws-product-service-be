import { BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({ region: 'us-west-1'});


const products = [
  {
    id: randomUUID(),
    title: 'iPhone 15',
    description: 'Latest Apple smartphone',
    price: 1200,
    count: 5,
  },
  {
    id: randomUUID(),
    title: 'MacBook Pro',
    description: 'Apple laptop',
    price: 2500,
    count: 3,
  }
];


async function seed() {
  const productItems = products.map(p => ({
    PutRequest: {
      Item: {
        id: { S: p.id },
        title: { S: p.title },
        description: { S: p.description },
        price: { N: String(p.price) }
      }
    }
  }));

  const stockItems = products.map(p => ({
    PutRequest: {
      Item: {
        product_id: { S: p.id },
        count: { N: String(p.count) }
      }
    }
  }));

  await client.send(new BatchWriteItemCommand({
    RequestItems: {
      products: productItems,
      stock: stockItems
    }
  }));

  console.log('✅ DynamoDB seeded');
}

seed().catch(console.error);
