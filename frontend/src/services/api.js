/**
 * API Service Module (Simplified)
 *
 * Centralized HTTP client with JWT authentication, token refresh,
 * CSRF protection, comprehensive error handling, and automatic
 * data transformation between snake_case (backend) and camelCase (frontend).
 *
 * Features:
 * - Automatic bidirectional data transformation (snake_case <-> camelCase)
 * - JWT token management with refresh
 * - CSRF protection
 * - Request/response interceptors
 * - Error handling and retry logic
 * - Rate limiting handling
 *
 * Usage:
 *   import apiClient, { getErrorMessage } from './services/api';
 *
 *   const response = await apiClient.post('/api/auth/login', { email, password });
 *   const data = await apiClient.get('/api/schedules');
 */

import axios from 'axios';

/**
 * Data Transformation Utilities
 * Convert between snake_case (backend) and camelCase (frontend)
 */

/**
 * Check if value is a plain object (not Array, Date, File, etc.)
 */
const isPlainObject = (value) => {
  return value !== null &&
         typeof value === 'object' &&
         value.constructor === Object;
};

/**
 * Check if value should be excluded from transformation
 */
const shouldSkipTransformation = (value) => {
  return value instanceof File ||
         value instanceof FileList ||
         value instanceof FormData ||
         value instanceof Date;
};

/**
 * Convert snake_case string to camelCase
 */
const snakeToCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * Convert camelCase string to snake_case
 */
const camelToSnakeCase = (str) => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

/**
 * Recursively convert object keys from snake_case to camelCase
 */
const snakeToCamel = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (shouldSkipTransformation(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => snakeToCamel(item));
  }

  if (isPlainObject(obj)) {
    const transformed = {};

    Object.keys(obj).forEach((key) => {
      const camelKey = snakeToCamelCase(key);
      transformed[camelKey] = snakeToCamel(obj[key]);
    });

    return transformed;
  }

  return obj;
};

/**
 * Recursively convert object keys from camelCase to snake_case
 */
const camelToSnake = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (shouldSkipTransformation(obj)) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnake(item));
  }

  if (isPlainObject(obj)) {
    const transformed = {};

    Object.keys(obj).forEach((key) => {
      const snakeKey = camelToSnakeCase(key);
      transformed[snakeKey] = camelToSnake(obj[key]);
    });

    return transformed;
  }

  return obj;
};

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage
let accessToken = null;
let csrfToken = null;
let isRefreshing = false;
let failedQueue = [];

// Load token from localStorage on initialization
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  const storedToken = localStorage.getItem('access_token');
  if (storedToken) {
    accessToken = storedToken;
    console.log('[API] Loaded access token from localStorage on initialization');
  }
}

// Process failed requests queue after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

// Request interceptor for adding auth headers and transforming data
apiClient.interceptors.request.use(
  (config) => {
    // Add access token to Authorization header if available
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token for state-changing requests
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Log request
    console.log(`[API] Request to ${config.method?.toUpperCase()} ${config.url}:`, {
      dataType: config.data ? (Array.isArray(config.data) ? 'array' : typeof config.data) : 'none',
      dataKeys: config.data && typeof config.data === 'object' ? Object.keys(config.data) : 'N/A',
      params: config.params
    });

    // Transform request data from camelCase to snake_case
    if (config.data && !shouldSkipTransformation(config.data)) {
      config.data = camelToSnake(config.data);
    }

    // Transform query parameters
    if (config.params && !shouldSkipTransformation(config.params)) {
      config.params = camelToSnake(config.params);
    }

    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for transforming data and handling errors
apiClient.interceptors.response.use(
  (response) => {
    // Log response time
    if (response.config.metadata?.startTime) {
      const endTime = new Date();
      const duration = endTime - response.config.metadata.startTime;
      console.debug(`API Request: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }

    // Transform response data from snake_case to camelCase
    if (response.data) {
      response.data = snakeToCamel(response.data);
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await apiClient.post('/api/auth/refresh');
        const newToken = response.data.accessToken || response.data.access_token;

        accessToken = newToken;
        processQueue(null, newToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        accessToken = null;
        csrfToken = null;

        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          console.log('[API] Token refresh failed, redirecting to login...');
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const errorMessage = error.response.data?.message || 'Access denied';
      console.warn('Access denied:', errorMessage);
    }

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`Rate limited. Retry after: ${retryAfter} seconds`);
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      error.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(error);
  }
);

/**
 * Error Handler Utilities
 */
export const errorHandler = {
  /**
   * Extract user-friendly error message
   */
  getErrorMessage(error) {
    // Handle 409 Conflict errors specially
    if (error.response?.status === 409) {
      const detail = error.response?.data?.detail;
      if (detail) {
        const emailMatch = detail.match(/email\s+([^\s]+)\s+already exists/i);
        if (emailMatch) {
          return `This email address (${emailMatch[1]}) is already registered. Please use a different email or leave it empty to auto-generate.`;
        }
        return detail;
      }
      return 'This resource already exists. Please check the details or try a different one.';
    }

    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (error.response?.data?.detail) {
      return error.response.data.detail;
    }

    if (error.response?.data?.error) {
      return error.response.data.error;
    }

    if (error.message) {
      return error.message;
    }

    return 'An unexpected error occurred';
  },

  /**
   * Check if error is authentication related
   */
  isAuthError(error) {
    return error.response?.status === 401 || error.response?.status === 403;
  },

  /**
   * Check if error is validation related
   */
  isValidationError(error) {
    return error.response?.status === 400;
  },

  /**
   * Check if error is conflict related (409)
   */
  isConflictError(error) {
    return error.response?.status === 409;
  },

  /**
   * Check if error is rate limiting related
   */
  isRateLimitError(error) {
    return error.response?.status === 429;
  }
};

/**
 * Token Management Utilities
 */
export const tokenManager = {
  setAccessToken(token) {
    accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
      console.log('[API] Access token set and stored in localStorage');
    } else {
      localStorage.removeItem('access_token');
      console.log('[API] Access token cleared from localStorage');
    }
  },

  getAccessToken() {
    if (!accessToken) {
      accessToken = localStorage.getItem('access_token');
    }
    return accessToken;
  },

  clearAccessToken() {
    accessToken = null;
    csrfToken = null;
    localStorage.removeItem('access_token');
  },

  isAuthenticated() {
    return !!this.getAccessToken();
  },

  async getCsrfToken() {
    try {
      const response = await apiClient.get('/api/auth/csrf-token');
      csrfToken = response.data.csrfToken || response.data.csrf_token;
      return csrfToken;
    } catch (error) {
      console.warn('Failed to get CSRF token:', error);
      return null;
    }
  }
};

/**
 * Utility Functions
 */
export const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

export const healthCheck = async () => {
  try {
    const response = await apiClient.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Convenient named exports
export const getErrorMessage = errorHandler.getErrorMessage;

export const transformUtils = {
  snakeToCamel,
  camelToSnake,
  snakeToCamelCase,
  camelToSnakeCase,
  isPlainObject,
  shouldSkipTransformation
};

// Default export
export default apiClient;
