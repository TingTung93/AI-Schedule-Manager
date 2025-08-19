/**
 * Mock Server Setup for E2E Tests
 * Provides mock responses when actual servers aren't running
 */

import { Page, Route } from '@playwright/test';

export async function setupMockServer(page: Page) {
  // Mock API endpoints
  await page.route('**/api/auth/login', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-jwt-token',
        user: {
          email: 'admin@test.com',
          role: 'admin'
        }
      })
    });
  });

  await page.route('**/api/health', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy' })
    });
  });

  await page.route('**/api/rules/parse', async (route: Route) => {
    const request = route.request();
    const data = await request.postDataJSON();
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rule_type: 'availability',
        employee: 'Test Employee',
        constraints: [{ type: 'time', value: '17:00' }],
        parsed_text: data.rule_text
      })
    });
  });

  await page.route('**/api/schedule/generate', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schedule: {
          id: 'schedule-123',
          start_date: '2025-01-20',
          end_date: '2025-01-26',
          shifts: []
        }
      })
    });
  });

  // Mock static assets
  await page.route('**/*.css', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: 'body { margin: 0; }'
    });
  });

  await page.route('**/*.js', async (route: Route) => {
    if (!route.request().url().includes('test')) {
      await route.continue();
    }
  });
}