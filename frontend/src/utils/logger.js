/**
 * Environment-aware logging utility
 * Prevents sensitive data leakage in production builds
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    // Production: Only errors
    // Development: All logs
    // Test: No logs
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    const env = process.env.NODE_ENV;

    if (env === 'test') {
      return LOG_LEVELS.NONE;
    }

    if (env === 'production') {
      return LOG_LEVELS.ERROR;
    }

    // Development
    return LOG_LEVELS.DEBUG;
  }

  /**
   * Debug level logging (development only)
   */
  debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Info level logging (development only)
   */
  info(...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  /**
   * Warning level logging
   */
  warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  /**
   * Error level logging (always shown)
   */
  error(...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error('[ERROR]', ...args);
    }
  }

  /**
   * Group logging (development only)
   */
  group(label, callback) {
    if (this.level <= LOG_LEVELS.DEBUG && typeof callback === 'function') {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Table logging (development only)
   */
  table(data) {
    if (this.level <= LOG_LEVELS.DEBUG && console.table) {
      console.table(data);
    }
  }

  /**
   * Performance timing (development only)
   */
  time(label) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  }

  timeEnd(label) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  }
}

// Singleton instance
const logger = new Logger();

export default logger;
