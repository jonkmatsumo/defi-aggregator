import React, { useState, useEffect, useRef, useCallback } from "react";
import { useChainId, useClient } from "wagmi";
import GasPriceService from "../services/gasPriceService";

const NetworkStatus = ({ maxNetworks = 3 }) => {
  const [gasPrices, setGasPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentNetworkInfo, setCurrentNetworkInfo] = useState(null);
  const [hasInitialData, setHasInitialData] = useState(false);

  const gasPriceService = useRef(new GasPriceService());
  const intervalRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Wagmi hooks for network information
  const chainId = useChainId();
  const client = useClient();

  // Get supported networks
  const supportedNetworks = GasPriceService.getSupportedNetworks();
  const networkKeys = Object.keys(supportedNetworks).slice(0, maxNetworks);

  // Fetch gas prices for all networks
  const fetchAllGasPrices = useCallback(async () => {
    // Only show loading if we don't have any data yet
    if (!hasInitialData) {
      setLoading(true);
    }
    setError(null);

    try {
      const prices =
        await gasPriceService.current.fetchMultipleGasPrices(networkKeys);

      // Also fetch gas price for the currently connected network if available
      if (client && chainId && typeof client.getGasPrice === "function") {
        try {
          const connectedNetworkGasPrice =
            await GasPriceService.fetchConnectedWalletGasPrice(client);
          const connectedNetworkKey = Object.keys(supportedNetworks).find(
            key => supportedNetworks[key].chainId === chainId
          );

          if (connectedNetworkKey) {
            prices[connectedNetworkKey] = connectedNetworkGasPrice;
          }
        } catch (error) {
          console.warn("Failed to fetch connected network gas price:", error);
        }
      }

      setGasPrices(prices);
      setHasInitialData(true);
    } catch (error) {
      console.error("Error fetching gas prices:", error);
      setError("Failed to fetch gas prices");

      // Set fallback data on error (don't update timestamp)
      const fallbackData = {};
      networkKeys.forEach(networkKey => {
        fallbackData[networkKey] =
          GasPriceService.getFallbackGasPrices()[networkKey];
      });
      setGasPrices(fallbackData);
      setHasInitialData(true);
    } finally {
      setLoading(false);
    }
  }, [chainId, client, supportedNetworks, networkKeys, hasInitialData]);

  // Update current network info when chain changes
  useEffect(() => {
    if (chainId) {
      const networkInfo = GasPriceService.getNetworkInfo(chainId);
      setCurrentNetworkInfo(networkInfo);
    }
  }, [chainId]);

  // Initialize component and set up refresh interval
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchAllGasPrices();

      // Refresh gas prices every 30 minutes to reduce API calls and avoid 429 errors
      intervalRef.current = setInterval(fetchAllGasPrices, 1800000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAllGasPrices]);

  // Manual refresh function
  const handleRefresh = () => {
    gasPriceService.current.clearCache();
    setLoading(true); // Show loading on manual refresh
    fetchAllGasPrices();
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
        borderRadius: "16px",
        padding: "20px",
        border: "1px solid #4a5568",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            color: "white",
            fontSize: "16px",
            fontWeight: "600",
            margin: "0",
          }}
        >
          Network Status
          {currentNetworkInfo && (
            <span
              style={{
                fontSize: "12px",
                color: "#a0aec0",
                marginLeft: "8px",
                fontWeight: "400",
              }}
            >
              ({currentNetworkInfo.name})
            </span>
          )}
        </h3>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {loading && !hasInitialData && (
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid #4a5568",
                borderTop: "2px solid #48bb78",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
          )}

          {loading && hasInitialData && (
            <div
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: "#48bb78",
                borderRadius: "50%",
                opacity: 0.6,
              }}
            ></div>
          )}

          <button
            onClick={handleRefresh}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "#48bb78",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "12px",
              padding: "4px 8px",
              borderRadius: "4px",
              opacity: loading ? 0.5 : 1,
            }}
            title="Refresh gas prices"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            color: "#f56565",
            fontSize: "12px",
            marginBottom: "12px",
            padding: "8px",
            backgroundColor: "rgba(245, 101, 101, 0.1)",
            borderRadius: "4px",
          }}
        >
          {error} - Showing cached data
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {networkKeys.map(networkKey => {
          const network = supportedNetworks[networkKey];
          const gasData = gasPrices[networkKey];
          const status = GasPriceService.getNetworkStatus(gasData);
          const gasPrice = GasPriceService.getDisplayGasPrice(gasData);
          const isCurrentNetwork =
            currentNetworkInfo &&
            currentNetworkInfo.chainId === network.chainId;

          return (
            <div
              key={networkKey}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: isCurrentNetwork
                  ? "rgba(72, 187, 120, 0.1)"
                  : "transparent",
                borderRadius: "4px",
                padding: isCurrentNetwork ? "8px" : "8px 0",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor:
                      status === "online" ? "#48bb78" : "#f56565",
                    borderRadius: "50%",
                  }}
                ></div>
                <span
                  style={{
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  {network.name}
                  {isCurrentNetwork && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#48bb78",
                        marginLeft: "4px",
                      }}
                    >
                      (current)
                    </span>
                  )}
                </span>
              </div>
              <span
                style={{
                  color: "#a0aec0",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {loading && !hasInitialData ? "..." : gasPrice}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NetworkStatus;
