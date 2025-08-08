import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { formatUnits, getContract } from 'viem';

// ERC-20 ABI for token transfers
const erc20Abi = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

const RecentActivity = ({ transactionCount = 3, forceRefresh = false }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasInitialData, setHasInitialData] = useState(false);
  
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
      fetchTransactions();
    } else {
      setTransactions(getFallbackTransactions());
      setError(null);
      setLoading(false);
    }
  }, [isConnected, address, publicClient]);

  // Handle force refresh flag
  useEffect(() => {
    if (forceRefresh && !lastForceRefreshRef.current && isConnected && address && publicClient) {
      lastForceRefreshRef.current = true;
      fetchTransactions();
    } else if (!forceRefresh) {
      lastForceRefreshRef.current = false;
    }
  }, [forceRefresh, isConnected, address, publicClient, transactionCount]);

  // Fetch transactions function
  const fetchTransactions = useCallback(async () => {
    if (!isConnected || !address || !publicClient) {
      setTransactions(getFallbackTransactions());
      setError(null);
      setLoading(false);
      return;
    }

    console.log('RecentActivity - Fetching transactions for address:', address?.slice(0, 10) + '...');
    setLoading(true);
    setError(null);

    try {
      const txHistory = await getTransactionHistory(publicClient, address, transactionCount);
      setTransactions(txHistory);
      setHasInitialData(true);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transaction history');
      setTransactions(getFallbackTransactions());
      setHasInitialData(true);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, publicClient, transactionCount]);

  // Get transaction history from blockchain
  const getTransactionHistory = async (client, userAddress, count) => {
    try {
      // Get recent blocks to search for transactions
      const currentBlock = await client.getBlockNumber();
      const transactions = [];
      
      // Search through recent blocks (last 100 blocks should be sufficient for recent activity)
      const searchBlocks = Math.min(100, count * 10); // Search more blocks than needed
      
      for (let i = 0; i < searchBlocks && transactions.length < count; i++) {
        // Ensure we don't go below 0 when subtracting from currentBlock
        // eslint-disable-next-line no-undef
        const iBigInt = BigInt(i);
        // eslint-disable-next-line no-undef
        const currentBlockBigInt = typeof currentBlock === 'bigint' ? currentBlock : BigInt(currentBlock);
        if (currentBlockBigInt < iBigInt) break;
        const blockNumber = currentBlockBigInt - iBigInt;
        
        try {
          const block = await client.getBlock({
            blockNumber,
            includeTransactions: true
          });
          
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (transactions.length >= count) break;
              
              // Check if transaction involves the user
              if (tx.from?.toLowerCase() === userAddress.toLowerCase() || 
                  tx.to?.toLowerCase() === userAddress.toLowerCase()) {
                
                const transaction = await formatTransaction(client, tx, block);
                if (transaction) {
                  transactions.push(transaction);
                }
              }
            }
          }
        } catch (blockError) {
          console.warn('Failed to fetch block', blockNumber, blockError);
          continue;
        }
      }
      
      return transactions;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  };

  // Format transaction data
  const formatTransaction = async (client, tx, block) => {
    try {
      const isIncoming = tx.to?.toLowerCase() === address?.toLowerCase();
      const isOutgoing = tx.from?.toLowerCase() === address?.toLowerCase();
      
      let tokenInfo = null;
      let amount = null;
      let type = 'transfer';
      
      // Check if it's a token transfer (ERC-20)
      if (tx.input && tx.input.length > 10) {
        // This might be a token transfer, try to decode it
        try {
          const contract = getContract({
            address: tx.to,
            abi: erc20Abi,
            client
          });
          
          // Try to get token info
          const [symbol, name, decimals] = await Promise.all([
            contract.read.symbol().catch(() => 'UNKNOWN'),
            contract.read.name().catch(() => 'Unknown Token'),
            contract.read.decimals().catch(() => 18)
          ]);
          
          tokenInfo = { symbol, name, decimals };
          type = 'token_transfer';
        } catch (tokenError) {
          // Not a token transfer or failed to decode
          console.warn('Failed to decode token transfer:', tokenError);
        }
      }
      
      // Format amount
      if (tokenInfo) {
        // For token transfers, we'd need to decode the input data
        // For now, we'll show a generic amount
        amount = 'Token Transfer';
      } else {
        // Native token transfer
        amount = formatUnits(tx.value || 0, 18);
      }
      
      return {
        hash: tx.hash,
        type,
        from: tx.from,
        to: tx.to,
        amount,
        tokenInfo,
        timestamp: new Date((typeof block.timestamp === 'bigint' ? Number(block.timestamp) : block.timestamp) * 1000),
        isIncoming,
        isOutgoing,
        status: 'confirmed'
      };
    } catch (error) {
      console.error('Error formatting transaction:', error);
      return null;
    }
  };

  // Get fallback transactions for demo mode
  const getFallbackTransactions = () => {
    return [];
  };

  // Manual refresh function
  const handleRefresh = () => {
    fetchTransactions();
  };

  // Get display transactions (either real data or fallback)
  const displayTransactions = isConnected ? transactions : getFallbackTransactions();

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return timestamp.toLocaleDateString();
  };

  // Get transaction icon
  const getTransactionIcon = (transaction) => {
    if (transaction.isIncoming) return '↘️';
    if (transaction.isOutgoing) return '↗️';
    return '↔️';
  };

  // Get transaction color
  const getTransactionColor = (transaction) => {
    if (transaction.isIncoming) return '#48bb78';
    if (transaction.isOutgoing) return '#f56565';
    return '#a0aec0';
  };

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
          Recent Activity
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
            title="Refresh transactions"
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
          Connect your wallet to see real transaction history
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

             {!loading && displayTransactions.length === 0 && (
         <div style={{
           color: '#a0aec0',
           fontSize: '14px',
           textAlign: 'center',
           padding: '20px',
           backgroundColor: 'rgba(160, 174, 192, 0.1)',
           borderRadius: '8px',
           marginBottom: '12px'
         }}>
           {isConnected ? 'No recent transactions found' : 'No data'}
         </div>
       )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {displayTransactions.map((transaction, index) => (
          <div key={index} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: index < displayTransactions.length - 1 ? '1px solid #4a5568' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: getTransactionColor(transaction),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px'
              }}>
                {getTransactionIcon(transaction)}
              </div>
              <div>
                <div style={{
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {transaction.tokenInfo ? transaction.tokenInfo.symbol : 'ETH'}
                </div>
                <div style={{
                  color: '#a0aec0',
                  fontSize: '12px'
                }}>
                  {transaction.isIncoming ? 'Received' : transaction.isOutgoing ? 'Sent' : 'Transfer'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {transaction.isIncoming ? '+' : transaction.isOutgoing ? '-' : ''}{transaction.amount}
              </div>
              <div style={{
                color: '#a0aec0',
                fontSize: '12px'
              }}>
                {formatTimestamp(transaction.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;