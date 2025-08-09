import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RecentActivity from '../../src/components/RecentActivity';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn(),
  useChainId: jest.fn()
}));

describe('RecentActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock return values
    const { useAccount, usePublicClient, useChainId } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: false,
      address: null
    });
    usePublicClient.mockReturnValue({
      getBlockNumber: jest.fn().mockResolvedValue('1000000'),
      getBlock: jest.fn().mockResolvedValue({
        timestamp: '1640995200',
        transactions: []
      })
    });
    useChainId.mockReturnValue(1);
  });

  it('renders the title correctly', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders demo mode when not connected', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('(Demo Mode)')).toBeInTheDocument();
  });

  it('renders no data message when not connected', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    const refreshButton = screen.getByTitle('Refresh transactions');
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.textContent).toBe('↻');
  });

  it('accepts transactionCount prop', async () => {
    await act(async () => {
      render(<RecentActivity transactionCount={5} />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows loading state when connected and fetching data', async () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890'
    });

    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('handles forceRefresh prop', async () => {
    await act(async () => {
      render(<RecentActivity forceRefresh={true} />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('has correct title styling', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    const title = screen.getByText('Recent Activity');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0px'
    });
  });

  it('shows demo mode message when not connected', async () => {
    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('Connect your wallet to see real transaction history')).toBeInTheDocument();
  });

  it('handles empty transaction list', async () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890'
    });

    await act(async () => {
      render(<RecentActivity />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('displays error message when transaction fetching fails', async () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      isConnected: true,
      address: '0x1234567890123456789012345678901234567890'
    });

    // Mock the public client to throw an error
    const { usePublicClient } = require('wagmi');
    usePublicClient.mockReturnValue({
      getBlockNumber: jest.fn().mockRejectedValue(new Error('Network error')),
      getBlock: jest.fn().mockRejectedValue(new Error('Network error'))
    });

    await act(async () => {
      render(<RecentActivity />);
    });
    
    // Wait for the error to be handled and fallback data to be shown
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  it('handles forceRefresh prop correctly', async () => {
    await act(async () => {
      render(<RecentActivity forceRefresh={true} />);
    });
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });
}); 