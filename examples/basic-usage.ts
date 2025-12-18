/**
 * Basic usage example with in-memory storage
 * 
 * This example shows how to use the axios-idempotency-manager
 * with default in-memory storage for single-process applications
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Create a regular Axios instance
const baseClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
});

// Wrap it with idempotency features
const client = createIdempotentAxios(baseClient, {
  ttl: 300, // Cache for 5 minutes
  backend: 'memory', // Use in-memory storage (default)
  idempotency: {
    methods: ['POST', 'PUT', 'PATCH'], // Apply to these methods
    include: {
      path: true,
      query: true,
      headers: [],
      body: true,
    },
  },
});

async function main() {
  console.log('=== Basic Usage Example ===\n');

  try {
    // First POST request - will be executed
    console.log('1. Making first POST request...');
    const response1 = await client.post('/posts', {
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    });
    console.log(`   Response: ${response1.status} - ID: ${response1.data.id}`);

    // Duplicate POST request - will return cached response
    console.log('\n2. Making duplicate POST request (should be cached)...');
    const response2 = await client.post('/posts', {
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    });
    console.log(`   Response: ${response2.status} - ID: ${response2.data.id}`);

    // Different POST request - will be executed
    console.log('\n3. Making different POST request...');
    const response3 = await client.post('/posts', {
      title: 'Different Post',
      body: 'This is a different post',
      userId: 1,
    });
    console.log(`   Response: ${response3.status} - ID: ${response3.data.id}`);

    // GET request - not affected by idempotency (not in configured methods)
    console.log('\n4. Making GET request (not affected by idempotency)...');
    const response4 = await client.get('/posts/1');
    console.log(`   Response: ${response4.status} - Title: ${response4.data.title}`);

    console.log('\n✅ All requests completed successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
