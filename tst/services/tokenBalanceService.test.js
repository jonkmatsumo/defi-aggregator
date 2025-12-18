import TokenBalanceService from "../../src/services/tokenBalanceService";
import apiClient from "../../src/services/apiClient";

// Mock the apiClient
jest.mock("../../src/services/apiClient", () => ({
  get: jest.fn(),
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("TokenBalanceService", () => {
  let tokenBalanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenBalanceService = new TokenBalanceService();
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(tokenBalanceService.cache).toBeInstanceOf(Map);
      expect(tokenBalanceService.cacheTimeout).toBe(30000); // 30 seconds
      expect(tokenBalanceService.commonTokens).toBeDefined();
    });

    it("should have common tokens for supported chains", () => {
      expect(tokenBalanceService.commonTokens[1]).toBeDefined(); // Ethereum
      expect(tokenBalanceService.commonTokens[137]).toBeDefined(); // Polygon
      expect(tokenBalanceService.commonTokens[56]).toBeDefined(); // BSC
    });
  });

  describe("getTokenMetadata", () => {
    it("should return token metadata for known token on supported chain", () => {
      const tokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const chainId = 1;

      const metadata = tokenBalanceService.getTokenMetadata(
        tokenAddress,
        chainId
      );

      expect(metadata).toEqual({
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        color: "#627eea",
      });
    });

    it("should return fallback metadata for unknown token", () => {
      const tokenAddress = "0xUnknownTokenAddress";
      const chainId = 1;

      const metadata = tokenBalanceService.getTokenMetadata(
        tokenAddress,
        chainId
      );

      expect(metadata).toEqual({
        symbol: "0XUNKN",
        name: "Unknown Token",
        decimals: 18,
        color: "#4a5568",
      });
    });

    it("should return fallback metadata for unsupported chain", () => {
      const tokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const chainId = 999; // Unsupported chain

      const metadata = tokenBalanceService.getTokenMetadata(
        tokenAddress,
        chainId
      );

      expect(metadata).toEqual({
        symbol: "0XC02A",
        name: "Unknown Token",
        decimals: 18,
        color: "#4a5568",
      });
    });
  });

  describe("cache management", () => {
    it("should check if cache is valid", () => {
      const cacheKey = "test_key";

      // Test with no cache
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(false);

      // Test with valid cache
      const now = Date.now();
      tokenBalanceService.cache.set(cacheKey, {
        data: { balance: "1000" },
        timestamp: now,
      });
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(true);

      // Test with expired cache
      tokenBalanceService.cache.set(cacheKey, {
        data: { balance: "1000" },
        timestamp: now - 40000, // 40 seconds ago (older than 30 sec timeout)
      });
      expect(tokenBalanceService.isCacheValid(cacheKey)).toBe(false);
    });

    it("should get cached data", () => {
      const cacheKey = "test_key";
      const testData = { balance: "1000" };

      // Test with no cache
      expect(tokenBalanceService.getCachedData(cacheKey)).toBe(null);

      // Test with cache
      tokenBalanceService.cache.set(cacheKey, {
        data: testData,
        timestamp: Date.now(),
      });
      expect(tokenBalanceService.getCachedData(cacheKey)).toEqual(testData);
    });

    it("should set cached data", () => {
      const cacheKey = "test_key";
      const testData = { balance: "1000" };

      tokenBalanceService.setCachedData(cacheKey, testData);

      const cached = tokenBalanceService.cache.get(cacheKey);
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeDefined();
    });

    it("should clear cache", () => {
      tokenBalanceService.cache.set("key1", {
        data: "test1",
        timestamp: Date.now(),
      });
      tokenBalanceService.cache.set("key2", {
        data: "test2",
        timestamp: Date.now(),
      });

      expect(tokenBalanceService.cache.size).toBe(2);

      tokenBalanceService.clearCache();

      expect(tokenBalanceService.cache.size).toBe(0);
    });
  });

  describe("fetchNativeBalance", () => {
    it("should return null when client is missing", async () => {
      const address = "0x1234567890123456789012345678901234567890";

      const result = await tokenBalanceService.fetchNativeBalance(
        null,
        address
      );
      expect(result).toBeNull();
    });

    it("should return null when address is missing", async () => {
      const mockClient = { chain: { id: 1 } };

      const result = await tokenBalanceService.fetchNativeBalance(
        mockClient,
        null
      );
      expect(result).toBeNull();
    });

    it("should fetch native balance from backend API", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        tokens: [
          {
            symbol: "ETH",
            name: "Ether",
            balance: "2.5",
            balanceUSD: "$5,000",
            decimals: 18,
          },
        ],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchNativeBalance(
        mockClient,
        address
      );

      expect(apiClient.get).toHaveBeenCalledWith(`/api/balances/${address}`, {
        network: "ethereum",
        includeUSDValues: "true",
      });
      expect(result).toEqual({
        symbol: "ETH",
        name: "Ether",
        balance: "2.5",
        value: "$5,000",
        color: "#627eea",
        address: "native",
        decimals: 18,
        isMock: false,
      });
    });

    it("should return null when native token not found in response", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        tokens: [],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchNativeBalance(
        mockClient,
        address
      );
      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      apiClient.get.mockRejectedValueOnce(new Error("Network error"));

      const result = await tokenBalanceService.fetchNativeBalance(
        mockClient,
        address
      );
      expect(result).toBeNull();
    });

    it("should return cached data if valid", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };
      const cacheKey = `native_ethereum_${address}`;

      const cachedData = {
        symbol: "ETH",
        name: "Ether",
        balance: "3.0",
        value: "$6,000",
        color: "#627eea",
        address: "native",
        decimals: 18,
        isMock: false,
      };

      tokenBalanceService.cache.set(cacheKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const result = await tokenBalanceService.fetchNativeBalance(
        mockClient,
        address
      );

      expect(apiClient.get).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it("should map chain ID to correct network", async () => {
      const address = "0x1234567890123456789012345678901234567890";

      // Test Polygon
      const polygonClient = { chain: { id: 137 } };
      const mockResponse = {
        tokens: [
          {
            symbol: "MATIC",
            name: "MATIC",
            balance: "100",
            balanceUSD: "$150",
            decimals: 18,
          },
        ],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      await tokenBalanceService.fetchNativeBalance(polygonClient, address);

      expect(apiClient.get).toHaveBeenCalledWith(`/api/balances/${address}`, {
        network: "polygon",
        includeUSDValues: "true",
      });
    });
  });

  describe("fetchTokenBalance", () => {
    it("should return null when client is missing", async () => {
      const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const userAddress = "0x1234567890123456789012345678901234567890";

      const result = await tokenBalanceService.fetchTokenBalance(
        null,
        tokenAddress,
        userAddress
      );
      expect(result).toBeNull();
    });

    it("should return null when addresses are missing", async () => {
      const mockClient = { chain: { id: 1 } };

      const result = await tokenBalanceService.fetchTokenBalance(
        mockClient,
        null,
        null
      );
      expect(result).toBeNull();
    });

    it("should fetch token balance from backend API", async () => {
      const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        symbol: "USDC",
        name: "USD Coin",
        balance: "1000.50",
        balanceUSD: "$1,000.50",
        decimals: 6,
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchTokenBalance(
        mockClient,
        tokenAddress,
        userAddress
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/balances/${userAddress}`,
        {
          network: "ethereum",
          tokenAddress,
          includeUSDValues: "true",
        }
      );
      expect(result).toEqual({
        symbol: "USDC",
        name: "USD Coin",
        balance: "1000.50",
        value: "$1,000.50",
        color: "#2775ca",
        address: tokenAddress,
        decimals: 6,
        isMock: false,
      });
    });

    it("should return null when balance is zero", async () => {
      const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        balance: "0",
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchTokenBalance(
        mockClient,
        tokenAddress,
        userAddress
      );
      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      const tokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      apiClient.get.mockRejectedValueOnce(new Error("API error"));

      const result = await tokenBalanceService.fetchTokenBalance(
        mockClient,
        tokenAddress,
        userAddress
      );
      expect(result).toBeNull();
    });
  });

  describe("fetchAllTokenBalances", () => {
    it("should return empty array when client is missing", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";

      const result = await tokenBalanceService.fetchAllTokenBalances(
        null,
        userAddress
      );
      expect(result).toEqual([]);
    });

    it("should return empty array when address is missing", async () => {
      const mockClient = { chain: { id: 1 } };

      const result = await tokenBalanceService.fetchAllTokenBalances(
        mockClient,
        null
      );
      expect(result).toEqual([]);
    });

    it("should fetch all token balances from backend API", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        tokens: [
          {
            symbol: "ETH",
            name: "Ether",
            balance: "2.0",
            balanceUSD: "$4,000",
            decimals: 18,
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            balance: "1000",
            balanceUSD: "$1,000",
            decimals: 6,
          },
          {
            symbol: "DAI",
            name: "Dai",
            balance: "500",
            balanceUSD: "$500",
            decimals: 18,
          },
        ],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchAllTokenBalances(
        mockClient,
        userAddress,
        3
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/balances/${userAddress}`,
        {
          network: "ethereum",
          includeUSDValues: "true",
        }
      );
      expect(result).toHaveLength(3);
      // Should be sorted by value (ETH first at $4,000)
      expect(result[0].symbol).toBe("ETH");
      expect(result[1].symbol).toBe("USDC");
      expect(result[2].symbol).toBe("DAI");
    });

    it("should respect maxAssets parameter", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        tokens: [
          {
            symbol: "ETH",
            name: "Ether",
            balance: "2.0",
            balanceUSD: "$4,000",
            decimals: 18,
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            balance: "1000",
            balanceUSD: "$1,000",
            decimals: 6,
          },
          {
            symbol: "DAI",
            name: "Dai",
            balance: "500",
            balanceUSD: "$500",
            decimals: 18,
          },
        ],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchAllTokenBalances(
        mockClient,
        userAddress,
        2
      );

      expect(result).toHaveLength(2);
    });

    it("should filter out zero balances", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      const mockResponse = {
        tokens: [
          {
            symbol: "ETH",
            name: "Ether",
            balance: "2.0",
            balanceUSD: "$4,000",
            decimals: 18,
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            balance: "0",
            balanceUSD: "$0",
            decimals: 6,
          },
        ],
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchAllTokenBalances(
        mockClient,
        userAddress,
        3
      );

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe("ETH");
    });

    it("should return empty array on API error", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";
      const mockClient = { chain: { id: 1 } };

      apiClient.get.mockRejectedValueOnce(new Error("API error"));

      const result = await tokenBalanceService.fetchAllTokenBalances(
        mockClient,
        userAddress,
        3
      );
      expect(result).toEqual([]);
    });
  });

  describe("fetchPortfolioValue", () => {
    it("should return empty portfolio when address is missing", async () => {
      const result = await tokenBalanceService.fetchPortfolioValue(null);
      expect(result).toEqual({ totalUSD: "$0", networks: {} });
    });

    it("should fetch portfolio value from backend API", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";

      const mockResponse = {
        totalUSD: "$10,000",
        networks: {
          ethereum: { totalUSD: "$8,000", tokens: [] },
          polygon: { totalUSD: "$2,000", tokens: [] },
        },
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await tokenBalanceService.fetchPortfolioValue(
        userAddress,
        ["ethereum", "polygon"]
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/portfolio/${userAddress}`,
        {
          networks: "ethereum,polygon",
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should return empty portfolio on API error", async () => {
      const userAddress = "0x1234567890123456789012345678901234567890";

      apiClient.get.mockRejectedValueOnce(new Error("API error"));

      const result = await tokenBalanceService.fetchPortfolioValue(userAddress);
      expect(result).toEqual({ totalUSD: "$0", networks: {} });
    });
  });

  describe("static methods", () => {
    describe("getFallbackAssets", () => {
      it("should return fallback assets", () => {
        const assets = TokenBalanceService.getFallbackAssets();

        expect(assets).toHaveLength(3);
        expect(assets[0]).toEqual({
          symbol: "ETH",
          name: "Ether",
          balance: "2.45",
          value: "$4,900",
          color: "#627eea",
          decimals: 18,
          isMock: true,
        });
        expect(assets[1]).toEqual({
          symbol: "USDC",
          name: "USD Coin",
          balance: "1,250",
          value: "$1,250",
          color: "#2775ca",
          decimals: 6,
          isMock: true,
        });
        expect(assets[2]).toEqual({
          symbol: "WBTC",
          name: "Wrapped Bitcoin",
          balance: "0.156",
          value: "$6,555",
          color: "#f2a900",
          decimals: 8,
          isMock: true,
        });
      });
    });

    describe("formatBalance", () => {
      it("should format zero balance", () => {
        expect(TokenBalanceService.formatBalance("0", 18)).toBe("0");
        expect(TokenBalanceService.formatBalance(0, 18)).toBe("0");
      });

      it("should format very small balances", () => {
        expect(TokenBalanceService.formatBalance("0.00001", 18)).toBe(
          "< 0.0001"
        );
      });

      it("should format small balances with precision", () => {
        expect(TokenBalanceService.formatBalance("0.5", 18)).toBe("0.5000");
      });

      it("should format medium balances", () => {
        expect(TokenBalanceService.formatBalance("100.5", 18)).toBe("100.50");
      });

      it("should format large balances with commas", () => {
        expect(TokenBalanceService.formatBalance("1000000", 18)).toBe(
          "1,000,000"
        );
      });
    });

    describe("calculateUSDValue", () => {
      it("should calculate USD value correctly", () => {
        expect(TokenBalanceService.calculateUSDValue("1.0", "ETH")).toBe(
          "$2,000"
        );
        expect(TokenBalanceService.calculateUSDValue("1000", "USDC")).toBe(
          "$1,000"
        );
        expect(TokenBalanceService.calculateUSDValue("0.1", "WBTC")).toBe(
          "$4,200"
        );
      });

      it("should return $0 for unknown tokens", () => {
        expect(TokenBalanceService.calculateUSDValue("1.0", "UNKNOWN")).toBe(
          "$0"
        );
      });

      it("should handle zero balance", () => {
        expect(TokenBalanceService.calculateUSDValue("0", "ETH")).toBe("$0");
      });
    });
  });

  describe("getTokenColor", () => {
    it("should return correct colors for known tokens", () => {
      expect(tokenBalanceService.getTokenColor("ETH", 1)).toBe("#627eea");
      expect(tokenBalanceService.getTokenColor("USDC", 1)).toBe("#2775ca");
      expect(tokenBalanceService.getTokenColor("MATIC", 137)).toBe("#8247e5");
      expect(tokenBalanceService.getTokenColor("BNB", 56)).toBe("#f3ba2f");
    });

    it("should return a color for unknown tokens", () => {
      const color = tokenBalanceService.getTokenColor("UNKNOWN", 1);
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe("helper methods", () => {
    it("getNativeTokenName should return correct names", () => {
      expect(tokenBalanceService.getNativeTokenName(1)).toBe("Ether");
      expect(tokenBalanceService.getNativeTokenName(137)).toBe("MATIC");
      expect(tokenBalanceService.getNativeTokenName(56)).toBe("BNB");
      expect(tokenBalanceService.getNativeTokenName(999)).toBe("Native Token");
    });

    it("getNativeTokenColor should return correct colors", () => {
      expect(tokenBalanceService.getNativeTokenColor(1)).toBe("#627eea");
      expect(tokenBalanceService.getNativeTokenColor(137)).toBe("#8247e5");
      expect(tokenBalanceService.getNativeTokenColor(56)).toBe("#f3ba2f");
      expect(tokenBalanceService.getNativeTokenColor(999)).toBe("#4a5568");
    });

    it("getRandomColor should return valid hex color", () => {
      const color = tokenBalanceService.getRandomColor();
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
