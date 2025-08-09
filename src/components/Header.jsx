import React from 'react';
import ConnectWalletButton from './ConnectWalletButton';

const Header = () => {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: 'clamp(12px, 2vw, 20px) clamp(16px, 3vw, 32px)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #2d3748',
      minHeight: 'clamp(60px, 8vh, 80px)'
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1vw, 12px)' }}>
        <div style={{
          width: 'clamp(28px, 4vw, 40px)',
          height: 'clamp(28px, 4vw, 40px)',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'clamp(6px, 1vw, 12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: 'clamp(14px, 2vw, 20px)'
        }}>
          D
        </div>
        <span style={{ 
          color: 'white', 
          fontSize: 'clamp(16px, 2.5vw, 24px)', 
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          DeFiHub
        </span>
      </div>

      {/* Right side - Network and Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 2vw, 20px)' }}>
        {/* Network Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1vw, 12px)',
          padding: 'clamp(6px, 1vw, 12px) clamp(10px, 1.5vw, 16px)',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: 'clamp(6px, 1vw, 12px)',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <div style={{
            width: 'clamp(6px, 0.8vw, 10px)',
            height: 'clamp(6px, 0.8vw, 10px)',
            backgroundColor: '#48bb78',
            borderRadius: '50%'
          }}></div>
          <span style={{ 
            color: '#e2e8f0', 
            fontSize: 'clamp(12px, 1.5vw, 16px)', 
            fontWeight: '500' 
          }}>
            Ethereum
          </span>
        </div>

        {/* Connect Wallet Button */}
        <ConnectWalletButton />
      </div>
    </header>
  );
};

export default Header;