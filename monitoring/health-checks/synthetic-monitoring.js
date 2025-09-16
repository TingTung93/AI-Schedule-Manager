/**
 * Synthetic Monitoring
 * Automated testing of critical user journeys and API endpoints
 */

const axios = require('axios');
const puppeteer = require('puppeteer');
const { performance } = require('perf_hooks');

class SyntheticMonitoring {
  constructor() {
    this.baseURL = process.env.APP_BASE_URL || 'https://ai-schedule-manager.com';
    this.apiBaseURL = process.env.API_BASE_URL || 'https://api.ai-schedule-manager.com';
    this.monitoringIntervals = new Map();
    this.results = new Map();
  }

  // Start all synthetic monitors
  startMonitoring() {
    console.log('Starting synthetic monitoring...');

    // API endpoint monitoring (every 2 minutes)
    this.scheduleMonitor('api-health', this.monitorAPIHealth.bind(this), 2 * 60 * 1000);
    this.scheduleMonitor('api-auth', this.monitorAPIAuth.bind(this), 5 * 60 * 1000);
    this.scheduleMonitor('api-schedule-crud', this.monitorScheduleCRUD.bind(this), 10 * 60 * 1000);

    // Web UI monitoring (every 5 minutes)
    this.scheduleMonitor('ui-homepage', this.monitorHomepage.bind(this), 5 * 60 * 1000);
    this.scheduleMonitor('ui-login', this.monitorLogin.bind(this), 10 * 60 * 1000);
    this.scheduleMonitor('ui-schedule-creation', this.monitorScheduleCreation.bind(this), 15 * 60 * 1000);

    // Performance monitoring (every 10 minutes)
    this.scheduleMonitor('performance-load-time', this.monitorLoadTime.bind(this), 10 * 60 * 1000);
    this.scheduleMonitor('performance-api-response', this.monitorAPIPerformance.bind(this), 10 * 60 * 1000);
  }

  // Stop all monitoring
  stopMonitoring() {
    console.log('Stopping synthetic monitoring...');

    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval);
      console.log(`Stopped monitor: ${name}`);
    }

    this.monitoringIntervals.clear();
  }

  scheduleMonitor(name, monitorFunction, intervalMs) {
    // Run immediately
    this.runMonitor(name, monitorFunction);

    // Schedule recurring runs
    const interval = setInterval(() => {
      this.runMonitor(name, monitorFunction);
    }, intervalMs);

    this.monitoringIntervals.set(name, interval);
    console.log(`Scheduled monitor: ${name} (interval: ${intervalMs}ms)`);
  }

  async runMonitor(name, monitorFunction) {
    const startTime = performance.now();

    try {
      const result = await monitorFunction();
      const duration = performance.now() - startTime;

      const monitorResult = {
        name,
        status: 'success',
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
        ...result
      };

      this.results.set(name, monitorResult);
      this.handleMonitorResult(monitorResult);

    } catch (error) {
      const duration = performance.now() - startTime;

      const monitorResult = {
        name,
        status: 'failure',
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      };

      this.results.set(name, monitorResult);
      this.handleMonitorFailure(monitorResult);
    }
  }

  // API Monitoring Functions
  async monitorAPIHealth() {
    const response = await axios.get(`${this.apiBaseURL}/health`, {
      timeout: 10000
    });

    if (response.status !== 200) {
      throw new Error(`API health check failed with status ${response.status}`);
    }

    return {
      statusCode: response.status,
      responseTime: response.headers['x-response-time'] || 'unknown',
      uptime: response.data.uptime
    };
  }

  async monitorAPIAuth() {
    // Test authentication flow
    const loginResponse = await axios.post(`${this.apiBaseURL}/auth/login`, {
      email: process.env.SYNTHETIC_TEST_EMAIL,
      password: process.env.SYNTHETIC_TEST_PASSWORD
    }, {
      timeout: 15000
    });

    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      throw new Error('Authentication failed');
    }

    // Test authenticated request
    const profileResponse = await axios.get(`${this.apiBaseURL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      },
      timeout: 10000
    });

    if (profileResponse.status !== 200) {
      throw new Error('Authenticated request failed');
    }

    return {
      authResponseTime: loginResponse.headers['x-response-time'],
      profileResponseTime: profileResponse.headers['x-response-time'],
      userId: profileResponse.data.id
    };
  }

  async monitorScheduleCRUD() {
    // Get auth token
    const authResponse = await axios.post(`${this.apiBaseURL}/auth/login`, {
      email: process.env.SYNTHETIC_TEST_EMAIL,
      password: process.env.SYNTHETIC_TEST_PASSWORD
    });

    const token = authResponse.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    // Create schedule
    const createResponse = await axios.post(`${this.apiBaseURL}/schedules`, {
      title: `Synthetic Test Schedule ${Date.now()}`,
      description: 'Automated test schedule',
      tasks: [
        {
          title: 'Test Task',
          duration: 60,
          priority: 'medium'
        }
      ]
    }, { headers, timeout: 15000 });

    if (createResponse.status !== 201) {
      throw new Error('Schedule creation failed');
    }

    const scheduleId = createResponse.data.id;

    // Read schedule
    const readResponse = await axios.get(`${this.apiBaseURL}/schedules/${scheduleId}`, {
      headers,
      timeout: 10000
    });

    if (readResponse.status !== 200) {
      throw new Error('Schedule read failed');
    }

    // Update schedule
    const updateResponse = await axios.put(`${this.apiBaseURL}/schedules/${scheduleId}`, {
      title: 'Updated Synthetic Test Schedule'
    }, { headers, timeout: 15000 });

    if (updateResponse.status !== 200) {
      throw new Error('Schedule update failed');
    }

    // Delete schedule
    const deleteResponse = await axios.delete(`${this.apiBaseURL}/schedules/${scheduleId}`, {
      headers,
      timeout: 10000
    });

    if (deleteResponse.status !== 204) {
      throw new Error('Schedule deletion failed');
    }

    return {
      createTime: createResponse.headers['x-response-time'],
      readTime: readResponse.headers['x-response-time'],
      updateTime: updateResponse.headers['x-response-time'],
      deleteTime: deleteResponse.headers['x-response-time'],
      scheduleId
    };
  }

  // Web UI Monitoring Functions
  async monitorHomepage() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('SyntheticMonitor/1.0');

      const startTime = performance.now();

      // Navigate to homepage
      const response = await page.goto(this.baseURL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const loadTime = performance.now() - startTime;

      if (!response.ok()) {
        throw new Error(`Homepage returned status ${response.status()}`);
      }

      // Check for critical elements
      const title = await page.title();
      const hasHeader = await page.$('header') !== null;
      const hasNavigation = await page.$('nav') !== null;
      const hasMainContent = await page.$('main') !== null;

      // Check for errors in console
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      return {
        statusCode: response.status(),
        loadTime: Math.round(loadTime),
        title,
        elementsPresent: {
          header: hasHeader,
          navigation: hasNavigation,
          mainContent: hasMainContent
        },
        consoleErrors: consoleErrors.length
      };

    } finally {
      await browser.close();
    }
  }

  async monitorLogin() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to login page
      await page.goto(`${this.baseURL}/login`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Fill login form
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.type('#email', process.env.SYNTHETIC_TEST_EMAIL);
      await page.type('#password', process.env.SYNTHETIC_TEST_PASSWORD);

      const startTime = performance.now();

      // Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('button[type="submit"]')
      ]);

      const loginTime = performance.now() - startTime;

      // Check if redirected to dashboard
      const currentUrl = page.url();
      const isDashboard = currentUrl.includes('/dashboard') || currentUrl.includes('/app');

      if (!isDashboard) {
        throw new Error('Login did not redirect to dashboard');
      }

      // Check for user-specific elements
      const hasUserMenu = await page.$('[data-testid="user-menu"]') !== null;
      const hasLogoutButton = await page.$('button:contains("Logout")') !== null;

      return {
        loginTime: Math.round(loginTime),
        redirectedCorrectly: isDashboard,
        userInterfaceLoaded: {
          userMenu: hasUserMenu,
          logoutButton: hasLogoutButton
        }
      };

    } finally {
      await browser.close();
    }
  }

  async monitorScheduleCreation() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Login first
      await page.goto(`${this.baseURL}/login`);
      await page.waitForSelector('#email');
      await page.type('#email', process.env.SYNTHETIC_TEST_EMAIL);
      await page.type('#password', process.env.SYNTHETIC_TEST_PASSWORD);
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);

      // Navigate to schedule creation
      await page.goto(`${this.baseURL}/schedules/new`);
      await page.waitForSelector('[data-testid="schedule-form"]', { timeout: 15000 });

      const startTime = performance.now();

      // Fill schedule form
      await page.type('#schedule-title', `Synthetic Test Schedule ${Date.now()}`);
      await page.type('#schedule-description', 'Automated test schedule creation');

      // Add a task
      await page.click('[data-testid="add-task-button"]');
      await page.waitForSelector('[data-testid="task-form"]');
      await page.type('#task-title', 'Test Task');
      await page.select('#task-priority', 'medium');

      // Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('[data-testid="create-schedule-button"]')
      ]);

      const creationTime = performance.now() - startTime;

      // Verify schedule was created
      const currentUrl = page.url();
      const isScheduleView = currentUrl.includes('/schedules/') && !currentUrl.includes('/new');

      if (!isScheduleView) {
        throw new Error('Schedule creation did not redirect to schedule view');
      }

      // Check for success indicators
      const hasSuccessMessage = await page.$('.success-message') !== null;
      const hasScheduleContent = await page.$('[data-testid="schedule-content"]') !== null;

      return {
        creationTime: Math.round(creationTime),
        redirectedCorrectly: isScheduleView,
        successIndicators: {
          successMessage: hasSuccessMessage,
          scheduleContent: hasScheduleContent
        }
      };

    } finally {
      await browser.close();
    }
  }

  // Performance Monitoring Functions
  async monitorLoadTime() {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Enable performance monitoring
      await page.setCacheEnabled(false);

      const metrics = await page.metrics();
      const startTime = performance.now();

      const response = await page.goto(this.baseURL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const endTime = performance.now();
      const finalMetrics = await page.metrics();

      // Calculate performance metrics
      const loadTime = endTime - startTime;
      const domContentLoaded = await page.evaluate(() => {
        return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
      });

      const firstContentfulPaint = await page.evaluate(() => {
        return performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
      });

      return {
        totalLoadTime: Math.round(loadTime),
        domContentLoaded: Math.round(domContentLoaded),
        firstContentfulPaint: Math.round(firstContentfulPaint),
        jsHeapUsedSize: finalMetrics.JSHeapUsedSize,
        jsHeapTotalSize: finalMetrics.JSHeapTotalSize,
        nodes: finalMetrics.Nodes,
        documents: finalMetrics.Documents
      };

    } finally {
      await browser.close();
    }
  }

  async monitorAPIPerformance() {
    const endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/user/profile', method: 'GET', requiresAuth: true },
      { path: '/schedules', method: 'GET', requiresAuth: true },
      { path: '/tasks', method: 'GET', requiresAuth: true }
    ];

    const results = {};
    let token = null;

    // Get auth token if needed
    if (endpoints.some(e => e.requiresAuth)) {
      const authResponse = await axios.post(`${this.apiBaseURL}/auth/login`, {
        email: process.env.SYNTHETIC_TEST_EMAIL,
        password: process.env.SYNTHETIC_TEST_PASSWORD
      });
      token = authResponse.data.token;
    }

    for (const endpoint of endpoints) {
      const startTime = performance.now();

      try {
        const config = {
          timeout: 10000,
          headers: endpoint.requiresAuth ? { 'Authorization': `Bearer ${token}` } : {}
        };

        const response = await axios.request({
          method: endpoint.method,
          url: `${this.apiBaseURL}${endpoint.path}`,
          ...config
        });

        const responseTime = performance.now() - startTime;

        results[endpoint.path] = {
          status: 'success',
          responseTime: Math.round(responseTime),
          statusCode: response.status,
          contentLength: response.headers['content-length'] || 0
        };

      } catch (error) {
        const responseTime = performance.now() - startTime;

        results[endpoint.path] = {
          status: 'failure',
          responseTime: Math.round(responseTime),
          error: error.message
        };
      }
    }

    return { endpoints: results };
  }

  // Result handling
  handleMonitorResult(result) {
    console.log(`✅ Monitor ${result.name} succeeded in ${result.duration}ms`);

    // Send to metrics collection
    this.recordMetrics(result);
  }

  handleMonitorFailure(result) {
    console.error(`❌ Monitor ${result.name} failed in ${result.duration}ms: ${result.error}`);

    // Send alert
    this.sendAlert(result);

    // Record failure metrics
    this.recordMetrics(result);
  }

  recordMetrics(result) {
    // Record to Prometheus metrics (if available)
    try {
      const { MetricsCollector } = require('../metrics/prometheus-config');

      if (result.status === 'success') {
        MetricsCollector.recordBusinessMetric(`synthetic_check_success`, 1, {
          monitor: result.name
        });

        MetricsCollector.recordBusinessMetric(`synthetic_check_duration`, result.duration, {
          monitor: result.name
        });
      } else {
        MetricsCollector.recordError('synthetic_check_failure', 'monitoring', 'error');
      }
    } catch (error) {
      console.warn('Could not record synthetic monitoring metrics:', error.message);
    }
  }

  sendAlert(result) {
    // Send to alerting system
    try {
      const { PagerDutyAlerting } = require('../alerting/pagerduty-config');

      PagerDutyAlerting.triggerAlert(
        'synthetic_check_failure',
        'error',
        `Synthetic check ${result.name} failed`,
        {
          monitor: result.name,
          duration: result.duration,
          error: result.error,
          timestamp: result.timestamp
        }
      );
    } catch (error) {
      console.warn('Could not send synthetic monitoring alert:', error.message);
    }
  }

  // Get current status of all monitors
  getStatus() {
    const status = {};

    for (const [name, result] of this.results) {
      status[name] = {
        ...result,
        isActive: this.monitoringIntervals.has(name)
      };
    }

    return {
      timestamp: new Date().toISOString(),
      totalMonitors: this.monitoringIntervals.size,
      monitors: status
    };
  }
}

module.exports = new SyntheticMonitoring();