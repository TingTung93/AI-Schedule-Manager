/**
 * PagerDuty Alerting Configuration
 * Incident management and escalation policies
 */

const axios = require('axios');

class PagerDutyAlerting {
  constructor() {
    this.apiKey = process.env.PAGERDUTY_API_KEY;
    this.routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    this.baseURL = 'https://api.pagerduty.com';
    this.eventsURL = 'https://events.pagerduty.com/v2/enqueue';

    this.severityLevels = {
      CRITICAL: 'critical',
      ERROR: 'error',
      WARNING: 'warning',
      INFO: 'info'
    };

    this.alertTypes = {
      SYSTEM_DOWN: 'system_down',
      HIGH_ERROR_RATE: 'high_error_rate',
      SLOW_RESPONSE: 'slow_response',
      DATABASE_ISSUES: 'database_issues',
      AI_SERVICE_FAILURE: 'ai_service_failure',
      CACHE_FAILURE: 'cache_failure',
      SECURITY_BREACH: 'security_breach',
      RESOURCE_EXHAUSTION: 'resource_exhaustion'
    };
  }

  async triggerAlert(alertType, severity, summary, details = {}) {
    const event = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: `${alertType}_${Date.now()}`,
      payload: {
        summary,
        severity,
        source: 'ai-schedule-manager',
        component: details.component || 'unknown',
        group: details.group || 'production',
        class: alertType,
        custom_details: {
          ...details,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'production',
          service: 'ai-schedule-manager'
        }
      },
      client: 'AI Schedule Manager Monitoring',
      client_url: details.dashboardUrl || 'https://monitoring.ai-schedule-manager.com'
    };

    try {
      const response = await axios.post(this.eventsURL, event, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('PagerDuty alert triggered:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to trigger PagerDuty alert:', error.message);
      throw error;
    }
  }

  async resolveAlert(dedupKey) {
    const event = {
      routing_key: this.routingKey,
      event_action: 'resolve',
      dedup_key: dedupKey
    };

    try {
      const response = await axios.post(this.eventsURL, event);
      console.log('PagerDuty alert resolved:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to resolve PagerDuty alert:', error.message);
      throw error;
    }
  }

  // Predefined alert configurations
  async systemDownAlert(component, details = {}) {
    return this.triggerAlert(
      this.alertTypes.SYSTEM_DOWN,
      this.severityLevels.CRITICAL,
      `System component ${component} is down`,
      {
        component,
        runbook: 'https://runbooks.ai-schedule-manager.com/system-down',
        ...details
      }
    );
  }

  async highErrorRateAlert(errorRate, threshold, timeWindow, details = {}) {
    return this.triggerAlert(
      this.alertTypes.HIGH_ERROR_RATE,
      this.severityLevels.ERROR,
      `High error rate detected: ${errorRate}% (threshold: ${threshold}%) over ${timeWindow}`,
      {
        errorRate,
        threshold,
        timeWindow,
        runbook: 'https://runbooks.ai-schedule-manager.com/high-error-rate',
        ...details
      }
    );
  }

  async slowResponseAlert(responseTime, threshold, endpoint, details = {}) {
    return this.triggerAlert(
      this.alertTypes.SLOW_RESPONSE,
      this.severityLevels.WARNING,
      `Slow response time detected: ${responseTime}ms (threshold: ${threshold}ms) on ${endpoint}`,
      {
        responseTime,
        threshold,
        endpoint,
        runbook: 'https://runbooks.ai-schedule-manager.com/slow-response',
        ...details
      }
    );
  }

  async databaseIssuesAlert(issue, details = {}) {
    return this.triggerAlert(
      this.alertTypes.DATABASE_ISSUES,
      this.severityLevels.ERROR,
      `Database issue detected: ${issue}`,
      {
        issue,
        runbook: 'https://runbooks.ai-schedule-manager.com/database-issues',
        ...details
      }
    );
  }

  async aiServiceFailureAlert(model, operation, error, details = {}) {
    return this.triggerAlert(
      this.alertTypes.AI_SERVICE_FAILURE,
      this.severityLevels.ERROR,
      `AI service failure: ${model} failed during ${operation}`,
      {
        model,
        operation,
        error: error.message,
        runbook: 'https://runbooks.ai-schedule-manager.com/ai-service-failure',
        ...details
      }
    );
  }

  async cacheFailureAlert(cacheName, operation, details = {}) {
    return this.triggerAlert(
      this.alertTypes.CACHE_FAILURE,
      this.severityLevels.WARNING,
      `Cache failure: ${cacheName} failed during ${operation}`,
      {
        cacheName,
        operation,
        runbook: 'https://runbooks.ai-schedule-manager.com/cache-failure',
        ...details
      }
    );
  }

  async securityBreachAlert(threatType, severity, details = {}) {
    return this.triggerAlert(
      this.alertTypes.SECURITY_BREACH,
      this.severityLevels.CRITICAL,
      `Security breach detected: ${threatType}`,
      {
        threatType,
        runbook: 'https://runbooks.ai-schedule-manager.com/security-breach',
        ...details
      }
    );
  }

  async resourceExhaustionAlert(resource, usage, threshold, details = {}) {
    return this.triggerAlert(
      this.alertTypes.RESOURCE_EXHAUSTION,
      this.severityLevels.WARNING,
      `Resource exhaustion: ${resource} at ${usage}% (threshold: ${threshold}%)`,
      {
        resource,
        usage,
        threshold,
        runbook: 'https://runbooks.ai-schedule-manager.com/resource-exhaustion',
        ...details
      }
    );
  }

  // Alert rule configurations for Prometheus AlertManager
  getPrometheusAlertRules() {
    return {
      groups: [
        {
          name: 'ai-schedule-manager.rules',
          rules: [
            {
              alert: 'ServiceDown',
              expr: 'up{job="ai-schedule-manager"} == 0',
              for: '1m',
              labels: {
                severity: 'critical',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'AI Schedule Manager service is down',
                description: 'The AI Schedule Manager service has been down for more than 1 minute.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/service-down'
              }
            },
            {
              alert: 'HighErrorRate',
              expr: 'rate(ai_schedule_manager_http_requests_total{status_code=~"5.."}[5m]) / rate(ai_schedule_manager_http_requests_total[5m]) > 0.05',
              for: '5m',
              labels: {
                severity: 'error',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'High error rate detected',
                description: 'Error rate is above 5% for more than 5 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/high-error-rate'
              }
            },
            {
              alert: 'SlowResponseTime',
              expr: 'histogram_quantile(0.95, rate(ai_schedule_manager_http_request_duration_seconds_bucket[5m])) > 2',
              for: '10m',
              labels: {
                severity: 'warning',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'Slow response time detected',
                description: '95th percentile response time is above 2 seconds for more than 10 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/slow-response'
              }
            },
            {
              alert: 'DatabaseConnectionHigh',
              expr: 'ai_schedule_manager_db_connections_active > 50',
              for: '5m',
              labels: {
                severity: 'warning',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'High database connection count',
                description: 'Database connections are above 50 for more than 5 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/database-connections'
              }
            },
            {
              alert: 'CacheLowHitRate',
              expr: 'ai_schedule_manager_cache_hit_ratio < 0.7',
              for: '10m',
              labels: {
                severity: 'warning',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'Low cache hit rate',
                description: 'Cache hit rate is below 70% for more than 10 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/cache-hit-rate'
              }
            },
            {
              alert: 'AIProcessingTimeHigh',
              expr: 'histogram_quantile(0.95, rate(ai_schedule_manager_ai_processing_duration_seconds_bucket[5m])) > 10',
              for: '15m',
              labels: {
                severity: 'warning',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'High AI processing time',
                description: '95th percentile AI processing time is above 10 seconds for more than 15 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/ai-processing-time'
              }
            },
            {
              alert: 'MemoryUsageHigh',
              expr: 'process_resident_memory_bytes{job="ai-schedule-manager"} / 1024 / 1024 / 1024 > 2',
              for: '10m',
              labels: {
                severity: 'warning',
                service: 'ai-schedule-manager'
              },
              annotations: {
                summary: 'High memory usage',
                description: 'Memory usage is above 2GB for more than 10 minutes.',
                runbook_url: 'https://runbooks.ai-schedule-manager.com/memory-usage'
              }
            }
          ]
        }
      ]
    };
  }
}

// Escalation policies
const escalationPolicies = {
  critical: [
    { level: 1, users: ['oncall-primary'], delay: 0 },
    { level: 2, users: ['oncall-secondary'], delay: 300 }, // 5 minutes
    { level: 3, users: ['engineering-manager'], delay: 900 } // 15 minutes
  ],
  error: [
    { level: 1, users: ['oncall-primary'], delay: 0 },
    { level: 2, users: ['oncall-secondary'], delay: 600 } // 10 minutes
  ],
  warning: [
    { level: 1, users: ['oncall-primary'], delay: 0 }
  ]
};

// On-call schedules
const onCallSchedules = {
  primary: {
    name: 'Primary On-Call',
    timezone: 'UTC',
    rotation: [
      { user: 'engineer1', start: '2025-01-01T00:00:00Z', duration: '1w' },
      { user: 'engineer2', start: '2025-01-08T00:00:00Z', duration: '1w' },
      { user: 'engineer3', start: '2025-01-15T00:00:00Z', duration: '1w' }
    ]
  },
  secondary: {
    name: 'Secondary On-Call',
    timezone: 'UTC',
    rotation: [
      { user: 'senior-engineer1', start: '2025-01-01T00:00:00Z', duration: '2w' },
      { user: 'senior-engineer2', start: '2025-01-15T00:00:00Z', duration: '2w' }
    ]
  }
};

module.exports = {
  PagerDutyAlerting: new PagerDutyAlerting(),
  escalationPolicies,
  onCallSchedules
};