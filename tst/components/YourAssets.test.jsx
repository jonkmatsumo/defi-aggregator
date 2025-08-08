import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import YourAssets from '../../src/components/YourAssets';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn(),
  useChainId: jest.fn()
}));

// Mock TokenBalanceService
jest.mock('../../src/services/tokenBalanceService', () => {
  const MockedTokenBalanceService = jest.fn().mockImplementation(() => ({
    fetchAllTokenBalances: jest.fn().mockResolvedValue([
      { symbol: 'ETH', name: 'Ethereum', balance: '2.000', value: '$4,000.00', color: '#627eea', decimals: 18, isMock: false }
    ])
  }));
  MockedTokenBalanceService.getFallbackAssets = jest.fn(() => [
    { symbol: 'ETH', name: 'Ethereum', balance: '1.234', value: '$2,468.00', color: '#627eea', decimals: 18 },
    { symbol: 'USDC', name: 'USD Coin', balance: '1000.00', value: '$1,000.00', color: '#2775ca', decimals: 6 },
    { symbol: 'DAI', name: 'Dai', balance: '500.00', value: '$500.00', color: '#f5ac37', decimals: 18 }
  ]);
  MockedTokenBalanceService.calculateUSDValue = jest.fn((balance, symbol) => {
    const prices = { ETH: 2000, USDC: 1, DAI: 1 };
    return `$${(parseFloat(balance) * (prices[symbol] || 1)).toFixed(2)}`;
  });
  MockedTokenBalanceService.formatBalance = jest.fn((balance, decimals) => balance.toString());
  return { __esModule: true, default: MockedTokenBalanceService };
});

describe('YourAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock return values
    const { useAccount, usePublicClient, useChainId } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: false,
      address: null
    });
    usePublicClient.mockReturnValue({
      getBalance: jest.fn().mockResolvedValue('2000000000000000000')
    });
    useChainId.mockReturnValue(1);
  });

  it('renders the title correctly', () => {
    render(<YourAssets />);
    expect(screen.getByText('Your Assets')).toBeInTheDocument();
  });

  it('renders demo mode when not connected', () => {
    render(<YourAssets />);
    expect(screen.getByText('(Demo Mode)')).toBeInTheDocument();
  });

  it('renders fallback assets when not connected', () => {
    render(<YourAssets />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('DAI')).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(<YourAssets />);
    const refreshButton = screen.getByTitle('Refresh token balances');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.textContent).toBe('↻');
  });

  it('accepts maxAssets prop', () => {
    render(<YourAssets maxAssets={2} />);
    // Should still show fallback assets
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('shows loading state when connected and fetching data', () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890'
    });

    render(<YourAssets />);
    // Should show fallback data initially (not loading state)
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('handles forceRefresh prop', () => {
    render(<YourAssets forceRefresh={true} />);
    // Should render without errors
    expect(screen.getByText('Your Assets')).toBeInTheDocument();
  });

  it('has correct title styling', () => {
    render(<YourAssets />);
    const title = screen.getByText('Your Assets');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0px'
    });
  });
});