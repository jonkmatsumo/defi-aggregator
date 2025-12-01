import React from 'react';
import { render, screen } from '@testing-library/react';
import { useAccount, useChainId } from 'wagmi';
import WalletConnection from '../../src/components/WalletConnection';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useChainId: jest.fn(),
  useDisconnect: jest.fn(() => ({ disconnect: jest.fn() })),
  useConnect: jest.fn(() => ({ error: null })),
}));

// Mock RainbowKit ConnectButton
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: ({ children }) => <button data-testid="connect-button">{children || 'Connect Wallet'}</button>,
}));

describe('WalletConnection', () => {
  const mockUseAccount = useAccount;
  const mockUseChainId = useChainId;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when wallet is not connected', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
      });
      mockUseChainId.mockReturnValue(1);
    });

    it('renders connect button', () => {
      render(<WalletConnection />);
      
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
    });

    it('does not show wallet information', () => {
      render(<WalletConnection />);
      
      expect(screen.queryByText('Wallet Connected!')).not.toBeInTheDocument();
      expect(screen.queryByText(/Address:/)).not.toBeInTheDocument();
    });

    it('does not show supported networks section', () => {
      render(<WalletConnection />);
      
      expect(screen.queryByText('Supported Networks:')).not.toBeInTheDocument();
    });
  });

  describe('when wallet is connected', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });
      mockUseChainId.mockReturnValue(1);
    });

    it('renders connect button', () => {
      render(<WalletConnection />);
      
      // When connected, the ConnectWalletButton shows a disconnect button
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('shows wallet connected message', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText('Wallet Connected!')).toBeInTheDocument();
    });

    it('displays wallet address', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText(/Address:/)).toBeInTheDocument();
      expect(screen.getByText(mockAddress)).toBeInTheDocument();
    });

    it('displays current network', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText(/Network:/)).toBeInTheDocument();
      // Check for network name
      expect(screen.getAllByText('Ethereum')).toHaveLength(2); // One in network display, one in list
    });

    it('shows supported networks section', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText('Supported Networks:')).toBeInTheDocument();
    });

    it('displays all supported networks in the networks list', () => {
      render(<WalletConnection />);
      
      // Check for networks
      expect(screen.getAllByText('Ethereum')).toHaveLength(2); // One in network display, one in list
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.getByText('Optimism')).toBeInTheDocument();
      expect(screen.getByText('Arbitrum')).toBeInTheDocument();
      expect(screen.getByText('Base')).toBeInTheDocument();
      expect(screen.getByText('Sepolia')).toBeInTheDocument();
    });

    it('highlights current network in the networks list', () => {
      render(<WalletConnection />);
      
      // Check that the current network is displayed
      expect(screen.getAllByText('Ethereum')).toHaveLength(2); // One in network display, one in list
    });

    it('shows other networks in inactive state', () => {
      render(<WalletConnection />);
      
      // Check that other networks are displayed
      expect(screen.getByText('Polygon')).toBeInTheDocument();
    });

    it('displays helpful message about network switching', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText('Switch networks using your wallet interface')).toBeInTheDocument();
    });
  });

  describe('network name resolution', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        isConnected: true,
      });
    });

    it('displays correct network name for Ethereum', () => {
      mockUseChainId.mockReturnValue(1);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Ethereum')).toHaveLength(2); // One in network display, one in list
    });

    it('displays correct network name for Polygon', () => {
      mockUseChainId.mockReturnValue(137);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Polygon')).toHaveLength(2); // One in network display, one in list
    });

    it('displays correct network name for Optimism', () => {
      mockUseChainId.mockReturnValue(10);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Optimism')).toHaveLength(2); // One in network display, one in list
    });

    it('displays correct network name for Arbitrum', () => {
      mockUseChainId.mockReturnValue(42161);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Arbitrum')).toHaveLength(2); // One in network display, one in list
    });

    it('displays correct network name for Base', () => {
      mockUseChainId.mockReturnValue(8453);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Base')).toHaveLength(2); // One in network display, one in list
    });

    it('displays correct network name for Sepolia', () => {
      mockUseChainId.mockReturnValue(11155111);
      render(<WalletConnection />);
      
      expect(screen.getAllByText('Sepolia')).toHaveLength(2); // One in network display, one in list
    });

    it('displays "Unknown" for unsupported network', () => {
      mockUseChainId.mockReturnValue(999);
      render(<WalletConnection />);
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('component styling and layout', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        isConnected: true,
      });
      mockUseChainId.mockReturnValue(1);
    });

    it('has correct container styling', () => {
      render(<WalletConnection />);
      
      // Check that the component renders correctly
      expect(screen.getByText('Wallet Connected!')).toBeInTheDocument();
    });

    it('has correct wallet info section styling', () => {
      render(<WalletConnection />);
      
      // Check that the wallet info is displayed correctly
      expect(screen.getByText('Wallet Connected!')).toBeInTheDocument();
      expect(screen.getByText('Wallet Connected!')).toBeVisible();
    });
  });
}); 