import { useCallback, useRef, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { optimisticUpdateQueue } from '../utils/optimisticUpdates';

/**
 * Custom hook for optimistic updates
 * @returns {Object} Optimistic update functions
 */
export function useOptimisticUpdates() {
  const scheduleContext = useSchedule();
  const queueRef = useRef(optimisticUpdateQueue);

  // Set up event listeners for update status
  useEffect(() => {
    const queue = queueRef.current;

    const handleUpdateConfirmed = ({ update, serverData }) => {
      console.log('Optimistic update confirmed:', update.operation);
      // Could trigger a toast notification here
    };

    const handleUpdateFailed = ({ update, error }) => {
      console.error('Optimistic update failed:', update.operation, error);
      // Trigger error notification
      if (scheduleContext.setError) {
        scheduleContext.setError(`Failed to ${update.operation.toLowerCase()}: ${error.message}`);
      }
    };

    queue.on('updateConfirmed', handleUpdateConfirmed);
    queue.on('updateFailed', handleUpdateFailed);

    return () => {
      queue.off('updateConfirmed', handleUpdateConfirmed);
      queue.off('updateFailed', handleUpdateFailed);
    };
  }, [scheduleContext]);

  /**
   * Add schedule with optimistic update
   */
  const addScheduleOptimistic = useCallback(async (scheduleData) => {
    try {
      return await scheduleContext.addSchedule(scheduleData);
    } catch (error) {
      console.error('Failed to add schedule:', error);
      throw error;
    }
  }, [scheduleContext]);

  /**
   * Update schedule with optimistic update
   */
  const updateScheduleOptimistic = useCallback(async (id, updates) => {
    try {
      return await scheduleContext.updateSchedule(id, updates);
    } catch (error) {
      console.error('Failed to update schedule:', error);
      throw error;
    }
  }, [scheduleContext]);

  /**
   * Delete schedule with optimistic update
   */
  const deleteScheduleOptimistic = useCallback(async (id) => {
    try {
      return await scheduleContext.deleteSchedule(id);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      throw error;
    }
  }, [scheduleContext]);

  /**
   * Batch update schedules with optimistic updates
   */
  const batchUpdateOptimistic = useCallback(async (operations) => {
    const results = [];

    for (const operation of operations) {
      try {
        let result;

        switch (operation.type) {
          case 'add':
            result = await addScheduleOptimistic(operation.data);
            break;
          case 'update':
            result = await updateScheduleOptimistic(operation.data.id, operation.data.updates);
            break;
          case 'delete':
            result = await deleteScheduleOptimistic(operation.data.id);
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }

        results.push({ success: true, data: result, operation });
      } catch (error) {
        results.push({ success: false, error, operation });
      }
    }

    return results;
  }, [addScheduleOptimistic, updateScheduleOptimistic, deleteScheduleOptimistic]);

  /**
   * Get pending optimistic updates count
   */
  const getPendingUpdatesCount = useCallback(() => {
    return scheduleContext.optimisticUpdates ? scheduleContext.optimisticUpdates.size : 0;
  }, [scheduleContext.optimisticUpdates]);

  /**
   * Check if a specific update is pending
   */
  const isUpdatePending = useCallback((id) => {
    return scheduleContext.optimisticUpdates ? scheduleContext.optimisticUpdates.has(id) : false;
  }, [scheduleContext.optimisticUpdates]);

  /**
   * Get all pending optimistic updates
   */
  const getPendingUpdates = useCallback(() => {
    if (!scheduleContext.optimisticUpdates) return [];

    return Array.from(scheduleContext.optimisticUpdates.entries()).map(([id, update]) => ({
      id,
      ...update,
    }));
  }, [scheduleContext.optimisticUpdates]);

  /**
   * Force sync with server (clear optimistic updates and refetch)
   */
  const forceSync = useCallback(async () => {
    try {
      // Clear optimistic updates
      if (scheduleContext.optimisticUpdates) {
        scheduleContext.optimisticUpdates.clear();
      }

      // Refetch from server
      await scheduleContext.fetchSchedules(true);
    } catch (error) {
      console.error('Failed to sync with server:', error);
      throw error;
    }
  }, [scheduleContext]);

  return {
    addSchedule: addScheduleOptimistic,
    updateSchedule: updateScheduleOptimistic,
    deleteSchedule: deleteScheduleOptimistic,
    batchUpdate: batchUpdateOptimistic,
    getPendingUpdatesCount,
    isUpdatePending,
    getPendingUpdates,
    forceSync,
  };
}

export default useOptimisticUpdates;