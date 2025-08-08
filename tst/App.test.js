import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock wagmi and rainbowkit before importing App
jest.mock('wagmi', () => ({
  useConnect: () => ({
    connect: jest.fn(),
    connectors: [],
    isLoading: false,
    error: null,
  }),
  useAccount: () => ({
    address: null,
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  }),
  useDisconnect: () => ({
    disconnect: jest.fn(),
  }),
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">Connect Button</div>,
}));

import App from '../src/App';

// Mock the wallet components
jest.mock('../src/components/WalletProvider', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="wallet-provider">{children}</div>,
}));

// Mock all the dashboard components
jest.mock('../src/components/Header', () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header Component</div>,
}));

jest.mock('../src/components/TokenSwap', () => ({
  __esModule: true,
  default: () => <div data-testid="token-swap">Token Swap Component</div>,
}));

jest.mock('../src/components/NetworkStatus', () => ({
  __esModule: true,
  default: () => <div data-testid="network-status">Network Status Component</div>,
}));

jest.mock('../src/components/YourAssets', () => ({
  __esModule: true,
  default: () => <div data-testid="your-assets">Your Assets Component</div>,
}));

jest.mock('../src/components/LendingSection', () => ({
  __esModule: true,
  default: () => <div data-testid="lending-section">Lending Section Component</div>,
}));

jest.mock('../src/components/RecentActivity', () => ({
  __esModule: true,
  default: () => <div data-testid="recent-activity">Recent Activity Component</div>,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    
    expect(screen.getByTestId('wallet-provider')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('displays the header component', () => {
    render(<App />);
    
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('displays main content components', () => {
    render(<App />);
    
    expect(screen.getByTestId('token-swap')).toBeInTheDocument();
    expect(screen.getByTestId('lending-section')).toBeInTheDocument();
    expect(screen.getByTestId('network-status')).toBeInTheDocument();
    expect(screen.getByTestId('your-assets')).toBeInTheDocument();
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
  });

  it('has correct CSS classes', () => {
    render(<App />);
    
    const appContainer = screen.getByTestId('wallet-provider').querySelector('.App');
    expect(appContainer).toBeInTheDocument();
  });

  it('wraps content in WalletProvider', () => {
    render(<App />);
    
    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toContainElement(screen.getByTestId('header'));
    expect(walletProvider).toContainElement(screen.getByTestId('token-swap'));
  });
}); 