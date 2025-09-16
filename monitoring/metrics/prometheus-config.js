/**
 * Prometheus Metrics Configuration
 * Custom metrics collection for AI Schedule Manager
 */

const promClient = require('prom-client');

// Enable default system metrics
promClient.collectDefaultMetrics({
  timeout: 10000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  prefix: 'ai_schedule_manager_'
});

// Custom metrics registry
const register = new promClient.Registry();

// HTTP request metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'ai_schedule_manager_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'user_id'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'ai_schedule_manager_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_id']
});

// Schedule metrics
const scheduleOperations = new promClient.Counter({
  name: 'ai_schedule_manager_schedule_operations_total',
  help: 'Total number of schedule operations',
  labelNames: ['operation', 'user_id', 'status']
});

const scheduleOptimizationDuration = new promClient.Histogram({
  name: 'ai_schedule_manager_schedule_optimization_duration_seconds',
  help: 'Time spent optimizing schedules',
  labelNames: ['algorithm', 'complexity', 'user_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

const activeSchedules = new promClient.Gauge({
  name: 'ai_schedule_manager_active_schedules',
  help: 'Number of active schedules',
  labelNames: ['user_id', 'schedule_type']
});

// Task metrics
const taskOperations = new promClient.Counter({
  name: 'ai_schedule_manager_task_operations_total',
  help: 'Total number of task operations',
  labelNames: ['operation', 'task_type', 'user_id', 'status']
});

const taskCompletionTime = new promClient.Histogram({
  name: 'ai_schedule_manager_task_completion_time_seconds',
  help: 'Time to complete tasks',
  labelNames: ['task_type', 'priority', 'user_id'],
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 86400]
});

const taskBacklog = new promClient.Gauge({
  name: 'ai_schedule_manager_task_backlog',
  help: 'Number of pending tasks',
  labelNames: ['priority', 'user_id', 'task_type']
});

// AI Processing metrics
const aiProcessingDuration = new promClient.Histogram({
  name: 'ai_schedule_manager_ai_processing_duration_seconds',
  help: 'AI processing time',
  labelNames: ['model', 'operation', 'input_size_category'],
  buckets: [0.01, 0.1, 0.5, 1, 2, 5, 10, 20]
});

const aiRequestsTotal = new promClient.Counter({
  name: 'ai_schedule_manager_ai_requests_total',
  help: 'Total AI requests',
  labelNames: ['model', 'operation', 'status']
});

const aiTokensUsed = new promClient.Counter({
  name: 'ai_schedule_manager_ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['model', 'operation']
});

// Database metrics
const dbQueryDuration = new promClient.Histogram({
  name: 'ai_schedule_manager_db_query_duration_seconds',
  help: 'Database query execution time',
  labelNames: ['operation', 'table', 'query_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});

const dbConnectionsActive = new promClient.Gauge({
  name: 'ai_schedule_manager_db_connections_active',
  help: 'Number of active database connections'
});

const dbTransactions = new promClient.Counter({
  name: 'ai_schedule_manager_db_transactions_total',
  help: 'Total database transactions',
  labelNames: ['status', 'operation']
});

// Cache metrics
const cacheOperations = new promClient.Counter({
  name: 'ai_schedule_manager_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'cache_name', 'result']
});

const cacheHitRatio = new promClient.Gauge({
  name: 'ai_schedule_manager_cache_hit_ratio',
  help: 'Cache hit ratio',
  labelNames: ['cache_name']
});

const cacheSize = new promClient.Gauge({
  name: 'ai_schedule_manager_cache_size_bytes',
  help: 'Cache size in bytes',
  labelNames: ['cache_name']
});

// Error metrics
const errorCount = new promClient.Counter({
  name: 'ai_schedule_manager_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'component', 'severity']
});

// Business metrics
const userActions = new promClient.Counter({
  name: 'ai_schedule_manager_user_actions_total',
  help: 'Total user actions',
  labelNames: ['action', 'user_tier', 'feature']
});

const revenueMetrics = new promClient.Counter({
  name: 'ai_schedule_manager_revenue_total',
  help: 'Total revenue generated',
  labelNames: ['subscription_tier', 'payment_method']
});

const userSatisfaction = new promClient.Histogram({
  name: 'ai_schedule_manager_user_satisfaction_score',
  help: 'User satisfaction scores',
  labelNames: ['feature', 'user_tier'],
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(scheduleOperations);
register.registerMetric(scheduleOptimizationDuration);
register.registerMetric(activeSchedules);
register.registerMetric(taskOperations);
register.registerMetric(taskCompletionTime);
register.registerMetric(taskBacklog);
register.registerMetric(aiProcessingDuration);
register.registerMetric(aiRequestsTotal);
register.registerMetric(aiTokensUsed);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbConnectionsActive);
register.registerMetric(dbTransactions);
register.registerMetric(cacheOperations);
register.registerMetric(cacheHitRatio);
register.registerMetric(cacheSize);
register.registerMetric(errorCount);
register.registerMetric(userActions);
register.registerMetric(revenueMetrics);
register.registerMetric(userSatisfaction);

// Middleware for HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const userId = req.user?.id || 'anonymous';

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString(), userId)
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString(), userId)
      .inc();
  });

  next();
};

// Metrics collection class
class MetricsCollector {
  // Schedule metrics
  recordScheduleOperation(operation, userId, status = 'success') {
    scheduleOperations.labels(operation, userId, status).inc();
  }

  recordScheduleOptimization(algorithm, complexity, userId, duration) {
    scheduleOptimizationDuration
      .labels(algorithm, complexity, userId)
      .observe(duration);
  }

  updateActiveSchedules(userId, scheduleType, count) {
    activeSchedules.labels(userId, scheduleType).set(count);
  }

  // Task metrics
  recordTaskOperation(operation, taskType, userId, status = 'success') {
    taskOperations.labels(operation, taskType, userId, status).inc();
  }

  recordTaskCompletion(taskType, priority, userId, duration) {
    taskCompletionTime.labels(taskType, priority, userId).observe(duration);
  }

  updateTaskBacklog(priority, userId, taskType, count) {
    taskBacklog.labels(priority, userId, taskType).set(count);
  }

  // AI metrics
  recordAIProcessing(model, operation, inputSizeCategory, duration) {
    aiProcessingDuration
      .labels(model, operation, inputSizeCategory)
      .observe(duration);
  }

  recordAIRequest(model, operation, status = 'success') {
    aiRequestsTotal.labels(model, operation, status).inc();
  }

  recordTokenUsage(model, operation, tokens) {
    aiTokensUsed.labels(model, operation).inc(tokens);
  }

  // Database metrics
  recordDBQuery(operation, table, queryType, duration) {
    dbQueryDuration.labels(operation, table, queryType).observe(duration);
  }

  updateDBConnections(count) {
    dbConnectionsActive.set(count);
  }

  recordDBTransaction(status, operation) {
    dbTransactions.labels(status, operation).inc();
  }

  // Cache metrics
  recordCacheOperation(operation, cacheName, result) {
    cacheOperations.labels(operation, cacheName, result).inc();
  }

  updateCacheHitRatio(cacheName, ratio) {
    cacheHitRatio.labels(cacheName).set(ratio);
  }

  updateCacheSize(cacheName, sizeBytes) {
    cacheSize.labels(cacheName).set(sizeBytes);
  }

  // Error metrics
  recordError(errorType, component, severity = 'error') {
    errorCount.labels(errorType, component, severity).inc();
  }

  // Business metrics
  recordUserAction(action, userTier, feature) {
    userActions.labels(action, userTier, feature).inc();
  }

  recordRevenue(subscriptionTier, paymentMethod, amount) {
    revenueMetrics.labels(subscriptionTier, paymentMethod).inc(amount);
  }

  recordUserSatisfaction(feature, userTier, score) {
    userSatisfaction.labels(feature, userTier).observe(score);
  }

  // Get metrics endpoint
  async getMetrics() {
    return await register.metrics();
  }
}

module.exports = {
  register,
  metricsMiddleware,
  MetricsCollector: new MetricsCollector()
};