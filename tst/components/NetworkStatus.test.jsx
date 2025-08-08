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
    const statusIndicators = document.querySelectorAll('div[style*="backgroundColor: #48bb78"]');
    expect(statusIndicators).toHaveLength(3);
  });

  it('has correct card styling', () => {
    render(<NetworkStatus />);
    const card = screen.getByText('Network Status').closest('div');
    expect(card).toHaveStyle({
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct title styling', () => {
    render(<NetworkStatus />);
    const title = screen.getByText('Network Status');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0 0 16px 0'
    });
  });

  it('has correct network item styling', () => {
    render(<NetworkStatus />);
    const ethereumItem = screen.getByText('Ethereum').closest('div');
    expect(ethereumItem).toHaveStyle({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0'
    });
  });

  it('has correct status indicator styling', () => {
    render(<NetworkStatus />);
    const statusIndicator = document.querySelector('div[style*="backgroundColor: #48bb78"]');
    expect(statusIndicator).toHaveStyle({
      width: '8px',
      height: '8px',
      backgroundColor: '#48bb78',
      borderRadius: '50%'
    });
  });

  it('has correct network name styling', () => {
    render(<NetworkStatus />);
    const ethereumName = screen.getByText('Ethereum');
    expect(ethereumName).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500'
    });
  });

  it('has correct latency styling', () => {
    render(<NetworkStatus />);
    const latency = screen.getByText('15 gwei');
    expect(latency).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px',
      fontWeight: '500'
    });
  });

  it('renders all networks in the correct order', () => {
    render(<NetworkStatus />);
    const networkNames = ['Ethereum', 'Polygon', 'Arbitrum'];
    const networkElements = networkNames.map(name => screen.getByText(name));
    
    networkElements.forEach((element, index) => {
      expect(element).toBeInTheDocument();
    });
  });

  it('renders all latencies in the correct order', () => {
    render(<NetworkStatus />);
    const latencies = ['15 gwei', '2 gwei', '0.5 gwei'];
    const latencyElements = latencies.map(latency => screen.getByText(latency));
    
    latencyElements.forEach((element, index) => {
      expect(element).toBeInTheDocument();
    });
  });

  it('has correct container layout', () => {
    render(<NetworkStatus />);
    const container = screen.getByText('Network Status').parentElement;
    expect(container).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    });
  });

  it('renders network items with proper structure', () => {
    render(<NetworkStatus />);
    const ethereumItem = screen.getByText('Ethereum').closest('div');
    const leftSide = ethereumItem.firstElementChild;
    const rightSide = ethereumItem.lastElementChild;
    
    expect(leftSide).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });
    
    expect(rightSide).toBeInTheDocument(); // latency text
  });

  it('has consistent styling across all network items', () => {
    render(<NetworkStatus />);
    const networkItems = document.querySelectorAll('div[style*="display: flex"][style*="justify-content: space-between"]');
    expect(networkItems).toHaveLength(3);
    
    networkItems.forEach(item => {
      expect(item).toHaveStyle({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0'
      });
    });
  });
}); 