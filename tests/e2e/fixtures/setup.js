/**
 * E2E Test Setup and Teardown
 *
 * Global setup for Playwright E2E tests
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

/**
 * Global setup - runs once before all tests
 */
async function globalSetup() {
  console.log('🔧 Setting up E2E test environment...');

  // Create auth directory
  const authDir = path.join(__dirname, '../.auth');
  await fs.mkdir(authDir, { recursive: true });

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Setup authenticated sessions for different user roles
    await setupAuthenticatedSession(page, 'admin', authDir);
    await setupAuthenticatedSession(page, 'manager', authDir);
    await setupAuthenticatedSession(page, 'employee', authDir);

    // Seed test data
    await seedTestData(page);

    console.log('✅ E2E test environment ready');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Setup authenticated session for a user role
 */
async function setupAuthenticatedSession(page, role, authDir) {
  const credentials = {
    admin: {
      email: 'admin@company.com',
      password: 'Admin123!'
    },
    manager: {
      email: 'manager@company.com',
      password: 'Manager123!'
    },
    employee: {
      email: 'employee@company.com',
      password: 'Employee123!'
    }
  };

  const creds = credentials[role];
  if (!creds) return;

  console.log(`📝 Authenticating ${role}...`);

  // Navigate to login
  await page.goto('http://localhost:3000/login');

  // Fill credentials
  await page.fill('[data-testid="email-input"]', creds.email);
  await page.fill('[data-testid="password-input"]', creds.password);

  // Submit login
  await page.click('[data-testid="login-button"]');

  // Wait for successful login
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 });

  // Save authentication state
  const authFile = path.join(authDir, `${role}-auth.json`);
  await page.context().storageState({ path: authFile });

  console.log(`✅ ${role} authenticated`);
}

/**
 * Seed test data via API
 */
async function seedTestData(page) {
  console.log('🌱 Seeding test data...');

  const testData = require('./test-data');

  // Navigate to a page that has authentication
  await page.goto('http://localhost:3000/dashboard');

  // Seed data via API calls
  await page.evaluate(async (data) => {
    const API_URL = 'http://localhost:8000';

    // Helper to make API calls
    async function apiCall(endpoint, method = 'POST', body = null) {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_URL}${endpoint}`, options);
      return response.json();
    }

    // Seed departments
    for (const dept of Object.values(data.departments)) {
      try {
        await apiCall('/api/departments', 'POST', dept);
      } catch (error) {
        console.log('Department may already exist:', dept.code);
      }
    }

    // Seed employees
    for (const user of Object.values(data.users)) {
      if (user.role === 'employee') {
        try {
          await apiCall('/api/employees', 'POST', user);
        } catch (error) {
          console.log('Employee may already exist:', user.email);
        }
      }
    }

    // Seed schedule templates
    for (const template of Object.values(data.scheduleTemplates)) {
      try {
        await apiCall('/api/templates', 'POST', template);
      } catch (error) {
        console.log('Template may already exist:', template.name);
      }
    }

    console.log('✅ Test data seeded');
  }, testData);
}

/**
 * Global teardown - runs once after all tests
 */
async function globalTeardown() {
  console.log('🧹 Cleaning up E2E test environment...');

  // Cleanup can be handled by database teardown scripts
  // or by resetting the test database

  console.log('✅ Cleanup complete');
}

module.exports = { globalSetup, globalTeardown };
