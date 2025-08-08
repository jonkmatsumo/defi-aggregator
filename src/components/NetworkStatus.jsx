import React, { useState, useEffect, useRef } from 'react';
import GasPriceService from '../services/gasPriceService';

const NetworkStatus = ({ maxNetworks = 3 }) => {
  const [gasPrices, setGasPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const gasPriceService = useRef(new GasPriceService());
  const intervalRef = useRef(null);

  // Get supported networks
  const supportedNetworks = GasPriceService.getSupportedNetworks();
  const networkKeys = Object.keys(supportedNetworks).slice(0, maxNetworks);

  // Fetch gas prices for all networks
  const fetchAllGasPrices = async () => {
    setLoading(true);
    setError(null);

    try {
      const prices = await gasPriceService.current.fetchMultipleGasPrices(networkKeys);
      setGasPrices(prices);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching gas prices:', error);
      setError('Failed to fetch gas prices');
      
      // Set fallback data on error
      const fallbackData = {};
      networkKeys.forEach(networkKey => {
        fallbackData[networkKey] = GasPriceService.getFallbackGasPrices()[networkKey];
      });
      setGasPrices(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  // Fetch gas prices on component mount and set up refresh interval
  useEffect(() => {
    fetchAllGasPrices();
    
    // Refresh gas prices every 30 seconds
    intervalRef.current = setInterval(fetchAllGasPrices, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [maxNetworks]);

  // Manual refresh function
  const handleRefresh = () => {
    gasPriceService.current.clearCache();
    fetchAllGasPrices();
  };

  // Format last updated time
  const formatLastUpdated = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  // Check if any network is in demo mode
  const isDemoMode = Object.values(supportedNetworks).some(network => network.apiKey === 'demo');

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
          Network Status
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #4a5568',
              borderTop: '2px solid #48bb78',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
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
            title="Refresh gas prices"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          color: '#f56565',
          fontSize: '12px',
          marginBottom: '12px',
          padding: '8px',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          borderRadius: '4px'
        }}>
          {error} - Showing cached data
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {networkKeys.map((networkKey) => {
          const network = supportedNetworks[networkKey];
          const gasData = gasPrices[networkKey];
          const status = GasPriceService.getNetworkStatus(gasData);
          const gasPrice = GasPriceService.getDisplayGasPrice(gasData);

          return (
            <div
              key={networkKey}
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
                  backgroundColor: status === 'online' ? '#48bb78' : '#f56565',
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
                {loading ? '...' : gasPrice}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '12px',
        padding: '8px',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#a0aec0'
      }}>
        <div>Gas prices update every 30 seconds</div>
        {lastUpdated && (
          <div style={{ marginTop: '2px', fontSize: '10px' }}>
            Last updated: {formatLastUpdated(lastUpdated)}
          </div>
        )}
        {isDemoMode && (
          <div style={{ marginTop: '4px', color: '#f56565' }}>
            Demo mode - using cached data
          </div>
        )}
      </div>


    </div>
  );
};

export default NetworkStatus;