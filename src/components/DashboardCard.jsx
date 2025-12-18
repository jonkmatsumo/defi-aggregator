import React from "react";

const DashboardCard = ({
  title,
  value,
  subtitle,
  trend,
  trendColor = "#48bb78",
  icon,
}) => {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
        borderRadius: "16px",
        padding: "24px",
        border: "1px solid #4a5568",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          top: "0",
          right: "0",
          width: "60px",
          height: "60px",
          background:
            "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
          borderRadius: "50%",
          transform: "translate(20px, -20px)",
        }}
      ></div>

      {/* Icon */}
      {icon && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            color: trendColor,
            fontSize: "20px",
          }}
        >
          {icon}
        </div>
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <h3
          style={{
            color: "#a0aec0",
            fontSize: "14px",
            fontWeight: "500",
            margin: "0 0 8px 0",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </h3>

        <div
          style={{
            color: "white",
            fontSize: "28px",
            fontWeight: "700",
            margin: "0 0 4px 0",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {value}
        </div>

        {subtitle && (
          <div
            style={{
              color: "#718096",
              fontSize: "14px",
              fontWeight: "400",
            }}
          >
            {subtitle}
          </div>
        )}

        {trend && (
          <div
            style={{
              color: trendColor,
              fontSize: "16px",
              fontWeight: "600",
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {trend.startsWith("+") ? "↗" : trend.startsWith("-") ? "↘" : ""}
            {trend}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
