const DEFAULT_NETWORKS = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism'];
const DEFAULT_PROTOCOLS = ['aave', 'compound', 'maker', 'uniswap', 'curve'];

export class EntityExtractor {
  constructor(options = {}) {
    this.networks = options.networks || DEFAULT_NETWORKS;
    this.protocols = options.protocols || DEFAULT_PROTOCOLS;
  }

  extract(text = '') {
    const lower = text.toLowerCase();
    const entities = [];

    // Wallet addresses
    const addressRegex = /(0x[a-fA-F0-9]{40})/g;
    const addresses = [...lower.matchAll(addressRegex)].map(m => m[1]);
    addresses.forEach(addr => entities.push({ type: 'address', value: addr }));

    // Networks
    this.networks.forEach(net => {
      if (lower.includes(net)) entities.push({ type: 'network', value: net });
    });

    // Protocols
    this.protocols.forEach(protocol => {
      if (lower.includes(protocol)) entities.push({ type: 'protocol', value: protocol });
    });

    // Token symbols (simple heuristic: uppercase words 2-6 chars)
    const tokenRegex = /\b[A-Z]{2,6}\b/g;
    const tokens = [...text.matchAll(tokenRegex)].map(m => m[0]);
    tokens.forEach(tok => entities.push({ type: 'token', value: tok }));

    return entities;
  }
}

