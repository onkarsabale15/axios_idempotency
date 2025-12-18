# axios-idempotency-manager

Package that adds **idempotency**, **request deduplication**, and **caching** to Axios using interceptors.

## Features

- ✅ **Request Deduplication**: Prevents duplicate concurrent requests
- ✅ **Response Caching**: Cache responses with configurable TTL
- ✅ **Idempotency**: Ensure idempotent behavior for configured HTTP methods
- ✅ **Distributed Support**: Works in single-process (memory) and multi-process (Redis) environments
- ✅ **Type-Safe**: Written in TypeScript with full type definitions
- ✅ **Configurable**: Fine-grained control over which requests to deduplicate
- ✅ **Lock Management**: Automatic distributed locking with Redis
- ✅ **Zero Dependencies**: Only requires Axios (and optionally ioredis for Redis)

## Installation

```bash
npm install axios-idempotency-manager
```

For Redis support, also install ioredis:

```bash
npm install ioredis
```

## Quick Start

### Basic Usage (In-Memory Storage)

```typescript
import axios from 'axios';
import { createIdempotentAxios } from 'axios-idempotency-manager';

// Create an idempotent Axios instance
const client = createIdempotentAxios(axios.create());

// Make requests - duplicate concurrent requests will be deduplicated
const response = await client.post('/api/users', { name: 'John' });
```

### Redis-Based Storage (Distributed Systems)

```typescript
import axios from 'axios';
import { createIdempotentAxios } from 'axios-idempotency-manager';
import { Redis } from 'ioredis';

const redis = new Redis();

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
  ttl: 300, // Cache for 5 minutes
});
```

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

## Best Practices

1. **Choose the Right Backend**: Use memory for single-process apps, Redis for distributed systems
2. **Configure Methods Carefully**: Only apply idempotency to methods that need it (typically POST, PUT, PATCH)
3. **Set Appropriate TTL**: Balance between cache effectiveness and data freshness
4. **Include Relevant Headers**: If using API keys or tokens, include them in the idempotency key
5. **Monitor Lock Timeouts**: Adjust `maxLockRetries` and `lockRetryDelay` based on your use case
6. **Handle Errors Gracefully**: The library releases locks on errors to prevent deadlocks

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
