import React from 'react';

const NetworkStatus = () => {
  const networks = [
    { name: 'Ethereum', status: 'online', latency: '15 gwei', color: '#627eea' },
    { name: 'Polygon', status: 'online', latency: '2 gwei', color: '#8247e5' },
    { name: 'Arbitrum', status: 'online', latency: '0.5 gwei', color: '#ff6b35' }
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
        Network Status
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {networks.map((network) => (
          <div
            key={network.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#48bb78',
                borderRadius: '50%'
              }}></div>
              <span style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {network.name}
              </span>
            </div>
            <span style={{
              color: '#a0aec0',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {network.latency}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkStatus;