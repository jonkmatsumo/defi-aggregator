import TokenSwap from "../components/TokenSwap";
import NetworkStatus from "../components/NetworkStatus";
import YourAssets from "../components/YourAssets";
import LendingSection from "../components/LendingSection";
import RecentActivity from "../components/RecentActivity";
import PerpetualsSection from "../components/PerpetualsSection";
import ErrorBoundary from "../components/ErrorBoundary";

function DashboardRoute() {
  return (
    <ErrorBoundary name="root-app">
      <div
        style={{
          background: "linear-gradient(135deg, #0f1419 0%, #1a1a2e 100%)",
          minHeight: "calc(100vh - 80px)",
          padding: "clamp(16px, 3vw, 32px)",
          color: "white",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Main Content Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(280px, 25%)",
            gap: "clamp(16px, 2vw, 32px)",
            alignItems: "start",
            maxWidth: "100%",
            width: "100%",
          }}
        >
          {/* Left Column - Main Content (Swap + Lending + Perpetuals) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "clamp(16px, 2vw, 32px)",
              minWidth: 0,
            }}
          >
            {/* Token Swap Card with Error Boundary */}
            <ErrorBoundary name="token-swap" isolate={true}>
              <TokenSwap />
            </ErrorBoundary>

            {/* Lending Section Card with Error Boundary */}
            <ErrorBoundary name="lending-section" isolate={true}>
              <LendingSection />
            </ErrorBoundary>

            {/* Perpetuals Trading Card with Error Boundary */}
            <ErrorBoundary name="perpetuals-section" isolate={true}>
              <PerpetualsSection />
            </ErrorBoundary>
          </div>

          {/* Right Column - Sidebar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "clamp(12px, 1.5vw, 24px)",
              minWidth: 0,
            }}
          >
            <ErrorBoundary name="network-status" isolate={true}>
              <NetworkStatus />
            </ErrorBoundary>
            <ErrorBoundary name="your-assets" isolate={true}>
              <YourAssets />
            </ErrorBoundary>
            <ErrorBoundary name="recent-activity" isolate={true}>
              <RecentActivity />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default DashboardRoute;
