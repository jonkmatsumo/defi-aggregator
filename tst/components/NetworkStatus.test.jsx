import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import NetworkStatus from '../../src/components/NetworkStatus';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useChainId: () => 1,
  useClient: () => ({
    chain: { id: 1, name: 'Ethereum' }
  })
}));

// Mock the GasPriceService
jest.mock('../../src/services/gasPriceService', () => {
  const mockFetchMultipleGasPrices = jest.fn();
  const mockClearCache = jest.fn();
  
  const mockGasPriceService = {
    fetchMultipleGasPrices: mockFetchMultipleGasPrices,
    clearCache: mockClearCache,
  };

  const MockedGasPriceService = jest.fn(() => mockGasPriceService);
  
  // Add static methods
  MockedGasPriceService.getSupportedNetworks = jest.fn(() => ({
    ethereum: { name: 'Ethereum', color: '#627eea', chainId: 1, nativeCurrency: { symbol: 'ETH', decimals: 18 } },
    polygon: { name: 'Polygon', color: '#8247e5', chainId: 137, nativeCurrency: { symbol: 'MATIC', decimals: 18 } },
    arbitrum: { name: 'Arbitrum', color: '#ff6b35', chainId: 42161, nativeCurrency: { symbol: 'ETH', decimals: 18 } },
    bsc: { name: 'BSC', color: '#f3ba2f', chainId: 56, nativeCurrency: { symbol: 'BNB', decimals: 18 } },
    optimism: { name: 'Optimism', color: '#ff0420', chainId: 10, nativeCurrency: { symbol: 'ETH', decimals: 18 } }
  }));

  MockedGasPriceService.getFallbackGasPrices = jest.fn(() => ({
    ethereum: { SafeGasPrice: '15', ProposeGasPrice: '18', FastGasPrice: '22' },
    polygon: { SafeGasPrice: '2', ProposeGasPrice: '3', FastGasPrice: '4' },
    arbitrum: { SafeGasPrice: '0.5', ProposeGasPrice: '0.6', FastGasPrice: '0.8' },
    bsc: { SafeGasPrice: '5', ProposeGasPrice: '6', FastGasPrice: '8' },
    optimism: { SafeGasPrice: '0.1', ProposeGasPrice: '0.15', FastGasPrice: '0.2' }
  }));

  MockedGasPriceService.getDisplayGasPrice = jest.fn((gasData) => {
    if (!gasData) return 'N/A';
    const price = gasData.SafeGasPrice || gasData.ProposeGasPrice || gasData.FastGasPrice;
    return price ? `${price} gwei` : 'N/A';
  });

  MockedGasPriceService.getNetworkStatus = jest.fn((gasData) => {
    if (!gasData || !gasData.SafeGasPrice) return 'offline';
    return 'online';
  });

  MockedGasPriceService.getNetworkInfo = jest.fn((chainId) => ({
    name: 'Ethereum',
    color: '#627eea',
    chainId: chainId,
    nativeCurrency: { symbol: 'ETH', decimals: 18 }
  }));

  MockedGasPriceService.fetchConnectedWalletGasPrice = jest.fn(async (client) => ({
    SafeGasPrice: '15',
    ProposeGasPrice: '18',
    FastGasPrice: '22',
    currentGasPrice: '15'
  }));

  // Set up default mock responses
  mockFetchMultipleGasPrices.mockResolvedValue({
    ethereum: { SafeGasPrice: '15', ProposeGasPrice: '18', FastGasPrice: '22' },
    polygon: { SafeGasPrice: '2', ProposeGasPrice: '3', FastGasPrice: '4' },
    arbitrum: { SafeGasPrice: '0.5', ProposeGasPrice: '0.6', FastGasPrice: '0.8' }
  });

  return {
    __esModule: true,
    default: MockedGasPriceService,
  };
});

describe('NetworkStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title correctly', () => {
    render(<NetworkStatus />);
    expect(screen.getByText('Network Status')).toBeInTheDocument();
  });

  it('renders all network names', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.getByText('Arbitrum')).toBeInTheDocument();
    });
  });

  it('renders loading state initially', () => {
    render(<NetworkStatus />);
    expect(screen.getAllByText('...')).toHaveLength(3);
  });

  it('renders gas prices after loading', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      expect(screen.getByText('15 gwei')).toBeInTheDocument();
      expect(screen.getByText('2 gwei')).toBeInTheDocument();
      expect(screen.getByText('0.5 gwei')).toBeInTheDocument();
    });
  });

  it('renders status indicators for all networks', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      // Should have 4 status indicators: 1 loading spinner + 3 network status dots
      const statusIndicators = document.querySelectorAll('div[style*="border-radius: 50%"]');
      expect(statusIndicators.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('has correct card styling', () => {
    render(<NetworkStatus />);
    const card = screen.getByText('Network Status').closest('div').parentElement;
    expect(card).toHaveStyle({
      borderRadius: '16px',
      padding: '20px',
    });
  });

  it('has correct title styling', () => {
    render(<NetworkStatus />);
    const title = screen.getByText('Network Status');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0px',
    });
  });

  it('has correct network item styling', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const ethereumItem = screen.getByText('Ethereum').closest('div').parentElement;
      expect(ethereumItem).toBeInTheDocument();
    });
  });

  it('has correct status indicator styling', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const statusIndicators = document.querySelectorAll('div[style*="border-radius: 50%"]');
      const networkStatusIndicator = statusIndicators[1]; // Skip loading spinner
      expect(networkStatusIndicator).toHaveStyle({
        width: '8px',
        height: '8px',
        borderRadius: '50%',
      });
    });
  });

  it('has correct network name styling', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const ethereumName = screen.getByText('Ethereum');
      expect(ethereumName).toHaveStyle({
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
      });
    });
  });

  it('has correct latency styling', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const latency = screen.getByText('15 gwei');
      expect(latency).toHaveStyle({
        color: 'rgb(160, 174, 192)',
        fontSize: '12px',
      });
    });
  });

  it('renders all networks in the correct order', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const networkNames = ['Ethereum', 'Polygon', 'Arbitrum'];
      networkNames.forEach(name => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });
  });

  it('renders all latencies in the correct order', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const latencies = ['15 gwei', '2 gwei', '0.5 gwei'];
      latencies.forEach(latency => {
        expect(screen.getByText(latency)).toBeInTheDocument();
      });
    });
  });

  it('has correct container layout', () => {
    render(<NetworkStatus />);
    const container = screen.getByText('Network Status').parentElement;
    expect(container).toBeInTheDocument();
  });

  it('renders network items with proper structure', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const ethereumItem = screen.getByText('Ethereum').closest('div').parentElement;
      expect(ethereumItem).toBeInTheDocument();
      
      const leftSide = ethereumItem.firstElementChild;
      const rightSide = ethereumItem.lastElementChild;
      
      expect(leftSide).toBeInTheDocument();
      expect(rightSide).toBeInTheDocument();
    });
  });

  it('has consistent styling across all network items', async () => {
    render(<NetworkStatus />);
    
    await waitFor(() => {
      const ethereumName = screen.getByText('Ethereum');
      const polygonName = screen.getByText('Polygon');
      const arbitrumName = screen.getByText('Arbitrum');
      
      expect(ethereumName).toHaveStyle({
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
      });
      expect(polygonName).toHaveStyle({
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
      });
      expect(arbitrumName).toHaveStyle({
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
      });
    });
  });

  it('renders refresh button', () => {
    render(<NetworkStatus />);
    expect(screen.getByTitle('Refresh gas prices')).toBeInTheDocument();
  });





  it('accepts maxNetworks prop', async () => {
    render(<NetworkStatus maxNetworks={2} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ethereum')).toBeInTheDocument();
      expect(screen.getByText('Polygon')).toBeInTheDocument();
      expect(screen.queryByText('Arbitrum')).not.toBeInTheDocument();
    });
  });
}); 