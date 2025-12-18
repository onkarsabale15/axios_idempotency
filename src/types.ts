import { AxiosRequestConfig } from 'axios';

/**
 * Configuration for which parts of a request to include in the idempotency key
 */
export interface IdempotencyKeyInclude {
  /** Include the URL path in the key */
  path?: boolean;
  /** Include query parameters - true for all, array for specific params */
  query?: boolean | string[];
  /** Include specific headers in the key */
  headers?: string[];
  /** Include the request body in the key */
  body?: boolean;
}

/**
 * Idempotency configuration options
 */
export interface IdempotencyConfig {
  /** HTTP methods to apply idempotency to */
  methods?: string[];
  /** Request parts to include in the key generation */
  include?: IdempotencyKeyInclude;
}

/**
 * Storage backend type
 */
export type StorageBackend = 'memory' | 'redis';

/**
 * Logger interface for custom logging
 */
export interface Logger {
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  info?(message: string, ...args: any[]): void;
  debug?(message: string, ...args: any[]): void;
}

/**
 * Main configuration options for the idempotency plugin
 */
export interface IdempotencyOptions {
  /** Time-to-live for cached responses in seconds (default: 300) */
  ttl?: number;
  /** Storage backend to use (default: 'memory') */
  backend?: StorageBackend;
  /** Redis client instance (required if backend === 'redis') */
  redisClient?: any;
  /** Idempotency configuration */
  idempotency?: IdempotencyConfig;
  /** Maximum number of retry attempts for lock acquisition (default: 10) */
  maxLockRetries?: number;
  /** Delay between lock retry attempts in ms (default: 100) */
  lockRetryDelay?: number;
  /** Multiplier for extended polling attempts when lock cannot be acquired (default: 5) */
  extendedPollMultiplier?: number;
  /** Custom logger (default: console) */
  logger?: Logger;
}

/**
 * Storage adapter interface for different backends
 */
export interface StorageAdapter {
  /**
   * Get a value from storage
   * @param key - The key to retrieve
   * @returns The stored value or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in storage with TTL
   * @param key - The key to store
   * @param value - The value to store
   * @param ttl - Time-to-live in seconds
   */
  set(key: string, value: string, ttl: number): Promise<void>;

  /**
   * Acquire a lock for a given key
   * @param key - The key to lock
   * @param ttl - Lock timeout in seconds
   * @returns true if lock acquired, false otherwise
   */
  acquireLock(key: string, ttl: number): Promise<boolean>;

  /**
   * Release a lock for a given key
   * @param key - The key to unlock
   */
  releaseLock(key: string): Promise<void>;
}

/**
 * Cached response data
 */
export interface CachedResponse {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  config: AxiosRequestConfig;
}

/**
 * Extended Axios request config with idempotency metadata
 */
export interface IdempotentRequestConfig extends AxiosRequestConfig {
  _idempotencyKey?: string;
  _skipIdempotency?: boolean;
}

/**
 * Custom error for cached response handling
 */
export class CachedResponseError extends Error {
  public readonly isCached = true;
  public readonly cachedResponse: CachedResponse;

  constructor(cachedResponse: CachedResponse) {
    super('CACHED_RESPONSE');
    this.name = 'CachedResponseError';
    this.cachedResponse = cachedResponse;
    Object.setPrototypeOf(this, CachedResponseError.prototype);
  }
}
