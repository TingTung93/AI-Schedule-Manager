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

/**
 * JWT Token Validation Utilities
 */

/**
 * Parse JWT token to extract payload
 * @param {string} token - JWT token to parse
 * @returns {object|null} Parsed token payload or null if invalid
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.debug('[API] Failed to parse JWT token');
    return null;
  }
};

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is expired or invalid
 */
const isTokenExpired = (token) => {
  if (!token) return true;

  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;

  // Check if token is expired (with 10 second buffer to account for clock skew)
  const expiryTime = payload.exp * 1000;
  const currentTime = Date.now();
  return currentTime >= (expiryTime - 10000);
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
    // Validate token expiry before sending request
    if (accessToken && isTokenExpired(accessToken)) {
      console.log('[API] Token expired before request - clearing auth state');
      accessToken = null;
      csrfToken = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');

      // Redirect to login if not already on login/register page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        console.log('[API] Redirecting to login due to expired token');
        window.location.href = '/login';
      }

      // Cancel the request
      const error = new Error('Token expired');
      error.config = config;
      error.response = { status: 401, data: { message: 'Token expired' } };
      return Promise.reject(error);
    }

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

        // Clear all auth data from localStorage
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');

        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          console.log('[API] Token refresh failed, clearing auth and redirecting to login...');
          // Use window.location.replace to prevent back button issues
          window.location.replace('/login');
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

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
export const authService = {
  async login(email, password) {
    const response = await apiClient.post('/api/auth/login', { email, password });
    if (response.data.accessToken || response.data.access_token) {
      const token = response.data.accessToken || response.data.access_token;
      tokenManager.setAccessToken(token);
    }
    return response;
  },

  async register(userData) {
    const response = await apiClient.post('/api/auth/register', userData);
    if (response.data.accessToken || response.data.access_token) {
      const token = response.data.accessToken || response.data.access_token;
      tokenManager.setAccessToken(token);
    }
    return response;
  },

  async logout() {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      tokenManager.clearAccessToken();
    }
  },

  async changePassword(currentPassword, newPassword) {
    return apiClient.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    });
  },

  async getCsrfToken() {
    return tokenManager.getCsrfToken();
  },

  setAccessToken(token) {
    tokenManager.setAccessToken(token);
  },

  getAccessToken() {
    return tokenManager.getAccessToken();
  },

  clearAccessToken() {
    tokenManager.clearAccessToken();
  },

  isAuthenticated() {
    return tokenManager.isAuthenticated();
  }
};

/**
 * User Service
 * Handles user profile and management API calls
 */
export const userService = {
  async getProfile() {
    return apiClient.get('/api/users/me');
  },

  async updateProfile(userData) {
    return apiClient.put('/api/users/me', userData);
  },

  async getUsers() {
    return apiClient.get('/api/users');
  },

  async getUserById(userId) {
    return apiClient.get(`/api/users/${userId}`);
  },

  async createUser(userData) {
    return apiClient.post('/api/users', userData);
  },

  async updateUser(userId, userData) {
    return apiClient.put(`/api/users/${userId}`, userData);
  },

  async deleteUser(userId) {
    return apiClient.delete(`/api/users/${userId}`);
  }
};

/**
 * Schedule Service
 * Handles schedule-related API calls
 */
export const scheduleService = {
  async getSchedules() {
    return apiClient.get('/api/schedules');
  },

  async getScheduleById(scheduleId) {
    return apiClient.get(`/api/schedules/${scheduleId}`);
  },

  async createSchedule(scheduleData) {
    return apiClient.post('/api/schedules', scheduleData);
  },

  async updateSchedule(scheduleId, scheduleData) {
    return apiClient.put(`/api/schedules/${scheduleId}`, scheduleData);
  },

  async deleteSchedule(scheduleId) {
    return apiClient.delete(`/api/schedules/${scheduleId}`);
  }
};

/**
 * Analytics Service
 * Handles analytics and reporting API calls
 */
export const analyticsService = {
  async getAnalytics(params) {
    return apiClient.get('/api/analytics', { params });
  },

  async getReports() {
    return apiClient.get('/api/reports');
  }
};

/**
 * Notification Service
 * Handles notification-related API calls
 */
export const notificationService = {
  async getNotifications() {
    return apiClient.get('/api/notifications');
  },

  async markAsRead(notificationId) {
    return apiClient.put(`/api/notifications/${notificationId}/read`);
  },

  async markAllAsRead() {
    return apiClient.put('/api/notifications/read-all');
  },

  async deleteNotification(notificationId) {
    return apiClient.delete(`/api/notifications/${notificationId}`);
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
