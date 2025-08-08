import React from 'react';

const LendingSection = () => {
  const assets = [
    { symbol: 'ETH', apy: '5.2%', type: 'Supply', available: true },
    { symbol: 'USDC', apy: '3.8%', type: 'Supply', available: true }
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568'
    }}>
      <h3 style={{
        color: 'white',
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 20px 0'
      }}>
        Lending & Borrowing
      </h3>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <button style={{
          flex: 1,
          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 16px',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 8px 16px rgba(72, 187, 120, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}>
          Supply Assets
        </button>
        
        <button style={{
          flex: 1,
          background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 16px',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 8px 16px rgba(237, 137, 54, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}>
          Borrow Assets
        </button>
      </div>

      {/* Assets List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {assets.map((asset) => (
          <div
            key={`${asset.symbol}-${asset.type}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: '#1a202c',
              borderRadius: '8px',
              border: '1px solid #4a5568'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: asset.symbol === 'ETH' ? '#627eea' : '#2775ca',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                {asset.symbol.slice(0, 2)}
              </div>
              <span style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {asset.symbol}
              </span>
            </div>
            
            <div style={{
              color: '#48bb78',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {asset.apy} APY
            </div>
            
            <span style={{
              color: '#a0aec0',
              fontSize: '12px'
            }}>
              {asset.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LendingSection;