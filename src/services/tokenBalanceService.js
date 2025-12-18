/**
 * Token Balance Service - Frontend Client
 *
 * Fetches token balances from backend API instead of directly from blockchain RPCs.
 * This eliminates CORS issues and centralizes RPC access on the server.
 *
 * Note: Some operations (like wallet transactions) still require client-side
 * wallet connections for security reasons.
 */

import apiClient from "./apiClient";

class TokenBalanceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds

    // Common token metadata for UI display
    this.commonTokens = {
      // Ethereum Mainnet
      1: {
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": {
          symbol: "WETH",
          name: "Wrapped Ether",
          decimals: 18,
          color: "#627eea",
        },
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": {
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          color: "#2775ca",
        },
        "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": {
          symbol: "WBTC",
          name: "Wrapped Bitcoin",
          decimals: 8,
          color: "#f2a900",
        },
      },
      // Polygon
      137: {
        "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270": {
          symbol: "WMATIC",
          name: "Wrapped MATIC",
          decimals: 18,
          color: "#8247e5",
        },
        "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": {
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          color: "#2775ca",
        },
      },
      // BSC
      56: {
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": {
          symbol: "WBNB",
          name: "Wrapped BNB",
          decimals: 18,
          color: "#f3ba2f",
        },
        "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": {
          symbol: "USDC",
          name: "USD Coin",
          decimals: 18,
          color: "#2775ca",
        },
      },
    };
  }

  /**
   * Check if cache is valid
   * @param {string} cacheKey - Cache key
   * @returns {boolean} True if valid
   */
  isCacheValid(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  /**
   * Get cached data
   * @param {string} cacheKey - Cache key
   * @returns {any|null} Cached data or null
   */
  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    return cached ? cached.data : null;
  }

  /**
   * Set cached data
   * @param {string} cacheKey - Cache key
   * @param {any} data - Data to cache
   */
  setCachedData(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get token metadata
   * @param {string} tokenAddress - Token address
   * @param {number} chainId - Chain ID
   * @returns {Object} Token metadata
   */
  getTokenMetadata(tokenAddress, chainId) {
    const chainTokens = this.commonTokens[chainId];
    if (chainTokens && chainTokens[tokenAddress]) {
      return chainTokens[tokenAddress];
    }

    return {
      symbol: tokenAddress.slice(0, 6).toUpperCase(),
      name: "Unknown Token",
      decimals: 18,
      color: "#4a5568",
    };
  }

  /**
   * Fetch token metadata from backend
   * @param {Object} client - Wallet client (for chain info)
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Object>} Token metadata
   */
  async fetchTokenMetadata(client, tokenAddress) {
    const chainId = client?.chain?.id || 1;
    const networkMap = {
      1: "ethereum",
      137: "polygon",
      56: "bsc",
      42161: "arbitrum",
      10: "optimism",
    };
    const network = networkMap[chainId] || "ethereum";

    try {
      const cacheKey = `metadata_${network}_${tokenAddress}`;
      if (this.isCacheValid(cacheKey)) {
        return this.getCachedData(cacheKey);
      }

      // For now, return local metadata - backend could be extended to provide this
      const metadata = this.getTokenMetadata(tokenAddress, chainId);
      this.setCachedData(cacheKey, metadata);
      return metadata;
    } catch (error) {
      console.warn("Failed to fetch token metadata:", error);
      return this.getTokenMetadata(tokenAddress, chainId);
    }
  }

  /**
   * Generate random color for unknown tokens
   * @returns {string} Hex color
   */
  getRandomColor() {
    const colors = [
      "#627eea",
      "#8247e5",
      "#f3ba2f",
      "#2775ca",
      "#f2a900",
      "#ff6b6b",
      "#4ecdc4",
      "#45b7d1",
      "#96ceb4",
      "#feca57",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Fetch native token balance from backend
   * @param {Object} client - Wallet client
   * @param {string} address - Wallet address
   * @returns {Promise<Object|null>} Balance data or null
   */
  async fetchNativeBalance(client, address) {
    if (!client || !address) {
      console.warn("TokenBalanceService - Missing required parameters");
      return null;
    }

    const chainId = client?.chain?.id || 1;
    const networkMap = {
      1: "ethereum",
      137: "polygon",
      56: "bsc",
      42161: "arbitrum",
      10: "optimism",
    };
    const network = networkMap[chainId] || "ethereum";

    const cacheKey = `native_${network}_${address}`;
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const result = await apiClient.get(`/api/balances/${address}`, {
        network,
        includeUSDValues: "true",
      });

      // Find native token in response
      const nativeToken =
        result.tokens?.find(
          t => t.symbol === "ETH" || t.symbol === "MATIC" || t.symbol === "BNB"
        ) || result.nativeBalance;

      if (!nativeToken || parseFloat(nativeToken.balance) === 0) {
        return null;
      }

      const balanceData = {
        symbol: nativeToken.symbol,
        name: nativeToken.name || this.getNativeTokenName(chainId),
        balance: nativeToken.balance,
        value:
          nativeToken.balanceUSD ||
          TokenBalanceService.calculateUSDValue(
            nativeToken.balance,
            nativeToken.symbol
          ),
        color: this.getNativeTokenColor(chainId),
        address: "native",
        decimals: 18,
        isMock: false,
      };

      this.setCachedData(cacheKey, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching native balance:", error);
      return null;
    }
  }

  /**
   * Get native token name by chain ID
   * @param {number} chainId - Chain ID
   * @returns {string} Token name
   */
  getNativeTokenName(chainId) {
    const names = {
      1: "Ether",
      137: "MATIC",
      56: "BNB",
      42161: "Ether",
      10: "Ether",
    };
    return names[chainId] || "Native Token";
  }

  /**
   * Get native token color by chain ID
   * @param {number} chainId - Chain ID
   * @returns {string} Hex color
   */
  getNativeTokenColor(chainId) {
    const colors = {
      1: "#627eea",
      137: "#8247e5",
      56: "#f3ba2f",
      42161: "#ff6b35",
      10: "#ff0420",
    };
    return colors[chainId] || "#4a5568";
  }

  /**
   * Fetch ERC-20 token balance from backend
   * @param {Object} client - Wallet client
   * @param {string} tokenAddress - Token contract address
   * @param {string} userAddress - User wallet address
   * @returns {Promise<Object|null>} Balance data or null
   */
  async fetchTokenBalance(client, tokenAddress, userAddress) {
    if (!client || !tokenAddress || !userAddress) {
      console.warn("TokenBalanceService - Missing required parameters");
      return null;
    }

    const chainId = client?.chain?.id || 1;
    const networkMap = {
      1: "ethereum",
      137: "polygon",
      56: "bsc",
      42161: "arbitrum",
      10: "optimism",
    };
    const network = networkMap[chainId] || "ethereum";

    const cacheKey = `token_${network}_${tokenAddress}_${userAddress}`;
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const result = await apiClient.get(`/api/balances/${userAddress}`, {
        network,
        tokenAddress,
        includeUSDValues: "true",
      });

      if (!result || !result.balance || parseFloat(result.balance) === 0) {
        return null;
      }

      const metadata = this.getTokenMetadata(tokenAddress, chainId);

      const balanceData = {
        symbol: result.symbol || metadata.symbol,
        name: result.name || metadata.name,
        balance: result.balance,
        value:
          result.balanceUSD ||
          TokenBalanceService.calculateUSDValue(result.balance, result.symbol),
        color: metadata.color,
        address: tokenAddress,
        decimals: result.decimals || metadata.decimals,
        isMock: false,
      };

      this.setCachedData(cacheKey, balanceData);
      return balanceData;
    } catch (error) {
      console.error("Error fetching token balance:", error);
      return null;
    }
  }

  /**
   * Fetch all token balances for a user from backend
   * @param {Object} client - Wallet client
   * @param {string} userAddress - User wallet address
   * @param {number} maxAssets - Maximum assets to return
   * @returns {Promise<Array>} Array of balance data
   */
  async fetchAllTokenBalances(client, userAddress, maxAssets = 3) {
    if (!client || !userAddress) {
      console.warn("TokenBalanceService - Missing required parameters");
      return [];
    }

    const chainId = client?.chain?.id || 1;
    const networkMap = {
      1: "ethereum",
      137: "polygon",
      56: "bsc",
      42161: "arbitrum",
      10: "optimism",
    };
    const network = networkMap[chainId] || "ethereum";

    const cacheKey = `all_${network}_${userAddress}`;
    if (this.isCacheValid(cacheKey)) {
      return this.getCachedData(cacheKey);
    }

    try {
      const result = await apiClient.get(`/api/balances/${userAddress}`, {
        network,
        includeUSDValues: "true",
      });

      const balances = [];

      // Process tokens from response
      if (result.tokens && Array.isArray(result.tokens)) {
        for (const token of result.tokens) {
          if (parseFloat(token.balance) > 0) {
            balances.push({
              symbol: token.symbol,
              name: token.name,
              balance: token.balance,
              value:
                token.balanceUSD ||
                TokenBalanceService.calculateUSDValue(
                  token.balance,
                  token.symbol
                ),
              color: this.getTokenColor(token.symbol, chainId),
              address: token.address || "native",
              decimals: token.decimals || 18,
              isMock: false,
            });
          }
        }
      }

      // Sort by value and limit
      const sortedBalances = balances
        .sort((a, b) => {
          const aValue = parseFloat(a.value?.replace(/[$,]/g, "") || "0");
          const bValue = parseFloat(b.value?.replace(/[$,]/g, "") || "0");
          return bValue - aValue;
        })
        .slice(0, maxAssets);

      this.setCachedData(cacheKey, sortedBalances);
      return sortedBalances;
    } catch (error) {
      console.error("Error fetching all token balances:", error);
      return [];
    }
  }

  /**
   * Get token color by symbol and chain
   * @param {string} symbol - Token symbol
   * @param {number} chainId - Chain ID
   * @returns {string} Hex color
   */
  getTokenColor(symbol, chainId) {
    const colors = {
      ETH: "#627eea",
      WETH: "#627eea",
      MATIC: "#8247e5",
      WMATIC: "#8247e5",
      BNB: "#f3ba2f",
      WBNB: "#f3ba2f",
      USDC: "#2775ca",
      USDT: "#26a17b",
      DAI: "#f5ac37",
      WBTC: "#f2a900",
    };
    return colors[symbol] || this.getRandomColor();
  }

  /**
   * Fetch portfolio value across multiple networks
   * @param {string} userAddress - User wallet address
   * @param {string[]} networks - Networks to query
   * @returns {Promise<Object>} Portfolio data
   */
  async fetchPortfolioValue(userAddress, networks = ["ethereum"]) {
    if (!userAddress) {
      console.warn("TokenBalanceService - Missing user address");
      return { totalUSD: "$0", networks: {} };
    }

    try {
      const result = await apiClient.get(`/api/portfolio/${userAddress}`, {
        networks: networks.join(","),
      });

      return result;
    } catch (error) {
      console.error("Error fetching portfolio value:", error);
      return { totalUSD: "$0", networks: {} };
    }
  }

  /**
   * Get fallback assets for display
   * @returns {Array} Fallback asset data
   */
  static getFallbackAssets() {
    return [
      {
        symbol: "ETH",
        name: "Ether",
        balance: "2.45",
        value: "$4,900",
        color: "#627eea",
        decimals: 18,
        isMock: true,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        balance: "1,250",
        value: "$1,250",
        color: "#2775ca",
        decimals: 6,
        isMock: true,
      },
      {
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        balance: "0.156",
        value: "$6,555",
        color: "#f2a900",
        decimals: 8,
        isMock: true,
      },
    ];
  }

  /**
   * Format balance for display
   * @param {string|number} balance - Balance value
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted balance
   */
  static formatBalance(balance, decimals = 18) {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString();
  }

  /**
   * Calculate USD value from balance and symbol
   * @param {string|number} balance - Balance value
   * @param {string} symbol - Token symbol
   * @returns {string} Formatted USD value
   */
  static calculateUSDValue(balance, symbol) {
    // These are fallback prices - backend provides real prices
    const prices = {
      ETH: 2000,
      WETH: 2000,
      USDC: 1,
      USDT: 1,
      DAI: 1,
      WBTC: 42000,
      MATIC: 1.5,
      WMATIC: 1.5,
      BNB: 300,
      WBNB: 300,
    };

    const price = prices[symbol] || 0;
    const value = parseFloat(balance) * price;
    return value > 0 ? `$${value.toLocaleString()}` : "$0";
  }
}

export default TokenBalanceService;
