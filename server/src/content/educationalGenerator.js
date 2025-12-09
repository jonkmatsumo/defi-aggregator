/**
 * EducationalGenerator provides lightweight educational snippets
 * to accompany tool results (price, gas, lending, balances).
 */
export class EducationalGenerator {
  generatePriceContext(result) {
    if (!result) return null;
    const tips = [];
    if (result.change_24h !== undefined) {
      tips.push('24h change indicates short-term momentum; large moves can imply higher volatility.');
    }
    if (result.volume_24h) {
      tips.push('High 24h volume often signals stronger liquidity and tighter spreads.');
    }
    if (result.market_cap) {
      tips.push('Market cap helps compare asset size; larger caps typically move more slowly.');
    }
    return tips.length ? tips : null;
  }

  generateGasExplanation(result) {
    if (!result) return null;
    const tips = [];
    tips.push('Gas prices reflect network demand; higher gwei means faster inclusion but higher cost.');
    tips.push('Consider submitting during off-peak hours to reduce fees.');
    if (result.transaction_type || result.transactionType) {
      tips.push('Different transaction types (swap vs transfer) consume different gas amounts.');
    }
    return tips;
  }

  generateLendingContext(result) {
    if (!result || !result.protocols) return null;
    const tips = [];
    tips.push('Supply APY is what you earn for depositing; Borrow APY is what you pay when borrowing.');
    tips.push('Utilization near 100% can increase variable borrow rates; monitor frequently.');
    tips.push('Diversify protocols to reduce smart contract and liquidity risk.');
    return tips;
  }

  generateProtocolExplanation(protocol) {
    if (!protocol) return null;
    const key = (protocol || '').toLowerCase();
    switch (key) {
    case 'aave':
      return ['Aave is a major lending protocol supporting variable and stable borrow rates.'];
    case 'compound':
      return ['Compound is a lending protocol where rates adjust algorithmically with utilization.'];
    case 'maker':
      return ['Maker issues the DAI stablecoin; vault users generate DAI against collateral.'];
    default:
      return ['Research protocol security, audits, and liquidity before depositing significant funds.'];
    }
  }

  defineTerm(term) {
    const key = (term || '').toLowerCase();
    switch (key) {
    case 'gwei':
      return 'Gwei is a unit of Ethereum gas price; 1 gwei = 10^-9 ETH.';
    case 'apy':
      return 'APY (Annual Percentage Yield) is the annualized return including compounding.';
    case 'slippage':
      return 'Slippage is the difference between expected and executed price due to liquidity or volatility.';
    default:
      return null;
    }
  }

  generateRecommendations(toolResult) {
    if (!toolResult || !toolResult.toolName) return null;
    const tips = [];
    if (toolResult.toolName === 'get_gas_prices') {
      tips.push('If not time-sensitive, choose slower gas tiers to save on fees.');
    }
    if (toolResult.toolName === 'get_crypto_price' && toolResult.result?.change_24h < 0) {
      tips.push('Price is down 24h; consider whether this is a dip or part of a larger trend.');
    }
    if (toolResult.toolName === 'get_lending_rates') {
      tips.push('Compare borrow APY vs supply APY to avoid negative carry when leveraging.');
    }
    return tips.length ? tips : null;
  }

  buildEducationalTips(toolResults = []) {
    if (!Array.isArray(toolResults) || toolResults.length === 0) return null;
    const tips = [];

    for (const tr of toolResults) {
      if (!tr || !tr.success || !tr.result) continue;
      switch (tr.toolName) {
      case 'get_crypto_price': {
        const priceTips = this.generatePriceContext(tr.result);
        if (priceTips) tips.push(...priceTips);
        const recs = this.generateRecommendations(tr);
        if (recs) tips.push(...recs);
        break;
      }
      case 'get_gas_prices': {
        const gasTips = this.generateGasExplanation(tr.result);
        if (gasTips) tips.push(...gasTips);
        const recs = this.generateRecommendations(tr);
        if (recs) tips.push(...recs);
        break;
      }
      case 'get_lending_rates': {
        const lendTips = this.generateLendingContext(tr.result);
        if (lendTips) tips.push(...lendTips);
        const recs = this.generateRecommendations(tr);
        if (recs) tips.push(...recs);
        break;
      }
      case 'get_token_balance': {
        tips.push('Review token allocations and consider diversification across assets and networks.');
        break;
      }
      default:
        break;
      }
    }

    return tips.length ? tips : null;
  }
}

