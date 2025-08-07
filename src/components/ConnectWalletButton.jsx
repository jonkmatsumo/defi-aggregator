import React from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const ConnectWalletButton = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Function to truncate wallet address
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Function to handle disconnect
  const handleDisconnect = () => {
    disconnect();
  };

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      padding: '8px 16px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        fontSize: '14px',
        color: '#495057'
      }}>
        <span style={{ 
          width: '8px', 
          height: '8px', 
          backgroundColor: '#28a745', 
          borderRadius: '50%',
          display: 'inline-block'
        }}></span>
        <span style={{ fontWeight: '500' }}>
          {truncateAddress(address)}
        </span>
      </div>
      <button
        onClick={handleDisconnect}
        style={{
          padding: '6px 12px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#c82333';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#dc3545';
        }}
      >
        Disconnect
      </button>
    </div>
  );
};

export default ConnectWalletButton; 