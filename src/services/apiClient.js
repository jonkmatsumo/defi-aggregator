/**
 * Frontend API Client for Backend Communication
 *
 * All external data fetching goes through our backend server.
 * This eliminates CORS issues and keeps API credentials secure.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Local storage caching for offline/error fallback
 * - Request timeout handling
 * - Structured error handling
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";
const WS_BASE_URL = process.env.REACT_APP_WS_URL || "ws://localhost:3001";

// Cache configuration
const CACHE_PREFIX = "defi_cache:";
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class APIClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.wsUrl = WS_BASE_URL;
    this.defaultTimeout = 10000; // 10 seconds
    this.defaultRetries = 3;
    this.defaultRetryDelay = 1000; // 1 second base delay
  }

  /**
   * Make a GET request to the backend API with retry and caching support
   * @param {string} endpoint - API endpoint (e.g., '/api/prices/BTC')
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, params = {}, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      useCache = true,
      cacheTTL = DEFAULT_CACHE_TTL,
    } = options;

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const cacheKey = this.getCacheKey(endpoint, params);

    // Try to fetch with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.fetchWithTimeout(
          url.toString(),
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
          timeout
        );

        // Cache successful response
        if (useCache) {
          this.setCache(cacheKey, result, cacheTTL);
        }

        return result;
      } catch (error) {
        const isLastAttempt = attempt === retries;

        // Log retry attempt
        if (!isLastAttempt) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.warn(
            `API request failed (attempt ${attempt + 1}/${retries + 1}), ` +
              `retrying in ${delay}ms:`,
            error.message
          );
          await this.sleep(delay);
          continue;
        }

        // Last attempt failed - try to return cached data
        if (useCache) {
          const cachedData = this.getCache(cacheKey);
          if (cachedData !== null) {
            console.warn(
              `API request failed after ${retries + 1} attempts, ` +
                `returning cached data from ${new Date(cachedData._cachedAt).toLocaleString()}`
            );
            return {
              ...cachedData.data,
              _cached: true,
              _cachedAt: cachedData._cachedAt,
              _stale: cachedData._stale,
            };
          }
        }

        // No cached data available - throw the error
        throw error;
      }
    }
  }

  /**
   * Make a POST request to the backend API
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, body = {}, options = {}) {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
    } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.fetchWithTimeout(
          `${this.baseUrl}${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
          },
          timeout
        );
      } catch (error) {
        const isLastAttempt = attempt === retries;

        if (!isLastAttempt) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.warn(
            `API POST request failed (attempt ${attempt + 1}/${retries + 1}), ` +
              `retrying in ${delay}ms:`,
            error.message
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Fetch with timeout and response parsing
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Parsed response data
   */
  async fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData.error?.code || "HTTP_ERROR"
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new APIError(
          data.error?.message || "API request failed",
          400,
          data.error?.code || "API_ERROR"
        );
      }

      return data.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new APIError("Request timeout", 408, "TIMEOUT");
      }

      if (error instanceof APIError) {
        throw error;
      }

      // Network error
      throw new APIError(error.message || "Network error", 0, "NETWORK_ERROR");
    }
  }

  /**
   * Check if the backend server is available
   * @returns {Promise<boolean>} True if server is healthy
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.status === "healthy";
    } catch {
      return false;
    }
  }

  /**
   * Get WebSocket URL for real-time connections
   * @returns {string} WebSocket URL
   */
  getWebSocketUrl() {
    return this.wsUrl;
  }

  // ==========================================
  // Caching Methods
  // ==========================================

  /**
   * Generate cache key from endpoint and params
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} Cache key
   */
  getCacheKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join("&");
    return `${CACHE_PREFIX}${endpoint}${sortedParams ? "?" + sortedParams : ""}`;
  }

  /**
   * Get cached data if available and not expired
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached data or null
   */
  getCache(cacheKey) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp, ttl } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const isExpired = age > ttl;

      // Return data with staleness indicator
      return {
        data,
        _cachedAt: timestamp,
        _stale: isExpired,
      };
    } catch (error) {
      console.warn("Error reading from cache:", error);
      return null;
    }
  }

  /**
   * Store data in cache
   * @param {string} cacheKey - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds
   */
  setCache(cacheKey, data, ttl = DEFAULT_CACHE_TTL) {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
      // Handle quota exceeded or other storage errors
      console.warn("Error writing to cache:", error);
      this.clearOldCache();
    }
  }

  /**
   * Clear all API cache entries
   */
  clearCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn("Error clearing cache:", error);
    }
  }

  /**
   * Clear old/expired cache entries to free up space
   */
  clearOldCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key));
            const age = Date.now() - cached.timestamp;
            // Remove entries older than 1 hour
            if (age > 60 * 60 * 1000) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn("Error clearing old cache:", error);
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
  }

  isNetworkError() {
    return this.code === "NETWORK_ERROR";
  }

  isTimeout() {
    return this.code === "TIMEOUT";
  }

  isServerError() {
    return this.status >= 500;
  }

  isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Get user-friendly error message
   * @returns {string} User-friendly message
   */
  getUserMessage() {
    if (this.isNetworkError()) {
      return "Unable to connect to the server. Please check your internet connection.";
    }
    if (this.isTimeout()) {
      return "The request took too long. Please try again.";
    }
    if (this.isServerError()) {
      return "The server is experiencing issues. Please try again later.";
    }
    if (this.status === 404) {
      return "The requested resource was not found.";
    }
    if (this.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    return this.message || "An unexpected error occurred.";
  }

  /**
   * Check if error is recoverable (worth retrying)
   * @returns {boolean} True if recoverable
   */
  isRecoverable() {
    return this.isNetworkError() || this.isTimeout() || this.isServerError();
  }
}

// Export singleton instance
const apiClient = new APIClient();

export { APIClient, APIError, apiClient };
export default apiClient;
