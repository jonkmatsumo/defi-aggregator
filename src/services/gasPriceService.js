/**
 * Gas Price Service - Frontend Client
 *
 * Fetches gas prices from backend API instead of directly from blockchain RPCs.
 * This eliminates CORS issues and centralizes rate limiting/caching on the server.
 */

import apiClient from "./apiClient";

class GasPriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute local cache (backend has its own cache)
  }

  /**
   * Get supported networks configuration
   * @returns {Object} Network configurations
   */
  static getSupportedNetworks() {
    return {
      ethereum: {
        name: "Ethereum",
        color: "#627eea",
        chainId: 1,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      },
      polygon: {
        name: "Polygon",
        color: "#8247e5",
        chainId: 137,
        nativeCurrency: { symbol: "MATIC", decimals: 18 },
      },
      bsc: {
        name: "BSC",
        color: "#f3ba2f",
        chainId: 56,
        nativeCurrency: { symbol: "BNB", decimals: 18 },
      },
      arbitrum: {
        name: "Arbitrum",
        color: "#ff6b35",
        chainId: 42161,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      },
      optimism: {
        name: "Optimism",
        color: "#ff0420",
        chainId: 10,
        nativeCurrency: { symbol: "ETH", decimals: 18 },
      },
    };
  }

  /**
   * Fallback gas prices for offline/error cases
   * @returns {Object} Fallback gas prices by network
   */
  static getFallbackGasPrices() {
    return {
      ethereum: {
        SafeGasPrice: "15",
        ProposeGasPrice: "18",
        FastGasPrice: "22",
      },
      polygon: { SafeGasPrice: "2", ProposeGasPrice: "3", FastGasPrice: "4" },
      bsc: { SafeGasPrice: "5", ProposeGasPrice: "6", FastGasPrice: "8" },
      arbitrum: {
        SafeGasPrice: "0.5",
        ProposeGasPrice: "0.6",
        FastGasPrice: "0.8",
      },
      optimism: {
        SafeGasPrice: "0.1",
        ProposeGasPrice: "0.15",
        FastGasPrice: "0.2",
      },
    };
  }

  /**
   * Check if local cache is still valid
   * @param {string} networkKey - Network identifier
   * @returns {boolean} True if cache is valid
   */
  isCacheValid(networkKey) {
    const cached = this.cache.get(networkKey);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  /**
   * Get cached data for a network
   * @param {string} networkKey - Network identifier
   * @returns {Object|null} Cached data or null
   */
  getCachedData(networkKey) {
    const cached = this.cache.get(networkKey);
    return cached ? cached.data : null;
  }

  /**
   * Store data in local cache
   * @param {string} networkKey - Network identifier
   * @param {Object} data - Data to cache
   */
  setCachedData(networkKey, data) {
    this.cache.set(networkKey, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Fetch gas prices for a specific network from backend API
   * @param {string} networkKey - Network identifier (ethereum, polygon, etc.)
   * @returns {Promise<Object>} Gas price data
   */
  async fetchGasPrice(networkKey) {
    // Check local cache first
    if (this.isCacheValid(networkKey)) {
      return this.getCachedData(networkKey);
    }

    try {
      const result = await apiClient.get(`/api/gas-prices/${networkKey}`);

      // Transform backend response to match expected format
      const gasData = {
        SafeGasPrice: String(
          result.gasPrices?.slow?.gwei || result.slow?.gwei || "15"
        ),
        ProposeGasPrice: String(
          result.gasPrices?.standard?.gwei || result.standard?.gwei || "18"
        ),
        FastGasPrice: String(
          result.gasPrices?.fast?.gwei || result.fast?.gwei || "22"
        ),
        currentGasPrice: String(
          result.gasPrices?.standard?.gwei || result.standard?.gwei || "18"
        ),
        source: result.source || "backend",
      };

      this.setCachedData(networkKey, gasData);
      return gasData;
    } catch (error) {
      console.warn(
        `Failed to fetch gas price for ${networkKey} from backend:`,
        error.message
      );

      // Return fallback data on error
      const fallbackData = GasPriceService.getFallbackGasPrices()[networkKey];
      if (fallbackData) {
        this.setCachedData(networkKey, { ...fallbackData, source: "fallback" });
        return { ...fallbackData, source: "fallback" };
      }

      throw error;
    }
  }

  /**
   * Fetch gas prices using connected wallet client (delegates to backend)
   * @param {Object} client - Wallet client (ignored, kept for API compatibility)
   * @returns {Promise<Object>} Gas price data
   */
  static async fetchConnectedWalletGasPrice(client) {
    // Get chain ID from client if available, default to ethereum
    const chainId = client?.chain?.id || 1;

    // Map chain ID to network key
    const chainToNetwork = {
      1: "ethereum",
      137: "polygon",
      56: "bsc",
      42161: "arbitrum",
      10: "optimism",
    };

    const networkKey = chainToNetwork[chainId] || "ethereum";

    try {
      const result = await apiClient.get(`/api/gas-prices/${networkKey}`);

      return {
        SafeGasPrice: String(result.gasPrices?.slow?.gwei || "15"),
        ProposeGasPrice: String(result.gasPrices?.standard?.gwei || "18"),
        FastGasPrice: String(result.gasPrices?.fast?.gwei || "22"),
        currentGasPrice: String(result.gasPrices?.standard?.gwei || "18"),
      };
    } catch (error) {
      console.warn("Failed to fetch connected wallet gas price:", error);
      throw error;
    }
  }

  /**
   * Fetch gas prices for multiple networks
   * @param {string[]} networkKeys - Array of network identifiers
   * @returns {Promise<Object>} Gas prices by network
   */
  async fetchMultipleGasPrices(networkKeys) {
    try {
      // Try to fetch from backend in one request
      const result = await apiClient.get("/api/gas-prices", {
        networks: networkKeys.join(","),
      });

      const gasPrices = {};

      // Transform response to expected format
      for (const networkKey of networkKeys) {
        const networkData = result.networks?.[networkKey] || result[networkKey];

        if (networkData) {
          gasPrices[networkKey] = {
            SafeGasPrice: String(
              networkData.gasPrices?.slow?.gwei ||
                networkData.slow?.gwei ||
                "15"
            ),
            ProposeGasPrice: String(
              networkData.gasPrices?.standard?.gwei ||
                networkData.standard?.gwei ||
                "18"
            ),
            FastGasPrice: String(
              networkData.gasPrices?.fast?.gwei ||
                networkData.fast?.gwei ||
                "22"
            ),
            currentGasPrice: String(
              networkData.gasPrices?.standard?.gwei ||
                networkData.standard?.gwei ||
                "18"
            ),
            source: networkData.source || "backend",
          };
          this.setCachedData(networkKey, gasPrices[networkKey]);
        } else {
          // Use fallback for missing networks
          gasPrices[networkKey] = {
            ...GasPriceService.getFallbackGasPrices()[networkKey],
            source: "fallback",
          };
        }
      }

      return gasPrices;
    } catch (error) {
      console.warn(
        "Failed to fetch multiple gas prices, using fallback:",
        error.message
      );

      // Return fallback data for all networks
      const gasPrices = {};
      const fallbackPrices = GasPriceService.getFallbackGasPrices();

      for (const networkKey of networkKeys) {
        gasPrices[networkKey] = {
          ...fallbackPrices[networkKey],
          source: "fallback",
        };
      }

      return gasPrices;
    }
  }

  /**
   * Get display gas price string
   * @param {Object} gasData - Gas price data
   * @returns {string} Formatted gas price
   */
  static getDisplayGasPrice(gasData) {
    if (!gasData) return "N/A";
    const price =
      gasData.SafeGasPrice || gasData.ProposeGasPrice || gasData.FastGasPrice;
    return price ? `${price} gwei` : "N/A";
  }

  /**
   * Get network status based on gas price data
   * @param {Object} gasData - Gas price data
   * @returns {string} Network status ('online' or 'offline')
   */
  static getNetworkStatus(gasData) {
    if (!gasData || !gasData.SafeGasPrice) return "offline";
    return "online";
  }

  /**
   * Get network information by chain ID
   * @param {number} chainId - Chain ID
   * @returns {Object} Network information
   */
  static getNetworkInfo(chainId) {
    const networks = GasPriceService.getSupportedNetworks();
    const network = Object.values(networks).find(
      net => net.chainId === chainId
    );

    if (network) {
      return network;
    }

    return {
      name: "Unknown",
      color: "#666666",
      chainId: chainId,
      nativeCurrency: { symbol: "ETH", decimals: 18 },
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific network
   * @param {string} networkKey - Network identifier
   */
  clearCacheForNetwork(networkKey) {
    this.cache.delete(networkKey);
  }
}

export default GasPriceService;
