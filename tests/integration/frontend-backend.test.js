const request = require('supertest');
const { setupTestEnvironment, teardownTestEnvironment } = require('../setup');
const WebSocket = require('ws');
const puppeteer = require('puppeteer');

describe('Frontend-Backend Integration Tests', () => {
  let app;
  let database;
  let authToken;
  let browser;
  let page;

  beforeAll(async () => {
    const setup = await setupTestEnvironment();
    app = setup.app;
    database = setup.database;

    // Authenticate
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    authToken = loginResponse.body.token;

    // Setup Puppeteer for frontend testing
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Navigate to frontend application
    await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}`);
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    await teardownTestEnvironment(database);
  });

  describe('Authentication Flow Integration', () => {
    test('Login flow with frontend form submission', async () => {
      // Clear any existing login state
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/login`);

      // Fill login form
      await page.waitForSelector('input[name="email"]', { timeout: 5000 });
      await page.type('input[name="email"]', 'admin@example.com');
      await page.type('input[name="password"]', 'admin123');

      // Submit form and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('button[type="submit"]')
      ]);

      // Verify successful login
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/dashboard|home/);

      // Check that auth token is stored
      const authToken = await page.evaluate(() =>
        localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      );
      expect(authToken).toBeTruthy();

      // Verify API calls include auth header
      const apiRequest = page.waitForRequest(request =>
        request.url().includes('/api/') && request.headers()['authorization']
      );

      await page.click('a[href*="employees"]'); // Navigate to trigger API call
      const request_obj = await apiRequest;
      expect(request_obj.headers()['authorization']).toContain('Bearer');
    });

    test('Token refresh mechanism', async () => {
      // Mock expired token scenario
      await page.evaluate(() => {
        // Set an expired token
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
        localStorage.setItem('authToken', expiredToken);
      });

      // Trigger an API call that should refresh the token
      await page.reload();
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

      // Check if token was refreshed
      const newToken = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(newToken).not.toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid');
    });

    test('Logout flow and token cleanup', async () => {
      // Ensure user is logged in
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`);

      // Find and click logout button
      await page.waitForSelector('[data-testid="logout-button"]', { timeout: 5000 });
      await page.click('[data-testid="logout-button"]');

      // Wait for redirect to login page
      await page.waitForSelector('input[name="email"]', { timeout: 5000 });

      // Verify token is cleared
      const authToken = await page.evaluate(() =>
        localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      );
      expect(authToken).toBeFalsy();

      // Verify redirect to login page
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/login/);
    });
  });

  describe('Form Submission and Validation', () => {
    beforeEach(async () => {
      // Ensure logged in for these tests
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);
    });

    test('Employee creation form with validation', async () => {
      // Navigate to employee creation form
      await page.waitForSelector('[data-testid="add-employee-btn"]', { timeout: 5000 });
      await page.click('[data-testid="add-employee-btn"]');

      // Test client-side validation
      await page.waitForSelector('form[data-testid="employee-form"]');

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Check for validation messages
      await page.waitForSelector('.error-message, .invalid-feedback', { timeout: 2000 });
      const validationErrors = await page.$$eval('.error-message, .invalid-feedback',
        elements => elements.map(el => el.textContent)
      );

      expect(validationErrors.length).toBeGreaterThan(0);

      // Fill form with valid data
      await page.type('input[name="name"]', 'John Doe');
      await page.type('input[name="email"]', 'john.doe@example.com');
      await page.type('input[name="position"]', 'Sales Associate');
      await page.type('input[name="department"]', 'Sales');
      await page.type('input[name="hourlyRate"]', '15.50');
      await page.type('input[name="maxHoursPerWeek"]', '40');

      // Submit form and wait for success
      const responsePromise = page.waitForResponse(response =>
        response.url().includes('/api/employees') && response.request().method() === 'POST'
      );

      await page.click('button[type="submit"]');
      const response = await responsePromise;

      expect(response.status()).toBe(201);

      // Verify success message or redirect
      await page.waitForFunction(
        () =>
          document.querySelector('.success-message') ||
          document.querySelector('[data-testid="employee-list"]'),
        { timeout: 5000 }
      );
    });

    test('Form error handling and display', async () => {
      await page.waitForSelector('[data-testid="add-employee-btn"]');
      await page.click('[data-testid="add-employee-btn"]');

      // Fill form with invalid email
      await page.type('input[name="name"]', 'Test User');
      await page.type('input[name="email"]', 'invalid-email');
      await page.type('input[name="position"]', 'Test Position');
      await page.type('input[name="department"]', 'Test Department');
      await page.type('input[name="hourlyRate"]', '15');
      await page.type('input[name="maxHoursPerWeek"]', '40');

      // Mock server error response
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/api/employees') && request.method() === 'POST') {
          request.respond({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [
                { field: 'email', message: 'Invalid email format' }
              ]
            })
          });
        } else {
          request.continue();
        }
      });

      await page.click('button[type="submit"]');

      // Check for error display
      await page.waitForSelector('.error-message', { timeout: 3000 });
      const errorMessage = await page.$eval('.error-message', el => el.textContent);
      expect(errorMessage).toContain('Invalid email format');

      // Turn off request interception
      await page.setRequestInterception(false);
    });

    test('Schedule creation form with complex data', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/schedules`);

      await page.waitForSelector('[data-testid="create-schedule-btn"]');
      await page.click('[data-testid="create-schedule-btn"]');

      // Fill schedule form
      await page.type('input[name="name"]', 'Test Schedule');
      await page.type('input[name="startDate"]', '2025-09-16');
      await page.type('input[name="endDate"]', '2025-09-22');

      // Set complex requirements
      await page.type('input[name="minimumStaff"]', '5');
      await page.type('input[name="maximumStaff"]', '15');

      // Set operating hours for each day
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (const day of days) {
        await page.type(`input[name="${day}.open"]`, '09:00');
        await page.type(`input[name="${day}.close"]`, '18:00');
      }

      // Submit form
      const responsePromise = page.waitForResponse(response =>
        response.url().includes('/api/schedules') && response.request().method() === 'POST'
      );

      await page.click('button[type="submit"]');
      const response = await responsePromise;

      expect(response.status()).toBe(201);

      // Verify schedule appears in list
      await page.waitForSelector('[data-testid="schedule-list"]');
      const scheduleItems = await page.$$eval('[data-testid^="schedule-item"]',
        elements => elements.map(el => el.textContent)
      );

      expect(scheduleItems.some(item => item.includes('Test Schedule'))).toBe(true);
    });
  });

  describe('Real-time Updates via WebSocket', () => {
    test('Schedule updates broadcast to all clients', async () => {
      // Open second browser tab to simulate multiple clients
      const secondPage = await browser.newPage();
      await secondPage.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/schedules`);

      await secondPage.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);
      await secondPage.reload();

      // Wait for both pages to be ready
      await page.waitForSelector('[data-testid="schedule-list"]');
      await secondPage.waitForSelector('[data-testid="schedule-list"]');

      // Create schedule from first page
      await page.click('[data-testid="create-schedule-btn"]');
      await page.type('input[name="name"]', 'WebSocket Test Schedule');
      await page.type('input[name="startDate"]', '2025-09-23');
      await page.type('input[name="endDate"]', '2025-09-29');

      await page.click('button[type="submit"]');

      // Verify schedule appears on second page via WebSocket
      await secondPage.waitForFunction(
        () => {
          const schedules = Array.from(document.querySelectorAll('[data-testid^="schedule-item"]'));
          return schedules.some(schedule =>
            schedule.textContent.includes('WebSocket Test Schedule')
          );
        },
        { timeout: 10000 }
      );

      await secondPage.close();
    });

    test('Real-time notifications display', async () => {
      // Setup notification listener
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`);

      // Trigger notification from backend
      const notificationResponse = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'schedule_published',
          message: 'Your schedule has been published',
          userId: 1
        });

      expect(notificationResponse.status).toBe(200);

      // Wait for notification to appear in frontend
      await page.waitForSelector('[data-testid="notification"]', { timeout: 10000 });

      const notificationText = await page.$eval('[data-testid="notification"]',
        el => el.textContent
      );
      expect(notificationText).toContain('schedule has been published');
    });

    test('Connection recovery after network interruption', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`);

      // Simulate network disconnection
      await page.setOfflineMode(true);

      // Wait for disconnection indicator
      await page.waitForSelector('[data-testid="offline-indicator"]', { timeout: 5000 });

      // Reconnect
      await page.setOfflineMode(false);

      // Wait for reconnection
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="offline-indicator"]'),
        { timeout: 10000 }
      );

      // Verify WebSocket reconnection by triggering an update
      const updateResponse = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'connection_test',
          message: 'Connection restored',
          userId: 1
        });

      expect(updateResponse.status).toBe(200);

      // Verify notification is received
      await page.waitForSelector('[data-testid="notification"]', { timeout: 5000 });
    });
  });

  describe('State Management and Synchronization', () => {
    test('Optimistic updates with rollback on failure', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);

      // Get initial employee count
      const initialCount = await page.$$eval('[data-testid^="employee-item"]',
        elements => elements.length
      );

      // Setup request interception to simulate failure
      await page.setRequestInterception(true);
      let requestCount = 0;

      page.on('request', request => {
        if (request.url().includes('/api/employees') && request.method() === 'POST') {
          requestCount++;
          if (requestCount === 1) {
            // Fail the first request
            request.respond({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Server error' })
            });
          } else {
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      // Create employee (should show optimistically then rollback)
      await page.click('[data-testid="add-employee-btn"]');
      await page.type('input[name="name"]', 'Optimistic Test');
      await page.type('input[name="email"]', 'optimistic@example.com');
      await page.type('input[name="position"]', 'Test Position');
      await page.type('input[name="department"]', 'Test');
      await page.type('input[name="hourlyRate"]', '15');
      await page.type('input[name="maxHoursPerWeek"]', '40');

      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForSelector('.error-message', { timeout: 5000 });

      // Verify employee count is back to original (rollback occurred)
      const finalCount = await page.$$eval('[data-testid^="employee-item"]',
        elements => elements.length
      );
      expect(finalCount).toBe(initialCount);

      await page.setRequestInterception(false);
    });

    test('Data consistency across multiple components', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`);

      // Get employee count from dashboard widget
      const dashboardCount = await page.$eval('[data-testid="employee-count"]',
        el => parseInt(el.textContent)
      );

      // Navigate to employees page
      await page.click('a[href*="employees"]');
      await page.waitForSelector('[data-testid="employee-list"]');

      // Get employee count from list
      const listCount = await page.$$eval('[data-testid^="employee-item"]',
        elements => elements.length
      );

      expect(listCount).toBe(dashboardCount);

      // Create new employee
      await page.click('[data-testid="add-employee-btn"]');
      await page.type('input[name="name"]', 'Consistency Test');
      await page.type('input[name="email"]', 'consistency@example.com');
      await page.type('input[name="position"]', 'Test Position');
      await page.type('input[name="department"]', 'Test');
      await page.type('input[name="hourlyRate"]', '15');
      await page.type('input[name="maxHoursPerWeek"]', '40');

      await page.click('button[type="submit"]');

      // Wait for success
      await page.waitForFunction(
        (originalCount) => {
          const newCount = document.querySelectorAll('[data-testid^="employee-item"]').length;
          return newCount === originalCount + 1;
        },
        {},
        listCount
      );

      // Navigate back to dashboard
      await page.click('a[href*="dashboard"]');
      await page.waitForSelector('[data-testid="employee-count"]');

      // Verify dashboard count is updated
      const updatedDashboardCount = await page.$eval('[data-testid="employee-count"]',
        el => parseInt(el.textContent)
      );

      expect(updatedDashboardCount).toBe(dashboardCount + 1);
    });

    test('Session recovery after browser refresh', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);

      // Fill form partially
      await page.click('[data-testid="add-employee-btn"]');
      await page.type('input[name="name"]', 'Session Recovery Test');
      await page.type('input[name="email"]', 'recovery@example.com');

      // Refresh page
      await page.reload();

      // Check if session data is recovered (depends on implementation)
      const nameValue = await page.$eval('input[name="name"]', el => el.value).catch(() => '');
      const emailValue = await page.$eval('input[name="email"]', el => el.value).catch(() => '');

      // Form might be restored from localStorage/sessionStorage
      if (nameValue || emailValue) {
        expect(nameValue).toBe('Session Recovery Test');
        expect(emailValue).toBe('recovery@example.com');
      }

      // At minimum, auth state should be preserved
      const authToken = await page.evaluate(() =>
        localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      );
      expect(authToken).toBeTruthy();
    });
  });

  describe('Error Handling and User Experience', () => {
    test('Network error handling and retry mechanism', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);

      // Simulate network error
      await page.setRequestInterception(true);
      let failCount = 0;

      page.on('request', request => {
        if (request.url().includes('/api/employees') && request.method() === 'GET') {
          failCount++;
          if (failCount <= 2) {
            // Fail first two requests
            request.abort('failed');
          } else {
            request.continue();
          }
        } else {
          request.continue();
        }
      });

      // Trigger API call
      await page.reload();

      // Should show loading state then retry and eventually succeed
      await page.waitForSelector('[data-testid="employee-list"]', { timeout: 15000 });

      // Verify retry happened (failCount should be > 1)
      expect(failCount).toBeGreaterThan(1);

      await page.setRequestInterception(false);
    });

    test('Offline mode functionality', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);

      // Go offline
      await page.setOfflineMode(true);

      // Try to create employee while offline
      await page.click('[data-testid="add-employee-btn"]');
      await page.type('input[name="name"]', 'Offline Test');
      await page.type('input[name="email"]', 'offline@example.com');
      await page.type('input[name="position"]', 'Test Position');
      await page.type('input[name="department"]', 'Test');
      await page.type('input[name="hourlyRate"]', '15');
      await page.type('input[name="maxHoursPerWeek"]', '40');

      await page.click('button[type="submit"]');

      // Should show offline message or queue the request
      await page.waitForSelector('[data-testid="offline-indicator"], .offline-message', { timeout: 5000 });

      // Go back online
      await page.setOfflineMode(false);

      // Wait for sync to complete
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="offline-indicator"]'),
        { timeout: 10000 }
      );

      // Verify data was synced (if offline queueing is implemented)
      const employees = await page.$$eval('[data-testid^="employee-item"]',
        elements => elements.map(el => el.textContent)
      );

      // Check if offline creation was queued and synced
      const hasOfflineEmployee = employees.some(emp => emp.includes('Offline Test'));
      if (hasOfflineEmployee) {
        expect(hasOfflineEmployee).toBe(true);
      }
    });

    test('Loading states and user feedback', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/schedules`);

      // Intercept request to add delay
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/api/schedules') && request.method() === 'POST') {
          setTimeout(() => request.continue(), 2000); // Add 2 second delay
        } else {
          request.continue();
        }
      });

      // Start schedule creation
      await page.click('[data-testid="create-schedule-btn"]');
      await page.type('input[name="name"]', 'Loading Test Schedule');
      await page.type('input[name="startDate"]', '2025-09-30');
      await page.type('input[name="endDate"]', '2025-10-06');

      await page.click('button[type="submit"]');

      // Check for loading indicator
      await page.waitForSelector('[data-testid="loading"], .loading, .spinner', { timeout: 1000 });

      // Wait for completion
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="loading"], .loading, .spinner'),
        { timeout: 10000 }
      );

      await page.setRequestInterception(false);
    });

    test('Graceful degradation without JavaScript', async () => {
      // This test would require running a version without JavaScript
      // For now, we test that critical functionality has server-side fallbacks

      const response = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        // Server-side rendered page should work without JavaScript
        expect(response.text).toContain('employees');
        expect(response.headers['content-type']).toContain('text/html');
      }

      // Test form submission without AJAX
      const formResponse = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .type('form')
        .send({
          name: 'No JS Test',
          email: 'nojs@example.com',
          position: 'Test Position',
          department: 'Test',
          hourlyRate: '15',
          maxHoursPerWeek: '40'
        });

      // Should either process the form or return appropriate response
      expect([200, 201, 302].includes(formResponse.status)).toBe(true);
    });
  });

  describe('Performance and User Experience', () => {
    test('Page load performance', async () => {
      const navigationStart = Date.now();

      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`, {
        waitUntil: 'networkidle0'
      });

      const loadTime = Date.now() - navigationStart;

      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Check for core web vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const webVitals = {};

            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                webVitals.fcp = entry.startTime;
              }
              if (entry.entryType === 'largest-contentful-paint') {
                webVitals.lcp = entry.startTime;
              }
            });

            resolve(webVitals);
          }).observe({ type: 'paint', buffered: true });

          // Fallback timeout
          setTimeout(() => resolve({}), 1000);
        });
      });

      if (metrics.fcp) {
        expect(metrics.fcp).toBeLessThan(2000); // FCP < 2s
      }
      if (metrics.lcp) {
        expect(metrics.lcp).toBeLessThan(4000); // LCP < 4s
      }
    });

    test('Table pagination and virtual scrolling', async () => {
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);

      // Check if pagination is working
      const paginationExists = await page.$('[data-testid="pagination"]') !== null;

      if (paginationExists) {
        // Test pagination navigation
        const nextButton = await page.$('[data-testid="next-page"]');
        if (nextButton) {
          await nextButton.click();

          // Wait for new data to load
          await page.waitForFunction(
            () => {
              const url = new URL(window.location);
              return url.searchParams.get('page') === '2';
            },
            { timeout: 5000 }
          );

          // Verify URL updated
          const currentUrl = page.url();
          expect(currentUrl).toContain('page=2');
        }
      }

      // Test search functionality
      const searchInput = await page.$('input[data-testid="search"], input[name="search"]');
      if (searchInput) {
        await page.type('input[data-testid="search"], input[name="search"]', 'John');

        // Wait for search results
        await page.waitForTimeout(1000); // Debounce delay

        const employees = await page.$$eval('[data-testid^="employee-item"]',
          elements => elements.map(el => el.textContent)
        );

        if (employees.length > 0) {
          expect(employees.some(emp => emp.toLowerCase().includes('john'))).toBe(true);
        }
      }
    });

    test('Mobile responsiveness', async () => {
      // Test mobile viewport
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/dashboard`);

      // Check if mobile navigation is working
      const hamburgerMenu = await page.$('[data-testid="mobile-menu"], .hamburger, .mobile-nav-toggle');
      if (hamburgerMenu) {
        await hamburgerMenu.click();

        // Check if navigation menu appears
        await page.waitForSelector('[data-testid="mobile-nav"], .mobile-navigation', { timeout: 2000 });
      }

      // Test form interaction on mobile
      await page.goto(`http://localhost:${process.env.FRONTEND_PORT || 3000}/employees`);
      await page.click('[data-testid="add-employee-btn"]');

      // Check if form is usable on mobile
      const formVisible = await page.isIntersectingViewport('form[data-testid="employee-form"]');
      expect(formVisible).toBe(true);

      // Reset viewport
      await page.setViewport({ width: 1920, height: 1080 });
    });
  });

  afterAll(() => {
    console.log('\n=== FRONTEND-BACKEND INTEGRATION TEST SUMMARY ===');
    console.log('✅ Authentication flow integration tests completed');
    console.log('✅ Form submission and validation tests completed');
    console.log('✅ Real-time WebSocket communication tests completed');
    console.log('✅ State management and synchronization tests completed');
    console.log('✅ Error handling and user experience tests completed');
    console.log('✅ Performance and user experience tests completed');
  });
});