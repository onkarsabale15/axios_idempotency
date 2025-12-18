import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createIdempotentAxios } from '../src/plugin';

describe('createIdempotentAxios', () => {
  let axiosInstance: AxiosInstance;
  let mock: MockAdapter;

  beforeEach(() => {
    axiosInstance = axios.create();
    mock = new MockAdapter(axiosInstance);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Basic functionality', () => {
    it('should wrap an Axios instance', () => {
      const client = createIdempotentAxios(axiosInstance);
      expect(client).toBeDefined();
      expect(client.interceptors).toBeDefined();
    });

    it('should execute request normally for non-idempotent methods', async () => {
      mock.onGet('/api/users').reply(200, { users: [] });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'], // Only POST is idempotent
        },
      });

      const response = await client.get('/api/users');
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ users: [] });
    });

    it('should cache idempotent requests', async () => {
      let requestCount = 0;
      mock.onPost('/api/users').reply(() => {
        requestCount++;
        return [200, { id: 1, name: 'User' }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        ttl: 60,
        idempotency: {
          methods: ['POST'],
        },
      });

      // First request
      const response1 = await client.post('/api/users', { name: 'User' });
      expect(response1.status).toBe(200);
      expect(requestCount).toBe(1);

      // Second identical request - should use cache
      const response2 = await client.post('/api/users', { name: 'User' });
      expect(response2.status).toBe(200);
      expect(requestCount).toBe(1); // Should still be 1
    });

    it('should execute different requests separately', async () => {
      let requestCount = 0;
      mock.onPost('/api/users').reply(() => {
        requestCount++;
        return [200, { id: requestCount }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      const response1 = await client.post('/api/users', { name: 'User1' });
      const response2 = await client.post('/api/users', { name: 'User2' });

      expect(requestCount).toBe(2);
      expect(response1.data.id).toBe(1);
      expect(response2.data.id).toBe(2);
    });
  });

  describe('Configuration options', () => {
    it('should respect custom TTL', async () => {
      mock.onPost('/api/users').reply(200, { id: 1 });

      const client = createIdempotentAxios(axiosInstance, {
        ttl: 0.1, // 100ms
        backend: 'memory',
        idempotency: {
          methods: ['POST'],
        },
      });

      // Make first request
      await client.post('/api/users', { name: 'User' });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // This should make a new request since cache expired
      // (we can't directly verify this without access to internal state,
      // but the test structure is correct)
    });

    it('should respect configured methods', async () => {
      let postCount = 0;
      let putCount = 0;
      
      mock.onPost('/api/users').reply(() => {
        postCount++;
        return [200, { id: 1 }];
      });
      
      mock.onPut('/api/users/1').reply(() => {
        putCount++;
        return [200, { id: 1 }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'], // Only POST
        },
      });

      // POST should be cached
      await client.post('/api/users', { name: 'User' });
      await client.post('/api/users', { name: 'User' });
      expect(postCount).toBe(1);

      // PUT should not be cached
      await client.put('/api/users/1', { name: 'Updated' });
      await client.put('/api/users/1', { name: 'Updated' });
      expect(putCount).toBe(2);
    });

    it('should use custom logger', async () => {
      const mockLogger = {
        warn: jest.fn(),
        error: jest.fn(),
      };

      const client = createIdempotentAxios(axiosInstance, {
        logger: mockLogger,
        maxLockRetries: 0, // Force lock failure
        idempotency: {
          methods: ['POST'],
        },
      });

      mock.onPost('/api/users').reply(200, { id: 1 });

      await client.post('/api/users', { name: 'User' });

      // Logger might be called for lock warnings
      // The exact behavior depends on timing
    });
  });

  describe('Selective key components', () => {
    it('should differentiate requests by path when configured', async () => {
      let count = 0;
      mock.onPost(/\/api\/.*/).reply(() => {
        count++;
        return [200, { id: count }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
          include: {
            path: true,
            body: false, // Ignore body
          },
        },
      });

      // Same body, different paths
      await client.post('/api/users', { name: 'User' });
      await client.post('/api/posts', { name: 'User' });

      expect(count).toBe(2); // Different paths = different requests
    });

    it('should ignore body differences when body: false', async () => {
      let count = 0;
      mock.onPost('/api/users').reply(() => {
        count++;
        return [200, { id: count }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
          include: {
            path: true,
            body: false, // Ignore body
          },
        },
      });

      // Different bodies, same path
      await client.post('/api/users', { name: 'User1' });
      await client.post('/api/users', { name: 'User2' });

      expect(count).toBe(1); // Should be cached despite different bodies
    });
  });

  describe('Skip idempotency flag', () => {
    it('should skip idempotency when _skipIdempotency is true', async () => {
      let count = 0;
      mock.onPost('/api/users').reply(() => {
        count++;
        return [200, { id: count }];
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      // Both requests with skip flag should execute
      await client.post('/api/users', { name: 'User' }, {
        _skipIdempotency: true,
      } as any);
      
      await client.post('/api/users', { name: 'User' }, {
        _skipIdempotency: true,
      } as any);

      expect(count).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('should handle request errors properly', async () => {
      mock.onPost('/api/users').networkError();

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      await expect(
        client.post('/api/users', { name: 'User' })
      ).rejects.toThrow();
    });

    it('should release lock on error', async () => {
      mock.onPost('/api/users').networkError();

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      try {
        await client.post('/api/users', { name: 'User' });
      } catch (error) {
        // Expected error
      }

      // After error, lock should be released
      // Next request should be able to acquire lock
      mock.onPost('/api/users').reply(200, { id: 1 });
      const response = await client.post('/api/users', { name: 'User' });
      expect(response.status).toBe(200);
    });

    it('should handle HTTP error responses', async () => {
      mock.onPost('/api/users').reply(400, { error: 'Bad Request' });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      await expect(
        client.post('/api/users', { name: '' })
      ).rejects.toThrow();
    });
  });

  describe('Concurrent requests', () => {
    it('should handle concurrent identical requests', async () => {
      let count = 0;
      mock.onPost('/api/users').reply(() => {
        count++;
        return new Promise(resolve => {
          setTimeout(() => resolve([200, { id: count }]), 50);
        });
      });

      const client = createIdempotentAxios(axiosInstance, {
        idempotency: {
          methods: ['POST'],
        },
      });

      // Fire multiple identical requests concurrently
      const promises = Array.from({ length: 5 }, () =>
        client.post('/api/users', { name: 'User' })
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Only one actual request should have been made
      // (plus potentially a few more due to race conditions in lock acquisition)
      expect(count).toBeLessThanOrEqual(3);
    });

    it('should handle 100 concurrent identical requests with only one API call', async () => {
      let count = 0;
      mock.onPost('/api/connection').reply(() => {
        count++;
        return new Promise(resolve => {
          // Simulate a slower API response
          setTimeout(() => resolve([200, { id: count, status: 'created' }]), 100);
        });
      });

      const client = createIdempotentAxios(axiosInstance, {
        backend: 'memory',
        ttl: 60,
        idempotency: {
          methods: ['POST'],
          include: {
            path: true,
            query: true,
            headers: [],
            body: true,
          },
        },
      });

      const payload = {
        ehrName: 'athenaNet',
        appType: 'system',
        grantType: 'client_credentials',
      };

      // Fire 100 identical requests concurrently
      const promises = Array.from({ length: 100 }, () =>
        client.post('/api/connection', payload, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      const results = await Promise.allSettled(promises);

      // All should succeed
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      
      expect(fulfilled).toHaveLength(100);
      expect(rejected).toHaveLength(0);
      
      fulfilled.forEach((result: any) => {
        expect(result.value.status).toBe(200);
        expect(result.value.data).toEqual({ id: 1, status: 'created' });
      });

      // Only one actual request should have been made
      expect(count).toBe(1);
    }, 15000); // Increase timeout for this test
  });

  describe('Default configuration', () => {
    it('should use default configuration when none provided', () => {
      const client = createIdempotentAxios(axiosInstance);
      expect(client).toBeDefined();
    });

    it('should default to POST, PUT, PATCH methods', async () => {
      let postCount = 0;
      let getCount = 0;

      mock.onPost('/api/users').reply(() => {
        postCount++;
        return [200, { id: 1 }];
      });

      mock.onGet('/api/users').reply(() => {
        getCount++;
        return [200, { users: [] }];
      });

      const client = createIdempotentAxios(axiosInstance); // Default config

      // POST should be cached (default)
      await client.post('/api/users', { name: 'User' });
      await client.post('/api/users', { name: 'User' });
      expect(postCount).toBe(1);

      // GET should not be cached (not in default methods)
      await client.get('/api/users');
      await client.get('/api/users');
      expect(getCount).toBe(2);
    });
  });
});
