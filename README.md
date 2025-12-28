# axios-idempotency-manager

A production-ready TypeScript package that adds **idempotency**, **request deduplication**, and **intelligent caching** to Axios using interceptors.

## Why Use This Library?

Have you ever faced these problems?

🔴 **Problem**: Users double-click a "Submit" button, creating duplicate orders or payments  
✅ **Solution**: Automatic request deduplication prevents duplicate submissions

🔴 **Problem**: Multiple components fetch the same data simultaneously, wasting bandwidth and server resources  
✅ **Solution**: Concurrent identical requests are coalesced into a single network call

🔴 **Problem**: Distributed systems (multiple servers/containers) create duplicate records due to race conditions  
✅ **Solution**: Redis-based distributed locking ensures only one request executes across your entire infrastructure

🔴 **Problem**: API rate limits cause failures when components make redundant requests  
✅ **Solution**: Smart caching reduces unnecessary API calls while keeping data fresh

This library solves these problems with **zero configuration** for basic use cases, and extensive configurability for advanced scenarios.

## Features

- ✅ **Request Deduplication**: Prevents duplicate concurrent requests
- ✅ **Response Caching**: Cache responses with configurable TTL
- ✅ **Idempotency**: Ensure idempotent behavior for configured HTTP methods
- ✅ **Distributed Support**: Works in single-process (memory) and multi-process (Redis) environments
- ✅ **Type-Safe**: Written in TypeScript with full type definitions
- ✅ **Configurable**: Fine-grained control over which requests to deduplicate
- ✅ **Lock Management**: Automatic distributed locking with Redis
- ✅ **Zero Dependencies**: Only requires Axios (and optionally ioredis for Redis)

## When to Use This Library

### ✅ Perfect For:

| Use Case | Why It Helps |
|----------|--------------|
| **Form Submissions** | Prevents duplicate orders, payments, or records from rapid button clicks |
| **Payment Processing** | Ensures payment requests are never duplicated, even in distributed systems |
| **Microservices** | Coordinates requests across multiple service instances with Redis |
| **API Rate Limiting** | Reduces API calls by caching responses and deduplicating requests |
| **High-Traffic Apps** | Minimizes server load by coalescing concurrent identical requests |
| **User Profile Updates** | Prevents race conditions when multiple tabs update the same data |
| **Batch Operations** | Ensures bulk operations execute only once across your infrastructure |

### ❌ Not Recommended For:

- **GET requests that must be fresh every time** (unless you specifically want caching)
- **Real-time data streams** where every request must be unique (use `_skipIdempotency: true`)
- **Fire-and-forget logging** endpoints (use `_skipIdempotency: true`)
- **File uploads** with different files but same metadata (configure key generation carefully)

## Installation

```bash
npm install axios-idempotency-manager
```

For Redis support, also install ioredis:

```bash
npm install ioredis
```

## Quick Start

### 🚀 Basic Usage (Single Server/Process)

Perfect for traditional web applications, single-server deployments, or development.

```typescript
import axios from 'axios';
import { createIdempotentAxios } from 'axios-idempotency-manager';

// Replace your existing Axios instance - it's that simple!
const client = createIdempotentAxios(axios.create());

// Now your requests are automatically protected:
// ✅ Duplicate form submissions are prevented
// ✅ Concurrent identical requests are coalesced
// ✅ Responses are cached intelligently
const response = await client.post('/api/users', { name: 'John' });
```

**What happens behind the scenes:**
1. First request → Executes normally, response is cached
2. Duplicate concurrent request → Waits for first request, returns same response
3. Duplicate request within TTL → Returns cached response instantly

### 🌐 Redis-Based Storage (Distributed Systems)

Essential for microservices, load-balanced servers, or containerized deployments.

```typescript
import axios from 'axios';
import { createIdempotentAxios } from 'axios-idempotency-manager';
import { Redis } from 'ioredis';

const redis = new Redis({
  host: 'your-redis-host',
  port: 6379,
});

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
  ttl: 300, // Cache for 5 minutes
});

// Works across ALL your servers/containers!
// Only ONE server will execute the request, others will wait or use cache
await client.post('/api/payment', { amount: 100, orderId: '123' });
```

**Why Redis?**
- Shared state across multiple servers/containers
- Distributed locking prevents race conditions
- Centralized cache for all instances

## Configuration

### Full Configuration Example

```typescript
import { createIdempotentAxios } from 'axios-idempotency-manager';
import { Redis } from 'ioredis';

const redis = new Redis();

const client = createIdempotentAxios(axios.create(), {
  // Time-to-live for cached responses in seconds (default: 300)
  ttl: 600,
  
  // Storage backend: "memory" or "redis" (default: "memory")
  backend: 'redis',
  
  // Redis client instance (required if backend === "redis")
  redisClient: redis,
  
  // Idempotency configuration
  idempotency: {
    // HTTP methods to apply idempotency to (default: ["POST", "PUT", "PATCH"])
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    
    // Request parts to include in the idempotency key
    include: {
      // Include URL path (default: true)
      path: true,
      
      // Include query parameters
      // - true: include all query params
      // - array: include only specified params
      query: ['id', 'type'],
      
      // Include specific headers
      headers: ['x-api-key', 'authorization'],
      
      // Include request body (default: true)
      body: true,
    },
  },
  
  // Maximum lock acquisition retries (default: 10)
  maxLockRetries: 15,
  
  // Delay between lock retries in ms (default: 100)
  lockRetryDelay: 150,
  
  // Extended polling multiplier for concurrent requests (default: 5)
  extendedPollMultiplier: 6,
  
  // Custom logger (default: console)
  logger: {
    warn: (message, ...args) => console.warn(message, ...args),
    error: (message, ...args) => console.error(message, ...args),
  },
});
```

### Configuration Options

#### `IdempotencyOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | `number` | `300` | Time-to-live for cached responses in seconds |
| `backend` | `"memory" \| "redis"` | `"memory"` | Storage backend to use |
| `redisClient` | `any` | `undefined` | Redis client instance (required if backend === "redis") |
| `idempotency` | `IdempotencyConfig` | See below | Idempotency configuration |
| `maxLockRetries` | `number` | `10` | Maximum number of lock acquisition retry attempts |
| `lockRetryDelay` | `number` | `100` | Delay between lock retry attempts in milliseconds |
| `extendedPollMultiplier` | `number` | `5` | Multiplier for extended polling when waiting for concurrent requests (total wait = maxLockRetries * extendedPollMultiplier * lockRetryDelay) |
| `logger` | `Logger` | `console` | Custom logger for warnings and errors |

#### `IdempotencyConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `methods` | `string[]` | `["POST", "PUT", "PATCH"]` | HTTP methods to apply idempotency to |
| `include` | `IdempotencyKeyInclude` | See below | Request parts to include in key generation |

#### `IdempotencyKeyInclude`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `boolean` | `true` | Include URL path in the idempotency key |
| `query` | `boolean \| string[]` | `true` | Include query parameters (true = all, array = specific params) |
| `headers` | `string[]` | `[]` | List of header names to include in the key |
| `body` | `boolean` | `true` | Include request body in the idempotency key |

## How It Works

### Idempotency Key Generation

The library generates a unique idempotency key for each request based on:

1. **HTTP Method** (always included)
2. **URL Path** (configurable)
3. **Query Parameters** (configurable - all or specific)
4. **Headers** (configurable - specific headers only)
5. **Request Body** (configurable)

The key is generated by:
1. Extracting configured request parts
2. Serializing them deterministically (sorted JSON)
3. Hashing with SHA-256
4. Prefixing with `"axios-idempotent:"`

### Request Flow

```
┌─────────────────┐
│ Make Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Key    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      Yes     ┌─────────────────┐
│ Check Cache     │─────────────▶│ Return Cached   │
└────────┬────────┘              └─────────────────┘
         │ No
         ▼
┌─────────────────┐      No      ┌─────────────────┐
│ Acquire Lock    │─────────────▶│ Retry / Wait    │
└────────┬────────┘              └────────┬────────┘
         │ Yes                            │
         │◀───────────────────────────────┘
         ▼
┌─────────────────┐
│ Execute Request │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cache Response  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Release Lock    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return Response │
└─────────────────┘
```

## Use Cases

### 1. Prevent Duplicate Form Submissions

```typescript
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    methods: ['POST'],
    include: {
      path: true,
      body: true,
    },
  },
});

// Multiple rapid clicks won't create duplicate records
await client.post('/api/orders', { productId: 123, quantity: 1 });
```

### 2. API Rate Limiting / Request Deduplication

```typescript
const client = createIdempotentAxios(axios.create(), {
  ttl: 60, // Cache for 1 minute
  idempotency: {
    methods: ['GET', 'POST'],
  },
});

// Duplicate requests within TTL return cached response
const data1 = await client.get('/api/data');
const data2 = await client.get('/api/data'); // Returns cached
```

### 3. Distributed Systems with Redis

```typescript
import { Redis } from 'ioredis';

const redis = new Redis({
  host: 'redis.example.com',
  port: 6379,
});

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
  ttl: 300,
});

// Works across multiple server instances
// Only one instance will execute the request
await client.post('/api/payment', { amount: 100 });
```

### 4. Conditional Idempotency Based on Headers

```typescript
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    methods: ['POST'],
    include: {
      path: true,
      headers: ['x-idempotency-key'], // Use client-provided key
      body: true,
    },
  },
});

// Requests with same idempotency key are deduplicated
await client.post('/api/transfer', 
  { from: 'A', to: 'B', amount: 100 },
  { headers: { 'x-idempotency-key': 'unique-key-123' } }
);
```

## Storage Adapters

### Memory Adapter (Default)

- Uses in-memory Map for storage
- Fast and efficient for single-process applications
- Automatic cleanup with TTL
- No external dependencies

```typescript
import { createIdempotentAxios, MemoryAdapter } from 'axios-idempotency-manager';

const client = createIdempotentAxios(axios.create(), {
  backend: 'memory', // Default
});
```

### Redis Adapter

- Uses Redis for distributed storage
- Supports multi-process and multi-server deployments
- Atomic operations with `SET NX PX` for locking
- Requires `ioredis` package

```typescript
import { createIdempotentAxios, RedisAdapter } from 'axios-idempotency-manager';
import { Redis } from 'ioredis';

const redis = new Redis();

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
});
```

## API Reference

### `createIdempotentAxios(axiosInstance, options?)`

Creates an idempotent Axios instance with request deduplication and caching.

**Parameters:**
- `axiosInstance: AxiosInstance` - The Axios instance to wrap
- `options?: IdempotencyOptions` - Configuration options

**Returns:** `AxiosInstance` - The wrapped Axios instance

### `buildIdempotencyKey(config, include)`

Generates an idempotency key from a request configuration.

**Parameters:**
- `config: AxiosRequestConfig` - Axios request configuration
- `include?: IdempotencyKeyInclude` - Parts to include in the key

**Returns:** `string` - The generated idempotency key

## Advanced Usage

### Custom Logger

You can provide a custom logger to integrate with your logging framework:

```typescript
import { createIdempotentAxios } from 'axios-idempotency-manager';
import winston from 'winston'; // or any other logger

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

const client = createIdempotentAxios(axios.create(), {
  logger: {
    warn: (message, ...args) => logger.warn(message, args),
    error: (message, ...args) => logger.error(message, args),
  },
});
```

### Skip Idempotency for Specific Requests

```typescript
const client = createIdempotentAxios(axios.create());

// Skip idempotency for this request
await client.post('/api/log', data, {
  _skipIdempotency: true,
} as any);
```

### Custom Storage Adapter

You can implement your own storage adapter:

```typescript
import { StorageAdapter } from 'axios-idempotency-manager';

class CustomAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    // Your implementation
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    // Your implementation
  }

  async acquireLock(key: string, ttl: number): Promise<boolean> {
    // Your implementation
  }

  async releaseLock(key: string): Promise<void> {
    // Your implementation
  }
}
```

## Performance Considerations

### Memory Usage

**In-Memory Storage:**
- Cached responses are stored in a JavaScript Map
- Memory usage grows with the number of unique requests within TTL
- Each cached response includes full response data, headers, and config
- Automatic cleanup happens when TTL expires

**Best Practice:** Set appropriate TTL values based on your request patterns:
```typescript
// High-volume, frequently changing data
const client = createIdempotentAxios(axios.create(), { ttl: 60 }); // 1 minute

// Moderate volume, semi-static data
const client = createIdempotentAxios(axios.create(), { ttl: 300 }); // 5 minutes (default)

// Low volume, mostly static data
const client = createIdempotentAxios(axios.create(), { ttl: 3600 }); // 1 hour
```

**Redis Storage:**
- Memory usage is offloaded to Redis
- Supports distributed systems with shared cache
- TTL is managed by Redis's native expiration
- Consider Redis memory limits and eviction policies

### Network Performance

**Request Deduplication Benefits:**
```typescript
// Without idempotency: 5 network calls
Promise.all([
  axios.post('/api/order', orderData),
  axios.post('/api/order', orderData),
  axios.post('/api/order', orderData),
  axios.post('/api/order', orderData),
  axios.post('/api/order', orderData),
]);

// With idempotency: 1 network call, 4 cached responses
const client = createIdempotentAxios(axios.create());
Promise.all([
  client.post('/api/order', orderData),
  client.post('/api/order', orderData),
  client.post('/api/order', orderData),
  client.post('/api/order', orderData),
  client.post('/api/order', orderData),
]);
```

**Lock Acquisition Overhead:**
- Memory backend: ~1ms overhead per request (in-memory operations)
- Redis backend: ~5-20ms overhead per request (network round-trip to Redis)
- Concurrent requests benefit from waiting vs. re-executing

### Key Generation Performance

The library uses SHA-256 hashing for key generation:
- Cost: ~0.1-1ms per request (negligible)
- Consistent across all requests
- Deterministic based on request content

**Optimization tip:** Reduce key size for better performance:
```typescript
// Include only essential parts
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    include: {
      path: true,
      query: ['id'], // Only specific params, not all
      headers: [], // Only include if necessary
      body: true,
    },
  },
});
```

## Troubleshooting

### Problem: Requests are not being deduplicated

**Possible Causes:**
1. **Method not configured:** By default, only POST, PUT, and PATCH are deduplicated
   ```typescript
   // Solution: Add the method to configuration
   const client = createIdempotentAxios(axios.create(), {
     idempotency: {
       methods: ['POST', 'PUT', 'PATCH', 'DELETE'], // Add DELETE
     },
   });
   ```

2. **Request bodies differ slightly:** Object property order or formatting affects keys
   ```typescript
   // These generate DIFFERENT keys due to object structure:
   client.post('/api/user', { name: 'John', age: 30 });
   client.post('/api/user', { age: 30, name: 'John' }); // Different order
   
   // Solution: Ensure consistent request formatting or use normalized data
   ```

3. **Headers differ:** If headers are included in key, requests with different headers are treated as unique
   ```typescript
   // Solution: Only include stable headers
   const client = createIdempotentAxios(axios.create(), {
     idempotency: {
       include: {
         headers: ['x-api-key'], // Don't include timestamp headers
       },
     },
   });
   ```

### Problem: Redis connection errors

**Symptoms:** Errors like "Connection refused" or "Redis is not ready"

**Solutions:**
```typescript
import { Redis } from 'ioredis';

// 1. Check Redis is running and accessible
const redis = new Redis({
  host: 'localhost', // Verify correct host
  port: 6379,        // Verify correct port
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Add connection error handling
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('ready', () => {
  console.log('Redis connection established');
});

await redis.connect();

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
});
```

### Problem: Stale cached responses

**Symptom:** Old data is returned instead of fresh data

**Solutions:**

1. **Reduce TTL:**
   ```typescript
   const client = createIdempotentAxios(axios.create(), {
     ttl: 60, // Reduce from default 300 to 60 seconds
   });
   ```

2. **Skip idempotency for specific requests:**
   ```typescript
   // Force fresh request
   await client.get('/api/user/profile', {
     _skipIdempotency: true,
   } as any);
   ```

3. **Use different keys for different scenarios:**
   ```typescript
   // Include timestamp or version in request
   await client.get('/api/data', {
     params: { version: Date.now() },
   });
   ```

### Problem: Deadlocks or hanging requests

**Symptom:** Requests never complete, appear to hang indefinitely

**Causes & Solutions:**

1. **Lock not released due to errors:**
   - The library automatically releases locks on errors
   - Check error logs for exceptions during request execution

2. **Insufficient lock retries:**
   ```typescript
   // Increase retries for slow endpoints
   const client = createIdempotentAxios(axios.create(), {
     maxLockRetries: 20,      // Increase from default 10
     lockRetryDelay: 200,     // Increase from default 100ms
     extendedPollMultiplier: 10, // Increase from default 5
   });
   ```

3. **Redis connection issues:**
   - Verify Redis connectivity
   - Check network latency between application and Redis
   - Monitor Redis performance metrics

### Problem: Memory leaks with in-memory storage

**Symptom:** Memory usage continuously grows

**Causes & Solutions:**

1. **TTL not expiring:**
   - The library automatically cleans up expired entries
   - Verify TTL is set appropriately

2. **Too many unique requests:**
   ```typescript
   // Problem: Including timestamps creates unique keys
   client.post('/api/log', {
     message: 'log entry',
     timestamp: Date.now(), // Each request has unique timestamp!
   });
   
   // Solution: Exclude dynamic data or use _skipIdempotency
   client.post('/api/log', data, {
     _skipIdempotency: true,
   } as any);
   ```

3. **Switch to Redis for high-volume applications:**
   ```typescript
   // Use Redis for better memory management
   const client = createIdempotentAxios(axios.create(), {
     backend: 'redis',
     redisClient: redis,
   });
   ```

### Problem: TypeScript errors with _skipIdempotency

**Symptom:** TypeScript complains about `_skipIdempotency` property

**Solution:**
```typescript
// Option 1: Type assertion
await client.post('/api/log', data, {
  _skipIdempotency: true,
} as any);

// Option 2: Extend the type (in your types file)
import { AxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _skipIdempotency?: boolean;
  }
}

// Now you can use it without assertion
await client.post('/api/log', data, {
  _skipIdempotency: true,
});
```

### Debugging Tips

1. **Enable logging:**
   ```typescript
   const client = createIdempotentAxios(axios.create(), {
     logger: {
       warn: (msg, ...args) => console.warn('[Idempotency]', msg, ...args),
       error: (msg, ...args) => console.error('[Idempotency]', msg, ...args),
       info: (msg, ...args) => console.log('[Idempotency]', msg, ...args),
       debug: (msg, ...args) => console.debug('[Idempotency]', msg, ...args),
     },
   });
   ```

2. **Inspect generated keys:**
   ```typescript
   import { buildIdempotencyKey } from 'axios-idempotency-manager';
   
   const key = buildIdempotencyKey(requestConfig, {
     path: true,
     body: true,
     query: true,
   });
   console.log('Generated key:', key);
   ```

3. **Monitor cache hit rates:**
   - Track how often cached responses are used vs. new requests
   - Adjust TTL based on hit rates and data freshness requirements

## Best Practices

1. **Choose the Right Backend**: Use memory for single-process apps, Redis for distributed systems
2. **Configure Methods Carefully**: Only apply idempotency to methods that need it (typically POST, PUT, PATCH)
3. **Set Appropriate TTL**: Balance between cache effectiveness and data freshness
4. **Include Relevant Headers**: If using API keys or tokens, include them in the idempotency key
5. **Monitor Lock Timeouts**: Adjust `maxLockRetries` and `lockRetryDelay` based on your use case
6. **Handle Errors Gracefully**: The library releases locks on errors to prevent deadlocks
7. **Test Thoroughly**: Test concurrent scenarios in your development environment
8. **Monitor Performance**: Track cache hit rates and adjust TTL accordingly
9. **Use Redis for Production Distributed Systems**: Memory storage is great for development, but Redis is recommended for production multi-instance deployments

## Migration Guide

### Migrating from Plain Axios

**Before:**
```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
});

await client.post('/api/order', orderData);
```

**After:**
```typescript
import axios from 'axios';
import { createIdempotentAxios } from 'axios-idempotency-manager';

// Wrap your existing Axios instance
const client = createIdempotentAxios(
  axios.create({
    baseURL: 'https://api.example.com',
    timeout: 5000,
  })
);

// Use exactly as before - no code changes needed!
await client.post('/api/order', orderData);
```

### Gradual Adoption Strategy

You can gradually adopt this library by:

**Step 1: Start with specific endpoints**
```typescript
const regularClient = axios.create();
const idempotentClient = createIdempotentAxios(axios.create());

// Use regular client for most requests
await regularClient.get('/api/data');

// Use idempotent client for critical endpoints
await idempotentClient.post('/api/payment', paymentData);
```

**Step 2: Configure for specific HTTP methods**
```typescript
// Only protect POST requests initially
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    methods: ['POST'], // Start with POST only
  },
});
```

**Step 3: Expand coverage gradually**
```typescript
// Expand to more methods as confidence grows
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
});
```

### Migrating from Custom Idempotency Implementation

If you're using custom idempotency headers or logic:

**Before (custom implementation):**
```typescript
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

await axios.post('/api/order', orderData, {
  headers: {
    'Idempotency-Key': uuidv4(),
  },
});
```

**After (with this library):**
```typescript
import { createIdempotentAxios } from 'axios-idempotency-manager';

const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    include: {
      // Automatic key generation based on request content
      path: true,
      body: true,
      // Or use your existing header if server still needs it
      headers: ['Idempotency-Key'],
    },
  },
});

await client.post('/api/order', orderData);
// Key is automatically generated from request content
// OR include your custom header if needed:
await client.post('/api/order', orderData, {
  headers: { 'Idempotency-Key': customKey },
});
```

## FAQ

### General Questions

**Q: Does this work with existing Axios interceptors?**  
A: Yes! This library uses Axios interceptors internally but doesn't interfere with your existing interceptors. Add them before or after wrapping with `createIdempotentAxios`.

**Q: Can I use this with Axios instances that have custom configurations?**  
A: Absolutely! Pass your fully configured Axios instance to `createIdempotentAxios`, and all configurations (base URL, headers, timeouts, etc.) are preserved.

**Q: Does this modify my original Axios instance?**  
A: No, it returns a new Axios instance with interceptors attached. Your original instance remains unchanged.

**Q: Is this compatible with Axios v0.x and v1.x?**  
A: This library requires Axios v1.x or higher. For Axios v0.x, you'll need to upgrade Axios first.

### Configuration Questions

**Q: What's the default TTL if I don't specify one?**  
A: The default TTL is 300 seconds (5 minutes).

**Q: Which HTTP methods are protected by default?**  
A: By default, POST, PUT, and PATCH methods are protected. GET, DELETE, and others are not affected unless you configure them.

**Q: Can I disable idempotency for specific requests?**  
A: Yes! Use the `_skipIdempotency: true` flag in your request config:
```typescript
await client.post('/api/log', data, { _skipIdempotency: true } as any);
```

**Q: How do I know if my request was served from cache?**  
A: The response object is identical whether from cache or fresh. You can add custom logging to track this:
```typescript
const client = createIdempotentAxios(axios.create(), {
  logger: {
    warn: (msg) => console.log('Cache or lock event:', msg),
    error: (msg) => console.error('Error:', msg),
  },
});
```

### Technical Questions

**Q: How is the idempotency key generated?**  
A: The key is generated by:
1. Extracting configured parts (method, path, query, headers, body)
2. Serializing them deterministically (sorted JSON)
3. Hashing with SHA-256
4. Prefixing with `"axios-idempotent:"`

**Q: What happens if two requests with the same key arrive simultaneously?**  
A: The library uses locking:
- First request acquires lock and executes
- Subsequent requests wait (poll) for the lock to be released
- Once released, they receive the cached response
- All requests return the same result

**Q: Does this work across different browser tabs?**  
A: With in-memory storage, no (each tab has its own memory). With Redis storage, yes (shared state across tabs and servers).

**Q: What happens if Redis goes down?**  
A: Requests will fail to acquire locks and may throw errors. Implement proper error handling and consider Redis high availability (Redis Sentinel or Redis Cluster) for production.

**Q: Can I use this with React Query, SWR, or other data fetching libraries?**  
A: Yes! Create an idempotent Axios instance and use it with your data fetching library:
```typescript
import { createIdempotentAxios } from 'axios-idempotency-manager';
import axios from 'axios';

const client = createIdempotentAxios(axios.create());

// Use with React Query
const { data } = useQuery('users', () => client.get('/api/users'));

// Use with SWR
const { data } = useSWR('/api/users', url => client.get(url));
```

### Performance Questions

**Q: Does this add significant latency to my requests?**  
A: Minimal impact:
- Memory backend: ~1ms overhead
- Redis backend: ~5-20ms overhead (network round-trip)
- The benefits (avoiding duplicate requests) typically outweigh the overhead

**Q: How much memory does the in-memory cache use?**  
A: It depends on:
- Number of unique requests within TTL
- Size of response data
- For typical API responses (few KB), memory usage is minimal
- Monitor and adjust TTL or switch to Redis for high-volume apps

**Q: Can this improve my API performance?**  
A: Yes! By:
1. Reducing duplicate API calls
2. Caching responses for repeated requests
3. Coalescing concurrent identical requests
4. Reducing server load

### Security Questions

**Q: Are cached responses secure?**  
A: Cached responses are stored in memory (or Redis) and are as secure as your application's environment. For sensitive data:
- Use HTTPS for API calls
- Secure your Redis instance (authentication, network isolation)
- Include user-specific headers in the idempotency key
- Set appropriate TTL values

**Q: Can one user see another user's cached data?**  
A: Not if configured correctly. Include user-identifying headers in the key:
```typescript
const client = createIdempotentAxios(axios.create(), {
  idempotency: {
    include: {
      headers: ['authorization', 'x-user-id'], // Include user headers
      path: true,
      body: true,
    },
  },
});
```

**Q: Is Redis connection secure?**  
A: Use Redis security best practices:
- Enable Redis authentication (requirepass)
- Use TLS/SSL for Redis connections
- Restrict Redis network access
- Use Redis ACLs (Access Control Lists) in Redis 6+

## TypeScript Support

This package is written in TypeScript and includes full type definitions. All types are exported for your convenience:

```typescript
import {
  createIdempotentAxios,
  IdempotencyOptions,
  IdempotencyConfig,
  IdempotencyKeyInclude,
  StorageAdapter,
  StorageBackend,
} from 'axios-idempotency-manager';
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/onkarsabale15/axios_idempotency/issues) page.
