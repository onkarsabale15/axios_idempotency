import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  IdempotencyOptions,
  StorageAdapter,
  IdempotentRequestConfig,
} from './types';
import { MemoryAdapter } from './storage/memory';
import { RedisAdapter } from './storage/redis';
import { buildIdempotencyKey } from './keyBuilder';
import {
  delay,
  shouldUseIdempotency,
  serializeResponse,
  deserializeResponse,
} from './utils';

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<Omit<IdempotencyOptions, 'redisClient'>> = {
  ttl: 300,
  backend: 'memory',
  idempotency: {
    methods: ['POST', 'PUT', 'PATCH'],
    include: {
      path: true,
      query: true,
      headers: [],
      body: true,
    },
  },
  maxLockRetries: 10,
  lockRetryDelay: 100,
};

/**
 * Create an idempotent Axios instance with request deduplication and caching
 * 
 * This wraps an Axios instance and adds:
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Response caching with TTL
 * - Distributed locking support (when using Redis)
 * 
 * @param axiosInstance - The Axios instance to wrap
 * @param options - Configuration options
 * @returns The wrapped Axios instance
 */
export function createIdempotentAxios(
  axiosInstance: AxiosInstance,
  options: IdempotencyOptions = {}
): AxiosInstance {
  // Merge with defaults
  const config: Required<Omit<IdempotencyOptions, 'redisClient'>> & {
    redisClient?: any;
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
    idempotency: {
      ...DEFAULT_OPTIONS.idempotency,
      ...options.idempotency,
      include: {
        ...DEFAULT_OPTIONS.idempotency.include,
        ...options.idempotency?.include,
      },
    },
  };

  // Initialize storage adapter
  const storage: StorageAdapter =
    config.backend === 'redis'
      ? new RedisAdapter(options.redisClient)
      : new MemoryAdapter();

  /**
   * Request interceptor
   * Handles cache lookup, lock acquisition, and deduplication
   */
  axiosInstance.interceptors.request.use(
    async (requestConfig: InternalAxiosRequestConfig) => {
      const method = requestConfig.method || 'GET';

      // Skip idempotency if not configured for this method
      if (
        !shouldUseIdempotency(method, config.idempotency.methods || []) ||
        (requestConfig as any)._skipIdempotency
      ) {
        return requestConfig;
      }

      // Generate idempotency key
      const idempotencyKey = buildIdempotencyKey(
        requestConfig,
        config.idempotency.include
      );

      // Store key in config for response interceptor
      (requestConfig as any)._idempotencyKey = idempotencyKey;

      // Check cache first
      const cachedData = await storage.get(idempotencyKey);
      if (cachedData) {
        const cachedResponse = deserializeResponse(cachedData);
        if (cachedResponse) {
          // Return cached response by throwing with special marker
          const error: any = new Error('CACHED_RESPONSE');
          error.isCached = true;
          error.cachedResponse = cachedResponse;
          throw error;
        }
      }

      // Try to acquire lock
      let lockAcquired = false;
      let retries = 0;

      while (!lockAcquired && retries < config.maxLockRetries) {
        lockAcquired = await storage.acquireLock(idempotencyKey, config.ttl);

        if (!lockAcquired) {
          // Wait before retrying
          await delay(config.lockRetryDelay);
          retries++;

          // Check cache again in case another request completed
          const cachedData = await storage.get(idempotencyKey);
          if (cachedData) {
            const cachedResponse = deserializeResponse(cachedData);
            if (cachedResponse) {
              const error: any = new Error('CACHED_RESPONSE');
              error.isCached = true;
              error.cachedResponse = cachedResponse;
              throw error;
            }
          }
        }
      }

      if (!lockAcquired) {
        // Could not acquire lock after retries
        // Let the request proceed anyway to avoid blocking
        console.warn(
          `Could not acquire lock for ${idempotencyKey} after ${retries} retries`
        );
      }

      return requestConfig;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  /**
   * Response interceptor
   * Caches successful responses and releases locks
   */
  axiosInstance.interceptors.response.use(
    async (response: AxiosResponse) => {
      const requestConfig = response.config as IdempotentRequestConfig;
      const idempotencyKey = requestConfig._idempotencyKey;

      if (idempotencyKey) {
        try {
          // Cache the response
          const serialized = serializeResponse(response);
          await storage.set(idempotencyKey, serialized, config.ttl);
        } catch (error) {
          console.error('Error caching response:', error);
        } finally {
          // Always release lock
          await storage.releaseLock(idempotencyKey);
        }
      }

      return response;
    },
    async (error) => {
      // Handle cached response
      if (error.isCached && error.cachedResponse) {
        return Promise.resolve(error.cachedResponse);
      }

      // Release lock on error
      const requestConfig = error.config as IdempotentRequestConfig;
      if (requestConfig && requestConfig._idempotencyKey) {
        try {
          await storage.releaseLock(requestConfig._idempotencyKey);
        } catch (releaseError) {
          console.error('Error releasing lock:', releaseError);
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}
