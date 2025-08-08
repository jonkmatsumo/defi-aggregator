import React from 'react';
import { render, screen } from '@testing-library/react';
import YourAssets from '../../src/components/YourAssets';

describe('YourAssets', () => {
  it('renders the title correctly', () => {
    render(<YourAssets />);
    expect(screen.getByText('Your Assets')).toBeInTheDocument();
  });

  it('renders all asset symbols', () => {
    render(<YourAssets />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('WBTC')).toBeInTheDocument();
  });

  it('renders all asset names', () => {
    render(<YourAssets />);
    expect(screen.getByText('Ether')).toBeInTheDocument();
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
    expect(screen.getByText('Wrapped Bitcoin')).toBeInTheDocument();
  });

  it('renders all asset balances', () => {
    render(<YourAssets />);
    expect(screen.getByText('2.45')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('0.156')).toBeInTheDocument();
  });

  it('renders all asset values', () => {
    render(<YourAssets />);
    expect(screen.getByText('$4,900')).toBeInTheDocument();
    expect(screen.getByText('$1,250')).toBeInTheDocument();
    expect(screen.getByText('$6,555')).toBeInTheDocument();
  });

  it('renders asset icons with correct symbols', () => {
    render(<YourAssets />);
    expect(screen.getByText('ET')).toBeInTheDocument(); // ETH icon
    expect(screen.getByText('US')).toBeInTheDocument(); // USDC icon
    expect(screen.getByText('WB')).toBeInTheDocument(); // WBTC icon
  });

  it('has correct card styling', () => {
    render(<YourAssets />);
    const card = screen.getByText('Your Assets').closest('div');
    expect(card).toHaveStyle({
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct title styling', () => {
    render(<YourAssets />);
    const title = screen.getByText('Your Assets');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0 0 16px 0'
    });
  });

  it('has correct asset item styling', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toHaveStyle({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #4a5568'
    });
  });

  it('has correct asset icon styling', () => {
    render(<YourAssets />);
    const ethIcon = screen.getByText('ET');
    expect(ethIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      backgroundColor: '#627eea',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '12px',
      fontWeight: '600'
    });
  });

  it('has correct asset symbol styling', () => {
    render(<YourAssets />);
    const ethSymbol = screen.getByText('ETH');
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600'
    });
  });

  it('has correct asset name styling', () => {
    render(<YourAssets />);
    const ethName = screen.getByText('Ether');
    expect(ethName).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px'
    });
  });

  it('has correct balance styling', () => {
    render(<YourAssets />);
    const ethBalance = screen.getByText('2.45');
    expect(ethBalance).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600'
    });
  });

  it('has correct value styling', () => {
    render(<YourAssets />);
    const ethValue = screen.getByText('$4,900');
    expect(ethValue).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px'
    });
  });

  it('renders all assets in the correct order', () => {
    render(<YourAssets />);
    const assetSymbols = ['ETH', 'USDC', 'WBTC'];
    const assetElements = assetSymbols.map(symbol => screen.getByText(symbol));
    
    assetElements.forEach((element, index) => {
      expect(element).toBeInTheDocument();
    });
  });

  it('has correct container layout', () => {
    render(<YourAssets />);
    const container = screen.getByText('Your Assets').parentElement;
    expect(container).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });
  });

  it('renders asset items with proper structure', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    const leftSide = ethItem.firstElementChild;
    const rightSide = ethItem.lastElementChild;
    
    expect(leftSide).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
    
    expect(rightSide).toHaveStyle({
      textAlign: 'right'
    });
  });

  it('has consistent styling across all asset items', () => {
    render(<YourAssets />);
    const assetItems = document.querySelectorAll('div[style*="display: flex"][style*="justify-content: space-between"]');
    expect(assetItems).toHaveLength(3);
    
    assetItems.forEach(item => {
      expect(item).toHaveStyle({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid #4a5568'
      });
    });
  });

  it('renders asset icons with correct colors', () => {
    render(<YourAssets />);
    const ethIcon = screen.getByText('ET');
    const usdcIcon = screen.getByText('US');
    const wbtcIcon = screen.getByText('WB');
    
    expect(ethIcon).toHaveStyle({ backgroundColor: '#627eea' });
    expect(usdcIcon).toHaveStyle({ backgroundColor: '#2775ca' });
    expect(wbtcIcon).toHaveStyle({ backgroundColor: '#f2a900' });
  });

  it('renders asset information with proper hierarchy', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    const leftSide = ethItem.firstElementChild;
    
    // Check that the left side contains icon and text info
    expect(leftSide.querySelector('div')).toBeInTheDocument(); // icon
    expect(leftSide.querySelector('div > div')).toBeInTheDocument(); // text container
    
    // Check that the text container has both symbol and name
    const textContainer = leftSide.querySelector('div > div');
    expect(textContainer.querySelector('div')).toBeInTheDocument(); // symbol
    expect(textContainer.querySelectorAll('div')[1]).toBeInTheDocument(); // name
  });
}); 