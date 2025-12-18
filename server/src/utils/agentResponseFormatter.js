/**
 * AgentResponseFormatter
 *
 * Formats AI agent tool results and errors into user-friendly responses.
 * Provides consistent formatting for DeFi data presentation.
 */
export class AgentResponseFormatter {
  constructor(options = {}) {
    this.options = {
      includeTimestamps: options.includeTimestamps !== false,
      includeSource: options.includeSource !== false,
      currency: options.currency || 'USD',
      ...options,
    };
  }

  /**
   * Format tool results into user-friendly response data
   * @param {Array} toolResults - Array of tool execution results
   * @returns {Object} Formatted response data
   */
  formatToolResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return null;
    }

    const formattedResults = [];
    const errors = [];

    for (const result of toolResults) {
      if (result.success) {
        const formatted = this.formatSingleResult(result);
        if (formatted) {
          formattedResults.push(formatted);
        }
      } else {
        errors.push(this.formatError(result));
      }
    }

    return {
      results: formattedResults,
      errors: errors.length > 0 ? errors : undefined,
      hasErrors: errors.length > 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Format a single tool result based on tool type
   * @param {Object} result - Tool execution result
   * @returns {Object} Formatted result
   */
  formatSingleResult(result) {
    const { toolName, result: data } = result;

    switch (toolName) {
      case 'get_gas_prices':
        return this.formatGasPrices(data);
      case 'get_crypto_price':
        return this.formatCryptoPrice(data);
      case 'get_lending_rates':
        return this.formatLendingRates(data);
      case 'get_token_balance':
        return this.formatTokenBalance(data);
      default:
        return {
          type: 'generic',
          toolName,
          data,
          timestamp: Date.now(),
        };
    }
  }

  /**
   * Format gas prices data
   * @param {Object} data - Gas price data from service
   * @returns {Object} Formatted gas price response
   */
  formatGasPrices(data) {
    const { network, gasPrices, timestamp } = data;

    return {
      type: 'gas_prices',
      network: this.formatNetworkName(network),
      prices: {
        slow: {
          gwei: gasPrices?.slow?.gwei,
          usdCost: this.formatCurrency(gasPrices?.slow?.usd_cost),
          label: '🐢 Slow (~5 min)',
        },
        standard: {
          gwei: gasPrices?.standard?.gwei,
          usdCost: this.formatCurrency(gasPrices?.standard?.usd_cost),
          label: '⚡ Standard (~3 min)',
        },
        fast: {
          gwei: gasPrices?.fast?.gwei,
          usdCost: this.formatCurrency(gasPrices?.fast?.usd_cost),
          label: '🚀 Fast (~1 min)',
        },
      },
      recommendation: this.getGasRecommendation(gasPrices),
      timestamp: this.options.includeTimestamps ? timestamp : undefined,
    };
  }

  /**
   * Format cryptocurrency price data
   * @param {Object} data - Crypto price data from service
   * @returns {Object} Formatted crypto price response
   */
  formatCryptoPrice(data) {
    const {
      symbol,
      price,
      currency,
      change_24h,
      volume_24h,
      market_cap,
      timestamp,
    } = data;

    return {
      type: 'crypto_price',
      symbol: symbol?.toUpperCase(),
      price: this.formatCurrency(price, currency),
      priceRaw: price,
      change24h: {
        value: change_24h,
        formatted: this.formatPercentage(change_24h),
        direction: change_24h >= 0 ? 'up' : 'down',
        emoji: change_24h >= 0 ? '📈' : '📉',
      },
      volume24h: this.formatLargeNumber(volume_24h),
      marketCap: this.formatLargeNumber(market_cap),
      timestamp: this.options.includeTimestamps ? timestamp : undefined,
    };
  }

  /**
   * Format lending rates data
   * @param {Object} data - Lending rates data from service
   * @returns {Object} Formatted lending rates response
   */
  formatLendingRates(data) {
    const { token, protocols, timestamp } = data;

    const formattedProtocols = protocols?.map(p => ({
      protocol: this.formatProtocolName(p.protocol),
      supplyAPY: {
        value: p.supplyAPY,
        formatted: this.formatPercentage(p.supplyAPY * 100),
      },
      borrowAPY: {
        value: p.borrowAPY,
        formatted: this.formatPercentage(p.borrowAPY * 100),
      },
      utilizationRate: p.utilizationRate
        ? this.formatPercentage(p.utilizationRate * 100)
        : undefined,
      totalSupply: this.formatLargeNumber(p.totalSupply),
      totalBorrow: this.formatLargeNumber(p.totalBorrow),
    }));

    // Find best rates
    const bestSupply = this.findBestSupplyRate(protocols);
    const bestBorrow = this.findBestBorrowRate(protocols);

    return {
      type: 'lending_rates',
      token: token?.toUpperCase(),
      protocols: formattedProtocols,
      recommendation: {
        bestForSupply: bestSupply
          ? {
              protocol: this.formatProtocolName(bestSupply.protocol),
              apy: this.formatPercentage(bestSupply.supplyAPY * 100),
            }
          : null,
        bestForBorrow: bestBorrow
          ? {
              protocol: this.formatProtocolName(bestBorrow.protocol),
              apy: this.formatPercentage(bestBorrow.borrowAPY * 100),
            }
          : null,
      },
      timestamp: this.options.includeTimestamps ? timestamp : undefined,
    };
  }

  /**
   * Format token balance data
   * @param {Object} data - Token balance data from service
   * @returns {Object} Formatted token balance response
   */
  formatTokenBalance(data) {
    const { address, network, tokens, totalUSD, timestamp } = data;

    const formattedTokens = tokens?.map(t => ({
      symbol: t.symbol,
      name: t.name,
      balance: this.formatTokenAmount(t.balance, t.decimals),
      balanceUSD:
        t.balanceUSD ||
        this.formatCurrency(parseFloat(t.balance) * (t.priceUSD || 0)),
      percentage: totalUSD
        ? this.formatPercentage(
            (parseFloat(t.balanceUSD?.replace(/[$,]/g, '') || 0) /
              parseFloat(totalUSD)) *
              100
          )
        : undefined,
    }));

    return {
      type: 'token_balance',
      address: this.formatAddress(address),
      network: this.formatNetworkName(network),
      tokens: formattedTokens,
      totalValue: this.formatCurrency(parseFloat(totalUSD || 0)),
      tokenCount: tokens?.length || 0,
      timestamp: this.options.includeTimestamps ? timestamp : undefined,
    };
  }

  /**
   * Format error for user-friendly display
   * @param {Object} result - Failed tool execution result
   * @returns {Object} Formatted error
   */
  formatError(result) {
    const { toolName, error } = result;

    // Map error messages to user-friendly messages
    const userFriendlyError = this.getUserFriendlyError(error, toolName);

    return {
      toolName,
      error: userFriendlyError.message,
      code: userFriendlyError.code,
      suggestion: userFriendlyError.suggestion,
      retryable: userFriendlyError.retryable,
    };
  }

  /**
   * Get user-friendly error message
   * @param {string} error - Original error message
   * @param {string} toolName - Tool that failed
   * @returns {Object} User-friendly error details
   */
  getUserFriendlyError(error, toolName) {
    const errorLower = error?.toLowerCase() || '';

    if (errorLower.includes('rate limit') || errorLower.includes('429')) {
      return {
        message: 'Service is temporarily busy. Please try again in a moment.',
        code: 'RATE_LIMIT',
        suggestion: 'Wait a few seconds and try again.',
        retryable: true,
      };
    }

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return {
        message: 'Request took too long to complete.',
        code: 'TIMEOUT',
        suggestion: 'The service might be slow. Try again later.',
        retryable: true,
      };
    }

    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return {
        message: 'Unable to connect to the service.',
        code: 'NETWORK_ERROR',
        suggestion: 'Check your internet connection and try again.',
        retryable: true,
      };
    }

    if (errorLower.includes('not found') || errorLower.includes('404')) {
      return {
        message: 'The requested data could not be found.',
        code: 'NOT_FOUND',
        suggestion: 'Verify the parameters and try again.',
        retryable: false,
      };
    }

    if (errorLower.includes('invalid') || errorLower.includes('validation')) {
      return {
        message: 'Invalid request parameters.',
        code: 'VALIDATION_ERROR',
        suggestion: 'Please check your input and try again.',
        retryable: false,
      };
    }

    if (errorLower.includes('service') && errorLower.includes('unavailable')) {
      return {
        message: `The ${this.getToolDisplayName(toolName)} service is currently unavailable.`,
        code: 'SERVICE_UNAVAILABLE',
        suggestion: 'Please try again later.',
        retryable: true,
      };
    }

    // Default error
    return {
      message: `Unable to retrieve ${this.getToolDisplayName(toolName)} data.`,
      code: 'UNKNOWN_ERROR',
      suggestion: 'Please try again or contact support if the issue persists.',
      retryable: true,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get display name for a tool
   * @param {string} toolName - Internal tool name
   * @returns {string} Display name
   */
  getToolDisplayName(toolName) {
    const displayNames = {
      get_gas_prices: 'gas price',
      get_crypto_price: 'cryptocurrency price',
      get_lending_rates: 'lending rate',
      get_token_balance: 'token balance',
    };
    return displayNames[toolName] || toolName;
  }

  /**
   * Format network name for display
   * @param {string} network - Network identifier
   * @returns {string} Formatted network name
   */
  formatNetworkName(network) {
    const names = {
      ethereum: 'Ethereum',
      polygon: 'Polygon',
      bsc: 'BNB Smart Chain',
      arbitrum: 'Arbitrum',
      optimism: 'Optimism',
    };
    return names[network?.toLowerCase()] || network;
  }

  /**
   * Format protocol name for display
   * @param {string} protocol - Protocol identifier
   * @returns {string} Formatted protocol name
   */
  formatProtocolName(protocol) {
    const names = {
      aave: 'Aave',
      compound: 'Compound',
    };
    return names[protocol?.toLowerCase()] || protocol;
  }

  /**
   * Format currency value
   * @param {number} value - Numeric value
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency string
   */
  formatCurrency(value, currency = 'USD') {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 6 : 2,
    });

    return formatter.format(value);
  }

  /**
   * Format percentage value
   * @param {number} value - Percentage value
   * @returns {string} Formatted percentage string
   */
  formatPercentage(value) {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }

    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  /**
   * Format large numbers (billions, millions, etc.)
   * @param {number} value - Numeric value
   * @returns {string} Formatted large number
   */
  formatLargeNumber(value) {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }

    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

  /**
   * Format token amount
   * @param {string|number} balance - Token balance
   * @param {number} decimals - Token decimals
   * @returns {string} Formatted balance
   */
  formatTokenAmount(balance) {
    const value = parseFloat(balance);
    if (isNaN(value)) return 'N/A';

    if (value === 0) return '0';
    if (value < 0.001) return '<0.001';
    if (value < 1) return value.toFixed(6);
    if (value < 1000) return value.toFixed(4);
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * Format wallet address
   * @param {string} address - Full wallet address
   * @returns {string} Truncated address
   */
  formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get gas recommendation based on current prices
   * @param {Object} gasPrices - Gas price data
   * @returns {string} Recommendation text
   */
  getGasRecommendation(gasPrices) {
    if (!gasPrices?.standard?.gwei) return null;

    const standardGwei = gasPrices.standard.gwei;

    if (standardGwei < 20) {
      return '🟢 Gas prices are low - good time for transactions!';
    }
    if (standardGwei < 50) {
      return '🟡 Gas prices are moderate - normal activity level.';
    }
    if (standardGwei < 100) {
      return '🟠 Gas prices are elevated - consider waiting if not urgent.';
    }
    return '🔴 Gas prices are high - recommend waiting for lower prices.';
  }

  /**
   * Find best supply rate among protocols
   * @param {Array} protocols - Protocol data
   * @returns {Object|null} Best protocol for supply
   */
  findBestSupplyRate(protocols) {
    if (!protocols || protocols.length === 0) return null;
    return protocols.reduce(
      (best, current) =>
        !best || current.supplyAPY > best.supplyAPY ? current : best,
      null
    );
  }

  /**
   * Find best borrow rate among protocols
   * @param {Array} protocols - Protocol data
   * @returns {Object|null} Best protocol for borrowing
   */
  findBestBorrowRate(protocols) {
    if (!protocols || protocols.length === 0) return null;
    return protocols.reduce(
      (best, current) =>
        !best || current.borrowAPY < best.borrowAPY ? current : best,
      null
    );
  }
}

// Export singleton instance
export const agentResponseFormatter = new AgentResponseFormatter();

export default AgentResponseFormatter;
