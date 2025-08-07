import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

// Mock the wallet components
jest.mock('../src/components/WalletProvider', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="wallet-provider">{children}</div>,
}));

jest.mock('../src/components/WalletConnection', () => ({
  __esModule: true,
  default: () => <div data-testid="wallet-connection">Wallet Connection Component</div>,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    
    expect(screen.getByTestId('wallet-provider')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-connection')).toBeInTheDocument();
  });

  it('displays the main heading', () => {
    render(<App />);
    
    expect(screen.getByText('DeFi Aggregator')).toBeInTheDocument();
  });

  it('displays the welcome message', () => {
    render(<App />);
    
    expect(screen.getByText(/Welcome to your DeFi aggregator!/)).toBeInTheDocument();
    expect(screen.getByText(/Connect your wallet to get started./)).toBeInTheDocument();
  });

  it('has correct CSS classes', () => {
    render(<App />);
    
    const appContainer = screen.getByText('DeFi Aggregator').closest('.App');
    expect(appContainer).toBeInTheDocument();
    
    const header = screen.getByText('DeFi Aggregator').closest('.App-header');
    expect(header).toBeInTheDocument();
  });

  it('wraps content in WalletProvider', () => {
    render(<App />);
    
    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toContainElement(screen.getByText('DeFi Aggregator'));
    expect(walletProvider).toContainElement(screen.getByTestId('wallet-connection'));
  });

  it('renders WalletConnection component', () => {
    render(<App />);
    
    expect(screen.getByText('Wallet Connection Component')).toBeInTheDocument();
  });
}); 