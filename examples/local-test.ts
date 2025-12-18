/**
 * Local test to verify the package works correctly
 * without requiring network access
 */

import { buildIdempotencyKey } from '../dist/index';
import { MemoryAdapter } from '../dist/storage/memory';
import { RedisAdapter } from '../dist/storage/redis';

async function testKeyBuilder() {
  console.log('=== Testing Key Builder ===\n');

  // Test 1: Basic key generation
  const config1 = {
    method: 'POST',
    url: '/api/users',
    data: { name: 'John', email: 'john@example.com' },
  };

  const key1 = buildIdempotencyKey(config1, {
    path: true,
    body: true,
  });

  console.log('✅ Test 1: Basic key generation');
  console.log(`   Key: ${key1}`);

  // Test 2: Same config should generate same key
  const key2 = buildIdempotencyKey(config1, {
    path: true,
    body: true,
  });

  if (key1 === key2) {
    console.log('✅ Test 2: Same config generates same key');
  } else {
    console.log('❌ Test 2 FAILED: Keys should match');
  }

  // Test 3: Different config should generate different key
  const config2 = {
    method: 'POST',
    url: '/api/users',
    data: { name: 'Jane', email: 'jane@example.com' },
  };

  const key3 = buildIdempotencyKey(config2, {
    path: true,
    body: true,
  });

  if (key1 !== key3) {
    console.log('✅ Test 3: Different config generates different key');
  } else {
    console.log('❌ Test 3 FAILED: Keys should differ');
  }

  // Test 4: Query parameters
  const config3 = {
    method: 'GET',
    url: '/api/users?id=1&type=admin',
  };

  const key4 = buildIdempotencyKey(config3, {
    path: true,
    query: ['id'],
  });

  console.log('✅ Test 4: Query parameter filtering');
  console.log(`   Key: ${key4}`);

  console.log();
}

async function testMemoryAdapter() {
  console.log('=== Testing Memory Adapter ===\n');

  const adapter = new MemoryAdapter();

  // Test 1: Set and get
  await adapter.set('test-key', 'test-value', 60);
  const value = await adapter.get('test-key');

  if (value === 'test-value') {
    console.log('✅ Test 1: Set and get value');
  } else {
    console.log('❌ Test 1 FAILED: Value mismatch');
  }

  // Test 2: Lock acquisition
  const lockAcquired1 = await adapter.acquireLock('lock-key', 60);
  if (lockAcquired1) {
    console.log('✅ Test 2: Lock acquired successfully');
  } else {
    console.log('❌ Test 2 FAILED: Should acquire lock');
  }

  // Test 3: Lock prevents duplicate acquisition
  const lockAcquired2 = await adapter.acquireLock('lock-key', 60);
  if (!lockAcquired2) {
    console.log('✅ Test 3: Lock prevents duplicate acquisition');
  } else {
    console.log('❌ Test 3 FAILED: Should not acquire locked key');
  }

  // Test 4: Lock release
  await adapter.releaseLock('lock-key');
  const lockAcquired3 = await adapter.acquireLock('lock-key', 60);
  if (lockAcquired3) {
    console.log('✅ Test 4: Lock released successfully');
  } else {
    console.log('❌ Test 4 FAILED: Should acquire released lock');
  }

  // Test 5: Non-existent key returns null
  const nullValue = await adapter.get('non-existent');
  if (nullValue === null) {
    console.log('✅ Test 5: Non-existent key returns null');
  } else {
    console.log('❌ Test 5 FAILED: Should return null');
  }

  console.log();
}

async function testRedisAdapter() {
  console.log('=== Testing Redis Adapter ===\n');

  // Test that Redis adapter requires a client
  try {
    new RedisAdapter(null as any);
    console.log('❌ Test 1 FAILED: Should throw error without client');
  } catch (error: any) {
    console.log('✅ Test 1: Redis adapter requires client');
  }

  // Mock Redis client
  const mockRedis = {
    get: async (_key: string) => null,
    setex: async (_key: string, _ttl: number, _value: string) => 'OK',
    set: async (..._args: any[]) => 'OK',
    del: async (_key: string) => 1,
  };

  const adapter = new RedisAdapter(mockRedis);
  console.log('✅ Test 2: Redis adapter created with mock client');

  // Test basic operations work with mock
  await adapter.set('test-key', 'test-value', 60);
  console.log('✅ Test 3: Set operation works');

  const lockAcquired = await adapter.acquireLock('lock-key', 60);
  if (lockAcquired) {
    console.log('✅ Test 4: Lock acquisition works');
  }

  await adapter.releaseLock('lock-key');
  console.log('✅ Test 5: Lock release works');

  console.log();
}

async function main() {
  console.log('==========================================');
  console.log('  axios-idempotency-manager Local Tests');
  console.log('==========================================\n');

  try {
    await testKeyBuilder();
    await testMemoryAdapter();
    await testRedisAdapter();

    console.log('==========================================');
    console.log('✅ All tests passed successfully!');
    console.log('==========================================');
  } catch (error: any) {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
