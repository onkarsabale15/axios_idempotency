import { buildIdempotencyKey } from '../src/keyBuilder';
import { AxiosRequestConfig } from 'axios';

describe('buildIdempotencyKey', () => {
  describe('Basic key generation', () => {
    it('should generate a key with default settings', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John' },
      };

      const key = buildIdempotencyKey(config);
      expect(key).toMatch(/^axios-idempotent:[a-f0-9]{64}$/);
    });

    it('should generate consistent keys for identical configs', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John', email: 'john@example.com' },
      };

      const key1 = buildIdempotencyKey(config, { path: true, body: true });
      const key2 = buildIdempotencyKey(config, { path: true, body: true });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different configs', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John' },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'Jane' },
      };

      const key1 = buildIdempotencyKey(config1, { path: true, body: true });
      const key2 = buildIdempotencyKey(config2, { path: true, body: true });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Method handling', () => {
    it('should normalize method to uppercase', () => {
      const config1: AxiosRequestConfig = {
        method: 'post',
        url: '/api/users',
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
      };

      const key1 = buildIdempotencyKey(config1, { path: true });
      const key2 = buildIdempotencyKey(config2, { path: true });

      expect(key1).toBe(key2);
    });

    it('should default to GET when method is not specified', () => {
      const config: AxiosRequestConfig = {
        url: '/api/users',
      };

      const key = buildIdempotencyKey(config, { path: true });
      expect(key).toBeTruthy();
    });
  });

  describe('Path inclusion', () => {
    it('should include path by default', () => {
      const config1: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const config2: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/posts',
      };

      const key1 = buildIdempotencyKey(config1);
      const key2 = buildIdempotencyKey(config2);

      expect(key1).not.toBe(key2);
    });

    it('should extract path from full URL', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/api/users?id=1',
      };

      const key = buildIdempotencyKey(config, { path: true });
      expect(key).toBeTruthy();
    });

    it('should handle relative URLs', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users?id=1',
      };

      const key = buildIdempotencyKey(config, { path: true });
      expect(key).toBeTruthy();
    });
  });

  describe('Query parameter handling', () => {
    it('should include all query params when query is true', () => {
      const config1: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users?id=1&type=admin',
      };

      const config2: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users?id=1',
      };

      const key1 = buildIdempotencyKey(config1, { path: true, query: true });
      const key2 = buildIdempotencyKey(config2, { path: true, query: true });

      expect(key1).not.toBe(key2);
    });

    it('should include only specified query params when array provided', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users?id=1&type=admin&name=john',
        params: { extra: 'value' },
      };

      const key1 = buildIdempotencyKey(config, {
        path: true,
        query: ['id', 'type'],
      });
      const key2 = buildIdempotencyKey(config, {
        path: true,
        query: ['id'],
      });

      expect(key1).not.toBe(key2);
    });

    it('should merge URL query params with params object', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users?id=1',
        params: { type: 'admin' },
      };

      const key = buildIdempotencyKey(config, { path: true, query: true });
      expect(key).toBeTruthy();
    });
  });

  describe('Header inclusion', () => {
    it('should include specified headers', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'x-api-key': 'key1',
          'content-type': 'application/json',
        },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'x-api-key': 'key2',
          'content-type': 'application/json',
        },
      };

      const key1 = buildIdempotencyKey(config1, {
        path: true,
        headers: ['x-api-key'],
      });
      const key2 = buildIdempotencyKey(config2, {
        path: true,
        headers: ['x-api-key'],
      });

      expect(key1).not.toBe(key2);
    });

    it('should handle case-insensitive header matching', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: {
          'X-API-KEY': 'secret',
          'Content-Type': 'application/json',
        },
      };

      const key = buildIdempotencyKey(config, {
        path: true,
        headers: ['x-api-key'],
      });
      expect(key).toBeTruthy();
    });

    it('should not include headers when not specified', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: { 'x-api-key': 'key1' },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        headers: { 'x-api-key': 'key2' },
      };

      const key1 = buildIdempotencyKey(config1, { path: true });
      const key2 = buildIdempotencyKey(config2, { path: true });

      expect(key1).toBe(key2);
    });
  });

  describe('Body inclusion', () => {
    it('should include body when configured', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John' },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'Jane' },
      };

      const key1 = buildIdempotencyKey(config1, { path: true, body: true });
      const key2 = buildIdempotencyKey(config2, { path: true, body: true });

      expect(key1).not.toBe(key2);
    });

    it('should handle nested objects in body', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: {
          user: {
            name: 'John',
            address: {
              city: 'NYC',
              zip: '10001',
            },
          },
        },
      };

      const key = buildIdempotencyKey(config, { path: true, body: true });
      expect(key).toBeTruthy();
    });

    it('should handle JSON string body', () => {
      const config: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: JSON.stringify({ name: 'John' }),
      };

      const key = buildIdempotencyKey(config, { path: true, body: true });
      expect(key).toBeTruthy();
    });

    it('should not include body when not configured', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John' },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'Jane' },
      };

      const key1 = buildIdempotencyKey(config1, { path: true, body: false });
      const key2 = buildIdempotencyKey(config2, { path: true, body: false });

      expect(key1).toBe(key2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty config', () => {
      const config: AxiosRequestConfig = {};
      const key = buildIdempotencyKey(config);
      expect(key).toMatch(/^axios-idempotent:[a-f0-9]{64}$/);
    });

    it('should handle config with no data', () => {
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: '/api/users',
      };

      const key = buildIdempotencyKey(config, { path: true, body: true });
      expect(key).toBeTruthy();
    });

    it('should generate same key regardless of object property order', () => {
      const config1: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { name: 'John', email: 'john@example.com', age: 30 },
      };

      const config2: AxiosRequestConfig = {
        method: 'POST',
        url: '/api/users',
        data: { age: 30, email: 'john@example.com', name: 'John' },
      };

      const key1 = buildIdempotencyKey(config1, { path: true, body: true });
      const key2 = buildIdempotencyKey(config2, { path: true, body: true });

      expect(key1).toBe(key2);
    });
  });
});
