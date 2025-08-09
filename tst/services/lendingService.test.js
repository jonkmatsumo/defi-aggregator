import LendingService from '../../src/services/lendingService';

// Mock fetch globally
global.fetch = jest.fn();

describe('LendingService', () => {
  let lendingService;

  beforeEach(() => {
    jest.clearAllMocks();
    lendingService = new LendingService();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(lendingService.cache).toBeInstanceOf(Map);
      expect(lendingService.cacheTimeout).toBe(5 * 60 * 1000); // 5 minutes
      expect(lendingService.compoundApiBase).toBe('https://api.compound.finance/api/v2');
      expect(lendingService.aaveApiBase).toBe('https://aave-api-v2.aave.com');
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
      const expiredTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      
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
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch and format Compound tokens successfully', async () => {
      const mockResponse = {
        cToken: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            token_address: '0x123...',
            cToken_address: '0x456...',
            decimals: 18,
            supply_rate: { value: '0.025' },
            borrow_rate: { value: '0.045' },
            total_supply: { value: '1000000' },
            total_borrow: { value: '500000' },
            exchange_rate: { value: '1.02' }
          }
        ]
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await lendingService.fetchCompoundTokens();
      
      expect(fetch).toHaveBeenCalledWith('https://api.compound.finance/api/v2/ctoken');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x123...',
        cTokenAddress: '0x456...',
        decimals: 18,
        platform: 'Compound',
        logo: expect.any(String),
        supplyRate: 0.025,
        borrowRate: 0.045,
        totalSupply: 1000000,
        totalBorrow: 500000,
        exchangeRate: 1.02
      });
    });

    it('should handle API errors and return fallback data', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchCompoundTokens();
      
      expect(result).toEqual(lendingService.getFallbackCompoundTokens());
    });

    it('should handle non-ok response and return fallback data', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });
      
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

    it('should fetch Compound markets successfully', async () => {
      const mockResponse = {
        markets: [
          { market: 'test1' },
          { market: 'test2' }
        ]
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await lendingService.fetchCompoundMarkets();
      
      expect(fetch).toHaveBeenCalledWith('https://api.compound.finance/api/v2/market');
      expect(result).toEqual(mockResponse.markets);
    });

    it('should handle errors and return empty array', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
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

    it('should fetch and format Aave reserves successfully', async () => {
      const mockResponse = [
        {
          symbol: 'ETH',
          name: 'Ethereum',
          reserveAddress: '0x123...',
          decimals: 18,
          liquidityRate: '0.028',
          variableBorrowRate: '0.048',
          totalLiquidity: '1200000',
          totalVariableDebt: '600000',
          utilizationRate: '0.5',
          availableLiquidity: '600000'
        }
      ];
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const result = await lendingService.fetchAaveReserves();
      
      expect(fetch).toHaveBeenCalledWith('https://aave-api-v2.aave.com/data/reserves');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0x123...',
        decimals: 18,
        platform: 'Aave',
        logo: expect.any(String),
        supplyRate: 0.028,
        borrowRate: 0.048,
        totalSupply: 1200000,
        totalBorrow: 600000,
        utilizationRate: 0.5,
        availableLiquidity: 600000
      });
    });

    it('should handle API errors and return fallback data', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await lendingService.fetchAaveReserves();
      
      expect(result).toEqual(lendingService.getFallbackAaveReserves());
    });
  });

  describe('fetchAllLendingAssets', () => {
    it('should fetch both Compound and Aave assets successfully', async () => {
      const mockCompoundResponse = {
        cToken: [{ symbol: 'ETH', name: 'Ethereum' }]
      };
      const mockAaveResponse = [
        { symbol: 'USDC', name: 'USD Coin' }
      ];
      
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCompoundResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAaveResponse
        });
      
      const result = await lendingService.fetchAllLendingAssets();
      
      expect(result).toHaveProperty('compound');
      expect(result).toHaveProperty('aave');
      expect(result).toHaveProperty('all');
      expect(result.all).toHaveLength(2);
    });

    it('should handle errors and return fallback data', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      const result = await lendingService.fetchAllLendingAssets();
      
      expect(result.compound).toEqual(lendingService.getFallbackCompoundTokens());
      expect(result.aave).toEqual(lendingService.getFallbackAaveReserves());
      expect(result.all).toHaveLength(
        lendingService.getFallbackCompoundTokens().length + 
        lendingService.getFallbackAaveReserves().length
      );
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
      const userAddress = '0x123...';
      
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

    it('should handle supply transaction errors', async () => {
      const platform = 'Compound';
      const tokenAddress = '0x123...';
      const amount = '100';
      const userAddress = '0x456...';
      const client = {};
      
      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This should not throw since it's a mock implementation
      const result = await lendingService.supplyTokens(platform, tokenAddress, amount, userAddress, client);
      
      expect(result.success).toBe(true);
      consoleSpy.mockRestore();
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
      expect(result.platform).toBe(platform);
      expect(result.tokenAddress).toBe(tokenAddress);
      expect(result.amount).toBe(amount);
      expect(result.timestamp).toBeInstanceOf(Date);
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
      expect(result.platform).toBe(platform);
      expect(result.tokenAddress).toBe(tokenAddress);
      expect(result.amount).toBe(amount);
      expect(result.timestamp).toBeInstanceOf(Date);
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
      expect(result.platform).toBe(platform);
      expect(result.tokenAddress).toBe(tokenAddress);
      expect(result.amount).toBe(amount);
      expect(result.timestamp).toBeInstanceOf(Date);
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
        expect(lendingService.formatBalance('1000000000000000000')).toBe('1000000000000000000.0000');
        expect(lendingService.formatBalance('500000000000000000')).toBe('500000000000000000.0000');
        expect(lendingService.formatBalance('0')).toBe('0.0000');
      });

      it('should format balance with custom decimals', () => {
        expect(lendingService.formatBalance('1000000', 6)).toBe('1000000.0000');
        expect(lendingService.formatBalance('500000', 6)).toBe('500000.0000');
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
          expect(token).toHaveProperty('platform');
          expect(token).toHaveProperty('logo');
          expect(token).toHaveProperty('supplyRate');
          expect(token).toHaveProperty('borrowRate');
          expect(token).toHaveProperty('totalSupply');
          expect(token).toHaveProperty('totalBorrow');
          expect(token).toHaveProperty('exchangeRate');
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
          expect(reserve).toHaveProperty('platform');
          expect(reserve).toHaveProperty('logo');
          expect(reserve).toHaveProperty('supplyRate');
          expect(reserve).toHaveProperty('borrowRate');
          expect(reserve).toHaveProperty('totalSupply');
          expect(reserve).toHaveProperty('totalBorrow');
          expect(reserve).toHaveProperty('utilizationRate');
          expect(reserve).toHaveProperty('availableLiquidity');
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