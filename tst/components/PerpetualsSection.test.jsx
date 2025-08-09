import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock ethers first
const mockContractInstance = {
  getPositions: jest.fn().mockResolvedValue([]),
  getPosition: jest.fn().mockResolvedValue({
    tokenPair: '0x1234567890123456789012345678901234567890',
    positionSize: '500000000000000000',
    leverage: '10',
    isLong: true,
    entryPrice: '42000000000000000000000',
    markPrice: '42850500000000000000000',
    pnl: '425250000000000000000'
  }),
  getTokenPair: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  openPosition: jest.fn().mockResolvedValue({
    hash: '0x1234567890123456789012345678901234567890',
    wait: jest.fn().mockResolvedValue({ status: 1 })
  }),
  closePosition: jest.fn().mockResolvedValue({
    hash: '0x1234567890123456789012345678901234567890',
    wait: jest.fn().mockResolvedValue({ status: 1 })
  })
};

jest.mock('ethers', () => ({
  Contract: jest.fn().mockImplementation(() => mockContractInstance),
  parseUnits: jest.fn().mockReturnValue('1000000000000000000'),
  formatEther: jest.fn().mockReturnValue('1.0')
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  }),
  usePublicClient: () => ({
    getChainId: jest.fn().mockResolvedValue(42161), // Arbitrum
  }),
  useWalletClient: () => ({
    data: {
      request: jest.fn(),
    },
  }),
}));

import PerpetualsSection from '../../src/components/PerpetualsSection';

describe('PerpetualsSection', () => {
  beforeEach(() => {
    // Reset mock contract state
    mockContractInstance.getPositions.mockResolvedValue([]);
    mockContractInstance.getPosition.mockResolvedValue({
      tokenPair: '0x1234567890123456789012345678901234567890',
      positionSize: '500000000000000000',
      leverage: '10',
      isLong: true,
      entryPrice: '42000000000000000000000',
      markPrice: '42850500000000000000000',
      pnl: '425250000000000000000'
    });
  });

  it('renders the perpetuals section component', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('Perpetuals Trading (GMX)')).toBeInTheDocument();
  });

  it('displays the trading pair and price', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getAllByText('BTC/USDT')).toHaveLength(3); // One in header, one in dropdown, one in table
    expect(screen.getAllByText('$42,850.50')).toHaveLength(2); // One in header, one in table
    expect(screen.getByText('+2.34%')).toBeInTheDocument();
  });

  it('shows the trading chart', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    // Check that the chart SVG is present
    const chartContainer = document.querySelector('svg[viewBox="0 0 1000 500"]');
    expect(chartContainer).toBeInTheDocument();
  });

  it('displays market statistics', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('24h High')).toBeInTheDocument();
    expect(screen.getByText('24h Low')).toBeInTheDocument();
    expect(screen.getByText('24h Volume')).toBeInTheDocument();
    expect(screen.getByText('Open Interest')).toBeInTheDocument();
  });

  it('shows position type selection buttons', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('long')).toBeInTheDocument();
    expect(screen.getByText('short')).toBeInTheDocument();
  });

  it('allows switching between long and short positions', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    const shortButton = screen.getByText('short');
    fireEvent.click(shortButton);
    
    // The button should now be highlighted for short
    expect(shortButton).toHaveStyle({ background: '#f56565' });
  });

  it('displays leverage slider', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getAllByText('Leverage')).toHaveLength(2); // One in slider, one in table header
    expect(screen.getAllByText('10x')).toHaveLength(2); // One in slider, one in table
  });

  it('shows token pair selection', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('Token Pair')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BTC/USDT')).toBeInTheDocument();
  });

  it('displays input fields for trading', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('Position Size')).toBeInTheDocument();
    expect(screen.getByText('Stop Loss')).toBeInTheDocument();
    expect(screen.getByText('Take Profit')).toBeInTheDocument();
    expect(screen.getByText('Slippage (%)')).toBeInTheDocument();
  });

  it('shows the action button', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    expect(screen.getByText('Open Long Position')).toBeInTheDocument();
  });

  it('displays open positions table', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Open Positions')).toBeInTheDocument();
    });
    
    // Check for table headers
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Side')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Entry Price')).toBeInTheDocument();
    expect(screen.getByText('Mark Price')).toBeInTheDocument();
    expect(screen.getByText('Unrealized PnL')).toBeInTheDocument();
    expect(screen.getByText('Margin Used')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('shows mock open position data when GMX fails', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    // Wait for the fallback mock data to be displayed
    await waitFor(() => {
      expect(screen.getByText('Long')).toBeInTheDocument();
    });
    
    // Should show fallback mock data
    expect(screen.getByText('0.5 BTC')).toBeInTheDocument();
    expect(screen.getByText('$42,000.00')).toBeInTheDocument();
    // Use getAllByText since there are multiple elements with this text
    expect(screen.getAllByText('$42,850.50')).toHaveLength(2); // One in header, one in table
    expect(screen.getByText('+$425.25')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('allows input field interaction', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    const positionSizeInput = screen.getByPlaceholderText('0.00 BTC');
    fireEvent.change(positionSizeInput, { target: { value: '1000' } });
    expect(positionSizeInput.value).toBe('1000');
  });

  it('allows leverage adjustment', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    const leverageSlider = screen.getByRole('slider');
    fireEvent.change(leverageSlider, { target: { value: '25' } });
    expect(screen.getByText('25x')).toBeInTheDocument();
  });

  it('allows token pair selection', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    const tokenPairSelect = screen.getByDisplayValue('BTC/USDT');
    fireEvent.change(tokenPairSelect, { target: { value: 'ETH/USDT' } });
    expect(tokenPairSelect.value).toBe('ETH/USDT');
  });

  it('allows slippage adjustment', async () => {
    await act(async () => {
      render(<PerpetualsSection />);
    });
    
    const slippageInput = screen.getByDisplayValue('0.5');
    fireEvent.change(slippageInput, { target: { value: '1.0' } });
    expect(slippageInput.value).toBe('1.0');
  });
}); 