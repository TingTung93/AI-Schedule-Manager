# Monitoring Setup Guide

## Overview

This document provides comprehensive setup instructions for the AI Schedule Manager monitoring infrastructure. The monitoring stack includes APM, logging, metrics collection, alerting, and health checks.

## Architecture

### Components

- **APM (Application Performance Monitoring)**: New Relic for distributed tracing and performance monitoring
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) with Fluentd for log aggregation
- **Metrics**: Prometheus for metrics collection, Grafana for visualization
- **Alerting**: PagerDuty for incident management, Slack for notifications
- **Health Checks**: Custom health endpoints and synthetic monitoring
- **Status Page**: Public status page for service availability

### Data Flow

```
Application → APM Agent → New Relic
Application → Structured Logs → Fluentd → Elasticsearch → Kibana
Application → Metrics Endpoint → Prometheus → Grafana
Application → Health Checks → Status Page
Prometheus → AlertManager → PagerDuty/Slack
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ (for application integration)
- Environment variables configured

### 1. Environment Setup

Create a `.env` file with required variables:

```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=your_secure_password

# Elasticsearch
ELASTICSEARCH_PASSWORD=your_secure_password
ELASTICSEARCH_USERNAME=elastic

# PagerDuty
PAGERDUTY_API_KEY=your_pagerduty_api_key
PAGERDUTY_ROUTING_KEY=your_routing_key

# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
SLACK_ALERTS_CHANNEL=#alerts
SLACK_ERRORS_CHANNEL=#errors
SLACK_MONITORING_CHANNEL=#monitoring

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=alerts@ai-schedule-manager.com

# Notification Recipients
ONCALL_EMAIL=oncall@ai-schedule-manager.com
TEAM_EMAIL=team@ai-schedule-manager.com

# New Relic
NEW_RELIC_LICENSE_KEY=your_newrelic_license_key

# Application URLs
APP_BASE_URL=https://ai-schedule-manager.com
API_BASE_URL=https://api.ai-schedule-manager.com
AI_SERVICE_URL=https://ai.ai-schedule-manager.com

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_schedule_manager
DB_USER=postgres
DB_PASSWORD=your_db_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
```

### 2. Deploy Monitoring Stack

```bash
# Make deployment script executable
chmod +x scripts/monitoring/deploy-monitoring.sh

# Deploy the complete monitoring stack
./scripts/monitoring/deploy-monitoring.sh
```

### 3. Application Integration

#### APM Integration

Install New Relic agent:

```bash
npm install newrelic
```

Add to your main application file (before other imports):

```javascript
require('newrelic');
```

Create `newrelic.js` in your project root:

```javascript
module.exports = require('./monitoring/apm/newrelic-config');
```

#### Logging Integration

Install Winston and dependencies:

```bash
npm install winston winston-elasticsearch winston-daily-rotate-file
```

Integrate logging:

```javascript
const { logger, correlationMiddleware, requestLogger } = require('./monitoring/logging/winston-config');

// Add middleware
app.use(correlationMiddleware);
app.use(requestLogger);

// Use logger
logger.info('Application started', { port: 3000 });
```

#### Metrics Integration

Install Prometheus client:

```bash
npm install prom-client
```

Add metrics endpoint:

```javascript
const { register, metricsMiddleware, MetricsCollector } = require('./monitoring/metrics/prometheus-config');

// Add middleware
app.use(metricsMiddleware);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Record custom metrics
MetricsCollector.recordScheduleOperation('created', userId);
```

#### Health Checks Integration

```javascript
const healthService = require('./monitoring/health-checks/health-endpoints');

// Add health check routes
app.use('/health', healthService.getRouter());

// Register custom checks
healthService.registerCheck('my-service', async () => {
  // Your health check logic
  return { status: 'ok', message: 'Service is healthy' };
});
```

## Service URLs

After deployment, the following services will be available:

- **Grafana**: http://localhost:3000 (admin/admin - change password!)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

## Configuration

### Grafana Dashboards

Pre-configured dashboards are automatically imported:

1. **System Overview**: Main application metrics, errors, performance
2. **Business Metrics**: User engagement, revenue, satisfaction scores

### Prometheus Alert Rules

Alert rules are defined in `config/monitoring/prometheus/rules/ai-schedule-manager.yml`:

- Service availability
- Error rates
- Response times
- Resource usage
- Business metrics

### AlertManager Configuration

Alerts are routed based on severity:

- **Critical**: PagerDuty + Slack + Email (immediate)
- **Error**: Slack + Email (5-15 min delay)
- **Warning**: Slack only (1-2 min delay)
- **Info**: Webhook only (5+ min delay)

## Maintenance

### Backup

Automated backup script:

```bash
# Run backup
./scripts/monitoring/backup-monitoring.sh

# Backups are stored in /opt/monitoring-backups
```

### Log Rotation

Log rotation is automatically configured for Docker containers.

### Updates

Update monitoring stack:

```bash
cd config/monitoring
docker-compose -f docker-compose.monitoring.yml pull
docker-compose -f docker-compose.monitoring.yml up -d
```

## Troubleshooting

### Common Issues

1. **Services not starting**:
   ```bash
   # Check logs
   docker-compose -f config/monitoring/docker-compose.monitoring.yml logs -f [service]

   # Check disk space
   df -h

   # Check memory
   free -h
   ```

2. **Elasticsearch cluster health**:
   ```bash
   # Check cluster health
   curl http://localhost:9200/_cluster/health?pretty

   # Check indices
   curl http://localhost:9200/_cat/indices?v
   ```

3. **Prometheus targets**:
   - Visit http://localhost:9090/targets
   - Check target status and error messages

4. **Grafana dashboard issues**:
   - Check datasource connectivity
   - Verify query syntax
   - Check time range settings

### Performance Tuning

1. **Elasticsearch**:
   ```yaml
   # Increase heap size if needed
   environment:
     - "ES_JAVA_OPTS=-Xms4g -Xmx4g"
   ```

2. **Prometheus**:
   ```yaml
   # Adjust retention time
   command:
     - '--storage.tsdb.retention.time=60d'
   ```

3. **Log retention**:
   ```yaml
   # Configure Fluentd buffer sizes
   flush_interval: 10s
   chunk_limit_size: 16m
   ```

## Security

### Access Control

1. Change default passwords immediately
2. Configure authentication for all services
3. Use HTTPS in production
4. Restrict network access

### Data Privacy

1. Mask sensitive data in logs
2. Configure log retention policies
3. Encrypt data at rest
4. Use secure transport

## Alerting Runbooks

Create runbooks for common alerts:

1. **Service Down**: https://runbooks.ai-schedule-manager.com/service-down
2. **High Error Rate**: https://runbooks.ai-schedule-manager.com/high-error-rate
3. **Slow Response**: https://runbooks.ai-schedule-manager.com/slow-response
4. **Database Issues**: https://runbooks.ai-schedule-manager.com/database-issues

## Monitoring Checklist

- [ ] APM instrumentation deployed
- [ ] Structured logging configured
- [ ] Metrics endpoints exposed
- [ ] Health checks implemented
- [ ] Dashboards configured
- [ ] Alert rules defined
- [ ] Notification channels tested
- [ ] Backup procedures tested
- [ ] Documentation updated
- [ ] Team trained on procedures

## Support

For issues with the monitoring setup:

1. Check this documentation
2. Review service logs
3. Consult runbooks
4. Contact the platform team

## References

- [New Relic Documentation](https://docs.newrelic.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Elasticsearch Documentation](https://www.elastic.co/guide/)
- [PagerDuty Documentation](https://support.pagerduty.com/)