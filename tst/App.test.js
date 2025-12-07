import { render, screen } from '@testing-library/react';
import App from '../src/App';

// Mock react-router-dom (using manual mock from __mocks__)
jest.mock('react-router-dom');

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
  usePublicClient: () => ({
    getChainId: jest.fn().mockResolvedValue(1),
    getBalance: jest.fn(),
    getBlockNumber: jest.fn(),
  }),
  useWalletClient: () => ({
    data: {
      request: jest.fn(),
    },
  }),
  useChainId: () => 1,
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button">Connect Button</div>,
}));

// Mock the wallet components
jest.mock('../src/components/WalletProvider', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="wallet-provider">{children}</div>,
}));

// Mock the Header component
jest.mock('../src/components/Header', () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header Component</div>,
}));

// Mock the route components
jest.mock('../src/routes/DashboardRoute', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-route">Dashboard Route</div>,
}));

jest.mock('../src/routes/ChatRoute', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-route">Chat Route</div>,
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

  it('renders with BrowserRouter', () => {
    render(<App />);
    
    expect(screen.getByTestId('browser-router')).toBeInTheDocument();
  });

  it('renders Routes component', () => {
    render(<App />);
    
    expect(screen.getByTestId('routes')).toBeInTheDocument();
  });

  it('wraps content in WalletProvider', () => {
    render(<App />);
    
    const walletProvider = screen.getByTestId('wallet-provider');
    expect(walletProvider).toContainElement(screen.getByTestId('header'));
  });
}); 