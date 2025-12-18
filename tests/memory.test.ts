import { MemoryAdapter } from '../src/storage/memory';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  describe('get and set', () => {
    it('should store and retrieve a value', async () => {
      await adapter.set('test-key', 'test-value', 60);
      const value = await adapter.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const value = await adapter.get('non-existent');
      expect(value).toBeNull();
    });

    it('should overwrite existing value', async () => {
      await adapter.set('test-key', 'value1', 60);
      await adapter.set('test-key', 'value2', 60);
      const value = await adapter.get('test-key');
      expect(value).toBe('value2');
    });

    it('should handle multiple different keys', async () => {
      await adapter.set('key1', 'value1', 60);
      await adapter.set('key2', 'value2', 60);
      await adapter.set('key3', 'value3', 60);

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBe('value2');
      expect(await adapter.get('key3')).toBe('value3');
    });
  });

  describe('TTL handling', () => {
    it('should expire values after TTL', async () => {
      await adapter.set('test-key', 'test-value', 0.1); // 100ms
      
      // Value should exist immediately
      let value = await adapter.get('test-key');
      expect(value).toBe('test-value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Value should be expired
      value = await adapter.get('test-key');
      expect(value).toBeNull();
    });

    it('should handle different TTLs for different keys', async () => {
      await adapter.set('short-ttl', 'value1', 0.1); // 100ms
      await adapter.set('long-ttl', 'value2', 10); // 10s

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(await adapter.get('short-ttl')).toBeNull();
      expect(await adapter.get('long-ttl')).toBe('value2');
    });
  });

  describe('Lock acquisition', () => {
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

    it('should allow lock acquisition after release', async () => {
      await adapter.acquireLock('lock-key', 60);
      await adapter.releaseLock('lock-key');
      
      const acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(true);
    });

    it('should handle multiple different locks', async () => {
      const lock1 = await adapter.acquireLock('lock1', 60);
      const lock2 = await adapter.acquireLock('lock2', 60);
      const lock3 = await adapter.acquireLock('lock3', 60);

      expect(lock1).toBe(true);
      expect(lock2).toBe(true);
      expect(lock3).toBe(true);
    });

    it('should expire locks after TTL', async () => {
      await adapter.acquireLock('lock-key', 0.1); // 100ms

      // Lock should be held immediately
      let acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(false);

      // Wait for lock expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be able to acquire expired lock
      acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(true);
    });
  });

  describe('Lock release', () => {
    it('should release a lock', async () => {
      await adapter.acquireLock('lock-key', 60);
      await adapter.releaseLock('lock-key');

      const acquired = await adapter.acquireLock('lock-key', 60);
      expect(acquired).toBe(true);
    });

    it('should not throw when releasing non-existent lock', async () => {
      await expect(adapter.releaseLock('non-existent')).resolves.not.toThrow();
    });

    it('should not affect other locks', async () => {
      await adapter.acquireLock('lock1', 60);
      await adapter.acquireLock('lock2', 60);
      
      await adapter.releaseLock('lock1');

      // lock1 should be released
      expect(await adapter.acquireLock('lock1', 60)).toBe(true);
      
      // lock2 should still be held
      expect(await adapter.acquireLock('lock2', 60)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cache and locks', () => {
      adapter.set('key1', 'value1', 60);
      adapter.set('key2', 'value2', 60);
      adapter.acquireLock('lock1', 60);
      adapter.acquireLock('lock2', 60);

      adapter.clear();

      expect(adapter.get('key1')).resolves.toBeNull();
      expect(adapter.get('key2')).resolves.toBeNull();
      expect(adapter.acquireLock('lock1', 60)).resolves.toBe(true);
      expect(adapter.acquireLock('lock2', 60)).resolves.toBe(true);
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

    it('should handle concurrent lock attempts', async () => {
      const results = await Promise.all([
        adapter.acquireLock('lock-key', 60),
        adapter.acquireLock('lock-key', 60),
        adapter.acquireLock('lock-key', 60),
      ]);

      const acquiredCount = results.filter(r => r === true).length;
      expect(acquiredCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string as key', async () => {
      await adapter.set('', 'value', 60);
      expect(await adapter.get('')).toBe('value');
    });

    it('should handle special characters in key', async () => {
      const specialKey = 'key:with:colons:and-dashes_underscores';
      await adapter.set(specialKey, 'value', 60);
      expect(await adapter.get(specialKey)).toBe('value');
    });

    it('should handle large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await adapter.set('large-key', largeValue, 60);
      expect(await adapter.get('large-key')).toBe(largeValue);
    });

    it('should handle zero TTL', async () => {
      await adapter.set('test-key', 'test-value', 0);
      
      // Even with 0 TTL, value should be immediately expired
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(await adapter.get('test-key')).toBeNull();
    });
  });
});
