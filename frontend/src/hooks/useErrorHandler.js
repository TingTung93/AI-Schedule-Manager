import { useState, useCallback, useRef, useEffect } from 'react';
import { reportError, reportUserAction } from '../utils/errorReporting';

// Circuit breaker implementation
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  isOpen() {
    return this.state === 'OPEN';
  }
}

// Retry with exponential backoff
const retryWithBackoff = async (
  operation,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Don't retry certain error types
      if (
        error.status === 401 || // Unauthorized
        error.status === 403 || // Forbidden
        error.status === 404 || // Not Found
        error.status === 422 || // Validation Error
        (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429)
      ) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

export const useErrorHandler = () => {
  const [errors, setErrors] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const circuitBreakers = useRef(new Map());
  const failedRequests = useRef([]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Retry failed requests when back online
      retryFailedRequests();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get or create circuit breaker for a service
  const getCircuitBreaker = useCallback((serviceName) => {
    if (!circuitBreakers.current.has(serviceName)) {
      circuitBreakers.current.set(serviceName, new CircuitBreaker());
    }
    return circuitBreakers.current.get(serviceName);
  }, []);

  // Add error to the list
  const addError = useCallback((error) => {
    const errorId = Date.now().toString();
    const errorWithId = {
      id: errorId,
      timestamp: new Date(),
      ...error
    };

    setErrors(prev => [...prev, errorWithId]);

    // Auto-remove non-critical errors after 5 seconds
    if (error.type !== 'critical') {
      setTimeout(() => {
        removeError(errorId);
      }, 5000);
    }

    return errorId;
  }, []);

  // Remove error by ID
  const removeError = useCallback((errorId) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Handle API errors with retry logic
  const handleApiError = useCallback(async (
    operation,
    options = {}
  ) => {
    const {
      serviceName = 'api',
      showNotification = true,
      enableRetry = true,
      enableCircuitBreaker = true,
      maxRetries = 3,
      fallback = null,
      onError = null
    } = options;

    try {
      const circuitBreaker = enableCircuitBreaker ? getCircuitBreaker(serviceName) : null;

      const executeOperation = async () => {
        if (!isOnline) {
          throw new Error('You are currently offline. Please check your internet connection.');
        }

        return enableRetry
          ? await retryWithBackoff(operation, maxRetries)
          : await operation();
      };

      const result = circuitBreaker
        ? await circuitBreaker.execute(executeOperation)
        : await executeOperation();

      return result;

    } catch (error) {
      // Log error for monitoring
      reportError(error, {
        serviceName,
        isOnline,
        circuitBreakerOpen: enableCircuitBreaker ? getCircuitBreaker(serviceName).isOpen() : false
      });

      // Store failed request for retry when online
      if (!isOnline && enableRetry) {
        failedRequests.current.push({
          operation,
          options,
          timestamp: Date.now()
        });
      }

      // Call custom error handler
      if (onError) {
        onError(error);
      }

      // Show user-friendly error notification
      if (showNotification) {
        const userError = formatUserError(error);
        addError({
          ...userError,
          retry: enableRetry ? () => handleApiError(operation, options) : null,
          serviceName
        });
      }

      // Return fallback value if provided
      if (fallback !== null) {
        return fallback;
      }

      throw error;
    }
  }, [isOnline, getCircuitBreaker, addError]);

  // Format errors for user display
  const formatUserError = useCallback((error) => {
    if (!isOnline) {
      return {
        type: 'warning',
        title: 'Connection Error',
        message: 'You appear to be offline. Please check your internet connection.',
        details: 'Your changes will be saved locally and synced when you reconnect.'
      };
    }

    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            type: 'error',
            title: 'Invalid Request',
            message: 'Please check your input and try again.',
            details: error.message
          };
        case 401:
          return {
            type: 'error',
            title: 'Authentication Required',
            message: 'Please log in to continue.',
            action: {
              label: 'Log In',
              handler: () => window.location.href = '/login'
            }
          };
        case 403:
          return {
            type: 'error',
            title: 'Access Denied',
            message: 'You don\'t have permission to perform this action.',
            details: error.message
          };
        case 404:
          return {
            type: 'error',
            title: 'Not Found',
            message: 'The requested resource could not be found.',
            details: error.message
          };
        case 408:
          return {
            type: 'warning',
            title: 'Request Timeout',
            message: 'The request took too long to complete. Please try again.',
            details: error.message
          };
        case 422:
          return {
            type: 'error',
            title: 'Validation Error',
            message: 'Please correct the highlighted fields and try again.',
            details: error.message
          };
        case 429:
          return {
            type: 'warning',
            title: 'Too Many Requests',
            message: 'Please wait a moment before trying again.',
            details: 'You\'ve made too many requests in a short time.'
          };
        case 500:
          return {
            type: 'error',
            title: 'Server Error',
            message: 'Something went wrong on our end. Please try again in a few moments.',
            details: 'Our team has been notified of this issue.'
          };
        case 503:
          return {
            type: 'warning',
            title: 'Service Unavailable',
            message: 'The service is temporarily unavailable. Please try again later.',
            details: error.message
          };
        default:
          return {
            type: 'error',
            title: 'Error',
            message: error.message || 'An unexpected error occurred.',
            details: `HTTP ${error.status}`
          };
      }
    }

    // Network errors
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return {
        type: 'warning',
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        details: error.message
      };
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return {
        type: 'warning',
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
        details: error.message
      };
    }

    // Default error
    return {
      type: 'error',
      title: 'Error',
      message: error.message || 'An unexpected error occurred.',
      details: error.stack
    };
  }, [isOnline]);

  // Retry failed requests when back online
  const retryFailedRequests = useCallback(async () => {
    const requests = [...failedRequests.current];
    failedRequests.current = [];

    for (const { operation, options } of requests) {
      try {
        await handleApiError(operation, { ...options, showNotification: false });
      } catch (error) {
        // Failed again, add back to queue
        failedRequests.current.push({ operation, options, timestamp: Date.now() });
      }
    }
  }, [handleApiError]);

  // Handle form validation errors
  const handleValidationError = useCallback((error, formFields = {}) => {
    reportUserAction('validation_error', { error: error.message, fields: Object.keys(formFields) });

    if (error.response?.data?.error?.details?.field_errors) {
      // Backend validation errors
      const fieldErrors = error.response.data.error.details.field_errors;
      return fieldErrors;
    }

    // Generic validation error
    addError({
      type: 'error',
      title: 'Validation Error',
      message: error.message || 'Please correct the form and try again.',
      details: error.details
    });

    return {};
  }, [addError]);

  // Handle network timeouts
  const withTimeout = useCallback((promise, timeoutMs = 30000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
    ]);
  }, []);

  return {
    errors,
    isOnline,
    addError,
    removeError,
    clearErrors,
    handleApiError,
    handleValidationError,
    formatUserError,
    withTimeout,
    retryFailedRequests
  };
};