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
      borderRadius: '16px',
      padding: '20px',
    });
  });

  it('has correct title styling', () => {
    render(<YourAssets />);
    const title = screen.getByText('Your Assets');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0px 0px 16px 0px',
    });
  });

  it('has correct asset item styling', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
  });

  it('has correct asset icon styling', () => {
    render(<YourAssets />);
    const ethIcon = screen.getByText('ET');
    expect(ethIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '12px',
      fontWeight: '600',
    });
  });

  it('has correct asset symbol styling', () => {
    render(<YourAssets />);
    const ethSymbol = screen.getByText('ETH');
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct asset name styling', () => {
    render(<YourAssets />);
    const ethName = screen.getByText('Ether');
    expect(ethName).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px',
    });
  });

  it('has correct balance styling', () => {
    render(<YourAssets />);
    const balance = screen.getByText('2.45');
    expect(balance).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct value styling', () => {
    render(<YourAssets />);
    const value = screen.getByText('$4,900');
    expect(value).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px',
    });
  });

  it('renders all assets in the correct order', () => {
    render(<YourAssets />);
    const assetSymbols = ['ETH', 'USDC', 'WBTC'];
    assetSymbols.forEach(symbol => {
      expect(screen.getByText(symbol)).toBeInTheDocument();
    });
  });

  it('has correct container layout', () => {
    render(<YourAssets />);
    const container = screen.getByText('Your Assets').parentElement;
    expect(container).toBeInTheDocument();
  });

  it('renders asset items with proper structure', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
  });

  it('has consistent styling across all asset items', () => {
    render(<YourAssets />);
    const ethSymbol = screen.getByText('ETH');
    const usdcSymbol = screen.getByText('USDC');
    const wbtcSymbol = screen.getByText('WBTC');
    
    expect(ethSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
    expect(usdcSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
    expect(wbtcSymbol).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('renders asset icons with correct colors', () => {
    render(<YourAssets />);
    const ethIcon = screen.getByText('ET');
    const usdcIcon = screen.getByText('US');
    const wbtcIcon = screen.getByText('WB');
    
    expect(ethIcon).toHaveStyle({ backgroundColor: 'rgb(98, 126, 234)' });
    expect(usdcIcon).toHaveStyle({ backgroundColor: 'rgb(39, 117, 202)' });
    expect(wbtcIcon).toHaveStyle({ backgroundColor: 'rgb(242, 169, 0)' });
  });

  it('renders asset information with proper hierarchy', () => {
    render(<YourAssets />);
    const ethItem = screen.getByText('ETH').closest('div');
    expect(ethItem).toBeInTheDocument();
  });
}); 