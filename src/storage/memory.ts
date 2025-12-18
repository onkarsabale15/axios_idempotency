import { StorageAdapter } from './adapter';

/**
 * In-memory storage adapter for single-process environments
 * Provides fast, process-local storage with automatic TTL cleanup
 */
export class MemoryAdapter implements StorageAdapter {
  private cache: Map<string, { value: string; expiry: number }>;
  private locks: Map<string, number>;

  constructor() {
    this.cache = new Map();
    this.locks = new Map();
  }

  /**
   * Get a value from the in-memory cache
   */
  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set a value in the in-memory cache with TTL
   */
  async set(key: string, value: string, ttl: number): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });

    // Schedule cleanup
    setTimeout(() => {
      const entry = this.cache.get(key);
      if (entry && Date.now() > entry.expiry) {
        this.cache.delete(key);
      }
    }, ttl * 1000);
  }

  /**
   * Acquire a lock using in-memory state
   * Returns true if lock acquired, false if already locked
   */
  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const lockKey = `${key}:lock`;
    const existingLock = this.locks.get(lockKey);

    // Check if lock exists and is still valid
    if (existingLock && Date.now() < existingLock) {
      return false;
    }

    // Acquire lock
    const expiry = Date.now() + ttl * 1000;
    this.locks.set(lockKey, expiry);

    // Schedule cleanup
    setTimeout(() => {
      const lock = this.locks.get(lockKey);
      if (lock && Date.now() > lock) {
        this.locks.delete(lockKey);
      }
    }, ttl * 1000);

    return true;
  }

  /**
   * Release a lock
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${key}:lock`;
    this.locks.delete(lockKey);
  }

  /**
   * Clear all cache and locks (useful for testing)
   */
  clear(): void {
    this.cache.clear();
    this.locks.clear();
  }
}
