import React from 'react';
import { render, screen } from '@testing-library/react';
import TokenSwap from '../../src/components/TokenSwap';

describe('TokenSwap', () => {
  it('renders the component', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  it('renders input fields', () => {
    render(<TokenSwap />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(0);
  });

  it('renders token buttons', () => {
    render(<TokenSwap />);
    const ethButtons = screen.getAllByText((content, element) => {
      return element.textContent.includes('ETH') && element.tagName === 'BUTTON';
    });
    const usdcButtons = screen.getAllByText((content, element) => {
      return element.textContent.includes('USDC') && element.tagName === 'BUTTON';
    });
    expect(ethButtons).toHaveLength(1);
    expect(usdcButtons).toHaveLength(1);
  });

  it('renders balance information', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Balance: 2.5 ETH')).toBeInTheDocument();
    expect(screen.getByText('Balance: 1,250 USDC')).toBeInTheDocument();
  });

  it('renders swap button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Swap Tokens')).toBeInTheDocument();
  });

  it('renders settings button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('⚙️')).toBeInTheDocument();
  });

  it('renders swap direction button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('↕️')).toBeInTheDocument();
  });

  it('renders rate and fee information', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Fee')).toBeInTheDocument();
    expect(screen.getByText('1 ETH = 2,456.78 USDC')).toBeInTheDocument();
    expect(screen.getByText('0.3%')).toBeInTheDocument();
  });

  it('has correct card styling', () => {
    render(<TokenSwap />);
    const card = screen.getByText('Token Swap').closest('div');
    expect(card).toBeInTheDocument();
  });

  it('has correct input styling', () => {
    render(<TokenSwap />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveStyle({
      color: 'white',
      fontSize: '24px',
      fontWeight: '600',
    });
  });

  it('has correct swap button styling', () => {
    render(<TokenSwap />);
    const swapButton = screen.getByText('Swap Tokens');
    expect(swapButton).toHaveStyle({
      width: '100%',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      fontSize: '18px',
      fontWeight: '600',
    });
  });

  it('has correct token button styling for ETH', () => {
    render(<TokenSwap />);
    const ethButton = screen.getAllByText((content, element) => {
      return element.textContent.includes('ETH') && element.tagName === 'BUTTON';
    })[0];
    expect(ethButton).toHaveStyle({
      background: 'rgb(102, 126, 234)',
      borderRadius: '20px',
      padding: '8px 16px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
    });
  });

  it('has correct token button styling for USDC', () => {
    render(<TokenSwap />);
    const usdcButton = screen.getAllByText((content, element) => {
      return element.textContent.includes('USDC') && element.tagName === 'BUTTON';
    })[0];
    expect(usdcButton).toHaveStyle({
      background: 'rgb(72, 187, 120)',
      borderRadius: '20px',
      padding: '8px 16px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
    });
  });

  it('has correct rate/fee container styling', () => {
    render(<TokenSwap />);
    const rateContainer = screen.getByText('Rate').closest('div').parentElement;
    expect(rateContainer).toHaveStyle({
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '16px',
    });
  });

  it('renders token icons', () => {
    render(<TokenSwap />);
    const ethButton = screen.getAllByText((content, element) => {
      return element.textContent.includes('ETH') && element.tagName === 'BUTTON';
    })[0];
    const usdcButton = screen.getAllByText((content, element) => {
      return element.textContent.includes('USDC') && element.tagName === 'BUTTON';
    })[0];
    
    const ethIcon = ethButton.querySelector('div[style*="border-radius: 50%"]');
    const usdcIcon = usdcButton.querySelector('div[style*="border-radius: 50%"]');
    
    expect(ethIcon).toBeInTheDocument();
    expect(usdcIcon).toBeInTheDocument();
    expect(ethIcon).toHaveStyle({
      width: '20px',
      height: '20px',
      borderRadius: '50%',
    });
    expect(usdcIcon).toHaveStyle({
      width: '20px',
      height: '20px',
      borderRadius: '50%',
    });
  });
}); 