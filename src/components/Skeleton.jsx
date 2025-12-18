import React from "react";

/**
 * Skeleton Component
 *
 * Loading placeholder that shows animated skeleton UI while content loads.
 * Supports multiple types for different content layouts.
 *
 * @param {Object} props - Component props
 * @param {string} props.type - Type of skeleton ('card', 'list', 'chart', 'text', 'table')
 * @param {number} props.count - Number of skeleton items to render
 * @param {string} props.width - Custom width
 * @param {string} props.height - Custom height
 */
const Skeleton = ({ type = "card", count = 1, width, height }) => {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderSkeletonItem = index => {
    switch (type) {
      case "card":
        return <SkeletonCard key={index} />;
      case "list":
        return <SkeletonListItem key={index} />;
      case "chart":
        return <SkeletonChart key={index} width={width} height={height} />;
      case "text":
        return <SkeletonText key={index} width={width} />;
      case "table":
        return <SkeletonTableRow key={index} />;
      case "inline":
        return <SkeletonInline key={index} width={width} />;
      default:
        return <SkeletonCard key={index} />;
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
        `}
      </style>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {items.map(renderSkeletonItem)}
      </div>
    </>
  );
};

/**
 * Card-style skeleton placeholder
 */
const SkeletonCard = () => (
  <div
    style={{
      background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
      borderRadius: "16px",
      padding: "24px",
      border: "1px solid #4a5568",
    }}
  >
    {/* Header */}
    <div
      style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          marginRight: "16px",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "60%",
            height: "20px",
            background:
              "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: "4px",
            marginBottom: "8px",
          }}
        />
        <div
          style={{
            width: "40%",
            height: "16px",
            background:
              "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>

    {/* Content lines */}
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div
        style={{
          width: "100%",
          height: "16px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
      <div
        style={{
          width: "85%",
          height: "16px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
      <div
        style={{
          width: "70%",
          height: "16px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
    </div>
  </div>
);

/**
 * List item skeleton placeholder
 */
const SkeletonListItem = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      background: "rgba(45, 55, 72, 0.5)",
      borderRadius: "8px",
      border: "1px solid #4a5568",
    }}
  >
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background:
          "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        marginRight: "12px",
        flexShrink: 0,
      }}
    />
    <div style={{ flex: 1 }}>
      <div
        style={{
          width: "50%",
          height: "16px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
          marginBottom: "8px",
        }}
      />
      <div
        style={{
          width: "30%",
          height: "14px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
    </div>
    <div
      style={{
        width: "80px",
        height: "20px",
        background:
          "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: "4px",
        marginLeft: "12px",
      }}
    />
  </div>
);

/**
 * Chart skeleton placeholder
 */
const SkeletonChart = ({ width = "100%", height = "300px" }) => (
  <div
    style={{
      width,
      height,
      background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
      borderRadius: "16px",
      border: "1px solid #4a5568",
      padding: "24px",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {/* Chart header */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "20px",
      }}
    >
      <div
        style={{
          width: "120px",
          height: "24px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
      <div style={{ display: "flex", gap: "8px" }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              width: "60px",
              height: "28px",
              background:
                "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: "6px",
            }}
          />
        ))}
      </div>
    </div>

    {/* Chart area with bars */}
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-end",
        gap: "8px",
        paddingTop: "20px",
      }}
    >
      {[65, 80, 45, 90, 60, 75, 55, 85, 70, 50].map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            background:
              "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: "4px 4px 0 0",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  </div>
);

/**
 * Text skeleton placeholder
 */
const SkeletonText = ({ width = "100%" }) => (
  <div
    style={{
      width,
      height: "16px",
      background:
        "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: "4px",
    }}
  />
);

/**
 * Table row skeleton placeholder
 */
const SkeletonTableRow = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: "16px",
      padding: "16px",
      borderBottom: "1px solid #4a5568",
    }}
  >
    {[1, 2, 3, 4].map(i => (
      <div
        key={i}
        style={{
          height: "20px",
          background:
            "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: "4px",
        }}
      />
    ))}
  </div>
);

/**
 * Inline skeleton for use within text
 */
const SkeletonInline = ({ width = "60px" }) => (
  <span
    style={{
      display: "inline-block",
      width,
      height: "1em",
      background:
        "linear-gradient(90deg, #2d3748 25%, #4a5568 50%, #2d3748 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      borderRadius: "4px",
      verticalAlign: "middle",
    }}
  />
);

export default Skeleton;
export {
  SkeletonCard,
  SkeletonListItem,
  SkeletonChart,
  SkeletonText,
  SkeletonTableRow,
  SkeletonInline,
};
