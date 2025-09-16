/**
 * Playwright Configuration for E2E Testing
 * Comprehensive end-to-end test configuration
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './e2e-tests/tests',

  // Global test timeout
  timeout: 30 * 1000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'e2e-tests/reports/html' }],
    ['json', { outputFile: 'e2e-tests/reports/results.json' }],
    ['junit', { outputFile: 'e2e-tests/reports/junit.xml' }],
    ['list'],
    ...(process.env.CI ? [['github']] : [])
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./e2e-tests/global-setup.js'),
  globalTeardown: require.resolve('./e2e-tests/global-teardown.js'),

  // Use configuration
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Global test configuration
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Browser configuration
    headless: process.env.CI ? true : false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Permissions
    permissions: ['notifications'],

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },

    // Storage state (for authenticated tests)
    // storageState: 'e2e-tests/auth.json',
  },

  // Test projects for different browsers and scenarios
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      teardown: 'cleanup',
    },

    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.js/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    // Tablet browsers
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup'],
    },

    // High DPI displays
    {
      name: 'High DPI',
      use: {
        ...devices['Desktop Chrome HiDPI'],
        deviceScaleFactor: 2,
      },
      dependencies: ['setup'],
    },

    // Slow 3G network simulation
    {
      name: 'Slow Network',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-features=NetworkServiceLogging'],
        },
        contextOptions: {
          offline: false,
          downloadSpeed: 50 * 1024, // 50 KB/s
          uploadSpeed: 20 * 1024,   // 20 KB/s
          latency: 2000,            // 2s latency
        },
      },
      dependencies: ['setup'],
    },

    // Dark mode testing
    {
      name: 'Dark Mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
      dependencies: ['setup'],
    },

    // Accessibility testing
    {
      name: 'Accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Enable accessibility testing
        reducedMotion: 'reduce',
        forcedColors: 'active',
      },
      dependencies: ['setup'],
    },

    // Performance testing
    {
      name: 'Performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--enable-gpu-memory-buffer-video-frames',
          ],
        },
      },
      dependencies: ['setup'],
    },

    // API testing
    {
      name: 'API',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.API_URL || 'http://localhost:8000',
      },
      testMatch: /.*\.api\.spec\.js/,
      dependencies: ['setup'],
    },
  ],

  // Web server configuration
  webServer: [
    // Frontend server
    {
      command: 'npm start',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        REACT_APP_API_URL: 'http://localhost:8000',
      },
    },
    // Backend server
    {
      command: 'cd backend && python -m uvicorn src.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      reuseExistingServer: !process.env.CI,
      env: {
        ENVIRONMENT: 'test',
        DATABASE_URL: 'sqlite:///test.db',
      },
    },
  ],

  // Output directory
  outputDir: 'e2e-tests/test-results',

  // Test ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
  ],

  // Metadata
  metadata: {
    'test-suite': 'AI Schedule Manager E2E Tests',
    'environment': process.env.NODE_ENV || 'test',
    'base-url': process.env.BASE_URL || 'http://localhost:3000',
  },

  // Grep configuration
  grep: process.env.GREP || undefined,
  grepInvert: process.env.GREP_INVERT || undefined,

  // Shard configuration for parallel execution
  shard: process.env.SHARD ? {
    current: parseInt(process.env.SHARD_CURRENT) || 1,
    total: parseInt(process.env.SHARD_TOTAL) || 1,
  } : undefined,

  // Update snapshots
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',
});