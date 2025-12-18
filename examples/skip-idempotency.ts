/**
 * Skip idempotency example
 * 
 * This example shows how to skip idempotency for specific requests
 * when you need every request to be executed
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

const client = createIdempotentAxios(axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
}), {
  ttl: 300,
  idempotency: {
    methods: ['POST'],
  },
});

async function main() {
  console.log('=== Skip Idempotency Example ===\n');

  try {
    // Regular request (idempotency enabled)
    console.log('1. First POST request (idempotency enabled)...');
    const response1 = await client.post('/posts', {
      title: 'Regular Post',
      body: 'This uses idempotency',
      userId: 1,
    });
    console.log(`   Response: ${response1.status} - ID: ${response1.data.id}`);

    // Duplicate request (will be cached)
    console.log('\n2. Duplicate POST request (will be cached)...');
    const response2 = await client.post('/posts', {
      title: 'Regular Post',
      body: 'This uses idempotency',
      userId: 1,
    });
    console.log(`   Response: ${response2.status} - ID: ${response2.data.id}`);

    // Request with idempotency skipped
    console.log('\n3. POST request with _skipIdempotency flag...');
    const response3 = await client.post('/posts', 
      {
        title: 'Regular Post',
        body: 'This uses idempotency',
        userId: 1,
      },
      {
        _skipIdempotency: true, // Skip idempotency for this request
      } as any
    );
    console.log(`   Response: ${response3.status} - ID: ${response3.data.id}`);

    // Another skipped request
    console.log('\n4. Another POST request with _skipIdempotency flag...');
    const response4 = await client.post('/posts', 
      {
        title: 'Regular Post',
        body: 'This uses idempotency',
        userId: 1,
      },
      {
        _skipIdempotency: true,
      } as any
    );
    console.log(`   Response: ${response4.status} - ID: ${response4.data.id}`);

    console.log('\n✅ Requests with _skipIdempotency always execute!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
