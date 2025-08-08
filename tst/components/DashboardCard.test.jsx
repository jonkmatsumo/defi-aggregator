import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardCard from '../../src/components/DashboardCard';

describe('DashboardCard', () => {
  const defaultProps = {
    title: 'Total Balance',
    value: '$24,567.89',
    subtitle: '+8.2%',
    trend: '+$1,234',
    trendColor: '#48bb78',
    icon: '💰'
  };

  it('renders the title correctly', () => {
    render(<DashboardCard {...defaultProps} />);
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders the value correctly', () => {
    render(<DashboardCard {...defaultProps} />);
    expect(screen.getByText('$24,567.89')).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(<DashboardCard {...defaultProps} />);
    expect(screen.getByText('+8.2%')).toBeInTheDocument();
  });

  it('renders the trend when provided', () => {
    render(<DashboardCard {...defaultProps} />);
    expect(screen.getByText('+$1,234')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<DashboardCard {...defaultProps} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const propsWithoutSubtitle = { ...defaultProps };
    delete propsWithoutSubtitle.subtitle;
    render(<DashboardCard {...propsWithoutSubtitle} />);
    expect(screen.queryByText('+8.2%')).not.toBeInTheDocument();
  });

  it('does not render trend when not provided', () => {
    const propsWithoutTrend = { ...defaultProps };
    delete propsWithoutTrend.trend;
    render(<DashboardCard {...propsWithoutTrend} />);
    expect(screen.queryByText('+$1,234')).not.toBeInTheDocument();
  });

  it('does not render icon when not provided', () => {
    const propsWithoutIcon = { ...defaultProps };
    delete propsWithoutIcon.icon;
    render(<DashboardCard {...propsWithoutIcon} />);
    expect(screen.queryByText('💰')).not.toBeInTheDocument();
  });

  it('uses default trend color when not provided', () => {
    const propsWithoutColor = { ...defaultProps };
    delete propsWithoutColor.trendColor;
    render(<DashboardCard {...propsWithoutColor} />);
    const trendElement = screen.getByText('+$1,234');
    expect(trendElement).toHaveStyle({ color: '#48bb78' });
  });

  it('applies custom trend color when provided', () => {
    render(<DashboardCard {...defaultProps} trendColor="#ff0000" />);
    const trendElement = screen.getByText('+$1,234');
    expect(trendElement).toHaveStyle({ color: '#ff0000' });
  });

  it('shows upward arrow for positive trend', () => {
    render(<DashboardCard {...defaultProps} trend="+$1,234" />);
    expect(screen.getByText('↗')).toBeInTheDocument();
  });

  it('shows downward arrow for negative trend', () => {
    render(<DashboardCard {...defaultProps} trend="-$1,234" />);
    expect(screen.getByText('↘')).toBeInTheDocument();
  });

  it('does not show arrow for trend without sign', () => {
    render(<DashboardCard {...defaultProps} trend="5.3%" />);
    expect(screen.queryByText('↗')).not.toBeInTheDocument();
    expect(screen.queryByText('↘')).not.toBeInTheDocument();
  });

  it('has correct card styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const card = screen.getByText('Total Balance').closest('div');
    expect(card).toHaveStyle({
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568',
      position: 'relative',
      overflow: 'hidden'
    });
  });

  it('has correct title styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const title = screen.getByText('Total Balance');
    expect(title).toHaveStyle({
      color: '#a0aec0',
      fontSize: '14px',
      fontWeight: '500',
      margin: '0 0 8px 0',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    });
  });

  it('has correct value styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const value = screen.getByText('$24,567.89');
    expect(value).toHaveStyle({
      color: 'white',
      fontSize: '28px',
      fontWeight: '700',
      margin: '0 0 4px 0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });
  });

  it('has correct subtitle styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const subtitle = screen.getByText('+8.2%');
    expect(subtitle).toHaveStyle({
      color: '#718096',
      fontSize: '14px',
      fontWeight: '400'
    });
  });

  it('has correct trend styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const trend = screen.getByText('+$1,234');
    expect(trend).toHaveStyle({
      color: '#48bb78',
      fontSize: '16px',
      fontWeight: '600',
      marginTop: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    });
  });

  it('has correct icon styling', () => {
    render(<DashboardCard {...defaultProps} />);
    const icon = screen.getByText('💰');
    expect(icon).toHaveStyle({
      position: 'absolute',
      top: '16px',
      right: '16px',
      color: '#48bb78',
      fontSize: '20px'
    });
  });

  it('renders background pattern', () => {
    render(<DashboardCard {...defaultProps} />);
    const card = screen.getByText('Total Balance').closest('div');
    const backgroundPattern = card.querySelector('div[style*="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1)"]');
    expect(backgroundPattern).toBeInTheDocument();
  });
}); 