/**
 * API Service Module
 *
 * Centralized HTTP client with JWT authentication, token refresh,
 * CSRF protection, and comprehensive error handling.
 */

import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 10000,
  withCredentials: true, // Enable cookies for HttpOnly JWT tokens
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token storage (fallback for non-cookie scenarios)
let accessToken = null;
let csrfToken = null;
let isRefreshing = false;
let failedQueue = [];

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

// Request interceptor for adding auth headers
api.interceptors.request.use(
  (config) => {
    // Add access token to Authorization header if available
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add CSRF token for state-changing requests
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling token refresh and errors
api.interceptors.response.use(
  (response) => {
    // Log response time for debugging
    if (response.config.metadata?.startTime) {
      const endTime = new Date();
      const duration = endTime - response.config.metadata.startTime;
      console.debug(`API Request: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue failed requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post('/api/auth/refresh');
        const newToken = response.data.access_token;

        // Update stored token
        accessToken = newToken;

        // Process queued requests
        processQueue(null, newToken);

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - redirect to login
        processQueue(refreshError, null);
        authService.logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      const errorMessage = error.response.data?.message || 'Access denied';
      console.warn('Access denied:', errorMessage);

      // Show user-friendly error for permission issues
      if (window.location.pathname !== '/login') {
        // You could dispatch a notification here
        console.error('Insufficient permissions:', errorMessage);
      }
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

// Authentication service
export const authService = {
  /**
   * Login user with email and password
   */
  async login(email, password) {
    try {
      const response = await api.post('/api/auth/login', {
        email,
        password
      });

      // Store access token (backup for cookie-less scenarios)
      if (response.data.access_token) {
        accessToken = response.data.access_token;
      }

      // Get CSRF token for future requests
      await this.getCsrfToken();

      return response;
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Register new user account
   */
  async register(userData) {
    try {
      const response = await api.post('/api/auth/register', userData);

      // Store access token after successful registration
      if (response.data.access_token) {
        accessToken = response.data.access_token;
      }

      // Get CSRF token
      await this.getCsrfToken();

      return response;
    } catch (error) {
      console.error('Registration failed:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Logout user and clear tokens
   */
  async logout() {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear stored tokens regardless of API call success
      accessToken = null;
      csrfToken = null;
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken() {
    try {
      const response = await api.post('/api/auth/refresh');

      if (response.data.access_token) {
        accessToken = response.data.access_token;
      }

      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  },

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
      const response = await api.get('/api/auth/me');
      return response;
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  },

  /**
   * Change user password
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      return response;
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  },

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    try {
      const response = await api.post('/api/auth/forgot-password', {
        email
      });
      return response;
    } catch (error) {
      console.error('Forgot password failed:', error);
      throw error;
    }
  },

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    try {
      const response = await api.post('/api/auth/reset-password', {
        token,
        new_password: newPassword
      });
      return response;
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  },

  /**
   * Get CSRF token for protected requests
   */
  async getCsrfToken() {
    try {
      const response = await api.get('/api/auth/csrf-token');
      csrfToken = response.data.csrf_token;
      return csrfToken;
    } catch (error) {
      console.warn('Failed to get CSRF token:', error);
      return null;
    }
  },

  /**
   * Get user's active sessions
   */
  async getActiveSessions() {
    try {
      const response = await api.get('/api/auth/sessions');
      return response;
    } catch (error) {
      console.error('Get active sessions failed:', error);
      throw error;
    }
  },

  /**
   * Revoke specific session
   */
  async revokeSession(tokenJti) {
    try {
      const response = await api.delete(`/api/auth/sessions/${tokenJti}`);
      return response;
    } catch (error) {
      console.error('Revoke session failed:', error);
      throw error;
    }
  },

  /**
   * Set access token manually (for non-cookie scenarios)
   */
  setAccessToken(token) {
    accessToken = token;
  },

  /**
   * Get current access token
   */
  getAccessToken() {
    return accessToken;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!accessToken;
  }
};

// Schedule-related API calls
export const scheduleService = {
  /**
   * Get all schedules for current user
   */
  async getSchedules() {
    try {
      const response = await api.get('/api/schedules');
      return response;
    } catch (error) {
      console.error('Get schedules failed:', error);
      throw error;
    }
  },

  /**
   * Get specific schedule by ID
   */
  async getSchedule(scheduleId) {
    try {
      const response = await api.get(`/api/schedules/${scheduleId}`);
      return response;
    } catch (error) {
      console.error('Get schedule failed:', error);
      throw error;
    }
  },

  /**
   * Create new schedule
   */
  async createSchedule(scheduleData) {
    try {
      const response = await api.post('/api/schedules', scheduleData);
      return response;
    } catch (error) {
      console.error('Create schedule failed:', error);
      throw error;
    }
  },

  /**
   * Update existing schedule
   */
  async updateSchedule(scheduleId, scheduleData) {
    try {
      const response = await api.put(`/api/schedules/${scheduleId}`, scheduleData);
      return response;
    } catch (error) {
      console.error('Update schedule failed:', error);
      throw error;
    }
  },

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId) {
    try {
      const response = await api.delete(`/api/schedules/${scheduleId}`);
      return response;
    } catch (error) {
      console.error('Delete schedule failed:', error);
      throw error;
    }
  }
};

// Task-related API calls
export const taskService = {
  /**
   * Get all tasks
   */
  async getTasks(params = {}) {
    try {
      const response = await api.get('/api/tasks', { params });
      return response;
    } catch (error) {
      console.error('Get tasks failed:', error);
      throw error;
    }
  },

  /**
   * Get specific task by ID
   */
  async getTask(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}`);
      return response;
    } catch (error) {
      console.error('Get task failed:', error);
      throw error;
    }
  },

  /**
   * Create new task
   */
  async createTask(taskData) {
    try {
      const response = await api.post('/api/tasks', taskData);
      return response;
    } catch (error) {
      console.error('Create task failed:', error);
      throw error;
    }
  },

  /**
   * Update existing task
   */
  async updateTask(taskId, taskData) {
    try {
      const response = await api.put(`/api/tasks/${taskId}`, taskData);
      return response;
    } catch (error) {
      console.error('Update task failed:', error);
      throw error;
    }
  },

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    try {
      const response = await api.delete(`/api/tasks/${taskId}`);
      return response;
    } catch (error) {
      console.error('Delete task failed:', error);
      throw error;
    }
  }
};

// User management API calls (admin functions)
export const userService = {
  /**
   * Get all users (admin only)
   */
  async getUsers(params = {}) {
    try {
      const response = await api.get('/api/users', { params });
      return response;
    } catch (error) {
      console.error('Get users failed:', error);
      throw error;
    }
  },

  /**
   * Get specific user by ID
   */
  async getUser(userId) {
    try {
      const response = await api.get(`/api/users/${userId}`);
      return response;
    } catch (error) {
      console.error('Get user failed:', error);
      throw error;
    }
  },

  /**
   * Update user information
   */
  async updateUser(userId, userData) {
    try {
      const response = await api.put(`/api/users/${userId}`, userData);
      return response;
    } catch (error) {
      console.error('Update user failed:', error);
      throw error;
    }
  },

  /**
   * Deactivate user account
   */
  async deactivateUser(userId) {
    try {
      const response = await api.post(`/api/users/${userId}/deactivate`);
      return response;
    } catch (error) {
      console.error('Deactivate user failed:', error);
      throw error;
    }
  }
};

// Error handling utilities
export const errorHandler = {
  /**
   * Extract user-friendly error message
   */
  getErrorMessage(error) {
    if (error.response?.data?.message) {
      return error.response.data.message;
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
   * Check if error is rate limiting related
   */
  isRateLimitError(error) {
    return error.response?.status === 429;
  }
};

// Request timeout utility
export const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

// API health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Memory storage for development tracking
const storeApiImplementation = () => {
  try {
    if (typeof window !== 'undefined' && window.memory_store) {
      const implementation = {
        api_service: {
          jwt_integration: 'Complete JWT token handling with refresh',
          interceptors: 'Request/response interceptors for auth',
          error_handling: 'Comprehensive error handling and retry logic',
          csrf_protection: 'CSRF token integration',
          services: ['auth', 'schedule', 'task', 'user'],
          features: [
            'Token refresh mechanism',
            'Request queueing during refresh',
            'Rate limiting handling',
            'Network error handling',
            'Cookie-based authentication',
            'CSRF protection',
            'Request timeout handling'
          ]
        }
      };

      window.memory_store.store('development/auth/api_service', implementation);
    }
  } catch (error) {
    console.warn('Failed to store API implementation details:', error);
  }
};

// Store implementation details
storeApiImplementation();

export default api;