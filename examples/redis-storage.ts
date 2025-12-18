/**
 * Redis-based storage example
 * 
 * This example shows how to use Redis for distributed idempotency
 * across multiple processes or servers
 * 
 * Prerequisites:
 * - Redis server running locally or remotely
 * - ioredis package installed
 */

import axios from 'axios';
import { createIdempotentAxios } from '../dist/index';

// Uncomment when actually using Redis:
// import { Redis } from 'ioredis';

async function main() {
  console.log('=== Redis Storage Example ===\n');

  // Note: This example shows the configuration but won't run without Redis
  console.log('To use Redis storage:');
  console.log('1. Install ioredis: npm install ioredis');
  console.log('2. Start Redis server');
  console.log('3. Uncomment the Redis configuration below\n');

  /*
  // Create Redis client
  const redis = new Redis({
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // if required
    // db: 0,
  });

  // Test Redis connection
  try {
    await redis.ping();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    return;
  }

  // Create idempotent Axios client with Redis backend
  const client = createIdempotentAxios(axios.create({
    baseURL: 'https://jsonplaceholder.typicode.com',
  }), {
    backend: 'redis',
    redisClient: redis,
    ttl: 300, // Cache for 5 minutes
    idempotency: {
      methods: ['POST', 'PUT', 'PATCH'],
      include: {
        path: true,
        query: true,
        headers: [],
        body: true,
      },
    },
  });

  try {
    console.log('\n1. Making first POST request...');
    const response1 = await client.post('/posts', {
      title: 'Redis-backed Post',
      body: 'This is stored in Redis',
      userId: 1,
    });
    console.log(`   Response: ${response1.status} - ID: ${response1.data.id}`);

    console.log('\n2. Making duplicate POST request (will be cached in Redis)...');
    const response2 = await client.post('/posts', {
      title: 'Redis-backed Post',
      body: 'This is stored in Redis',
      userId: 1,
    });
    console.log(`   Response: ${response2.status} - ID: ${response2.data.id}`);

    // Verify cache is in Redis
    const cacheKeys = await redis.keys('axios-idempotent:*');
    console.log(`\n📊 Cache keys in Redis: ${cacheKeys.length}`);

    console.log('\n✅ Redis storage working correctly!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    // Clean up
    await redis.quit();
  }
  */

  console.log('\n📝 Example configuration shown above');
  console.log('   Uncomment the code to run with actual Redis server');
}

main();
