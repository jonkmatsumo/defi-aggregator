// Viem Gas Price Service for fetching real-time gas prices using viem and wagmi

import { createPublicClient, http, formatGwei } from 'viem';
import { mainnet, polygon, bsc, arbitrum, optimism } from 'viem/chains';

class GasPriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
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

  // Fetch gas price for a specific network using viem
  async fetchGasPrice(networkKey) {
    // Check cache first
    if (this.isCacheValid(networkKey)) {
      return this.getCachedData(networkKey);
    }

    try {
      const client = this.clients[networkKey];
      if (!client) {
        throw new Error(`No client available for ${networkKey}`);
      }

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
      return gasData;

    } catch (error) {
      console.warn(`Failed to fetch gas price for ${networkKey}:`, error);
      
             // Return fallback data on error
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

  // Fetch gas prices for multiple networks
  async fetchMultipleGasPrices(networkKeys) {
    const gasPricePromises = networkKeys.map(networkKey => {
      return this.fetchGasPrice(networkKey);
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
  }

  // Clear cache for specific network
  clearCacheForNetwork(networkKey) {
    this.cache.delete(networkKey);
  }
}

export default GasPriceService; 