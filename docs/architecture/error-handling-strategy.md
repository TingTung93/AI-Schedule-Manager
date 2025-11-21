# Error Handling Strategy

## Overview
Comprehensive error handling across backend API, frontend services, and user interface with consistent error messages and recovery strategies.

## Error Classification

### Error Types
1. **Client Errors (4xx)**: User or request issues
2. **Server Errors (5xx)**: Backend or infrastructure issues
3. **Network Errors**: Connection problems
4. **Validation Errors**: Data format or business rule violations
5. **Authentication Errors**: Login and permission issues

## Backend Error Handling

### Standard Error Response Format

```python
# /backend/src/utils/response_helpers.py

from fastapi import HTTPException
from fastapi.responses import JSONResponse

class StandardError:
    """Standard error response structure"""

    def __init__(
        self,
        error: str,
        message: str,
        status_code: int,
        details: dict = None
    ):
        self.error = error
        self.message = message
        self.status_code = status_code
        self.details = details or {}

    def to_response(self):
        return JSONResponse(
            status_code=self.status_code,
            content={
                "error": self.error,
                "message": self.message,
                "statusCode": self.status_code,
                "timestamp": datetime.utcnow().isoformat(),
                **self.details
            }
        )
```

### HTTP Status Codes

#### 400 Bad Request
Invalid request format or parameters.

```python
raise HTTPException(
    status_code=400,
    detail={
        "error": "Bad Request",
        "message": "Invalid date format. Expected YYYY-MM-DD",
        "field": "start_date"
    }
)
```

#### 401 Unauthorized
Missing or invalid authentication.

```python
raise HTTPException(
    status_code=401,
    detail={
        "error": "Unauthorized",
        "message": "Invalid or expired access token"
    }
)
```

#### 403 Forbidden
Authenticated but insufficient permissions.

```python
raise HTTPException(
    status_code=403,
    detail={
        "error": "Forbidden",
        "message": "Manager role required for this operation",
        "required_role": "manager",
        "current_role": current_user.role
    }
)
```

#### 404 Not Found
Requested resource doesn't exist.

```python
raise HTTPException(
    status_code=404,
    detail={
        "error": "Not Found",
        "message": f"Employee with ID {employee_id} does not exist",
        "resource_type": "employee",
        "resource_id": employee_id
    }
)
```

#### 409 Conflict
Resource conflict (duplicate, constraint violation).

```python
raise HTTPException(
    status_code=409,
    detail={
        "error": "Conflict",
        "message": "Email address already registered",
        "field": "email",
        "value": email,
        "conflict_type": "unique_constraint"
    }
)
```

#### 422 Unprocessable Entity
Validation error with multiple fields.

```python
raise HTTPException(
    status_code=422,
    detail={
        "error": "Validation Failed",
        "message": "One or more validation errors occurred",
        "errors": [
            {
                "field": "email",
                "message": "Invalid email format",
                "value": "invalid-email"
            },
            {
                "field": "password",
                "message": "Password must be at least 8 characters",
                "value": None  # Don't expose password
            }
        ]
    }
)
```

#### 429 Too Many Requests
Rate limit exceeded.

```python
raise HTTPException(
    status_code=429,
    detail={
        "error": "Too Many Requests",
        "message": "Rate limit exceeded. Try again later",
        "retry_after": 3600,  # seconds
        "limit": 1000,
        "window": "1 hour"
    }
)
```

#### 500 Internal Server Error
Unexpected server error.

```python
# Log error with full context
logger.error(f"Unexpected error: {str(e)}", exc_info=True)

raise HTTPException(
    status_code=500,
    detail={
        "error": "Internal Server Error",
        "message": "An unexpected error occurred. Please try again later",
        "request_id": request_id  # For tracking
    }
)
```

### Global Exception Handler

```python
# /backend/src/main.py

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"][1:]),
            "message": error["msg"],
            "type": error["type"]
        })

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Failed",
            "message": "Request validation failed",
            "statusCode": 422,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    # Log full error with traceback
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    # Don't expose internal details to client
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "statusCode": 500,
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(uuid.uuid4())  # For support
        }
    )
```

### Database Error Handling

```python
from sqlalchemy.exc import IntegrityError, DataError
from psycopg2.errors import UniqueViolation, ForeignKeyViolation

try:
    db.add(new_employee)
    await db.commit()
except IntegrityError as e:
    await db.rollback()

    if isinstance(e.orig, UniqueViolation):
        # Extract field name from error
        field = extract_constraint_field(str(e))
        raise HTTPException(
            status_code=409,
            detail={
                "error": "Conflict",
                "message": f"Duplicate value for {field}",
                "field": field,
                "constraint": "unique"
            }
        )

    elif isinstance(e.orig, ForeignKeyViolation):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid Reference",
                "message": "Referenced resource does not exist",
                "constraint": "foreign_key"
            }
        )

except DataError as e:
    await db.rollback()
    raise HTTPException(
        status_code=400,
        detail={
            "error": "Data Error",
            "message": "Invalid data format or type",
            "details": str(e)
        }
    )
```

## Frontend Error Handling

### Axios Interceptor Error Handling

```javascript
// /frontend/src/services/api.js

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle different error scenarios

    // Network error (no response)
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
      error.userMessage = 'Unable to connect to server. Please check your internet connection and try again.';
      return Promise.reject(error);
    }

    // Add user-friendly message based on status code
    const status = error.response.status;
    const errorData = error.response.data;

    switch (status) {
      case 400:
        error.userMessage = errorData.message || 'Invalid request. Please check your input.';
        break;

      case 401:
        error.userMessage = 'Session expired. Please log in again.';
        // Attempt token refresh
        if (!error.config._retry) {
          error.config._retry = true;
          try {
            const response = await api.post('/api/auth/refresh');
            accessToken = response.data.access_token;
            return api(error.config);
          } catch (refreshError) {
            // Redirect to login
            authService.logout();
            window.location.href = '/login';
          }
        }
        break;

      case 403:
        error.userMessage = 'You don\'t have permission for this action.';
        break;

      case 404:
        error.userMessage = 'The requested resource was not found.';
        break;

      case 409:
        error.userMessage = errorData.message || 'This operation conflicts with existing data.';
        break;

      case 422:
        error.userMessage = 'Please correct the highlighted errors and try again.';
        error.validationErrors = errorData.errors || [];
        break;

      case 429:
        const retryAfter = error.response.headers['retry-after'];
        error.userMessage = `Too many requests. Please wait ${retryAfter} seconds and try again.`;
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        error.userMessage = 'Server error. Please try again later.';
        error.requestId = errorData.request_id;
        break;

      default:
        error.userMessage = errorData.message || 'An unexpected error occurred.';
    }

    return Promise.reject(error);
  }
);
```

### Error Handler Utility

```javascript
// /frontend/src/services/errorHandler.js

export const errorHandler = {
  /**
   * Extract user-friendly error message
   */
  getUserMessage(error) {
    // Use custom user message if available
    if (error.userMessage) {
      return error.userMessage;
    }

    // Extract from response
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    // Extract from error message
    if (error.message) {
      return error.message;
    }

    return 'An unexpected error occurred';
  },

  /**
   * Extract validation errors
   */
  getValidationErrors(error) {
    if (error.validationErrors) {
      return error.validationErrors;
    }

    if (error.response?.data?.errors) {
      return error.response.data.errors;
    }

    return [];
  },

  /**
   * Format validation errors for display
   */
  formatValidationErrors(errors) {
    return errors.reduce((acc, err) => {
      acc[err.field] = err.message;
      return acc;
    }, {});
  },

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    if (!error.response) {
      return true; // Network error
    }

    const status = error.response.status;
    return status >= 500 || status === 408 || status === 429;
  },

  /**
   * Log error for debugging
   */
  logError(error, context = {}) {
    const errorLog = {
      message: this.getUserMessage(error),
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      timestamp: new Date().toISOString(),
      ...context
    };

    console.error('Error occurred:', errorLog);

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry, LogRocket, etc.
    }
  }
};
```

### React Error Boundary

```javascript
// /frontend/src/components/ErrorBoundary.jsx

import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Refresh } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console
    console.error('Error boundary caught:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Log to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry, LogRocket, etc.
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <AlertTitle>Something went wrong</AlertTitle>
            <Box mb={2}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Box>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box
                component="pre"
                sx={{
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 200,
                  bgcolor: 'grey.100',
                  p: 1,
                  borderRadius: 1
                }}
              >
                {this.state.errorInfo.componentStack}
              </Box>
            )}

            <Button
              startIcon={<Refresh />}
              onClick={this.handleReset}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Component Error Handling Pattern

```javascript
// Example component with comprehensive error handling

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { errorHandler } from '../services/errorHandler';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Load data with error handling
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/api/employees');
      setEmployees(response.data.items);

    } catch (err) {
      const errorMessage = errorHandler.getUserMessage(err);
      setError(errorMessage);
      errorHandler.logError(err, { context: 'loadEmployees' });

    } finally {
      setLoading(false);
    }
  };

  // Create with validation error handling
  const handleCreate = async (formData) => {
    try {
      setFormErrors({});
      setError(null);

      await api.post('/api/employees', formData);
      await loadEmployees();
      setNotification({ type: 'success', message: 'Employee created' });

    } catch (err) {
      // Handle validation errors
      if (err.response?.status === 422) {
        const validationErrors = errorHandler.getValidationErrors(err);
        setFormErrors(errorHandler.formatValidationErrors(validationErrors));
        setError('Please correct the errors and try again');
      } else {
        setError(errorHandler.getUserMessage(err));
      }

      errorHandler.logError(err, { context: 'createEmployee' });
    }
  };

  // Retry logic for failed requests
  const handleRetry = async () => {
    await loadEmployees();
  };

  // Render error state
  if (error && !employees.length) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={handleRetry}>
          Retry
        </Button>
      }>
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  // Render with inline errors
  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Form with validation errors */}
      <TextField
        label="Email"
        error={!!formErrors.email}
        helperText={formErrors.email}
      />
    </Box>
  );
};
```

## User Notification Strategy

### Notification Types

```javascript
// /frontend/src/components/NotificationContext.jsx

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    const notification = { id, message, type, duration };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showError = (message, duration) => {
    addNotification(message, 'error', duration);
  };

  const showSuccess = (message, duration) => {
    addNotification(message, 'success', duration);
  };

  const showWarning = (message, duration) => {
    addNotification(message, 'warning', duration);
  };

  const showInfo = (message, duration) => {
    addNotification(message, 'info', duration);
  };

  return (
    <NotificationContext.Provider value={{
      showError,
      showSuccess,
      showWarning,
      showInfo
    }}>
      {children}

      {/* Render notifications */}
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
        {notifications.map(notification => (
          <Snackbar
            key={notification.id}
            open={true}
            onClose={() => removeNotification(notification.id)}
          >
            <Alert
              severity={notification.type}
              onClose={() => removeNotification(notification.id)}
            >
              {notification.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </NotificationContext.Provider>
  );
};
```

## Error Recovery Strategies

### Retry with Exponential Backoff

```javascript
// /frontend/src/utils/retry.js

export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  initialDelay = 1000
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not retryable
      if (!errorHandler.isRetryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Usage
const loadData = async () => {
  try {
    const response = await retryWithBackoff(
      () => api.get('/api/employees'),
      3,  // Max 3 retries
      1000  // Start with 1s delay
    );
    setEmployees(response.data.items);
  } catch (error) {
    setError(errorHandler.getUserMessage(error));
  }
};
```

### Circuit Breaker Pattern

```javascript
// /frontend/src/utils/circuitBreaker.js

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
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
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();

const loadEmployees = async () => {
  try {
    const response = await breaker.call(() => api.get('/api/employees'));
    setEmployees(response.data.items);
  } catch (error) {
    if (error.message === 'Circuit breaker is OPEN') {
      setError('Service temporarily unavailable. Please try again later.');
    } else {
      setError(errorHandler.getUserMessage(error));
    }
  }
};
```

## Monitoring and Logging

### Error Tracking Integration

```javascript
// /frontend/src/services/errorTracking.js

import * as Sentry from '@sentry/react';

export const initErrorTracking = () => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay()
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0
    });
  }
};

export const logError = (error, context = {}) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      contexts: {
        custom: context
      }
    });
  } else {
    console.error('Error:', error, context);
  }
};
```

## Summary

### Key Principles
1. **Consistent Format**: All errors follow standard structure
2. **User-Friendly Messages**: Technical errors translated to user language
3. **Comprehensive Logging**: All errors logged with context
4. **Graceful Degradation**: App continues functioning with reduced features
5. **Recovery Strategies**: Retry, backoff, circuit breaker
6. **Monitoring**: Track errors in production for quick resolution
