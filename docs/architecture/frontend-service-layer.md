# Frontend Service Layer Architecture

## Overview
Clean separation between UI components and API communication with comprehensive error handling, caching, and state management.

## Architecture Principles

### Design Goals
1. **Single Responsibility**: Each service handles one domain
2. **DRY (Don't Repeat Yourself)**: Reusable API call patterns
3. **KISS (Keep It Simple)**: Direct axios usage, no unnecessary wrappers
4. **Error Handling**: Centralized error management
5. **Type Safety**: TypeScript interfaces for all data models
6. **Caching**: Smart caching for performance

## Core API Service

### Base Configuration
Located in `/frontend/src/services/api.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Request/Response Interceptors

**Request Interceptor:**
- Add JWT access token to Authorization header
- Add CSRF token for state-changing requests
- Add request timestamp for debugging

**Response Interceptor:**
- Handle 401 Unauthorized (token refresh)
- Handle 403 Forbidden (permissions)
- Handle 429 Rate limiting
- Log response times
- Centralized error logging

## Authentication Service

### authService
Handles user authentication and session management.

```javascript
export const authService = {
  async login(email, password) {
    const response = await api.post('/api/auth/login', {
      email,
      password
    });
    // Store access token
    // Get CSRF token
    return response;
  },

  async register(userData) {
    const response = await api.post('/api/auth/register', userData);
    return response;
  },

  async logout() {
    await api.post('/api/auth/logout');
    // Clear tokens
  },

  async getCurrentUser() {
    return await api.get('/api/auth/me');
  },

  async refreshToken() {
    return await api.post('/api/auth/refresh');
  }
};
```

## Domain Service Pattern

### Direct Axios Usage (Recommended)
For most CRUD operations, use axios directly instead of service wrappers:

```javascript
// ❌ OLD WAY - Unnecessary wrapper
const employees = await employeeService.getEmployees();

// ✅ NEW WAY - Direct usage
import api, { getErrorMessage } from './services/api';

const response = await api.get('/api/employees');
const employees = response.data.employees;
```

### When to Create Service Functions
Only create service functions when:
1. Complex business logic is needed
2. Multiple API calls need coordination
3. Data transformation is required
4. Caching logic is involved

## React Component Integration

### Using API in Components

```javascript
import React, { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../services/api';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/employees', {
        params: {
          page: 1,
          size: 20,
          active: true
        }
      });
      setEmployees(response.data.items);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const createEmployee = async (employeeData) => {
    try {
      await api.post('/api/employees', employeeData);
      loadEmployees(); // Refresh list
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const updateEmployee = async (id, updates) => {
    try {
      await api.patch(`/api/employees/${id}`, updates);
      loadEmployees();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const deleteEmployee = async (id) => {
    try {
      await api.delete(`/api/employees/${id}`);
      loadEmployees();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  // Render component
};
```

## Custom Hooks for API Calls

### useAsyncData Hook
Reusable hook for async data fetching.

```javascript
// /frontend/src/hooks/useAsyncData.js
import { useState, useEffect } from 'react';
import { getErrorMessage } from '../services/api';

export const useAsyncData = (asyncFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const execute = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction();
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    execute();
  }, dependencies);

  return { data, loading, error, refetch: execute };
};

// Usage in component
const { data: employees, loading, error, refetch } = useAsyncData(
  () => api.get('/api/employees').then(res => res.data.items),
  []
);
```

### useApi Hook
Hook for CRUD operations with loading and error states.

```javascript
// /frontend/src/hooks/useApi.js
import { useState } from 'react';
import { getErrorMessage } from '../services/api';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (apiCall) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, setError };
};

// Usage
const { execute, loading, error } = useApi();

const handleSubmit = async (formData) => {
  try {
    await execute(() => api.post('/api/employees', formData));
    // Success handling
  } catch (err) {
    // Error already handled by hook
  }
};
```

## State Management Integration

### Context API Pattern

```javascript
// /frontend/src/context/EmployeesContext.jsx
import React, { createContext, useContext, useState } from 'react';
import api, { getErrorMessage } from '../services/api';

const EmployeesContext = createContext();

export const EmployeesProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadEmployees = async (params = {}) => {
    try {
      setLoading(true);
      const response = await api.get('/api/employees', { params });
      setEmployees(response.data.items);
    } catch (error) {
      console.error('Load employees failed:', getErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createEmployee = async (employeeData) => {
    const response = await api.post('/api/employees', employeeData);
    setEmployees(prev => [...prev, response.data]);
    return response.data;
  };

  const updateEmployee = async (id, updates) => {
    const response = await api.patch(`/api/employees/${id}`, updates);
    setEmployees(prev => prev.map(emp =>
      emp.id === id ? response.data : emp
    ));
    return response.data;
  };

  const deleteEmployee = async (id) => {
    await api.delete(`/api/employees/${id}`);
    setEmployees(prev => prev.filter(emp => emp.id !== id));
  };

  return (
    <EmployeesContext.Provider value={{
      employees,
      loading,
      loadEmployees,
      createEmployee,
      updateEmployee,
      deleteEmployee
    }}>
      {children}
    </EmployeesContext.Provider>
  );
};

export const useEmployees = () => {
  const context = useContext(EmployeesContext);
  if (!context) {
    throw new Error('useEmployees must be used within EmployeesProvider');
  }
  return context;
};
```

## Caching Strategy

### In-Memory Cache
Simple caching for frequently accessed data.

```javascript
// /frontend/src/services/cache.js
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  set(key, data, ttl = this.ttl) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  invalidate(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const apiCache = new ApiCache();

// Usage
const getCachedEmployees = async () => {
  const cacheKey = 'employees-list';
  const cached = apiCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await api.get('/api/employees');
  const data = response.data.items;
  apiCache.set(cacheKey, data);

  return data;
};
```

### LocalStorage Persistence
For data that should survive page refreshes.

```javascript
// /frontend/src/services/storage.js
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  }
};
```

## Optimistic Updates

### Pattern for Better UX
Update UI immediately, rollback on error.

```javascript
const deleteEmployee = async (id) => {
  // Optimistic update
  const previousEmployees = employees;
  setEmployees(prev => prev.filter(emp => emp.id !== id));

  try {
    await api.delete(`/api/employees/${id}`);
    showNotification('Employee deleted successfully', 'success');
  } catch (error) {
    // Rollback on error
    setEmployees(previousEmployees);
    showNotification(getErrorMessage(error), 'error');
  }
};
```

## Error Handling

### Error Handler Utility

```javascript
// /frontend/src/services/api.js
export const errorHandler = {
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

  isAuthError(error) {
    return error.response?.status === 401 ||
           error.response?.status === 403;
  },

  isValidationError(error) {
    return error.response?.status === 400 ||
           error.response?.status === 422;
  },

  getValidationErrors(error) {
    return error.response?.data?.errors || [];
  }
};

export const getErrorMessage = errorHandler.getErrorMessage;
```

### Component Error Boundaries

```javascript
// /frontend/src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error">
          <AlertTitle>Something went wrong</AlertTitle>
          {this.state.error?.message || 'An unexpected error occurred'}
        </Alert>
      );
    }

    return this.props.children;
  }
}
```

## Data Transformation

### Response Transformers
Convert API responses to frontend format.

```javascript
// /frontend/src/utils/transformers.js

export const transformEmployee = (apiEmployee) => {
  return {
    id: apiEmployee.id,
    firstName: apiEmployee.first_name || apiEmployee.firstName,
    lastName: apiEmployee.last_name || apiEmployee.lastName,
    email: apiEmployee.email,
    role: apiEmployee.role,
    department: apiEmployee.department,
    isActive: apiEmployee.is_active ?? apiEmployee.isActive ?? true
  };
};

export const transformSchedule = (apiSchedule) => {
  return {
    id: apiSchedule.id,
    weekStart: apiSchedule.week_start || apiSchedule.weekStart,
    weekEnd: apiSchedule.week_end || apiSchedule.weekEnd,
    status: apiSchedule.status,
    assignments: (apiSchedule.assignments || []).map(transformAssignment)
  };
};

// Use in API calls
const response = await api.get('/api/employees');
const employees = response.data.items.map(transformEmployee);
```

## Request Validation

### Client-Side Validation
Validate before sending to API.

```javascript
// /frontend/src/utils/validation.js

export const validateEmployee = (employee) => {
  const errors = {};

  if (!employee.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
    errors.email = 'Valid email is required';
  }

  if (!employee.name || employee.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!employee.role) {
    errors.role = 'Role is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Use in form submission
const handleSubmit = async (formData) => {
  const { isValid, errors } = validateEmployee(formData);

  if (!isValid) {
    setFormErrors(errors);
    return;
  }

  try {
    await api.post('/api/employees', formData);
  } catch (error) {
    setError(getErrorMessage(error));
  }
};
```

## Testing Strategy

### Mock API for Testing

```javascript
// /frontend/src/services/__mocks__/api.js
export default {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
};

// Test example
import api from '../services/api';

jest.mock('../services/api');

test('loads employees', async () => {
  api.get.mockResolvedValue({
    data: {
      items: [{ id: 1, name: 'John Doe' }]
    }
  });

  const { result } = renderHook(() => useEmployees());
  await act(async () => {
    await result.current.loadEmployees();
  });

  expect(result.current.employees).toHaveLength(1);
});
```

## Performance Optimization

### Request Debouncing
Prevent excessive API calls.

```javascript
import { debounce } from 'lodash';

const debouncedSearch = debounce(async (searchTerm) => {
  const response = await api.get('/api/employees', {
    params: { search: searchTerm }
  });
  setResults(response.data.items);
}, 300);

// Use in search input
<input
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search employees..."
/>
```

### Request Cancellation
Cancel pending requests on component unmount.

```javascript
useEffect(() => {
  const controller = new AbortController();

  const loadData = async () => {
    try {
      const response = await api.get('/api/employees', {
        signal: controller.signal
      });
      setEmployees(response.data.items);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setError(getErrorMessage(error));
      }
    }
  };

  loadData();

  return () => controller.abort();
}, []);
```

## Summary

### Key Takeaways
1. Use axios instance directly for simple CRUD operations
2. Create custom hooks for reusable patterns
3. Centralize error handling
4. Implement smart caching
5. Use optimistic updates for better UX
6. Validate on client and server
7. Transform data for frontend consumption
8. Test with mocked API calls
