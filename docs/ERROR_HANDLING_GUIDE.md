# Error Handling Implementation Guide

## Overview

This application implements comprehensive error handling with multiple layers of protection to prevent crashes and provide graceful error recovery.

## Architecture

### 1. Error Boundaries (Component-Level)

Error boundaries catch React component errors and prevent the entire app from crashing.

#### Implementation

```jsx
import ErrorBoundary from './components/ErrorBoundary';

// Wrap entire app
<ErrorBoundary name="App">
  <App />
</ErrorBoundary>

// Wrap individual routes
<Route
  path="/schedules"
  element={
    <ErrorBoundary name="Schedule">
      <SchedulePage />
    </ErrorBoundary>
  }
/>
```

#### Features

- **Error Count Tracking**: Tracks how many times an error occurs
- **Auto-Retry**: "Try Again" button to recover without page reload
- **Manual Reporting**: Users can report errors in production
- **Development Mode**: Shows full stack traces
- **Production Mode**: Hides technical details, shows user-friendly messages
- **Named Boundaries**: Each boundary has a name for better tracking

### 2. useErrorHandler Hook (API-Level)

Handles async operation errors with retry logic, circuit breakers, and offline detection.

#### Usage

```jsx
import { useErrorHandler } from '../hooks/useErrorHandler';

function MyComponent() {
  const { handleApiError, errors, isOnline } = useErrorHandler();

  const loadData = async () => {
    await handleApiError(
      async () => {
        const response = await api.get('/api/data');
        return response.data;
      },
      {
        serviceName: 'data-service',
        enableRetry: true,
        maxRetries: 3,
        showNotification: true,
        onError: (error) => {
          console.error('Custom error handling:', error);
        }
      }
    );
  };

  return (
    <>
      {!isOnline && <Alert severity="warning">You are offline</Alert>}
      {errors.map(error => (
        <Alert key={error.id} severity={error.type}>
          {error.message}
        </Alert>
      ))}
    </>
  );
}
```

#### Features

- **Circuit Breaker**: Prevents repeated calls to failing services
- **Exponential Backoff**: Intelligent retry with increasing delays
- **Offline Detection**: Queues failed requests for retry when online
- **User-Friendly Messages**: Converts technical errors to readable messages
- **Custom Error Handlers**: Allows per-call error handling logic

### 3. Axios Interceptors (Network-Level)

Centralized HTTP error handling with automatic token refresh.

#### Configuration (services/api.js)

```javascript
// Automatic token refresh on 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Auto-refresh token and retry
    }
    return Promise.reject(error);
  }
);
```

#### Features

- **Automatic Token Refresh**: Handles expired JWT tokens
- **Request Queueing**: Queues requests during token refresh
- **CSRF Protection**: Automatically adds CSRF tokens
- **Timeout Handling**: Configurable request timeouts
- **Error Normalization**: Standardizes error responses

### 4. Error Reporting (Monitoring)

Integration with error tracking services (Sentry, custom backend).

#### Setup

```javascript
import { initErrorReporting, reportError } from './utils/errorReporting';

// In App.jsx
initErrorReporting({
  sentryDsn: process.env.REACT_APP_SENTRY_DSN
});

// Manual error reporting
try {
  riskyOperation();
} catch (error) {
  reportError(error, {
    context: 'custom-operation',
    userId: currentUser.id
  });
}
```

#### Features

- **Automatic Capture**: Catches unhandled errors and promise rejections
- **User Context**: Associates errors with user information
- **Performance Tracking**: Monitors performance metrics
- **Session Replay**: Records user sessions on errors (Sentry)
- **Custom Backend**: Can send errors to your own endpoint

## Error Types and Handling

### API Errors

| Status Code | Error Type | Handling |
|-------------|-----------|----------|
| 400 | Bad Request | Show validation errors |
| 401 | Unauthorized | Auto-refresh token, redirect to login |
| 403 | Forbidden | Show permission error |
| 404 | Not Found | Show resource not found |
| 408 | Timeout | Retry with backoff |
| 422 | Validation | Show field-specific errors |
| 429 | Rate Limit | Wait and retry |
| 500 | Server Error | Show generic error, report to monitoring |
| 503 | Unavailable | Show service unavailable, retry |

### Network Errors

- **Offline Detection**: Shows offline banner, queues requests
- **Timeout**: Retries with exponential backoff
- **Connection Failed**: Shows connection error

### Component Errors

- **Rendering Errors**: Caught by error boundaries
- **Lifecycle Errors**: Caught by error boundaries
- **Event Handler Errors**: Must be wrapped in try-catch

## Best Practices

### 1. Always Use Error Boundaries

```jsx
// ✅ Good - Protected route
<ErrorBoundary name="Dashboard">
  <DashboardPage />
</ErrorBoundary>

// ❌ Bad - No error boundary
<DashboardPage />
```

### 2. Use useErrorHandler for API Calls

```jsx
// ✅ Good - With error handling
const { handleApiError } = useErrorHandler();

const loadData = () => handleApiError(
  () => api.get('/api/data'),
  { serviceName: 'data' }
);

// ❌ Bad - No error handling
const loadData = async () => {
  const response = await api.get('/api/data');
  return response.data;
};
```

### 3. Provide User-Friendly Messages

```jsx
// ✅ Good - User-friendly
addError({
  type: 'error',
  title: 'Unable to Save',
  message: 'Your changes could not be saved. Please try again.',
  details: 'Check your internet connection.'
});

// ❌ Bad - Technical jargon
throw new Error('ECONNREFUSED: Connection refused at 192.168.1.1:8080');
```

### 4. Log Context with Errors

```javascript
// ✅ Good - With context
reportError(error, {
  operation: 'create-schedule',
  userId: user.id,
  scheduleData: sanitizedData
});

// ❌ Bad - No context
reportError(error);
```

### 5. Handle Form Validation

```jsx
const { handleValidationError } = useErrorHandler();

const onSubmit = async (data) => {
  try {
    await api.post('/api/schedules', data);
  } catch (error) {
    const fieldErrors = handleValidationError(error, data);
    setErrors(fieldErrors);
  }
};
```

## Testing Error Handling

### Unit Tests

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './components/ErrorBoundary';

it('catches errors and shows fallback UI', () => {
  const BuggyComponent = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>
  );

  expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
});
```

### Integration Tests

```jsx
it('retries failed API calls', async () => {
  const apiCall = jest.fn()
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({ data: 'success' });

  const { handleApiError } = useErrorHandler();
  const result = await handleApiError(() => apiCall(), {
    enableRetry: true,
    maxRetries: 2
  });

  expect(apiCall).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ data: 'success' });
});
```

### Manual Testing

1. **Trigger Errors**: Add temporary `throw new Error('test')` in components
2. **Network Issues**: Use browser DevTools to simulate offline/slow network
3. **API Errors**: Mock API responses with different status codes
4. **Multiple Errors**: Trigger same error multiple times to test error count

## Environment Configuration

### Development

- Shows full stack traces
- Logs errors to console
- No error reporting to production services

### Production

- Hides technical details
- Reports errors to Sentry/backend
- Shows user-friendly messages
- Enables session replay

### Environment Variables

```bash
# Error reporting
REACT_APP_SENTRY_DSN=https://your-sentry-dsn
REACT_APP_ERROR_REPORTING_ENDPOINT=https://api.example.com/errors

# API configuration
REACT_APP_API_URL=https://api.example.com
```

## Troubleshooting

### Error Boundary Not Catching Errors

- **Event Handlers**: Wrap in try-catch, error boundaries don't catch these
- **Async Operations**: Use `.catch()` or try-catch in async functions
- **Outside React**: Error boundaries only catch React component errors

### Infinite Error Loops

- Check error count tracking
- Ensure error doesn't occur in error boundary itself
- Add circuit breaker for failing APIs

### Performance Issues

- Don't over-use error boundaries (one per major section is enough)
- Use circuit breakers to prevent retry storms
- Configure appropriate timeout values

## Monitoring and Alerts

### Key Metrics to Track

1. **Error Rate**: Errors per session
2. **Error Frequency**: Most common errors
3. **Error Recovery**: Successful retries vs failures
4. **User Impact**: Users affected by errors
5. **Performance**: Error handling overhead

### Setting Up Alerts

- Configure Sentry alerts for critical errors
- Set up Slack/email notifications
- Create dashboards for error trends
- Monitor error count thresholds

## Future Improvements

- [ ] Add error prediction based on patterns
- [ ] Implement smart retry strategies (adaptive backoff)
- [ ] Add offline persistence for failed mutations
- [ ] Create error analytics dashboard
- [ ] Add A/B testing for error messages
- [ ] Implement progressive error disclosure
- [ ] Add error boundary suspense fallbacks
