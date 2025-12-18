import { StorageAdapter } from './adapter';
import { Logger } from '../types';

/**
 * Default logger using console
 */
const defaultLogger: Logger = {
  warn: (message: string, ...args: any[]) => console.warn(message, ...args),
  error: (message: string, ...args: any[]) => console.error(message, ...args),
};

/**
 * Redis storage adapter for distributed systems
 * Provides distributed locking and caching across multiple processes/servers
 */
export class RedisAdapter implements StorageAdapter {
  private redis: any;
  private logger: Logger;

  constructor(redisClient: any, logger: Logger = defaultLogger) {
    if (!redisClient) {
      throw new Error('Redis client is required for RedisAdapter');
    }
    this.redis = redisClient;
    this.logger = logger;
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set a value in Redis with TTL
   * Uses SETEX command for atomic set with expiration
   */
  async set(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (error) {
      this.logger.error('Redis set error:', error);
      throw error;
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX PX
   * This ensures atomic lock acquisition across multiple processes
   * 
   * @param key - The key to lock
   * @param ttl - Lock timeout in seconds
   * @returns true if lock acquired, false if already locked
   */
  async acquireLock(key: string, ttl: number): Promise<boolean> {
    const lockKey = `${key}:lock`;
    const ttlMs = ttl * 1000;

    try {
      // SET key value NX PX milliseconds
      // NX: Only set if key doesn't exist
      // PX: Set expiration in milliseconds
      const result = await this.redis.set(
        lockKey,
        '1',
        'PX',
        ttlMs,
        'NX'
      );

      // Result is 'OK' if lock acquired, null if key already exists
      return result === 'OK';
    } catch (error) {
      this.logger.error('Redis acquireLock error:', error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * Deletes the lock key from Redis
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${key}:lock`;
    
    try {
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.error('Redis releaseLock error:', error);
      // Don't throw - best effort release
    }
  }
}
