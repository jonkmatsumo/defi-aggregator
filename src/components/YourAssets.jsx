import React, { useState, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import TokenBalanceService from '../services/tokenBalanceService';

const YourAssets = ({ maxAssets = 3, forceRefresh = false }) => {
  const [assets, setAssets] = useState(TokenBalanceService.getFallbackAssets());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasInitialData, setHasInitialData] = useState(true);
  
  const tokenBalanceService = useRef(new TokenBalanceService());
  const isInitializedRef = useRef(false);
  const lastForceRefreshRef = useRef(false);

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  // Initialize component
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  }, []);

  // Handle wallet connection changes and force refresh
  useEffect(() => {
    if (isConnected && address && publicClient) {
      // Fetch initial data
      fetchTokenBalances();
    } else {
      // Wallet disconnected, show fallback data
      setAssets(TokenBalanceService.getFallbackAssets());
      setError(null);
      setLoading(false);
    }
  }, [isConnected, address, publicClient]);

  // Handle force refresh flag
  useEffect(() => {
    if (forceRefresh && !lastForceRefreshRef.current && isConnected && address && publicClient) {
      lastForceRefreshRef.current = true;
      fetchTokenBalances();
    } else if (!forceRefresh) {
      lastForceRefreshRef.current = false;
    }
  }, [forceRefresh, isConnected, address, publicClient]);

  // Fetch token balances function
  const fetchTokenBalances = async () => {
    if (!isConnected || !address || !publicClient) {
      setAssets(TokenBalanceService.getFallbackAssets());
      setError(null);
      setLoading(false);
      return;
    }

    console.log('YourAssets - Fetching real token balances for connected wallet');
    setLoading(true);
    setError(null);

    try {
      const balances = await tokenBalanceService.current.fetchAllTokenBalances(
        publicClient, 
        address, 
        maxAssets
      );

      // If no balances found, set empty array
      if (!balances || balances.length === 0) {
        setAssets([]);
        setHasInitialData(true);
        return;
      }

      // Calculate USD values for each asset
      const assetsWithValues = balances.map(asset => ({
        ...asset,
        value: TokenBalanceService.calculateUSDValue(asset.balance, asset.symbol),
        balance: TokenBalanceService.formatBalance(asset.balance, asset.decimals)
      }));

      setAssets(assetsWithValues);
      setHasInitialData(true);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      setError('Failed to fetch token balances');
      setAssets([]); // Set empty array on error instead of fallback data
      setHasInitialData(true);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    if (!isConnected || !address || !publicClient) {
      setAssets(TokenBalanceService.getFallbackAssets());
      return;
    }

    setLoading(true);
    setError(null);

    tokenBalanceService.current.fetchAllTokenBalances(publicClient, address, maxAssets)
      .then(balances => {
        if (!balances || balances.length === 0) {
          setAssets([]);
          return;
        }
        
        const assetsWithValues = balances.map(asset => ({
          ...asset,
          value: TokenBalanceService.calculateUSDValue(asset.balance, asset.symbol),
          balance: TokenBalanceService.formatBalance(asset.balance, asset.decimals)
        }));
        setAssets(assetsWithValues);
      })
      .catch(error => {
        console.error('Error fetching token balances:', error);
        setError('Failed to fetch token balances');
        setAssets([]); // Set empty array on error instead of fallback data
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Get display assets (either real data or fallback)
  const displayAssets = isConnected ? assets : TokenBalanceService.getFallbackAssets();

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid #4a5568'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          margin: '0'
        }}>
          Your Assets
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && !hasInitialData && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #4a5568',
              borderTop: '2px solid #48bb78',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          )}
          
          {loading && hasInitialData && (
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#48bb78',
              borderRadius: '50%',
              opacity: 0.6
            }}></div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#48bb78',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              opacity: loading ? 0.5 : 1
            }}
            title="Refresh token balances"
          >
            ↻
          </button>
        </div>
      </div>

      {!isConnected && (
        <div style={{
          color: '#fbbf24',
          fontSize: '12px',
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderRadius: '4px'
        }}>
          Connect your wallet to see real token balances
        </div>
      )}

      {error && (
        <div style={{
          color: '#f56565',
          fontSize: '12px',
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {isConnected && !loading && assets.length === 0 && (
        <div style={{
          color: '#a0aec0',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px',
          backgroundColor: 'rgba(160, 174, 192, 0.1)',
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          No tokens found in your wallet
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {displayAssets.map((asset, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: index < displayAssets.length - 1 ? '1px solid #4a5568' : 'none'
          }}>
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
                {asset.symbol.slice(0, 2).toUpperCase()}
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