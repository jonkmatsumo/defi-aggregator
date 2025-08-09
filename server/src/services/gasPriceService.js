const axios = require('axios');
const logger = require('../middleware/logger');

class GasPriceService {
  constructor() {
    this.etherscanApiKey = process.env.ETHERSCAN_API_KEY;
  }

  async getGasPrices(network = 'all') {
    try {
      let gasPrices;
      
      if (network === 'ethereum') {
        gasPrices = await this.getEthereumGasPrices();
      } else if (network === 'arbitrum') {
        gasPrices = await this.getArbitrumGasPrices();
      } else if (network === 'all') {
        gasPrices = await this.getAllGasPrices();
      } else {
        throw new Error(`Unsupported network: ${network}`);
      }
      
      return gasPrices;
    } catch (error) {
      logger.error('Error fetching gas prices:', error);
      throw error;
    }
  }

  async getEthereumGasPrices() {
    const response = await axios.get(
      `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${this.etherscanApiKey}`
    );

    if (response.data.status !== '1') {
      throw new Error('Failed to fetch Ethereum gas prices');
    }

    const { SafeGasPrice, ProposeGasPrice, FastGasPrice } = response.data.result;

    return {
      network: 'ethereum',
      slow: parseInt(SafeGasPrice),
      standard: parseInt(ProposeGasPrice),
      fast: parseInt(FastGasPrice),
      timestamp: new Date().toISOString()
    };
  }

  async getArbitrumGasPrices() {
    const response = await axios.post('https://arb1.arbitrum.io/rpc', {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const gasPriceWei = parseInt(response.data.result, 16);
    const gasPriceGwei = gasPriceWei / 1e9;

    return {
      network: 'arbitrum',
      slow: Math.round(gasPriceGwei * 0.8),
      standard: Math.round(gasPriceGwei),
      fast: Math.round(gasPriceGwei * 1.2),
      timestamp: new Date().toISOString()
    };
  }

  async getAllGasPrices() {
    const [ethereum, arbitrum] = await Promise.all([
      this.getEthereumGasPrices(),
      this.getArbitrumGasPrices()
    ]);

    return {
      ethereum,
      arbitrum,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new GasPriceService(); 