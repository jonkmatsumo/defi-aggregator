import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import LendingService from '../services/lendingService';

const LendingSection = () => {
  const [lendingAssets, setLendingAssets] = useState({ compound: [], aave: [], all: [] });
  const [userBalances, setUserBalances] = useState({ compound: [], aave: [], totalSupplied: 0, totalBorrowed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAction, setSelectedAction] = useState('supply'); // 'supply', 'withdraw', 'borrow', 'repay'
  const [selectedPlatform, setSelectedPlatform] = useState('compound');
  const [selectedToken, setSelectedToken] = useState(null);
  const [amount, setAmount] = useState('');
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  
  const isInitializedRef = useRef(false);
  const lendingService = useRef(new LendingService());

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  // Fetch lending data
  const fetchLendingData = useCallback(async () => {
    if (!isConnected || !address) {
      setLendingAssets({
        compound: lendingService.current.getFallbackCompoundTokens(),
        aave: lendingService.current.getFallbackAaveReserves(),
        all: [...lendingService.current.getFallbackCompoundTokens(), ...lendingService.current.getFallbackAaveReserves()]
      });
      setUserBalances({ compound: [], aave: [], totalSupplied: 0, totalBorrowed: 0 });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [assets, balances] = await Promise.all([
        lendingService.current.fetchAllLendingAssets(),
        lendingService.current.fetchUserBalances(address, publicClient)
      ]);

      setLendingAssets(assets);
      setUserBalances(balances);
    } catch (error) {
      console.error('Error fetching lending data:', error);
      setError('Failed to fetch lending data');
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, publicClient]);

  // Initialize component and handle wallet connection changes
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
    fetchLendingData();
  }, [fetchLendingData]);

  // Execute lending action
  const executeAction = async () => {
    if (!selectedToken || !amount || !isConnected || !address) {
      setError('Please select a token and enter an amount');
      return;
    }

    setLoading(true);
    setError(null);
    setTransactionStatus('pending');

    try {
      let result;
      const tokenAddress = selectedToken.address;
      const amountValue = parseFloat(amount);

      switch (selectedAction) {
        case 'supply':
          result = await lendingService.current.supplyTokens(
            selectedPlatform,
            tokenAddress,
            amountValue,
            address,
            publicClient
          );
          break;
        case 'withdraw':
          result = await lendingService.current.withdrawTokens(
            selectedPlatform,
            tokenAddress,
            amountValue,
            address,
            publicClient
          );
          break;
        case 'borrow':
          result = await lendingService.current.borrowTokens(
            selectedPlatform,
            tokenAddress,
            amountValue,
            address,
            publicClient
          );
          break;
        case 'repay':
          result = await lendingService.current.repayTokens(
            selectedPlatform,
            tokenAddress,
            amountValue,
            address,
            publicClient
          );
          break;
        default:
          throw new Error('Invalid action');
      }

      if (result.success) {
        setTransactionStatus('success');
        setTransactionHash(result.transactionHash);
        setAmount('');
        setSelectedToken(null);
        
        // Refresh data after successful transaction
        setTimeout(() => {
          fetchLendingData();
        }, 2000);
      } else {
        setTransactionStatus('failed');
        setError('Transaction failed');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setTransactionStatus('failed');
      setError(error.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  // Get available tokens for selected platform
  const getAvailableTokens = () => {
    if (selectedPlatform === 'compound') {
      return lendingAssets.compound;
    } else if (selectedPlatform === 'aave') {
      return lendingAssets.aave;
    }
    return [];
  };

  // Format APY
  const formatAPY = (rate) => {
    return (rate * 100).toFixed(2);
  };

  // Get action button text
  const getActionButtonText = () => {
    switch (selectedAction) {
      case 'supply': return 'Supply';
      case 'withdraw': return 'Withdraw';
      case 'borrow': return 'Borrow';
      case 'repay': return 'Repay';
      default: return 'Execute';
    }
  };

  // Get action color
  const getActionColor = () => {
    switch (selectedAction) {
      case 'supply': return '#48bb78';
      case 'withdraw': return '#ed8936';
      case 'borrow': return '#667eea';
      case 'repay': return '#f56565';
      default: return '#a0aec0';
    }
  };

  // Get transaction status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'success': return '#48bb78';
      case 'failed': return '#f56565';
      default: return '#a0aec0';
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #4a5568',
      color: '#e2e8f0'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{
          color: 'white',
          fontSize: '18px',
          fontWeight: 'bold',
          margin: '0'
        }}>
          Lending & Borrowing
          {!isConnected && (
            <span style={{
              fontSize: '12px',
              color: '#a0aec0',
              marginLeft: '8px',
              fontWeight: '400'
            }}>
              (Demo Mode)
            </span>
          )}
        </h3>
        
        <button
          onClick={fetchLendingData}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: '#48bb78',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '6px',
            opacity: loading ? 0.5 : 1
          }}
          title="Refresh lending data"
        >
          ↻ Refresh
        </button>
      </div>

      {!isConnected && (
        <div style={{
          color: '#fbbf24',
          fontSize: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderRadius: '8px'
        }}>
          Connect your wallet to start lending and borrowing
        </div>
      )}

      {error && (
        <div style={{
          color: '#f56565',
          fontSize: '12px',
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          borderRadius: '8px'
        }}>
          {error}
        </div>
      )}

      {/* User Balances Summary */}
      {isConnected && (
        <div style={{
          background: '#2d3748',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#a0aec0' }}>
            Your Positions
          </h4>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#a0aec0' }}>Total Supplied</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#48bb78' }}>
                ${userBalances.totalSupplied.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#a0aec0' }}>Total Borrowed</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f56565' }}>
                ${userBalances.totalBorrowed.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px'
      }}>
        {['supply', 'withdraw', 'borrow', 'repay'].map((action) => (
          <button
            key={action}
            onClick={() => setSelectedAction(action)}
            style={{
              background: selectedAction === action ? getActionColor() : '#2d3748',
              border: '1px solid #4a5568',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              textTransform: 'capitalize'
            }}
          >
            {action}
          </button>
        ))}
      </div>

      {/* Platform Selection */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', color: '#a0aec0', marginBottom: '8px' }}>
          Select Platform
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {LendingService.getPlatforms().map((platform) => (
            <button
              key={platform.id}
              onClick={() => setSelectedPlatform(platform.id)}
              style={{
                background: selectedPlatform === platform.id ? '#667eea' : '#2d3748',
                border: '1px solid #4a5568',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{platform.logo}</span>
              {platform.name}
            </button>
          ))}
        </div>
      </div>

      {/* Token Selection */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', color: '#a0aec0', marginBottom: '8px' }}>
          Select Token
        </div>
        <button
          onClick={() => setShowTokenSelector(true)}
          style={{
            width: '100%',
            background: '#2d3748',
            border: '1px solid #4a5568',
            borderRadius: '8px',
            padding: '12px',
            color: selectedToken ? 'white' : '#a0aec0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedToken ? (
              <>
                <span style={{ fontSize: '20px' }}>{selectedToken.logo}</span>
                <span>{selectedToken.symbol}</span>
                <span style={{ fontSize: '12px', color: '#a0aec0' }}>
                  ({selectedToken.platform})
                </span>
              </>
            ) : (
              'Choose a token'
            )}
          </div>
          <span>▼</span>
        </button>
      </div>

      {/* Amount Input */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', color: '#a0aec0', marginBottom: '8px' }}>
          Amount
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          style={{
            width: '100%',
            background: '#2d3748',
            border: '1px solid #4a5568',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '16px',
            color: '#e2e8f0'
          }}
        />
      </div>

      {/* Token Info */}
      {selectedToken && (
        <div style={{
          background: '#2d3748',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#a0aec0' }}>Supply APY:</span>
            <span style={{ fontSize: '12px', color: '#48bb78' }}>
              {formatAPY(selectedToken.supplyRate)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#a0aec0' }}>Borrow APY:</span>
            <span style={{ fontSize: '12px', color: '#f56565' }}>
              {formatAPY(selectedToken.borrowRate)}%
            </span>
          </div>
        </div>
      )}

      {/* Transaction Status */}
      {transactionStatus && (
        <div style={{
          background: '#2d3748',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(transactionStatus),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'white'
          }}>
            {transactionStatus === 'pending' && '⏳'}
            {transactionStatus === 'success' && '✅'}
            {transactionStatus === 'failed' && '❌'}
          </div>
          <span style={{ fontSize: '14px' }}>
            Transaction {transactionStatus}
          </span>
        </div>
      )}

      {/* Transaction Hash */}
      {transactionHash && (
        <div style={{
          background: '#2d3748',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '4px' }}>
            Transaction Hash:
          </div>
          <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
          </div>
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeAction}
        disabled={loading || !selectedToken || !amount || !isConnected}
        style={{
          width: '100%',
          background: getActionColor(),
          border: 'none',
          borderRadius: '8px',
          padding: '16px',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: loading || !selectedToken || !amount || !isConnected ? 'not-allowed' : 'pointer',
          opacity: loading || !selectedToken || !amount || !isConnected ? 0.5 : 1
        }}
      >
        {loading ? 'Processing...' : getActionButtonText()}
      </button>

      {/* Available Assets List */}
      <div style={{ marginTop: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'white' }}>
          Available Assets
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {getAvailableTokens().map((token, index) => (
            <div
              key={`${token.platform}-${token.symbol}-${index}`}
              style={{
                background: '#2d3748',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{token.logo}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                    {token.symbol}
                  </div>
                  <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                    {token.platform}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#48bb78' }}>
                  Supply: {formatAPY(token.supplyRate)}%
                </div>
                <div style={{ fontSize: '12px', color: '#f56565' }}>
                  Borrow: {formatAPY(token.borrowRate)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2d3748',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h4 style={{ margin: 0, color: 'white' }}>Select Token</h4>
              <button
                onClick={() => setShowTokenSelector(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#a0aec0',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getAvailableTokens().map((token, index) => (
                <button
                  key={`${token.platform}-${token.symbol}-${index}`}
                  onClick={() => {
                    setSelectedToken(token);
                    setShowTokenSelector(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#1a202c',
                    border: '1px solid #4a5568',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <span style={{ fontSize: '20px', marginRight: '12px' }}>{token.logo}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      {token.symbol}
                    </div>
                    <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                      {token.name} ({token.platform})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#48bb78' }}>
                      {formatAPY(token.supplyRate)}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LendingSection;