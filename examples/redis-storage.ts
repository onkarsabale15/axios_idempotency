/**
 * Redis-based storage example for distributed systems
 * 
 * This example demonstrates how to use Redis for idempotency across:
 * - Multiple server instances (load balancing)
 * - Multiple processes (horizontal scaling)
 * - Multiple containers (Kubernetes, Docker Swarm)
 * - Multiple geographic regions
 * 
 * Redis provides:
 * ✅ Distributed locking (prevents race conditions across instances)
 * ✅ Shared cache (all instances see the same cached responses)
 * ✅ Atomic operations (thread-safe lock acquisition)
 * ✅ TTL management (automatic expiration)
 * 
 * Prerequisites:
 * 1. Redis server running: `redis-server` or Docker: `docker run -p 6379:6379 redis`
 * 2. Install ioredis: `npm install ioredis`
 * 3. Uncomment the code below to run
 * 
 * Run this example:
 *   npm run build
 *   npx ts-node examples/redis-storage.ts
 * 
 * Test distributed behavior:
 *   Terminal 1: npx ts-node examples/redis-storage.ts
 *   Terminal 2: npx ts-node examples/redis-storage.ts (simultaneously)
 *   Both will coordinate via Redis!
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Uncomment when actually using Redis:
// import { Redis } from 'ioredis';

async function main() {
  console.log('=== Redis Storage Example (Distributed Systems) ===\n');
  console.log('🌐 This example shows how to coordinate requests across multiple servers\n');

  // Note: This example shows the configuration but requires Redis to run
  console.log('📋 Setup Instructions:');
  console.log('   1. Start Redis server:');
  console.log('      → Local: redis-server');
  console.log('      → Docker: docker run -p 6379:6379 redis:latest');
  console.log('   2. Install ioredis: npm install ioredis');
  console.log('   3. Uncomment the code below and run again\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  /*
  console.log('🔌 Connecting to Redis...\n');
  
  // Create Redis client with production-ready configuration
  const redis = new Redis({
    host: 'localhost',  // Change to your Redis host
    port: 6379,         // Default Redis port
    // password: 'your-redis-password', // Enable if Redis has auth
    // db: 0,           // Redis database number
    
    // Connection options for reliability
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      console.log(`   ⟳ Retry attempt ${times}, waiting ${delay}ms...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true, // Connect manually for better error handling
  });

  // Set up connection event handlers
  redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
  });

  redis.on('connect', () => {
    console.log('   🔗 Connected to Redis');
  });

  redis.on('ready', () => {
    console.log('   ✅ Redis is ready\n');
  });

  redis.on('reconnecting', () => {
    console.log('   ⟳ Reconnecting to Redis...');
  });

  // Connect to Redis
  try {
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connection successful!\n');
  } catch (error: any) {
    console.error('❌ Failed to connect to Redis:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Is Redis running? Check with: redis-cli ping');
    console.log('   • Correct host/port? Default is localhost:6379');
    console.log('   • Firewall blocking connection?');
    console.log('   • Authentication required? Add password to config');
    return;
  }

  // Create idempotent Axios client with Redis backend
  const client = createIdempotentAxios(axios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
  }), {
    backend: 'redis',      // 🔑 Use Redis instead of memory
    redisClient: redis,    // Pass Redis client instance
    ttl: 300,              // Cache for 5 minutes in Redis
    
    idempotency: {
      methods: ['POST', 'PUT', 'PATCH'],
      include: {
        path: true,
        query: true,
        headers: [], // Add ['authorization'] if using auth
        body: true,
      },
    },
    
    // Lock settings for distributed environment
    maxLockRetries: 20,        // More retries for network latency
    lockRetryDelay: 200,       // 200ms between retries
    extendedPollMultiplier: 10, // Extended wait for slow networks
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // TEST 1: First request
    console.log('🚀 Test 1: Making first POST request');
    console.log('   This will:');
    console.log('   1. Acquire distributed lock in Redis');
    console.log('   2. Execute HTTP request');
    console.log('   3. Cache response in Redis');
    console.log('   4. Release lock\n');
    
    const startTime1 = Date.now();
    const response1 = await client.post('/posts', {
      title: 'Redis-backed Post',
      body: 'This is stored in Redis and shared across all instances',
      userId: 1,
    });
    const elapsed1 = Date.now() - startTime1;
    
    console.log(`   ✓ Response: Status ${response1.status}, ID: ${response1.data.id}`);
    console.log(`   ✓ Time: ${elapsed1}ms\n`);

    // TEST 2: Duplicate request (from same instance)
    console.log('🚀 Test 2: Making duplicate POST request');
    console.log('   Expected behavior:');
    console.log('   1. Check Redis cache');
    console.log('   2. Find cached response');
    console.log('   3. Return immediately (no HTTP call)\n');
    
    const startTime2 = Date.now();
    const response2 = await client.post('/posts', {
      title: 'Redis-backed Post',
      body: 'This is stored in Redis and shared across all instances',
      userId: 1,
    });
    const elapsed2 = Date.now() - startTime2;
    
    console.log(`   ✓ Response: Status ${response2.status}, ID: ${response2.data.id}`);
    console.log(`   ✓ Time: ${elapsed2}ms (from Redis cache)`);
    console.log(`   ✓ Same as first request: ${response1.data.id === response2.data.id}`);
    console.log(`   ✓ Speed improvement: ${elapsed1}ms → ${elapsed2}ms\n`);

    // Inspect Redis cache
    console.log('🔍 Inspecting Redis cache:\n');
    const cacheKeys = await redis.keys('axios-idempotent:*');
    console.log(`   Cache entries in Redis: ${cacheKeys.length}`);
    
    if (cacheKeys.length > 0) {
      console.log('   Cache keys:');
      for (const key of cacheKeys) {
        const ttl = await redis.ttl(key);
        console.log(`   • ${key.substring(0, 50)}... (TTL: ${ttl}s)`);
      }
    }
    console.log();

    // TEST 3: Different request
    console.log('🚀 Test 3: Making different POST request');
    console.log('   Different body = different cache key\n');
    
    const response3 = await client.post('/posts', {
      title: 'Another Redis Post',
      body: 'This is a different request',
      userId: 1,
    });
    console.log(`   ✓ Response: Status ${response3.status}, ID: ${response3.data.id}`);
    console.log(`   ✓ New request executed (different cache key)\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Redis Storage Benefits:\n');
    console.log('   ✅ Works across multiple server instances');
    console.log('   ✅ Distributed locking prevents race conditions');
    console.log('   ✅ Shared cache reduces API calls globally');
    console.log('   ✅ Automatic TTL management by Redis');
    console.log('   ✅ Scales horizontally without issues\n');

    console.log('🎯 Production Deployment Scenarios:\n');
    console.log('   • Kubernetes: All pods share same Redis instance');
    console.log('   • Load Balancer: All servers coordinate via Redis');
    console.log('   • Multi-Region: Use Redis Cluster for global coordination');
    console.log('   • Auto-Scaling: New instances automatically use shared cache\n');

    console.log('💡 Next Steps for Production:\n');
    console.log('   1. Use Redis Sentinel or Redis Cluster for high availability');
    console.log('   2. Enable Redis authentication (requirepass)');
    console.log('   3. Use TLS/SSL for Redis connections');
    console.log('   4. Monitor Redis memory usage and eviction policy');
    console.log('   5. Set up Redis backups (RDB/AOF)');
    console.log('   6. Configure appropriate TTL for your use case\n');

    console.log('✅ Redis storage working correctly!');

  } catch (error: any) {
    console.error('\n❌ Error during execution:', error.message);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  } finally {
    // Clean up: Gracefully close Redis connection
    console.log('\n🔌 Closing Redis connection...');
    await redis.quit();
    console.log('✅ Redis connection closed');
  }
  */

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📝 Configuration example shown above');
  console.log('   Uncomment the code to run with actual Redis server\n');
  console.log('🧪 To test distributed behavior:');
  console.log('   1. Uncomment the code');
  console.log('   2. Open two terminals');
  console.log('   3. Run this script simultaneously in both');
  console.log('   4. Observe coordination via Redis logs\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Run the example
main();
