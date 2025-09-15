// Optimistic updates utility for better user experience

/**
 * Create an optimistic update for immediate UI feedback
 * @param {string} operation - Type of operation (add, update, delete)
 * @param {Object} data - Data for the operation
 * @param {Function} rollbackFn - Function to rollback the operation
 * @returns {Object} Optimistic update object
 */
export function createOptimisticUpdate(operation, data, rollbackFn) {
  return {
    id: generateOptimisticId(),
    operation,
    data,
    timestamp: Date.now(),
    rollbackFn,
    retryCount: 0,
    maxRetries: 3,
  };
}

/**
 * Revert an optimistic update
 * @param {Object} optimisticUpdate - The optimistic update to revert
 * @param {Object} state - Current state
 * @returns {Object} Reverted state
 */
export function revertOptimisticUpdate(optimisticUpdate, state) {
  if (optimisticUpdate.rollbackFn) {
    return optimisticUpdate.rollbackFn(state);
  }

  return state;
}

/**
 * Apply optimistic update to state
 * @param {Object} state - Current state
 * @param {string} operation - Operation type
 * @param {Object} data - Operation data
 * @returns {Object} Updated state
 */
export function applyOptimisticUpdate(state, operation, data) {
  switch (operation) {
    case 'ADD_SCHEDULE':
      return {
        ...state,
        schedules: [...state.schedules, data],
      };

    case 'UPDATE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.map(schedule =>
          schedule.id === data.id ? { ...schedule, ...data.updates } : schedule
        ),
      };

    case 'DELETE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.filter(schedule => schedule.id !== data.id),
      };

    case 'BATCH_UPDATE':
      let updatedSchedules = [...state.schedules];

      data.operations.forEach(op => {
        switch (op.type) {
          case 'add':
            updatedSchedules.push(op.data);
            break;
          case 'update':
            updatedSchedules = updatedSchedules.map(schedule =>
              schedule.id === op.data.id ? { ...schedule, ...op.data.updates } : schedule
            );
            break;
          case 'delete':
            updatedSchedules = updatedSchedules.filter(schedule => schedule.id !== op.data.id);
            break;
        }
      });

      return {
        ...state,
        schedules: updatedSchedules,
      };

    default:
      return state;
  }
}

/**
 * Create rollback function for optimistic updates
 * @param {Object} originalState - Original state before optimistic update
 * @param {string} operation - Operation type
 * @param {Object} data - Operation data
 * @returns {Function} Rollback function
 */
export function createRollbackFunction(originalState, operation, data) {
  return (currentState) => {
    switch (operation) {
      case 'ADD_SCHEDULE':
        return {
          ...currentState,
          schedules: currentState.schedules.filter(schedule => schedule.id !== data.id),
        };

      case 'UPDATE_SCHEDULE':
        const originalSchedule = originalState.schedules.find(s => s.id === data.id);
        if (originalSchedule) {
          return {
            ...currentState,
            schedules: currentState.schedules.map(schedule =>
              schedule.id === data.id ? originalSchedule : schedule
            ),
          };
        }
        return currentState;

      case 'DELETE_SCHEDULE':
        const deletedSchedule = originalState.schedules.find(s => s.id === data.id);
        if (deletedSchedule) {
          return {
            ...currentState,
            schedules: [...currentState.schedules, deletedSchedule],
          };
        }
        return currentState;

      case 'BATCH_UPDATE':
        // For batch operations, restore the original schedules array
        return {
          ...currentState,
          schedules: originalState.schedules,
        };

      default:
        return currentState;
    }
  };
}

/**
 * Queue for managing optimistic updates
 */
export class OptimisticUpdateQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxConcurrent = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Add an optimistic update to the queue
   * @param {Object} update - Optimistic update object
   */
  enqueue(update) {
    this.queue.push(update);
    this.processQueue();
  }

  /**
   * Process the queue of optimistic updates
   */
  async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);

      await Promise.allSettled(
        batch.map(update => this.processUpdate(update))
      );
    }

    this.isProcessing = false;
  }

  /**
   * Process a single optimistic update
   * @param {Object} update - Optimistic update object
   */
  async processUpdate(update) {
    try {
      // Simulate API call processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Process the update based on operation type
      const result = await this.executeUpdate(update);

      if (result.success) {
        this.confirmUpdate(update, result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.handleUpdateError(update, error);
    }
  }

  /**
   * Execute the actual update operation
   * @param {Object} update - Optimistic update object
   * @returns {Promise<Object>} Result of the operation
   */
  async executeUpdate(update) {
    const { operation, data } = update;

    switch (operation) {
      case 'ADD_SCHEDULE':
        return this.addSchedule(data);
      case 'UPDATE_SCHEDULE':
        return this.updateSchedule(data);
      case 'DELETE_SCHEDULE':
        return this.deleteSchedule(data);
      case 'BATCH_UPDATE':
        return this.batchUpdate(data);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Add schedule via API
   */
  async addSchedule(scheduleData) {
    const response = await fetch('/api/schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scheduleData),
    });

    if (!response.ok) {
      throw new Error('Failed to add schedule');
    }

    const data = await response.json();
    return { success: true, data };
  }

  /**
   * Update schedule via API
   */
  async updateSchedule(updateData) {
    const { id, updates } = updateData;

    const response = await fetch(`/api/schedules/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update schedule');
    }

    const data = await response.json();
    return { success: true, data };
  }

  /**
   * Delete schedule via API
   */
  async deleteSchedule(deleteData) {
    const { id } = deleteData;

    const response = await fetch(`/api/schedules/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete schedule');
    }

    return { success: true, data: { id } };
  }

  /**
   * Batch update via API
   */
  async batchUpdate(batchData) {
    const response = await fetch('/api/schedules/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchData),
    });

    if (!response.ok) {
      throw new Error('Failed to perform batch update');
    }

    const data = await response.json();
    return { success: true, data };
  }

  /**
   * Confirm successful update
   * @param {Object} update - Original optimistic update
   * @param {Object} serverData - Data returned from server
   */
  confirmUpdate(update, serverData) {
    // Emit success event
    this.emit('updateConfirmed', { update, serverData });
  }

  /**
   * Handle update error
   * @param {Object} update - Failed optimistic update
   * @param {Error} error - Error that occurred
   */
  handleUpdateError(update, error) {
    update.retryCount++;

    if (update.retryCount < update.maxRetries) {
      // Retry after delay
      setTimeout(() => {
        this.enqueue(update);
      }, this.retryDelay * update.retryCount);
    } else {
      // Max retries exceeded, revert optimistic update
      this.emit('updateFailed', { update, error });
    }
  }

  /**
   * Simple event emitter for update status
   */
  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners) {
      this.listeners = {};
    }

    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
}

/**
 * Generate a unique ID for optimistic updates
 * @returns {string} Unique ID
 */
function generateOptimisticId() {
  return `optimistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an ID is an optimistic update ID
 * @param {string} id - ID to check
 * @returns {boolean} Whether the ID is optimistic
 */
export function isOptimisticId(id) {
  return typeof id === 'string' && id.startsWith('optimistic_');
}

/**
 * Merge optimistic updates with server data
 * @param {Array} localData - Local data with optimistic updates
 * @param {Array} serverData - Data from server
 * @returns {Array} Merged data
 */
export function mergeOptimisticData(localData, serverData) {
  const merged = [...serverData];

  // Add optimistic updates that aren't in server data
  localData.forEach(localItem => {
    if (isOptimisticId(localItem.id)) {
      const serverItem = serverData.find(serverItem =>
        serverItem.tempId === localItem.id ||
        (serverItem.clientId && serverItem.clientId === localItem.clientId)
      );

      if (!serverItem) {
        merged.push(localItem);
      }
    }
  });

  return merged;
}

// Create a global optimistic update queue instance
export const optimisticUpdateQueue = new OptimisticUpdateQueue();

export default {
  createOptimisticUpdate,
  revertOptimisticUpdate,
  applyOptimisticUpdate,
  createRollbackFunction,
  OptimisticUpdateQueue,
  optimisticUpdateQueue,
  isOptimisticId,
  mergeOptimisticData,
};