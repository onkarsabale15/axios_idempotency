/**
 * Advanced configuration example
 * 
 * This example demonstrates advanced configuration options including:
 * - Selective query parameter inclusion
 * - Header-based idempotency
 * - Custom retry settings
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Create an Axios instance with advanced configuration
const client = createIdempotentAxios(axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
}), {
  ttl: 600, // Cache for 10 minutes
  backend: 'memory',
  idempotency: {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    include: {
      path: true,
      query: ['id', 'type'], // Only include specific query params
      headers: ['x-api-key', 'x-request-id'], // Include specific headers
      body: true,
    },
  },
  maxLockRetries: 15, // Try 15 times to acquire lock
  lockRetryDelay: 150, // Wait 150ms between retries
});

async function main() {
  console.log('=== Advanced Configuration Example ===\n');

  try {
    // Request with custom headers (included in idempotency key)
    console.log('1. POST with custom headers...');
    const response1 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'secret-key-123',
          'x-request-id': 'req-001',
        },
      }
    );
    console.log(`   Response: ${response1.status} - ID: ${response1.data.id}`);

    // Same request - will be cached
    console.log('\n2. Duplicate request with same headers...');
    const response2 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'secret-key-123',
          'x-request-id': 'req-001',
        },
      }
    );
    console.log(`   Response: ${response2.status} - ID: ${response2.data.id}`);

    // Different API key - will execute new request
    console.log('\n3. Same request but different API key...');
    const response3 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'different-key-456',
          'x-request-id': 'req-001',
        },
      }
    );
    console.log(`   Response: ${response3.status} - ID: ${response3.data.id}`);

    // Request with query parameters
    console.log('\n4. PUT with query parameters...');
    const response4 = await client.put('/posts/1?type=update&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   Response: ${response4.status}`);

    // Same request - will be cached
    console.log('\n5. Duplicate PUT request...');
    const response5 = await client.put('/posts/1?type=update&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   Response: ${response5.status}`);

    // Different query param - will execute new request
    console.log('\n6. PUT with different query parameters...');
    const response6 = await client.put('/posts/1?type=create&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   Response: ${response6.status}`);

    console.log('\n✅ All requests completed successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
