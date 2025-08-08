import React from 'react';
import ConnectWalletButton from './ConnectWalletButton';

const Header = () => {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #2d3748'
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          D
        </div>
        <span style={{ 
          color: 'white', 
          fontSize: '20px', 
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          DeFiHub
        </span>
      </div>

      {/* Right side - Network and Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Network Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#48bb78',
            borderRadius: '50%'
          }}></div>
          <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '500' }}>
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