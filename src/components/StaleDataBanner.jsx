import React from "react";

/**
 * StaleDataBanner Component
 *
 * Displays a banner indicating that cached/stale data is being shown.
 * Provides context about when the data was fetched and option to refresh.
 *
 * @param {Object} props - Component props
 * @param {number} props.cachedAt - Timestamp when data was cached
 * @param {boolean} props.isStale - Whether the cached data is stale (past TTL)
 * @param {Function} props.onRefresh - Function to refresh the data
 * @param {string} props.variant - Banner style variant ('warning', 'info')
 */
const StaleDataBanner = ({
  cachedAt,
  isStale = false,
  onRefresh,
  variant = "auto",
}) => {
  // Determine the variant based on staleness if auto
  const effectiveVariant =
    variant === "auto" ? (isStale ? "warning" : "info") : variant;

  // Format the time difference
  const timeAgo = formatTimeAgo(cachedAt);

  // Styling based on variant
  const styles = {
    warning: {
      background:
        "linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)",
      border: "1px solid rgba(245, 158, 11, 0.3)",
      iconColor: "#fbbf24",
      textColor: "#fcd34d",
      subTextColor: "#a0aec0",
    },
    info: {
      background:
        "linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)",
      border: "1px solid rgba(59, 130, 246, 0.3)",
      iconColor: "#60a5fa",
      textColor: "#93c5fd",
      subTextColor: "#a0aec0",
    },
  };

  const style = styles[effectiveVariant];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: style.background,
        border: style.border,
        borderRadius: "8px",
        marginBottom: "16px",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Icon */}
        <span style={{ fontSize: "16px", color: style.iconColor }}>
          {isStale ? "⚠️" : "📋"}
        </span>

        {/* Message */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              color: style.textColor,
              fontSize: "13px",
              fontWeight: "500",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {isStale
              ? "Showing cached data (may be outdated)"
              : "Showing cached data"}
          </span>
          <span
            style={{
              color: style.subTextColor,
              fontSize: "12px",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Last updated {timeAgo}
          </span>
        </div>
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255, 255, 255, 0.1)",
            color: style.textColor,
            border: `1px solid ${style.iconColor}40`,
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.target.style.background = "rgba(255, 255, 255, 0.15)";
            e.target.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            e.target.style.background = "rgba(255, 255, 255, 0.1)";
            e.target.style.transform = "translateY(0)";
          }}
        >
          <RefreshIcon />
          Refresh
        </button>
      )}
    </div>
  );
};

/**
 * Format timestamp as relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return "unknown time ago";

  const now = Date.now();
  const diff = now - timestamp;

  // Handle future timestamps (shouldn't happen, but safety first)
  if (diff < 0) return "just now";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;

  // For older dates, show actual date
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Refresh icon component
 */
const RefreshIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export default StaleDataBanner;
export { formatTimeAgo };
