import React, { useState, useEffect, useCallback } from "react";
import { useAccount, useClient, useChainId } from "wagmi"; // useClient instead of useSigner, useProvider, and useNetwork
import { ethers } from "ethers";
const { utils } = ethers; // Access utils from ethers

// Common token addresses for Ethereum mainnet
const COMMON_TOKENS = {
  1: {
    // Ethereum mainnet
    ETH: {
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEe",
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      logo: "🔷",
    },
    USDC: {
      address: "0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      logo: "💙",
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      logo: "🟡",
    },
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      logo: "🔷",
    },
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      logo: "💚",
    },
  },
};

const TokenSwap = () => {
  // Wagmi hooks
  const { isConnected } = useAccount(); // Get wallet connection status
  const client = useClient(); // Get full client (provider, signer, etc.)
  const chainId = useChainId(); // Get current chain ID

  // State management
  const [fromToken, setFromToken] = useState(COMMON_TOKENS[1]?.ETH || {});
  const [toToken, setToToken] = useState(COMMON_TOKENS[1]?.USDC || {});
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [slippage, setSlippage] = useState(1); // Default 1% slippage
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [selectedTokenType, setSelectedTokenType] = useState(null); // 'from' or 'to'

  // Get available tokens for current chain
  const availableTokens = COMMON_TOKENS[chainId] || COMMON_TOKENS[1] || {};

  // Fetch quote from 1inch API using direct API call
  const fetchQuote = useCallback(async () => {
    if (!amount || !fromToken.address || !toToken.address || !chainId) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert amount to wei (or appropriate decimals)
      const decimals = fromToken.decimals || 18;
      let amountInWei;
      try {
        // Use utils.parseUnits properly
        amountInWei = utils.parseUnits(amount, decimals).toString();
      } catch (error) {
        // Fallback for testing or when ethers is not available
        amountInWei = (parseFloat(amount) * Math.pow(10, decimals)).toString();
      }

      // Use proxy for 1inch API call
      const apiKey = process.env.REACT_APP_1INCH_API_KEY || "demo"; // Use demo for testing
      const apiUrl = `/swap/v5.2/${chainId}/quote`;

      const params = new URLSearchParams({
        src: fromToken.address,
        dst: toToken.address,
        amount: amountInWei,
        slippage: slippage,
      });

      const response = await fetch(`${apiUrl}?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setQuote(data);
    } catch (err) {
      console.error("Error fetching quote:", err);
      setError(err.message || "Failed to fetch quote");
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    fromToken.address,
    fromToken.decimals,
    toToken.address,
    chainId,
    slippage,
  ]);

  // Fetch quote when dependencies change
  useEffect(() => {
    if (amount && fromToken.address && toToken.address) {
      const timeoutId = setTimeout(fetchQuote, 500); // Debounce
      return () => clearTimeout(timeoutId);
    }
  }, [amount, fromToken.address, toToken.address, fetchQuote]);

  // Execute swap transaction
  const executeSwap = async () => {
    if (!quote || !client || !isConnected) {
      setError("Please connect your wallet and get a quote first");
      return;
    }

    setLoading(true);
    setError(null);
    setTransactionStatus("pending");

    try {
      // Prepare transaction
      const tx = {
        to: quote.tx.to,
        data: quote.tx.data,
        value: quote.tx.value || "0x0",
        gasLimit: quote.tx.gas || "300000",
        gasPrice: quote.tx.gasPrice || (await client.provider.getGasPrice()),
      };

      // Send transaction
      const transaction = await client.getSigner().sendTransaction(tx);
      setTransactionHash(transaction.hash);

      // Wait for confirmation
      const receipt = await transaction.wait();
      if (receipt.status === 1) {
        setTransactionStatus("success");
        // Reset form
        setAmount("");
        setQuote(null);
      } else {
        setTransactionStatus("failed");
        setError("Transaction failed");
      }
    } catch (err) {
      console.error("Swap error:", err);
      setTransactionStatus("failed");
      setError(err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // Switch tokens
  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setQuote(null);
  };

  // Select token
  const selectToken = token => {
    if (selectedTokenType === "from") {
      setFromToken(token);
    } else if (selectedTokenType === "to") {
      setToToken(token);
    }
    setShowTokenSelector(false);
    setSelectedTokenType(null);
  };

  // Get transaction status color
  const getStatusColor = status => {
    switch (status) {
      case "pending":
        return "#fbbf24";
      case "success":
        return "#48bb78";
      case "failed":
        return "#f56565";
      default:
        return "#a0aec0";
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Token Swap</h3>

      {!isConnected ? (
        <div style={styles.connectMessage}>
          <p>Connect your wallet to start swapping tokens</p>
          <button style={styles.connectButton}>Connect Wallet</button>
        </div>
      ) : (
        <>
          {/* Token Selection */}
          <div style={styles.tokenSection}>
            <div style={styles.tokenRow}>
              <div style={styles.tokenLabel}>From</div>
              <button
                style={styles.tokenButton}
                onClick={() => {
                  setSelectedTokenType("from");
                  setShowTokenSelector(true);
                }}
              >
                <span style={styles.tokenLogo}>{fromToken.logo}</span>
                <span style={styles.tokenSymbol}>{fromToken.symbol}</span>
                <span style={styles.tokenArrow}>▼</span>
              </button>
            </div>

            <button style={styles.switchButton} onClick={switchTokens}>
              ↓
            </button>

            <div style={styles.tokenRow}>
              <div style={styles.tokenLabel}>To</div>
              <button
                style={styles.tokenButton}
                onClick={() => {
                  setSelectedTokenType("to");
                  setShowTokenSelector(true);
                }}
              >
                <span style={styles.tokenLogo}>{toToken.logo}</span>
                <span style={styles.tokenSymbol}>{toToken.symbol}</span>
                <span style={styles.tokenArrow}>▼</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div style={styles.amountSection}>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.0"
              style={styles.amountInput}
            />
            <div style={styles.amountLabel}>{fromToken.symbol} Amount</div>
          </div>

          {/* Slippage Selection */}
          <div style={styles.slippageSection}>
            <div style={styles.slippageLabel}>Slippage Tolerance</div>
            <div style={styles.slippageButtons}>
              {[0.5, 1, 2].map(value => (
                <button
                  key={value}
                  style={{
                    ...styles.slippageButton,
                    ...(slippage === value && styles.slippageButtonActive),
                  }}
                  onClick={() => setSlippage(value)}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          {/* Quote Display */}
          {quote && (
            <div style={styles.quoteSection}>
              <div style={styles.quoteRow}>
                <span>Price Impact:</span>
                <span style={styles.quoteValue}>
                  {quote.priceImpact || "N/A"}%
                </span>
              </div>
              <div style={styles.quoteRow}>
                <span>Estimated Gas:</span>
                <span style={styles.quoteValue}>
                  {quote.tx?.gas
                    ? `${parseInt(quote.tx.gas) / Math.pow(10, 9)} Gwei`
                    : "N/A"}
                </span>
              </div>
              <div style={styles.quoteRow}>
                <span>Route:</span>
                <span style={styles.quoteValue}>
                  {quote.protocols?.[0]?.[0]?.name || "N/A"}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && <div style={styles.errorMessage}>{error}</div>}

          {/* Transaction Status */}
          {transactionStatus && (
            <div style={styles.statusSection}>
              <div
                style={{
                  ...styles.statusIndicator,
                  backgroundColor: getStatusColor(transactionStatus),
                }}
              >
                {transactionStatus === "pending" && "⏳"}
                {transactionStatus === "success" && "✅"}
                {transactionStatus === "failed" && "❌"}
              </div>
              <span style={styles.statusText}>
                Transaction {transactionStatus}
              </span>
            </div>
          )}

          {/* Transaction Hash */}
          {transactionHash && (
            <div style={styles.hashSection}>
              <div style={styles.hashLabel}>Transaction Hash:</div>
              <div style={styles.hashValue}>
                {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
              </div>
            </div>
          )}

          {/* Swap Button */}
          <button
            style={{
              ...styles.swapButton,
              ...((loading || !quote || transactionStatus === "pending") &&
                styles.swapButtonDisabled),
            }}
            onClick={executeSwap}
            disabled={loading || !quote || transactionStatus === "pending"}
          >
            {loading ? "Loading..." : "Swap"}
          </button>

          {/* Token Selector Modal */}
          {showTokenSelector && (
            <div style={styles.modalOverlay}>
              <div style={styles.modal}>
                <div style={styles.modalHeader}>
                  <h4>Select Token</h4>
                  <button
                    style={styles.closeButton}
                    onClick={() => setShowTokenSelector(false)}
                  >
                    ×
                  </button>
                </div>
                <div style={styles.tokenList}>
                  {Object.values(availableTokens).map(token => (
                    <button
                      key={token.address}
                      style={styles.tokenOption}
                      onClick={() => selectToken(token)}
                    >
                      <span style={styles.tokenLogo}>{token.logo}</span>
                      <div style={styles.tokenInfo}>
                        <div style={styles.tokenName}>{token.name}</div>
                        <div style={styles.tokenSymbol}>{token.symbol}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #4a5568",
    width: "100%",
    maxWidth: "100%",
    color: "#e2e8f0",
    height: "fit-content",
  },
  title: {
    margin: "0 0 20px 0",
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center",
  },
  connectMessage: {
    textAlign: "center",
    padding: "40px 20px",
  },
  connectButton: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "12px 24px",
    fontSize: "16px",
    cursor: "pointer",
    marginTop: "16px",
  },
  tokenSection: {
    marginBottom: "20px",
  },
  tokenRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: "12px",
  },
  tokenLabel: {
    width: "60px",
    fontSize: "14px",
    color: "#a0aec0",
  },
  tokenButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    background: "#2d3748",
    border: "1px solid #4a5568",
    borderRadius: "8px",
    padding: "12px",
    color: "#e2e8f0",
    cursor: "pointer",
  },
  tokenLogo: {
    fontSize: "20px",
    marginRight: "8px",
  },
  tokenSymbol: {
    flex: 1,
    fontSize: "16px",
    fontWeight: "bold",
  },
  tokenArrow: {
    fontSize: "12px",
    color: "#a0aec0",
  },
  switchButton: {
    background: "#4a5568",
    border: "none",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    color: "#e2e8f0",
    cursor: "pointer",
    margin: "8px auto",
    display: "block",
  },
  amountSection: {
    marginBottom: "20px",
  },
  amountInput: {
    width: "100%",
    background: "#2d3748",
    border: "1px solid #4a5568",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "18px",
    color: "#e2e8f0",
    marginBottom: "8px",
  },
  amountLabel: {
    fontSize: "14px",
    color: "#a0aec0",
  },
  slippageSection: {
    marginBottom: "20px",
  },
  slippageLabel: {
    fontSize: "14px",
    color: "#a0aec0",
    marginBottom: "8px",
  },
  slippageButtons: {
    display: "flex",
    gap: "8px",
  },
  slippageButton: {
    flex: 1,
    background: "#2d3748",
    border: "1px solid #4a5568",
    borderRadius: "6px",
    padding: "8px",
    color: "#e2e8f0",
    cursor: "pointer",
  },
  slippageButtonActive: {
    background: "#667eea",
    border: "1px solid #667eea",
  },
  quoteSection: {
    background: "#2d3748",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  },
  quoteRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  quoteValue: {
    color: "#a0aec0",
  },
  errorMessage: {
    background: "#fed7d7",
    color: "#c53030",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "16px",
  },
  statusSection: {
    display: "flex",
    alignItems: "center",
    marginBottom: "16px",
  },
  statusIndicator: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    marginRight: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
  },
  statusText: {
    fontSize: "14px",
  },
  hashSection: {
    background: "#2d3748",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "16px",
  },
  hashLabel: {
    fontSize: "12px",
    color: "#a0aec0",
    marginBottom: "4px",
  },
  hashValue: {
    fontSize: "14px",
    fontFamily: "monospace",
  },
  swapButton: {
    width: "100%",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  swapButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#2d3748",
    borderRadius: "12px",
    padding: "20px",
    maxWidth: "400px",
    width: "90%",
    maxHeight: "80vh",
    overflow: "auto",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    color: "#a0aec0",
    cursor: "pointer",
  },
  tokenList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  tokenOption: {
    display: "flex",
    alignItems: "center",
    background: "#1a202c",
    border: "1px solid #4a5568",
    borderRadius: "8px",
    padding: "12px",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "left",
  },
  tokenInfo: {
    marginLeft: "12px",
  },
  tokenName: {
    fontSize: "14px",
    fontWeight: "bold",
  },
};

export default TokenSwap;
