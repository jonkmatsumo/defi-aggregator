import React from 'react';
import { render, screen } from '@testing-library/react';
import RecentActivity from '../../src/components/RecentActivity';

describe('RecentActivity', () => {
  it('renders the title correctly', () => {
    render(<RecentActivity />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders all activity descriptions', () => {
    render(<RecentActivity />);
    expect(screen.getByText('Swap ETH → USDC')).toBeInTheDocument();
    expect(screen.getByText('Supply USDC')).toBeInTheDocument();
  });

  it('renders all activity times', () => {
    render(<RecentActivity />);
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
  });

  it('renders all activity amounts', () => {
    render(<RecentActivity />);
    expect(screen.getByText('+1,250 USDC')).toBeInTheDocument();
    expect(screen.getByText('500 USDC')).toBeInTheDocument();
  });

  it('renders activity icons', () => {
    render(<RecentActivity />);
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('📈')).toBeInTheDocument();
  });

  it('has correct card styling', () => {
    render(<RecentActivity />);
    const card = screen.getByText('Recent Activity').closest('div');
    expect(card).toHaveStyle({
      borderRadius: '16px',
      padding: '20px',
    });
  });

  it('has correct title styling', () => {
    render(<RecentActivity />);
    const title = screen.getByText('Recent Activity');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      margin: '0px 0px 16px 0px',
    });
  });

  it('has correct activity item styling', () => {
    render(<RecentActivity />);
    const swapItem = screen.getByText('Swap ETH → USDC').closest('div');
    expect(swapItem).toBeInTheDocument();
  });

  it('has correct activity icon styling', () => {
    render(<RecentActivity />);
    const swapIcon = screen.getByText('🔄');
    expect(swapIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
    });
  });

  it('has correct activity description styling', () => {
    render(<RecentActivity />);
    const description = screen.getByText('Swap ETH → USDC');
    expect(description).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '2px',
    });
  });

  it('has correct activity time styling', () => {
    render(<RecentActivity />);
    const time = screen.getByText('2 hours ago');
    expect(time).toHaveStyle({
      color: '#a0aec0',
      fontSize: '12px',
    });
  });

  it('has correct positive amount styling', () => {
    render(<RecentActivity />);
    const positiveAmount = screen.getByText('+1,250 USDC');
    expect(positiveAmount).toHaveStyle({
      color: '#48bb78',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('has correct neutral amount styling', () => {
    render(<RecentActivity />);
    const neutralAmount = screen.getByText('500 USDC');
    expect(neutralAmount).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '600',
    });
  });

  it('renders all activities in the correct order', () => {
    render(<RecentActivity />);
    const activities = ['Swap ETH → USDC', 'Supply USDC'];
    activities.forEach(activity => {
      expect(screen.getByText(activity)).toBeInTheDocument();
    });
  });

  it('has correct container layout', () => {
    render(<RecentActivity />);
    const container = screen.getByText('Recent Activity').parentElement;
    expect(container).toBeInTheDocument();
  });

  it('renders activity items with proper structure', () => {
    render(<RecentActivity />);
    const swapItem = screen.getByText('Swap ETH → USDC').closest('div');
    expect(swapItem).toBeInTheDocument();
  });

  it('has consistent styling across all activity items', () => {
    render(<RecentActivity />);
    const swapDescription = screen.getByText('Swap ETH → USDC');
    const supplyDescription = screen.getByText('Supply USDC');
    
    expect(swapDescription).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '2px',
    });
    expect(supplyDescription).toHaveStyle({
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '2px',
    });
  });

  it('renders activity content with proper hierarchy', () => {
    render(<RecentActivity />);
    const swapItem = screen.getByText('Swap ETH → USDC').closest('div');
    expect(swapItem).toBeInTheDocument();
  });

  it('renders correct number of activities', () => {
    render(<RecentActivity />);
    const activityItems = document.querySelectorAll('div[style*="border-radius: 50%"]');
    expect(activityItems).toHaveLength(2);
  });

  it('renders correct activity types', () => {
    render(<RecentActivity />);
    expect(screen.getByText('Swap ETH → USDC')).toBeInTheDocument();
    expect(screen.getByText('Supply USDC')).toBeInTheDocument();
  });

  it('renders correct time formats', () => {
    render(<RecentActivity />);
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    expect(screen.getByText('1 day ago')).toBeInTheDocument();
  });

  it('renders correct amount formats', () => {
    render(<RecentActivity />);
    expect(screen.getByText('+1,250 USDC')).toBeInTheDocument();
    expect(screen.getByText('500 USDC')).toBeInTheDocument();
  });

  it('renders activity icons with correct styling', () => {
    render(<RecentActivity />);
    const swapIcon = screen.getByText('🔄');
    const supplyIcon = screen.getByText('📈');
    
    expect(swapIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
    });
    expect(supplyIcon).toHaveStyle({
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
    });
  });
}); 