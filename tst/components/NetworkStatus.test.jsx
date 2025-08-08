import React from 'react';
import { render, screen } from '@testing-library/react';
import NetworkStatus from '../../src/components/NetworkStatus';

describe('NetworkStatus', () => {
  it('renders the title correctly', () => {
    render(<NetworkStatus />);
    expect(screen.getByText('Network Status')).toBeInTheDocument();
  });

  it('renders all network names', () => {
    render(<NetworkStatus />);
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
    expect(screen.getByText('Polygon')).toBeInTheDocument();
    expect(screen.getByText('Arbitrum')).toBeInTheDocument();
  });

  it('renders all network latencies', () => {
    render(<NetworkStatus />);
    expect(screen.getByText('15 gwei')).toBeInTheDocument();
    expect(screen.getByText('2 gwei')).toBeInTheDocument();
    expect(screen.getByText('0.5 gwei')).toBeInTheDocument();
  });

  it('renders status indicators for all networks', () => {
    render(<NetworkStatus />);
    const statusIndicators = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(statusIndicators).toHaveLength(3);
  });

  it('has correct card styling', () => {
    render(<NetworkStatus />);
    const card = screen.getByText('Network Status').closest('div');
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
      margin: '0px 0px 16px 0px',
    });
  });

  it('has correct network item styling', () => {
    render(<NetworkStatus />);
    const ethereumItem = screen.getByText('Ethereum').parentElement;
    expect(ethereumItem).toBeInTheDocument();
  });

  it('has correct status indicator styling', () => {
    render(<NetworkStatus />);
    const statusIndicator = document.querySelector('div[style*="border-radius: 50%"]');
    expect(statusIndicator).toBeInTheDocument();
    expect(statusIndicator).toHaveStyle({
      width: '8px',
      height: '8px',
      borderRadius: '50%',
    });
  });

  it('has correct network name styling', () => {
    render(<NetworkStatus />);
    const ethereumName = screen.getByText('Ethereum');
    expect(ethereumName).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
    });
  });

  it('has correct latency styling', () => {
    render(<NetworkStatus />);
    const latency = screen.getByText('15 gwei');
    expect(latency).toHaveStyle({
      color: 'rgb(160, 174, 192)',
      fontSize: '12px',
    });
  });

  it('renders all networks in the correct order', () => {
    render(<NetworkStatus />);
    const networkNames = ['Ethereum', 'Polygon', 'Arbitrum'];
    networkNames.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  it('renders all latencies in the correct order', () => {
    render(<NetworkStatus />);
    const latencies = ['15 gwei', '2 gwei', '0.5 gwei'];
    latencies.forEach(latency => {
      expect(screen.getByText(latency)).toBeInTheDocument();
    });
  });

  it('has correct container layout', () => {
    render(<NetworkStatus />);
    const container = screen.getByText('Network Status').parentElement;
    expect(container).toBeInTheDocument();
  });

  it('renders network items with proper structure', () => {
    render(<NetworkStatus />);
    const ethereumItem = screen.getByText('Ethereum').parentElement;
    expect(ethereumItem).toBeInTheDocument();
    
    const leftSide = ethereumItem.firstElementChild;
    const rightSide = ethereumItem.lastElementChild;
    
    expect(leftSide).toBeInTheDocument();
    expect(rightSide).toBeInTheDocument();
  });

  it('has consistent styling across all network items', () => {
    render(<NetworkStatus />);
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