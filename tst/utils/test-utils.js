import React from 'react';
import { render } from '@testing-library/react';
import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

// Mock the wallet dependencies for testing
jest.mock('wagmi', () => ({
  WagmiConfig: ({ children }) => <div data-testid="wagmi-config">{children}</div>,
  createConfig: jest.fn(() => ({})),
  http: jest.fn(),
  useAccount: jest.fn(),
  useChainId: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({})),
  QueryClientProvider: ({ children }) => <div data-testid="query-client-provider">{children}</div>,
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }) => <div data-testid="rainbowkit-provider">{children}</div>,
  ConnectButton: ({ children }) => <button data-testid="connect-button">{children || 'Connect Wallet'}</button>,
}));

// Custom render function that includes all necessary providers
const AllTheProviders = ({ children }) => {
  return (
    <WagmiConfig config={{}}>
      <QueryClientProvider client={{}}>
        <RainbowKitProvider chains={[]}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
};

const customRender = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Test data helpers
export const mockWalletData = {
  connected: {
    address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    isConnected: true,
  },
  disconnected: {
    address: undefined,
    isConnected: false,
  },
};

export const mockChainIds = {
  ethereum: 1,
  polygon: 137,
  optimism: 10,
  arbitrum: 42161,
  base: 8453,
  sepolia: 11155111,
  unknown: 999,
}; 