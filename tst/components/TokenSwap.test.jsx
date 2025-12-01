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
    
    // Setup default fetch response for new 1inch API
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

  it('renders token swap component', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  it('shows default tokens', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('shows connect wallet message when not connected', async () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      address: null,
      isConnected: false
    });

    await act(async () => {
      render(<TokenSwap />);
    });
    expect(screen.getByText('Connect your wallet to start swapping tokens')).toBeInTheDocument();
  });

  it('allows token selection', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Click on from token button
    const fromTokenButton = screen.getByText('ETH').closest('button');
    fireEvent.click(fromTokenButton);
    
    // Should show token selector modal
    expect(screen.getByText('Select Token')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
  });

  it('switches tokens when switch button is clicked', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
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

  it('allows slippage adjustment', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Default should be 1%
    const slippageButtons = screen.getAllByText(/[0-9]+%/);
    expect(slippageButtons).toHaveLength(3);
    
    // Click on 2% button
    const twoPercentButton = screen.getByText('2%');
    fireEvent.click(twoPercentButton);
    
    // Should be selected (active styling)
    expect(twoPercentButton).toHaveStyle('background-color: rgb(102, 126, 234)');
  });

  it('fetches quote when amount is entered', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for debounced quote fetch
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/swap\/v5\.2\/1\/quote\?.*/),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer demo',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  it('displays quote information', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
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

  it('handles API errors gracefully', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    });

    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Enter amount to trigger quote
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText('API Error: 400 - Bad Request')).toBeInTheDocument();
    });
  });

  it('enables swap button when quote is available', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
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

  it('closes token selector modal', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
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

  it('applies proper styling', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
    const container = screen.getByText('Token Swap').closest('div');
    expect(container).toHaveStyle('background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%)');
  });

  it('handles different chain IDs', async () => {
    const { useChainId } = require('wagmi');
    useChainId.mockReturnValue(137); // Polygon

    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Should still work with different chain ID
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  it('debounces quote requests', async () => {
    jest.useFakeTimers();
    
    await act(async () => {
      render(<TokenSwap />);
    });
    
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

  it('disables swap button with correct boolean expression evaluation', async () => {
    await act(async () => {
      render(<TokenSwap />);
    });
    
    // Initially disabled (no quote) - tests: loading || !quote || transactionStatus === 'pending'
    const swapButton = screen.getByRole('button', { name: 'Swap' });
    expect(swapButton).toBeDisabled();
    
    // Enter amount to get quote
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '1.0' } });
    
    // Wait for quote - button should be enabled (has quote, not loading, no pending transaction)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Swap' })).not.toBeDisabled();
    });
  });
});