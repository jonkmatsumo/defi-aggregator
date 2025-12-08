/**
 * Lending Service - Frontend Client
 * 
 * Fetches DeFi lending rates from backend API instead of directly from Aave/Compound APIs.
 * This eliminates CORS issues and centralizes rate limiting/caching on the server.
 */

import apiClient from './apiClient';

class LendingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute local cache
  }

  /**
   * Cache management - get cache key
   * @param {string} key - Cache key
   * @returns {string} Cache key
   */
  getCacheKey(key) {
    return key;
  }

  /**
   * Get cached data if still valid
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null
   */
  getCachedData(key) {
    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Store data in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCachedData(key, data) {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetch Compound tokens/markets from backend
   * @returns {Promise<Array>} Compound tokens
   */
  async fetchCompoundTokens() {
    const cached = this.getCachedData('compound_tokens');
    if (cached) return cached;

    try {
      const result = await apiClient.get('/api/lending-rates', {
        protocols: 'compound'
      });

      // Transform backend response to match expected format
      const tokens = this.transformProtocolData(result, 'Compound');
      this.setCachedData('compound_tokens', tokens);
      return tokens;

    } catch (error) {
      console.error('Error fetching Compound tokens:', error);
      return this.getFallbackCompoundTokens();
    }
  }

  /**
   * Fetch Compound markets from backend
   * @returns {Promise<Array>} Compound markets
   */
  async fetchCompoundMarkets() {
    const cached = this.getCachedData('compound_markets');
    if (cached) return cached;

    try {
      const result = await apiClient.get('/api/lending-rates', {
        protocols: 'compound'
      });

      const markets = result.protocols?.compound || result.compound || [];
      this.setCachedData('compound_markets', markets);
      return markets;

    } catch (error) {
      console.error('Error fetching Compound markets:', error);
      return [];
    }
  }

  /**
   * Fetch Aave reserves from backend
   * @returns {Promise<Array>} Aave reserves
   */
  async fetchAaveReserves() {
    const cached = this.getCachedData('aave_reserves');
    if (cached) return cached;

    try {
      const result = await apiClient.get('/api/lending-rates', {
        protocols: 'aave'
      });

      // Transform backend response to match expected format
      const reserves = this.transformProtocolData(result, 'Aave');
      this.setCachedData('aave_reserves', reserves);
      return reserves;

    } catch (error) {
      console.error('Error fetching Aave reserves:', error);
      return this.getFallbackAaveReserves();
    }
  }

  /**
   * Transform backend protocol data to frontend format
   * @param {Object} result - Backend response
   * @param {string} platform - Platform name
   * @returns {Array} Transformed token data
   */
  transformProtocolData(result, platform) {
    const protocolKey = platform.toLowerCase();
    const protocolData = result.protocols?.[protocolKey] || result[protocolKey] || result.data || [];
    
    if (!Array.isArray(protocolData)) {
      // Handle single token response
      if (result.token && result.protocols) {
        return result.protocols.map(p => ({
          symbol: p.symbol || result.token,
          name: this.getTokenName(p.symbol || result.token),
          address: p.address || '',
          decimals: p.decimals || 18,
          platform: platform,
          logo: this.getTokenLogo(p.symbol || result.token),
          supplyRate: p.supplyAPY || 0,
          borrowRate: p.borrowAPY || 0,
          totalSupply: p.totalSupply || 0,
          totalBorrow: p.totalBorrow || 0,
          utilizationRate: p.utilizationRate || 0
        }));
      }
      return [];
    }

    return protocolData.map(token => ({
      symbol: token.symbol,
      name: token.name || this.getTokenName(token.symbol),
      address: token.address || '',
      decimals: token.decimals || 18,
      platform: platform,
      logo: this.getTokenLogo(token.symbol),
      supplyRate: token.supplyAPY || token.supplyRate || 0,
      borrowRate: token.borrowAPY || token.borrowRate || 0,
      totalSupply: token.totalSupply || 0,
      totalBorrow: token.totalBorrow || 0,
      utilizationRate: token.utilizationRate || 0,
      availableLiquidity: token.availableLiquidity || 0
    }));
  }

  /**
   * Get token name from symbol
   * @param {string} symbol - Token symbol
   * @returns {string} Token name
   */
  getTokenName(symbol) {
    const names = {
      'ETH': 'Ethereum',
      'DAI': 'Dai Stablecoin',
      'USDC': 'USD Coin',
      'USDT': 'Tether USD',
      'WBTC': 'Wrapped Bitcoin',
      'UNI': 'Uniswap',
      'LINK': 'Chainlink',
      'AAVE': 'Aave',
      'COMP': 'Compound'
    };
    return names[symbol] || symbol;
  }

  /**
   * Fetch all lending assets from both protocols
   * @returns {Promise<Object>} Combined lending data
   */
  async fetchAllLendingAssets() {
    try {
      // Fetch from backend's all-rates endpoint
      const result = await apiClient.get('/api/lending-rates');
      
      const compoundTokens = this.transformProtocolData({ compound: result.compound }, 'Compound');
      const aaveReserves = this.transformProtocolData({ aave: result.aave }, 'Aave');

      return {
        compound: compoundTokens.length > 0 ? compoundTokens : this.getFallbackCompoundTokens(),
        aave: aaveReserves.length > 0 ? aaveReserves : this.getFallbackAaveReserves(),
        all: [...compoundTokens, ...aaveReserves]
      };

    } catch (error) {
      console.error('Error fetching lending assets:', error);
      return {
        compound: this.getFallbackCompoundTokens(),
        aave: this.getFallbackAaveReserves(),
        all: [...this.getFallbackCompoundTokens(), ...this.getFallbackAaveReserves()]
      };
    }
  }

  /**
   * Fetch lending rates for a specific token
   * @param {string} token - Token symbol
   * @param {string[]} protocols - Protocols to query
   * @returns {Promise<Object>} Token lending rates
   */
  async fetchTokenLendingRates(token, protocols = ['aave', 'compound']) {
    try {
      const result = await apiClient.get(`/api/lending-rates/${token}`, {
        protocols: protocols.join(',')
      });

      return result;

    } catch (error) {
      console.error(`Error fetching lending rates for ${token}:`, error);
      throw error;
    }
  }

  /**
   * Fetch user balances (mock implementation - real data from wallet)
   * @param {string} userAddress - User wallet address
   * @param {Object} client - Wallet client (for future wallet integration)
   * @returns {Promise<Object>} User balance data
   */
  async fetchUserBalances(userAddress, client) {
    if (!userAddress || !client) {
      return {
        compound: [],
        aave: [],
        totalSupplied: 0,
        totalBorrowed: 0
      };
    }

    try {
      // For now, return mock data as actual user positions
      // require on-chain reading which should still happen client-side
      // or through a dedicated indexer service
      const mockBalances = {
        compound: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            supplied: 2.5,
            borrowed: 0,
            supplyValue: 5000,
            borrowValue: 0,
            platform: 'Compound'
          },
          {
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            supplied: 1000,
            borrowed: 500,
            supplyValue: 1000,
            borrowValue: 500,
            platform: 'Compound'
          }
        ],
        aave: [
          {
            symbol: 'USDC',
            name: 'USD Coin',
            supplied: 2000,
            borrowed: 0,
            supplyValue: 2000,
            borrowValue: 0,
            platform: 'Aave'
          }
        ],
        totalSupplied: 8000,
        totalBorrowed: 500
      };

      return mockBalances;
    } catch (error) {
      console.error('Error fetching user balances:', error);
      return {
        compound: [],
        aave: [],
        totalSupplied: 0,
        totalBorrowed: 0
      };
    }
  }

  /**
   * Supply tokens to a lending protocol (mock - requires wallet transaction)
   * @param {string} platform - Platform name
   * @param {string} tokenAddress - Token contract address
   * @param {number} amount - Amount to supply
   * @param {string} userAddress - User wallet address
   * @param {Object} client - Wallet client
   * @returns {Promise<Object>} Transaction result
   */
  async supplyTokens(platform, tokenAddress, amount, userAddress, client) {
    console.log(`Supplying ${amount} of token ${tokenAddress} to ${platform}`);
    
    // This would need actual wallet transaction signing
    // which happens client-side, not through backend
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      platform,
      tokenAddress,
      amount,
      timestamp: new Date()
    };
  }

  /**
   * Withdraw tokens from a lending protocol (mock - requires wallet transaction)
   */
  async withdrawTokens(platform, tokenAddress, amount, userAddress, client) {
    console.log(`Withdrawing ${amount} of token ${tokenAddress} from ${platform}`);
    
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      platform,
      tokenAddress,
      amount,
      timestamp: new Date()
    };
  }

  /**
   * Borrow tokens from a lending protocol (mock - requires wallet transaction)
   */
  async borrowTokens(platform, tokenAddress, amount, userAddress, client) {
    console.log(`Borrowing ${amount} of token ${tokenAddress} from ${platform}`);
    
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      platform,
      tokenAddress,
      amount,
      timestamp: new Date()
    };
  }

  /**
   * Repay borrowed tokens (mock - requires wallet transaction)
   */
  async repayTokens(platform, tokenAddress, amount, userAddress, client) {
    console.log(`Repaying ${amount} of token ${tokenAddress} to ${platform}`);
    
    return {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      platform,
      tokenAddress,
      amount,
      timestamp: new Date()
    };
  }

  /**
   * Get token logo emoji
   * @param {string} symbol - Token symbol
   * @returns {string} Emoji logo
   */
  getTokenLogo(symbol) {
    const logos = {
      'ETH': '🔷',
      'DAI': '🟡',
      'USDC': '💙',
      'USDT': '💚',
      'WBTC': '🟠',
      'UNI': '🟣',
      'LINK': '🔵',
      'AAVE': '🔴',
      'COMP': '🟢'
    };
    return logos[symbol] || '💰';
  }

  /**
   * Format APY for display
   * @param {number} rate - Rate as decimal
   * @returns {string} Formatted percentage
   */
  formatAPY(rate) {
    return (rate * 100).toFixed(2);
  }

  /**
   * Format balance for display
   * @param {number} balance - Balance value
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted balance
   */
  formatBalance(balance, decimals = 18) {
    return parseFloat(balance).toFixed(4);
  }

  /**
   * Get fallback Compound tokens
   * @returns {Array} Fallback token data
   */
  getFallbackCompoundTokens() {
    return [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEe',
        cTokenAddress: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
        decimals: 18,
        platform: 'Compound',
        logo: '🔷',
        supplyRate: 0.025,
        borrowRate: 0.045,
        totalSupply: 1000000,
        totalBorrow: 500000,
        exchangeRate: 1.02
      },
      {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        cTokenAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
        decimals: 18,
        platform: 'Compound',
        logo: '🟡',
        supplyRate: 0.035,
        borrowRate: 0.055,
        totalSupply: 5000000,
        totalBorrow: 2000000,
        exchangeRate: 1.01
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        cTokenAddress: '0x39AA39c021dfbaE8faC545936693aC917d5E7563',
        decimals: 6,
        platform: 'Compound',
        logo: '💙',
        supplyRate: 0.03,
        borrowRate: 0.05,
        totalSupply: 3000000,
        totalBorrow: 1500000,
        exchangeRate: 1.005
      }
    ];
  }

  /**
   * Get fallback Aave reserves
   * @returns {Array} Fallback reserve data
   */
  getFallbackAaveReserves() {
    return [
      {
        symbol: 'ETH',
        name: 'Ethereum',
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEe',
        decimals: 18,
        platform: 'Aave',
        logo: '🔷',
        supplyRate: 0.028,
        borrowRate: 0.048,
        totalSupply: 1200000,
        totalBorrow: 600000,
        utilizationRate: 0.5,
        availableLiquidity: 600000
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        platform: 'Aave',
        logo: '💙',
        supplyRate: 0.032,
        borrowRate: 0.052,
        totalSupply: 4000000,
        totalBorrow: 2000000,
        utilizationRate: 0.5,
        availableLiquidity: 2000000
      },
      {
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        platform: 'Aave',
        logo: '🟡',
        supplyRate: 0.038,
        borrowRate: 0.058,
        totalSupply: 6000000,
        totalBorrow: 3000000,
        utilizationRate: 0.5,
        availableLiquidity: 3000000
      }
    ];
  }

  /**
   * Get supported tokens
   * @returns {Array} Supported token list
   */
  static getSupportedTokens() {
    return [
      { symbol: 'ETH', name: 'Ethereum', logo: '🔷' },
      { symbol: 'DAI', name: 'Dai Stablecoin', logo: '🟡' },
      { symbol: 'USDC', name: 'USD Coin', logo: '💙' },
      { symbol: 'USDT', name: 'Tether USD', logo: '💚' },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', logo: '🟠' },
      { symbol: 'UNI', name: 'Uniswap', logo: '🟣' },
      { symbol: 'LINK', name: 'Chainlink', logo: '🔵' },
      { symbol: 'AAVE', name: 'Aave', logo: '🔴' },
      { symbol: 'COMP', name: 'Compound', logo: '🟢' }
    ];
  }

  /**
   * Get supported platforms
   * @returns {Array} Supported platform list
   */
  static getPlatforms() {
    return [
      { id: 'compound', name: 'Compound', logo: '🏦' },
      { id: 'aave', name: 'Aave', logo: '🦇' }
    ];
  }
}

export default LendingService;
