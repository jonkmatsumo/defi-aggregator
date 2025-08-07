import React, { useState, useEffect } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const ConnectWalletButton = () => {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { disconnect, error: disconnectError } = useDisconnect();
  const { error: connectError } = useConnect();
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Function to truncate wallet address
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Function to handle disconnect
  const handleDisconnect = () => {
    disconnect();
  };

  // Show success message when wallet connects
  useEffect(() => {
    if (isConnected && address && !isConnecting && !isReconnecting) {
      setShowSuccess(true);
      setShowError(false);
      
      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, isConnecting, isReconnecting]);

  // Show error message when connection fails
  useEffect(() => {
    if (connectError || disconnectError) {
      const error = connectError || disconnectError;
      setErrorMessage(error?.message || 'Connection failed. Please try again.');
      setShowError(true);
      setShowSuccess(false);
      
      // Hide error message after 5 seconds
      const timer = setTimeout(() => {
        setShowError(false);
        setErrorMessage('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [connectError, disconnectError]);

  // Reset messages when starting a new connection
  useEffect(() => {
    if (isConnecting || isReconnecting) {
      setShowSuccess(false);
      setShowError(false);
      setErrorMessage('');
    }
  }, [isConnecting, isReconnecting]);

  // Show connecting state
  const isLoadingConnection = isConnecting || isReconnecting;

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ConnectButton />
        </div>
        
        {/* Connecting message */}
        {isLoadingConnection && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#1565c0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              border: '2px solid #1565c0',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></span>
            Connecting...
          </div>
        )}
        
        {/* Error message */}
        {showError && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#c62828',
            maxWidth: '300px',
            textAlign: 'center'
          }}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {/* Main connected wallet display */}
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
      
      {/* Success message */}
      {showSuccess && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#e8f5e8',
          border: '1px solid #4caf50',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#2e7d32',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#4caf50',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'white'
          }}>✓</span>
          Wallet connected successfully!
        </div>
      )}
    </div>
  );
};

export default ConnectWalletButton; 