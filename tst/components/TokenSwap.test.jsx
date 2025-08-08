import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TokenSwap from '../../src/components/TokenSwap';

describe('TokenSwap', () => {
  it('renders the token swap title', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Token Swap')).toBeInTheDocument();
  });

  it('renders the settings button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('⚙️')).toBeInTheDocument();
  });

  it('renders "From" label', () => {
    render(<TokenSwap />);
    expect(screen.getByText('From')).toBeInTheDocument();
  });

  it('renders "To" label', () => {
    render(<TokenSwap />);
    expect(screen.getByText('To')).toBeInTheDocument();
  });

  it('renders default token values', () => {
    render(<TokenSwap />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('renders balance information', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Balance: 2.5 ETH')).toBeInTheDocument();
    expect(screen.getByText('Balance: 1,250 USDC')).toBeInTheDocument();
  });

  it('renders rate and fee information', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Fee')).toBeInTheDocument();
    expect(screen.getByText('1 ETH = 2,456.78 USDC')).toBeInTheDocument();
    expect(screen.getByText('0.3%')).toBeInTheDocument();
  });

  it('renders swap button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('Swap Tokens')).toBeInTheDocument();
  });

  it('renders swap arrow button', () => {
    render(<TokenSwap />);
    expect(screen.getByText('↕️')).toBeInTheDocument();
  });

  it('has input fields for amounts', () => {
    render(<TokenSwap />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
  });

  it('updates from amount when input changes', () => {
    render(<TokenSwap />);
    const fromInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(fromInput, { target: { value: '1.5' } });
    expect(fromInput.value).toBe('1.5');
  });

  it('updates to amount when input changes', () => {
    render(<TokenSwap />);
    const toInput = screen.getAllByRole('textbox')[1];
    fireEvent.change(toInput, { target: { value: '2500' } });
    expect(toInput.value).toBe('2500');
  });

  it('has correct card styling', () => {
    render(<TokenSwap />);
    const card = screen.getByText('Token Swap').closest('div');
    expect(card).toHaveStyle({
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct title styling', () => {
    render(<TokenSwap />);
    const title = screen.getByText('Token Swap');
    expect(title).toHaveStyle({
      color: 'white',
      fontSize: '18px',
      fontWeight: '600',
      margin: 0
    });
  });

  it('has correct label styling', () => {
    render(<TokenSwap />);
    const fromLabel = screen.getByText('From');
    expect(fromLabel).toHaveStyle({
      color: '#a0aec0',
      fontSize: '14px',
      fontWeight: '500',
      display: 'block',
      marginBottom: '8px'
    });
  });

  it('has correct input styling', () => {
    render(<TokenSwap />);
    const fromInput = screen.getAllByRole('textbox')[0];
    expect(fromInput).toHaveStyle({
      background: 'none',
      border: 'none',
      color: 'white',
      fontSize: '24px',
      fontWeight: '600',
      outline: 'none',
      width: '60%'
    });
  });

  it('has correct token button styling for ETH', () => {
    render(<TokenSwap />);
    const ethButton = screen.getByText('ETH ▼');
    expect(ethButton).toHaveStyle({
      background: '#667eea',
      border: 'none',
      borderRadius: '20px',
      padding: '8px 16px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });
  });

  it('has correct token button styling for USDC', () => {
    render(<TokenSwap />);
    const usdcButton = screen.getByText('USDC ▼');
    expect(usdcButton).toHaveStyle({
      background: '#48bb78',
      border: 'none',
      borderRadius: '20px',
      padding: '8px 16px',
      color: 'white',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });
  });

  it('has correct swap button styling', () => {
    render(<TokenSwap />);
    const swapButton = screen.getByText('Swap Tokens');
    expect(swapButton).toHaveStyle({
      width: '100%',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      fontSize: '18px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    });
  });

  it('has correct rate/fee container styling', () => {
    render(<TokenSwap />);
    const rateContainer = screen.getByText('Rate').closest('div');
    expect(rateContainer).toHaveStyle({
      background: '#1a202c',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '16px',
      border: '1px solid #4a5568'
    });
  });

  it('has correct balance text styling', () => {
    render(<TokenSwap />);
    const balanceText = screen.getByText('Balance: 2.5 ETH');
    expect(balanceText).toHaveStyle({
      color: '#718096',
      fontSize: '12px',
      marginTop: '4px',
      textAlign: 'right'
    });
  });

  it('has correct swap arrow button styling', () => {
    render(<TokenSwap />);
    const arrowButton = screen.getByText('↕️');
    expect(arrowButton).toHaveStyle({
      background: '#4a5568',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '18px'
    });
  });

  it('renders token icons', () => {
    render(<TokenSwap />);
    const ethButton = screen.getByText('ETH ▼');
    const usdcButton = screen.getByText('USDC ▼');
    
    // Check that the buttons contain div elements (the token icons)
    expect(ethButton.querySelector('div')).toBeInTheDocument();
    expect(usdcButton.querySelector('div')).toBeInTheDocument();
  });

  it('has correct input container styling', () => {
    render(<TokenSwap />);
    const fromInput = screen.getAllByRole('textbox')[0];
    const inputContainer = fromInput.closest('div');
    expect(inputContainer).toHaveStyle({
      background: '#1a202c',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #4a5568',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    });
  });
}); 