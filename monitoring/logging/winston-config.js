/**
 * Winston Logging Configuration
 * Structured logging with correlation IDs and ELK integration
 */

const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const DailyRotateFile = require('winston-daily-rotate-file');
const { v4: uuidv4 } = require('uuid');

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, userId, ...meta }) => {
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      correlationId: correlationId || 'unknown',
      userId: userId || 'anonymous',
      service: 'ai-schedule-manager',
      environment: process.env.NODE_ENV || 'development',
      ...meta
    });
  })
);

// Elasticsearch transport configuration
const esTransportOptions = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    }
  },
  index: 'ai-schedule-manager-logs',
  template: {
    name: 'ai-schedule-manager-template',
    pattern: 'ai-schedule-manager-logs-*',
    settings: {
      number_of_shards: 2,
      number_of_replicas: 1
    },
    mappings: {
      properties: {
        '@timestamp': { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        correlationId: { type: 'keyword' },
        userId: { type: 'keyword' },
        service: { type: 'keyword' },
        environment: { type: 'keyword' },
        error: {
          properties: {
            stack: { type: 'text' },
            message: { type: 'text' }
          }
        }
      }
    }
  }
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: {
    service: 'ai-schedule-manager',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),

    // File transport with rotation
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: structuredFormat
    }),

    // Error file transport
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: structuredFormat
    })
  ]
});

// Add Elasticsearch transport in production
if (process.env.NODE_ENV === 'production' && process.env.ELASTICSEARCH_URL) {
  logger.add(new ElasticsearchTransport(esTransportOptions));
}

// Correlation ID middleware
const correlationMiddleware = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('x-correlation-id', req.correlationId);

  // Add correlation ID to all logs in this request
  req.logger = logger.child({ correlationId: req.correlationId });

  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  req.logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    req.logger.log(logLevel, 'Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    });
  });

  next();
};

// Performance logging utility
const logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance metric', {
    operation,
    duration,
    ...metadata
  });
};

// Security event logging
const logSecurityEvent = (event, details = {}) => {
  logger.warn('Security event', {
    securityEvent: event,
    ...details
  });
};

// Business event logging
const logBusinessEvent = (event, data = {}) => {
  logger.info('Business event', {
    businessEvent: event,
    ...data
  });
};

module.exports = {
  logger,
  correlationMiddleware,
  requestLogger,
  logPerformance,
  logSecurityEvent,
  logBusinessEvent
};