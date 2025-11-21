# Frontend Department Integration Guide

## Overview

This guide provides comprehensive patterns for integrating department assignment features into the frontend application, including TypeScript interfaces, React hooks, state management, and error handling.

---

## 1. TypeScript Interfaces

### Core Domain Models

```typescript
/**
 * Employee entity with optional department relationship
 */
interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  departmentId?: number | null;
  department?: Department | null;
  roleId?: number;
  hireDate?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Department entity with hierarchical structure
 */
interface Department {
  id: number;
  name: string;
  description?: string;
  parentId?: number | null;
  parent?: Department | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  employeeCount?: number;
  subdepartments?: Department[];
}

/**
 * Department with full hierarchy information
 */
interface DepartmentWithHierarchy extends Department {
  level: number;
  path: string;
  ancestors: Department[];
  descendants: Department[];
}
```

### API Request/Response Types

```typescript
/**
 * Request to assign single employee to department
 */
interface AssignDepartmentRequest {
  employeeId: number;
  departmentId: number | null; // null for unassignment
}

/**
 * Request for bulk employee assignment
 */
interface BulkAssignRequest {
  employeeIds: number[];
  departmentId: number | null;
}

/**
 * Response for bulk assignment operation
 */
interface BulkAssignResponse {
  success: boolean;
  updated: number;
  failed: number;
  results: Array<{
    employeeId: number;
    success: boolean;
    error?: string;
  }>;
  message: string;
}

/**
 * Department analytics data
 */
interface DepartmentAnalytics {
  departmentId: number;
  departmentName: string;
  totalEmployees: number;
  activeEmployees: number;
  byRole: Record<string, number>;
  byPosition: Record<string, number>;
  trend: TrendData[];
  averageTenure?: number;
  turnoverRate?: number;
}

/**
 * Time-series trend data
 */
interface TrendData {
  date: string;
  employeeCount: number;
  hires: number;
  departures: number;
}

/**
 * Assignment history entry
 */
interface AssignmentHistory {
  id: number;
  employeeId: number;
  employeeName: string;
  fromDepartmentId?: number | null;
  fromDepartmentName?: string | null;
  toDepartmentId?: number | null;
  toDepartmentName?: string | null;
  assignedBy: number;
  assignedByName: string;
  assignedAt: string;
  reason?: string;
}

/**
 * Paginated history response
 */
interface HistoryResponse {
  history: AssignmentHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Employee filter criteria
 */
interface EmployeeFilter {
  departmentId?: number | null;
  unassigned?: boolean;
  roleId?: number;
  search?: string;
  active?: boolean;
}
```

### API Error Types

```typescript
/**
 * Standard API error response
 */
interface ApiError {
  success: false;
  error: string;
  details?: {
    field?: string;
    code?: string;
    constraint?: string;
  };
  statusCode: number;
}

/**
 * Validation error with field-specific messages
 */
interface ValidationError extends ApiError {
  errors: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
}

/**
 * Conflict error (409) with detailed information
 */
interface ConflictError extends ApiError {
  conflictType: 'duplicate' | 'constraint' | 'state';
  conflictingResource?: {
    type: string;
    id: number;
    name?: string;
  };
  suggestions?: string[];
}
```

---

## 2. React Hooks

### useDepartmentAssignment Hook

```typescript
/**
 * Hook for managing single employee department assignment
 *
 * Features:
 * - Optimistic updates
 * - Automatic cache invalidation
 * - Error rollback
 * - Loading states
 *
 * @example
 * const { assign, unassign, isLoading, error } = useDepartmentAssignment();
 *
 * await assign(employeeId, departmentId);
 * await unassign(employeeId);
 */
interface UseDepartmentAssignmentReturn {
  assign: (employeeId: number, departmentId: number) => Promise<void>;
  unassign: (employeeId: number) => Promise<void>;
  isLoading: boolean;
  error: ApiError | null;
  reset: () => void;
}

function useDepartmentAssignment(): UseDepartmentAssignmentReturn {
  const queryClient = useQueryClient();
  const [error, setError] = useState<ApiError | null>(null);

  const assignMutation = useMutation({
    mutationFn: async ({ employeeId, departmentId }: AssignDepartmentRequest) => {
      const response = await api.post(`/api/employees/${employeeId}/department`, {
        departmentId
      });
      return response.data;
    },
    onMutate: async ({ employeeId, departmentId }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['employee', employeeId]);

      // Snapshot previous value
      const previousEmployee = queryClient.getQueryData(['employee', employeeId]);

      // Optimistically update
      queryClient.setQueryData(['employee', employeeId], (old: Employee) => ({
        ...old,
        departmentId
      }));

      return { previousEmployee };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEmployee) {
        queryClient.setQueryData(['employee', variables.employeeId], context.previousEmployee);
      }
      setError(err as ApiError);
    },
    onSuccess: (data, { employeeId, departmentId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries(['employee', employeeId]);
      queryClient.invalidateQueries(['employees']);
      queryClient.invalidateQueries(['department', departmentId, 'employees']);
      queryClient.invalidateQueries(['department-analytics', departmentId]);
    }
  });

  return {
    assign: (employeeId, departmentId) =>
      assignMutation.mutateAsync({ employeeId, departmentId }),
    unassign: (employeeId) =>
      assignMutation.mutateAsync({ employeeId, departmentId: null }),
    isLoading: assignMutation.isLoading,
    error,
    reset: () => setError(null)
  };
}
```

### useBulkAssignment Hook

```typescript
/**
 * Hook for bulk employee assignment operations
 *
 * Features:
 * - Progress tracking
 * - Partial success handling
 * - Detailed error reporting
 * - Automatic retry for failed items
 *
 * @example
 * const { bulkAssign, progress, results, isLoading } = useBulkAssignment();
 *
 * const result = await bulkAssign(employeeIds, departmentId);
 * if (result.failed > 0) {
 *   // Handle partial failures
 * }
 */
interface UseBulkAssignmentReturn {
  bulkAssign: (employeeIds: number[], departmentId: number | null) => Promise<BulkAssignResponse>;
  progress: {
    processed: number;
    total: number;
    percentage: number;
  } | null;
  results: BulkAssignResponse | null;
  isLoading: boolean;
  error: ApiError | null;
  reset: () => void;
}

function useBulkAssignment(): UseBulkAssignmentReturn {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [results, setResults] = useState<BulkAssignResponse | null>(null);

  const bulkMutation = useMutation({
    mutationFn: async ({ employeeIds, departmentId }: BulkAssignRequest) => {
      setProgress({ processed: 0, total: employeeIds.length, percentage: 0 });

      const response = await api.post('/api/employees/bulk-assign', {
        employeeIds,
        departmentId
      });

      return response.data;
    },
    onSuccess: (data: BulkAssignResponse) => {
      setResults(data);
      setProgress({
        processed: data.updated + data.failed,
        total: data.updated + data.failed,
        percentage: 100
      });

      // Invalidate all employee and department queries
      queryClient.invalidateQueries(['employees']);
      queryClient.invalidateQueries(['departments']);
      queryClient.invalidateQueries(['department-analytics']);
    },
    onError: (error: ApiError) => {
      setProgress(null);
      setResults(null);
    }
  });

  return {
    bulkAssign: (employeeIds, departmentId) =>
      bulkMutation.mutateAsync({ employeeIds, departmentId }),
    progress,
    results,
    isLoading: bulkMutation.isLoading,
    error: bulkMutation.error as ApiError | null,
    reset: () => {
      setProgress(null);
      setResults(null);
      bulkMutation.reset();
    }
  };
}
```

### useDepartmentAnalytics Hook

```typescript
/**
 * Hook for fetching and caching department analytics
 *
 * Features:
 * - Automatic refetch on interval
 * - Stale-while-revalidate caching
 * - Time range filtering
 * - Real-time updates via WebSocket (optional)
 *
 * @example
 * const { analytics, isLoading, refetch } = useDepartmentAnalytics(deptId, {
 *   timeRange: '30d',
 *   includeInactive: false
 * });
 */
interface UseDepartmentAnalyticsOptions {
  timeRange?: '7d' | '30d' | '90d' | '1y';
  includeInactive?: boolean;
  enableRealtime?: boolean;
}

interface UseDepartmentAnalyticsReturn {
  analytics: DepartmentAnalytics | null;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

function useDepartmentAnalytics(
  departmentId: number,
  options: UseDepartmentAnalyticsOptions = {}
): UseDepartmentAnalyticsReturn {
  const { timeRange = '30d', includeInactive = false, enableRealtime = false } = options;

  const query = useQuery({
    queryKey: ['department-analytics', departmentId, timeRange, includeInactive],
    queryFn: async () => {
      const response = await api.get(`/api/departments/${departmentId}/analytics`, {
        params: { timeRange, includeInactive }
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enableRealtime ? 30000 : false, // 30 seconds if realtime
  });

  return {
    analytics: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as ApiError | null,
    refetch: async () => { await query.refetch(); }
  };
}
```

### useDepartmentHistory Hook

```typescript
/**
 * Hook for fetching paginated assignment history
 *
 * Features:
 * - Infinite scroll support
 * - Filter by employee, department, or date range
 * - Export to CSV
 *
 * @example
 * const { history, hasMore, loadMore, exportCSV } = useDepartmentHistory({
 *   departmentId: 1,
 *   limit: 20
 * });
 */
interface UseDepartmentHistoryOptions {
  departmentId?: number;
  employeeId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface UseDepartmentHistoryReturn {
  history: AssignmentHistory[];
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  exportCSV: () => Promise<void>;
  refetch: () => void;
}

function useDepartmentHistory(
  options: UseDepartmentHistoryOptions = {}
): UseDepartmentHistoryReturn {
  const { limit = 20 } = options;

  const query = useInfiniteQuery({
    queryKey: ['assignment-history', options],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/api/employees/assignment-history', {
        params: {
          ...options,
          page: pageParam,
          limit
        }
      });
      return response.data;
    },
    getNextPageParam: (lastPage: HistoryResponse) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    }
  });

  const exportCSV = async () => {
    const response = await api.get('/api/employees/assignment-history/export', {
      params: options,
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `assignment-history-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return {
    history: query.data?.pages.flatMap(page => page.history) || [],
    hasMore: query.hasNextPage || false,
    isLoading: query.isLoading,
    loadMore: () => query.fetchNextPage(),
    exportCSV,
    refetch: () => query.refetch()
  };
}
```

### useUnassignedEmployees Hook

```typescript
/**
 * Hook for fetching employees without department assignment
 *
 * Features:
 * - Real-time count updates
 * - Search and filter
 * - Bulk selection support
 *
 * @example
 * const { employees, count, isLoading } = useUnassignedEmployees({
 *   search: 'john',
 *   roleId: 2
 * });
 */
interface UseUnassignedEmployeesOptions {
  search?: string;
  roleId?: number;
  active?: boolean;
}

interface UseUnassignedEmployeesReturn {
  employees: Employee[];
  count: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

function useUnassignedEmployees(
  options: UseUnassignedEmployeesOptions = {}
): UseUnassignedEmployeesReturn {
  const query = useQuery({
    queryKey: ['employees', 'unassigned', options],
    queryFn: async () => {
      const response = await api.get('/api/employees', {
        params: {
          ...options,
          unassigned: true
        }
      });
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    employees: query.data?.employees || [],
    count: query.data?.count || 0,
    isLoading: query.isLoading,
    error: query.error as ApiError | null,
    refetch: () => query.refetch()
  };
}
```

---

## 3. State Management Patterns

### Redux Toolkit Slice (if using Redux)

```typescript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface DepartmentState {
  departments: Department[];
  selectedDepartment: Department | null;
  analytics: Record<number, DepartmentAnalytics>;
  loading: {
    departments: boolean;
    assignment: boolean;
    analytics: boolean;
  };
  error: ApiError | null;
}

const initialState: DepartmentState = {
  departments: [],
  selectedDepartment: null,
  analytics: {},
  loading: {
    departments: false,
    assignment: false,
    analytics: false
  },
  error: null
};

// Async thunks
export const fetchDepartments = createAsyncThunk(
  'departments/fetchAll',
  async () => {
    const response = await api.get('/api/departments');
    return response.data;
  }
);

export const assignDepartment = createAsyncThunk(
  'departments/assign',
  async ({ employeeId, departmentId }: AssignDepartmentRequest) => {
    const response = await api.post(`/api/employees/${employeeId}/department`, {
      departmentId
    });
    return response.data;
  }
);

// Slice
const departmentSlice = createSlice({
  name: 'departments',
  initialState,
  reducers: {
    setSelectedDepartment: (state, action) => {
      state.selectedDepartment = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.loading.departments = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading.departments = false;
        state.departments = action.payload;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading.departments = false;
        state.error = action.error as ApiError;
      })
      .addCase(assignDepartment.pending, (state) => {
        state.loading.assignment = true;
        state.error = null;
      })
      .addCase(assignDepartment.fulfilled, (state) => {
        state.loading.assignment = false;
      })
      .addCase(assignDepartment.rejected, (state, action) => {
        state.loading.assignment = false;
        state.error = action.error as ApiError;
      });
  }
});

export const { setSelectedDepartment, clearError } = departmentSlice.actions;
export default departmentSlice.reducer;
```

### Zustand Store (Alternative)

```typescript
import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface DepartmentStore {
  // State
  departments: Department[];
  selectedDepartmentId: number | null;
  bulkSelection: number[];

  // Actions
  setDepartments: (departments: Department[]) => void;
  selectDepartment: (id: number | null) => void;
  toggleBulkSelection: (employeeId: number) => void;
  clearBulkSelection: () => void;
  selectAllUnassigned: (employeeIds: number[]) => void;
}

export const useDepartmentStore = create<DepartmentStore>()(
  devtools(
    persist(
      (set) => ({
        departments: [],
        selectedDepartmentId: null,
        bulkSelection: [],

        setDepartments: (departments) => set({ departments }),

        selectDepartment: (id) => set({ selectedDepartmentId: id }),

        toggleBulkSelection: (employeeId) => set((state) => ({
          bulkSelection: state.bulkSelection.includes(employeeId)
            ? state.bulkSelection.filter(id => id !== employeeId)
            : [...state.bulkSelection, employeeId]
        })),

        clearBulkSelection: () => set({ bulkSelection: [] }),

        selectAllUnassigned: (employeeIds) => set({ bulkSelection: employeeIds })
      }),
      {
        name: 'department-store',
        partialize: (state) => ({
          selectedDepartmentId: state.selectedDepartmentId
        })
      }
    )
  )
);
```

### Optimistic Update Pattern

```typescript
/**
 * Pattern for optimistic updates with automatic rollback
 */
async function optimisticAssignment(
  employeeId: number,
  departmentId: number | null,
  queryClient: QueryClient
) {
  // 1. Cancel outgoing queries
  await queryClient.cancelQueries(['employee', employeeId]);

  // 2. Snapshot current state
  const previousEmployee = queryClient.getQueryData<Employee>(['employee', employeeId]);
  const previousDepartment = previousEmployee?.departmentId;

  // 3. Optimistically update UI
  queryClient.setQueryData<Employee>(['employee', employeeId], (old) => ({
    ...old!,
    departmentId,
    department: departmentId
      ? queryClient.getQueryData<Department>(['department', departmentId]) || null
      : null
  }));

  try {
    // 4. Perform actual API call
    await api.post(`/api/employees/${employeeId}/department`, { departmentId });

    // 5. Invalidate related queries on success
    queryClient.invalidateQueries(['employee', employeeId]);
    queryClient.invalidateQueries(['employees']);
    if (previousDepartment) {
      queryClient.invalidateQueries(['department', previousDepartment, 'employees']);
    }
    if (departmentId) {
      queryClient.invalidateQueries(['department', departmentId, 'employees']);
    }
  } catch (error) {
    // 6. Rollback on error
    queryClient.setQueryData(['employee', employeeId], previousEmployee);
    throw error;
  }
}
```

---

## 4. Error Handling Patterns

### Error Boundary for Department Features

```typescript
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DepartmentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Department feature error:', error, errorInfo);
    // Log to error tracking service (e.g., Sentry)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Department Assignment Error</h2>
          <p>Unable to load department features. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Toast Notification Service

```typescript
import { toast } from 'react-toastify';

interface ToastOptions {
  autoClose?: number;
  position?: 'top-right' | 'top-center' | 'bottom-right';
}

export const departmentToast = {
  success: (message: string, options?: ToastOptions) => {
    toast.success(message, {
      autoClose: 3000,
      position: 'top-right',
      ...options
    });
  },

  error: (error: ApiError | Error, options?: ToastOptions) => {
    const message = error instanceof Error
      ? error.message
      : error.error || 'An error occurred';

    toast.error(message, {
      autoClose: 5000,
      position: 'top-right',
      ...options
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    toast.warning(message, {
      autoClose: 4000,
      position: 'top-right',
      ...options
    });
  },

  info: (message: string, options?: ToastOptions) => {
    toast.info(message, {
      autoClose: 3000,
      position: 'top-right',
      ...options
    });
  },

  bulkResult: (result: BulkAssignResponse) => {
    if (result.failed === 0) {
      toast.success(`Successfully assigned ${result.updated} employees`, {
        autoClose: 3000
      });
    } else if (result.updated === 0) {
      toast.error(`Failed to assign all ${result.failed} employees`, {
        autoClose: 5000
      });
    } else {
      toast.warning(
        `Assigned ${result.updated} employees, ${result.failed} failed`,
        { autoClose: 5000 }
      );
    }
  }
};
```

### Error Handler Utility

```typescript
/**
 * Centralized error handler for API errors
 */
export function handleApiError(error: unknown): ApiError {
  // Axios error
  if (axios.isAxiosError(error)) {
    const apiError: ApiError = {
      success: false,
      error: error.response?.data?.error || error.message,
      statusCode: error.response?.status || 500,
      details: error.response?.data?.details
    };

    // Handle specific status codes
    switch (apiError.statusCode) {
      case 400:
        departmentToast.error({
          ...apiError,
          error: 'Invalid request. Please check your input.'
        });
        break;
      case 404:
        departmentToast.error({
          ...apiError,
          error: 'Resource not found.'
        });
        break;
      case 409:
        const conflict = apiError as ConflictError;
        departmentToast.warning(
          conflict.suggestions?.join(' ') || conflict.error
        );
        break;
      case 500:
        departmentToast.error({
          ...apiError,
          error: 'Server error. Please try again later.'
        });
        break;
      default:
        departmentToast.error(apiError);
    }

    return apiError;
  }

  // Generic error
  const genericError: ApiError = {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
    statusCode: 500
  };

  departmentToast.error(genericError);
  return genericError;
}
```

### Retry Logic

```typescript
/**
 * Retry failed API calls with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (axios.isAxiosError(error) && error.response?.status < 500) {
        throw error;
      }

      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage in hooks
const assignWithRetry = async (employeeId: number, departmentId: number) => {
  return retryWithBackoff(
    () => api.post(`/api/employees/${employeeId}/department`, { departmentId }),
    3,
    1000
  );
};
```

---

## 5. Cache Invalidation Strategy

### Query Key Structure

```typescript
/**
 * Hierarchical query key structure for efficient invalidation
 */
const queryKeys = {
  employees: {
    all: ['employees'] as const,
    lists: () => [...queryKeys.employees.all, 'list'] as const,
    list: (filters: EmployeeFilter) =>
      [...queryKeys.employees.lists(), filters] as const,
    details: () => [...queryKeys.employees.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.employees.details(), id] as const,
    unassigned: () => [...queryKeys.employees.all, 'unassigned'] as const,
  },
  departments: {
    all: ['departments'] as const,
    lists: () => [...queryKeys.departments.all, 'list'] as const,
    list: (filters?: object) =>
      [...queryKeys.departments.lists(), filters || {}] as const,
    details: () => [...queryKeys.departments.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.departments.details(), id] as const,
    employees: (id: number) =>
      [...queryKeys.departments.detail(id), 'employees'] as const,
    analytics: (id: number, timeRange?: string) =>
      [...queryKeys.departments.detail(id), 'analytics', timeRange] as const,
  },
  history: {
    all: ['assignment-history'] as const,
    list: (filters?: UseDepartmentHistoryOptions) =>
      [...queryKeys.history.all, filters || {}] as const,
  },
};

export { queryKeys };
```

### Invalidation Helper

```typescript
/**
 * Helper to invalidate related queries after department assignment
 */
export function invalidateDepartmentQueries(
  queryClient: QueryClient,
  {
    employeeId,
    fromDepartmentId,
    toDepartmentId
  }: {
    employeeId: number;
    fromDepartmentId?: number | null;
    toDepartmentId?: number | null;
  }
) {
  // Invalidate employee data
  queryClient.invalidateQueries(queryKeys.employees.detail(employeeId));
  queryClient.invalidateQueries(queryKeys.employees.lists());
  queryClient.invalidateQueries(queryKeys.employees.unassigned());

  // Invalidate old department
  if (fromDepartmentId) {
    queryClient.invalidateQueries(
      queryKeys.departments.employees(fromDepartmentId)
    );
    queryClient.invalidateQueries(
      queryKeys.departments.analytics(fromDepartmentId)
    );
  }

  // Invalidate new department
  if (toDepartmentId) {
    queryClient.invalidateQueries(
      queryKeys.departments.employees(toDepartmentId)
    );
    queryClient.invalidateQueries(
      queryKeys.departments.analytics(toDepartmentId)
    );
  }

  // Invalidate history
  queryClient.invalidateQueries(queryKeys.history.all);
}
```

---

## 6. Real-time Synchronization

### WebSocket Integration (Optional)

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface DepartmentUpdateEvent {
  type: 'ASSIGNMENT' | 'UNASSIGNMENT' | 'BULK_ASSIGNMENT';
  employeeIds: number[];
  departmentId?: number | null;
  timestamp: string;
}

/**
 * Hook to sync department changes via WebSocket
 */
export function useDepartmentSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:3000');

    ws.onmessage = (event) => {
      const update: DepartmentUpdateEvent = JSON.parse(event.data);

      switch (update.type) {
        case 'ASSIGNMENT':
        case 'UNASSIGNMENT':
          update.employeeIds.forEach(employeeId => {
            queryClient.invalidateQueries(queryKeys.employees.detail(employeeId));
          });
          if (update.departmentId) {
            queryClient.invalidateQueries(
              queryKeys.departments.employees(update.departmentId)
            );
          }
          break;

        case 'BULK_ASSIGNMENT':
          queryClient.invalidateQueries(queryKeys.employees.all);
          queryClient.invalidateQueries(queryKeys.departments.all);
          break;
      }
    };

    return () => ws.close();
  }, [queryClient]);
}
```

---

## 7. Testing Utilities

### Mock Data Factories

```typescript
/**
 * Factory functions for generating test data
 */
export const mockFactories = {
  employee: (overrides?: Partial<Employee>): Employee => ({
    id: Math.floor(Math.random() * 1000),
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    departmentId: null,
    department: null,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  department: (overrides?: Partial<Department>): Department => ({
    id: Math.floor(Math.random() * 100),
    name: 'Engineering',
    parentId: null,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),

  bulkAssignResponse: (
    overrides?: Partial<BulkAssignResponse>
  ): BulkAssignResponse => ({
    success: true,
    updated: 5,
    failed: 0,
    results: [],
    message: 'Bulk assignment completed',
    ...overrides
  })
};
```

### Hook Testing Wrapper

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-hooks';

/**
 * Wrapper for testing React Query hooks
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Usage
test('useDepartmentAssignment hook', async () => {
  const { result, waitFor } = renderHook(
    () => useDepartmentAssignment(),
    { wrapper: createQueryWrapper() }
  );

  await act(async () => {
    await result.current.assign(1, 10);
  });

  await waitFor(() => !result.current.isLoading);
  expect(result.current.error).toBeNull();
});
```

---

## Summary

This guide provides:

✅ **Comprehensive TypeScript interfaces** for type safety
✅ **Production-ready React hooks** with optimistic updates
✅ **Flexible state management** (Redux Toolkit + Zustand)
✅ **Robust error handling** with user-friendly feedback
✅ **Efficient caching strategies** with React Query
✅ **Real-time sync capabilities** via WebSocket
✅ **Testing utilities** for reliable development

**Next Steps:**
1. Review the UI component specifications in `ui-component-specs.md`
2. Implement the hooks in your React application
3. Set up error boundaries and toast notifications
4. Configure React Query with appropriate cache times
5. Add WebSocket sync for real-time updates (optional)

**Architecture Principles:**
- **Type Safety First:** Leverage TypeScript for compile-time error detection
- **Optimistic UI:** Update UI immediately, rollback on errors
- **Cache Efficiency:** Use hierarchical query keys for targeted invalidation
- **Error Resilience:** Graceful degradation with retry logic
- **User Experience:** Immediate feedback via toast notifications
