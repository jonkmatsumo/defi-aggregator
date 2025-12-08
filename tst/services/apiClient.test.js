import { APIClient, APIError, apiClient } from '../../src/services/apiClient';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((i) => Object.keys(store)[i])
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('APIClient', () => {
  let client;

  beforeEach(() => {
    client = new APIClient('http://localhost:3001');
    jest.clearAllMocks();
    global.fetch.mockReset();
    localStorageMock.clear();
  });

  describe('Constructor', () => {
    it('should use default base URL', () => {
      const defaultClient = new APIClient();
      expect(defaultClient.baseUrl).toBe('http://localhost:3001');
    });

    it('should use custom base URL', () => {
      const customClient = new APIClient('http://custom:8080');
      expect(customClient.baseUrl).toBe('http://custom:8080');
    });

    it('should set default timeout', () => {
      expect(client.defaultTimeout).toBe(10000);
    });

    it('should set default retries', () => {
      expect(client.defaultRetries).toBe(3);
    });
  });

  describe('GET Request', () => {
    it('should make successful GET request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { value: 42 } })
      });

      const result = await client.get('/api/test');

      expect(result).toEqual({ value: 42 });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should append query parameters', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });

      await client.get('/api/test', { foo: 'bar', num: 123 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('foo=bar'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('num=123'),
        expect.any(Object)
      );
    });

    it('should ignore null/undefined params', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });

      await client.get('/api/test', { valid: 'value', invalid: null, missing: undefined });

      const calledUrl = global.fetch.mock.calls[0][0];
      expect(calledUrl).toContain('valid=value');
      expect(calledUrl).not.toContain('invalid');
      expect(calledUrl).not.toContain('missing');
    });

    it('should cache successful responses', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { cached: true } })
      });

      await client.get('/api/test', {}, { useCache: true });

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should not cache when useCache is false', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });

      await client.get('/api/test', {}, { useCache: false });

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure then succeed', async () => {
      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { retry: 'success' } })
        });
      });

      const result = await client.get('/api/test', {}, { retries: 1, retryDelay: 10 });

      expect(result).toEqual({ retry: 'success' });
      expect(callCount).toBe(2);
    });

    it('should return cached data after all retries fail', async () => {
      // Set up cached data
      const cacheKey = client.getCacheKey('/api/test', {});
      localStorageMock.setItem(cacheKey, JSON.stringify({
        data: { cached: 'value' },
        timestamp: Date.now(),
        ttl: 300000
      }));

      global.fetch.mockRejectedValue(new Error('All requests failed'));

      const result = await client.get('/api/test', {}, { retries: 0 });

      expect(result._cached).toBe(true);
      expect(result.cached).toBe('value');
    });

    it('should throw error when no cache available after retries', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(client.get('/api/test', {}, { retries: 0 })).rejects.toThrow(APIError);
    });
  });

  describe('POST Request', () => {
    it('should make successful POST request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { created: true } })
      });

      const result = await client.post('/api/test', { name: 'test' });

      expect(result).toEqual({ created: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' })
        })
      );
    });

    it('should retry POST requests on failure', async () => {
      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} })
        });
      });

      await client.post('/api/test', {}, { retries: 1, retryDelay: 10 });

      expect(callCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw APIError on HTTP error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Server error', code: 'SERVER_ERROR' } })
      });

      await expect(client.get('/api/test', {}, { retries: 0 })).rejects.toThrow(APIError);
    });

    it('should throw APIError on network error', async () => {
      global.fetch.mockRejectedValue(new Error('Failed to fetch'));

      await expect(client.get('/api/test', {}, { retries: 0 })).rejects.toThrow(APIError);
    });

    it('should throw APIError when success is false', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          success: false, 
          error: { message: 'Validation failed', code: 'VALIDATION_ERROR' } 
        })
      });

      await expect(client.get('/api/test', {}, { retries: 0 })).rejects.toThrow(APIError);
    });
  });

  describe('Health Check', () => {
    it('should return true when healthy', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'unhealthy' })
      });

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on HTTP error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 503
      });

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('WebSocket URL', () => {
    it('should return WebSocket URL', () => {
      expect(client.getWebSocketUrl()).toBe('ws://localhost:3001');
    });
  });

  describe('Cache Management', () => {
    it('should generate consistent cache keys', () => {
      const key1 = client.getCacheKey('/api/test', { a: 1, b: 2 });
      const key2 = client.getCacheKey('/api/test', { b: 2, a: 1 });
      
      expect(key1).toBe(key2);
    });

    it('should clear cache', () => {
      // Add some cache entries
      localStorageMock.setItem('defi_cache:/api/test', '{}');
      localStorageMock.setItem('defi_cache:/api/other', '{}');
      localStorageMock.setItem('other_key', '{}');

      client.clearCache();

      // Should have removed defi_cache entries
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('defi_cache:/api/test');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('defi_cache:/api/other');
    });

    it('should return cached data with stale indicator', () => {
      const cacheKey = 'defi_cache:/api/test';
      const oldTimestamp = Date.now() - 600000; // 10 minutes ago
      
      localStorageMock.setItem(cacheKey, JSON.stringify({
        data: { value: 'cached' },
        timestamp: oldTimestamp,
        ttl: 300000 // 5 minutes
      }));

      const result = client.getCache(cacheKey);

      expect(result.data).toEqual({ value: 'cached' });
      expect(result._stale).toBe(true);
    });
  });
});

describe('APIError', () => {
  describe('Error Type Detection', () => {
    it('should detect network error', () => {
      const error = new APIError('Network error', 0, 'NETWORK_ERROR');
      expect(error.isNetworkError()).toBe(true);
      expect(error.isTimeout()).toBe(false);
    });

    it('should detect timeout error', () => {
      const error = new APIError('Timeout', 408, 'TIMEOUT');
      expect(error.isTimeout()).toBe(true);
      expect(error.isNetworkError()).toBe(false);
    });

    it('should detect server error', () => {
      const error = new APIError('Server error', 500, 'HTTP_ERROR');
      expect(error.isServerError()).toBe(true);
      expect(error.isClientError()).toBe(false);
    });

    it('should detect client error', () => {
      const error = new APIError('Bad request', 400, 'HTTP_ERROR');
      expect(error.isClientError()).toBe(true);
      expect(error.isServerError()).toBe(false);
    });
  });

  describe('User Messages', () => {
    it('should return network error message', () => {
      const error = new APIError('Error', 0, 'NETWORK_ERROR');
      expect(error.getUserMessage()).toContain('internet connection');
    });

    it('should return timeout message', () => {
      const error = new APIError('Error', 408, 'TIMEOUT');
      expect(error.getUserMessage()).toContain('took too long');
    });

    it('should return server error message', () => {
      const error = new APIError('Error', 500, 'HTTP_ERROR');
      expect(error.getUserMessage()).toContain('experiencing issues');
    });

    it('should return not found message', () => {
      const error = new APIError('Error', 404, 'HTTP_ERROR');
      expect(error.getUserMessage()).toContain('not found');
    });

    it('should return rate limit message', () => {
      const error = new APIError('Error', 429, 'HTTP_ERROR');
      expect(error.getUserMessage()).toContain('Too many requests');
    });

    it('should return original message for unknown errors', () => {
      const error = new APIError('Custom error message', 418, 'HTTP_ERROR');
      expect(error.getUserMessage()).toBe('Custom error message');
    });
  });

  describe('Recoverability', () => {
    it('should mark network errors as recoverable', () => {
      const error = new APIError('Error', 0, 'NETWORK_ERROR');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should mark timeout errors as recoverable', () => {
      const error = new APIError('Error', 408, 'TIMEOUT');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should mark server errors as recoverable', () => {
      const error = new APIError('Error', 503, 'HTTP_ERROR');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should mark client errors as not recoverable', () => {
      const error = new APIError('Error', 400, 'HTTP_ERROR');
      expect(error.isRecoverable()).toBe(false);
    });
  });
});

describe('Singleton Instance', () => {
  it('should export singleton instance', () => {
    expect(apiClient).toBeInstanceOf(APIClient);
  });

  it('should be reusable', () => {
    expect(apiClient.baseUrl).toBe('http://localhost:3001');
  });
});
