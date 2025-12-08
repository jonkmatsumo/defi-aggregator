import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useApiData,
  useGasPrices,
  useCryptoPrice,
  useLendingRates,
  useTokenBalances,
  usePortfolio
} from '../../src/hooks/useApiData';
import apiClient from '../../src/services/apiClient';

// Mock the apiClient
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    getCacheKey: jest.fn((endpoint, params) => `cache:${endpoint}:${JSON.stringify(params)}`)
  },
  APIError: class APIError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useApiData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation to a default resolved value
    apiClient.get.mockReset();
  });

  describe('Basic Functionality', () => {
    it('should fetch data on mount', async () => {
      apiClient.get.mockResolvedValue({ value: 42 });

      const { result } = renderHook(() => useApiData('/api/test'));

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual({ value: 42 });
      expect(result.current.error).toBeNull();
    });

    it('should set error on failure', async () => {
      const error = new Error('Fetch failed');
      apiClient.get.mockRejectedValue(error);

      const { result } = renderHook(() => useApiData('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(error);
      expect(result.current.data).toBeNull();
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(() => useApiData('/api/test', { enabled: false }));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('should pass params to API client', async () => {
      apiClient.get.mockResolvedValue({ data: 'test' });

      renderHook(() => useApiData('/api/test', { params: { id: 1 } }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          '/api/test',
          { id: 1 },
          expect.any(Object)
        );
      });
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', async () => {
      apiClient.get.mockResolvedValue({ value: 'data' });

      const { result } = renderHook(() => useApiData('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify refetch is a function that can be called
      expect(typeof result.current.refetch).toBe('function');
      expect(result.current.data).toEqual({ value: 'data' });
    });
  });

  describe('Cached Data Handling', () => {
    it('should set isCached flag for cached data', async () => {
      apiClient.get.mockResolvedValue({
        value: 'cached',
        _cached: true,
        _cachedAt: Date.now() - 60000,
        _stale: false
      });

      const { result } = renderHook(() => useApiData('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isCached).toBe(true);
      expect(result.current.isStale).toBe(false);
    });

    it('should set isStale flag for stale cached data', async () => {
      apiClient.get.mockResolvedValue({
        value: 'stale',
        _cached: true,
        _cachedAt: Date.now() - 600000,
        _stale: true
      });

      const { result } = renderHook(() => useApiData('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isCached).toBe(true);
      expect(result.current.isStale).toBe(true);
    });

    it('should set lastUpdated to current time for fresh data', async () => {
      const beforeFetch = Date.now();
      apiClient.get.mockResolvedValue({ value: 'fresh' });

      const { result } = renderHook(() => useApiData('/api/test'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lastUpdated).toBeGreaterThanOrEqual(beforeFetch);
      expect(result.current.lastUpdated).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Transform Function', () => {
    it('should apply transform to data', async () => {
      apiClient.get.mockResolvedValue({ value: 10 });

      const transform = jest.fn((data) => ({ ...data, doubled: data.value * 2 }));

      const { result } = renderHook(() => 
        useApiData('/api/test', { transform })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(transform).toHaveBeenCalled();
      expect(result.current.data.doubled).toBe(20);
    });
  });

  describe('Initial Data', () => {
    it('should use initial data when disabled', () => {
      const { result } = renderHook(() => 
        useApiData('/api/test', {
          initialData: { initial: true },
          enabled: false
        })
      );

      expect(result.current.data).toEqual({ initial: true });
    });
  });
});

describe('Specialized Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockReset();
  });

  describe('useGasPrices', () => {
    it('should fetch gas prices for network', async () => {
      apiClient.get.mockResolvedValue({ gasPrice: '30 gwei' });

      const { result } = renderHook(() => useGasPrices('ethereum'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/gas-prices/ethereum',
        {},
        expect.objectContaining({
          cacheTTL: 30000
        })
      );
    });
  });

  describe('useCryptoPrice', () => {
    it('should fetch price for symbol', async () => {
      apiClient.get.mockResolvedValue({ price: 50000 });

      const { result } = renderHook(() => useCryptoPrice('BTC'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/prices/BTC',
        { currency: 'USD' },
        expect.any(Object)
      );
    });

    it('should use custom currency', async () => {
      apiClient.get.mockResolvedValue({ price: 42000 });

      const { result } = renderHook(() => useCryptoPrice('BTC', { currency: 'EUR' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/prices/BTC',
        { currency: 'EUR' },
        expect.any(Object)
      );
    });

    it('should not fetch without symbol', () => {
      const { result } = renderHook(() => useCryptoPrice(''));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('useLendingRates', () => {
    it('should fetch lending rates for token', async () => {
      apiClient.get.mockResolvedValue({ rates: [] });

      const { result } = renderHook(() => useLendingRates('USDC'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/lending-rates/USDC',
        { protocols: 'aave,compound' },
        expect.any(Object)
      );
    });

    it('should use custom protocols', async () => {
      apiClient.get.mockResolvedValue({ rates: [] });

      const { result } = renderHook(() => useLendingRates('USDC', { protocols: ['aave'] }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/lending-rates/USDC',
        { protocols: 'aave' },
        expect.any(Object)
      );
    });
  });

  describe('useTokenBalances', () => {
    it('should fetch balances for valid address', async () => {
      apiClient.get.mockResolvedValue({ balances: [] });

      const validAddress = '0x1234567890123456789012345678901234567890';
      const { result } = renderHook(() => useTokenBalances(validAddress));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/balances/${validAddress}`,
        { network: 'ethereum' },
        expect.any(Object)
      );
    });

    it('should not fetch for invalid address', () => {
      const { result } = renderHook(() => useTokenBalances('invalid'));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('should use custom network', async () => {
      apiClient.get.mockResolvedValue({ balances: [] });

      const validAddress = '0x1234567890123456789012345678901234567890';
      const { result } = renderHook(() => useTokenBalances(validAddress, { network: 'polygon' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.any(String),
        { network: 'polygon' },
        expect.any(Object)
      );
    });
  });

  describe('usePortfolio', () => {
    it('should fetch portfolio for valid address', async () => {
      apiClient.get.mockResolvedValue({ totalValue: 1000 });

      const validAddress = '0x1234567890123456789012345678901234567890';
      const { result } = renderHook(() => usePortfolio(validAddress));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/portfolio/${validAddress}`,
        { networks: 'ethereum,polygon' },
        expect.any(Object)
      );
    });

    it('should not fetch for invalid address', () => {
      const { result } = renderHook(() => usePortfolio('invalid'));

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });
  });
});
