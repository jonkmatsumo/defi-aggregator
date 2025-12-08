import { jest } from '@jest/globals';
import { AgentResponseFormatter, agentResponseFormatter } from '../../src/utils/agentResponseFormatter.js';

describe('AgentResponseFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new AgentResponseFormatter();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      expect(formatter.options.includeTimestamps).toBe(true);
      expect(formatter.options.includeSource).toBe(true);
      expect(formatter.options.currency).toBe('USD');
    });

    it('should accept custom options', () => {
      const customFormatter = new AgentResponseFormatter({
        includeTimestamps: false,
        currency: 'EUR'
      });
      
      expect(customFormatter.options.includeTimestamps).toBe(false);
      expect(customFormatter.options.currency).toBe('EUR');
    });
  });

  describe('formatToolResults', () => {
    it('should return null for empty or undefined results', () => {
      expect(formatter.formatToolResults(null)).toBeNull();
      expect(formatter.formatToolResults(undefined)).toBeNull();
      expect(formatter.formatToolResults([])).toBeNull();
    });

    it('should format successful tool results', () => {
      const toolResults = [{
        toolName: 'get_gas_prices',
        success: true,
        result: {
          network: 'ethereum',
          gasPrices: {
            slow: { gwei: 10, usd_cost: 0.30 },
            standard: { gwei: 15, usd_cost: 0.45 },
            fast: { gwei: 20, usd_cost: 0.60 }
          },
          timestamp: Date.now()
        }
      }];

      const formatted = formatter.formatToolResults(toolResults);

      expect(formatted).toHaveProperty('results');
      expect(formatted.results).toHaveLength(1);
      expect(formatted.hasErrors).toBe(false);
      expect(formatted.errors).toBeUndefined();
    });

    it('should include errors for failed tool results', () => {
      const toolResults = [{
        toolName: 'get_crypto_price',
        success: false,
        error: 'Rate limit exceeded'
      }];

      const formatted = formatter.formatToolResults(toolResults);

      expect(formatted.hasErrors).toBe(true);
      expect(formatted.errors).toHaveLength(1);
      expect(formatted.errors[0].code).toBe('RATE_LIMIT');
      expect(formatted.errors[0].retryable).toBe(true);
    });

    it('should handle mixed success and failure results', () => {
      const toolResults = [
        {
          toolName: 'get_gas_prices',
          success: true,
          result: {
            network: 'ethereum',
            gasPrices: {
              slow: { gwei: 10 },
              standard: { gwei: 15 },
              fast: { gwei: 20 }
            }
          }
        },
        {
          toolName: 'get_crypto_price',
          success: false,
          error: 'Service unavailable'
        }
      ];

      const formatted = formatter.formatToolResults(toolResults);

      expect(formatted.results).toHaveLength(1);
      expect(formatted.errors).toHaveLength(1);
      expect(formatted.hasErrors).toBe(true);
    });
  });

  describe('formatGasPrices', () => {
    it('should format gas price data correctly', () => {
      const data = {
        network: 'ethereum',
        gasPrices: {
          slow: { gwei: 10, usd_cost: 0.30 },
          standard: { gwei: 15, usd_cost: 0.45 },
          fast: { gwei: 20, usd_cost: 0.60 }
        },
        timestamp: Date.now()
      };

      const formatted = formatter.formatGasPrices(data);

      expect(formatted.type).toBe('gas_prices');
      expect(formatted.network).toBe('Ethereum');
      expect(formatted.prices.slow.gwei).toBe(10);
      expect(formatted.prices.standard.gwei).toBe(15);
      expect(formatted.prices.fast.gwei).toBe(20);
      expect(formatted.recommendation).toBeDefined();
    });

    it('should provide gas recommendations based on price level', () => {
      const lowGas = {
        network: 'ethereum',
        gasPrices: { standard: { gwei: 15 } }
      };
      expect(formatter.formatGasPrices(lowGas).recommendation).toContain('🟢');

      const moderateGas = {
        network: 'ethereum',
        gasPrices: { standard: { gwei: 40 } }
      };
      expect(formatter.formatGasPrices(moderateGas).recommendation).toContain('🟡');

      const highGas = {
        network: 'ethereum',
        gasPrices: { standard: { gwei: 80 } }
      };
      expect(formatter.formatGasPrices(highGas).recommendation).toContain('🟠');

      const veryHighGas = {
        network: 'ethereum',
        gasPrices: { standard: { gwei: 150 } }
      };
      expect(formatter.formatGasPrices(veryHighGas).recommendation).toContain('🔴');
    });
  });

  describe('formatCryptoPrice', () => {
    it('should format crypto price data correctly', () => {
      const data = {
        symbol: 'BTC',
        price: 42000,
        currency: 'USD',
        change_24h: 2.5,
        volume_24h: 15000000000,
        market_cap: 820000000000,
        timestamp: Date.now()
      };

      const formatted = formatter.formatCryptoPrice(data);

      expect(formatted.type).toBe('crypto_price');
      expect(formatted.symbol).toBe('BTC');
      expect(formatted.priceRaw).toBe(42000);
      expect(formatted.change24h.value).toBe(2.5);
      expect(formatted.change24h.direction).toBe('up');
      expect(formatted.change24h.emoji).toBe('📈');
    });

    it('should handle negative price changes', () => {
      const data = {
        symbol: 'ETH',
        price: 2000,
        currency: 'USD',
        change_24h: -5.5
      };

      const formatted = formatter.formatCryptoPrice(data);

      expect(formatted.change24h.direction).toBe('down');
      expect(formatted.change24h.emoji).toBe('📉');
    });
  });

  describe('formatLendingRates', () => {
    it('should format lending rates data correctly', () => {
      const data = {
        token: 'USDC',
        protocols: [
          {
            protocol: 'aave',
            supplyAPY: 0.032,
            borrowAPY: 0.052,
            totalSupply: 4000000,
            totalBorrow: 2000000,
            utilizationRate: 0.5
          },
          {
            protocol: 'compound',
            supplyAPY: 0.030,
            borrowAPY: 0.050
          }
        ],
        timestamp: Date.now()
      };

      const formatted = formatter.formatLendingRates(data);

      expect(formatted.type).toBe('lending_rates');
      expect(formatted.token).toBe('USDC');
      expect(formatted.protocols).toHaveLength(2);
      expect(formatted.recommendation.bestForSupply.protocol).toBe('Aave');
      expect(formatted.recommendation.bestForBorrow.protocol).toBe('Compound');
    });
  });

  describe('formatTokenBalance', () => {
    it('should format token balance data correctly', () => {
      const data = {
        address: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
        tokens: [
          { symbol: 'ETH', name: 'Ether', balance: '1.5', balanceUSD: '$3000', decimals: 18 },
          { symbol: 'USDC', name: 'USD Coin', balance: '1000', balanceUSD: '$1000', decimals: 6 }
        ],
        totalUSD: '4000'
      };

      const formatted = formatter.formatTokenBalance(data);

      expect(formatted.type).toBe('token_balance');
      expect(formatted.address).toBe('0x1234...7890');
      expect(formatted.network).toBe('Ethereum');
      expect(formatted.tokenCount).toBe(2);
    });
  });

  describe('formatError', () => {
    it('should format rate limit errors', () => {
      const result = { toolName: 'get_gas_prices', error: 'Rate limit exceeded' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('RATE_LIMIT');
      expect(formatted.retryable).toBe(true);
    });

    it('should format timeout errors', () => {
      const result = { toolName: 'get_crypto_price', error: 'Request timed out' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('TIMEOUT');
      expect(formatted.retryable).toBe(true);
    });

    it('should format network errors', () => {
      const result = { toolName: 'get_lending_rates', error: 'Network connection failed' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('NETWORK_ERROR');
      expect(formatted.retryable).toBe(true);
    });

    it('should format not found errors', () => {
      const result = { toolName: 'get_token_balance', error: 'Resource not found' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('NOT_FOUND');
      expect(formatted.retryable).toBe(false);
    });

    it('should format validation errors', () => {
      const result = { toolName: 'get_token_balance', error: 'Invalid address format' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('VALIDATION_ERROR');
      expect(formatted.retryable).toBe(false);
    });

    it('should format service unavailable errors', () => {
      const result = { toolName: 'get_gas_prices', error: 'Service unavailable' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('SERVICE_UNAVAILABLE');
      expect(formatted.retryable).toBe(true);
    });

    it('should format unknown errors with default handling', () => {
      const result = { toolName: 'get_gas_prices', error: 'Something unexpected happened' };
      const formatted = formatter.formatError(result);

      expect(formatted.code).toBe('UNKNOWN_ERROR');
      expect(formatted.retryable).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    describe('formatNetworkName', () => {
      it('should format network names correctly', () => {
        expect(formatter.formatNetworkName('ethereum')).toBe('Ethereum');
        expect(formatter.formatNetworkName('polygon')).toBe('Polygon');
        expect(formatter.formatNetworkName('bsc')).toBe('BNB Smart Chain');
        expect(formatter.formatNetworkName('arbitrum')).toBe('Arbitrum');
        expect(formatter.formatNetworkName('optimism')).toBe('Optimism');
        expect(formatter.formatNetworkName('unknown')).toBe('unknown');
      });
    });

    describe('formatCurrency', () => {
      it('should format currency values', () => {
        expect(formatter.formatCurrency(1000)).toBe('$1,000.00');
        // Small values get more decimal places
        const smallValue = formatter.formatCurrency(0.005);
        expect(smallValue).toMatch(/^\$0\.00/);
        expect(formatter.formatCurrency(null)).toBe('N/A');
        expect(formatter.formatCurrency(undefined)).toBe('N/A');
      });
    });

    describe('formatPercentage', () => {
      it('should format percentage values', () => {
        expect(formatter.formatPercentage(5.5)).toBe('+5.50%');
        expect(formatter.formatPercentage(-3.2)).toBe('-3.20%');
        expect(formatter.formatPercentage(0)).toBe('+0.00%');
        expect(formatter.formatPercentage(null)).toBe('N/A');
      });
    });

    describe('formatLargeNumber', () => {
      it('should format large numbers', () => {
        expect(formatter.formatLargeNumber(1500000000000)).toBe('$1.50T');
        expect(formatter.formatLargeNumber(820000000000)).toBe('$820.00B');
        expect(formatter.formatLargeNumber(15000000)).toBe('$15.00M');
        expect(formatter.formatLargeNumber(5000)).toBe('$5.00K');
        expect(formatter.formatLargeNumber(500)).toBe('$500.00');
      });
    });

    describe('formatAddress', () => {
      it('should truncate wallet addresses', () => {
        const address = '0x1234567890123456789012345678901234567890';
        expect(formatter.formatAddress(address)).toBe('0x1234...7890');
      });

      it('should handle short addresses', () => {
        expect(formatter.formatAddress('0x1234')).toBe('0x1234');
        expect(formatter.formatAddress(null)).toBe(null);
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(agentResponseFormatter).toBeInstanceOf(AgentResponseFormatter);
    });
  });
});

