import React from 'react';
import { useAccount, useChainId } from 'wagmi';
import ConnectWalletButton from './ConnectWalletButton';

const WalletConnection = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Define supported chains
  const chains = [
    { id: 1, name: 'Ethereum' },
    { id: 137, name: 'Polygon' },
    { id: 10, name: 'Optimism' },
    { id: 42161, name: 'Arbitrum' },
    { id: 8453, name: 'Base' },
    { id: 11155111, name: 'Sepolia' },
  ];

  const getChainName = (id) => {
    const chain = chains.find(c => c.id === id);
    return chain ? chain.name : 'Unknown';
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <ConnectWalletButton />
      
      {isConnected && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h3>Wallet Connected!</h3>
          <p><strong>Address:</strong> {address}</p>
          <p><strong>Network:</strong> {getChainName(chainId)}</p>
          
          <div style={{ marginTop: '15px' }}>
            <h4>Supported Networks:</h4>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {chains.map((chain) => (
                <span
                  key={chain.id}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: chain.id === chainId ? '#3b82f6' : '#e5e7eb',
                    color: chain.id === chainId ? 'white' : '#374151',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  {chain.name}
                </span>
              ))}
            </div>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              Switch networks using your wallet interface
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnection; 