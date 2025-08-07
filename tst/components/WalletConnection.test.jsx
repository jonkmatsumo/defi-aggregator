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
      // Check for network name in the network display paragraph
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Ethereum');
    });

    it('shows supported networks section', () => {
      render(<WalletConnection />);
      
      expect(screen.getByText('Supported Networks:')).toBeInTheDocument();
    });

    it('displays all supported networks in the networks list', () => {
      render(<WalletConnection />);
      
      // Check for networks in the networks list container
      const networksContainer = screen.getByText('Supported Networks:').nextElementSibling;
      expect(networksContainer).toHaveTextContent('Ethereum');
      expect(networksContainer).toHaveTextContent('Polygon');
      expect(networksContainer).toHaveTextContent('Optimism');
      expect(networksContainer).toHaveTextContent('Arbitrum');
      expect(networksContainer).toHaveTextContent('Base');
      expect(networksContainer).toHaveTextContent('Sepolia');
    });

    it('highlights current network in the networks list', () => {
      render(<WalletConnection />);
      
      // Find the Ethereum network span in the networks list
      const networksContainer = screen.getByText('Supported Networks:').nextElementSibling;
      const ethereumNetwork = networksContainer.querySelector('span');
      expect(ethereumNetwork).toHaveStyle({ backgroundColor: 'rgb(59, 130, 246)' });
    });

    it('shows other networks in inactive state', () => {
      render(<WalletConnection />);
      
      // Find the Polygon network span in the networks list
      const networksContainer = screen.getByText('Supported Networks:').nextElementSibling;
      const networkSpans = networksContainer.querySelectorAll('span');
      const polygonNetwork = Array.from(networkSpans).find(span => span.textContent === 'Polygon');
      expect(polygonNetwork).toHaveStyle({ backgroundColor: 'rgb(229, 231, 235)' });
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
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Ethereum');
    });

    it('displays correct network name for Polygon', () => {
      mockUseChainId.mockReturnValue(137);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Polygon');
    });

    it('displays correct network name for Optimism', () => {
      mockUseChainId.mockReturnValue(10);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Optimism');
    });

    it('displays correct network name for Arbitrum', () => {
      mockUseChainId.mockReturnValue(42161);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Arbitrum');
    });

    it('displays correct network name for Base', () => {
      mockUseChainId.mockReturnValue(8453);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Base');
    });

    it('displays correct network name for Sepolia', () => {
      mockUseChainId.mockReturnValue(11155111);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Sepolia');
    });

    it('displays "Unknown" for unsupported network', () => {
      mockUseChainId.mockReturnValue(999);
      render(<WalletConnection />);
      
      const networkParagraph = screen.getByText(/Network:/).closest('p');
      expect(networkParagraph).toHaveTextContent('Unknown');
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
      
      const container = screen.getByText('Wallet Connected!').closest('div').parentElement;
      expect(container).toHaveStyle({ 
        padding: '20px',
        textAlign: 'center'
      });
    });

    it('has correct wallet info section styling', () => {
      render(<WalletConnection />);
      
      const walletInfo = screen.getByText('Wallet Connected!').closest('div');
      expect(walletInfo).toHaveStyle({ 
        backgroundColor: 'rgb(245, 245, 245)',
        borderRadius: '8px'
      });
    });
  });
}); 