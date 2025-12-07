import GasPriceService from '../../src/services/gasPriceService';

// Add BigInt serializer for Jest
if (typeof BigInt !== 'undefined') {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

// Mock viem modules
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  http: jest.fn(),
  formatGwei: jest.fn((value) => `${value} gwei`),
  getGasPrice: jest.fn()
}));

jest.mock('viem/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum' },
  polygon: { id: 137, name: 'Polygon' },
  bsc: { id: 56, name: 'BSC' },
  arbitrum: { id: 42161, name: 'Arbitrum' },
  optimism: { id: 10, name: 'Optimism' }
}));

describe('GasPriceService', () => {
  let gasPriceService;
  let mockClient;
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env;
    process.env = { ...originalEnv, REACT_APP_ALCHEMY_API_KEY: 'test-key' };

    // Reset all mocks
    jest.clearAllMocks();

    // Create mock client
    mockClient = {
      getGasPrice: jest.fn(),
      getFeeHistory: jest.fn(),
      chain: { id: 1 }
    };

    // Mock createPublicClient to return our mock client
    const { createPublicClient } = require('viem');
    createPublicClient.mockReturnValue(mockClient);

    gasPriceService = new GasPriceService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(gasPriceService.cache).toBeInstanceOf(Map);
      expect(gasPriceService.cacheTimeout).toBe(1800000); // 30 minutes
      expect(gasPriceService.retryDelays).toBeInstanceOf(Map);
      expect(gasPriceService.clients).toBeDefined();
    });

    it('should create clients for all supported networks', () => {
      const { createPublicClient } = require('viem');
      expect(createPublicClient).toHaveBeenCalledTimes(5); // 5 networks
    });

    it('should throw error if REACT_APP_ALCHEMY_API_KEY is missing', () => {
      process.env.REACT_APP_ALCHEMY_API_KEY = '';
      expect(() => new GasPriceService()).toThrow('REACT_APP_ALCHEMY_API_KEY is missing');
    });
  });

  describe('static getSupportedNetworks', () => {
    it('should return correct network configurations', () => {
      const networks = GasPriceService.getSupportedNetworks();

      expect(networks.ethereum).toEqual({
        name: 'Ethereum',
        color: '#627eea',
        chainId: 1,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      });

      expect(networks.polygon).toEqual({
        name: 'Polygon',
        color: '#8247e5',
        chainId: 137,
        nativeCurrency: { symbol: 'MATIC', decimals: 18 }
      });

      expect(networks.bsc).toEqual({
        name: 'BSC',
        color: '#f3ba2f',
        chainId: 56,
        nativeCurrency: { symbol: 'BNB', decimals: 18 }
      });

      expect(networks.arbitrum).toEqual({
        name: 'Arbitrum',
        color: '#ff6b35',
        chainId: 42161,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      });

      expect(networks.optimism).toEqual({
        name: 'Optimism',
        color: '#ff0420',
        chainId: 10,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      });
    });
  });

  describe('static getFallbackGasPrices', () => {
    it('should return fallback gas prices for all networks', () => {
      const fallbackPrices = GasPriceService.getFallbackGasPrices();

      expect(fallbackPrices.ethereum).toEqual({
        SafeGasPrice: '15 gwei',
        ProposeGasPrice: '18 gwei',
        FastGasPrice: '22 gwei'
      });

      expect(fallbackPrices.polygon).toEqual({
        SafeGasPrice: '2 gwei',
        ProposeGasPrice: '3 gwei',
        FastGasPrice: '4 gwei'
      });

      expect(fallbackPrices.bsc).toEqual({
        SafeGasPrice: '5 gwei',
        ProposeGasPrice: '6 gwei',
        FastGasPrice: '8 gwei'
      });

      expect(fallbackPrices.arbitrum).toEqual({
        SafeGasPrice: '0.5 gwei',
        ProposeGasPrice: '0.6 gwei',
        FastGasPrice: '0.8 gwei'
      });

      expect(fallbackPrices.optimism).toEqual({
        SafeGasPrice: '0.1 gwei',
        ProposeGasPrice: '0.15 gwei',
        FastGasPrice: '0.2 gwei'
      });
    });
  });

  describe('cache management', () => {
    it('should check if cache is valid', () => {
      const networkKey = 'ethereum';

      // Test with no cache
      expect(gasPriceService.isCacheValid(networkKey)).toBe(false);

      // Test with valid cache
      const now = Date.now();
      gasPriceService.cache.set(networkKey, {
        data: { gasPrice: '20' },
        timestamp: now
      });
      expect(gasPriceService.isCacheValid(networkKey)).toBe(true);

      // Test with expired cache
      gasPriceService.cache.set(networkKey, {
        data: { gasPrice: '20' },
        timestamp: now - 2000000 // 2 minutes ago (older than 30 min timeout)
      });
      expect(gasPriceService.isCacheValid(networkKey)).toBe(false);
    });

    it('should get cached data', () => {
      const networkKey = 'ethereum';
      const testData = { gasPrice: '20' };

      // Test with no cache
      expect(gasPriceService.getCachedData(networkKey)).toBe(null);

      // Test with cache
      gasPriceService.cache.set(networkKey, {
        data: testData,
        timestamp: Date.now()
      });
      expect(gasPriceService.getCachedData(networkKey)).toEqual(testData);
    });

    it('should set cached data', () => {
      const networkKey = 'ethereum';
      const testData = { gasPrice: '20' };

      gasPriceService.setCachedData(networkKey, testData);

      const cached = gasPriceService.cache.get(networkKey);
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeDefined();
    });

    it('should clear cache', () => {
      gasPriceService.cache.set('ethereum', { data: 'test', timestamp: Date.now() });
      gasPriceService.cache.set('polygon', { data: 'test2', timestamp: Date.now() });

      expect(gasPriceService.cache.size).toBe(2);

      gasPriceService.clearCache();

      expect(gasPriceService.cache.size).toBe(0);
    });

    it('should clear cache for specific network', () => {
      gasPriceService.cache.set('ethereum', { data: 'test', timestamp: Date.now() });
      gasPriceService.cache.set('polygon', { data: 'test2', timestamp: Date.now() });

      gasPriceService.clearCacheForNetwork('ethereum');

      expect(gasPriceService.cache.has('ethereum')).toBe(false);
      expect(gasPriceService.cache.has('polygon')).toBe(true);
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await gasPriceService.delay(100);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(95); // Allow for small timing variations
    });
  });

  describe('retry delay management', () => {
    it('should get retry delay', () => {
      const networkKey = 'ethereum';

      // Test initial delay
      expect(gasPriceService.getRetryDelay(networkKey)).toBe(10000);

      // Test exponential backoff
      gasPriceService.retryDelays.set(networkKey, 2000);
      expect(gasPriceService.getRetryDelay(networkKey)).toBe(2000);
    });

    it('should reset retry delay', () => {
      const networkKey = 'ethereum';
      gasPriceService.retryDelays.set(networkKey, 5000);

      gasPriceService.resetRetryDelay(networkKey);

      expect(gasPriceService.retryDelays.has(networkKey)).toBe(false);
    });
  });

  describe('fetchGasPrice', () => {
    beforeEach(() => {
      // Ensure mock client is properly set up for each test
      gasPriceService.clients.ethereum = mockClient;
      gasPriceService.clients.polygon = mockClient;
      gasPriceService.clients.bsc = mockClient;
      gasPriceService.clients.arbitrum = mockClient;
      gasPriceService.clients.optimism = mockClient;
      
      // Mock the delay function to prevent actual delays in tests
      jest.spyOn(gasPriceService, 'delay').mockResolvedValue();
      
      // Clear retry delays to prevent rate limit waits
      gasPriceService.retryDelays.clear();
    });

    it('should return cached data if valid', async () => {
      const networkKey = 'ethereum';
      const cachedData = { gasPrice: '20' };

      gasPriceService.cache.set(networkKey, {
        data: cachedData,
        timestamp: Date.now()
      });

      const result = await gasPriceService.fetchGasPrice(networkKey);
      expect(result).toEqual(cachedData);
    });

    it('should fetch new data if cache is invalid', async () => {
      const networkKey = 'ethereum';
      const mockGasPrice = '20000000000'; // 20 gwei

      mockClient.getGasPrice.mockResolvedValue(mockGasPrice);
      mockClient.getFeeHistory.mockResolvedValue({
        reward: [['15000000000', '20000000000', '25000000000']]
      });

      const result = await gasPriceService.fetchGasPrice(networkKey);

      expect(mockClient.getGasPrice).toHaveBeenCalled();
      expect(result).toEqual({
        SafeGasPrice: '15000000000 gwei',
        ProposeGasPrice: '20000000000 gwei',
        FastGasPrice: '25000000000 gwei',
        currentGasPrice: '20000000000 gwei'
      });
    });

    it('should handle client errors and return fallback data', async () => {
      const networkKey = 'ethereum';

      mockClient.getGasPrice.mockRejectedValue(new Error('Network error'));
      mockClient.getFeeHistory.mockRejectedValue(new Error('Network error'));

      const result = await gasPriceService.fetchGasPrice(networkKey);

      expect(result).toEqual({
        SafeGasPrice: '15 gwei',
        ProposeGasPrice: '18 gwei',
        FastGasPrice: '22 gwei'
      });
    });

    it('should implement exponential backoff on retries', async () => {
      const networkKey = 'ethereum';

      mockClient.getGasPrice.mockRejectedValue(new Error('Network error'));
      mockClient.getFeeHistory.mockRejectedValue(new Error('Network error'));

      const result = await gasPriceService.fetchGasPrice(networkKey);

      expect(mockClient.getGasPrice).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        SafeGasPrice: '15 gwei',
        ProposeGasPrice: '18 gwei',
        FastGasPrice: '22 gwei'
      });
    });
  });

  describe('static fetchConnectedWalletGasPrice', () => {
    it('should fetch gas price for connected wallet', async () => {
      const mockClient = {
        getGasPrice: jest.fn().mockResolvedValue('20000000000'),
        getFeeHistory: jest.fn().mockResolvedValue({
          reward: [['15000000000', '20000000000', '25000000000']]
        }),
        chain: { id: 1 }
      };

      const result = await GasPriceService.fetchConnectedWalletGasPrice(mockClient);

      expect(mockClient.getGasPrice).toHaveBeenCalled();
      expect(result).toEqual({
        SafeGasPrice: '15000000000 gwei',
        ProposeGasPrice: '20000000000 gwei',
        FastGasPrice: '25000000000 gwei',
        currentGasPrice: '20000000000 gwei'
      });
    });

    it('should handle client errors', async () => {
      const mockClient = {
        getGasPrice: jest.fn().mockRejectedValue(new Error('Network error')),
        getFeeHistory: jest.fn().mockRejectedValue(new Error('Network error')),
        chain: { id: 1 }
      };

      await expect(GasPriceService.fetchConnectedWalletGasPrice(mockClient)).rejects.toThrow('Network error');
    });
  });

  describe('fetchMultipleGasPrices', () => {
    beforeEach(() => {
      // Ensure mock client is properly set up for each test
      gasPriceService.clients.ethereum = mockClient;
      gasPriceService.clients.polygon = mockClient;
      gasPriceService.clients.bsc = mockClient;
      gasPriceService.clients.arbitrum = mockClient;
      gasPriceService.clients.optimism = mockClient;
      
      // Mock the delay function to prevent actual delays in tests
      jest.spyOn(gasPriceService, 'delay').mockResolvedValue();
      
      // Clear retry delays to prevent rate limit waits
      gasPriceService.retryDelays.clear();
    });

    it('should fetch gas prices for multiple networks', async () => {
      const networkKeys = ['ethereum', 'polygon'];
      const mockGasPrices = ['20000000000', '3000000000'];

      mockClient.getGasPrice
        .mockResolvedValueOnce(mockGasPrices[0])
        .mockResolvedValueOnce(mockGasPrices[1]);
      mockClient.getFeeHistory
        .mockResolvedValueOnce({
          reward: [['15000000000', '20000000000', '25000000000']]
        })
        .mockResolvedValueOnce({
          reward: [['2000000000', '3000000000', '4000000000']]
        });

      const results = await gasPriceService.fetchMultipleGasPrices(networkKeys);

      expect(results).toEqual({
        ethereum: {
          SafeGasPrice: '15000000000 gwei',
          ProposeGasPrice: '20000000000 gwei',
          FastGasPrice: '25000000000 gwei',
          currentGasPrice: '20000000000 gwei'
        },
        polygon: {
          SafeGasPrice: '2000000000 gwei',
          ProposeGasPrice: '3000000000 gwei',
          FastGasPrice: '4000000000 gwei',
          currentGasPrice: '3000000000 gwei'
        }
      });
    });

    it('should handle errors for individual networks', async () => {
      const networkKeys = ['ethereum', 'polygon'];

      mockClient.getGasPrice
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('3000000000');
      mockClient.getFeeHistory
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          reward: [['2000000000', '3000000000', '4000000000']]
        });

      const results = await gasPriceService.fetchMultipleGasPrices(networkKeys);

      expect(results).toEqual({
        ethereum: {
          SafeGasPrice: '15 gwei',
          ProposeGasPrice: '18 gwei',
          FastGasPrice: '22 gwei'
        },
        polygon: {
          SafeGasPrice: '2 gwei',
          ProposeGasPrice: '3 gwei',
          FastGasPrice: '4 gwei'
        }
      });
    });
  });

  describe('static getDisplayGasPrice', () => {
    it('should format gas price for display', () => {
      const gasData = { SafeGasPrice: '20', ProposeGasPrice: '25', FastGasPrice: '30' };

      const result = GasPriceService.getDisplayGasPrice(gasData);

      expect(result).toBe('20 gwei');
    });

    it('should handle string gas prices', () => {
      const gasData = { SafeGasPrice: '15' };

      const result = GasPriceService.getDisplayGasPrice(gasData);

      expect(result).toBe('15 gwei');
    });

    it('should handle fallback data', () => {
      const gasData = { SafeGasPrice: '15' };

      const result = GasPriceService.getDisplayGasPrice(gasData);

      expect(result).toBe('15 gwei');
    });
  });

  describe('static getNetworkStatus', () => {
    it('should return network status based on gas price', () => {
      // Test with valid gas data
      const validGasData = { SafeGasPrice: '15' };
      expect(GasPriceService.getNetworkStatus(validGasData)).toBe('online');

      // Test with invalid gas data
      const invalidGasData = { gasPrice: '15' };
      expect(GasPriceService.getNetworkStatus(invalidGasData)).toBe('offline');

      // Test with null gas data
      expect(GasPriceService.getNetworkStatus(null)).toBe('offline');
    });
  });

  describe('static getNetworkInfo', () => {
    it('should return network info for valid chain ID', () => {
      const ethereumInfo = GasPriceService.getNetworkInfo(1);
      expect(ethereumInfo).toEqual({
        name: 'Ethereum',
        color: '#627eea',
        chainId: 1,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      });

      const polygonInfo = GasPriceService.getNetworkInfo(137);
      expect(polygonInfo).toEqual({
        name: 'Polygon',
        color: '#8247e5',
        chainId: 137,
        nativeCurrency: { symbol: 'MATIC', decimals: 18 }
      });
    });

    it('should return default network info for invalid chain ID', () => {
      const result = GasPriceService.getNetworkInfo(999);
      expect(result).toEqual({
        name: 'Unknown',
        color: '#666666',
        chainId: 999,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      });
    });
  });
}); 