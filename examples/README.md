# Examples

This directory contains practical examples demonstrating how to use the axios-idempotency-manager package in various scenarios.

## Prerequisites

Before running examples:

1. **Build the package:**
   ```bash
   npm run build
   ```

2. **Install TypeScript execution tool:**
   ```bash
   npm install -g ts-node
   # or use npx (no installation required)
   ```

3. **For Redis examples:** Ensure Redis server is running on localhost:6379

## Running Examples

Execute any example with:

```bash
# Using global ts-node
ts-node examples/basic-usage.ts

# Using npx (no installation needed)
npx ts-node examples/basic-usage.ts
```

## Available Examples

### 1. 🚀 basic-usage.ts

**What it demonstrates:**
- Creating an idempotent Axios client with in-memory storage
- Request deduplication for identical POST requests
- Default configuration behavior
- How GET requests are unaffected (not in default methods list)

**Use this when:**
- You're getting started with the library
- You have a single-server application
- You want to understand the basics

**Key concepts:**
```typescript
// Duplicate requests return cached response
const response1 = await client.post('/posts', { title: 'Test' });
const response2 = await client.post('/posts', { title: 'Test' }); // Cached!
```

**Expected output:**
- First POST executes normally
- Second identical POST returns cached response
- Different POST executes normally
- GET request is unaffected by idempotency

---

### 2. ⚙️ advanced-config.ts

**What it demonstrates:**
- Selective query parameter inclusion
- Header-based idempotency keys
- Custom retry settings for lock acquisition
- Configuring multiple HTTP methods
- Fine-tuning idempotency behavior

**Use this when:**
- You need precise control over what makes requests "identical"
- You're using API keys or authentication headers
- You need to tune performance for your use case

**Key concepts:**
```typescript
idempotency: {
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  include: {
    query: ['id', 'type'], // Only these query params matter
    headers: ['x-api-key'], // Include API key in identity
  },
}
```

**Expected output:**
- Requests with different included params are treated as unique
- Requests with different non-included params are deduplicated
- Custom retry logic handles slow or contested locks

---

### 3. 🔄 concurrent-requests.ts

**What it demonstrates:**
- Multiple identical requests fired simultaneously
- Only one actual HTTP request is executed
- Others wait and receive the same response
- Performance benefits of request coalescing
- Cache behavior across time

**Use this when:**
- You need to understand concurrent request handling
- You're dealing with rapid button clicks or race conditions
- You want to see performance improvements in action

**Key concepts:**
```typescript
// Fire 5 identical requests at once
const promises = Array.from({ length: 5 }, () =>
  client.post('/posts', sameData)
);
await Promise.all(promises); // Only 1 actual network call!
```

**Expected output:**
- Multiple concurrent requests complete quickly
- Only one actual HTTP request is made
- All requests receive identical responses
- Subsequent requests within TTL use cache

---

### 4. ⏭️ skip-idempotency.ts

**What it demonstrates:**
- Bypassing idempotency for specific requests
- Using the `_skipIdempotency` flag
- When you need every request to execute independently
- Use cases like logging or analytics

**Use this when:**
- You have endpoints that should never be deduplicated
- You're sending logs, metrics, or analytics
- You need to force a fresh request despite identical content

**Key concepts:**
```typescript
// This request will ALWAYS execute, never cached
await client.post('/api/log', data, {
  _skipIdempotency: true,
} as any);
```

**Expected output:**
- Regular requests are deduplicated as expected
- Requests with `_skipIdempotency: true` always execute
- Multiple skip requests all execute independently

---

### 5. 🌐 redis-storage.ts

**What it demonstrates:**
- Redis-based storage for distributed systems
- Configuration for Redis backend
- Multi-process/multi-server coordination
- Distributed locking mechanism
- Error handling for Redis connections

**Use this when:**
- You have multiple servers or containers
- You're running in a Kubernetes or Docker environment
- You need request coordination across instances
- You're scaling horizontally

**Prerequisites:**
- Redis server must be running (default: localhost:6379)
- `ioredis` package must be installed

**Key concepts:**
```typescript
import { Redis } from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
  ttl: 300,
});
```

**Expected output:**
- Requests are coordinated via Redis
- Works across multiple process instances
- Distributed locks prevent race conditions
- Cache is shared across all instances

**To test multi-instance behavior:**
```bash
# Terminal 1
npx ts-node examples/redis-storage.ts

# Terminal 2 (simultaneously)
npx ts-node examples/redis-storage.ts

# Both will coordinate via Redis
```

---

## Real-World Scenarios

### Scenario 1: Preventing Double-Submit on Forms

```typescript
// Problem: User clicks "Submit Order" button twice
const client = createIdempotentAxios(axios.create());

// Both clicks will result in only ONE order created
await client.post('/api/orders', orderData);
await client.post('/api/orders', orderData); // Cached!
```

**Try:** Run `concurrent-requests.ts` to see this in action

### Scenario 2: Multiple Components Fetching Same Data

```typescript
// Problem: 3 React components all fetch user data on mount
const client = createIdempotentAxios(axios.create());

// All 3 components trigger fetch simultaneously
// Only 1 actual API call is made
Promise.all([
  UserProfile.fetchData(),  // Makes API call
  UserSettings.fetchData(), // Waits for first
  UserDashboard.fetchData(), // Waits for first
]);
```

**Try:** Modify `concurrent-requests.ts` with your API endpoints

### Scenario 3: Distributed Payment Processing

```typescript
// Problem: Load balancer sends payment request to multiple servers
const redis = new Redis();
const client = createIdempotentAxios(axios.create(), {
  backend: 'redis',
  redisClient: redis,
});

// Only ONE server will process the payment, others wait
await client.post('/api/payment', paymentData);
```

**Try:** Run `redis-storage.ts` in multiple terminals simultaneously

## Troubleshooting Examples

### Example fails to run

**Error:** `Cannot find module '../dist/index'`  
**Solution:** Run `npm run build` first

**Error:** `Redis connection refused`  
**Solution:** Start Redis server: `redis-server` or `brew services start redis`

**Error:** `Cannot find module 'ioredis'`  
**Solution:** Install Redis dependency: `npm install ioredis`

### Modifying Examples

Feel free to modify these examples for your needs:

1. **Change API endpoint:** Update `baseURL` to your own API
2. **Adjust TTL:** Experiment with different cache durations
3. **Test different methods:** Try GET, DELETE, etc.
4. **Add your headers:** Include authentication headers
5. **Test error cases:** Simulate network failures

## Example Use Cases Summary

| Example | Best For | Deployment Type | Complexity |
|---------|----------|----------------|------------|
| basic-usage.ts | Learning the basics | Single server | Easy ⭐ |
| advanced-config.ts | Fine-tuning behavior | Any | Medium ⭐⭐ |
| concurrent-requests.ts | Understanding performance | Any | Medium ⭐⭐ |
| skip-idempotency.ts | Selective bypassing | Any | Easy ⭐ |
| redis-storage.ts | Production distributed systems | Multi-server | Advanced ⭐⭐⭐ |

## Next Steps

After running these examples:

1. **Integrate into your project:** Wrap your existing Axios instance
2. **Configure for your needs:** Adjust TTL, methods, and key inclusion
3. **Test in development:** Verify behavior with your API
4. **Monitor in production:** Track cache hits and performance
5. **Optimize:** Adjust settings based on real-world usage

## Questions?

- Check the main [README.md](../README.md) for detailed documentation
- See the "Troubleshooting" section for common issues
- Review the "FAQ" section for frequently asked questions
- Open an issue on [GitHub](https://github.com/onkarsabale15/axios_idempotency/issues)
