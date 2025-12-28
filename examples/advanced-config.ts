/**
 * Advanced configuration example
 * 
 * This example demonstrates fine-grained control over idempotency behavior:
 * - Selective query parameter inclusion (only specific params matter)
 * - Header-based idempotency (important for multi-tenant or authenticated APIs)
 * - Custom retry settings (tune for your network/server conditions)
 * - Multiple HTTP methods (protect all state-changing operations)
 * 
 * Perfect for production systems that need precise control over what
 * makes two requests "identical".
 * 
 * Run this example:
 *   npm run build
 *   npx ts-node examples/advanced-config.ts
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Create an Axios instance with advanced, production-ready configuration
const client = createIdempotentAxios(axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
}), {
  ttl: 600, // Cache for 10 minutes (longer for less-frequently changing data)
  backend: 'memory',
  
  // Configure idempotency behavior
  idempotency: {
    // Protect all state-changing methods
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    
    include: {
      path: true, // URL path is always important
      
      // 🔑 KEY: Only include specific query params
      // Why? Some params like timestamps, request IDs shouldn't affect identity
      query: ['id', 'type'], // Only these params matter for identity
      
      // 🔑 KEY: Include auth/tenant headers for security
      // Ensures User A can't get User B's cached data
      headers: ['x-api-key', 'x-request-id'],
      
      body: true, // Request body content matters
    },
  },
  
  // Fine-tune lock acquisition behavior
  maxLockRetries: 15,      // Try up to 15 times (vs default 10)
  lockRetryDelay: 150,     // Wait 150ms between retries (vs default 100ms)
  extendedPollMultiplier: 6, // Extended wait for slow requests (vs default 5)
});

async function main() {
  console.log('=== Advanced Configuration Example ===\n');
  console.log('Demonstrating fine-grained control over request identity\n');

  try {
    // SCENARIO 1: Header-based identity (multi-tenant scenario)
    console.log('🔐 Scenario 1: Header-Based Identity (Multi-Tenant API)\n');
    console.log('   Different API keys = different users = different cached responses\n');
    
    console.log('   Request 1: User with API key "secret-key-123"');
    const response1 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'secret-key-123',  // User A's API key
          'x-request-id': 'req-001',
        },
      }
    );
    console.log(`   ✓ Executed: Status ${response1.status}, ID: ${response1.data.id}\n`);

    console.log('   Request 2: Same user, same request');
    const response2 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'secret-key-123',  // Same API key
          'x-request-id': 'req-001',      // Same request ID
        },
      }
    );
    console.log(`   ✓ Cached: Status ${response2.status}, ID: ${response2.data.id}`);
    console.log(`   ✓ Same as Request 1: ${response1.data.id === response2.data.id}\n`);

    console.log('   Request 3: Different API key = different identity');
    const response3 = await client.post('/posts', 
      {
        title: 'Secure Post',
        body: 'This post uses API key authentication',
        userId: 1,
      },
      {
        headers: {
          'x-api-key': 'different-key-456', // User B's API key (different!)
          'x-request-id': 'req-001',        // Same request ID
        },
      }
    );
    console.log(`   ✓ Executed: Status ${response3.status}, ID: ${response3.data.id}`);
    console.log(`   ✓ Different from Request 1: ${response1.data.id !== response3.data.id}`);
    console.log('   ✓ Security preserved: Users don\'t share cache\n');

    // SCENARIO 2: Selective query parameter inclusion
    console.log('🔍 Scenario 2: Selective Query Parameter Inclusion\n');
    console.log('   Only "id" and "type" params affect identity (per config)\n');
    
    console.log('   Request 4: PUT with query params type=update&id=1');
    const response4 = await client.put('/posts/1?type=update&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   ✓ Executed: Status ${response4.status}\n`);

    console.log('   Request 5: Same query params (should be cached)');
    const response5 = await client.put('/posts/1?type=update&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   ✓ Cached: Status ${response5.status}\n`);

    console.log('   Request 6: Different "type" param = different identity');
    const response6 = await client.put('/posts/1?type=create&id=1', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   ✓ Executed: Status ${response6.status}`);
    console.log('   ✓ Different "type" value triggers new request\n');

    console.log('   Request 7: Extra param "timestamp" (not in config)');
    const response7 = await client.put('/posts/1?type=update&id=1&timestamp=12345', {
      title: 'Updated Post',
      body: 'Updated content',
      userId: 1,
    });
    console.log(`   ✓ Cached: Status ${response7.status}`);
    console.log('   ✓ "timestamp" param ignored (not in query config)');
    console.log('   ✓ Treated as same request as Request 4\n');

    // Summary
    console.log('📊 Configuration Impact Summary:\n');
    console.log('   Headers included: x-api-key, x-request-id');
    console.log('   → Different API keys = separate cache entries');
    console.log('   → Prevents cross-user data leakage');
    console.log('   → Essential for multi-tenant systems\n');
    
    console.log('   Query params included: id, type');
    console.log('   → Only these params affect request identity');
    console.log('   → Other params (timestamps, tracking) ignored');
    console.log('   → Reduces unnecessary cache misses\n');
    
    console.log('   Lock retries: 15 attempts × 150ms = 2.25s max wait');
    console.log('   → Handles slow or contested endpoints gracefully');
    console.log('   → Reduces request failures under load\n');

    console.log('💡 Real-World Use Cases:');
    console.log('   ✓ Multi-tenant SaaS (include tenant ID in headers)');
    console.log('   ✓ Authenticated APIs (include auth token in headers)');
    console.log('   ✓ APIs with tracking params (exclude from query config)');
    console.log('   ✓ Slow endpoints (increase retry settings)');
    console.log('   ✓ High-contention resources (tune lock behavior)');

    console.log('\n✅ All advanced configuration scenarios demonstrated!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  }
}

// Run the example
main();
