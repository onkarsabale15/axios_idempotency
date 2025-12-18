import {
  delay,
  shouldUseIdempotency,
  serializeResponse,
  deserializeResponse,
} from '../src/utils';
import { AxiosResponse } from 'axios';

describe('Utils', () => {
  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small variance
      expect(elapsed).toBeLessThan(150);
    });

    it('should resolve after delay', async () => {
      const promise = delay(50);
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('shouldUseIdempotency', () => {
    it('should return true for configured methods', () => {
      const configuredMethods = ['POST', 'PUT', 'PATCH'];
      
      expect(shouldUseIdempotency('POST', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('PUT', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('PATCH', configuredMethods)).toBe(true);
    });

    it('should return false for non-configured methods', () => {
      const configuredMethods = ['POST', 'PUT'];
      
      expect(shouldUseIdempotency('GET', configuredMethods)).toBe(false);
      expect(shouldUseIdempotency('DELETE', configuredMethods)).toBe(false);
    });

    it('should handle case-insensitive method matching', () => {
      const configuredMethods = ['POST', 'PUT'];
      
      expect(shouldUseIdempotency('post', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('Post', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('PUT', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('put', configuredMethods)).toBe(true);
    });

    it('should return false for undefined method', () => {
      const configuredMethods = ['POST'];
      expect(shouldUseIdempotency(undefined, configuredMethods)).toBe(false);
    });

    it('should handle empty configured methods array', () => {
      expect(shouldUseIdempotency('POST', [])).toBe(false);
    });

    it('should handle mixed case in configured methods', () => {
      const configuredMethods = ['post', 'Put', 'PATCH'];
      
      expect(shouldUseIdempotency('POST', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('put', configuredMethods)).toBe(true);
      expect(shouldUseIdempotency('patch', configuredMethods)).toBe(true);
    });
  });

  describe('serializeResponse', () => {
    it('should serialize an Axios response', () => {
      const response: Partial<AxiosResponse> = {
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {
          url: '/api/test',
          method: 'GET',
          headers: { 'x-api-key': 'secret' } as any,
          params: { id: '1' },
        },
      };

      const serialized = serializeResponse(response as any);
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toEqual({ id: 1, name: 'Test' });
      expect(parsed.status).toBe(200);
      expect(parsed.statusText).toBe('OK');
    });

    it('should include config fields in serialization', () => {
      const response: Partial<AxiosResponse> = {
        data: { message: 'success' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {
          url: '/api/users',
          method: 'POST',
          headers: { authorization: 'Bearer token' } as any,
          params: { type: 'admin' },
        },
      };

      const serialized = serializeResponse(response as any);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.config.url).toBe('/api/users');
      expect(parsed.config.method).toBe('POST');
      expect(parsed.config.headers.authorization).toBe('Bearer token');
      expect(parsed.config.params.type).toBe('admin');
    });

    it('should handle response with no config', () => {
      const response: Partial<AxiosResponse> = {
        data: 'test',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const serialized = serializeResponse(response as any);
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.data).toBe('test');
    });

    it('should handle response with complex data', () => {
      const response: Partial<AxiosResponse> = {
        data: {
          users: [
            { id: 1, name: 'User 1' },
            { id: 2, name: 'User 2' },
          ],
          meta: {
            total: 2,
            page: 1,
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const serialized = serializeResponse(response as any);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.data.users).toHaveLength(2);
      expect(parsed.data.meta.total).toBe(2);
    });
  });

  describe('deserializeResponse', () => {
    it('should deserialize a serialized response', () => {
      const original = {
        data: { id: 1, name: 'Test' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {
          url: '/api/test',
          method: 'GET',
        },
      };

      const serialized = JSON.stringify(original);
      const deserialized = deserializeResponse(serialized);

      expect(deserialized).toEqual(original);
    });

    it('should return null for invalid JSON', () => {
      const invalid = 'not valid json {';
      const result = deserializeResponse(invalid);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = deserializeResponse('');
      expect(result).toBeNull();
    });

    it('should handle complex nested objects', () => {
      const original = {
        data: {
          user: {
            id: 1,
            profile: {
              name: 'Test User',
              settings: {
                theme: 'dark',
                notifications: true,
              },
            },
          },
        },
        status: 200,
        statusText: 'OK',
      };

      const serialized = JSON.stringify(original);
      const deserialized = deserializeResponse(serialized);

      expect(deserialized?.data.user.profile.settings.theme).toBe('dark');
    });
  });

  describe('serializeResponse and deserializeResponse round-trip', () => {
    it('should maintain data integrity in round-trip', () => {
      const response: Partial<AxiosResponse> = {
        data: { id: 123, items: ['a', 'b', 'c'] },
        status: 200,
        statusText: 'OK',
        headers: { 'x-custom': 'value' },
        config: {
          url: '/api/endpoint',
          method: 'POST',
          headers: { 'content-type': 'application/json' } as any,
          params: { filter: 'active' },
        },
      };

      const serialized = serializeResponse(response as any);
      const deserialized = deserializeResponse(serialized);

      expect(deserialized?.data).toEqual(response.data);
      expect(deserialized?.status).toBe(response.status);
      expect(deserialized?.statusText).toBe(response.statusText);
      expect(deserialized?.headers).toEqual(response.headers);
      expect(deserialized?.config.url).toBe(response.config?.url);
    });

    it('should handle special characters and unicode', () => {
      const response: Partial<AxiosResponse> = {
        data: {
          message: 'Hello 世界 🌍',
          special: 'Characters: @#$%^&*()',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const serialized = serializeResponse(response as any);
      const deserialized = deserializeResponse(serialized);

      expect(deserialized?.data.message).toBe('Hello 世界 🌍');
      expect(deserialized?.data.special).toBe('Characters: @#$%^&*()');
    });
  });
});
