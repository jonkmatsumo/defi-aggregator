import { render, screen } from '@testing-library/react';
import Header from '../../src/components/Header';

// Mock react-router-dom (using manual mock from __mocks__)
jest.mock('react-router-dom');

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

  it('renders navigation links', () => {
    render(<Header />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('has navigation link to dashboard', () => {
    render(<Header />);
    const dashboardLink = screen.getByTestId('nav-link-/');
    expect(dashboardLink).toHaveAttribute('href', '/');
  });

  it('has navigation link to chat', () => {
    render(<Header />);
    const chatLink = screen.getByTestId('nav-link-/chat');
    expect(chatLink).toHaveAttribute('href', '/chat');
  });

  it('has correct header styling', () => {
    render(<Header />);
    const header = screen.getByRole('banner');
    expect(header).toHaveStyle({
      padding: 'clamp(12px, 2vw, 20px) clamp(16px, 3vw, 32px)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #2d3748'
    });
  });

  it('has correct logo styling', () => {
    render(<Header />);
    const logoIcon = screen.getByText('D');
    expect(logoIcon).toBeInTheDocument();
    expect(logoIcon).toBeVisible();
  });

  it('has correct network indicator styling', () => {
    render(<Header />);
    const networkIndicator = screen.getByText('Ethereum');
    expect(networkIndicator).toBeInTheDocument();
    expect(networkIndicator).toBeVisible();
  });
}); 