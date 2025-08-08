// Gas Price Service for fetching real-time gas prices from multiple networks

class GasPriceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Supported networks configuration
  static getSupportedNetworks() {
    return {
      ethereum: {
        name: 'Ethereum',
        color: '#627eea',
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.REACT_APP_ETHERSCAN_API_KEY || 'demo',
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_ETHERSCAN_API_KEY || 'demo'
        }
      },
      polygon: {
        name: 'Polygon',
        color: '#8247e5',
        apiUrl: 'https://api.polygonscan.com/api',
        apiKey: process.env.REACT_APP_POLYGONSCAN_API_KEY || 'demo',
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_POLYGONSCAN_API_KEY || 'demo'
        }
      },
      arbitrum: {
        name: 'Arbitrum',
        color: '#ff6b35',
        apiUrl: 'https://api.arbiscan.io/api',
        apiKey: process.env.REACT_APP_ARBISCAN_API_KEY || 'demo',
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_ARBISCAN_API_KEY || 'demo'
        }
      },
      bsc: {
        name: 'BSC',
        color: '#f3ba2f',
        apiUrl: 'https://api.bscscan.com/api',
        apiKey: process.env.REACT_APP_BSCSCAN_API_KEY || 'demo',
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_BSCSCAN_API_KEY || 'demo'
        }
      },
      optimism: {
        name: 'Optimism',
        color: '#ff0420',
        apiUrl: 'https://api-optimistic.etherscan.io/api',
        apiKey: process.env.REACT_APP_OPTIMISM_API_KEY || 'demo',
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.REACT_APP_OPTIMISM_API_KEY || 'demo'
        }
      }
    };
  }

  // Fallback gas prices for demo/error cases
  static getFallbackGasPrices() {
    return {
      ethereum: { SafeGasPrice: '15', ProposeGasPrice: '18', FastGasPrice: '22' },
      polygon: { SafeGasPrice: '2', ProposeGasPrice: '3', FastGasPrice: '4' },
      arbitrum: { SafeGasPrice: '0.5', ProposeGasPrice: '0.6', FastGasPrice: '0.8' },
      bsc: { SafeGasPrice: '5', ProposeGasPrice: '6', FastGasPrice: '8' },
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

  // Fetch gas price for a specific network
  async fetchGasPrice(networkKey, networkConfig) {
    // Check cache first
    if (this.isCacheValid(networkKey)) {
      return this.getCachedData(networkKey);
    }

    try {
      // For demo purposes, use fallback data if no API key is provided
      if (networkConfig.apiKey === 'demo') {
        const fallbackData = GasPriceService.getFallbackGasPrices()[networkKey];
        this.setCachedData(networkKey, fallbackData);
        return fallbackData;
      }

      const params = new URLSearchParams(networkConfig.params);
      const response = await fetch(`${networkConfig.apiUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        this.setCachedData(networkKey, data.result);
        return data.result;
      } else {
        throw new Error(data.message || 'Invalid API response');
      }
    } catch (error) {
      console.warn(`Failed to fetch gas price for ${networkKey}:`, error);
      
      // Return fallback data on error
      const fallbackData = GasPriceService.getFallbackGasPrices()[networkKey];
      this.setCachedData(networkKey, fallbackData);
      return fallbackData;
    }
  }

  // Fetch gas prices for multiple networks
  async fetchMultipleGasPrices(networkKeys) {
    const supportedNetworks = GasPriceService.getSupportedNetworks();
    
    const gasPricePromises = networkKeys.map(networkKey => {
      const networkConfig = supportedNetworks[networkKey];
      if (!networkConfig) {
        console.warn(`Unsupported network: ${networkKey}`);
        return Promise.resolve(null);
      }
      return this.fetchGasPrice(networkKey, networkConfig);
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