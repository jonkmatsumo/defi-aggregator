import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ConnectWalletButton from '../../src/components/ConnectWalletButton';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useDisconnect: jest.fn(),
}));

// Mock RainbowKit ConnectButton
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: ({ children }) => <button data-testid="connect-button">{children || 'Connect Wallet'}</button>,
}));

describe('ConnectWalletButton', () => {
  const mockUseAccount = useAccount;
  const mockUseDisconnect = useDisconnect;
  const mockDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDisconnect.mockReturnValue({ disconnect: mockDisconnect });
  });

  describe('when wallet is not connected', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
      });
    });

    it('renders connect button', () => {
      render(<ConnectWalletButton />);
      
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
    });

    it('does not show wallet address or disconnect button', () => {
      render(<ConnectWalletButton />);
      
      expect(screen.queryByText(/0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}/)).not.toBeInTheDocument();
      expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
    });
  });

  describe('when wallet is connected', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });
    });

    it('displays truncated wallet address', () => {
      render(<ConnectWalletButton />);
      
      expect(screen.getByText('0x742d...d8b6')).toBeInTheDocument();
    });

    it('displays disconnect button', () => {
      render(<ConnectWalletButton />);
      
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('calls disconnect function when disconnect button is clicked', () => {
      render(<ConnectWalletButton />);
      
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);
      
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('displays green status indicator', () => {
      render(<ConnectWalletButton />);
      
      const statusIndicator = screen.getByText('0x742d...d8b6').previousElementSibling;
      expect(statusIndicator).toHaveStyle({ backgroundColor: 'rgb(40, 167, 69)' });
    });

    it('has correct container styling', () => {
      render(<ConnectWalletButton />);
      
      // Get the outer container div that has the styling
      const container = screen.getByText('0x742d...d8b6').closest('div').parentElement;
      expect(container).toHaveStyle({ 
        backgroundColor: 'rgb(248, 249, 250)',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      });
    });

    it('has correct disconnect button styling', () => {
      render(<ConnectWalletButton />);
      
      const disconnectButton = screen.getByText('Disconnect');
      expect(disconnectButton).toHaveStyle({ 
        backgroundColor: 'rgb(220, 53, 69)',
        color: 'white',
        borderRadius: '6px'
      });
    });
  });

  describe('address truncation', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        isConnected: true,
      });
    });

    it('truncates address correctly for standard address', () => {
      mockUseAccount.mockReturnValue({
        address: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        isConnected: true,
      });
      
      render(<ConnectWalletButton />);
      expect(screen.getByText('0x742d...d8b6')).toBeInTheDocument();
    });

    it('handles empty address gracefully', () => {
      mockUseAccount.mockReturnValue({
        address: '',
        isConnected: true,
      });
      
      render(<ConnectWalletButton />);
      // Check that the component renders without crashing
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('handles null address gracefully', () => {
      mockUseAccount.mockReturnValue({
        address: null,
        isConnected: true,
      });
      
      render(<ConnectWalletButton />);
      // Check that the component renders without crashing
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('truncates short address correctly', () => {
      mockUseAccount.mockReturnValue({
        address: '0x1234567890abcdef',
        isConnected: true,
      });
      
      render(<ConnectWalletButton />);
      expect(screen.getByText('0x1234...cdef')).toBeInTheDocument();
    });
  });

  describe('disconnect button interactions', () => {
    const mockAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({
        address: mockAddress,
        isConnected: true,
      });
    });

    it('changes color on hover', () => {
      render(<ConnectWalletButton />);
      
      const disconnectButton = screen.getByText('Disconnect');
      
      // Initial color
      expect(disconnectButton).toHaveStyle({ backgroundColor: 'rgb(220, 53, 69)' });
      
      // Simulate hover
      fireEvent.mouseEnter(disconnectButton);
      expect(disconnectButton).toHaveStyle({ backgroundColor: 'rgb(200, 35, 51)' });
      
      // Simulate mouse leave
      fireEvent.mouseLeave(disconnectButton);
      expect(disconnectButton).toHaveStyle({ backgroundColor: 'rgb(220, 53, 69)' });
    });

    it('has correct button attributes', () => {
      render(<ConnectWalletButton />);
      
      const disconnectButton = screen.getByText('Disconnect');
      expect(disconnectButton).toHaveStyle({ cursor: 'pointer' });
    });
  });
}); 