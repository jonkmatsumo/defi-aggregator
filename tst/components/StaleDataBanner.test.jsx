import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StaleDataBanner, {
  formatTimeAgo,
} from "../../src/components/StaleDataBanner";

describe("StaleDataBanner", () => {
  describe("Rendering", () => {
    it("should render the banner", () => {
      render(<StaleDataBanner cachedAt={Date.now()} />);

      expect(screen.getByText(/cached data/i)).toBeInTheDocument();
    });

    it("should show last updated time", () => {
      const cachedAt = Date.now() - 60000; // 1 minute ago
      render(<StaleDataBanner cachedAt={cachedAt} />);

      expect(screen.getByText(/Last updated 1 minute ago/)).toBeInTheDocument();
    });

    it("should render refresh button when onRefresh provided", () => {
      render(<StaleDataBanner cachedAt={Date.now()} onRefresh={() => {}} />);

      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });

    it("should not render refresh button when onRefresh not provided", () => {
      render(<StaleDataBanner cachedAt={Date.now()} />);

      expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    });

    it("should call onRefresh when button clicked", () => {
      const onRefresh = jest.fn();
      render(<StaleDataBanner cachedAt={Date.now()} onRefresh={onRefresh} />);

      fireEvent.click(screen.getByText("Refresh"));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("Stale vs Fresh Data", () => {
    it("should show warning message when stale", () => {
      render(<StaleDataBanner cachedAt={Date.now()} isStale={true} />);

      expect(screen.getByText(/may be outdated/i)).toBeInTheDocument();
    });

    it("should show info message when fresh", () => {
      render(<StaleDataBanner cachedAt={Date.now()} isStale={false} />);

      expect(screen.getByText("Showing cached data")).toBeInTheDocument();
      expect(screen.queryByText(/may be outdated/i)).not.toBeInTheDocument();
    });

    it("should show warning icon when stale", () => {
      render(<StaleDataBanner cachedAt={Date.now()} isStale={true} />);

      expect(screen.getByText("⚠️")).toBeInTheDocument();
    });

    it("should show info icon when fresh", () => {
      render(<StaleDataBanner cachedAt={Date.now()} isStale={false} />);

      expect(screen.getByText("📋")).toBeInTheDocument();
    });
  });

  describe("Variant Styling", () => {
    it("should auto-select warning variant when stale", () => {
      const { container } = render(
        <StaleDataBanner cachedAt={Date.now()} isStale={true} variant="auto" />
      );

      // Warning variant has amber color
      expect(container.firstChild).toHaveStyle({
        border: "1px solid rgba(245, 158, 11, 0.3)",
      });
    });

    it("should auto-select info variant when fresh", () => {
      const { container } = render(
        <StaleDataBanner cachedAt={Date.now()} isStale={false} variant="auto" />
      );

      // Info variant has blue color
      expect(container.firstChild).toHaveStyle({
        border: "1px solid rgba(59, 130, 246, 0.3)",
      });
    });

    it("should respect explicit warning variant", () => {
      const { container } = render(
        <StaleDataBanner
          cachedAt={Date.now()}
          isStale={false}
          variant="warning"
        />
      );

      expect(container.firstChild).toHaveStyle({
        border: "1px solid rgba(245, 158, 11, 0.3)",
      });
    });

    it("should respect explicit info variant", () => {
      const { container } = render(
        <StaleDataBanner cachedAt={Date.now()} isStale={true} variant="info" />
      );

      expect(container.firstChild).toHaveStyle({
        border: "1px solid rgba(59, 130, 246, 0.3)",
      });
    });
  });

  describe("Button Interactions", () => {
    it("should have hover effect on refresh button", () => {
      const onRefresh = jest.fn();
      render(<StaleDataBanner cachedAt={Date.now()} onRefresh={onRefresh} />);

      const button = screen.getByText("Refresh");

      fireEvent.mouseEnter(button);
      expect(button.style.background).toBe("rgba(255, 255, 255, 0.15)");

      fireEvent.mouseLeave(button);
      expect(button.style.background).toBe("rgba(255, 255, 255, 0.1)");
    });
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return "unknown time ago" for null/undefined', () => {
    expect(formatTimeAgo(null)).toBe("unknown time ago");
    expect(formatTimeAgo(undefined)).toBe("unknown time ago");
  });

  it('should return "just now" for very recent timestamps', () => {
    const timestamp = Date.now() - 5000; // 5 seconds ago
    expect(formatTimeAgo(timestamp)).toBe("just now");
  });

  it("should return seconds ago", () => {
    const timestamp = Date.now() - 45000; // 45 seconds ago
    expect(formatTimeAgo(timestamp)).toBe("45 seconds ago");
  });

  it('should return "1 minute ago"', () => {
    const timestamp = Date.now() - 60000; // 1 minute ago
    expect(formatTimeAgo(timestamp)).toBe("1 minute ago");
  });

  it("should return minutes ago", () => {
    const timestamp = Date.now() - 300000; // 5 minutes ago
    expect(formatTimeAgo(timestamp)).toBe("5 minutes ago");
  });

  it('should return "1 hour ago"', () => {
    const timestamp = Date.now() - 3600000; // 1 hour ago
    expect(formatTimeAgo(timestamp)).toBe("1 hour ago");
  });

  it("should return hours ago", () => {
    const timestamp = Date.now() - 10800000; // 3 hours ago
    expect(formatTimeAgo(timestamp)).toBe("3 hours ago");
  });

  it('should return "1 day ago"', () => {
    const timestamp = Date.now() - 86400000; // 1 day ago
    expect(formatTimeAgo(timestamp)).toBe("1 day ago");
  });

  it("should return days ago", () => {
    const timestamp = Date.now() - 259200000; // 3 days ago
    expect(formatTimeAgo(timestamp)).toBe("3 days ago");
  });

  it("should return formatted date for timestamps older than a week", () => {
    const timestamp = Date.now() - 864000000; // 10 days ago
    const result = formatTimeAgo(timestamp);
    // Should be a date string
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('should return "just now" for future timestamps', () => {
    const timestamp = Date.now() + 10000; // 10 seconds in future
    expect(formatTimeAgo(timestamp)).toBe("just now");
  });
});
