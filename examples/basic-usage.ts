/**
 * Basic usage example with in-memory storage
 * 
 * This example demonstrates:
 * 1. How to create an idempotent Axios client with default settings
 * 2. Request deduplication - identical requests return cached responses
 * 3. How different requests are treated as unique
 * 4. How methods not in the configuration are unaffected
 * 
 * Perfect for single-server applications or development environments.
 * 
 * Run this example:
 *   npm run build
 *   npx ts-node examples/basic-usage.ts
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Step 1: Create a regular Axios instance with your configuration
const baseClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000, // Your existing configurations are preserved
});

// Step 2: Wrap it with idempotency features
const client = createIdempotentAxios(baseClient, {
  ttl: 300, // Cache responses for 5 minutes (300 seconds)
  backend: 'memory', // Use in-memory storage (default) - perfect for single-server apps
  
  // Configure which requests to protect
  idempotency: {
    methods: ['POST', 'PUT', 'PATCH'], // Only these methods are deduplicated
    
    // What makes requests "identical"? All these parts by default:
    include: {
      path: true,   // Same URL path
      query: true,  // Same query parameters
      headers: [],  // No headers included (add auth headers if needed!)
      body: true,   // Same request body
    },
  },
});

async function main() {
  console.log('=== Basic Usage Example ===\n');
  console.log('This example shows how duplicate requests are automatically handled.\n');

  try {
    // TEST 1: First request - will execute normally
    console.log('1. Making first POST request...');
    console.log('   → This will make an actual HTTP call');
    const response1 = await client.post('/posts', {
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    });
    console.log(`   ✓ Response: ${response1.status} - ID: ${response1.data.id}`);

    // TEST 2: Duplicate request - will return cached response
    console.log('\n2. Making IDENTICAL POST request...');
    console.log('   → This will NOT make an HTTP call - cached response returned!');
    const startTime = Date.now();
    const response2 = await client.post('/posts', {
      title: 'Test Post',
      body: 'This is a test post',
      userId: 1,
    });
    const elapsed = Date.now() - startTime;
    console.log(`   ✓ Response: ${response2.status} - ID: ${response2.data.id}`);
    console.log(`   ✓ Returned in ${elapsed}ms (from cache)`);
    console.log(`   ✓ Both responses are identical: ${response1.data.id === response2.data.id}`);

    // TEST 3: Different request - will execute normally
    console.log('\n3. Making DIFFERENT POST request...');
    console.log('   → Body is different, so this WILL make an HTTP call');
    const response3 = await client.post('/posts', {
      title: 'Different Post', // Changed content
      body: 'This is a different post',
      userId: 1,
    });
    console.log(`   ✓ Response: ${response3.status} - ID: ${response3.data.id}`);
    console.log(`   ✓ New ID generated: ${response3.data.id}`);

    // TEST 4: GET request - not affected by idempotency
    console.log('\n4. Making GET request...');
    console.log('   → GET is not in configured methods, so always executes normally');
    const response4 = await client.get('/posts/1');
    console.log(`   ✓ Response: ${response4.status} - Title: ${response4.data.title}`);

    console.log('\n✅ All requests completed successfully!');
    console.log('\n💡 Key Takeaway:');
    console.log('   - Identical POST/PUT/PATCH requests are automatically deduplicated');
    console.log('   - Different requests or non-configured methods execute normally');
    console.log('   - No code changes needed - just wrap your Axios instance!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('   Check your network connection or API availability');
  }
}

// Run the example
main();
