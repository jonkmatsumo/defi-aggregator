// Lending Service for Compound and Aave integration
class LendingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.compoundApiBase = 'https://api.compound.finance/api/v2';
    this.aaveApiBase = 'https://api.aave.com/v1';
  }

  // Cache management
  getCacheKey(key) {
    return key;
  }

  getCachedData(key) {
    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data) {
    const cacheKey = this.getCacheKey(key);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // Compound API methods
  async fetchCompoundTokens() {
    const cached = this.getCachedData('compound_tokens');
    if (cached) return cached;

    try {
      const response = await fetch(`${this.compoundApiBase}/ctoken`);
      if (!response.ok) {
        throw new Error(`Compound API error: ${response.status}`);
      }
      
      const data = await response.json();
      const tokens = data.cToken || [];
      
      const formattedTokens = tokens.map(token => ({
        symbol: token.symbol,
        name: token.name,
        address: token.token_address,
        cTokenAddress: token.cToken_address,
        decimals: token.decimals,
        platform: 'Compound',
        logo: this.getTokenLogo(token.symbol),
        supplyRate: parseFloat(token.supply_rate?.value || 0),
        borrowRate: parseFloat(token.borrow_rate?.value || 0),
        totalSupply: parseFloat(token.total_supply?.value || 0),
        totalBorrow: parseFloat(token.total_borrow?.value || 0),
        exchangeRate: parseFloat(token.exchange_rate?.value || 0)
      }));

      this.setCachedData('compound_tokens', formattedTokens);
      return formattedTokens;
    } catch (error) {
      console.error('Error fetching Compound tokens:', error);
      return this.getFallbackCompoundTokens();
    }
  }

  async fetchCompoundMarkets() {
    const cached = this.getCachedData('compound_markets');
    if (cached) return cached;

    try {
      const response = await fetch(`${this.compoundApiBase}/market`);
      if (!response.ok) {
        throw new Error(`Compound API error: ${response.status}`);
      }
      
      const data = await response.json();
      const markets = data.markets || [];
      
      this.setCachedData('compound_markets', markets);
      return markets;
    } catch (error) {
      console.error('Error fetching Compound markets:', error);
      return [];
    }
  }

  // Aave API methods
  async fetchAaveReserves() {
    const cached = this.getCachedData('aave_reserves');
    if (cached) return cached;

    try {
      const response = await fetch(`${this.aaveApiBase}/reserves`);
      if (!response.ok) {
        throw new Error(`Aave API error: ${response.status}`);
      }
      
      const data = await response.json();
      const reserves = data || [];
      
      const formattedReserves = reserves.map(reserve => ({
        symbol: reserve.symbol,
        name: reserve.name,
        address: reserve.reserveAddress,
        decimals: reserve.decimals,
        platform: 'Aave',
        logo: this.getTokenLogo(reserve.symbol),
        supplyRate: parseFloat(reserve.liquidityRate || 0),
        borrowRate: parseFloat(reserve.variableBorrowRate || 0),
        totalSupply: parseFloat(reserve.totalLiquidity || 0),
        totalBorrow: parseFloat(reserve.totalVariableDebt || 0),
        utilizationRate: parseFloat(reserve.utilizationRate || 0),
        availableLiquidity: parseFloat(reserve.availableLiquidity || 0)
      }));

      this.setCachedData('aave_reserves', formattedReserves);
      return formattedReserves;
    } catch (error) {
      console.error('Error fetching Aave reserves:', error);
      return this.getFallbackAaveReserves();
    }
  }

  // Combined methods
  async fetchAllLendingAssets() {
    try {
      const [compoundTokens, aaveReserves] = await Promise.all([
        this.fetchCompoundTokens(),
        this.fetchAaveReserves()
      ]);

      return {
        compound: compoundTokens,
        aave: aaveReserves,
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
      // For demo purposes, we'll return mock data
      // In a real implementation, you would fetch actual balances from Compound and Aave
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

  // Supply and withdraw methods (mock implementations)
  async supplyTokens(platform, tokenAddress, amount, userAddress, client) {
    try {
      console.log(`Supplying ${amount} of token ${tokenAddress} to ${platform}`);
      
      // In a real implementation, you would:
      // 1. Approve the lending protocol to spend your tokens
      // 2. Call the supply/deposit function
      // 3. Wait for transaction confirmation
      
      // Mock successful transaction
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        platform,
        tokenAddress,
        amount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error supplying tokens:', error);
      throw error;
    }
  }

  async withdrawTokens(platform, tokenAddress, amount, userAddress, client) {
    try {
      console.log(`Withdrawing ${amount} of token ${tokenAddress} from ${platform}`);
      
      // In a real implementation, you would:
      // 1. Call the withdraw function
      // 2. Wait for transaction confirmation
      
      // Mock successful transaction
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        platform,
        tokenAddress,
        amount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error withdrawing tokens:', error);
      throw error;
    }
  }

  async borrowTokens(platform, tokenAddress, amount, userAddress, client) {
    try {
      console.log(`Borrowing ${amount} of token ${tokenAddress} from ${platform}`);
      
      // In a real implementation, you would:
      // 1. Check user's borrowing capacity
      // 2. Call the borrow function
      // 3. Wait for transaction confirmation
      
      // Mock successful transaction
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        platform,
        tokenAddress,
        amount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error borrowing tokens:', error);
      throw error;
    }
  }

  async repayTokens(platform, tokenAddress, amount, userAddress, client) {
    try {
      console.log(`Repaying ${amount} of token ${tokenAddress} to ${platform}`);
      
      // In a real implementation, you would:
      // 1. Approve the lending protocol to spend your tokens
      // 2. Call the repay function
      // 3. Wait for transaction confirmation
      
      // Mock successful transaction
      return {
        success: true,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        platform,
        tokenAddress,
        amount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error repaying tokens:', error);
      throw error;
    }
  }

  // Utility methods
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

  formatAPY(rate) {
    return (rate * 100).toFixed(2);
  }

  formatBalance(balance, decimals = 18) {
    return parseFloat(balance).toFixed(4);
  }

  // Fallback data methods
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
        address: '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C',
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
        address: '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C',
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

  // Static methods for utility functions
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

  static getPlatforms() {
    return [
      { id: 'compound', name: 'Compound', logo: '🏦' },
      { id: 'aave', name: 'Aave', logo: '🦇' }
    ];
  }
}

export default LendingService; 