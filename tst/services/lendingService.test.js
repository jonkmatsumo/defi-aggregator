import LendingService from '../../src/services/lendingService';
import apiClient from '../../src/services/apiClient';

// Mock the apiClient
jest.mock('../../src/services/apiClient', () => ({
  get: jest.fn(),
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

describe('LendingService', () => {
  let lendingService;

  beforeEach(() => {
    jest.clearAllMocks();
    lendingService = new LendingService();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(lendingService.cache).toBeInstanceOf(Map);
      expect(lendingService.cacheTimeout).toBe(60000); // 1 minute
    });
  });

  describe('cache management', () => {
    it('should get cache key', () => {
      const key = 'test_key';
      expect(lendingService.getCacheKey(key)).toBe(key);
    });

    it('should get cached data when valid', () => {
      const key = 'test_key';
      const testData = { test: 'data' };
      const now = Date.now();
      
      lendingService.cache.set(key, {
        data: testData,
        timestamp: now
      });
      
      expect(lendingService.getCachedData(key)).toEqual(testData);
    });

    it('should return null for expired cache', () => {
      const key = 'test_key';
      const testData = { test: 'data' };
      const expiredTime = Date.now() - (120000); // 2 minutes ago
      
      lendingService.cache.set(key, {
        data: testData,
        timestamp: expiredTime
      });
      
      expect(lendingService.getCachedData(key)).toBeNull();
    });

    it('should return null for non-existent cache', () => {
      expect(lendingService.getCachedData('non_existent')).toBeNull();
    });

    it('should set cached data', () => {
      const key = 'test_key';
      const testData = { test: 'data' };
      
      lendingService.setCachedData(key, testData);
      
      const cached = lendingService.cache.get(key);
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeDefined();
    });

    it('should clear cache', () => {
      lendingService.cache.set('key1', { data: 'test1', timestamp: Date.now() });
      lendingService.cache.set('key2', { data: 'test2', timestamp: Date.now() });
      
      expect(lendingService.cache.size).toBe(2);
      
      lendingService.clearCache();
      
      expect(lendingService.cache.size).toBe(0);
    });
  });

  describe('fetchCompoundTokens', () => {
    it('should return cached data if available', async () => {
      const cachedData = [{ symbol: 'ETH', name: 'Ethereum' }];
      lendingService.cache.set('compound_tokens', {
        data: cachedData,
        timestamp: Date.now()
      });
      
      const result = await lendingService.fetchCompoundTokens();
      expect(result).toEqual(cachedData);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('should fetch Compound tokens from backend API', async () => {
      const mockResponse = {
        protocols: {
          compound: [
            {
              symbol: 'ETH',
              name: 'Ethereum',
              supplyAPY: 0.025,
              borrowAPY: 0.045,
              totalSupply: 1000000,
              totalBorrow: 500000
            }
          ]
        }
      };
      
      apiClient.get.mockResolvedValueOnce(mockResponse);
      
      const result = await lendingService.fetchCompoundTokens();
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/lending-rates', {
        protocols: 'compound'
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('symbol', 'ETH');
      expect(result[0]).toHaveProperty('platform', 'Compound');
    });

    it('should handle API errors and return fallback data', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchCompoundTokens();
      
      expect(result).toEqual(lendingService.getFallbackCompoundTokens());
    });
  });

  describe('fetchCompoundMarkets', () => {
    it('should return cached data if available', async () => {
      const cachedData = [{ market: 'test' }];
      lendingService.cache.set('compound_markets', {
        data: cachedData,
        timestamp: Date.now()
      });
      
      const result = await lendingService.fetchCompoundMarkets();
      expect(result).toEqual(cachedData);
    });

    it('should fetch Compound markets from backend API', async () => {
      const mockResponse = {
        protocols: {
          compound: [
            { symbol: 'ETH', supplyAPY: 0.025 },
            { symbol: 'USDC', supplyAPY: 0.032 }
          ]
        }
      };
      
      apiClient.get.mockResolvedValueOnce(mockResponse);
      
      const result = await lendingService.fetchCompoundMarkets();
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/lending-rates', {
        protocols: 'compound'
      });
      expect(result).toEqual(mockResponse.protocols.compound);
    });

    it('should handle errors and return empty array', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchCompoundMarkets();
      
      expect(result).toEqual([]);
    });
  });

  describe('fetchAaveReserves', () => {
    it('should return cached data if available', async () => {
      const cachedData = [{ symbol: 'ETH', name: 'Ethereum' }];
      lendingService.cache.set('aave_reserves', {
        data: cachedData,
        timestamp: Date.now()
      });
      
      const result = await lendingService.fetchAaveReserves();
      expect(result).toEqual(cachedData);
    });

    it('should fetch Aave reserves from backend API', async () => {
      const mockResponse = {
        protocols: {
          aave: [
            {
              symbol: 'ETH',
              name: 'Ethereum',
              supplyAPY: 0.028,
              borrowAPY: 0.048,
              totalSupply: 1200000,
              totalBorrow: 600000,
              utilizationRate: 0.5
            }
          ]
        }
      };
      
      apiClient.get.mockResolvedValueOnce(mockResponse);
      
      const result = await lendingService.fetchAaveReserves();
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/lending-rates', {
        protocols: 'aave'
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('symbol', 'ETH');
      expect(result[0]).toHaveProperty('platform', 'Aave');
    });

    it('should handle API errors and return fallback data', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchAaveReserves();
      
      expect(result).toEqual(lendingService.getFallbackAaveReserves());
    });
  });

  describe('fetchAllLendingAssets', () => {
    it('should fetch both Compound and Aave assets successfully', async () => {
      const mockResponse = {
        compound: [
          { symbol: 'ETH', supplyAPY: 0.025 }
        ],
        aave: [
          { symbol: 'USDC', supplyAPY: 0.032 }
        ]
      };
      
      apiClient.get.mockResolvedValueOnce(mockResponse);
      
      const result = await lendingService.fetchAllLendingAssets();
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/lending-rates');
      expect(result).toHaveProperty('compound');
      expect(result).toHaveProperty('aave');
      expect(result).toHaveProperty('all');
    });

    it('should handle errors and return fallback data', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchAllLendingAssets();
      
      expect(result.compound).toEqual(lendingService.getFallbackCompoundTokens());
      expect(result.aave).toEqual(lendingService.getFallbackAaveReserves());
      expect(result.all).toHaveLength(
        lendingService.getFallbackCompoundTokens().length + 
        lendingService.getFallbackAaveReserves().length
      );
    });
  });

  describe('fetchTokenLendingRates', () => {
    it('should fetch lending rates for specific token', async () => {
      const mockResponse = {
        token: 'USDC',
        protocols: [
          { protocol: 'aave', supplyAPY: 0.032, borrowAPY: 0.052 },
          { protocol: 'compound', supplyAPY: 0.030, borrowAPY: 0.050 }
        ]
      };
      
      apiClient.get.mockResolvedValueOnce(mockResponse);
      
      const result = await lendingService.fetchTokenLendingRates('USDC', ['aave', 'compound']);
      
      expect(apiClient.get).toHaveBeenCalledWith('/api/lending-rates/USDC', {
        protocols: 'aave,compound'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors', async () => {
      apiClient.get.mockRejectedValueOnce(new Error('API error'));
      
      await expect(lendingService.fetchTokenLendingRates('USDC'))
        .rejects.toThrow('API error');
    });
  });

  describe('fetchUserBalances', () => {
    it('should return empty data when no user address or client', async () => {
      const result = await lendingService.fetchUserBalances(null, null);
      
      expect(result).toEqual({
        compound: [],
        aave: [],
        totalSupplied: 0,
        totalBorrowed: 0
      });
    });

    it('should return mock balances for demo purposes', async () => {
      const mockClient = {};
      const userAddress = '0x1234567890123456789012345678901234567890';
      
      const result = await lendingService.fetchUserBalances(userAddress, mockClient);
      
      expect(result).toHaveProperty('compound');
      expect(result).toHaveProperty('aave');
      expect(result).toHaveProperty('totalSupplied');
      expect(result).toHaveProperty('totalBorrowed');
      expect(result.compound).toHaveLength(2);
      expect(result.aave).toHaveLength(1);
      expect(result.totalSupplied).toBe(8000);
      expect(result.totalBorrowed).toBe(500);
    });
  });

  describe('transaction methods', () => {
    describe('supplyTokens', () => {
      it('should execute supply transaction successfully', async () => {
        const platform = 'Compound';
        const tokenAddress = '0x123...';
        const amount = '100';
        const userAddress = '0x456...';
        const client = {};
        
        const result = await lendingService.supplyTokens(platform, tokenAddress, amount, userAddress, client);
        
        expect(result.success).toBe(true);
        expect(result.transactionHash).toMatch(/^0x[a-f0-9]+$/);
        expect(result.platform).toBe(platform);
        expect(result.tokenAddress).toBe(tokenAddress);
        expect(result.amount).toBe(amount);
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });

    describe('withdrawTokens', () => {
      it('should execute withdraw transaction successfully', async () => {
        const platform = 'Aave';
        const tokenAddress = '0x123...';
        const amount = '50';
        const userAddress = '0x456...';
        const client = {};
        
        const result = await lendingService.withdrawTokens(platform, tokenAddress, amount, userAddress, client);
        
        expect(result.success).toBe(true);
        expect(result.transactionHash).toMatch(/^0x[a-f0-9]+$/);
      });
    });

    describe('borrowTokens', () => {
      it('should execute borrow transaction successfully', async () => {
        const platform = 'Compound';
        const tokenAddress = '0x123...';
        const amount = '200';
        const userAddress = '0x456...';
        const client = {};
        
        const result = await lendingService.borrowTokens(platform, tokenAddress, amount, userAddress, client);
        
        expect(result.success).toBe(true);
        expect(result.transactionHash).toMatch(/^0x[a-f0-9]+$/);
      });
    });

    describe('repayTokens', () => {
      it('should execute repay transaction successfully', async () => {
        const platform = 'Aave';
        const tokenAddress = '0x123...';
        const amount = '150';
        const userAddress = '0x456...';
        const client = {};
        
        const result = await lendingService.repayTokens(platform, tokenAddress, amount, userAddress, client);
        
        expect(result.success).toBe(true);
        expect(result.transactionHash).toMatch(/^0x[a-f0-9]+$/);
      });
    });
  });

  describe('utility methods', () => {
    describe('getTokenLogo', () => {
      it('should return correct logos for known tokens', () => {
        expect(lendingService.getTokenLogo('ETH')).toBe('🔷');
        expect(lendingService.getTokenLogo('DAI')).toBe('🟡');
        expect(lendingService.getTokenLogo('USDC')).toBe('💙');
        expect(lendingService.getTokenLogo('USDT')).toBe('💚');
        expect(lendingService.getTokenLogo('WBTC')).toBe('🟠');
        expect(lendingService.getTokenLogo('UNI')).toBe('🟣');
        expect(lendingService.getTokenLogo('LINK')).toBe('🔵');
        expect(lendingService.getTokenLogo('AAVE')).toBe('🔴');
        expect(lendingService.getTokenLogo('COMP')).toBe('🟢');
      });

      it('should return default logo for unknown tokens', () => {
        expect(lendingService.getTokenLogo('UNKNOWN')).toBe('💰');
      });
    });

    describe('formatAPY', () => {
      it('should format APY correctly', () => {
        expect(lendingService.formatAPY(0.025)).toBe('2.50');
        expect(lendingService.formatAPY(0.1)).toBe('10.00');
        expect(lendingService.formatAPY(0)).toBe('0.00');
      });
    });

    describe('formatBalance', () => {
      it('should format balance correctly', () => {
        expect(lendingService.formatBalance('1000000')).toBe('1000000.0000');
        expect(lendingService.formatBalance('500000')).toBe('500000.0000');
        expect(lendingService.formatBalance('0')).toBe('0.0000');
      });
    });

    describe('getTokenName', () => {
      it('should return correct names for known tokens', () => {
        expect(lendingService.getTokenName('ETH')).toBe('Ethereum');
        expect(lendingService.getTokenName('USDC')).toBe('USD Coin');
        expect(lendingService.getTokenName('DAI')).toBe('Dai Stablecoin');
      });

      it('should return symbol for unknown tokens', () => {
        expect(lendingService.getTokenName('UNKNOWN')).toBe('UNKNOWN');
      });
    });
  });

  describe('fallback data methods', () => {
    describe('getFallbackCompoundTokens', () => {
      it('should return fallback Compound tokens', () => {
        const tokens = lendingService.getFallbackCompoundTokens();
        
        expect(tokens).toHaveLength(3);
        expect(tokens[0].symbol).toBe('ETH');
        expect(tokens[1].symbol).toBe('DAI');
        expect(tokens[2].symbol).toBe('USDC');
        
        tokens.forEach(token => {
          expect(token).toHaveProperty('symbol');
          expect(token).toHaveProperty('name');
          expect(token).toHaveProperty('address');
          expect(token).toHaveProperty('cTokenAddress');
          expect(token).toHaveProperty('decimals');
          expect(token).toHaveProperty('platform', 'Compound');
          expect(token).toHaveProperty('logo');
          expect(token).toHaveProperty('supplyRate');
          expect(token).toHaveProperty('borrowRate');
        });
      });
    });

    describe('getFallbackAaveReserves', () => {
      it('should return fallback Aave reserves', () => {
        const reserves = lendingService.getFallbackAaveReserves();
        
        expect(reserves).toHaveLength(3);
        expect(reserves[0].symbol).toBe('ETH');
        expect(reserves[1].symbol).toBe('USDC');
        expect(reserves[2].symbol).toBe('DAI');
        
        reserves.forEach(reserve => {
          expect(reserve).toHaveProperty('symbol');
          expect(reserve).toHaveProperty('name');
          expect(reserve).toHaveProperty('address');
          expect(reserve).toHaveProperty('decimals');
          expect(reserve).toHaveProperty('platform', 'Aave');
          expect(reserve).toHaveProperty('logo');
          expect(reserve).toHaveProperty('supplyRate');
          expect(reserve).toHaveProperty('borrowRate');
          expect(reserve).toHaveProperty('utilizationRate');
        });
      });
    });
  });

  describe('static methods', () => {
    describe('getSupportedTokens', () => {
      it('should return supported tokens list', () => {
        const tokens = LendingService.getSupportedTokens();
        
        expect(tokens).toHaveLength(9);
        expect(tokens[0]).toEqual({ symbol: 'ETH', name: 'Ethereum', logo: '🔷' });
        expect(tokens[1]).toEqual({ symbol: 'DAI', name: 'Dai Stablecoin', logo: '🟡' });
        expect(tokens[2]).toEqual({ symbol: 'USDC', name: 'USD Coin', logo: '💙' });
      });
    });

    describe('getPlatforms', () => {
      it('should return supported platforms', () => {
        const platforms = LendingService.getPlatforms();
        
        expect(platforms).toHaveLength(2);
        expect(platforms[0]).toEqual({ id: 'compound', name: 'Compound', logo: '🏦' });
        expect(platforms[1]).toEqual({ id: 'aave', name: 'Aave', logo: '🦇' });
      });
    });
  });
});
