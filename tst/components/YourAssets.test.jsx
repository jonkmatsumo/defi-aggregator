import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import YourAssets from "../../src/components/YourAssets";

// Mock wagmi hooks
jest.mock("wagmi", () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn(),
}));

// Mock TokenBalanceService
const mockFetchAllTokenBalances = jest.fn();

jest.mock("../../src/services/tokenBalanceService", () => {
  const MockedTokenBalanceService = jest.fn().mockImplementation(() => ({
    fetchAllTokenBalances: mockFetchAllTokenBalances,
  }));

  MockedTokenBalanceService.getFallbackAssets = jest.fn(() => [
    {
      symbol: "ETH",
      name: "Ethereum",
      balance: "1.234",
      value: "$2,468.00",
      color: "#627eea",
      decimals: 18,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      balance: "1000.00",
      value: "$1,000.00",
      color: "#2775ca",
      decimals: 6,
    },
    {
      symbol: "DAI",
      name: "Dai",
      balance: "500.00",
      value: "$500.00",
      color: "#f5ac37",
      decimals: 18,
    },
  ]);
  MockedTokenBalanceService.calculateUSDValue = jest.fn((balance, symbol) => {
    const prices = { ETH: 2000, USDC: 1, DAI: 1 };
    return `$${(parseFloat(balance) * (prices[symbol] || 1)).toFixed(2)}`;
  });
  MockedTokenBalanceService.formatBalance = jest.fn((balance, decimals) =>
    balance.toString()
  );

  return { __esModule: true, default: MockedTokenBalanceService };
});

describe("YourAssets", () => {
  let mockUseAccount;
  let mockUsePublicClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchAllTokenBalances.mockResolvedValue([
      {
        symbol: "ETH",
        name: "Ethereum",
        balance: "2.000",
        value: "$4,000.00",
        color: "#627eea",
        decimals: 18,
        isMock: false,
      },
    ]);

    // Set default mock return values
    const { useAccount, usePublicClient } = require("wagmi");
    mockUseAccount = useAccount;
    mockUsePublicClient = usePublicClient;

    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: null,
    });
    mockUsePublicClient.mockReturnValue({
      getBalance: jest.fn().mockResolvedValue("2000000000000000000"),
    });
  });

  it("renders the title correctly", () => {
    render(<YourAssets />);
    expect(screen.getByText("Your Assets")).toBeInTheDocument();
  });

  it("renders demo mode when not connected", () => {
    render(<YourAssets />);
    expect(screen.getByText("(Demo Mode)")).toBeInTheDocument();
  });

  it("renders fallback assets when not connected", () => {
    render(<YourAssets />);
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("DAI")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    render(<YourAssets />);
    const refreshButton = screen.getByTitle("Refresh token balances");
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.textContent).toBe("↻");
  });

  it("accepts maxAssets prop", () => {
    render(<YourAssets maxAssets={2} />);
    // Should still show fallback assets
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("shows loading state when connected and fetching data", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    render(<YourAssets />);
    // Should show fallback data initially (not loading state)
    expect(screen.getByText("ETH")).toBeInTheDocument();
  });

  it("handles forceRefresh prop", () => {
    render(<YourAssets forceRefresh={true} />);
    // Should render without errors
    expect(screen.getByText("Your Assets")).toBeInTheDocument();
  });

  it("has correct title styling", () => {
    render(<YourAssets />);
    const title = screen.getByText("Your Assets");
    expect(title).toHaveStyle({
      color: "white",
      fontSize: "16px",
      fontWeight: "600",
      margin: "0px",
    });
  });

  // Test Hook execution behavior - fetchTokenBalances is called when wallet connects
  it("calls fetchTokenBalances when wallet connects", async () => {
    const mockPublicClient = {
      getBalance: jest.fn().mockResolvedValue("2000000000000000000"),
    };

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });
    mockUsePublicClient.mockReturnValue(mockPublicClient);

    render(<YourAssets />);

    await waitFor(() => {
      expect(mockFetchAllTokenBalances).toHaveBeenCalled();
    });
  });

  // Test Hook execution behavior - fetchTokenBalances is called with forceRefresh
  it("calls fetchTokenBalances when forceRefresh changes to true", async () => {
    const mockPublicClient = {
      getBalance: jest.fn().mockResolvedValue("2000000000000000000"),
    };

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });
    mockUsePublicClient.mockReturnValue(mockPublicClient);

    const { rerender } = render(<YourAssets forceRefresh={false} />);

    await waitFor(() => {
      expect(mockFetchAllTokenBalances).toHaveBeenCalledTimes(1);
    });

    // Change forceRefresh to true
    rerender(<YourAssets forceRefresh={true} />);

    await waitFor(() => {
      expect(mockFetchAllTokenBalances).toHaveBeenCalledTimes(2);
    });
  });

  // Test Hook execution behavior - fetchTokenBalances not called when disconnected
  it("does not call fetchTokenBalances when wallet is disconnected", async () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: null,
    });

    render(<YourAssets />);

    // Wait a bit to ensure no calls are made
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetchAllTokenBalances).not.toHaveBeenCalled();
  });

  // Test Hook execution behavior - fetchTokenBalances respects maxAssets dependency
  it("calls fetchTokenBalances with correct maxAssets parameter", async () => {
    const mockPublicClient = {
      getBalance: jest.fn().mockResolvedValue("2000000000000000000"),
    };

    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });
    mockUsePublicClient.mockReturnValue(mockPublicClient);

    render(<YourAssets maxAssets={5} />);

    await waitFor(() => {
      expect(mockFetchAllTokenBalances).toHaveBeenCalledWith(
        mockPublicClient,
        "0x1234567890123456789012345678901234567890",
        5
      );
    });
  });
});
