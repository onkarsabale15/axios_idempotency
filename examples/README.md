# Examples

This directory contains example usage files for the axios-idempotency-manager package.

## Running Examples

First, build the package:

```bash
npm run build
```

Then, install ts-node to run TypeScript examples:

```bash
npm install -g ts-node
# or use npx
```

Run any example:

```bash
ts-node examples/basic-usage.ts
# or
npx ts-node examples/basic-usage.ts
```

## Available Examples

### 1. basic-usage.ts
Demonstrates basic usage with in-memory storage. Shows:
- Creating an idempotent Axios client
- Request deduplication
- Response caching
- Default configuration

### 2. advanced-config.ts
Shows advanced configuration options including:
- Selective query parameter inclusion
- Header-based idempotency keys
- Custom retry settings
- Multiple HTTP methods

### 3. concurrent-requests.ts
Demonstrates concurrent request handling:
- Multiple identical requests fired simultaneously
- Only one actual HTTP request executed
- Others wait and receive the same response
- Performance benefits of deduplication

### 4. skip-idempotency.ts
Shows how to bypass idempotency for specific requests:
- Using the `_skipIdempotency` flag
- When you need every request to execute
- Useful for logging or analytics endpoints

### 5. redis-storage.ts
Redis-based storage example for distributed systems:
- Configuration for Redis backend
- Multi-process/multi-server support
- Distributed locking
- Requires Redis server and ioredis package

## Notes

- All examples use the JSONPlaceholder API (https://jsonplaceholder.typicode.com)
- Examples are for demonstration purposes
- Redis example requires a running Redis server
