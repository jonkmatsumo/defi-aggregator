import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../../src/components/Header';

// Mock ConnectWalletButton since it's a complex component with wagmi dependencies
jest.mock('../../src/components/ConnectWalletButton', () => {
  return function MockConnectWalletButton() {
    return <div data-testid="connect-wallet-button">Connect Wallet</div>;
  };
});

describe('Header', () => {
  it('renders the DeFiHub logo', () => {
    render(<Header />);
    expect(screen.getByText('DeFiHub')).toBeInTheDocument();
  });

  it('renders the logo icon with "D"', () => {
    render(<Header />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('renders the network indicator', () => {
    render(<Header />);
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('renders the connect wallet button', () => {
    render(<Header />);
    expect(screen.getByTestId('connect-wallet-button')).toBeInTheDocument();
  });

  it('has correct header styling', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toHaveStyle({
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #2d3748'
    });
  });

  it('has correct logo styling', () => {
    render(<Header />);
    const logoIcon = screen.getByText('D').closest('div');
    expect(logoIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '16px'
    });
  });

  it('has correct network indicator styling', () => {
    render(<Header />);
    const networkIndicator = screen.getByText('Ethereum').closest('div');
    expect(networkIndicator).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '8px'
    });
  });
}); 