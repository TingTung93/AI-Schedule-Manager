# Monitoring Guide

## Overview
Comprehensive monitoring strategy for the Employee Management System in production.

## Monitoring Philosophy

**Proactive Monitoring**: Detect issues before users do
**Comprehensive Coverage**: Monitor all system layers
**Actionable Alerts**: Only alert on actionable issues
**Root Cause Analysis**: Logs and metrics for debugging

## What to Monitor

### 1. Application Uptime

**Metric**: Application availability percentage
**Target**: 99.9% uptime (8.76 hours downtime/year)

**Monitoring**:
```bash
# Health check endpoint
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-11-24T12:00:00Z",
  "uptime": 86400,  # seconds
  "version": "1.0.0"
}
```

**Tools**:
- **External Monitoring**: UptimeRobot, Pingdom, StatusCake
- **Internal**: Custom health checks
- **Check Frequency**: Every 60 seconds

**Alerts**:
- Application down for >2 minutes → Critical alert
- Application unreachable → Critical alert
- Health check timeout (>5s) → Warning

### 2. Response Time Metrics

**Metrics**: p50, p95, p99 response times per endpoint

**Targets**:
- p50 (median): <100ms
- p95: <200ms
- p99: <500ms
- Max: <2000ms

**Monitoring Endpoints**:
```python
# Key endpoints to monitor
ENDPOINTS = {
    "GET /api/employees": {"p95": 100},
    "GET /api/employees/{id}": {"p95": 50},
    "POST /api/employees": {"p95": 150},
    "PUT /api/employees/{id}": {"p95": 150},
    "DELETE /api/employees/{id}": {"p95": 100},
    "POST /api/auth/login": {"p95": 200},
    "GET /api/auth/me": {"p95": 50}
}
```

**Tools**:
- **APM**: New Relic, DataDog, AppDynamics
- **Custom**: Prometheus + Grafana
- **Logging**: Response time in access logs

**Alerts**:
- p95 > target for 5 minutes → Warning
- p99 > 2x target for 5 minutes → Critical
- Any request > 5 seconds → Warning

### 3. Error Rates

**Metric**: HTTP 4xx and 5xx error rates

**Targets**:
- 4xx errors: <5% of requests
- 5xx errors: <0.1% of requests
- Overall error rate: <1%

**Error Categories**:
```python
ERROR_CATEGORIES = {
    "4xx": {
        "400": "Bad Request - input validation",
        "401": "Unauthorized - authentication",
        "403": "Forbidden - authorization",
        "404": "Not Found - resource missing",
        "429": "Too Many Requests - rate limit"
    },
    "5xx": {
        "500": "Internal Server Error",
        "502": "Bad Gateway",
        "503": "Service Unavailable",
        "504": "Gateway Timeout"
    }
}
```

**Monitoring**:
```bash
# Track error rates
# - Count by status code
# - Group by endpoint
# - Track over time (1m, 5m, 15m, 1h)

# Example log analysis
tail -f /var/log/employee-system/app.log | grep ERROR
```

**Tools**:
- **Error Tracking**: Sentry, Rollbar, Bugsnag
- **Log Analysis**: ELK Stack, Splunk, Datadog
- **Metrics**: Prometheus counters

**Alerts**:
- 5xx error rate > 1% for 2 minutes → Critical
- 5xx error rate > 0.1% for 10 minutes → Warning
- Sudden spike in 4xx errors (>10x baseline) → Warning
- New error type detected → Info

### 4. Database Query Performance

**Metrics**: Query execution time, connection pool usage

**Targets**:
- Query time p95: <100ms
- Query time p99: <200ms
- Slow queries (>1s): 0
- Connection pool utilization: <80%

**Monitoring**:
```sql
-- Enable slow query logging (PostgreSQL)
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1 second
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check connection pool
SELECT count(*) as active_connections,
       max_conn as max_connections
FROM pg_stat_activity,
     (SELECT setting::int as max_conn FROM pg_settings WHERE name='max_connections') mc
GROUP BY max_conn;
```

**Tools**:
- **Database Monitoring**: pgAdmin, DataDog, New Relic
- **Query Analysis**: pg_stat_statements
- **Connection Pooling**: SQLAlchemy metrics

**Alerts**:
- Slow query (>1s) detected → Warning
- Connection pool >90% → Critical
- Long-running transactions (>30s) → Warning
- Deadlock detected → Critical

### 5. Rate Limit Violations

**Metric**: Number of 429 responses per user/IP

**Targets**:
- Overall 429 rate: <1% of requests
- Per-user violations: <5 per hour
- Suspicious patterns: 0

**Monitoring**:
```python
# Track rate limit hits
RATE_LIMIT_METRICS = {
    "total_violations": 0,
    "violations_by_user": {},
    "violations_by_ip": {},
    "violations_by_endpoint": {}
}

# Example query
SELECT user_id, COUNT(*) as violations
FROM rate_limit_violations
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id
ORDER BY violations DESC
LIMIT 10;
```

**Tools**:
- **Custom Metrics**: Application logs
- **Database**: rate_limit_violations table
- **Analytics**: Time-series analysis

**Alerts**:
- Single user >100 violations/hour → Warning (possible attack)
- Single IP >500 violations/hour → Critical (DDoS attempt)
- Sudden spike in 429s (>10x baseline) → Warning

### 6. Failed Login Attempts

**Metric**: Failed authentication attempts

**Targets**:
- Failed login rate: <10% of login attempts
- Brute force attempts: 0
- Account lockouts: <1 per hour

**Monitoring**:
```python
# Track failed logins
FAILED_LOGIN_METRICS = {
    "total_failures": 0,
    "failures_by_username": {},
    "failures_by_ip": {},
    "consecutive_failures": {}
}

# Example query
SELECT username, ip_address, COUNT(*) as attempts
FROM auth_logs
WHERE status = 'failed'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY username, ip_address
ORDER BY attempts DESC
LIMIT 10;
```

**Tools**:
- **Security Logs**: auth.log, application logs
- **SIEM**: Splunk, ELK, Datadog Security
- **Intrusion Detection**: fail2ban, custom rules

**Alerts**:
- 5+ failed logins for same username → Warning
- 10+ failed logins from same IP → Critical (possible brute force)
- Account lockout triggered → Info
- Successful login after multiple failures → Warning (potential compromise)

### 7. Authorization Failures

**Metric**: 403 Forbidden responses

**Targets**:
- Authorization failures: <0.5% of requests
- Privilege escalation attempts: 0

**Monitoring**:
```python
# Track authorization failures
AUTH_FAILURE_METRICS = {
    "total_403s": 0,
    "by_user": {},
    "by_endpoint": {},
    "suspicious_patterns": []
}

# Example log pattern
LOG_PATTERN = "{timestamp} | 403 | user={user_id} | endpoint={endpoint} | reason={reason}"
```

**Tools**:
- **Access Logs**: Application logs
- **Security Analytics**: Custom rules
- **SIEM**: Security Information and Event Management

**Alerts**:
- User attempts admin endpoint without permission → Warning
- Multiple 403s from same user (>10/hour) → Warning
- Unusual endpoint access pattern → Info

### 8. Database Connection Pool Usage

**Metric**: Active connections vs available connections

**Targets**:
- Pool utilization: <80%
- Connection wait time: <10ms
- Connection timeouts: 0

**Monitoring**:
```python
# SQLAlchemy pool metrics
from sqlalchemy import event
from sqlalchemy.pool import Pool

@event.listens_for(Pool, "connect")
def receive_connect(dbapi_conn, connection_record):
    metrics.increment("db.connections.created")

@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    metrics.gauge("db.connections.active", pool.size())

# Check pool status
print(f"Pool size: {engine.pool.size()}")
print(f"Checked out: {engine.pool.checkedout()}")
print(f"Overflow: {engine.pool.overflow()}")
```

**Tools**:
- **Database Monitoring**: pgAdmin, pgHero
- **APM**: New Relic, DataDog
- **Custom**: SQLAlchemy event listeners

**Alerts**:
- Pool utilization >90% → Critical
- Connection timeout occurred → Critical
- Pool overflow >50% → Warning

### 9. Memory Usage

**Metric**: Application memory consumption

**Targets**:
- Memory usage: <2GB
- Memory growth rate: <10MB/hour
- Memory leaks: 0

**Monitoring**:
```bash
# Check memory usage
ps aux | grep python | awk '{print $6, $11}'

# Or using systemd
systemctl status employee-backend | grep Memory

# Or using Docker
docker stats employee-backend

# Track over time
while true; do
  ps -o rss= -p $(pgrep -f "uvicorn main:app")
  sleep 60
done >> memory.log
```

**Tools**:
- **System Monitoring**: top, htop, glances
- **Container Monitoring**: Docker stats, cAdvisor
- **APM**: Memory profiling tools

**Alerts**:
- Memory usage >80% → Warning
- Memory usage >90% → Critical
- Continuous memory growth detected → Warning
- OOM (Out of Memory) killer triggered → Critical

### 10. CPU Usage

**Metric**: CPU utilization percentage

**Targets**:
- CPU usage p95: <70%
- CPU usage p99: <85%
- CPU spikes: <3 per hour

**Monitoring**:
```bash
# Check CPU usage
top -b -n 1 | grep python

# Or using systemd
systemctl status employee-backend | grep CPU

# Or using Docker
docker stats employee-backend --no-stream
```

**Tools**:
- **System Monitoring**: top, htop, sar
- **Container Monitoring**: Docker stats
- **APM**: CPU profiling

**Alerts**:
- CPU usage >80% for 5 minutes → Warning
- CPU usage >95% for 2 minutes → Critical
- High CPU with low throughput → Warning (inefficiency)

## Logging Strategy

### Log Levels

```python
LOG_LEVELS = {
    "DEBUG": "Detailed information for debugging (dev only)",
    "INFO": "General informational messages",
    "WARNING": "Warning messages (potential issues)",
    "ERROR": "Error messages (handled exceptions)",
    "CRITICAL": "Critical errors (system failure)"
}
```

**Production Log Level**: INFO

### What to Log

#### INFO Level
```python
# Application startup
logger.info("Application starting", extra={
    "version": "1.0.0",
    "environment": "production"
})

# Successful operations
logger.info("Employee created", extra={
    "employee_id": employee.id,
    "user_id": current_user.id
})

# Authentication events
logger.info("User logged in", extra={
    "user_id": user.id,
    "username": user.username,
    "ip_address": request.client.host
})
```

#### WARNING Level
```python
# Rate limit approaching
logger.warning("Rate limit 80% for user", extra={
    "user_id": user.id,
    "requests": 80,
    "limit": 100
})

# Slow query detected
logger.warning("Slow query detected", extra={
    "query": "SELECT * FROM employees",
    "duration_ms": 1500
})

# Authorization failure
logger.warning("Unauthorized access attempt", extra={
    "user_id": user.id,
    "endpoint": "/api/admin/users",
    "required_role": "admin",
    "user_role": "employee"
})
```

#### ERROR Level
```python
# Database errors
logger.error("Database query failed", extra={
    "query": query,
    "error": str(e),
    "user_id": user.id
}, exc_info=True)

# External API failures
logger.error("Email service failed", extra={
    "recipient": email,
    "error": str(e)
}, exc_info=True)

# Data validation errors
logger.error("Invalid data format", extra={
    "field": "extended_fields",
    "value": value,
    "error": "Invalid JSON"
})
```

#### CRITICAL Level
```python
# System failures
logger.critical("Database connection lost", extra={
    "error": str(e),
    "retry_count": retry_count
})

# Security incidents
logger.critical("Potential security breach", extra={
    "type": "sql_injection_attempt",
    "user_id": user.id,
    "ip_address": request.client.host,
    "payload": payload
})
```

### Log Format

**Structured Logging** (JSON):
```json
{
  "timestamp": "2024-11-24T12:00:00.123Z",
  "level": "INFO",
  "logger": "app.api.employees",
  "message": "Employee created",
  "user_id": 123,
  "employee_id": 456,
  "ip_address": "192.168.1.100",
  "request_id": "abc-123-def",
  "duration_ms": 45
}
```

**Benefits**:
- Easy to parse and search
- Consistent structure
- Machine-readable
- Supports log aggregation

### Log Rotation

```bash
# logrotate configuration
cat > /etc/logrotate.d/employee-system <<EOF
/var/log/employee-system/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload employee-backend
    endscript
}
EOF
```

**Retention**:
- Application logs: 30 days
- Error logs: 90 days
- Audit logs: 1 year
- Security logs: 1 year

### Log Aggregation

**Recommended Tools**:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **Datadog Logs**
- **CloudWatch Logs** (AWS)

**Benefits**:
- Centralized log storage
- Advanced search capabilities
- Real-time analysis
- Dashboards and visualizations
- Alerting based on log patterns

## Monitoring Dashboards

### Dashboard 1: System Health Overview

**Metrics**:
- Application uptime (%)
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Active users

**Refresh**: Every 10 seconds

### Dashboard 2: Performance Metrics

**Metrics**:
- Response time by endpoint
- Database query time
- Memory usage
- CPU usage
- Network I/O

**Refresh**: Every 30 seconds

### Dashboard 3: Security Dashboard

**Metrics**:
- Failed login attempts
- Authorization failures (403s)
- Rate limit violations
- Unusual access patterns
- Security events

**Refresh**: Every 60 seconds

### Dashboard 4: Database Performance

**Metrics**:
- Query execution time
- Connection pool usage
- Slow queries
- Database size
- Index usage

**Refresh**: Every 60 seconds

### Dashboard 5: Business Metrics

**Metrics**:
- Active users
- Employee records created/updated
- Department distribution
- API usage by endpoint
- User activity patterns

**Refresh**: Every 5 minutes

## Alert Configuration

### Alert Severity Levels

**CRITICAL** (Immediate response required):
- Application down
- Database unreachable
- 5xx error rate >1%
- Memory >90%
- CPU >95%

**WARNING** (Investigate within 30 minutes):
- Response time >2x baseline
- Error rate elevated
- Resource usage high
- Slow queries detected

**INFO** (Review during business hours):
- Deployment completed
- New error type
- Configuration changed
- Unusual but non-critical patterns

### Alert Channels

**Critical Alerts**:
- PagerDuty / OpsGenie
- SMS
- Phone call
- Slack (urgent channel)

**Warning Alerts**:
- Email
- Slack (monitoring channel)

**Info Alerts**:
- Email digest (daily)
- Slack (info channel)

### Alert Escalation

```yaml
escalation_policy:
  level_1:
    - on_call_engineer
    - timeout: 5 minutes

  level_2:
    - engineering_manager
    - timeout: 15 minutes

  level_3:
    - cto
    - timeout: 30 minutes
```

## Performance Baseline

**Established Baselines** (from benchmarking):
- Employee list: 45ms p50, 85ms p95
- Employee search: 62ms p50, 120ms p95
- Employee create: 28ms p50, 45ms p95
- Employee update: 32ms p50, 50ms p95
- Database queries: 2-3 per request (with eager loading)

**Use baselines for**:
- Anomaly detection (>2x baseline)
- Performance regression alerts
- Capacity planning
- SLA compliance

## Monitoring Tools Recommendation

### Open Source Stack
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Logs**: ELK Stack
- **Tracing**: Jaeger
- **Alerting**: Alertmanager

### Commercial Solutions
- **APM**: New Relic, DataDog, AppDynamics
- **Logs**: Splunk, Datadog Logs
- **Uptime**: Pingdom, UptimeRobot
- **Error Tracking**: Sentry, Rollbar

## Runbook: Common Issues

### Issue: High Response Times

**Symptoms**: p95 >200ms
**Investigation**:
1. Check database query performance
2. Check CPU/Memory usage
3. Review slow query logs
4. Check for N+1 queries

**Resolution**:
- Add database indexes
- Optimize queries
- Increase resources
- Enable query caching

### Issue: High Error Rate

**Symptoms**: 5xx errors >0.1%
**Investigation**:
1. Check error logs for stack traces
2. Check database connectivity
3. Check external service availability
4. Review recent deployments

**Resolution**:
- Fix application bug
- Restart service
- Scale resources
- Rollback deployment

### Issue: Database Connection Pool Exhausted

**Symptoms**: Connection timeout errors
**Investigation**:
1. Check active connections
2. Check for long-running queries
3. Check pool configuration

**Resolution**:
- Increase pool size
- Kill long-running queries
- Optimize query performance
- Add connection timeout

## Conclusion

Effective monitoring is essential for production reliability. This guide provides a comprehensive strategy for monitoring all critical aspects of the Employee Management System.

**Key Principles**:
1. Monitor everything that matters
2. Alert only on actionable issues
3. Keep runbooks updated
4. Review and improve continuously
