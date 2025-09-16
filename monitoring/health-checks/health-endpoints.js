/**
 * Health Check Endpoints
 * Comprehensive health monitoring for all system components
 */

const express = require('express');
const { promisify } = require('util');
const redis = require('redis');

class HealthCheckService {
  constructor() {
    this.router = express.Router();
    this.checks = new Map();
    this.setupRoutes();
    this.registerDefaultChecks();
  }

  setupRoutes() {
    // Basic health check
    this.router.get('/health', this.basicHealthCheck.bind(this));

    // Detailed health check
    this.router.get('/health/detailed', this.detailedHealthCheck.bind(this));

    // Readiness probe (Kubernetes)
    this.router.get('/health/ready', this.readinessCheck.bind(this));

    // Liveness probe (Kubernetes)
    this.router.get('/health/live', this.livenessCheck.bind(this));

    // Dependency health
    this.router.get('/health/dependencies', this.dependencyHealthCheck.bind(this));

    // Component-specific health
    this.router.get('/health/:component', this.componentHealthCheck.bind(this));
  }

  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      check: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      description: options.description || `Health check for ${name}`
    });
  }

  registerDefaultChecks() {
    // Database connectivity
    this.registerCheck('database', this.checkDatabase.bind(this), {
      timeout: 3000,
      critical: true,
      description: 'PostgreSQL database connectivity'
    });

    // Redis connectivity
    this.registerCheck('redis', this.checkRedis.bind(this), {
      timeout: 2000,
      critical: true,
      description: 'Redis cache connectivity'
    });

    // Memory usage
    this.registerCheck('memory', this.checkMemory.bind(this), {
      timeout: 1000,
      critical: false,
      description: 'System memory usage'
    });

    // Disk space
    this.registerCheck('disk', this.checkDisk.bind(this), {
      timeout: 1000,
      critical: false,
      description: 'Disk space availability'
    });

    // AI service connectivity
    this.registerCheck('ai-service', this.checkAIService.bind(this), {
      timeout: 10000,
      critical: false,
      description: 'AI service connectivity'
    });

    // External API dependencies
    this.registerCheck('external-apis', this.checkExternalAPIs.bind(this), {
      timeout: 5000,
      critical: false,
      description: 'External API dependencies'
    });
  }

  async basicHealthCheck(req, res) {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    res.json({
      status: 'ok',
      timestamp,
      uptime: `${Math.floor(uptime)}s`,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }

  async detailedHealthCheck(req, res) {
    const timestamp = new Date().toISOString();
    const results = {};
    let overallStatus = 'ok';
    const issues = [];

    // Run all health checks
    for (const [name, checkConfig] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          checkConfig.check(),
          this.timeout(checkConfig.timeout)
        ]);

        const duration = Date.now() - startTime;

        results[name] = {
          status: result.status || 'ok',
          message: result.message || 'Check passed',
          duration: `${duration}ms`,
          timestamp,
          critical: checkConfig.critical,
          ...result.details
        };

        if (result.status === 'error' && checkConfig.critical) {
          overallStatus = 'error';
          issues.push(`Critical check failed: ${name} - ${result.message}`);
        } else if (result.status === 'warning' && overallStatus === 'ok') {
          overallStatus = 'warning';
          issues.push(`Warning in check: ${name} - ${result.message}`);
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          message: error.message,
          timestamp,
          critical: checkConfig.critical
        };

        if (checkConfig.critical) {
          overallStatus = 'error';
          issues.push(`Critical check failed: ${name} - ${error.message}`);
        }
      }
    }

    const response = {
      status: overallStatus,
      timestamp,
      uptime: `${Math.floor(process.uptime())}s`,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: results,
      issues: issues.length > 0 ? issues : undefined
    };

    const statusCode = overallStatus === 'error' ? 503 : 200;
    res.status(statusCode).json(response);
  }

  async readinessCheck(req, res) {
    // Check if the application is ready to serve traffic
    const criticalChecks = ['database', 'redis'];

    for (const checkName of criticalChecks) {
      const checkConfig = this.checks.get(checkName);
      if (!checkConfig) continue;

      try {
        const result = await Promise.race([
          checkConfig.check(),
          this.timeout(checkConfig.timeout)
        ]);

        if (result.status === 'error') {
          return res.status(503).json({
            status: 'not ready',
            reason: `Critical dependency ${checkName} is not available`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        return res.status(503).json({
          status: 'not ready',
          reason: `Critical dependency ${checkName} check failed: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  }

  async livenessCheck(req, res) {
    // Simple check to verify the application is alive
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Check if memory usage is excessive (> 1GB)
    if (memoryUsage.heapUsed > 1024 * 1024 * 1024) {
      return res.status(503).json({
        status: 'unhealthy',
        reason: 'Excessive memory usage',
        memoryUsage: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'alive',
      uptime: `${Math.floor(uptime)}s`,
      memoryUsage: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      },
      timestamp: new Date().toISOString()
    });
  }

  async dependencyHealthCheck(req, res) {
    const dependencies = ['database', 'redis', 'ai-service', 'external-apis'];
    const results = {};

    for (const dep of dependencies) {
      const checkConfig = this.checks.get(dep);
      if (!checkConfig) {
        results[dep] = { status: 'unknown', message: 'Check not configured' };
        continue;
      }

      try {
        const result = await Promise.race([
          checkConfig.check(),
          this.timeout(checkConfig.timeout)
        ]);
        results[dep] = result;
      } catch (error) {
        results[dep] = { status: 'error', message: error.message };
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      dependencies: results
    });
  }

  async componentHealthCheck(req, res) {
    const component = req.params.component;
    const checkConfig = this.checks.get(component);

    if (!checkConfig) {
      return res.status(404).json({
        status: 'error',
        message: `Health check for component '${component}' not found`,
        timestamp: new Date().toISOString()
      });
    }

    try {
      const result = await Promise.race([
        checkConfig.check(),
        this.timeout(checkConfig.timeout)
      ]);

      res.json({
        component,
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        component,
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Individual health check implementations
  async checkDatabase() {
    try {
      // Assuming you have a database connection pool
      const db = require('../../src/database/connection'); // Adjust path as needed
      const result = await db.query('SELECT 1 as health_check');

      return {
        status: 'ok',
        message: 'Database connection successful',
        details: {
          responseTime: 'within threshold',
          connectionCount: db.pool?.totalCount || 'unknown'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Database check failed: ${error.message}`
      };
    }
  }

  async checkRedis() {
    try {
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await client.connect();
      await client.ping();
      await client.disconnect();

      return {
        status: 'ok',
        message: 'Redis connection successful'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Redis check failed: ${error.message}`
      };
    }
  }

  async checkMemory() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercent = (usedMemory / totalMemory) * 100;

    if (memoryPercent > 90) {
      return {
        status: 'error',
        message: 'Memory usage is critically high',
        details: {
          usagePercent: `${memoryPercent.toFixed(2)}%`,
          heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`
        }
      };
    } else if (memoryPercent > 75) {
      return {
        status: 'warning',
        message: 'Memory usage is high',
        details: {
          usagePercent: `${memoryPercent.toFixed(2)}%`,
          heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`
        }
      };
    }

    return {
      status: 'ok',
      message: 'Memory usage is normal',
      details: {
        usagePercent: `${memoryPercent.toFixed(2)}%`,
        heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`
      }
    };
  }

  async checkDisk() {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const stats = await fs.statfs(path.resolve('./'));
      const total = stats.bavail * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const usagePercent = (used / total) * 100;

      if (usagePercent > 90) {
        return {
          status: 'error',
          message: 'Disk usage is critically high',
          details: {
            usagePercent: `${usagePercent.toFixed(2)}%`,
            freeSpace: `${Math.round(free / 1024 / 1024 / 1024)}GB`
          }
        };
      } else if (usagePercent > 80) {
        return {
          status: 'warning',
          message: 'Disk usage is high',
          details: {
            usagePercent: `${usagePercent.toFixed(2)}%`,
            freeSpace: `${Math.round(free / 1024 / 1024 / 1024)}GB`
          }
        };
      }

      return {
        status: 'ok',
        message: 'Disk usage is normal',
        details: {
          usagePercent: `${usagePercent.toFixed(2)}%`,
          freeSpace: `${Math.round(free / 1024 / 1024 / 1024)}GB`
        }
      };
    } catch (error) {
      return {
        status: 'warning',
        message: `Could not check disk usage: ${error.message}`
      };
    }
  }

  async checkAIService() {
    try {
      // Mock AI service check - replace with actual implementation
      const axios = require('axios');
      const response = await axios.get(process.env.AI_SERVICE_URL + '/health', {
        timeout: 5000
      });

      return {
        status: 'ok',
        message: 'AI service is responsive',
        details: {
          responseTime: response.headers['x-response-time'] || 'unknown',
          version: response.data.version || 'unknown'
        }
      };
    } catch (error) {
      return {
        status: 'warning',
        message: `AI service check failed: ${error.message}`
      };
    }
  }

  async checkExternalAPIs() {
    const apis = [
      { name: 'calendar-api', url: process.env.CALENDAR_API_URL },
      { name: 'notification-api', url: process.env.NOTIFICATION_API_URL }
    ];

    const results = {};
    let overallStatus = 'ok';

    for (const api of apis) {
      if (!api.url) {
        results[api.name] = { status: 'unknown', message: 'URL not configured' };
        continue;
      }

      try {
        const axios = require('axios');
        await axios.get(api.url + '/health', { timeout: 3000 });
        results[api.name] = { status: 'ok', message: 'API is responsive' };
      } catch (error) {
        results[api.name] = { status: 'error', message: error.message };
        overallStatus = 'warning';
      }
    }

    return {
      status: overallStatus,
      message: `External API check completed`,
      details: results
    };
  }

  timeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = new HealthCheckService();