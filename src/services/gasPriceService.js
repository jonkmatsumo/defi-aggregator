// Viem Gas Price Service for fetching real-time gas prices using viem and wagmi

import { createPublicClient, http, formatGwei } from 'viem';
import { mainnet, polygon, bsc, arbitrum, optimism } from 'viem/chains';

class GasPriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 1800000; // 30 minutes (increased from 10 minutes)
    this.retryDelays = new Map(); // Track retry delays for exponential backoff
    
    // Create public clients for each supported network
    this.clients = {
      ethereum: createPublicClient({
        chain: mainnet,
        transport: http('https://eth-mainnet.g.alchemy.com/v2/demo')
      }),
      polygon: createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com')
      }),
      bsc: createPublicClient({
        chain: bsc,
        transport: http('https://bsc-dataseed.binance.org')
      }),
      arbitrum: createPublicClient({
        chain: arbitrum,
        transport: http('https://arb1.arbitrum.io/rpc')
      }),
      optimism: createPublicClient({
        chain: optimism,
        transport: http('https://mainnet.optimism.io')
      })
    };
  }

  // Supported networks configuration
  static getSupportedNetworks() {
    return {
      ethereum: {
        name: 'Ethereum',
        color: '#627eea',
        chainId: 1,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      polygon: {
        name: 'Polygon',
        color: '#8247e5',
        chainId: 137,
        nativeCurrency: { symbol: 'MATIC', decimals: 18 }
      },
      bsc: {
        name: 'BSC',
        color: '#f3ba2f',
        chainId: 56,
        nativeCurrency: { symbol: 'BNB', decimals: 18 }
      },
      arbitrum: {
        name: 'Arbitrum',
        color: '#ff6b35',
        chainId: 42161,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      },
      optimism: {
        name: 'Optimism',
        color: '#ff0420',
        chainId: 10,
        nativeCurrency: { symbol: 'ETH', decimals: 18 }
      }
    };
  }

  // Fallback gas prices for demo/error cases
  static getFallbackGasPrices() {
    return {
      ethereum: { SafeGasPrice: '15', ProposeGasPrice: '18', FastGasPrice: '22' },
      polygon: { SafeGasPrice: '2', ProposeGasPrice: '3', FastGasPrice: '4' },
      bsc: { SafeGasPrice: '5', ProposeGasPrice: '6', FastGasPrice: '8' },
      arbitrum: { SafeGasPrice: '0.5', ProposeGasPrice: '0.6', FastGasPrice: '0.8' },
      optimism: { SafeGasPrice: '0.1', ProposeGasPrice: '0.15', FastGasPrice: '0.2' }
    };
  }

  // Check if cached data is still valid
  isCacheValid(networkKey) {
    const cached = this.cache.get(networkKey);
    if (!cached) return false;
    
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  // Get cached data
  getCachedData(networkKey) {
    const cached = this.cache.get(networkKey);
    return cached ? cached.data : null;
  }

  // Set cached data
  setCachedData(networkKey, data) {
    this.cache.set(networkKey, {
      data,
      timestamp: Date.now()
    });
  }

  // Exponential backoff delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get retry delay for a network (exponential backoff)
  getRetryDelay(networkKey) {
    const currentDelay = this.retryDelays.get(networkKey) || 10000; // Start with 10 seconds
    const maxDelay = 600000; // Max 10 minutes
    const nextDelay = Math.min(currentDelay * 2, maxDelay);
    this.retryDelays.set(networkKey, nextDelay);
    return currentDelay;
  }

  // Reset retry delay on successful request
  resetRetryDelay(networkKey) {
    this.retryDelays.delete(networkKey);
  }

  // Fetch gas price for a specific network using viem with exponential backoff
  async fetchGasPrice(networkKey) {
    // Check cache first
    if (this.isCacheValid(networkKey)) {
      return this.getCachedData(networkKey);
    }

    const client = this.clients[networkKey];
    if (!client) {
      throw new Error(`No client available for ${networkKey}`);
    }

    // Check if we should wait due to rate limiting
    const retryDelay = this.getRetryDelay(networkKey);
    if (retryDelay > 5000) { // Wait if delay is more than 5 seconds
      console.log(`Rate limited for ${networkKey}, waiting ${retryDelay}ms before retry`);
      await this.delay(retryDelay);
    }

    try {
      // Get current gas price
      const gasPrice = await client.getGasPrice();
      const gasPriceGwei = formatGwei(gasPrice);

      // Get fee history for more detailed gas price estimation
      const feeHistory = await client.getFeeHistory({
        blockCount: 4,
        rewardPercentiles: [25, 75]
      });

      // Calculate gas price estimates
      const recentFees = feeHistory.reward;
      const sortedFees = recentFees.flat().sort((a, b) => Number(a) - Number(b));
      
      const safeGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.25)]);
      const proposeGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.5)]);
      const fastGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.75)]);

      const gasData = {
        SafeGasPrice: safeGasPrice,
        ProposeGasPrice: proposeGasPrice,
        FastGasPrice: fastGasPrice,
        currentGasPrice: gasPriceGwei
      };

      this.setCachedData(networkKey, gasData);
      this.resetRetryDelay(networkKey); // Reset delay on success
      return gasData;

    } catch (error) {
      console.warn(`Failed to fetch gas price for ${networkKey}:`, error);
      
      // Check if it's a rate limit error (429)
      if (error.message && (error.message.includes('429') || error.message.includes('rate limit'))) {
        console.warn(`Rate limited for ${networkKey}, will retry with exponential backoff`);
        // Don't cache rate limit errors, let them retry
        throw error;
      }
      
      // Return fallback data on other errors
      const fallbackData = GasPriceService.getFallbackGasPrices()[networkKey];
      this.setCachedData(networkKey, fallbackData);
      return fallbackData;
    }
  }

  // Fetch gas price using wagmi's useGasPrice hook (for connected wallet)
  static async fetchConnectedWalletGasPrice(client) {
    if (!client) {
      throw new Error('No client available');
    }

    // Check if client has the required methods
    if (typeof client.getGasPrice !== 'function') {
      throw new Error('Client does not have getGasPrice method');
    }

    if (typeof client.getFeeHistory !== 'function') {
      throw new Error('Client does not have getFeeHistory method');
    }

    try {
      // Get current gas price from the connected network
      const gasPrice = await client.getGasPrice();
      const gasPriceGwei = formatGwei(gasPrice);

      // Get fee history for more detailed gas price estimation
      const feeHistory = await client.getFeeHistory({
        blockCount: 4,
        rewardPercentiles: [25, 75]
      });

      // Calculate gas price estimates
      const recentFees = feeHistory.reward;
      const sortedFees = recentFees.flat().sort((a, b) => Number(a) - Number(b));
      
      const safeGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.25)]);
      const proposeGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.5)]);
      const fastGasPrice = formatGwei(sortedFees[Math.floor(sortedFees.length * 0.75)]);

      return {
        SafeGasPrice: safeGasPrice,
        ProposeGasPrice: proposeGasPrice,
        FastGasPrice: fastGasPrice,
        currentGasPrice: gasPriceGwei
      };

    } catch (error) {
      console.warn('Failed to fetch connected wallet gas price:', error);
      throw error;
    }
  }

  // Fetch gas prices for multiple networks with retry logic
  async fetchMultipleGasPrices(networkKeys) {
    const gasPricePromises = networkKeys.map(async (networkKey) => {
      try {
        return await this.fetchGasPrice(networkKey);
      } catch (error) {
        // If it's a rate limit error, return fallback data
        if (error.message && error.message.includes('429')) {
          console.warn(`Rate limited for ${networkKey}, using fallback data`);
          return GasPriceService.getFallbackGasPrices()[networkKey];
        }
        throw error;
      }
    });

    const results = await Promise.allSettled(gasPricePromises);
    
    const gasPrices = {};
    networkKeys.forEach((networkKey, index) => {
      if (results[index].status === 'fulfilled' && results[index].value) {
        gasPrices[networkKey] = results[index].value;
      } else {
        // Use fallback if API call failed
        gasPrices[networkKey] = GasPriceService.getFallbackGasPrices()[networkKey];
      }
    });

    return gasPrices;
  }

  // Get display gas price (use SafeGasPrice as default)
  static getDisplayGasPrice(gasData) {
    if (!gasData) return 'N/A';
    
    // Prefer SafeGasPrice, fallback to ProposeGasPrice, then FastGasPrice
    const price = gasData.SafeGasPrice || gasData.ProposeGasPrice || gasData.FastGasPrice;
    return price ? `${price} gwei` : 'N/A';
  }

  // Get network status based on gas price availability
  static getNetworkStatus(gasData) {
    if (!gasData || !gasData.SafeGasPrice) return 'offline';
    return 'online';
  }

  // Get network information using wagmi hooks (to be used in components)
  static getNetworkInfo(chainId) {
    const networks = GasPriceService.getSupportedNetworks();
    
    // Find network by chainId
    const network = Object.values(networks).find(net => net.chainId === chainId);
    
    if (network) {
      return network;
    }
    
    // Return default network info
    return {
      name: 'Unknown',
      color: '#666666',
      chainId: chainId,
      nativeCurrency: { symbol: 'ETH', decimals: 18 }
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    this.retryDelays.clear(); // Also clear retry delays
  }

  // Clear cache for specific network
  clearCacheForNetwork(networkKey) {
    this.cache.delete(networkKey);
    this.retryDelays.delete(networkKey);
  }
}

export default GasPriceService; 