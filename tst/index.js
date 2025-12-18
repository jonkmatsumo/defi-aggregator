// Test utilities and helpers
export * from "./utils/test-utils";

// Test data constants
export const TEST_CONSTANTS = {
  MOCK_ADDRESS: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  CHAIN_IDS: {
    ETHEREUM: 1,
    POLYGON: 137,
    OPTIMISM: 10,
    ARBITRUM: 42161,
    BASE: 8453,
    SEPOLIA: 11155111,
  },
  NETWORK_NAMES: {
    1: "Ethereum",
    137: "Polygon",
    10: "Optimism",
    42161: "Arbitrum",
    8453: "Base",
    11155111: "Sepolia",
  },
};

// Test helper functions
export const createMockWalletState = (
  isConnected = false,
  address = null,
  chainId = 1
) => ({
  address: isConnected ? address || TEST_CONSTANTS.MOCK_ADDRESS : undefined,
  isConnected,
  chainId,
});

export const getNetworkName = chainId => {
  return TEST_CONSTANTS.NETWORK_NAMES[chainId] || "Unknown";
};
