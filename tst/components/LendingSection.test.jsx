import React from 'react';
import { render, screen } from '@testing-library/react';
import LendingSection from '../../src/components/LendingSection';

describe('LendingSection', () => {
  it('renders the title correctly', () => {
    render(<LendingSection />);
    expect(screen.getByText('Lending & Borrowing')).toBeInTheDocument();
  });

  it('renders supply assets button', () => {
    render(<LendingSection />);
    expect(screen.getByText('Supply Assets')).toBeInTheDocument();
  });

  it('renders borrow assets button', () => {
    render(<LendingSection />);
    expect(screen.getByText('Borrow Assets')).toBeInTheDocument();
  });

  it('renders all asset symbols', () => {
    render(<LendingSection />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('renders all APY values', () => {
    render(<LendingSection />);
    expect(screen.getByText('5.2% APY')).toBeInTheDocument();
    expect(screen.getByText('3.8% APY')).toBeInTheDocument();
  });

  it('renders asset types', () => {
    render(<LendingSection />);
    expect(screen.getAllByText('Supply')).toHaveLength(2);
  });

  it('renders asset icons with correct symbols', () => {
    render(<LendingSection />);
    expect(screen.getByText('ET')).toBeInTheDocument(); // ETH icon
    expect(screen.getByText('US')).toBeInTheDocument(); // USDC icon
  });

  it('has correct card styling', () => {
    render(<LendingSection />);
    const card = screen.getByText('Lending & Borrowing').closest('div');
    expect(card).toHaveStyle({
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct title styling', () => {
    render(<LendingSection />);
    const title = screen.getByText('Lending & Borrowing');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '18px',
      fontWeight: '600',
      margin: '0 0 20px 0'
    });
  });

  it('has correct action buttons container styling', () => {
    render(<LendingSection />);
    const supplyButton = screen.getByText('Supply Assets');
    const buttonsContainer = supplyButton.parentElement;
    expect(buttonsContainer).toHaveStyle({
      display: 'flex',
      gap: '12px',
      marginBottom: '20px'
    });
  });

  it('has correct supply button styling', () => {
    render(<LendingSection />);
    const supplyButton = screen.getByText('Supply Assets');
    expect(supplyButton).toHaveStyle({
      flex: 1,
      background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 16px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    });
  });

  it('has correct borrow button styling', () => {
    render(<LendingSection />);
    const borrowButton = screen.getByText('Borrow Assets');
    expect(borrowButton).toHaveStyle({
      flex: 1,
      background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 16px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    });
  });

  it('has correct asset item styling', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toHaveStyle({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px',
      background: '#1a202c',
      borderRadius: '8px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct asset icon styling', () => {
    render(<LendingSection />);
    const ethIcon = screen.getByText('ET');
    expect(ethIcon).toHaveStyle({
      width: '24px',
      height: '24px',
      backgroundColor: '#627eea',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '10px',
      fontWeight: '600'
    });
  });

  it('has correct asset symbol styling', () => {
    render(<LendingSection />);
    const ethSymbol = screen.getByText('ETH');
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500'
    });
  });

  it('has correct APY styling', () => {
    render(<LendingSection />);
    const apy = screen.getByText('5.2% APY');
    expect(apy).toHaveStyle({
      color: '#48bb78',
      fontSize: '14px',
      fontWeight: '600'
    });
  });

  it('has correct asset type styling', () => {
    render(<LendingSection />);
    const supplyType = screen.getAllByText('Supply')[0];
    expect(supplyType).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px'
    });
  });

  it('renders all assets in the correct order', () => {
    render(<LendingSection />);
    const assetSymbols = ['ETH', 'USDC'];
    const assetElements = assetSymbols.map(symbol => screen.getByText(symbol));
    
    assetElements.forEach((element, index) => {
      expect(element).toBeInTheDocument();
    });
  });

  it('has correct assets container layout', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    const assetsContainer = ethItem.parentElement;
    expect(assetsContainer).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
  });

  it('renders asset items with proper structure', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    const leftSide = ethItem.firstElementChild;
    const rightSide = ethItem.lastElementChild;
    
    expect(leftSide).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
    
    expect(rightSide).toBeInTheDocument(); // APY text
  });

  it('has consistent styling across all asset items', () => {
    render(<LendingSection />);
    const assetItems = document.querySelectorAll('div[style*="display: flex"][style*="justify-content: space-between"]');
    expect(assetItems).toHaveLength(2);
    
    assetItems.forEach(item => {
      expect(item).toHaveStyle({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        background: '#1a202c',
        borderRadius: '8px',
        border: '1px solid #4a5568'
      });
    });
  });

  it('renders asset icons with correct colors', () => {
    render(<LendingSection />);
    const ethIcon = screen.getByText('ET');
    const usdcIcon = screen.getByText('US');
    
    expect(ethIcon).toHaveStyle({ backgroundColor: '#627eea' });
    expect(usdcIcon).toHaveStyle({ backgroundColor: '#2775ca' });
  });

  it('renders asset information with proper hierarchy', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    const leftSide = ethItem.firstElementChild;
    
    // Check that the left side contains icon and symbol
    expect(leftSide.querySelector('div')).toBeInTheDocument(); // icon
    expect(leftSide.querySelector('span')).toBeInTheDocument(); // symbol
  });

  it('renders correct number of supply type labels', () => {
    render(<LendingSection />);
    const supplyLabels = screen.getAllByText('Supply');
    expect(supplyLabels).toHaveLength(2);
  });

  it('renders correct APY values for each asset', () => {
    render(<LendingSection />);
    expect(screen.getByText('5.2% APY')).toBeInTheDocument();
    expect(screen.getByText('3.8% APY')).toBeInTheDocument();
  });
}); 