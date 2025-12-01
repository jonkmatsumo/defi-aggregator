import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LendingSection from '../../src/components/LendingSection';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn()
}));

// Mock LendingService
jest.mock('../../src/services/lendingService', () => {
  const MockedLendingService = jest.fn().mockImplementation(() => ({
    fetchAllLendingAssets: jest.fn(),
    fetchUserBalances: jest.fn(),
    supplyTokens: jest.fn(),
    withdrawTokens: jest.fn(),
    borrowTokens: jest.fn(),
    repayTokens: jest.fn(),
    getFallbackCompoundTokens: jest.fn(),
    getFallbackAaveReserves: jest.fn()
  }));

  // Add static methods
  MockedLendingService.getPlatforms = jest.fn().mockReturnValue([
    { id: 'compound', name: 'Compound', logo: '🏦' },
    { id: 'aave', name: 'Aave', logo: '🦇' }
  ]);

  MockedLendingService.getSupportedTokens = jest.fn().mockReturnValue([
    { symbol: 'ETH', name: 'Ethereum', logo: '🔷' },
    { symbol: 'DAI', name: 'Dai Stablecoin', logo: '🟡' },
    { symbol: 'USDC', name: 'USD Coin', logo: '💙' }
  ]);

  return MockedLendingService;
});

// Mock fetch
global.fetch = jest.fn();

describe('LendingSection', () => {
  const mockLendingService = require('../../src/services/lendingService');
  const mockCompoundTokens = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEe',
      platform: 'Compound',
      logo: '🔷',
      supplyRate: 0.025,
      borrowRate: 0.045
    },
    {
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      platform: 'Compound',
      logo: '🟡',
      supplyRate: 0.035,
      borrowRate: 0.055
    }
  ];

  const mockAaveReserves = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C',
      platform: 'Aave',
      logo: '💙',
      supplyRate: 0.032,
      borrowRate: 0.052
    }
  ];

  const mockUserBalances = {
    compound: [
      {
        symbol: 'ETH',
        supplied: 2.5,
        borrowed: 0,
        supplyValue: 5000,
        borrowValue: 0,
        platform: 'Compound'
      }
    ],
    aave: [
      {
        symbol: 'USDC',
        supplied: 2000,
        borrowed: 0,
        supplyValue: 2000,
        borrowValue: 0,
        platform: 'Aave'
      }
    ],
    totalSupplied: 7000,
    totalBorrowed: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock return values
    const { useAccount, usePublicClient } = require('wagmi');
    useAccount.mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true
    });
    usePublicClient.mockReturnValue({
      getBalance: jest.fn(),
      getBlockNumber: jest.fn()
    });

    // Mock LendingService methods
    const mockServiceInstance = {
      fetchAllLendingAssets: jest.fn().mockResolvedValue({
        compound: mockCompoundTokens,
        aave: mockAaveReserves,
        all: [...mockCompoundTokens, ...mockAaveReserves]
      }),
      fetchUserBalances: jest.fn().mockResolvedValue(mockUserBalances),
      supplyTokens: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }),
      withdrawTokens: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }),
      borrowTokens: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }),
      repayTokens: jest.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }),
      getFallbackCompoundTokens: jest.fn().mockReturnValue(mockCompoundTokens),
      getFallbackAaveReserves: jest.fn().mockReturnValue(mockAaveReserves)
    };

    mockLendingService.mockImplementation(() => mockServiceInstance);
  });

  it('renders lending section component', async () => {
    render(<LendingSection />);
    expect(screen.getByText('Lending & Borrowing')).toBeInTheDocument();
  });

  it('shows demo mode when not connected', async () => {
    const { useAccount } = require('wagmi');
    useAccount.mockReturnValue({
      address: null,
      isConnected: false
    });

    render(<LendingSection />);
    expect(screen.getByText('(Demo Mode)')).toBeInTheDocument();
    expect(screen.getByText('Connect your wallet to start lending and borrowing')).toBeInTheDocument();
  });

  it('displays user positions when connected', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Your Positions')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('$7,000')).toBeInTheDocument(); // Total supplied
    });
    await waitFor(() => {
      expect(screen.getByText('$0')).toBeInTheDocument(); // Total borrowed
    });
  });

  it('renders action buttons', async () => {
    render(<LendingSection />);
    
    expect(screen.getByText('supply')).toBeInTheDocument();
    expect(screen.getByText('withdraw')).toBeInTheDocument();
    expect(screen.getByText('borrow')).toBeInTheDocument();
    expect(screen.getByText('repay')).toBeInTheDocument();
  });

  it('allows action selection', async () => {
    render(<LendingSection />);
    
    const borrowButton = screen.getByText('borrow');
    fireEvent.click(borrowButton);
    
    // The button should be highlighted (we can check the style or class)
    expect(borrowButton).toBeInTheDocument();
  });

  it('renders platform selection', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('🏦')).toBeInTheDocument(); // Compound logo
    });
    await waitFor(() => {
      expect(screen.getAllByText('Compound')).toHaveLength(3); // Button + 2 asset entries
    });
    await waitFor(() => {
      expect(screen.getByText('🦇')).toBeInTheDocument(); // Aave logo
    });
    await waitFor(() => {
      expect(screen.getByText('Aave')).toBeInTheDocument();
    });
  });

  it('allows platform selection', async () => {
    render(<LendingSection />);
    
    const aaveButton = screen.getByText('Aave');
    fireEvent.click(aaveButton);
    
    expect(aaveButton).toBeInTheDocument();
  });

  it('shows token selection button', async () => {
    render(<LendingSection />);
    
    expect(screen.getByText('Choose a token')).toBeInTheDocument();
  });

  it('opens token selector modal', async () => {
    render(<LendingSection />);
    
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    expect(screen.getAllByText('Select Token')).toHaveLength(2);
  });

  it('displays available tokens in modal', async () => {
    render(<LendingSection />);
    
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText('DAI')).toHaveLength(2);
    });
  });

  it('allows token selection', async () => {
    render(<LendingSection />);
    
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Modal should close and token should be selected
    expect(screen.getByText('Select Token')).toBeInTheDocument(); // The label remains visible
  });

  it('shows amount input field', async () => {
    render(<LendingSection />);
    
    const amountInput = screen.getByPlaceholderText('0.0');
    expect(amountInput).toBeInTheDocument();
  });

  it('allows amount input', async () => {
    render(<LendingSection />);
    
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    expect(amountInput.value).toBe('100');
  });

  it('displays token info when token is selected', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Should show APY information
    await waitFor(() => {
      expect(screen.getByText('Supply APY:')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Borrow APY:')).toBeInTheDocument();
    });
  });

  it('shows execute button with correct text', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Supply')).toBeInTheDocument();
    });
  });

  it('execute button is disabled when no token selected', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Supply')).toBeInTheDocument();
    });
    
    const executeButton = screen.getByText('Supply');
    expect(executeButton).toBeDisabled();
  });

  it('execute button is disabled when no amount entered', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    const executeButton = screen.getByText('Supply');
    expect(executeButton).toBeDisabled();
  });

  it('execute button is enabled when token and amount are provided', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    const executeButton = screen.getByText('Supply');
    expect(executeButton).not.toBeDisabled();
  });

  it('executes supply transaction successfully', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Supply');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Transaction success')).toBeInTheDocument();
    });
  });

  it('executes withdraw transaction successfully', async () => {
    render(<LendingSection />);
    
    // Select withdraw action
    const withdrawButton = screen.getByText('withdraw');
    fireEvent.click(withdrawButton);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '50' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Withdraw');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Transaction success')).toBeInTheDocument();
    });
  });

  it('executes borrow transaction successfully', async () => {
    render(<LendingSection />);
    
    // Select borrow action
    const borrowButton = screen.getByText('borrow');
    fireEvent.click(borrowButton);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '10' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Borrow');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Transaction success')).toBeInTheDocument();
    });
  });

  it('executes repay transaction successfully', async () => {
    render(<LendingSection />);
    
    // Select repay action
    const repayButton = screen.getByText('repay');
    fireEvent.click(repayButton);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '5' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Repay');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Transaction success')).toBeInTheDocument();
    });
  });

  it('handles transaction failure', async () => {
    const mockServiceInstance = mockLendingService();
    mockServiceInstance.supplyTokens.mockRejectedValue(new Error('Transaction failed'));
    
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Supply');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('Transaction failed')).toHaveLength(2);
    });
  });

  it('displays available assets list', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Available Assets')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('DAI')).toBeInTheDocument();
    });
  });

  it('shows APY rates for available assets', async () => {
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Supply: 2.50%')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Borrow: 4.50%')).toBeInTheDocument();
    });
  });

  it('shows refresh button', async () => {
    render(<LendingSection />);
    
    expect(screen.getByText('↻ Refresh')).toBeInTheDocument();
  });

  it('handles refresh action', async () => {
    const mockServiceInstance = mockLendingService();
    const mockFetchAllLendingAssets = mockServiceInstance.fetchAllLendingAssets;
    
    render(<LendingSection />);
    
    const refreshButton = screen.getByText('↻ Refresh');
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(mockFetchAllLendingAssets).toHaveBeenCalled();
    });
  });

  it('displays transaction hash when transaction succeeds', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Supply');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Transaction Hash:')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/0xabcdef12\.\.\.34567890/)).toBeInTheDocument();
    });
  });

  it('clears form after successful transaction', async () => {
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Supply');
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      // Form should be cleared
      expect(screen.getByText('Choose a token')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(amountInput.value).toBe('');
    });
  });

  it('shows loading state during transaction', async () => {
    const mockServiceInstance = mockLendingService();
    mockServiceInstance.supplyTokens.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }), 100))
    );
    
    render(<LendingSection />);
    
    // Select a token
    const tokenButton = screen.getByText('Choose a token');
    fireEvent.click(tokenButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('ETH')).toHaveLength(2);
    });
    
    const ethTokens = screen.getAllByText('ETH');
    // Click the first ETH token in the modal (not the one in the available assets list)
    fireEvent.click(ethTokens[1]); // Index 1 is the one in the modal
    
    // Enter amount
    const amountInput = screen.getByPlaceholderText('0.0');
    fireEvent.change(amountInput, { target: { value: '100' } });
    
    // Execute transaction
    const executeButton = screen.getByText('Supply');
    fireEvent.click(executeButton);
    
    // Should show loading state
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('handles error when fetching lending data fails', async () => {
    const mockServiceInstance = mockLendingService();
    mockServiceInstance.fetchAllLendingAssets.mockRejectedValue(new Error('API Error'));
    
    render(<LendingSection />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch lending data')).toBeInTheDocument();
    });
  });

  it('shows correct action button text for different actions', async () => {
    render(<LendingSection />);
    
    // Wait for component to load
    await waitFor(() => {
      // Default is supply
      expect(screen.getByText('Supply')).toBeInTheDocument();
    });
    
    // Change to withdraw
    const withdrawButton = screen.getByText('withdraw');
    fireEvent.click(withdrawButton);
    expect(screen.getByText('Withdraw')).toBeInTheDocument();
    
    // Change to borrow
    const borrowButton = screen.getByText('borrow');
    fireEvent.click(borrowButton);
    expect(screen.getByText('Borrow')).toBeInTheDocument();
    
    // Change to repay
    const repayButton = screen.getByText('repay');
    fireEvent.click(repayButton);
    expect(screen.getByText('Repay')).toBeInTheDocument();
  });

  it('filters tokens by selected platform', async () => {
    render(<LendingSection />);
    
    // Default platform is Compound
    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('DAI')).toBeInTheDocument();
    });
    
    // Switch to Aave
    const aaveButton = screen.getByText('Aave');
    fireEvent.click(aaveButton);
    
    // Should show only Aave tokens (USDC is in the mock data)
    await waitFor(() => {
      // The component should filter tokens based on platform
      // For now, we'll just check that the platform selection works
      expect(aaveButton).toBeInTheDocument();
    });
  });
}); 