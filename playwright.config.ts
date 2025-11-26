import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Comprehensive testing for AI Schedule Manager
 */
export default defineConfig({
  testDir: './e2e-tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3, // Limit to 3 workers to avoid rate limiting
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }],
    ['list']
  ],
  
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost', // Frontend runs on port 80 via Docker
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'API Tests',
      testDir: './tests/e2e/api',
      testMatch: /.*\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:8000',
      }
    },
    {
      name: 'chromium',
      testDir: './e2e-tests',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testDir: './e2e-tests',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testDir: './e2e-tests',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      testDir: './e2e-tests',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      testDir: './e2e-tests',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Commented out webServer config for isolated testing
  // webServer: [
  //   {
  //     command: 'cd backend && uvicorn src.main:app --reload --port 8000',
  //     port: 8000,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'cd frontend && npm start',
  //     port: 3000,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   }
  // ],
});