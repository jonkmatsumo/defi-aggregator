import React from 'react';
import { render, screen } from '@testing-library/react';
import { WagmiConfig } from 'wagmi';
import WalletProvider from '../../src/components/WalletProvider';

// Mock the wagmi and RainbowKit dependencies
jest.mock('wagmi', () => ({
  WagmiConfig: ({ children }) => <div data-testid="wagmi-config">{children}</div>,
  createConfig: jest.fn(() => ({})),
  http: jest.fn(),
}));

jest.mock('wagmi/chains', () => ({
  mainnet: { id: 1, name: 'Ethereum' },
  polygon: { id: 137, name: 'Polygon' },
  optimism: { id: 10, name: 'Optimism' },
  arbitrum: { id: 42161, name: 'Arbitrum' },
  base: { id: 8453, name: 'Base' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({})),
  QueryClientProvider: ({ children }) => <div data-testid="query-client-provider">{children}</div>,
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children, chains, initialChain, showRecentTransactions, coolMode }) => (
    <div 
      data-testid="rainbowkit-provider"
      data-chains={chains?.length}
      data-initial-chain={initialChain?.name}
      data-show-recent-transactions={showRecentTransactions}
      data-cool-mode={coolMode}
    >
      {children}
    </div>
  ),
}));

// Mock the CSS import
jest.mock('@rainbow-me/rainbowkit/styles.css', () => ({}));

describe('WalletProvider', () => {
  const TestComponent = () => <div data-testid="test-child">Test Child</div>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    expect(screen.getByTestId('wagmi-config')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('configures RainbowKit with correct props', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    const rainbowKitProvider = screen.getByTestId('rainbowkit-provider');
    
    expect(rainbowKitProvider).toHaveAttribute('data-chains', '6');
    expect(rainbowKitProvider).toHaveAttribute('data-initial-chain', 'Ethereum');
    expect(rainbowKitProvider).toHaveAttribute('data-show-recent-transactions', 'true');
    expect(rainbowKitProvider).toHaveAttribute('data-cool-mode', 'true');
  });

  it('wraps children correctly', () => {
    const { container } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // Check that the test component is rendered inside all the providers
    expect(container).toHaveTextContent('Test Child');
  });

  it('maintains provider hierarchy', () => {
    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    // Check that providers are nested in the correct order
    const wagmiConfig = screen.getByTestId('wagmi-config');
    const queryClientProvider = screen.getByTestId('query-client-provider');
    const rainbowKitProvider = screen.getByTestId('rainbowkit-provider');

    expect(wagmiConfig).toContainElement(queryClientProvider);
    expect(queryClientProvider).toContainElement(rainbowKitProvider);
    expect(rainbowKitProvider).toContainElement(screen.getByTestId('test-child'));
  });
}); 