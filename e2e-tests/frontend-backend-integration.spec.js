import { test, expect } from '@playwright/test';

test.describe('Frontend-Backend Integration', () => {
  const API_URL = 'http://localhost:8000';
  const FRONTEND_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto(FRONTEND_URL);
  });

  test.describe('Authentication Flow', () => {
    test('should successfully login and receive token', async ({ page, request }) => {
      // Test API directly first
      const apiResponse = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          email: 'admin@test.com',
          password: 'password123'
        }
      });
      
      expect(apiResponse.ok()).toBeTruthy();
      const apiData = await apiResponse.json();
      expect(apiData).toHaveProperty('access_token');
      expect(apiData).toHaveProperty('user');
      
      // Test through frontend
      await page.goto(`${FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'admin@test.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Check if redirected to dashboard after successful login
      await expect(page).toHaveURL(`${FRONTEND_URL}/dashboard`);
      
      // Verify token is stored
      const localStorage = await page.evaluate(() => window.localStorage);
      expect(localStorage).toHaveProperty('token');
    });

    test('should handle login failures gracefully', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/login`);
      await page.fill('[data-testid="email-input"]', 'invalid@test.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    });
  });

  test.describe('Rule Management', () => {
    test('should parse and save a scheduling rule', async ({ page, request }) => {
      // Test API endpoint
      const ruleText = "Sarah can't work past 5pm on weekdays";
      const apiResponse = await request.post(`${API_URL}/api/rules/parse`, {
        data: { rule_text: ruleText }
      });
      
      expect(apiResponse.ok()).toBeTruthy();
      const parsedRule = await apiResponse.json();
      expect(parsedRule).toHaveProperty('rule_type');
      expect(parsedRule).toHaveProperty('employee');
      expect(parsedRule.employee).toBe('Sarah Johnson');
      
      // Test through frontend component
      await page.goto(`${FRONTEND_URL}/rules`);
      await page.fill('[data-testid="rule-input"]', ruleText);
      await page.click('[data-testid="parse-rule-button"]');
      
      // Wait for parsing to complete
      await page.waitForSelector('[data-testid="rule-preview"]');
      
      // Verify preview shows correct interpretation
      await expect(page.locator('[data-testid="rule-type"]')).toContainText('availability');
      await expect(page.locator('[data-testid="rule-employee"]')).toContainText('Sarah Johnson');
      
      // Confirm the rule
      await page.click('[data-testid="confirm-rule-button"]');
      
      // Verify rule appears in active rules list
      await expect(page.locator('[data-testid="active-rules-list"]')).toContainText(ruleText);
    });

    test('should fetch and display all rules', async ({ page, request }) => {
      // Add some test rules first
      await request.post(`${API_URL}/api/rules/parse`, {
        data: { rule_text: "John prefers morning shifts" }
      });
      await request.post(`${API_URL}/api/rules/parse`, {
        data: { rule_text: "Mike needs Mondays off" }
      });
      
      // Fetch rules through API
      const rulesResponse = await request.get(`${API_URL}/api/rules`);
      expect(rulesResponse.ok()).toBeTruthy();
      const rulesData = await rulesResponse.json();
      expect(rulesData.rules).toBeInstanceOf(Array);
      expect(rulesData.total).toBeGreaterThanOrEqual(2);
      
      // Verify frontend displays all rules
      await page.goto(`${FRONTEND_URL}/rules`);
      await page.waitForSelector('[data-testid="rules-list"]');
      
      const ruleItems = await page.locator('[data-testid="rule-item"]').count();
      expect(ruleItems).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Schedule Generation', () => {
    test('should generate schedule based on rules', async ({ page, request }) => {
      // Test schedule generation API
      const scheduleRequest = {
        start_date: '2025-01-20',
        end_date: '2025-01-26'
      };
      
      const apiResponse = await request.post(`${API_URL}/api/schedule/generate`, {
        data: scheduleRequest
      });
      
      expect(apiResponse.ok()).toBeTruthy();
      const schedule = await apiResponse.json();
      expect(schedule).toHaveProperty('shifts');
      expect(schedule.shifts).toBeInstanceOf(Array);
      expect(schedule.shifts.length).toBeGreaterThan(0);
      
      // Test through frontend
      await page.goto(`${FRONTEND_URL}/schedule`);
      await page.fill('[data-testid="start-date"]', '2025-01-20');
      await page.fill('[data-testid="end-date"]', '2025-01-26');
      await page.click('[data-testid="generate-schedule-button"]');
      
      // Wait for schedule to be generated
      await page.waitForSelector('[data-testid="schedule-calendar"]');
      
      // Verify shifts are displayed
      const shiftElements = await page.locator('[data-testid="shift-item"]').count();
      expect(shiftElements).toBeGreaterThan(0);
    });

    test('should optimize existing schedule', async ({ page, request }) => {
      // First generate a schedule
      const generateResponse = await request.post(`${API_URL}/api/schedule/generate`, {
        data: {
          start_date: '2025-01-20',
          end_date: '2025-01-26'
        }
      });
      const schedule = await generateResponse.json();
      
      // Optimize the schedule
      const optimizeResponse = await request.post(`${API_URL}/api/schedule/optimize`, {
        data: { schedule_id: schedule.id }
      });
      
      expect(optimizeResponse.ok()).toBeTruthy();
      const optimization = await optimizeResponse.json();
      expect(optimization.status).toBe('optimized');
      expect(optimization.improvements).toHaveProperty('cost_savings');
      expect(optimization.improvements).toHaveProperty('coverage');
      
      // Test optimization through frontend
      await page.goto(`${FRONTEND_URL}/schedule`);
      await page.click('[data-testid="optimize-schedule-button"]');
      
      // Wait for optimization results
      await page.waitForSelector('[data-testid="optimization-results"]');
      
      // Verify improvements are displayed
      await expect(page.locator('[data-testid="cost-savings"]')).toBeVisible();
      await expect(page.locator('[data-testid="coverage-score"]')).toBeVisible();
    });
  });

  test.describe('Employee Management', () => {
    test('should fetch and display employees', async ({ page, request }) => {
      // Test API endpoint
      const response = await request.get(`${API_URL}/api/employees`);
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.employees).toBeInstanceOf(Array);
      expect(data.total).toBeGreaterThan(0);
      
      // Test frontend display
      await page.goto(`${FRONTEND_URL}/employees`);
      await page.waitForSelector('[data-testid="employees-list"]');
      
      const employeeCards = await page.locator('[data-testid="employee-card"]').count();
      expect(employeeCards).toBe(data.total);
    });

    test('should add new employee', async ({ page, request }) => {
      const newEmployee = {
        name: 'Jane Doe',
        email: 'jane@test.com',
        role: 'Manager'
      };
      
      // Test API
      const apiResponse = await request.post(`${API_URL}/api/employees`, {
        data: newEmployee
      });
      expect(apiResponse.ok()).toBeTruthy();
      const createdEmployee = await apiResponse.json();
      expect(createdEmployee.name).toBe(newEmployee.name);
      expect(createdEmployee).toHaveProperty('id');
      
      // Test through frontend
      await page.goto(`${FRONTEND_URL}/employees`);
      await page.click('[data-testid="add-employee-button"]');
      
      // Fill form
      await page.fill('[data-testid="employee-name"]', 'John Doe');
      await page.fill('[data-testid="employee-email"]', 'john.doe@test.com');
      await page.fill('[data-testid="employee-role"]', 'Server');
      await page.click('[data-testid="save-employee-button"]');
      
      // Verify employee appears in list
      await expect(page.locator('[data-testid="employees-list"]')).toContainText('John Doe');
    });
  });

  test.describe('Analytics Dashboard', () => {
    test('should fetch and display analytics overview', async ({ page, request }) => {
      // Test API
      const response = await request.get(`${API_URL}/api/analytics/overview`);
      expect(response.ok()).toBeTruthy();
      const analytics = await response.json();
      expect(analytics).toHaveProperty('total_employees');
      expect(analytics).toHaveProperty('optimization_score');
      expect(analytics).toHaveProperty('labor_cost_trend');
      
      // Test frontend dashboard
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await page.waitForSelector('[data-testid="analytics-overview"]');
      
      // Verify metrics are displayed
      await expect(page.locator('[data-testid="total-employees-metric"]')).toBeVisible();
      await expect(page.locator('[data-testid="optimization-score"]')).toBeVisible();
      await expect(page.locator('[data-testid="cost-trend"]')).toContainText(analytics.labor_cost_trend);
    });
  });

  test.describe('Notifications', () => {
    test('should fetch and display notifications', async ({ page, request }) => {
      // Test API
      const response = await request.get(`${API_URL}/api/notifications`);
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.notifications).toBeInstanceOf(Array);
      expect(data).toHaveProperty('unread_count');
      
      // Test frontend
      await page.goto(`${FRONTEND_URL}/dashboard`);
      
      // Check notification badge
      const badge = page.locator('[data-testid="notification-badge"]');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(data.unread_count.toString());
      
      // Open notifications
      await page.click('[data-testid="notification-icon"]');
      await page.waitForSelector('[data-testid="notification-list"]');
      
      // Verify notifications are displayed
      const notificationItems = await page.locator('[data-testid="notification-item"]').count();
      expect(notificationItems).toBe(data.notifications.length);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Block API requests to simulate network error
      await context.route('**/api/**', route => route.abort());
      
      await page.goto(`${FRONTEND_URL}/rules`);
      await page.fill('[data-testid="rule-input"]', 'Test rule');
      await page.click('[data-testid="parse-rule-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-toast"]')).toContainText('network');
    });

    test('should handle API errors with proper messages', async ({ page, context }) => {
      // Mock API to return error
      await context.route('**/api/rules/parse', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Invalid rule format' })
        });
      });
      
      await page.goto(`${FRONTEND_URL}/rules`);
      await page.fill('[data-testid="rule-input"]', 'Invalid rule');
      await page.click('[data-testid="parse-rule-button"]');
      
      // Should show specific error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid rule format');
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update UI when data changes', async ({ page, browser }) => {
      // Open two browser contexts to simulate multiple users
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await page1.goto(`${FRONTEND_URL}/employees`);
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${FRONTEND_URL}/employees`);
      
      // Add employee in first context
      await page1.click('[data-testid="add-employee-button"]');
      await page1.fill('[data-testid="employee-name"]', 'New Employee');
      await page1.fill('[data-testid="employee-email"]', 'new@test.com');
      await page1.fill('[data-testid="employee-role"]', 'Cook');
      await page1.click('[data-testid="save-employee-button"]');
      
      // Refresh second context and verify new employee appears
      await page2.reload();
      await expect(page2.locator('[data-testid="employees-list"]')).toContainText('New Employee');
      
      await context1.close();
      await context2.close();
    });
  });
});