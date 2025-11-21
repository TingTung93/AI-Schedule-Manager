/**
 * Unit tests for department React hooks
 *
 * Tests all custom hooks with mocked React Query
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useDepartments,
  useBulkAssignment,
  useDepartmentAnalytics,
  useAssignmentHistory,
  useUnassignedEmployees,
  useDepartmentDistribution,
} from '../useDepartments';
import departmentService from '../../services/departmentService';

// Mock the department service
jest.mock('../../services/departmentService');

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDepartments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch departments on mount', async () => {
    const mockData = {
      items: [
        { id: 1, name: 'Engineering', active: true },
        { id: 2, name: 'Sales', active: true },
      ],
      total: 2,
      page: 1,
      size: 10,
      pages: 1,
    };

    departmentService.getDepartments.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDepartments(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.departments).toEqual(mockData.items);
    expect(result.current.pagination.total).toBe(2);
  });

  it('should create department', async () => {
    departmentService.getDepartments.mockResolvedValue({ items: [], total: 0 });
    departmentService.createDepartment.mockResolvedValue({
      id: 1,
      name: 'Engineering',
      active: true,
    });

    const { result } = renderHook(() => useDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createDepartment({
        name: 'Engineering',
        active: true,
      });
    });

    expect(departmentService.createDepartment).toHaveBeenCalledWith({
      name: 'Engineering',
      active: true,
    });
  });

  it('should update department with optimistic update', async () => {
    departmentService.getDepartments.mockResolvedValue({ items: [], total: 0 });
    departmentService.updateDepartment.mockResolvedValue({
      id: 1,
      name: 'Engineering',
      description: 'Updated',
    });

    const { result } = renderHook(() => useDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateDepartment(1, { description: 'Updated' });
    });

    expect(departmentService.updateDepartment).toHaveBeenCalledWith(1, {
      description: 'Updated',
    });
  });

  it('should delete department', async () => {
    departmentService.getDepartments.mockResolvedValue({ items: [], total: 0 });
    departmentService.deleteDepartment.mockResolvedValue({ message: 'Deleted' });

    const { result } = renderHook(() => useDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteDepartment(1, false);
    });

    expect(departmentService.deleteDepartment).toHaveBeenCalledWith(1, false);
  });

  it('should handle errors', async () => {
    const error = new Error('Failed to fetch departments');
    departmentService.getDepartments.mockRejectedValue(error);

    const { result } = renderHook(() => useDepartments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});

describe('useBulkAssignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should assign employees with progress tracking', async () => {
    const mockResult = {
      totalAttempted: 3,
      successCount: 3,
      failureCount: 0,
      failures: [],
    };

    departmentService.bulkAssignDepartment.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useBulkAssignment(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.assignEmployees([1, 2, 3], 5);
    });

    expect(departmentService.bulkAssignDepartment).toHaveBeenCalledWith([1, 2, 3], 5);
    expect(result.current.progress).toMatchObject({
      total: 3,
      completed: 3,
      failed: 0,
    });
  });

  it('should transfer employees between departments', async () => {
    const mockResult = {
      totalAttempted: 10,
      successCount: 10,
      failureCount: 0,
    };

    departmentService.transferDepartment.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useBulkAssignment(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.transferEmployees(5, 10);
    });

    expect(departmentService.transferDepartment).toHaveBeenCalledWith(5, 10, null);
  });

  it('should handle partial failures', async () => {
    const mockResult = {
      totalAttempted: 3,
      successCount: 2,
      failureCount: 1,
      failures: [{ employeeId: 3, error: 'Not found' }],
    };

    departmentService.bulkAssignDepartment.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useBulkAssignment(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.assignEmployees([1, 2, 3], 5);
    });

    expect(result.current.progress.failed).toBe(1);
  });
});

describe('useDepartmentAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch overview analytics when no departmentId provided', async () => {
    const mockAnalytics = {
      totalDepartments: 10,
      activeDepartments: 8,
      totalEmployees: 150,
      unassignedEmployees: 5,
    };

    departmentService.getDepartmentAnalyticsOverview.mockResolvedValue(mockAnalytics);

    const { result } = renderHook(() => useDepartmentAnalytics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.analytics).toEqual(mockAnalytics);
    expect(departmentService.getDepartmentAnalyticsOverview).toHaveBeenCalled();
  });

  it('should fetch department-specific analytics when departmentId provided', async () => {
    const mockAnalytics = {
      totalEmployees: 50,
      activeEmployees: 45,
      employeesByRole: { engineer: 30, manager: 10 },
    };

    departmentService.getDepartmentAnalytics.mockResolvedValue(mockAnalytics);

    const { result } = renderHook(() => useDepartmentAnalytics(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.analytics).toEqual(mockAnalytics);
    expect(departmentService.getDepartmentAnalytics).toHaveBeenCalledWith(1);
  });

  it('should auto-refresh at specified interval', async () => {
    jest.useFakeTimers();

    const mockAnalytics = { totalDepartments: 10 };
    departmentService.getDepartmentAnalyticsOverview.mockResolvedValue(mockAnalytics);

    renderHook(() => useDepartmentAnalytics(null, { refetchInterval: 1000 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(departmentService.getDepartmentAnalyticsOverview).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(departmentService.getDepartmentAnalyticsOverview).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });
});

describe('useAssignmentHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch assignment history', async () => {
    const mockHistory = {
      history: [
        {
          id: 1,
          employeeId: 123,
          fromDepartmentId: 1,
          toDepartmentId: 2,
          changedAt: '2024-01-15',
        },
      ],
      total: 1,
      summary: { totalAssignments: 1 },
    };

    departmentService.getEmployeeDepartmentHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useAssignmentHistory(123), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toEqual(mockHistory.history);
    expect(result.current.total).toBe(1);
    expect(result.current.summary).toEqual(mockHistory.summary);
  });

  it('should support pagination with loadMore', async () => {
    const mockHistory = {
      history: [],
      total: 100,
      summary: {},
    };

    departmentService.getEmployeeDepartmentHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useAssignmentHistory(123, { limit: 50 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(departmentService.getEmployeeDepartmentHistory).toHaveBeenCalledWith(123, {
        limit: 50,
        offset: 50,
      });
    });
  });

  it('should not fetch when employeeId is null', () => {
    renderHook(() => useAssignmentHistory(null), {
      wrapper: createWrapper(),
    });

    expect(departmentService.getEmployeeDepartmentHistory).not.toHaveBeenCalled();
  });
});

describe('useUnassignedEmployees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch unassigned employees', async () => {
    const mockEmployees = [
      { id: 1, firstName: 'John', lastName: 'Doe', departmentId: null },
      { id: 2, firstName: 'Jane', lastName: 'Smith', departmentId: null },
    ];

    departmentService.getUnassignedEmployees.mockResolvedValue(mockEmployees);

    const { result } = renderHook(() => useUnassignedEmployees(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.employees).toEqual(mockEmployees);
    expect(result.current.count).toBe(2);
  });
});

describe('useDepartmentDistribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch employee distribution', async () => {
    const mockDistribution = [
      { departmentId: 1, departmentName: 'Engineering', employeeCount: 50, percentage: 50 },
      { departmentId: 2, departmentName: 'Sales', employeeCount: 50, percentage: 50 },
    ];

    departmentService.getDepartmentDistribution.mockResolvedValue(mockDistribution);

    const { result } = renderHook(() => useDepartmentDistribution(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.distribution).toEqual(mockDistribution);
  });
});
