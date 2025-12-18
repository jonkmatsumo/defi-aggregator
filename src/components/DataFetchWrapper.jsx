import React from "react";
import Skeleton from "./Skeleton";
import ErrorState from "./ErrorState";
import StaleDataBanner from "./StaleDataBanner";

/**
 * DataFetchWrapper Component
 *
 * A wrapper component that handles data fetching states:
 * - Loading: Shows skeleton placeholder
 * - Error: Shows error state with retry button
 * - Cached/Stale: Shows banner indicating data may be outdated
 * - Success: Renders children with data
 *
 * @param {Object} props - Component props
 * @param {any} props.data - The fetched data
 * @param {boolean} props.loading - Whether data is loading
 * @param {Error|string} props.error - Error object or message
 * @param {Function} props.onRetry - Function to retry the fetch
 * @param {Function} props.children - Render function that receives the data
 * @param {string} props.skeletonType - Type of skeleton to show ('card', 'list', 'chart', 'text')
 * @param {number} props.skeletonCount - Number of skeleton items to show
 * @param {number} props.minHeight - Minimum height for the container
 * @param {string} props.emptyMessage - Message to show when data is empty
 */
const DataFetchWrapper = ({
  data,
  loading,
  error,
  onRetry,
  children,
  skeletonType = "card",
  skeletonCount = 1,
  minHeight = 200,
  emptyMessage = "No data available",
}) => {
  // Show loading skeleton
  if (loading) {
    return (
      <div style={{ minHeight: `${minHeight}px` }}>
        <Skeleton type={skeletonType} count={skeletonCount} />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ minHeight: `${minHeight}px` }}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // No data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div
        style={{
          minHeight: `${minHeight}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a0aec0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "14px",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Check if data is cached/stale
  const isCached = data._cached === true;
  const isStale = data._stale === true;
  const cachedAt = data._cachedAt;

  return (
    <div>
      {/* Show stale data banner if applicable */}
      {isCached && (
        <StaleDataBanner
          cachedAt={cachedAt}
          isStale={isStale}
          onRefresh={onRetry}
        />
      )}

      {/* Render children with data */}
      {typeof children === "function" ? children(data) : children}
    </div>
  );
};

/**
 * Inline DataFetchWrapper for simple use cases
 * Wraps content without additional styling
 */
export const InlineDataFetchWrapper = ({
  data,
  loading,
  error,
  onRetry,
  children,
  loadingContent = "...",
  errorContent = "-",
}) => {
  if (loading) {
    return <span style={{ opacity: 0.5 }}>{loadingContent}</span>;
  }

  if (error) {
    return (
      <span
        style={{ color: "#ef4444", cursor: "pointer" }}
        onClick={onRetry}
        title="Click to retry"
      >
        {errorContent}
      </span>
    );
  }

  if (!data) {
    return <span style={{ color: "#a0aec0" }}>-</span>;
  }

  return typeof children === "function" ? children(data) : children;
};

export default DataFetchWrapper;
