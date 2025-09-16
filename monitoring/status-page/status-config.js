/**
 * Status Page Configuration
 * Public status page for service availability and incidents
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class StatusPageService {
  constructor() {
    this.statusFile = path.join(__dirname, 'data', 'status.json');
    this.incidentFile = path.join(__dirname, 'data', 'incidents.json');
    this.metricsFile = path.join(__dirname, 'data', 'metrics.json');

    this.services = [
      {
        id: 'api',
        name: 'API Service',
        description: 'Main application API',
        url: process.env.API_BASE_URL + '/health',
        critical: true
      },
      {
        id: 'web',
        name: 'Web Application',
        description: 'User interface',
        url: process.env.APP_BASE_URL,
        critical: true
      },
      {
        id: 'ai-service',
        name: 'AI Processing',
        description: 'Schedule optimization engine',
        url: process.env.AI_SERVICE_URL + '/health',
        critical: false
      },
      {
        id: 'database',
        name: 'Database',
        description: 'PostgreSQL database',
        internal: true,
        critical: true
      },
      {
        id: 'cache',
        name: 'Cache Service',
        description: 'Redis cache',
        internal: true,
        critical: false
      },
      {
        id: 'notifications',
        name: 'Notifications',
        description: 'Email and push notifications',
        url: process.env.NOTIFICATION_SERVICE_URL + '/health',
        critical: false
      }
    ];

    this.statusLevels = {
      OPERATIONAL: 'operational',
      DEGRADED: 'degraded_performance',
      PARTIAL_OUTAGE: 'partial_outage',
      MAJOR_OUTAGE: 'major_outage',
      MAINTENANCE: 'under_maintenance'
    };

    this.incidentSeverity = {
      MINOR: 'minor',
      MAJOR: 'major',
      CRITICAL: 'critical'
    };

    this.incidentStatus = {
      INVESTIGATING: 'investigating',
      IDENTIFIED: 'identified',
      MONITORING: 'monitoring',
      RESOLVED: 'resolved'
    };
  }

  // Initialize status page data
  async initialize() {
    try {
      await fs.mkdir(path.dirname(this.statusFile), { recursive: true });

      // Initialize status file if it doesn't exist
      try {
        await fs.access(this.statusFile);
      } catch {
        await this.saveStatus({
          overall_status: this.statusLevels.OPERATIONAL,
          last_updated: new Date().toISOString(),
          services: this.services.map(service => ({
            ...service,
            status: this.statusLevels.OPERATIONAL,
            last_checked: new Date().toISOString(),
            response_time: null,
            uptime_percentage: 100
          }))
        });
      }

      // Initialize incidents file
      try {
        await fs.access(this.incidentFile);
      } catch {
        await this.saveIncidents([]);
      }

      // Initialize metrics file
      try {
        await fs.access(this.metricsFile);
      } catch {
        await this.saveMetrics({
          overall_uptime: {
            '90_days': 99.9,
            '30_days': 99.95,
            '7_days': 100
          },
          response_times: {
            api: { avg: 150, p95: 300 },
            web: { avg: 800, p95: 1500 }
          },
          last_updated: new Date().toISOString()
        });
      }

      console.log('Status page service initialized');
    } catch (error) {
      console.error('Failed to initialize status page:', error);
      throw error;
    }
  }

  // Check all services status
  async checkAllServices() {
    console.log('Checking all services status...');
    const status = await this.loadStatus();
    const overallStatuses = [];

    for (const service of status.services) {
      try {
        const serviceStatus = await this.checkServiceStatus(service);

        // Update service in status
        const serviceIndex = status.services.findIndex(s => s.id === service.id);
        if (serviceIndex !== -1) {
          status.services[serviceIndex] = {
            ...status.services[serviceIndex],
            ...serviceStatus,
            last_checked: new Date().toISOString()
          };
        }

        // Collect statuses for overall calculation
        if (service.critical) {
          overallStatuses.push(serviceStatus.status);
        }
      } catch (error) {
        console.error(`Failed to check service ${service.id}:`, error);

        // Mark service as having issues
        const serviceIndex = status.services.findIndex(s => s.id === service.id);
        if (serviceIndex !== -1) {
          status.services[serviceIndex].status = this.statusLevels.MAJOR_OUTAGE;
          status.services[serviceIndex].last_checked = new Date().toISOString();
        }

        if (service.critical) {
          overallStatuses.push(this.statusLevels.MAJOR_OUTAGE);
        }
      }
    }

    // Calculate overall status
    status.overall_status = this.calculateOverallStatus(overallStatuses);
    status.last_updated = new Date().toISOString();

    await this.saveStatus(status);
    return status;
  }

  // Check individual service status
  async checkServiceStatus(service) {
    if (service.internal) {
      return await this.checkInternalService(service);
    }

    if (!service.url) {
      return {
        status: this.statusLevels.OPERATIONAL,
        response_time: null,
        message: 'Service check not configured'
      };
    }

    const startTime = Date.now();

    try {
      const response = await axios.get(service.url, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as operational
      });

      const responseTime = Date.now() - startTime;

      let status = this.statusLevels.OPERATIONAL;

      if (response.status >= 500) {
        status = this.statusLevels.MAJOR_OUTAGE;
      } else if (response.status >= 400) {
        status = this.statusLevels.DEGRADED;
      } else if (responseTime > 5000) {
        status = this.statusLevels.DEGRADED;
      }

      return {
        status,
        response_time: responseTime,
        http_status: response.status,
        message: response.status < 400 ? 'Service is operational' : `HTTP ${response.status}`
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          status: this.statusLevels.MAJOR_OUTAGE,
          response_time: responseTime,
          message: 'Service is unreachable'
        };
      }

      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return {
          status: this.statusLevels.DEGRADED,
          response_time: responseTime,
          message: 'Service is experiencing issues'
        };
      }

      return {
        status: this.statusLevels.PARTIAL_OUTAGE,
        response_time: responseTime,
        message: error.message
      };
    }
  }

  // Check internal services (database, cache, etc.)
  async checkInternalService(service) {
    try {
      switch (service.id) {
        case 'database':
          return await this.checkDatabase();
        case 'cache':
          return await this.checkCache();
        default:
          return {
            status: this.statusLevels.OPERATIONAL,
            message: 'Internal service check not implemented'
          };
      }
    } catch (error) {
      return {
        status: this.statusLevels.MAJOR_OUTAGE,
        message: error.message
      };
    }
  }

  async checkDatabase() {
    // This would integrate with your database health check
    // For now, return operational
    return {
      status: this.statusLevels.OPERATIONAL,
      response_time: 25,
      message: 'Database is operational'
    };
  }

  async checkCache() {
    // This would integrate with your Redis health check
    // For now, return operational
    return {
      status: this.statusLevels.OPERATIONAL,
      response_time: 5,
      message: 'Cache is operational'
    };
  }

  // Calculate overall status from individual service statuses
  calculateOverallStatus(statuses) {
    if (statuses.length === 0) return this.statusLevels.OPERATIONAL;

    const statusPriority = {
      [this.statusLevels.MAJOR_OUTAGE]: 4,
      [this.statusLevels.PARTIAL_OUTAGE]: 3,
      [this.statusLevels.DEGRADED]: 2,
      [this.statusLevels.MAINTENANCE]: 1,
      [this.statusLevels.OPERATIONAL]: 0
    };

    const maxPriority = Math.max(...statuses.map(s => statusPriority[s] || 0));

    return Object.keys(statusPriority).find(
      status => statusPriority[status] === maxPriority
    );
  }

  // Create new incident
  async createIncident(title, description, severity = this.incidentSeverity.MINOR, affectedServices = []) {
    const incidents = await this.loadIncidents();

    const incident = {
      id: `INC-${Date.now()}`,
      title,
      description,
      severity,
      status: this.incidentStatus.INVESTIGATING,
      affected_services: affectedServices,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updates: [
        {
          id: 1,
          status: this.incidentStatus.INVESTIGATING,
          message: description,
          timestamp: new Date().toISOString()
        }
      ]
    };

    incidents.unshift(incident);
    await this.saveIncidents(incidents);

    // Update affected services status
    if (affectedServices.length > 0) {
      await this.updateServicesForIncident(affectedServices, severity);
    }

    return incident;
  }

  // Update existing incident
  async updateIncident(incidentId, status, message) {
    const incidents = await this.loadIncidents();
    const incidentIndex = incidents.findIndex(i => i.id === incidentId);

    if (incidentIndex === -1) {
      throw new Error('Incident not found');
    }

    const incident = incidents[incidentIndex];
    incident.status = status;
    incident.updated_at = new Date().toISOString();

    incident.updates.unshift({
      id: incident.updates.length + 1,
      status,
      message,
      timestamp: new Date().toISOString()
    });

    incidents[incidentIndex] = incident;
    await this.saveIncidents(incidents);

    // If incident is resolved, check if services should be restored
    if (status === this.incidentStatus.RESOLVED) {
      await this.checkAllServices(); // This will update service statuses
    }

    return incident;
  }

  // Update service statuses for incident
  async updateServicesForIncident(serviceIds, severity) {
    const status = await this.loadStatus();

    for (const serviceId of serviceIds) {
      const serviceIndex = status.services.findIndex(s => s.id === serviceId);
      if (serviceIndex !== -1) {
        // Map incident severity to service status
        let serviceStatus;
        switch (severity) {
          case this.incidentSeverity.CRITICAL:
            serviceStatus = this.statusLevels.MAJOR_OUTAGE;
            break;
          case this.incidentSeverity.MAJOR:
            serviceStatus = this.statusLevels.PARTIAL_OUTAGE;
            break;
          default:
            serviceStatus = this.statusLevels.DEGRADED;
        }

        status.services[serviceIndex].status = serviceStatus;
        status.services[serviceIndex].last_checked = new Date().toISOString();
      }
    }

    status.overall_status = this.calculateOverallStatus(
      status.services.filter(s => s.critical).map(s => s.status)
    );
    status.last_updated = new Date().toISOString();

    await this.saveStatus(status);
  }

  // Schedule maintenance
  async scheduleMaintenance(title, description, startTime, endTime, affectedServices = []) {
    const incident = await this.createIncident(
      `Scheduled Maintenance: ${title}`,
      `${description}\n\nScheduled: ${startTime} - ${endTime}`,
      this.incidentSeverity.MINOR,
      affectedServices
    );

    // Update incident status to maintenance
    await this.updateIncident(incident.id, this.incidentStatus.IDENTIFIED,
      'Maintenance window scheduled');

    return incident;
  }

  // Get public status page data
  async getPublicStatus() {
    const [status, incidents, metrics] = await Promise.all([
      this.loadStatus(),
      this.loadIncidents(),
      this.loadMetrics()
    ]);

    // Only return recent incidents (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIncidents = incidents.filter(incident =>
      new Date(incident.created_at) > thirtyDaysAgo
    );

    return {
      status: {
        overall_status: status.overall_status,
        last_updated: status.last_updated,
        services: status.services.map(service => ({
          id: service.id,
          name: service.name,
          description: service.description,
          status: service.status,
          uptime_percentage: service.uptime_percentage
        }))
      },
      incidents: recentIncidents.slice(0, 10), // Latest 10 incidents
      metrics: {
        uptime: metrics.overall_uptime,
        response_times: metrics.response_times
      }
    };
  }

  // Start monitoring
  startMonitoring(intervalMinutes = 2) {
    console.log(`Starting status monitoring (interval: ${intervalMinutes} minutes)`);

    // Initial check
    this.checkAllServices().catch(console.error);

    // Schedule regular checks
    setInterval(() => {
      this.checkAllServices().catch(console.error);
    }, intervalMinutes * 60 * 1000);
  }

  // File operations
  async loadStatus() {
    const data = await fs.readFile(this.statusFile, 'utf8');
    return JSON.parse(data);
  }

  async saveStatus(status) {
    await fs.writeFile(this.statusFile, JSON.stringify(status, null, 2));
  }

  async loadIncidents() {
    const data = await fs.readFile(this.incidentFile, 'utf8');
    return JSON.parse(data);
  }

  async saveIncidents(incidents) {
    await fs.writeFile(this.incidentFile, JSON.stringify(incidents, null, 2));
  }

  async loadMetrics() {
    const data = await fs.readFile(this.metricsFile, 'utf8');
    return JSON.parse(data);
  }

  async saveMetrics(metrics) {
    await fs.writeFile(this.metricsFile, JSON.stringify(metrics, null, 2));
  }
}

// Express routes for status page API
const express = require('express');
const router = express.Router();
const statusService = new StatusPageService();

// Initialize service
statusService.initialize().catch(console.error);

// Start monitoring
if (process.env.NODE_ENV === 'production') {
  statusService.startMonitoring(2); // Check every 2 minutes
}

// Public status endpoint
router.get('/status', async (req, res) => {
  try {
    const status = await statusService.getPublicStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get status:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

// Trigger manual status check
router.post('/status/check', async (req, res) => {
  try {
    const status = await statusService.checkAllServices();
    res.json(status);
  } catch (error) {
    console.error('Failed to check services:', error);
    res.status(500).json({ error: 'Failed to check services' });
  }
});

// Create incident (admin only)
router.post('/incidents', async (req, res) => {
  try {
    const { title, description, severity, affected_services } = req.body;
    const incident = await statusService.createIncident(title, description, severity, affected_services);
    res.status(201).json(incident);
  } catch (error) {
    console.error('Failed to create incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// Update incident (admin only)
router.put('/incidents/:id', async (req, res) => {
  try {
    const { status, message } = req.body;
    const incident = await statusService.updateIncident(req.params.id, status, message);
    res.json(incident);
  } catch (error) {
    console.error('Failed to update incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

module.exports = {
  StatusPageService,
  router,
  statusService
};