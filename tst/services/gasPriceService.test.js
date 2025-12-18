import GasPriceService from "../../src/services/gasPriceService";
import apiClient from "../../src/services/apiClient";

// Mock the apiClient
jest.mock("../../src/services/apiClient", () => ({
  get: jest.fn(),
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("GasPriceService", () => {
  let gasPriceService;

  beforeEach(() => {
    jest.clearAllMocks();
    gasPriceService = new GasPriceService();
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(gasPriceService.cache).toBeInstanceOf(Map);
      expect(gasPriceService.cacheTimeout).toBe(60000); // 1 minute
    });
  });

  describe("static getSupportedNetworks", () => {
    it("should return correct network configurations", () => {
      const networks = GasPriceService.getSupportedNetworks();

      expect(networks.ethereum).toEqual({
        name: "Ethereum",
        color: "#627eea",
        chainId: 1,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      });

      expect(networks.polygon).toEqual({
        name: "Polygon",
        color: "#8247e5",
        chainId: 137,
        nativeCurrency: { symbol: "MATIC", decimals: 18 },
      });

      expect(networks.bsc).toEqual({
        name: "BSC",
        color: "#f3ba2f",
        chainId: 56,
        nativeCurrency: { symbol: "BNB", decimals: 18 },
      });

      expect(networks.arbitrum).toEqual({
        name: "Arbitrum",
        color: "#ff6b35",
        chainId: 42161,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      });

      expect(networks.optimism).toEqual({
        name: "Optimism",
        color: "#ff0420",
        chainId: 10,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      });
    });
  });

  describe("static getFallbackGasPrices", () => {
    it("should return fallback gas prices for all networks", () => {
      const fallbackPrices = GasPriceService.getFallbackGasPrices();

      expect(fallbackPrices.ethereum).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "18",
        FastGasPrice: "22",
      });

      expect(fallbackPrices.polygon).toEqual({
        SafeGasPrice: "2",
        ProposeGasPrice: "3",
        FastGasPrice: "4",
      });

      expect(fallbackPrices.bsc).toEqual({
        SafeGasPrice: "5",
        ProposeGasPrice: "6",
        FastGasPrice: "8",
      });

      expect(fallbackPrices.arbitrum).toEqual({
        SafeGasPrice: "0.5",
        ProposeGasPrice: "0.6",
        FastGasPrice: "0.8",
      });

      expect(fallbackPrices.optimism).toEqual({
        SafeGasPrice: "0.1",
        ProposeGasPrice: "0.15",
        FastGasPrice: "0.2",
      });
    });
  });

  describe("cache management", () => {
    it("should check if cache is valid", () => {
      const networkKey = "ethereum";

      // Test with no cache
      expect(gasPriceService.isCacheValid(networkKey)).toBe(false);

      // Test with valid cache
      const now = Date.now();
      gasPriceService.cache.set(networkKey, {
        data: { gasPrice: "20" },
        timestamp: now,
      });
      expect(gasPriceService.isCacheValid(networkKey)).toBe(true);

      // Test with expired cache
      gasPriceService.cache.set(networkKey, {
        data: { gasPrice: "20" },
        timestamp: now - 120000, // 2 minutes ago (older than 1 min timeout)
      });
      expect(gasPriceService.isCacheValid(networkKey)).toBe(false);
    });

    it("should get cached data", () => {
      const networkKey = "ethereum";
      const testData = { gasPrice: "20" };

      // Test with no cache
      expect(gasPriceService.getCachedData(networkKey)).toBe(null);

      // Test with cache
      gasPriceService.cache.set(networkKey, {
        data: testData,
        timestamp: Date.now(),
      });
      expect(gasPriceService.getCachedData(networkKey)).toEqual(testData);
    });

    it("should set cached data", () => {
      const networkKey = "ethereum";
      const testData = { gasPrice: "20" };

      gasPriceService.setCachedData(networkKey, testData);

      const cached = gasPriceService.cache.get(networkKey);
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeDefined();
    });

    it("should clear cache", () => {
      gasPriceService.cache.set("ethereum", {
        data: "test",
        timestamp: Date.now(),
      });
      gasPriceService.cache.set("polygon", {
        data: "test2",
        timestamp: Date.now(),
      });

      expect(gasPriceService.cache.size).toBe(2);

      gasPriceService.clearCache();

      expect(gasPriceService.cache.size).toBe(0);
    });

    it("should clear cache for specific network", () => {
      gasPriceService.cache.set("ethereum", {
        data: "test",
        timestamp: Date.now(),
      });
      gasPriceService.cache.set("polygon", {
        data: "test2",
        timestamp: Date.now(),
      });

      gasPriceService.clearCacheForNetwork("ethereum");

      expect(gasPriceService.cache.has("ethereum")).toBe(false);
      expect(gasPriceService.cache.has("polygon")).toBe(true);
    });
  });

  describe("fetchGasPrice", () => {
    it("should return cached data if valid", async () => {
      const networkKey = "ethereum";
      const cachedData = {
        SafeGasPrice: "20",
        ProposeGasPrice: "25",
        FastGasPrice: "30",
      };

      gasPriceService.cache.set(networkKey, {
        data: cachedData,
        timestamp: Date.now(),
      });

      const result = await gasPriceService.fetchGasPrice(networkKey);
      expect(result).toEqual(cachedData);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should fetch from backend API when cache is invalid", async () => {
      const networkKey = "ethereum";
      const mockResponse = {
        gasPrices: {
          slow: { gwei: 15 },
          standard: { gwei: 20 },
          fast: { gwei: 25 },
        },
        source: "etherscan",
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await gasPriceService.fetchGasPrice(networkKey);

      expect(apiClient.get).toHaveBeenCalledWith("/api/gas-prices/ethereum");
      expect(result).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "20",
        FastGasPrice: "25",
        currentGasPrice: "20",
        source: "etherscan",
      });
    });

    it("should return fallback data on API error", async () => {
      const networkKey = "ethereum";

      apiClient.get.mockRejectedValueOnce(new Error("Network error"));

      const result = await gasPriceService.fetchGasPrice(networkKey);

      expect(result).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "18",
        FastGasPrice: "22",
        source: "fallback",
      });
    });
  });

  describe("static fetchConnectedWalletGasPrice", () => {
    it("should fetch gas price for connected wallet via backend", async () => {
      const mockClient = { chain: { id: 1 } };
      const mockResponse = {
        gasPrices: {
          slow: { gwei: 15 },
          standard: { gwei: 20 },
          fast: { gwei: 25 },
        },
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const result =
        await GasPriceService.fetchConnectedWalletGasPrice(mockClient);

      expect(apiClient.get).toHaveBeenCalledWith("/api/gas-prices/ethereum");
      expect(result).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "20",
        FastGasPrice: "25",
        currentGasPrice: "20",
      });
    });

    it("should map chain ID to correct network", async () => {
      const mockClient = { chain: { id: 137 } }; // Polygon
      const mockResponse = {
        gasPrices: {
          slow: { gwei: 2 },
          standard: { gwei: 3 },
          fast: { gwei: 4 },
        },
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      await GasPriceService.fetchConnectedWalletGasPrice(mockClient);

      expect(apiClient.get).toHaveBeenCalledWith("/api/gas-prices/polygon");
    });

    it("should handle API errors", async () => {
      const mockClient = { chain: { id: 1 } };

      apiClient.get.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        GasPriceService.fetchConnectedWalletGasPrice(mockClient)
      ).rejects.toThrow("Network error");
    });
  });

  describe("fetchMultipleGasPrices", () => {
    it("should fetch gas prices for multiple networks", async () => {
      const networkKeys = ["ethereum", "polygon"];
      const mockResponse = {
        networks: {
          ethereum: {
            gasPrices: {
              slow: { gwei: 15 },
              standard: { gwei: 20 },
              fast: { gwei: 25 },
            },
            source: "etherscan",
          },
          polygon: {
            gasPrices: {
              slow: { gwei: 2 },
              standard: { gwei: 3 },
              fast: { gwei: 4 },
            },
            source: "polygon",
          },
        },
      };

      apiClient.get.mockResolvedValueOnce(mockResponse);

      const results = await gasPriceService.fetchMultipleGasPrices(networkKeys);

      expect(apiClient.get).toHaveBeenCalledWith("/api/gas-prices", {
        networks: "ethereum,polygon",
      });
      expect(results.ethereum).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "20",
        FastGasPrice: "25",
        currentGasPrice: "20",
        source: "etherscan",
      });
      expect(results.polygon).toEqual({
        SafeGasPrice: "2",
        ProposeGasPrice: "3",
        FastGasPrice: "4",
        currentGasPrice: "3",
        source: "polygon",
      });
    });

    it("should return fallback data on API error", async () => {
      const networkKeys = ["ethereum", "polygon"];

      apiClient.get.mockRejectedValueOnce(new Error("Network error"));

      const results = await gasPriceService.fetchMultipleGasPrices(networkKeys);

      expect(results.ethereum).toEqual({
        SafeGasPrice: "15",
        ProposeGasPrice: "18",
        FastGasPrice: "22",
        source: "fallback",
      });
      expect(results.polygon).toEqual({
        SafeGasPrice: "2",
        ProposeGasPrice: "3",
        FastGasPrice: "4",
        source: "fallback",
      });
    });
  });

  describe("static getDisplayGasPrice", () => {
    it("should format gas price for display", () => {
      const gasData = {
        SafeGasPrice: "20",
        ProposeGasPrice: "25",
        FastGasPrice: "30",
      };
      expect(GasPriceService.getDisplayGasPrice(gasData)).toBe("20 gwei");
    });

    it("should return N/A for null data", () => {
      expect(GasPriceService.getDisplayGasPrice(null)).toBe("N/A");
    });

    it("should fallback to ProposeGasPrice if SafeGasPrice is missing", () => {
      const gasData = { ProposeGasPrice: "25", FastGasPrice: "30" };
      expect(GasPriceService.getDisplayGasPrice(gasData)).toBe("25 gwei");
    });
  });

  describe("static getNetworkStatus", () => {
    it("should return online for valid gas data", () => {
      const gasData = { SafeGasPrice: "15" };
      expect(GasPriceService.getNetworkStatus(gasData)).toBe("online");
    });

    it("should return offline for null gas data", () => {
      expect(GasPriceService.getNetworkStatus(null)).toBe("offline");
    });

    it("should return offline for missing SafeGasPrice", () => {
      const gasData = { ProposeGasPrice: "15" };
      expect(GasPriceService.getNetworkStatus(gasData)).toBe("offline");
    });
  });

  describe("static getNetworkInfo", () => {
    it("should return network info for valid chain ID", () => {
      expect(GasPriceService.getNetworkInfo(1)).toEqual({
        name: "Ethereum",
        color: "#627eea",
        chainId: 1,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      });

      expect(GasPriceService.getNetworkInfo(137)).toEqual({
        name: "Polygon",
        color: "#8247e5",
        chainId: 137,
        nativeCurrency: { symbol: "MATIC", decimals: 18 },
      });
    });

    it("should return default info for unknown chain ID", () => {
      expect(GasPriceService.getNetworkInfo(999)).toEqual({
        name: "Unknown",
        color: "#666666",
        chainId: 999,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      });
    });
  });
});
