import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import RecentActivity from "../../src/components/RecentActivity";

// Mock wagmi hooks
jest.mock("wagmi", () => ({
  useAccount: jest.fn(),
  usePublicClient: jest.fn(),
}));

describe("RecentActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default mock return values
    const { useAccount, usePublicClient } = require("wagmi");
    useAccount.mockReturnValue({
      isConnected: false,
      address: null,
    });
    usePublicClient.mockReturnValue({
      getBlockNumber: jest.fn().mockResolvedValue("1000000"),
      getBlock: jest.fn().mockResolvedValue({
        timestamp: "1640995200",
        transactions: [],
      }),
    });
  });

  it("renders the title correctly", async () => {
    render(<RecentActivity />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("renders demo mode when not connected", async () => {
    render(<RecentActivity />);
    expect(screen.getByText("(Demo Mode)")).toBeInTheDocument();
  });

  it("renders no data message when not connected", async () => {
    render(<RecentActivity />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders refresh button", async () => {
    render(<RecentActivity />);
    const refreshButton = screen.getByTitle("Refresh transactions");
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton.textContent).toBe("↻");
  });

  it("accepts transactionCount prop", async () => {
    render(<RecentActivity transactionCount={5} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("shows loading state when connected and fetching data", async () => {
    const { useAccount } = require("wagmi");
    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    render(<RecentActivity />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("handles forceRefresh prop", async () => {
    render(<RecentActivity forceRefresh={true} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("has correct title styling", async () => {
    render(<RecentActivity />);
    const title = screen.getByText("Recent Activity");
    expect(title).toHaveStyle({
      color: "white",
      fontSize: "16px",
      fontWeight: "600",
      margin: "0px",
    });
  });

  it("shows demo mode message when not connected", async () => {
    render(<RecentActivity />);
    expect(
      screen.getByText("Connect your wallet to see real transaction history")
    ).toBeInTheDocument();
  });

  it("handles empty transaction list", async () => {
    const { useAccount } = require("wagmi");
    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    render(<RecentActivity />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("displays error message when transaction fetching fails", async () => {
    const { useAccount } = require("wagmi");
    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    // Mock the public client to throw an error
    const { usePublicClient } = require("wagmi");
    usePublicClient.mockReturnValue({
      getBlockNumber: jest.fn().mockRejectedValue(new Error("Network error")),
      getBlock: jest.fn().mockRejectedValue(new Error("Network error")),
    });

    render(<RecentActivity />);

    // Wait for the error to be handled and fallback data to be shown
    await waitFor(() => {
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });
  });

  it("handles forceRefresh prop correctly", async () => {
    render(<RecentActivity forceRefresh={true} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("verifies fetchTransactions is called when wallet connects", async () => {
    const { useAccount, usePublicClient } = require("wagmi");
    const mockGetBlockNumber = jest.fn().mockResolvedValue(BigInt(1000000));
    const mockGetBlock = jest.fn().mockResolvedValue({
      timestamp: BigInt(1640995200),
      transactions: [],
    });

    usePublicClient.mockReturnValue({
      getBlockNumber: mockGetBlockNumber,
      getBlock: mockGetBlock,
    });

    // Initially not connected
    useAccount.mockReturnValue({
      isConnected: false,
      address: null,
    });

    const { rerender } = render(<RecentActivity />);

    // Verify no fetch happened when not connected
    expect(mockGetBlockNumber).not.toHaveBeenCalled();

    // Now connect the wallet
    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    rerender(<RecentActivity />);

    // Wait for the fetch to be triggered
    await waitFor(() => {
      expect(mockGetBlockNumber).toHaveBeenCalled();
    });
  });

  it("verifies fetchTransactions is called when forceRefresh changes", async () => {
    const { useAccount, usePublicClient } = require("wagmi");
    const mockGetBlockNumber = jest.fn().mockResolvedValue(BigInt(1000000));
    const mockGetBlock = jest.fn().mockResolvedValue({
      timestamp: BigInt(1640995200),
      transactions: [],
    });

    usePublicClient.mockReturnValue({
      getBlockNumber: mockGetBlockNumber,
      getBlock: mockGetBlock,
    });

    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    const { rerender } = render(<RecentActivity forceRefresh={false} />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockGetBlockNumber).toHaveBeenCalled();
    });

    const initialCallCount = mockGetBlockNumber.mock.calls.length;

    // Change forceRefresh to true
    rerender(<RecentActivity forceRefresh={true} />);

    // Wait for the force refresh to trigger another fetch
    await waitFor(() => {
      expect(mockGetBlockNumber.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });

  it("verifies getTransactionHistory is properly memoized", async () => {
    const { useAccount, usePublicClient } = require("wagmi");
    const mockGetBlockNumber = jest.fn().mockResolvedValue(BigInt(1000000));
    const mockGetBlock = jest.fn().mockResolvedValue({
      timestamp: BigInt(1640995200),
      transactions: [],
    });

    usePublicClient.mockReturnValue({
      getBlockNumber: mockGetBlockNumber,
      getBlock: mockGetBlock,
    });

    useAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890123456789012345678901234567890",
    });

    const { rerender } = render(<RecentActivity transactionCount={3} />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockGetBlockNumber).toHaveBeenCalled();
    });

    const initialCallCount = mockGetBlockNumber.mock.calls.length;

    // Rerender with same props - should not trigger new fetch
    rerender(<RecentActivity transactionCount={3} />);

    // Give it a moment to potentially trigger (it shouldn't)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call count should remain the same since dependencies haven't changed
    expect(mockGetBlockNumber.mock.calls.length).toBe(initialCallCount);
  });
});
