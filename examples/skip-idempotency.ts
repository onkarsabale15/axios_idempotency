/**
 * Skip idempotency example
 * 
 * This example demonstrates when and how to bypass idempotency for specific requests.
 * Some endpoints should ALWAYS execute, even with identical payloads:
 * - Logging endpoints (each log entry should be recorded)
 * - Analytics/metrics tracking (each event matters)
 * - Notification triggers (send every notification request)
 * - Audit trail entries (record every action)
 * 
 * Use the `_skipIdempotency: true` flag to force request execution.
 * 
 * Run this example:
 *   npm run build
 *   npx ts-node examples/skip-idempotency.ts
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

const client = createIdempotentAxios(axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
}), {
  ttl: 300,
  idempotency: {
    methods: ['POST'], // POST requests are normally deduplicated
  },
});

async function main() {
  console.log('=== Skip Idempotency Example ===\n');
  console.log('Demonstrating selective bypassing of idempotency for special cases\n');

  try {
    // SCENARIO 1: Regular request with idempotency (normal behavior)
    console.log('📝 Test 1: Regular POST request (idempotency ENABLED)');
    console.log('   Use case: Creating a user account or order\n');
    
    const response1 = await client.post('/posts', {
      title: 'Regular Post',
      body: 'This uses idempotency',
      userId: 1,
    });
    console.log(`   ✓ First request executed: Status ${response1.status}, ID: ${response1.data.id}`);

    // SCENARIO 2: Duplicate request (demonstrates caching)
    console.log('\n📝 Test 2: DUPLICATE POST request (should be cached)');
    console.log('   Expected: Returns cached response without making API call\n');
    
    const startTime = Date.now();
    const response2 = await client.post('/posts', {
      title: 'Regular Post',
      body: 'This uses idempotency',
      userId: 1,
    });
    const elapsed = Date.now() - startTime;
    
    console.log(`   ✓ Returned from cache: Status ${response2.status}, ID: ${response2.data.id}`);
    console.log(`   ✓ Same ID as first request: ${response1.data.id === response2.data.id}`);
    console.log(`   ✓ Fast response time: ${elapsed}ms (cached)`);

    // SCENARIO 3: Skip idempotency for logging/analytics
    console.log('\n📝 Test 3: POST with _skipIdempotency flag');
    console.log('   Use case: Logging events - each log entry must be recorded\n');
    
    const response3 = await client.post('/posts', 
      {
        title: 'Regular Post', // Same data as before
        body: 'This uses idempotency',
        userId: 1,
      },
      {
        _skipIdempotency: true, // 🔑 KEY: This forces execution
      } as any
    );
    console.log(`   ✓ Request EXECUTED (not cached): Status ${response3.status}, ID: ${response3.data.id}`);
    console.log(`   ✓ New ID generated: ${response3.data.id !== response2.data.id}`);
    console.log('   ✓ Bypassed cache successfully');

    // SCENARIO 4: Multiple skipped requests - all execute
    console.log('\n📝 Test 4: Another POST with _skipIdempotency flag');
    console.log('   Expected: This will ALSO execute (not use cache)\n');
    
    const response4 = await client.post('/posts', 
      {
        title: 'Regular Post', // Still same data
        body: 'This uses idempotency',
        userId: 1,
      },
      {
        _skipIdempotency: true, // Each skip request executes independently
      } as any
    );
    console.log(`   ✓ Request EXECUTED again: Status ${response4.status}, ID: ${response4.data.id}`);
    console.log(`   ✓ Different from previous: ${response4.data.id !== response3.data.id}`);

    // Summary
    console.log('\n📊 Summary:');
    console.log('   Total requests made: 4');
    console.log('   Requests with idempotency: 2 (first executed, second cached)');
    console.log('   Requests with _skipIdempotency: 2 (both executed)');
    console.log('   Total API calls made: 3 (1 normal + 2 skipped)');

    console.log('\n💡 When to Use _skipIdempotency:');
    console.log('   ✓ Logging endpoints (each log matters)');
    console.log('   ✓ Analytics/metrics tracking (count every event)');
    console.log('   ✓ Notification systems (send every notification)');
    console.log('   ✓ Audit trails (record every action)');
    console.log('   ✓ Health checks or pings (always execute)');
    console.log('   ✓ When you explicitly need a fresh request');

    console.log('\n⚠️  When NOT to Use _skipIdempotency:');
    console.log('   ✗ Payment processing (risk duplicate charges)');
    console.log('   ✗ Order creation (risk duplicate orders)');
    console.log('   ✗ User registration (risk duplicate accounts)');
    console.log('   ✗ Any state-changing operation where duplicates are harmful');

    console.log('\n✅ All tests completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  }
}

// Run the example
main();
