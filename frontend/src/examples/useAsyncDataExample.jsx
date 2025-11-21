/**
 * Example demonstrating the useAsyncData hook usage
 *
 * This file shows how to use the useAsyncData hook for automatic
 * error handling and retry logic in React components.
 */

import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import useAsyncData from '../hooks/useAsyncData';
import ErrorRecovery from '../components/wizard/ErrorRecovery';
import api from '../services/api';

/**
 * Example 1: Basic usage with automatic loading
 */
export const BasicExample = () => {
  const { data: departments, loading, error, retry } = useAsyncData(
    () => api.get('/api/departments').then(res => res.data.departments),
    [] // Empty dependencies - load once on mount
  );

  if (loading) return <CircularProgress />;
  if (error) return <ErrorRecovery error={error} onRetry={retry} />;

  return (
    <Box>
      {departments?.map(dept => (
        <Typography key={dept.id}>{dept.name}</Typography>
      ))}
    </Box>
  );
};

/**
 * Example 2: With dependencies - refetch when ID changes
 */
export const DependencyExample = ({ departmentId }) => {
  const { data: staff, loading, error, retry } = useAsyncData(
    async () => {
      const response = await api.get(`/api/departments/${departmentId}/staff`);
      return response.data.staff;
    },
    [departmentId] // Refetch when departmentId changes
  );

  if (loading) return <CircularProgress />;
  if (error) return <ErrorRecovery error={error} onRetry={retry} skipAllowed />;

  return (
    <Box>
      {staff?.map(member => (
        <Typography key={member.id}>
          {member.firstName} {member.lastName}
        </Typography>
      ))}
    </Box>
  );
};

/**
 * Example 3: Manual execution with callbacks
 */
export const ManualExample = () => {
  const {
    data: schedule,
    loading,
    error,
    retry,
    execute
  } = useAsyncData(
    () => api.get('/api/schedules/latest').then(res => res.data),
    [],
    {
      immediate: false, // Don't execute on mount
      onSuccess: (data) => {
        console.log('Schedule loaded successfully:', data);
      },
      onError: (err) => {
        console.error('Failed to load schedule:', err);
      }
    }
  );

  return (
    <Box>
      <button onClick={execute} disabled={loading}>
        Load Schedule
      </button>

      {loading && <CircularProgress size={20} />}
      {error && <ErrorRecovery error={error} onRetry={retry} />}
      {schedule && (
        <Typography>
          Schedule: {schedule.name}
        </Typography>
      )}
    </Box>
  );
};

/**
 * Example 4: Multiple async operations
 */
export const MultipleAsyncExample = () => {
  const departments = useAsyncData(
    () => api.get('/api/departments').then(res => res.data.departments),
    []
  );

  const shifts = useAsyncData(
    () => api.get('/api/shifts').then(res => res.data.shifts),
    []
  );

  const roles = useAsyncData(
    () => api.get('/api/roles').then(res => res.data.roles),
    []
  );

  // Check if any are loading
  const loading = departments.loading || shifts.loading || roles.loading;

  // Check for errors
  const hasError = departments.error || shifts.error || roles.error;

  return (
    <Box>
      {loading && <CircularProgress />}

      {departments.error && (
        <ErrorRecovery error={departments.error} onRetry={departments.retry} />
      )}
      {shifts.error && (
        <ErrorRecovery error={shifts.error} onRetry={shifts.retry} />
      )}
      {roles.error && (
        <ErrorRecovery error={roles.error} onRetry={roles.retry} />
      )}

      {!loading && !hasError && (
        <Box>
          <Typography>Departments: {departments.data?.length || 0}</Typography>
          <Typography>Shifts: {shifts.data?.length || 0}</Typography>
          <Typography>Roles: {roles.data?.length || 0}</Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * Example 5: With retry count tracking
 */
export const RetryCountExample = () => {
  const { data, loading, error, retry, retryCount } = useAsyncData(
    async () => {
      // Simulate an API call that might fail
      const response = await api.get('/api/flaky-endpoint');
      return response.data;
    },
    []
  );

  if (loading) {
    return (
      <Box>
        <CircularProgress />
        {retryCount > 0 && (
          <Typography color="textSecondary">
            Retry attempt {retryCount}...
          </Typography>
        )}
      </Box>
    );
  }

  if (error) {
    return (
      <ErrorRecovery
        error={error}
        onRetry={retry}
        severity={retryCount > 2 ? 'error' : 'warning'}
      />
    );
  }

  return <Typography>Data loaded successfully!</Typography>;
};
