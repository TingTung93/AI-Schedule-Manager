import { test, expect } from '@playwright/test';

test.describe('Frontend-Backend Integration Tests', () => {
  const API_URL = 'http://localhost:8000';
  const FRONTEND_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(FRONTEND_URL);
  });

  test('API health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('Authentication flow', async ({ page, request }) => {
    // Test login API
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('access_token');
    expect(loginData.user.email).toBe('test@example.com');
  });

  test('Rule parsing integration', async ({ page }) => {
    // Navigate to rules page
    await page.goto(`${FRONTEND_URL}/rules`);
    
    // Wait for the component to load
    await page.waitForSelector('text=AI Schedule Manager - Rule Creator');
    
    // Enter a rule
    const ruleInput = await page.locator('textarea[placeholder*="Sarah"]');
    await ruleInput.fill("Sarah can't work past 5pm on weekdays");
    
    // Click parse button
    await page.click('button:has-text("Parse Rule")');
    
    // Wait for API response
    await page.waitForResponse(response => 
      response.url().includes('/api/rules/parse') && response.status() === 200
    );
    
    // Check if preview dialog appears
    await expect(page.locator('text=Rule Preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Rule parsed successfully!')).toBeVisible();
  });

  test('Employee management', async ({ request }) => {
    // Get employees
    const getResponse = await request.get(`${API_URL}/api/employees`);
    expect(getResponse.ok()).toBeTruthy();
    const employeesData = await getResponse.json();
    expect(employeesData.employees).toBeInstanceOf(Array);
    
    // Create new employee
    const createResponse = await request.post(`${API_URL}/api/employees`, {
      data: {
        name: 'Test Employee',
        email: 'test.employee@example.com',
        role: 'Server'
      }
    });
    
    expect(createResponse.ok()).toBeTruthy();
    const newEmployee = await createResponse.json();
    expect(newEmployee.name).toBe('Test Employee');
    expect(newEmployee).toHaveProperty('id');
  });

  test('Schedule generation', async ({ request }) => {
    // Generate schedule
    const response = await request.post(`${API_URL}/api/schedule/generate`, {
      data: {
        start_date: '2024-01-01',
        end_date: '2024-01-07'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const schedule = await response.json();
    expect(schedule.status).toBe('generated');
    expect(schedule.shifts).toBeInstanceOf(Array);
    expect(schedule.shifts.length).toBeGreaterThan(0);
  });

  test('Schedule optimization', async ({ request }) => {
    // First generate a schedule
    const generateResponse = await request.post(`${API_URL}/api/schedule/generate`, {
      data: {
        start_date: '2024-01-01',
        end_date: '2024-01-07'
      }
    });
    
    const schedule = await generateResponse.json();
    
    // Then optimize it
    const optimizeResponse = await request.post(`${API_URL}/api/schedule/optimize?schedule_id=${schedule.id}`);
    expect(optimizeResponse.ok()).toBeTruthy();
    
    const optimization = await optimizeResponse.json();
    expect(optimization.status).toBe('optimized');
    expect(optimization.improvements).toHaveProperty('cost_savings');
    expect(optimization.improvements).toHaveProperty('coverage');
  });

  test('Analytics overview', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/analytics/overview`);
    expect(response.ok()).toBeTruthy();
    
    const analytics = await response.json();
    expect(analytics).toHaveProperty('total_employees');
    expect(analytics).toHaveProperty('total_rules');
    expect(analytics).toHaveProperty('optimization_score');
    expect(typeof analytics.optimization_score).toBe('number');
  });

  test('Notifications system', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/notifications`);
    expect(response.ok()).toBeTruthy();
    
    const notifications = await response.json();
    expect(notifications).toHaveProperty('notifications');
    expect(notifications).toHaveProperty('unread_count');
    expect(notifications.notifications).toBeInstanceOf(Array);
  });

  test('Full workflow: Create rule and generate schedule', async ({ page, request }) => {
    // Step 1: Parse a rule via API
    const parseResponse = await request.post(`${API_URL}/api/rules/parse`, {
      data: {
        rule_text: "John prefers morning shifts"
      }
    });
    
    expect(parseResponse.ok()).toBeTruthy();
    const parsedRule = await parseResponse.json();
    expect(parsedRule.rule_type).toBe('preference');
    expect(parsedRule.employee).toBe('John Smith');
    
    // Step 2: Get all rules
    const rulesResponse = await request.get(`${API_URL}/api/rules`);
    const rulesData = await rulesResponse.json();
    expect(rulesData.total).toBeGreaterThan(0);
    
    // Step 3: Generate schedule with rules applied
    const scheduleResponse = await request.post(`${API_URL}/api/schedule/generate`, {
      data: {
        start_date: '2024-01-08',
        end_date: '2024-01-14'
      }
    });
    
    expect(scheduleResponse.ok()).toBeTruthy();
    const schedule = await scheduleResponse.json();
    
    // Step 4: Verify schedule contains John in morning shifts
    const morningShifts = schedule.shifts.filter(s => s.type === 'morning');
    const johnInMorning = morningShifts.some(shift => 
      shift.employees.includes('John Smith')
    );
    
    expect(johnInMorning).toBeTruthy();
  });

  test('CORS headers validation', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    const headers = response.headers();
    
    // Check if CORS headers are properly set
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('Error handling for invalid requests', async ({ request }) => {
    // Test invalid login
    const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: '',
        password: ''
      }
    });
    
    expect(loginResponse.status()).toBe(401);
    const errorData = await loginResponse.json();
    expect(errorData.detail).toBe('Invalid credentials');
    
    // Test parsing empty rule
    const parseResponse = await request.post(`${API_URL}/api/rules/parse`, {
      data: {
        rule_text: ''
      }
    });
    
    // The API should handle empty rules gracefully
    if (!parseResponse.ok()) {
      expect(parseResponse.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('UI responsiveness and loading states', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/rules`);
    
    // Check loading indicator appears
    const loadingIndicator = page.locator('.MuiLinearProgress-root');
    
    // Enter a rule
    await page.fill('textarea[placeholder*="Sarah"]', "Test rule for loading");
    
    // Click parse with network throttling
    await page.route('**/api/rules/parse', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
      await route.continue();
    });
    
    await page.click('button:has-text("Parse Rule")');
    
    // Loading indicator should be visible
    await expect(loadingIndicator).toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('API response times', async ({ request }) => {
    const endpoints = [
      '/health',
      '/api/employees',
      '/api/rules',
      '/api/analytics/overview',
      '/api/notifications'
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      const response = await request.get(`http://localhost:8000${endpoint}`);
      const responseTime = Date.now() - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(1000); // Response should be under 1 second
      
      console.log(`${endpoint}: ${responseTime}ms`);
    }
  });

  test('Concurrent request handling', async ({ request }) => {
    const promises = [];
    
    // Send 10 concurrent requests
    for (let i = 0; i < 10; i++) {
      promises.push(
        request.post(`http://localhost:8000/api/rules/parse`, {
          data: {
            rule_text: `Test rule ${i}`
          }
        })
      );
    }
    
    const responses = await Promise.all(promises);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });
});