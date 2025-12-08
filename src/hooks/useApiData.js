import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient, { APIError } from '../services/apiClient';

/**
 * useApiData Hook
 * 
 * Custom hook for fetching data from the backend API with:
 * - Automatic loading state management
 * - Error handling with retry support
 * - Local storage caching for offline fallback
 * - Automatic refetching on interval
 * - Manual refresh capability
 * 
 * @param {string} endpoint - API endpoint to fetch from
 * @param {Object} options - Hook options
 * @param {Object} options.params - Query parameters
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * @param {number} options.refetchInterval - Auto-refetch interval in ms (0 = disabled)
 * @param {number} options.cacheTime - Cache TTL in ms (default: 5 minutes)
 * @param {Function} options.transform - Transform function for the data
 * @param {any} options.initialData - Initial data before fetching
 * @returns {Object} { data, loading, error, refetch, isCached, isStale, lastUpdated }
 * 
 * @example
 * const { data, loading, error, refetch } = useApiData('/api/prices/BTC', {
 *   params: { currency: 'USD' },
 *   refetchInterval: 30000, // Refetch every 30 seconds
 * });
 */
export function useApiData(endpoint, options = {}) {
  const {
    params = {},
    enabled = true,
    refetchInterval = 0,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    transform = (data) => data,
    initialData = null
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);
  // Track current params to detect changes
  const paramsRef = useRef(params);

  // Stringify params for dependency comparison
  const paramsKey = JSON.stringify(params);

  /**
   * Fetch data from the API
   */
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get(endpoint, params, {
        useCache: true,
        cacheTTL: cacheTime
      });

      if (!mountedRef.current) return;

      // Check if result is from cache
      const cached = result?._cached === true;
      const stale = result?._stale === true;
      const cachedAt = result?._cachedAt;

      // Clean cache metadata from result before transform
      const cleanResult = { ...result };
      delete cleanResult._cached;
      delete cleanResult._stale;
      delete cleanResult._cachedAt;

      const transformedData = transform(cleanResult);

      setData(cached ? { ...transformedData, _cached: true, _stale: stale, _cachedAt: cachedAt } : transformedData);
      setIsCached(cached);
      setIsStale(stale);
      setLastUpdated(cached ? cachedAt : Date.now());
      setError(null);

    } catch (err) {
      if (!mountedRef.current) return;

      setError(err);
      // Keep existing data on error if available
      if (!data) {
        setData(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, paramsKey, enabled, cacheTime, transform]);

  /**
   * Refetch data manually
   */
  const refetch = useCallback(async () => {
    // Clear cache first to force fresh fetch
    const cacheKey = apiClient.getCacheKey(endpoint, params);
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      // Ignore storage errors
    }
    
    setIsCached(false);
    setIsStale(false);
    await fetchData();
  }, [endpoint, paramsKey, fetchData]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    paramsRef.current = params;
    
    if (enabled) {
      fetchData();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [endpoint, paramsKey, enabled, fetchData]);

  // Auto-refetch interval
  useEffect(() => {
    if (!enabled || refetchInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchData();
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    isCached,
    isStale,
    lastUpdated
  };
}

/**
 * useGasPrices Hook
 * 
 * Specialized hook for fetching gas prices
 * 
 * @param {string} network - Network to fetch gas prices for
 * @param {Object} options - Hook options
 * @returns {Object} Hook result
 */
export function useGasPrices(network = 'ethereum', options = {}) {
  return useApiData(`/api/gas-prices/${network}`, {
    refetchInterval: 15000, // Gas prices update every 15 seconds
    cacheTime: 30000, // Cache for 30 seconds
    ...options
  });
}

/**
 * useCryptoPrice Hook
 * 
 * Specialized hook for fetching cryptocurrency prices
 * 
 * @param {string} symbol - Crypto symbol (e.g., 'BTC')
 * @param {Object} options - Hook options
 * @param {string} options.currency - Fiat currency (default: 'USD')
 * @returns {Object} Hook result
 */
export function useCryptoPrice(symbol, options = {}) {
  const { currency = 'USD', ...restOptions } = options;
  
  return useApiData(`/api/prices/${symbol}`, {
    params: { currency },
    refetchInterval: 30000, // Prices update every 30 seconds
    cacheTime: 60000, // Cache for 1 minute
    enabled: !!symbol,
    ...restOptions
  });
}

/**
 * useLendingRates Hook
 * 
 * Specialized hook for fetching lending rates
 * 
 * @param {string} token - Token symbol
 * @param {Object} options - Hook options
 * @param {string[]} options.protocols - Protocols to check
 * @returns {Object} Hook result
 */
export function useLendingRates(token, options = {}) {
  const { protocols = ['aave', 'compound'], ...restOptions } = options;
  
  return useApiData(`/api/lending-rates/${token}`, {
    params: { protocols: protocols.join(',') },
    refetchInterval: 60000, // Lending rates update every minute
    cacheTime: 120000, // Cache for 2 minutes
    enabled: !!token,
    ...restOptions
  });
}

/**
 * useTokenBalances Hook
 * 
 * Specialized hook for fetching token balances
 * 
 * @param {string} address - Wallet address
 * @param {Object} options - Hook options
 * @param {string} options.network - Network (default: 'ethereum')
 * @returns {Object} Hook result
 */
export function useTokenBalances(address, options = {}) {
  const { network = 'ethereum', ...restOptions } = options;
  
  return useApiData(`/api/balances/${address}`, {
    params: { network },
    refetchInterval: 30000, // Balances update every 30 seconds
    cacheTime: 60000, // Cache for 1 minute
    enabled: !!address && /^0x[a-fA-F0-9]{40}$/.test(address),
    ...restOptions
  });
}

/**
 * usePortfolio Hook
 * 
 * Specialized hook for fetching portfolio data
 * 
 * @param {string} address - Wallet address
 * @param {Object} options - Hook options
 * @param {string[]} options.networks - Networks to include
 * @returns {Object} Hook result
 */
export function usePortfolio(address, options = {}) {
  const { networks = ['ethereum', 'polygon'], ...restOptions } = options;
  
  return useApiData(`/api/portfolio/${address}`, {
    params: { networks: networks.join(',') },
    refetchInterval: 60000, // Portfolio updates every minute
    cacheTime: 120000, // Cache for 2 minutes
    enabled: !!address && /^0x[a-fA-F0-9]{40}$/.test(address),
    ...restOptions
  });
}

export default useApiData;

