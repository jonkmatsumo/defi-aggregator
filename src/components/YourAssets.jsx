import React from 'react';

const YourAssets = () => {
  const assets = [
    { symbol: 'ETH', name: 'Ether', balance: '2.45', value: '$4,900', color: '#627eea' },
    { symbol: 'USDC', name: 'USD Coin', balance: '1,250', value: '$1,250', color: '#2775ca' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', balance: '0.156', value: '$6,555', color: '#f2a900' }
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid #4a5568'
    }}>
      <h3 style={{
        color: 'white',
        fontSize: '16px',
        fontWeight: '600',
        margin: '0 0 16px 0'
      }}>
        Your Assets
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {assets.map((asset) => (
          <div
            key={asset.symbol}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid #4a5568'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: asset.color,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {asset.symbol.slice(0, 2)}
              </div>
              <div>
                <div style={{
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {asset.symbol}
                </div>
                <div style={{
                  color: '#a0aec0',
                  fontSize: '12px'
                }}>
                  {asset.name}
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {asset.balance}
              </div>
              <div style={{
                color: '#a0aec0',
                fontSize: '12px'
              }}>
                {asset.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default YourAssets;