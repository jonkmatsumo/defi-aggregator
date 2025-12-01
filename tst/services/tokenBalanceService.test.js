import TokenBalanceService from '../../src/services/tokenBalanceService';

// Add BigInt serializer for Jest
if (typeof BigInt !== 'undefined') {
  BigInt.prototype.toJSON = function() {
    return this.toString();
  };
}

// Mock viem modules
jest.mock('viem', () => ({
  formatUnits: jest.fn((value, decimals) => {
    const divisor = Math.pow(10, decimals);
    return (parseInt(value) / divisor).toString();
  }),
  getContract: jest.fn()
}));

describe('TokenBalanceService', () => {
  let tokenBalanceService;
  let mockContract;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock contract
    mockContract = {
      read: {
        balanceOf: jest.fn(),
        decimals: jest.fn(),
        symbol: jest.fn(),
        name: jest.fn()
      }
    };

    // Mock getContract to return our mock contract
    const { getContract } = require('viem');
    getContract.mockReturnValue(mockContract);

    tokenBalanceService = new TokenBalanceService();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(tokenBalanceService.cache).toBeInstanceOf(Map);
      expect(tokenBalanceService.cacheTimeout).toBe(30000); // 30 seconds
      expect(tokenBalanceService.commonTokens).toBeDefined();
    });

    it('should have common tokens for supported chains', () => {
      expect(tokenBalanceService.commonTokens[1]).toBeDefined(); // Ethereum
      expect(tokenBalanceService.commonTokens[137]).toBeDefined(); // Polygon
      expect(tokenBalanceService.commonTokens[56]).toBeDefined(); // BSC
    });
  });

  describe('getTokenMetadata', () => {
    it('should return token metadata for known token on supported chain', () => {
      const tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const chainId = 1;
      
      const metadata = tokenBalanceService.getTokenMetadata(tokenAddress, chainId);
      
      expect(metadata).toEqual({
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        color: '#627eea'
      });
    });

    it('should return fallback metadata for unknown token', () => {
      const tokenAddress = '0xUnknownTokenAddress';
      const chainId = 1;
      
      const metadata = tokenBalanceService.getTokenMetadata(tokenAddress, chainId);
      
      expect(metadata).toEqual({
        symbol: '0XUNKN',
        name: 'Unknown Token',
        decimals: 18,
        color: '#4a5568'
      });
    });

    it('should return fallback metadata for unsupported chain', () => {
      const tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const chainId = 999; // Unsupported chain
      
      const metadata = tokenBalanceService.getTokenMetadata(tokenAddress, chainId);
      
      expect(metadata).toEqual({
        symbol: '0XC02A',
        name: 'Unknown Token',
        decimals: 18,
        color: '#4a5568'
      });
    });
  });

  describe('cache management', () => {
    it('should check if cache is valid', () => {
      const cacheKey = 'test_key';
      
      // Test with no cache
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(false);
      
      // Test with valid cache
      const now = Date.now();
      tokenBalanceService.cache.set(cacheKey, {
        data: { balance: '1000' },
        timestamp: now
      });
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(true);
      
      // Test with expired cache
      tokenBalanceService.cache.set(cacheKey, {
        data: { balance: '1000' },
        timestamp: now - 40000 // 40 seconds ago (older than 30 sec timeout)
      });
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(false);
    });

    it('should get cached data', () => {
      const cacheKey = 'test_key';
      const testData = { balance: '1000' };
      
      // Test with no cache
      expect(tokenBalanceService.getCachedData(cacheKey)).toBe(null);
      
      // Test with cache
      tokenBalanceService.cache.set(cacheKey, {
        data: testData,
        timestamp: Date.now()
      });
      expect(tokenBalanceService.getCachedData(cacheKey)).toEqual(testData);
    });

    it('should set cached data', () => {
      const cacheKey = 'test_key';
      const testData = { balance: '1000' };
      
      tokenBalanceService.setCachedData(cacheKey, testData);
      
      const cached = tokenBalanceService.cache.get(cacheKey);
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeDefined();
    });

    it('should clear cache', () => {
      tokenBalanceService.cache.set('key1', { data: 'test1', timestamp: Date.now() });
      tokenBalanceService.cache.set('key2', { data: 'test2', timestamp: Date.now() });
      
      expect(tokenBalanceService.cache.size).toBe(2);
      
      tokenBalanceService.clearCache();
      
      expect(tokenBalanceService.cache.size).toBe(0);
    });
  });

  describe('fetchTokenMetadata', () => {
    it('should return fallback metadata when client is missing', async () => {
      const tokenAddress = '0x123...';
      
      const result = await tokenBalanceService.fetchTokenMetadata({}, tokenAddress);
      expect(result).toEqual({
        symbol: '0X123.',
        name: 'Unknown Token',
        decimals: 18,
        color: '#4a5568'
      });
    });

    it('should fetch token metadata from blockchain', async () => {
      const tokenAddress = '0x123...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      mockContract.read.symbol.mockResolvedValue('TEST');
      mockContract.read.name.mockResolvedValue('Test Token');
      mockContract.read.decimals.mockResolvedValue(18);
      
      const result = await tokenBalanceService.fetchTokenMetadata(mockClient, tokenAddress);
      
      expect(result).toEqual({
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
        color: expect.any(String)
      });
    });

    it('should handle contract errors and return fallback metadata', async () => {
      const tokenAddress = '0x123...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      mockContract.read.symbol.mockRejectedValue(new Error('Contract error'));
      
      const result = await tokenBalanceService.fetchTokenMetadata(mockClient, tokenAddress);
      
      expect(result).toEqual({
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        decimals: 18,
        color: expect.any(String)
      });
    });
  });

  describe('getRandomColor', () => {
    it('should return a valid hex color', () => {
      const color = tokenBalanceService.getRandomColor();
      
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should return valid colors from the predefined color palette', () => {
      const colors = [];
      const expectedColors = [
        '#627eea', '#8247e5', '#f3ba2f', '#2775ca', '#f2a900',
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
        '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
      ];
      
      // Generate multiple colors to test randomness
      for (let i = 0; i < 10; i++) {
        const color = tokenBalanceService.getRandomColor();
        colors.push(color);
        
        // Check that it's a valid hex color
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        
        // Check that it's one of the expected colors
        expect(expectedColors).toContain(color);
      }
      
      // Check that we get some variety (at least 3 different colors in 10 calls)
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('fetchNativeBalance', () => {
    it('should return null when client is missing', async () => {
      const address = '0x123...';
      
      const result = await tokenBalanceService.fetchNativeBalance(null, address);
      expect(result).toBeNull();
    });

    it('should fetch native balance from blockchain', async () => {
      const address = '0x123...';
      const mockClient = {
        getBalance: jest.fn().mockResolvedValue('2000000000000000000'),
        chain: { id: 1 }
      };
      
      const result = await tokenBalanceService.fetchNativeBalance(mockClient, address);
      
      expect(mockClient.getBalance).toHaveBeenCalledWith({ address });
      expect(result).toEqual({
        address: 'native',
        balance: '2',
        color: '#627eea',
        decimals: 18,
        isMock: false,
        name: 'Ether',
        symbol: 'ETH',
        value: '$4,000'
      });
    });

    it('should handle client errors', async () => {
      const address = '0x123...';
      const mockClient = {
        getBalance: jest.fn().mockRejectedValue(new Error('Network error')),
        chain: { id: 1 }
      };
      
      const result = await tokenBalanceService.fetchNativeBalance(mockClient, address);
      
      expect(result).toBeNull();
    });
  });

  describe('fetchTokenBalance', () => {
    it('should return null when client is missing', async () => {
      const tokenAddress = '0x123...';
      const userAddress = '0x456...';
      
      const result = await tokenBalanceService.fetchTokenBalance(null, tokenAddress, userAddress);
      expect(result).toBeNull();
    });

    it('should fetch token balance from blockchain', async () => {
      const tokenAddress = '0x123...';
      const userAddress = '0x456...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      mockContract.read.balanceOf.mockResolvedValue('500000000000000000');
      mockContract.read.decimals.mockResolvedValue(18);
      mockContract.read.symbol.mockResolvedValue('TEST');
      mockContract.read.name.mockResolvedValue('Test Token');
      
      const result = await tokenBalanceService.fetchTokenBalance(mockClient, tokenAddress, userAddress);
      
      expect(mockContract.read.balanceOf).toHaveBeenCalledWith([userAddress]);
      expect(result).toEqual({
        address: tokenAddress,
        balance: '0.5',
        color: expect.any(String),
        decimals: 18,
        isMock: false,
        name: 'Test Token',
        symbol: 'TEST',
        value: '$0'
      });
    });

    it('should handle contract errors', async () => {
      const tokenAddress = '0x123...';
      const userAddress = '0x456...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      mockContract.read.balanceOf.mockRejectedValue(new Error('Contract error'));
      
      const result = await tokenBalanceService.fetchTokenBalance(mockClient, tokenAddress, userAddress);
      
      expect(result).toBeNull();
    });
  });

  describe('fetchAllTokenBalances', () => {
    it('should return empty array when no user address', async () => {
      const result = await tokenBalanceService.fetchAllTokenBalances({}, null);
      expect(result).toEqual([]);
    });

    it('should fetch native and token balances', async () => {
      const userAddress = '0x123...';
      const mockClient = {
        getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      // Mock token balance fetching
      mockContract.read.balanceOf.mockResolvedValue('500000000000000000');
      mockContract.read.decimals.mockResolvedValue(18);
      mockContract.read.symbol.mockResolvedValue('TEST');
      mockContract.read.name.mockResolvedValue('Test Token');
      
      const result = await tokenBalanceService.fetchAllTokenBalances(mockClient, userAddress, 2);
      
      expect(result).toHaveLength(2); // Native + 1 token
      expect(result[0]).toHaveProperty('symbol', 'ETH');
      expect(result[1]).toHaveProperty('symbol', 'TEST');
    });

    it('should respect maxAssets parameter', async () => {
      const userAddress = '0x123...';
      const mockClient = {
        getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      const result = await tokenBalanceService.fetchAllTokenBalances(mockClient, userAddress, 1);
      
      expect(result).toHaveLength(1); // Only native balance
    });
  });

  describe('static methods', () => {
    describe('getFallbackAssets', () => {
      it('should return fallback assets', () => {
        const assets = TokenBalanceService.getFallbackAssets();
        
        expect(assets).toHaveLength(3);
        expect(assets[0]).toEqual({
          symbol: 'ETH',
          name: 'Ether',
          balance: '2.45',
          value: '$4,900',
          color: '#627eea',
          decimals: 18,
          isMock: true
        });
        expect(assets[1]).toEqual({
          symbol: 'USDC',
          name: 'USD Coin',
          balance: '1,250',
          value: '$1,250',
          color: '#2775ca',
          decimals: 6,
          isMock: true
        });
        expect(assets[2]).toEqual({
          symbol: 'WBTC',
          name: 'Wrapped Bitcoin',
          balance: '0.156',
          value: '$6,555',
          color: '#f2a900',
          decimals: 8,
          isMock: true
        });
      });
    });

    describe('formatBalance', () => {
      it('should format balance correctly', () => {
        expect(TokenBalanceService.formatBalance('1000000000000000000', 18)).toBe('1,000,000,000,000,000,000');
        expect(TokenBalanceService.formatBalance('500000000000000000', 18)).toBe('500,000,000,000,000,000');
        expect(TokenBalanceService.formatBalance('0', 18)).toBe('0');
      });

      it('should format balance with different decimals', () => {
        expect(TokenBalanceService.formatBalance('1000000', 6)).toBe('1,000,000');
        expect(TokenBalanceService.formatBalance('500000', 6)).toBe('500,000');
      });

      it('should handle string and number inputs', () => {
        expect(TokenBalanceService.formatBalance('1000000000000000000', 18)).toBe('1,000,000,000,000,000,000');
        expect(TokenBalanceService.formatBalance(1000000000000000000, 18)).toBe('1,000,000,000,000,000,000');
      });
    });

    describe('calculateUSDValue', () => {
      it('should calculate USD value correctly', () => {
        expect(TokenBalanceService.calculateUSDValue('1.0', 'ETH')).toBe('$2,000');
        expect(TokenBalanceService.calculateUSDValue('1000', 'USDC')).toBe('$1,000');
        expect(TokenBalanceService.calculateUSDValue('0.1', 'WBTC')).toBe('$4,200');
      });

      it('should return $0 for unknown tokens', () => {
        expect(TokenBalanceService.calculateUSDValue('1.0', 'UNKNOWN')).toBe('$0');
      });

      it('should handle zero balance', () => {
        expect(TokenBalanceService.calculateUSDValue('0', 'ETH')).toBe('$0');
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockClient = {
        getBalance: jest.fn().mockRejectedValue(new Error('Network error')),
        chain: { id: 1 }
      };
      
      const result = await tokenBalanceService.fetchNativeBalance(mockClient, '0x123...');
      
      expect(result).toBeNull();
    });

    it('should handle contract errors gracefully', async () => {
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      mockContract.read.balanceOf.mockRejectedValue(new Error('Contract error'));
      
      const result = await tokenBalanceService.fetchTokenBalance(mockClient, '0x123...', '0x456...');
      
      expect(result).toBeNull();
    });

    it('should handle invalid addresses', async () => {
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      const result = await tokenBalanceService.fetchTokenBalance(mockClient, 'invalid', 'invalid');
      
      expect(result).toBeNull();
    });
  });

  describe('performance optimizations', () => {
    it('should call API for each request since no cache is implemented', async () => {
      const tokenAddress = '0x123...';
      const userAddress = '0x456...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      // First call should hit the API
      mockContract.read.balanceOf.mockResolvedValue('1000000000000000000');
      mockContract.read.decimals.mockResolvedValue(18);
      mockContract.read.symbol.mockResolvedValue('TEST');
      mockContract.read.name.mockResolvedValue('Test Token');
      
      await tokenBalanceService.fetchTokenBalance(mockClient, tokenAddress, userAddress);
      
      // Second call should also hit the API since no cache is implemented
      await tokenBalanceService.fetchTokenBalance(mockClient, tokenAddress, userAddress);
      
      // Should call the contract twice since no cache is implemented
      expect(mockContract.read.balanceOf).toHaveBeenCalledTimes(2);
    });

    it('should always call API since no cache is implemented', async () => {
      const tokenAddress = '0x123...';
      const userAddress = '0x456...';
      const mockClient = {
        getContract: jest.fn(),
        chain: { id: 1 }
      };
      
      // Should fetch fresh data
      mockContract.read.balanceOf.mockResolvedValue('2000000000000000000');
      mockContract.read.decimals.mockResolvedValue(18);
      mockContract.read.symbol.mockResolvedValue('TEST');
      mockContract.read.name.mockResolvedValue('Test Token');
      
      await tokenBalanceService.fetchTokenBalance(mockClient, tokenAddress, userAddress);
      
      expect(mockContract.read.balanceOf).toHaveBeenCalled();
    });
  });
}); 