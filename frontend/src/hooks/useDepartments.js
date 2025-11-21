/**
 * Department React Hooks
 *
 * Custom hooks for managing department operations with React Query
 * for caching, automatic refetching, and optimistic updates.
 *
 * @module hooks/useDepartments
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import departmentService from '../services/departmentService';
import { getErrorMessage } from '../services/api';

/**
 * Query keys for React Query cache management
 */
export const DEPARTMENT_QUERY_KEYS = {
  all: ['departments'],
  lists: () => [...DEPARTMENT_QUERY_KEYS.all, 'list'],
  list: (filters) => [...DEPARTMENT_QUERY_KEYS.lists(), filters],
  details: () => [...DEPARTMENT_QUERY_KEYS.all, 'detail'],
  detail: (id) => [...DEPARTMENT_QUERY_KEYS.details(), id],
  analytics: () => [...DEPARTMENT_QUERY_KEYS.all, 'analytics'],
  analyticsOverview: () => [...DEPARTMENT_QUERY_KEYS.analytics(), 'overview'],
  analyticsDistribution: () => [...DEPARTMENT_QUERY_KEYS.analytics(), 'distribution'],
  analyticsDepartment: (id) => [...DEPARTMENT_QUERY_KEYS.analytics(), id],
  unassigned: () => [...DEPARTMENT_QUERY_KEYS.all, 'unassigned'],
  history: (employeeId) => [...DEPARTMENT_QUERY_KEYS.all, 'history', employeeId],
};

/**
 * Hook for department CRUD operations with caching
 *
 * @param {Object} filters - Query filters
 * @param {boolean} [filters.active] - Filter by active status
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.size=10] - Items per page
 * @returns {Object} Department operations and state
 *
 * @example
 * function DepartmentList() {
 *   const {
 *     departments,
 *     isLoading,
 *     error,
 *     pagination,
 *     createDepartment,
 *     updateDepartment,
 *     deleteDepartment,
 *     refetch
 *   } = useDepartments({ active: true, page: 1 });
 *
 *   const handleCreate = async () => {
 *     await createDepartment({
 *       name: 'Engineering',
 *       active: true
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : departments.map(dept => ...)}
 *     </div>
 *   );
 * }
 */
export const useDepartments = (filters = {}) => {
  const queryClient = useQueryClient();

  // Fetch departments list
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: DEPARTMENT_QUERY_KEYS.list(filters),
    queryFn: () => departmentService.getDepartments(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: departmentService.createDepartment,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsOverview() });
    },
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => departmentService.updateDepartment(id, updates),
    onMutate: async ({ id, updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: DEPARTMENT_QUERY_KEYS.detail(id) });

      const previousDepartment = queryClient.getQueryData(DEPARTMENT_QUERY_KEYS.detail(id));

      queryClient.setQueryData(DEPARTMENT_QUERY_KEYS.detail(id), (old) => ({
        ...old,
        ...updates
      }));

      return { previousDepartment };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousDepartment) {
        queryClient.setQueryData(
          DEPARTMENT_QUERY_KEYS.detail(variables.id),
          context.previousDepartment
        );
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.detail(variables.id) });
    },
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, force }) => departmentService.deleteDepartment(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsOverview() });
    },
  });

  return {
    departments: data?.items || [],
    pagination: {
      total: data?.total || 0,
      page: data?.page || 1,
      size: data?.size || 10,
      pages: data?.pages || 1,
    },
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,

    // Mutations
    createDepartment: createMutation.mutateAsync,
    updateDepartment: (id, updates) => updateMutation.mutateAsync({ id, updates }),
    deleteDepartment: (id, force = false) => deleteMutation.mutateAsync({ id, force }),

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

/**
 * Hook for bulk assignment operations with progress tracking
 *
 * @returns {Object} Bulk assignment operations and state
 *
 * @example
 * function BulkAssignModal({ employeeIds }) {
 *   const {
 *     assignEmployees,
 *     transferEmployees,
 *     isLoading,
 *     progress,
 *     error
 *   } = useBulkAssignment();
 *
 *   const handleAssign = async (departmentId) => {
 *     const result = await assignEmployees(employeeIds, departmentId);
 *     console.log(`Assigned ${result.successCount} employees`);
 *   };
 *
 *   return (
 *     <div>
 *       {isLoading && <ProgressBar progress={progress} />}
 *     </div>
 *   );
 * }
 */
export const useBulkAssignment = () => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(null);

  // Bulk assign mutation
  const assignMutation = useMutation({
    mutationFn: ({ employeeIds, departmentId }) => {
      setProgress({ total: employeeIds.length, completed: 0, failed: 0 });
      return departmentService.bulkAssignDepartment(employeeIds, departmentId);
    },
    onSuccess: (data) => {
      setProgress({
        total: data.totalAttempted,
        completed: data.successCount,
        failed: data.failureCount,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsOverview() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsDistribution() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.unassigned() });

      // Reset progress after 2 seconds
      setTimeout(() => setProgress(null), 2000);
    },
    onError: () => {
      setProgress(null);
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({ fromDepartmentId, toDepartmentId, employeeIds }) => {
      if (employeeIds) {
        setProgress({ total: employeeIds.length, completed: 0, failed: 0 });
      }
      return departmentService.transferDepartment(fromDepartmentId, toDepartmentId, employeeIds);
    },
    onSuccess: (data) => {
      setProgress({
        total: data.totalAttempted,
        completed: data.successCount,
        failed: data.failureCount,
      });

      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsOverview() });
      queryClient.invalidateQueries({ queryKey: DEPARTMENT_QUERY_KEYS.analyticsDistribution() });

      setTimeout(() => setProgress(null), 2000);
    },
    onError: () => {
      setProgress(null);
    },
  });

  return {
    assignEmployees: (employeeIds, departmentId) =>
      assignMutation.mutateAsync({ employeeIds, departmentId }),
    transferEmployees: (fromDepartmentId, toDepartmentId, employeeIds = null) =>
      transferMutation.mutateAsync({ fromDepartmentId, toDepartmentId, employeeIds }),
    isLoading: assignMutation.isPending || transferMutation.isPending,
    progress,
    error: assignMutation.error || transferMutation.error,
  };
};

/**
 * Hook for department analytics with auto-refresh
 *
 * @param {number} [departmentId] - Department ID (null for overview)
 * @param {Object} [options] - Hook options
 * @param {number} [options.refetchInterval=30000] - Auto-refresh interval (ms)
 * @returns {Object} Analytics data and state
 *
 * @example
 * function AnalyticsDashboard({ departmentId }) {
 *   const { analytics, isLoading, refetch } = useDepartmentAnalytics(departmentId, {
 *     refetchInterval: 30000 // Auto-refresh every 30s
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Total Employees: {analytics?.totalEmployees}</h2>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 */
export const useDepartmentAnalytics = (departmentId = null, options = {}) => {
  const { refetchInterval = 30000 } = options;

  // Determine which analytics endpoint to use
  const queryFn = departmentId
    ? () => departmentService.getDepartmentAnalytics(departmentId)
    : departmentService.getDepartmentAnalyticsOverview;

  const queryKey = departmentId
    ? DEPARTMENT_QUERY_KEYS.analyticsDepartment(departmentId)
    : DEPARTMENT_QUERY_KEYS.analyticsOverview();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval, // Auto-refresh
    refetchOnWindowFocus: true,
  });

  return {
    analytics: data,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
};

/**
 * Hook for employee assignment history
 *
 * @param {number} employeeId - Employee ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Records per page
 * @returns {Object} History data and operations
 *
 * @example
 * function HistoryTimeline({ employeeId }) {
 *   const { history, summary, total, isLoading, loadMore, hasMore } = useAssignmentHistory(employeeId);
 *
 *   return (
 *     <div>
 *       <h3>Assignment History ({total} changes)</h3>
 *       <p>Total assignments: {summary?.totalAssignments}</p>
 *       {history.map(change => (
 *         <div key={change.id}>
 *           {change.fromDepartment?.name} → {change.toDepartment?.name}
 *           <small>{new Date(change.changedAt).toLocaleString()}</small>
 *         </div>
 *       ))}
 *       {hasMore && <button onClick={loadMore}>Load More</button>}
 *     </div>
 *   );
 * }
 */
export const useAssignmentHistory = (employeeId, options = {}) => {
  const { limit = 50 } = options;
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...DEPARTMENT_QUERY_KEYS.history(employeeId), { limit, offset }],
    queryFn: () => departmentService.getEmployeeDepartmentHistory(employeeId, { limit, offset }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!employeeId,
  });

  const loadMore = useCallback(() => {
    setOffset(prev => prev + limit);
  }, [limit]);

  const hasMore = data ? (offset + limit) < data.total : false;

  return {
    history: data?.history || [],
    summary: data?.summary,
    total: data?.total || 0,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
    loadMore,
    hasMore,
  };
};

/**
 * Hook for unassigned employees list
 *
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=100] - Maximum records
 * @returns {Object} Unassigned employees and state
 *
 * @example
 * function UnassignedList() {
 *   const { employees, count, isLoading, refetch } = useUnassignedEmployees();
 *
 *   return (
 *     <div>
 *       <h3>{count} Unassigned Employees</h3>
 *       {employees.map(emp => (
 *         <EmployeeCard key={emp.id} employee={emp} />
 *       ))}
 *     </div>
 *   );
 * }
 */
export const useUnassignedEmployees = (options = {}) => {
  const { limit = 100 } = options;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...DEPARTMENT_QUERY_KEYS.unassigned(), { limit }],
    queryFn: () => departmentService.getUnassignedEmployees({ limit }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });

  return {
    employees: data || [],
    count: data?.length || 0,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
};

/**
 * Hook for department distribution analytics
 *
 * @returns {Object} Distribution data and state
 *
 * @example
 * function DistributionChart() {
 *   const { distribution, isLoading } = useDepartmentDistribution();
 *
 *   return (
 *     <PieChart data={distribution.map(d => ({
 *       name: d.departmentName,
 *       value: d.employeeCount
 *     }))} />
 *   );
 * }
 */
export const useDepartmentDistribution = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: DEPARTMENT_QUERY_KEYS.analyticsDistribution(),
    queryFn: departmentService.getDepartmentDistribution,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60000, // Auto-refresh every minute
  });

  return {
    distribution: data || [],
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
};

export default {
  useDepartments,
  useBulkAssignment,
  useDepartmentAnalytics,
  useAssignmentHistory,
  useUnassignedEmployees,
  useDepartmentDistribution,
  DEPARTMENT_QUERY_KEYS,
};
