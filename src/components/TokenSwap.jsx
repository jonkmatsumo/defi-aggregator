import React, { useState } from 'react';

const TokenSwap = () => {
  const [fromAmount, setFromAmount] = useState('0.0');
  const [toAmount, setToAmount] = useState('0.0');
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h3 style={{
          color: 'white',
          fontSize: '18px',
          fontWeight: '600',
          margin: 0
        }}>
          Token Swap
        </h3>
        <button style={{
          background: 'none',
          border: 'none',
          color: '#a0aec0',
          cursor: 'pointer',
          fontSize: '18px'
        }}>
          ⚙️
        </button>
      </div>

      {/* From Token */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{
          color: '#a0aec0',
          fontSize: '14px',
          fontWeight: '500',
          display: 'block',
          marginBottom: '8px'
        }}>
          From
        </label>
        <div style={{
          background: '#1a202c',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #4a5568',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              fontWeight: '600',
              outline: 'none',
              width: '60%'
            }}
          />
          <button style={{
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
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%'
            }}></div>
            {fromToken} ▼
          </button>
        </div>
        <div style={{
          color: '#718096',
          fontSize: '12px',
          marginTop: '4px',
          textAlign: 'right'
        }}>
          Balance: 2.5 ETH
        </div>
      </div>

      {/* Swap Arrow */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '16px 0'
      }}>
        <button style={{
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
        }}>
          ↕️
        </button>
      </div>

      {/* To Token */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          color: '#a0aec0',
          fontSize: '14px',
          fontWeight: '500',
          display: 'block',
          marginBottom: '8px'
        }}>
          To
        </label>
        <div style={{
          background: '#1a202c',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #4a5568',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <input
            type="number"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder="0.0"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              fontWeight: '600',
              outline: 'none',
              width: '60%'
            }}
          />
          <button style={{
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
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
              borderRadius: '50%'
            }}></div>
            {toToken} ▼
          </button>
        </div>
        <div style={{
          color: '#718096',
          fontSize: '12px',
          marginTop: '4px',
          textAlign: 'right'
        }}>
          Balance: 1,250 USDC
        </div>
      </div>

      {/* Rate and Fee */}
      <div style={{
        background: '#1a202c',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px',
        border: '1px solid #4a5568'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span style={{ color: '#a0aec0', fontSize: '14px' }}>Rate</span>
          <span style={{ color: 'white', fontSize: '14px' }}>1 ETH = 2,456.78 USDC</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span style={{ color: '#a0aec0', fontSize: '14px' }}>Fee</span>
          <span style={{ color: 'white', fontSize: '14px' }}>0.3%</span>
        </div>
      </div>

      {/* Swap Button */}
      <button style={{
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
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = 'none';
      }}>
        Swap Tokens
      </button>
    </div>
  );
};

export default TokenSwap;