/**
 * New Relic APM Configuration
 * Production monitoring setup with custom instrumentation
 */

const config = {
  app_name: ['AI-Schedule-Manager'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
    filepath: 'stdout'
  },

  // Application Performance Monitoring
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    metrics: {
      enabled: true
    },
    local_decorating: {
      enabled: true
    }
  },

  // Custom Attributes
  attributes: {
    enabled: true,
    include: [
      'request.*',
      'response.*',
      'user.id',
      'schedule.id',
      'task.id'
    ]
  },

  // Transaction Tracer
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'raw',
    explain_threshold: 500
  },

  // Error Collection
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
    capture_attributes: true
  },

  // Browser Monitoring
  browser_monitoring: {
    enable: true
  },

  // Distributed Tracing
  distributed_tracing: {
    enabled: true
  },

  // Custom Metrics
  custom_metrics_enabled: true,

  // Security
  security: {
    enabled: true,
    mode: 'IAST',
    agent: {
      enabled: true
    }
  }
};

module.exports = config;