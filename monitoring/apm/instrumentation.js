/**
 * Custom APM Instrumentation
 * Performance monitoring and custom metrics
 */

const newrelic = require('newrelic');

class APMInstrumentation {
  constructor() {
    this.metrics = new Map();
    this.setupCustomMetrics();
  }

  setupCustomMetrics() {
    // Schedule operations metrics
    this.scheduleMetrics = {
      created: 'Custom/Schedule/Created',
      updated: 'Custom/Schedule/Updated',
      deleted: 'Custom/Schedule/Deleted',
      optimized: 'Custom/Schedule/Optimized'
    };

    // Task metrics
    this.taskMetrics = {
      created: 'Custom/Task/Created',
      completed: 'Custom/Task/Completed',
      failed: 'Custom/Task/Failed',
      duration: 'Custom/Task/Duration'
    };

    // Performance metrics
    this.performanceMetrics = {
      aiProcessing: 'Custom/AI/ProcessingTime',
      dbQuery: 'Custom/Database/QueryTime',
      cacheHit: 'Custom/Cache/HitRate',
      cacheMiss: 'Custom/Cache/MissRate'
    };
  }

  // Instrument schedule operations
  instrumentScheduleOperation(operation, scheduleId, userId) {
    return newrelic.startBackgroundTransaction(`schedule_${operation}`, () => {
      newrelic.addCustomAttributes({
        'schedule.id': scheduleId,
        'user.id': userId,
        'operation': operation
      });

      const timer = Date.now();

      return (result) => {
        const duration = Date.now() - timer;
        newrelic.recordMetric(this.scheduleMetrics[operation], 1);
        newrelic.recordMetric(`Custom/Schedule/${operation}/Duration`, duration);

        if (result.error) {
          newrelic.noticeError(result.error);
        }

        return result;
      };
    });
  }

  // Instrument database queries
  instrumentDatabaseQuery(query, params) {
    return newrelic.startBackgroundTransaction('database_query', () => {
      const timer = Date.now();

      newrelic.addCustomAttributes({
        'db.query': query.slice(0, 100), // Truncate for security
        'db.paramCount': params ? params.length : 0
      });

      return (result) => {
        const duration = Date.now() - timer;
        newrelic.recordMetric(this.performanceMetrics.dbQuery, duration);

        if (result.error) {
          newrelic.noticeError(result.error, {
            'db.query': query,
            'db.error': result.error.message
          });
        }

        return result;
      };
    });
  }

  // Instrument AI processing
  instrumentAIProcessing(model, inputSize) {
    return newrelic.startBackgroundTransaction('ai_processing', () => {
      const timer = Date.now();

      newrelic.addCustomAttributes({
        'ai.model': model,
        'ai.inputSize': inputSize
      });

      return (result) => {
        const duration = Date.now() - timer;
        newrelic.recordMetric(this.performanceMetrics.aiProcessing, duration);

        if (result.error) {
          newrelic.noticeError(result.error, {
            'ai.model': model,
            'ai.error': result.error.message
          });
        }

        return result;
      };
    });
  }

  // Record business metrics
  recordBusinessMetric(metricName, value, attributes = {}) {
    newrelic.recordMetric(`Custom/Business/${metricName}`, value);
    if (Object.keys(attributes).length > 0) {
      newrelic.addCustomAttributes(attributes);
    }
  }

  // Record cache metrics
  recordCacheMetric(operation, key, hit = false) {
    const metric = hit ? this.performanceMetrics.cacheHit : this.performanceMetrics.cacheMiss;
    newrelic.recordMetric(metric, 1);

    newrelic.addCustomAttributes({
      'cache.operation': operation,
      'cache.key': key,
      'cache.hit': hit
    });
  }

  // Start web transaction
  startWebTransaction(name, handler) {
    return newrelic.startWebTransaction(name, handler);
  }

  // Add custom attributes to current transaction
  addCustomAttributes(attributes) {
    newrelic.addCustomAttributes(attributes);
  }

  // Notice errors
  noticeError(error, customAttributes = {}) {
    newrelic.noticeError(error, customAttributes);
  }

  // Set transaction name
  setTransactionName(category, name) {
    newrelic.setTransactionName(category, name);
  }
}

module.exports = new APMInstrumentation();