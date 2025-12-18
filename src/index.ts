/**
 * axios-idempotency-manager
 * 
 * Production-ready TypeScript package that adds idempotency, request deduplication,
 * and caching to Axios using interceptors.
 * 
 * @module axios-idempotency-manager
 */

export { createIdempotentAxios } from './plugin';
export {
  IdempotencyOptions,
  IdempotencyConfig,
  IdempotencyKeyInclude,
  StorageBackend,
  StorageAdapter,
  CachedResponse,
  IdempotentRequestConfig,
} from './types';
export { MemoryAdapter } from './storage/memory';
export { RedisAdapter } from './storage/redis';
export { buildIdempotencyKey } from './keyBuilder';
