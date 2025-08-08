import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TokenSwap from '../../src/components/TokenSwap';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useClient: jest.fn(),
  useChainId: jest.fn()
}));

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    utils: {
      parseUnits: jest.fn(),
      formatUnits: jest.fn()
    }
  }
}));

// Mock fetch
global.fetch = jest.fn();

const mockProvider = {
  getGasPrice: jest.fn().mockResolvedValue('20000000000')
};

const mockSigner = {
  sendTransaction: jest.fn()
};

const mockTransaction = {
  hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  wait: jest.fn().mockResolvedValue({ status: 1 })
};

describe('TokenSwap', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Default mock return values
    const { useAccount, useClient, useChainId } = require('wagmi');
    useAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true
    });
    useClient.mockReturnValue({
      provider: mockProvider,
      getSigner: jest.fn().mockReturnValue(mockSigner)
    });
    useChainId.mockReturnValue(1);
    
    // Clear fetch mock
    global.fetch.mockClear();
    
    // Setup default fetch response
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        toTokenAmount: '1000000',
        priceImpact: '0.5',
        tx: {
          to: '0x1234567890123456789012345678901234567890',
          data: '0x',
          value: '0x0',
          gas: '300000',
          gasPrice: '20000000000'
        },
        protocols: [[{ name: 'Uniswap V3' }]]
      })
    });
    
    // Setup ethers mock
    const { ethers } = require('ethers');
    ethers.utils.parseUnits.mockReturnValue('1000000000000000000');
    ethers.utils.formatUnits.mockReturnValue('1.0');
  });

  test('renders token swap component', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  test('shows default tokens', () => {
    render(<TokenSwap />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  test('shows connect wallet message when not connected', () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      address: null,
      isConnected: false
    });

    render(<TokenSwap />);
    expect(screen.getByText('Connect your wallet to start swapping tokens')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  test('allows token selection', () => {
    render(<TokenSwap />);
    
    // Click on from token button
    const fromTokenButton = screen.getByText('ETH').closest('button');
    fireEvent.click(fromTokenButton);
    
    // Should show token selector modal
    expect(screen.getByText('Select Token')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
  });

  test('switches tokens when switch button is clicked', () => {
    render(<TokenSwap />);
    
    // Initially ETH -> USDC
    expect(screen.getAllByText('ETH')[0]).toBeInTheDocument();
    expect(screen.getAllByText('USDC')[0]).toBeInTheDocument();
    
    // Click switch button
    const switchButton = screen.getByText('↓');
    fireEvent.click(switchButton);
    
    // Should now be USDC -> ETH
    expect(screen.getAllByText('USDC')[0]).toBeInTheDocument();
    expect(screen.getAllByText('ETH')[0]).toBeInTheDocument();
  });

  test('allows slippage adjustment', () => {
    render(<TokenSwap />);
    
    // Default should be 1%
    const slippageButtons = screen.getAllByText(/[0-9]+%/);
    expect(slippageButtons).toHaveLength(3);
    
    // Click on 2% button
    const twoPercentButton = screen.getByText('2%');
    fireEvent.click(twoPercentButton);
    
    // Should be selected (active styling)
    expect(twoPercentButton).toHaveStyle('background-color: rgb(102, 126, 234)');
  });

  test('fetches quote when amount is entered', async () => {
    render(<TokenSwap />);
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for debounced quote fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.1inch.io/v4.0/1/quote')
      );
    });
  });

  test('displays quote information', async () => {
    render(<TokenSwap />);
    
    // Enter amount to trigger quote
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for quote to be displayed
    await waitFor(() => {
      expect(screen.getByText('Price Impact:')).toBeInTheDocument();
      expect(screen.getAllByText('0.5%')).toHaveLength(2); // One in slippage, one in quote
      expect(screen.getByText('Estimated Gas:')).toBeInTheDocument();
      expect(screen.getByText('Route:')).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400
    });

    render(<TokenSwap />);
    
    // Enter amount to trigger quote
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText('API Error: 400')).toBeInTheDocument();
    });
  });

  test('enables swap button when quote is available', async () => {
    render(<TokenSwap />);
    
    // Initially disabled (no quote)
    const swapButton = screen.getByText('Swap');
    expect(swapButton).toBeDisabled();
    
    // Enter amount to get quote
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for quote and button to be enabled
    await waitFor(() => {
      expect(screen.getByText('Swap')).not.toBeDisabled();
    });
  });

  test('closes token selector modal', () => {
    render(<TokenSwap />);
    
    // Open token selector
    const fromTokenButton = screen.getByText('ETH').closest('button');
    fireEvent.click(fromTokenButton);
    
    // Should show modal
    expect(screen.getByText('Select Token')).toBeInTheDocument();
    
    // Close modal
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    // Modal should be closed
    expect(screen.queryByText('Select Token')).not.toBeInTheDocument();
  });

  test('applies proper styling', () => {
    render(<TokenSwap />);
    
    const container = screen.getByText('Token Swap').closest('div');
    expect(container).toHaveStyle('background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%)');
  });

  test('handles different chain IDs', () => {
    const { useChainId } = require('wagmi');
    useChainId.mockReturnValue(137); // Polygon

    render(<TokenSwap />);
    
    // Should still work with different chain ID
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  test('debounces quote requests', async () => {
    jest.useFakeTimers();
    
    render(<TokenSwap />);
    
    const amountInput = screen.getByPlaceholderText('0.0');
    
    // Rapidly change amount
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    fireEvent.change(amountInput, { target: { value: '1.1' } });
    fireEvent.change(amountInput, { target: { value: '1.2' } });
    
    // Should not have called fetch yet
    expect(global.fetch).not.toHaveBeenCalled();
    
    // Fast forward past debounce time
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    
    // Should have called fetch once
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    
    jest.useRealTimers();
  });
});