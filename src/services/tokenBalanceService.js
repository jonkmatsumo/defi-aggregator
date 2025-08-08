// Token Balance Service for fetching real token balances using wagmi and viem

import { formatUnits, parseUnits, getContract, createPublicClient, http } from 'viem';

// ERC-20 ABI for balanceOf and basic token info
const erc20Abi = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  }
];

class TokenBalanceService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    // Common token addresses and metadata for quick lookup
    this.commonTokens = {
      // Ethereum Mainnet
      1: {
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': { // WETH
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          color: '#627eea'
        },
        '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8': { // USDC (placeholder)
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          color: '#2775ca'
        },
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': { // WBTC
          symbol: 'WBTC',
          name: 'Wrapped Bitcoin',
          decimals: 8,
          color: '#f2a900'
        }
      },
      // Polygon
      137: {
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': { // WMATIC
          symbol: 'WMATIC',
          name: 'Wrapped MATIC',
          decimals: 18,
          color: '#8247e5'
        },
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': { // USDC
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          color: '#2775ca'
        }
      },
      // BSC
      56: {
        '0xbb4CdB9CBd36B01bD1cBaEF2aF378a0C60Cb8C8C': { // WBNB
          symbol: 'WBNB',
          name: 'Wrapped BNB',
          decimals: 18,
          color: '#f3ba2f'
        },
        '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': { // USDC
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 18,
          color: '#2775ca'
        }
      }
    };
  }

  // Get token metadata for a given address and chain
  getTokenMetadata(tokenAddress, chainId) {
    const chainTokens = this.commonTokens[chainId];
    if (chainTokens && chainTokens[tokenAddress]) {
      return chainTokens[tokenAddress];
    }
    
    // Fallback metadata for unknown tokens
    return {
      symbol: tokenAddress.slice(0, 6).toUpperCase(),
      name: 'Unknown Token',
      decimals: 18,
      color: '#4a5568'
    };
  }

  // Fetch token metadata from blockchain
  async fetchTokenMetadata(client, tokenAddress) {
    try {
      const contract = getContract({
        address: tokenAddress,
        abi: erc20Abi,
        client
      });

      const [symbol, name, decimals] = await Promise.all([
        contract.read.symbol(),
        contract.read.name(),
        contract.read.decimals()
      ]);

      return {
        symbol: symbol || 'UNKNOWN',
        name: name || 'Unknown Token',
        decimals: decimals || 18,
        color: this.getRandomColor()
      };
    } catch (error) {
      console.warn('Failed to fetch token metadata for', tokenAddress, error);
      return {
        symbol: tokenAddress.slice(0, 6).toUpperCase(),
        name: 'Unknown Token',
        decimals: 18,
        color: this.getRandomColor()
      };
    }
  }

  // Generate random color for unknown tokens
  getRandomColor() {
    const colors = [
      '#627eea', '#8247e5', '#f3ba2f', '#2775ca', '#f2a900',
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Fetch native token balance (ETH, MATIC, BNB, etc.)
  async fetchNativeBalance(client, address) {
    try {
      console.log('TokenBalanceService - Fetching native balance for address:', address?.slice(0, 10) + '...');
      
      // Check if client has the getBalance method
      if (!client || typeof client.getBalance !== 'function') {
        console.warn('TokenBalanceService - Client does not have getBalance method, returning null');
        return null;
      }
      
      const balance = await client.getBalance({ address });
      const chainId = client.chain?.id || 1;
      
      console.log('TokenBalanceService - Native balance:', balance.toString(), 'for chain:', chainId);
      
      // If balance is 0, return null (don't show empty balances)
      if (balance === 0n) {
        console.log('TokenBalanceService - Native balance is 0, returning null');
        return null;
      }
      
      let symbol, name, color;
      switch (chainId) {
        case 1: // Ethereum
          symbol = 'ETH';
          name = 'Ether';
          color = '#627eea';
          break;
        case 137: // Polygon
          symbol = 'MATIC';
          name = 'MATIC';
          color = '#8247e5';
          break;
        case 56: // BSC
          symbol = 'BNB';
          name = 'BNB';
          color = '#f3ba2f';
          break;
        default:
          symbol = 'NATIVE';
          name = 'Native Token';
          color = '#4a5568';
      }

      const formattedBalance = formatUnits(balance, 18);
      console.log('TokenBalanceService - Formatted native balance:', formattedBalance, symbol);

      return {
        symbol,
        name,
        balance: formattedBalance,
        value: TokenBalanceService.calculateUSDValue(formattedBalance, symbol),
        color,
        address: 'native',
        decimals: 18,
        isMock: false
      };
    } catch (error) {
      console.error('Error fetching native balance:', error);
      return null;
    }
  }

  // Fetch ERC-20 token balance
  async fetchTokenBalance(client, tokenAddress, userAddress) {
    try {
      console.log('TokenBalanceService - Fetching ERC-20 balance for token:', tokenAddress, 'user:', userAddress?.slice(0, 10) + '...');
      
      const contract = getContract({
        address: tokenAddress,
        abi: erc20Abi,
        client
      });

      // Fetch balance
      const balance = await contract.read.balanceOf([userAddress]);
      
      // If balance is 0, return null (don't show empty balances)
      if (balance === 0n) {
        console.log('TokenBalanceService - ERC-20 balance is 0, returning null');
        return null;
      }

      // Fetch metadata
      const metadata = await this.fetchTokenMetadata(client, tokenAddress);
      
      const formattedBalance = formatUnits(balance, metadata.decimals);
      const result = {
        symbol: metadata.symbol,
        name: metadata.name,
        balance: formattedBalance,
        value: TokenBalanceService.calculateUSDValue(formattedBalance, metadata.symbol),
        color: metadata.color,
        address: tokenAddress,
        decimals: metadata.decimals,
        isMock: false
      };

      console.log('TokenBalanceService - ERC-20 balance result:', result);
      return result;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return null;
    }
  }

  // Fetch all token balances for a user
  async fetchAllTokenBalances(client, userAddress, maxAssets = 3) {
    try {
      console.log('TokenBalanceService - Fetching all token balances for:', userAddress?.slice(0, 10) + '...', 'maxAssets:', maxAssets);
      const balances = [];
      
      // Fetch native token balance
      const nativeBalance = await this.fetchNativeBalance(client, userAddress);
      if (nativeBalance) {
        balances.push(nativeBalance);
        console.log('TokenBalanceService - Added native balance:', nativeBalance);
      }

      // For now, we'll fetch balances for common tokens on the current chain
      // In a real implementation, you might want to:
      // 1. Use a token list API to get all tokens on the chain
      // 2. Use an indexer like The Graph to get user's token holdings
      // 3. Use a service like Covalent or Moralis to get comprehensive token data
      
      const chainId = client?.chain?.id || 1;
      const chainTokens = this.commonTokens[chainId];
      
      if (chainTokens) {
        console.log('TokenBalanceService - Fetching common tokens for chain:', chainId);
        for (const [tokenAddress, metadata] of Object.entries(chainTokens)) {
          const tokenBalance = await this.fetchTokenBalance(client, tokenAddress, userAddress);
          if (tokenBalance) {
            balances.push(tokenBalance);
            console.log('TokenBalanceService - Added token balance:', tokenBalance);
          }
        }
      }

      // Sort by balance (descending) and take top X
      const sortedBalances = balances
        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
        .slice(0, maxAssets);

      console.log('TokenBalanceService - Final sorted balances:', sortedBalances);
      return sortedBalances;
    } catch (error) {
      console.error('Error fetching all token balances:', error);
      return []; // Return empty array instead of fallback data
    }
  }

  // Get fallback data for testing/offline mode (only used when not connected)
  static getFallbackAssets() {
    return [
      { symbol: 'ETH', name: 'Ether', balance: '2.45', value: '$4,900', color: '#627eea', decimals: 18, isMock: true },
      { symbol: 'USDC', name: 'USD Coin', balance: '1,250', value: '$1,250', color: '#2775ca', decimals: 6, isMock: true },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: '0.156', value: '$6,555', color: '#f2a900', decimals: 8, isMock: true }
    ];
  }

  // Format balance for display
  static formatBalance(balance, decimals = 18) {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString();
  }

  // Calculate USD value (mock implementation)
  static calculateUSDValue(balance, symbol) {
    // Mock prices - in real app, you'd fetch from price API
    const prices = {
      'ETH': 2000,
      'WETH': 2000,
      'USDC': 1,
      'WBTC': 42000,
      'MATIC': 1.5,
      'WMATIC': 1.5,
      'BNB': 300,
      'WBNB': 300
    };
    
    const price = prices[symbol] || 0;
    const value = parseFloat(balance) * price;
    return value > 0 ? `$${value.toLocaleString()}` : '$0';
  }
}

export default TokenBalanceService; 