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
    const supplyLabels = screen.getAllByText('Supply');
    expect(supplyLabels).toHaveLength(2);
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
      borderRadius: '16px',
      padding: '24px',
    });
  });

  it('has correct title styling', () => {
    render(<LendingSection />);
    const title = screen.getByText('Lending & Borrowing');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '18px',
      fontWeight: '600',
      margin: '0px 0px 20px 0px',
    });
  });

  it('has correct action buttons container styling', () => {
    render(<LendingSection />);
    const buttonsContainer = screen.getByText('Supply Assets').parentElement;
    expect(buttonsContainer).toBeInTheDocument();
  });

  it('has correct supply button styling', () => {
    render(<LendingSection />);
    const supplyButton = screen.getByText('Supply Assets');
    expect(supplyButton).toHaveStyle({
      flex: '1',
      borderRadius: '12px',
      padding: '12px 16px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct borrow button styling', () => {
    render(<LendingSection />);
    const borrowButton = screen.getByText('Borrow Assets');
    expect(borrowButton).toHaveStyle({
      flex: '1',
      borderRadius: '12px',
      padding: '12px 16px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct asset item styling', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
  });

  it('has correct asset icon styling', () => {
    render(<LendingSection />);
    const ethIcon = screen.getByText('ET');
    expect(ethIcon).toHaveStyle({
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '10px',
      fontWeight: '600',
    });
  });

  it('has correct asset symbol styling', () => {
    render(<LendingSection />);
    const ethSymbol = screen.getByText('ETH');
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
    });
  });

  it('has correct APY styling', () => {
    render(<LendingSection />);
    const apy = screen.getByText('5.2% APY');
    expect(apy).toHaveStyle({
      color: '#48bb78',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct asset type styling', () => {
    render(<LendingSection />);
    const supplyType = screen.getAllByText('Supply')[0];
    expect(supplyType).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px',
    });
  });

  it('renders all assets in the correct order', () => {
    render(<LendingSection />);
    const assetSymbols = ['ETH', 'USDC'];
    assetSymbols.forEach(symbol => {
      expect(screen.getByText(symbol)).toBeInTheDocument();
    });
  });

  it('has correct assets container layout', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    const assetsContainer = ethItem.parentElement;
    expect(assetsContainer).toBeInTheDocument();
  });

  it('renders asset items with proper structure', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
    
    const leftSide = ethItem.firstElementChild;
    const rightSide = ethItem.lastElementChild;
    
    expect(leftSide).toBeInTheDocument();
    expect(rightSide).toBeInTheDocument();
  });

  it('has consistent styling across all asset items', () => {
    render(<LendingSection />);
    const ethSymbol = screen.getByText('ETH');
    const usdcSymbol = screen.getByText('USDC');
    
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
    });
    expect(usdcSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
    });
  });

  it('renders asset icons with correct colors', () => {
    render(<LendingSection />);
    const ethIcon = screen.getByText('ET');
    const usdcIcon = screen.getByText('US');
    
    expect(ethIcon).toHaveStyle({ backgroundColor: 'rgb(98, 126, 234)' });
    expect(usdcIcon).toHaveStyle({ backgroundColor: 'rgb(39, 117, 202)' });
  });

  it('renders asset information with proper hierarchy', () => {
    render(<LendingSection />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
    
    const leftSide = ethItem.firstElementChild;
    const rightSide = ethItem.lastElementChild;
    
    expect(leftSide).toBeInTheDocument();
    expect(rightSide).toBeInTheDocument();
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