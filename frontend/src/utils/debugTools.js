// State debugging tools for development
import logger from './logger';

/**
 * Debug utility class for state management
 */
export class StateDebugger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.isEnabled = process.env.NODE_ENV === 'development';
    this.filters = {
      actions: [],
      contexts: [],
      minLevel: 'info',
    };
  }

  /**
   * Enable or disable debugging
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Log a state change
   */
  logStateChange(context, action, prevState, nextState, payload) {
    if (!this.isEnabled) return;

    const logEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      context,
      action,
      prevState: this.cloneState(prevState),
      nextState: this.cloneState(nextState),
      payload: this.cloneState(payload),
      diff: this.calculateStateDiff(prevState, nextState),
      level: 'info',
    };

    this.addLog(logEntry);

    // Console log in development
    if (this.shouldLog(logEntry)) {
      this.consoleLog(logEntry);
    }
  }

  /**
   * Log an action dispatch
   */
  logAction(context, action, payload) {
    if (!this.isEnabled) return;

    const logEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      context,
      action,
      payload: this.cloneState(payload),
      type: 'action',
      level: 'debug',
    };

    this.addLog(logEntry);

    if (this.shouldLog(logEntry)) {
      logger.group(`[${context}] ${action}`, () => {
        logger.debug('Payload:', payload);
      });
    }
  }

  /**
   * Log an error
   */
  logError(context, error, additionalInfo = {}) {
    if (!this.isEnabled) return;

    const logEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      additionalInfo,
      type: 'error',
      level: 'error',
    };

    this.addLog(logEntry);

    if (this.shouldLog(logEntry)) {
      logger.group(`[${context}] ERROR`, () => {
        logger.error(error);
        if (Object.keys(additionalInfo).length > 0) {
          logger.error('Additional Info:', additionalInfo);
        }
      });
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(context, operation, startTime, endTime, metadata = {}) {
    if (!this.isEnabled) return;

    const duration = endTime - startTime;

    const logEntry = {
      id: generateLogId(),
      timestamp: Date.now(),
      context,
      operation,
      duration,
      startTime,
      endTime,
      metadata,
      type: 'performance',
      level: duration > 1000 ? 'warn' : 'info',
    };

    this.addLog(logEntry);

    if (this.shouldLog(logEntry)) {
      const logFn = duration > 1000 ? logger.warn : logger.info;
      logFn(`[${context}] ${operation} took ${duration}ms`);

      if (Object.keys(metadata).length > 0) {
        logger.debug('Metadata:', metadata);
      }
    }
  }

  /**
   * Add log entry to internal storage
   */
  addLog(logEntry) {
    this.logs.unshift(logEntry);

    // Limit log size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify external listeners
    this.notifyLogAdded(logEntry);
  }

  /**
   * Get all logs with optional filtering
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    if (filters.context) {
      filteredLogs = filteredLogs.filter(log => log.context === filters.context);
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.type) {
      filteredLogs = filteredLogs.filter(log => log.type === filters.type);
    }

    if (filters.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime);
    }

    return filteredLogs;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    // Only clear console in development
    if (process.env.NODE_ENV === 'development' && console.clear) {
      console.clear();
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(filters = {}) {
    const logs = this.getLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Import logs from JSON
   */
  importLogs(jsonData) {
    try {
      const logs = JSON.parse(jsonData);
      this.logs = logs;
      return true;
    } catch (error) {
      logger.error('Failed to import logs:', error);
      return false;
    }
  }

  /**
   * Set logging filters
   */
  setFilters(filters) {
    this.filters = { ...this.filters, ...filters };
  }

  /**
   * Check if log entry should be displayed
   */
  shouldLog(logEntry) {
    const levelPriority = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    const minLevelPriority = levelPriority[this.filters.minLevel] || 0;
    const logLevelPriority = levelPriority[logEntry.level] || 0;

    if (logLevelPriority < minLevelPriority) {
      return false;
    }

    if (this.filters.contexts.length > 0 && !this.filters.contexts.includes(logEntry.context)) {
      return false;
    }

    if (this.filters.actions.length > 0 && !this.filters.actions.includes(logEntry.action)) {
      return false;
    }

    return true;
  }

  /**
   * Console log with formatting
   */
  consoleLog(logEntry) {
    const { context, action, prevState, nextState, diff, payload } = logEntry;

    logger.group(`[${context}] ${action}`, () => {
      if (payload !== undefined) {
        logger.debug('Payload:', payload);
      }

      if (prevState && nextState) {
        logger.debug('Previous State:', prevState);
        logger.debug('Next State:', nextState);

        if (diff && Object.keys(diff).length > 0) {
          logger.debug('State Changes:', diff);
        }
      }
    });
  }

  /**
   * Calculate difference between two states
   */
  calculateStateDiff(prevState, nextState) {
    const diff = {};

    // Simple shallow diff for now
    Object.keys(nextState || {}).forEach(key => {
      if (prevState[key] !== nextState[key]) {
        diff[key] = {
          from: prevState[key],
          to: nextState[key],
        };
      }
    });

    return diff;
  }

  /**
   * Deep clone state for logging
   */
  cloneState(state) {
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      // If state contains non-serializable data, return simplified version
      return { ...state };
    }
  }

  /**
   * Add external log listener
   */
  addLogListener(callback) {
    if (!this.logListeners) {
      this.logListeners = [];
    }
    this.logListeners.push(callback);
  }

  /**
   * Remove external log listener
   */
  removeLogListener(callback) {
    if (this.logListeners) {
      this.logListeners = this.logListeners.filter(listener => listener !== callback);
    }
  }

  /**
   * Notify external listeners of new log
   */
  notifyLogAdded(logEntry) {
    if (this.logListeners) {
      this.logListeners.forEach(listener => {
        try {
          listener(logEntry);
        } catch (error) {
          logger.error('Error in log listener:', error);
        }
      });
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const performanceLogs = this.getLogs({ type: 'performance' });

    const summary = {
      totalOperations: performanceLogs.length,
      averageDuration: 0,
      slowestOperation: null,
      fastestOperation: null,
      operationBreakdown: {},
    };

    if (performanceLogs.length === 0) {
      return summary;
    }

    let totalDuration = 0;
    let slowest = performanceLogs[0];
    let fastest = performanceLogs[0];

    performanceLogs.forEach(log => {
      totalDuration += log.duration;

      if (log.duration > slowest.duration) {
        slowest = log;
      }

      if (log.duration < fastest.duration) {
        fastest = log;
      }

      const operation = `${log.context}.${log.operation}`;
      if (!summary.operationBreakdown[operation]) {
        summary.operationBreakdown[operation] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
        };
      }

      summary.operationBreakdown[operation].count++;
      summary.operationBreakdown[operation].totalDuration += log.duration;
      summary.operationBreakdown[operation].averageDuration =
        summary.operationBreakdown[operation].totalDuration /
        summary.operationBreakdown[operation].count;
    });

    summary.averageDuration = totalDuration / performanceLogs.length;
    summary.slowestOperation = slowest;
    summary.fastestOperation = fastest;

    return summary;
  }
}

/**
 * Generate unique log ID
 */
function generateLogId() {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Global state debugger instance
 */
export const stateDebugger = new StateDebugger();

/**
 * React hook for debugging context state
 */
export function useStateDebugger(contextName) {
  const logStateChange = (action, prevState, nextState, payload) => {
    stateDebugger.logStateChange(contextName, action, prevState, nextState, payload);
  };

  const logAction = (action, payload) => {
    stateDebugger.logAction(contextName, action, payload);
  };

  const logError = (error, additionalInfo) => {
    stateDebugger.logError(contextName, error, additionalInfo);
  };

  const logPerformance = (operation, startTime, endTime, metadata) => {
    stateDebugger.logPerformance(contextName, operation, startTime, endTime, metadata);
  };

  return {
    logStateChange,
    logAction,
    logError,
    logPerformance,
    debugger: stateDebugger,
  };
}

/**
 * Higher-order function to wrap reducers with debugging
 */
export function withStateDebugging(reducer, contextName) {
  return (state, action) => {
    const startTime = performance.now();
    const prevState = { ...state };

    try {
      const nextState = reducer(state, action);
      const endTime = performance.now();

      stateDebugger.logStateChange(
        contextName,
        action.type,
        prevState,
        nextState,
        action.payload
      );

      stateDebugger.logPerformance(
        contextName,
        `REDUCER_${action.type}`,
        startTime,
        endTime
      );

      return nextState;
    } catch (error) {
      const endTime = performance.now();

      stateDebugger.logError(contextName, error, {
        action: action.type,
        payload: action.payload,
        prevState,
      });

      stateDebugger.logPerformance(
        contextName,
        `REDUCER_${action.type}_ERROR`,
        startTime,
        endTime
      );

      throw error;
    }
  };
}

/**
 * DevTools extension for React DevTools
 */
export function setupDevTools() {
  if (typeof window !== 'undefined' && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__SCHEDULE_MANAGER_STATE_DEBUGGER__ = stateDebugger;

    // Add helper functions to window for debugging in console
    window.debugState = {
      getLogs: (filters) => stateDebugger.getLogs(filters),
      clearLogs: () => stateDebugger.clearLogs(),
      exportLogs: (filters) => stateDebugger.exportLogs(filters),
      getPerformanceSummary: () => stateDebugger.getPerformanceSummary(),
      setFilters: (filters) => stateDebugger.setFilters(filters),
      enable: () => stateDebugger.setEnabled(true),
      disable: () => stateDebugger.setEnabled(false),
    };

    logger.info('Schedule Manager State Debugger Enabled');
    logger.info('Use window.debugState to access debugging tools');
  }
}

export default {
  StateDebugger,
  stateDebugger,
  useStateDebugger,
  withStateDebugging,
  setupDevTools,
};