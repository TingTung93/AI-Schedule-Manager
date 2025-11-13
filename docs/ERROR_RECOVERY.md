# Error Recovery System Documentation

## Overview

The AI Schedule Manager now includes a comprehensive error recovery system that provides users with clear retry mechanisms and graceful degradation when errors occur.

## Components

### 1. ErrorRecovery Component

**Location**: `/frontend/src/components/wizard/ErrorRecovery.jsx`

**Purpose**: Reusable UI component for displaying errors with retry and skip options.

**Props**:
- `error` (Error, required): The error object to display
- `onRetry` (Function, required): Callback to retry the failed operation
- `onSkip` (Function, optional): Callback to skip the operation
- `skipAllowed` (boolean, default: false): Whether to show the skip button
- `severity` (string, default: 'error'): Alert severity level

**Features**:
- Automatic error message extraction from API responses
- Special handling for network errors (Network Error, timeouts)
- HTTP status code interpretation (404, 500, 401/403)
- Clear retry and skip actions
- User-friendly error messages

**Example Usage**:
```jsx
import ErrorRecovery from './components/wizard/ErrorRecovery';

{error && (
  <ErrorRecovery
    error={error}
    onRetry={retryFunction}
    skipAllowed={true}
    onSkip={() => setError(null)}
  />
)}
```

### 2. useAsyncData Hook

**Location**: `/frontend/src/hooks/useAsyncData.js`

**Purpose**: Custom hook for managing async data fetching with automatic error handling and retry logic.

**Parameters**:
- `asyncFunction` (Function, required): The async function to execute
- `dependencies` (Array, default: []): Dependencies for re-fetching (like useEffect)
- `options` (Object, optional):
  - `immediate` (boolean, default: true): Execute on mount
  - `onSuccess` (Function): Callback on successful fetch
  - `onError` (Function): Callback on error

**Returns**:
- `data`: The fetched data (null initially)
- `loading`: Loading state (boolean)
- `error`: Error object (null if no error)
- `retry`: Function to retry with incremented count
- `retryCount`: Number of retry attempts
- `execute`: Manual execution function

**Features**:
- Automatic loading state management
- Error capturing and state management
- Retry functionality with count tracking
- Dependency-based re-fetching
- Success/error callbacks
- Manual execution mode

**Example Usage**:
```jsx
import useAsyncData from './hooks/useAsyncData';

const { data, loading, error, retry } = useAsyncData(
  () => api.get('/api/departments').then(res => res.data),
  [] // Empty dependencies - load once
);

if (loading) return <CircularProgress />;
if (error) return <ErrorRecovery error={error} onRetry={retry} />;
```

### 3. useOnlineStatus Hook

**Location**: `/frontend/src/hooks/useOnlineStatus.js`

**Purpose**: Detects browser online/offline status.

**Returns**: `isOnline` (boolean)

**Features**:
- Listens to 'online' and 'offline' events
- Initializes with navigator.onLine
- Automatic cleanup on unmount
- Console logging for status changes

**Example Usage**:
```jsx
import { useOnlineStatus } from './hooks/useOnlineStatus';

const isOnline = useOnlineStatus();

{!isOnline && (
  <Alert severity="warning">
    You are offline. Some features may not work.
  </Alert>
)}
```

## Implementation Patterns

### Pattern 1: Basic Error Recovery

```jsx
const [error, setError] = useState(null);

const loadData = async () => {
  try {
    setError(null);
    const response = await api.get('/api/data');
    setData(response.data);
  } catch (err) {
    setError(err);
  }
};

return (
  <>
    {error && (
      <ErrorRecovery
        error={error}
        onRetry={loadData}
        skipAllowed={false}
      />
    )}
  </>
);
```

### Pattern 2: Using useAsyncData Hook

```jsx
const { data, loading, error, retry } = useAsyncData(
  () => api.get('/api/data').then(res => res.data),
  []
);

if (loading) return <CircularProgress />;
if (error) return <ErrorRecovery error={error} onRetry={retry} />;

return <DataDisplay data={data} />;
```

### Pattern 3: Skippable Operations

```jsx
{error && (
  <ErrorRecovery
    error={error}
    onRetry={loadData}
    skipAllowed={true}
    onSkip={() => {
      setError(null);
      setNotification({
        type: 'warning',
        message: 'Operation skipped. Continuing...'
      });
    }}
  />
)}
```

### Pattern 4: Multiple Async Operations

```jsx
const departments = useAsyncData(
  () => api.get('/api/departments').then(res => res.data),
  []
);

const staff = useAsyncData(
  () => api.get('/api/staff').then(res => res.data),
  []
);

return (
  <>
    {departments.error && (
      <ErrorRecovery error={departments.error} onRetry={departments.retry} />
    )}
    {staff.error && (
      <ErrorRecovery error={staff.error} onRetry={staff.retry} />
    )}
  </>
);
```

## Applied Locations

### ConfigurationStep.jsx

**Updated with**:
- Error states for department and staff loading
- ErrorRecovery components for both operations
- Department loading: No skip allowed (critical)
- Staff loading: Skip allowed (can continue without staff)

**Changes**:
```jsx
// Added error states
const [loadError, setLoadError] = useState(null);
const [staffLoadError, setStaffLoadError] = useState(null);

// Updated loadDepartments
const loadDepartments = async () => {
  try {
    setLoadError(null);
    setLoading(true);
    const response = await api.get('/api/departments');
    setDepartments(response.data.departments || []);
  } catch (error) {
    setLoadError(error);
  } finally {
    setLoading(false);
  }
};

// Updated loadStaff
const loadStaff = async (departmentId) => {
  try {
    setStaffLoadError(null);
    setLoading(true);
    const response = await api.get(`/api/departments/${departmentId}/staff`);
    setAllStaff(response.data.staff || []);
  } catch (error) {
    setStaffLoadError(error);
  } finally {
    setLoading(false);
  }
};

// Added ErrorRecovery UI
{loadError && (
  <ErrorRecovery
    error={loadError}
    onRetry={loadDepartments}
    skipAllowed={false}
  />
)}

{staffLoadError && (
  <ErrorRecovery
    error={staffLoadError}
    onRetry={() => loadStaff(data.department)}
    skipAllowed={true}
    onSkip={() => {
      setStaffLoadError(null);
      setNotification({
        type: 'warning',
        message: 'Staff loading skipped.'
      });
    }}
  />
)}
```

### App.jsx

**Updated with**:
- Offline status detection using useOnlineStatus hook
- Fixed position offline banner at top of screen
- High z-index (9999) to ensure visibility

**Changes**:
```jsx
import { useOnlineStatus } from './hooks/useOnlineStatus';

const isOnline = useOnlineStatus();

{!isOnline && (
  <Alert
    severity="warning"
    sx={{
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 9999,
      borderRadius: 0
    }}
  >
    You are offline. Some features may not work.
  </Alert>
)}
```

## Error Message Handling

The ErrorRecovery component provides user-friendly messages for common errors:

| Error Type | User-Friendly Message |
|------------|----------------------|
| Network Error | Unable to connect to the server. Please check your internet connection. |
| Timeout (ECONNABORTED) | The request timed out. Please try again. |
| 404 Not Found | The requested resource was not found. |
| 500+ Server Error | Server error. Please try again later. |
| 401/403 Permission | You do not have permission to access this resource. |
| Default | Shows error.message or "An error occurred" |

## Best Practices

### 1. Always Clear Errors Before Retry
```jsx
const loadData = async () => {
  try {
    setError(null); // Clear previous error
    // ... fetch data
  } catch (err) {
    setError(err);
  }
};
```

### 2. Use skipAllowed for Non-Critical Operations
```jsx
<ErrorRecovery
  error={error}
  onRetry={retry}
  skipAllowed={!isCriticalData}
  onSkip={handleSkip}
/>
```

### 3. Provide User Feedback on Skip
```jsx
onSkip={() => {
  setError(null);
  setNotification({
    type: 'warning',
    message: 'Data loading skipped. You can continue.'
  });
}}
```

### 4. Use useAsyncData for Cleaner Code
```jsx
// Instead of manual state management
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

// Use the hook
const { data, loading, error, retry } = useAsyncData(fetchFunction, []);
```

### 5. Track Retry Counts for UX
```jsx
const { retryCount, retry } = useAsyncData(fetchFunction, []);

if (retryCount > 3) {
  return <Alert severity="error">Too many attempts. Please contact support.</Alert>;
}
```

## Future Enhancements

1. **Exponential Backoff**: Add automatic retry with increasing delays
2. **Circuit Breaker**: Prevent repeated failed requests
3. **Offline Queue**: Queue operations when offline, execute when online
4. **Error Analytics**: Track error patterns for debugging
5. **Smart Retry**: Different retry strategies based on error type
6. **Toast Notifications**: Non-blocking error notifications
7. **Error Logging**: Send errors to monitoring service

## Testing

### Manual Testing Checklist

- [ ] Test retry button with network error
- [ ] Test skip button on non-critical operations
- [ ] Test offline banner appears/disappears correctly
- [ ] Test error messages for different HTTP status codes
- [ ] Test multiple retry attempts increment counter
- [ ] Test useAsyncData with dependencies
- [ ] Test manual execution mode
- [ ] Test success/error callbacks

### Test Scenarios

1. **Network Offline**: Disconnect network, verify offline banner
2. **API Timeout**: Simulate slow API, verify timeout error
3. **404 Error**: Request non-existent resource, verify message
4. **500 Error**: Trigger server error, verify message
5. **Retry Success**: Fail once, succeed on retry
6. **Skip Operation**: Skip non-critical data load, verify continuation

## Accessibility

- Error messages are announced by screen readers (Alert component)
- Retry buttons are keyboard accessible
- Clear visual hierarchy with color-coded severity
- Descriptive button labels (Retry, Continue Without This Data)

## Performance Considerations

- ErrorRecovery component is lightweight (no heavy computations)
- useAsyncData uses useCallback to prevent unnecessary re-renders
- useOnlineStatus uses event listeners (efficient)
- Cleanup functions prevent memory leaks
