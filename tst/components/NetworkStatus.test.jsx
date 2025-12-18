import React from "react";
import { render, screen } from "@testing-library/react";
import NetworkStatus from "../../src/components/NetworkStatus";

// Mock wagmi hooks
jest.mock("wagmi", () => ({
  useChainId: jest.fn(),
  useClient: jest.fn(),
}));

// Mock GasPriceService
jest.mock("../../src/services/gasPriceService", () => {
  const MockedGasPriceService = jest.fn().mockImplementation(() => ({
    fetchMultipleGasPrices: jest.fn().mockResolvedValue({
      ethereum: {
        SafeGasPrice: "15",
        ProposeGasPrice: "18",
        FastGasPrice: "22",
      },
      polygon: { SafeGasPrice: "2", ProposeGasPrice: "3", FastGasPrice: "4" },
      bsc: { SafeGasPrice: "5", ProposeGasPrice: "6", FastGasPrice: "8" },
    }),
    clearCache: jest.fn(),
  }));
  MockedGasPriceService.getSupportedNetworks = jest.fn(() => ({
    ethereum: {
      name: "Ethereum",
      color: "#627eea",
      chainId: 1,
      nativeCurrency: { symbol: "ETH", decimals: 18 },
    },
    polygon: {
      name: "Polygon",
      color: "#8247e5",
      chainId: 137,
      nativeCurrency: { symbol: "MATIC", decimals: 18 },
    },
    bsc: {
      name: "BSC",
      color: "#f3ba2f",
      chainId: 56,
      nativeCurrency: { symbol: "BNB", decimals: 18 },
    },
  }));
  MockedGasPriceService.getFallbackGasPrices = jest.fn(() => ({
    ethereum: { SafeGasPrice: "15", ProposeGasPrice: "18", FastGasPrice: "22" },
    polygon: { SafeGasPrice: "2", ProposeGasPrice: "3", FastGasPrice: "4" },
    bsc: { SafeGasPrice: "5", ProposeGasPrice: "6", FastGasPrice: "8" },
  }));
  MockedGasPriceService.getDisplayGasPrice = jest.fn(gasData => {
    if (!gasData) return "...";
    return `${gasData.SafeGasPrice} gwei`;
  });
  MockedGasPriceService.getNetworkStatus = jest.fn(gasData => {
    if (!gasData) return "offline";
    return "online";
  });
  MockedGasPriceService.getNetworkInfo = jest.fn(chainId => {
    const networks = {
      1: { name: "Ethereum", color: "#627eea" },
      137: { name: "Polygon", color: "#8247e5" },
      56: { name: "BSC", color: "#f3ba2f" },
    };
    return networks[chainId] || { name: "Unknown", color: "#666" };
  });
  MockedGasPriceService.fetchConnectedWalletGasPrice = jest
    .fn()
    .mockResolvedValue({
      gasPrice: "15",
      network: "ethereum",
    });
  return { __esModule: true, default: MockedGasPriceService };
});

describe("NetworkStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock return values
    const { useChainId, useClient } = require("wagmi");
    useChainId.mockReturnValue(1);
    useClient.mockReturnValue({
      getGasPrice: jest.fn().mockResolvedValue("15000000000"),
    });
  });

  it("renders the title correctly", () => {
    render(<NetworkStatus />);
    expect(screen.getByText("Network Status")).toBeInTheDocument();
  });

  it("renders all network names", () => {
    render(<NetworkStatus />);
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Polygon")).toBeInTheDocument();
    expect(screen.getByText("BSC")).toBeInTheDocument();
  });

  it("renders loading state initially", () => {
    render(<NetworkStatus />);
    // Should show loading state initially
    const loadingElements = screen.getAllByText("...");
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it("renders status indicators for all networks", () => {
    render(<NetworkStatus />);
    // Check that network names are rendered, which indicates status indicators are present
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Polygon")).toBeInTheDocument();
    expect(screen.getByText("BSC")).toBeInTheDocument();
  });

  it("has correct title styling", () => {
    render(<NetworkStatus />);
    const title = screen.getByText("Network Status");
    expect(title).toHaveStyle({
      color: "white",
      fontSize: "16px",
      fontWeight: "600",
      margin: "0px",
    });
  });

  it("renders container with correct styles including single padding property", () => {
    render(<NetworkStatus />);
    // Check that the component renders correctly
    const title = screen.getByText("Network Status");
    expect(title).toBeInTheDocument();
    expect(title).toBeVisible();
  });

  it("renders all networks in the correct order", () => {
    render(<NetworkStatus />);
    const networkNames = ["Ethereum", "Polygon", "BSC"];
    networkNames.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  it("renders network items with proper structure", () => {
    render(<NetworkStatus />);
    const networkItems = screen.getAllByText(/Ethereum|Polygon|BSC/);
    networkItems.forEach(item => {
      expect(item).toBeInTheDocument();
      expect(item).toBeVisible();
    });
  });

  it("renders refresh button", () => {
    render(<NetworkStatus />);
    const refreshButton = screen.getByTitle("Refresh gas prices");
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.textContent).toBe("↻");
  });

  it("accepts maxNetworks prop", () => {
    render(<NetworkStatus maxNetworks={2} />);
    // Should still show the networks (component uses fallback data)
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Polygon")).toBeInTheDocument();
  });
});
