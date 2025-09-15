import { useCallback, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';

/**
 * Custom hook for undo/redo functionality
 * @returns {Object} Undo/redo functions and state
 */
export function useUndoRedo() {
  const { canUndo, canRedo, undo, redo, clearHistory } = useSchedule();
  const lastActionRef = useRef(null);

  /**
   * Execute an action and add it to history
   * @param {Function} action - Function to execute
   * @param {string} description - Description of the action
   */
  const executeWithHistory = useCallback(async (action, description) => {
    try {
      const result = await action();
      lastActionRef.current = {
        description,
        timestamp: Date.now(),
      };
      return result;
    } catch (error) {
      console.error(`Failed to execute action: ${description}`, error);
      throw error;
    }
  }, []);

  /**
   * Undo the last action
   */
  const undoLastAction = useCallback(() => {
    if (canUndo) {
      undo();
      lastActionRef.current = null;
    }
  }, [canUndo, undo]);

  /**
   * Redo the last undone action
   */
  const redoLastAction = useCallback(() => {
    if (canRedo) {
      redo();
    }
  }, [canRedo, redo]);

  /**
   * Clear the history
   */
  const clearUndoHistory = useCallback(() => {
    clearHistory();
    lastActionRef.current = null;
  }, [clearHistory]);

  /**
   * Get information about the last action
   */
  const getLastAction = useCallback(() => {
    return lastActionRef.current;
  }, []);

  return {
    canUndo,
    canRedo,
    undo: undoLastAction,
    redo: redoLastAction,
    clearHistory: clearUndoHistory,
    executeWithHistory,
    lastAction: lastActionRef.current,
    getLastAction,
  };
}

export default useUndoRedo;