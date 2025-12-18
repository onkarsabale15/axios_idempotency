import { RedisAdapter } from '../src/storage/redis';
import { Logger } from '../src/types';

// Mock Redis client
class MockRedisClient {
  private data: Map<string, { value: string; expiry?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    
    if (entry.expiry && Date.now() > entry.expiry) {
      this.data.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async setex(key: string, ttl: number, value: string): Promise<string> {
    const expiry = Date.now() + ttl * 1000;
    this.data.set(key, { value, expiry });
    return 'OK';
  }

  async set(...args: any[]): Promise<string | null> {
    const [key, value, ...options] = args;
    
    // Handle SET key value NX PX milliseconds
    if (options.includes('NX')) {
      if (this.data.has(key)) {
        return null; // Key already exists
      }
    }

    let expiry: number | undefined;
    if (options.includes('PX')) {
      const pxIndex = options.indexOf('PX');
      const milliseconds = options[pxIndex + 1];
      expiry = Date.now() + milliseconds;
    }

    this.data.set(key, { value, expiry });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  clear() {
    this.data.clear();
  }
}

describe('RedisAdapter', () => {
  let mockRedis: MockRedisClient;
  let adapter: RedisAdapter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockRedis = new MockRedisClient();
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
    adapter = new RedisAdapter(mockRedis as any, mockLogger);
  });

  afterEach(() => {
    mockRedis.clear();
  });

  describe('Constructor', () => {
    it('should throw error if Redis client is not provided', () => {
      expect(() => new RedisAdapter(null as any)).toThrow(
        'Redis client is required for RedisAdapter'
      );
    });

    it('should accept Redis client without logger', () => {
      expect(() => new RedisAdapter(mockRedis as any)).not.toThrow();
    });

    it('should accept Redis client with logger', () => {
      expect(() => new RedisAdapter(mockRedis as any, mockLogger)).not.toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve a value from Redis', async () => {
      await mockRedis.setex('test-key', 60, 'test-value');
      const value = await adapter.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const value = await adapter.get('non-existent');
      expect(value).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      const brokenRedis = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection error')),
      };
      const brokenAdapter = new RedisAdapter(brokenRedis as any, mockLogger);

      const value = await brokenAdapter.get('test-key');
      expect(value).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should store a value in Redis with TTL', async () => {
      await adapter.set('test-key', 'test-value', 60);
      const value = await mockRedis.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should overwrite existing value', async () => {
      await adapter.set('test-key', 'value1', 60);
      await adapter.set('test-key', 'value2', 60);
      const value = await adapter.get('test-key');
      expect(value).toBe('value2');
    });

    it('should throw error on Redis failure', async () => {
      const brokenRedis = {
        setex: jest.fn().mockRejectedValue(new Error('Redis write error')),
      };
      const brokenAdapter = new RedisAdapter(brokenRedis as any, mockLogger);

      await expect(brokenAdapter.set('key', 'value', 60)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('acquireLock', () => {
    it('should acquire a lock successfully', async () => {
      const acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(true);
    });

    it('should prevent duplicate lock acquisition', async () => {
      const acquired1 = await adapter.acquireLock('lock-key', 60);
      const acquired2 = await adapter.acquireLock('lock-key', 60);

      expect(acquired1).toBe(true);
      expect(acquired2).toBe(false);
    });

    it('should use SET NX PX for atomic lock acquisition', async () => {
      const setSpy = jest.spyOn(mockRedis, 'set');
      await adapter.acquireLock('lock-key', 60);

      expect(setSpy).toHaveBeenCalledWith(
        'lock-key:lock',
        '1',
        'PX',
        60000,
        'NX'
      );
    });

    it('should convert TTL from seconds to milliseconds', async () => {
      const setSpy = jest.spyOn(mockRedis, 'set');
      await adapter.acquireLock('lock-key', 5);

      expect(setSpy).toHaveBeenCalledWith(
        'lock-key:lock',
        '1',
        'PX',
        5000,
        'NX'
      );
    });

    it('should return false on Redis error', async () => {
      const brokenRedis = {
        set: jest.fn().mockRejectedValue(new Error('Redis error')),
      };
      const brokenAdapter = new RedisAdapter(brokenRedis as any, mockLogger);

      const acquired = await brokenAdapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('should release a lock', async () => {
      await adapter.acquireLock('lock-key', 60);
      await adapter.releaseLock('lock-key');

      const acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(true);
    });

    it('should delete the lock key from Redis', async () => {
      await adapter.acquireLock('lock-key', 60);
      const delSpy = jest.spyOn(mockRedis, 'del');
      
      await adapter.releaseLock('lock-key');
      expect(delSpy).toHaveBeenCalledWith('lock-key:lock');
    });

    it('should not throw when releasing non-existent lock', async () => {
      await expect(adapter.releaseLock('non-existent')).resolves.not.toThrow();
    });

    it('should handle Redis errors gracefully', async () => {
      const brokenRedis = {
        del: jest.fn().mockRejectedValue(new Error('Redis delete error')),
      };
      const brokenAdapter = new RedisAdapter(brokenRedis as any, mockLogger);

      await expect(brokenAdapter.releaseLock('lock-key')).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not affect other locks', async () => {
      await adapter.acquireLock('lock1', 60);
      await adapter.acquireLock('lock2', 60);
      
      await adapter.releaseLock('lock1');

      expect(await adapter.acquireLock('lock1', 60)).toBe(true);
      expect(await adapter.acquireLock('lock2', 60)).toBe(false);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle concurrent get operations', async () => {
      await adapter.set('test-key', 'test-value', 60);

      const results = await Promise.all([
        adapter.get('test-key'),
        adapter.get('test-key'),
        adapter.get('test-key'),
      ]);

      expect(results).toEqual(['test-value', 'test-value', 'test-value']);
    });

    it('should handle concurrent lock attempts correctly', async () => {
      const results = await Promise.all([
        adapter.acquireLock('lock-key', 60),
        adapter.acquireLock('lock-key', 60),
        adapter.acquireLock('lock-key', 60),
      ]);

      const acquiredCount = results.filter(r => r === true).length;
      expect(acquiredCount).toBe(1);
    });
  });

  describe('Integration with lock prefix', () => {
    it('should add :lock suffix to lock keys', async () => {
      const setSpy = jest.spyOn(mockRedis, 'set');
      await adapter.acquireLock('my-key', 60);

      expect(setSpy).toHaveBeenCalledWith(
        'my-key:lock',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should not interfere with regular cache keys', async () => {
      await adapter.set('my-key', 'value', 60);
      await adapter.acquireLock('my-key', 60);

      expect(await adapter.get('my-key')).toBe('value');
      expect(await adapter.acquireLock('my-key', 60)).toBe(false);
    });
  });
});
