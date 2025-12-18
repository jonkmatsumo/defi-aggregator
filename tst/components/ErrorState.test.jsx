import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorState, { getErrorInfo } from "../../src/components/ErrorState";
import { APIError } from "../../src/services/apiClient";

describe("ErrorState", () => {
  describe("Rendering", () => {
    it("should render error title and message", () => {
      render(<ErrorState error={new Error("Test error")} />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Test error")).toBeInTheDocument();
    });

    it("should render custom title", () => {
      render(<ErrorState error={new Error("Test")} title="Custom Title" />);

      expect(screen.getByText("Custom Title")).toBeInTheDocument();
    });

    it("should render retry button when onRetry provided", () => {
      const onRetry = jest.fn();
      render(<ErrorState error={new Error("Test")} onRetry={onRetry} />);

      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("should not render retry button when onRetry not provided", () => {
      render(<ErrorState error={new Error("Test")} />);

      expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
    });

    it("should call onRetry when button clicked", () => {
      const onRetry = jest.fn();
      render(<ErrorState error={new Error("Test")} onRetry={onRetry} />);

      fireEvent.click(screen.getByText("Try Again"));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("Compact Mode", () => {
    it("should render compact layout", () => {
      const { container } = render(
        <ErrorState error={new Error("Test")} compact={true} />
      );

      // Compact mode has different padding
      const wrapper = container.firstChild;
      expect(wrapper).toHaveStyle({ padding: "16px" });
    });

    it("should show smaller retry button in compact mode", () => {
      const onRetry = jest.fn();
      render(
        <ErrorState
          error={new Error("Test")}
          onRetry={onRetry}
          compact={true}
        />
      );

      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });

  describe("Error Types", () => {
    it("should handle string error", () => {
      render(<ErrorState error="String error message" />);

      expect(screen.getByText("String error message")).toBeInTheDocument();
    });

    it("should handle null error", () => {
      render(<ErrorState error={null} />);

      expect(
        screen.getByText("An unexpected error occurred.")
      ).toBeInTheDocument();
    });

    it("should handle undefined error", () => {
      render(<ErrorState error={undefined} />);

      expect(
        screen.getByText("An unexpected error occurred.")
      ).toBeInTheDocument();
    });
  });

  describe("APIError Types", () => {
    it("should show network error message", () => {
      const error = new APIError("Network error", 0, "NETWORK_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Connection Error")).toBeInTheDocument();
      // Check for the user message in the description
      expect(
        screen.getByText(/Unable to connect to the server/i)
      ).toBeInTheDocument();
    });

    it("should show timeout error message", () => {
      const error = new APIError("Request timeout", 408, "TIMEOUT");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Request Timeout")).toBeInTheDocument();
    });

    it("should show server error message", () => {
      const error = new APIError("Internal server error", 500, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Server Error")).toBeInTheDocument();
    });

    it("should show rate limit message", () => {
      const error = new APIError("Too many requests", 429, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Rate Limited")).toBeInTheDocument();
    });

    it("should show not found message", () => {
      const error = new APIError("Not found", 404, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Not Found")).toBeInTheDocument();
    });
  });

  describe("Suggestions", () => {
    it("should show suggestions for network error", () => {
      const error = new APIError("Network error", 0, "NETWORK_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("Things to try:")).toBeInTheDocument();
      expect(
        screen.getByText(/Check your internet connection/)
      ).toBeInTheDocument();
    });

    it("should show suggestions for timeout", () => {
      const error = new APIError("Timeout", 408, "TIMEOUT");
      render(<ErrorState error={error} />);

      expect(screen.getByText(/taking too long/i)).toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("should show plug icon for network error", () => {
      const error = new APIError("Network error", 0, "NETWORK_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("🔌")).toBeInTheDocument();
    });

    it("should show timer icon for timeout", () => {
      const error = new APIError("Timeout", 408, "TIMEOUT");
      render(<ErrorState error={error} />);

      expect(screen.getByText("⏱️")).toBeInTheDocument();
    });

    it("should show wrench icon for server error", () => {
      const error = new APIError("Server error", 500, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("🔧")).toBeInTheDocument();
    });

    it("should show hourglass icon for rate limit", () => {
      const error = new APIError("Rate limited", 429, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("⏳")).toBeInTheDocument();
    });

    it("should show search icon for not found", () => {
      const error = new APIError("Not found", 404, "HTTP_ERROR");
      render(<ErrorState error={error} />);

      expect(screen.getByText("🔍")).toBeInTheDocument();
    });

    it("should show warning icon for generic error", () => {
      const error = new Error("Generic error");
      render(<ErrorState error={error} />);

      expect(screen.getByText("⚠️")).toBeInTheDocument();
    });
  });

  describe("Button Styling", () => {
    it("should have hover effect on retry button", () => {
      const onRetry = jest.fn();
      render(<ErrorState error={new Error("Test")} onRetry={onRetry} />);

      const button = screen.getByText("Try Again");

      // Simulate hover
      fireEvent.mouseEnter(button);
      expect(button.style.transform).toBe("translateY(-2px)");

      fireEvent.mouseLeave(button);
      expect(button.style.transform).toBe("translateY(0)");
    });
  });
});

describe("getErrorInfo", () => {
  it("should return default info for null error", () => {
    const info = getErrorInfo(null);

    expect(info.title).toBe("Something went wrong");
    expect(info.icon).toBe("⚠️");
  });

  it("should extract message from Error instance", () => {
    const info = getErrorInfo(new Error("Custom message"));

    expect(info.message).toBe("Custom message");
  });

  it("should handle APIError with getUserMessage", () => {
    const error = new APIError("Test", 500, "HTTP_ERROR");
    const info = getErrorInfo(error);

    expect(info.message).toBe(error.getUserMessage());
  });

  it("should return appropriate suggestions based on error type", () => {
    const networkError = new APIError("Network", 0, "NETWORK_ERROR");
    const networkInfo = getErrorInfo(networkError);

    expect(networkInfo.suggestions).toContain("Check your internet connection");
  });

  it("should handle empty Error message", () => {
    const error = new Error("");
    const info = getErrorInfo(error);

    // Should fall back to default message
    expect(info.message).toBe("An unexpected error occurred.");
  });
});
