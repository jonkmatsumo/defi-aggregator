/**
 * Frontend API Client for Backend Communication
 * 
 * All external data fetching goes through our backend server.
 * This eliminates CORS issues and keeps API credentials secure.
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

class APIClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.wsUrl = WS_BASE_URL;
    this.defaultTimeout = 10000; // 10 seconds
  }

  /**
   * Make a GET request to the backend API
   * @param {string} endpoint - API endpoint (e.g., '/api/prices/BTC')
   * @param {Object} params - Query parameters
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, params = {}, options = {}) {
    const { timeout = this.defaultTimeout } = options;
    
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData.error?.code || 'HTTP_ERROR'
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new APIError(
          data.error?.message || 'API request failed',
          400,
          data.error?.code || 'API_ERROR'
        );
      }

      return data.data;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, 'TIMEOUT');
      }

      if (error instanceof APIError) {
        throw error;
      }

      // Network error
      throw new APIError(
        error.message || 'Network error',
        0,
        'NETWORK_ERROR'
      );
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
    const { timeout = this.defaultTimeout } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData.error?.code || 'HTTP_ERROR'
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new APIError(
          data.error?.message || 'API request failed',
          400,
          data.error?.code || 'API_ERROR'
        );
      }

      return data.data;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, 'TIMEOUT');
      }

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error.message || 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Check if the backend server is available
   * @returns {Promise<boolean>} True if server is healthy
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.status === 'healthy';
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
}

/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }

  isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }

  isTimeout() {
    return this.code === 'TIMEOUT';
  }

  isServerError() {
    return this.status >= 500;
  }

  isClientError() {
    return this.status >= 400 && this.status < 500;
  }
}

// Export singleton instance
const apiClient = new APIClient();

export { APIClient, APIError, apiClient };
export default apiClient;

