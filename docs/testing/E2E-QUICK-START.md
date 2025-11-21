# E2E Testing Quick Start Guide
**AI Schedule Manager - Playwright E2E Tests**

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
# Install Playwright
npm install @playwright/test

# Install browsers (if not already installed)
npx playwright install chromium
```

### 2. Start Application Servers

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# Wait for React app to start on http://localhost:3000
```

### 3. Run Tests

**Terminal 3 - Tests:**
```bash
# Run all tests
npx playwright test

# Run with UI (recommended for first run)
npx playwright test --ui

# Run specific category
npx playwright test auth         # Authentication tests
npx playwright test smoke-test   # Quick smoke tests
```

## 📊 Test Commands Cheat Sheet

### Running Tests

```bash
# All tests (headless)
npx playwright test

# All tests (with browser visible)
npx playwright test --headed

# Specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Specific test file
npx playwright test e2e-tests/tests/01-authentication.spec.ts

# Tests matching pattern
npx playwright test auth                    # All files with "auth"
npx playwright test "schedule.*workflow"    # Regex pattern

# Debug mode
npx playwright test --debug                 # Step through tests
npx playwright test --ui                    # Interactive UI mode

# Update snapshots (if applicable)
npx playwright test --update-snapshots
```

### Filtering Tests

```bash
# Run tests with grep
npx playwright test --grep="login"              # Tests with "login" in name
npx playwright test --grep-invert="slow"        # Exclude "slow" tests

# Run by tag (if using @tags)
npx playwright test --grep="@smoke"
npx playwright test --grep="@critical"
```

### Viewing Results

```bash
# Show last HTML report
npx playwright show-report

# Generate new HTML report
npx playwright test --reporter=html

# List reporter (console)
npx playwright test --reporter=list

# Multiple reporters
npx playwright test --reporter=html,json
```

## 🎯 Common Test Scenarios

### Scenario 1: Quick Smoke Test
```bash
# Fast validation that app is working
npx playwright test smoke-test.spec.ts
# Expected duration: <2 minutes
```

### Scenario 2: Authentication Flow
```bash
# Test all authentication features
npx playwright test 01-authentication.spec.ts
# Expected duration: ~3 minutes
```

### Scenario 3: Full Critical Path
```bash
# Test all critical workflows
npx playwright test \
  01-authentication.spec.ts \
  02-rule-management.spec.ts \
  03-schedule-generation.spec.ts
# Expected duration: ~10 minutes
```

### Scenario 4: Mobile Testing
```bash
# Run on mobile devices
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Scenario 5: Cross-Browser
```bash
# Run on all desktop browsers
npx playwright test --project=chromium --project=firefox --project=webkit
```

### Scenario 6: Performance Testing
```bash
# Run only performance tests
npx playwright test --grep="Performance"
```

## 🐛 Debugging Tests

### Method 1: UI Mode (Recommended)
```bash
npx playwright test --ui
```
**Features**:
- Interactive test explorer
- Time-travel debugging
- Watch mode
- Filter by project/file
- See screenshots and videos inline

### Method 2: Debug Mode
```bash
npx playwright test --debug
```
**Features**:
- Playwright Inspector opens
- Step through test line-by-line
- Inspect DOM
- Generate selectors

### Method 3: Headed Mode
```bash
npx playwright test --headed --workers=1
```
**Features**:
- See browser during test
- Slower execution for observation
- Single worker for clarity

### Method 4: Screenshots & Videos
```bash
# Take screenshot on failure (default: enabled)
# Check: e2e-tests/test-results/[test-name]/test-failed-1.png

# Record video on failure (default: enabled)
# Check: e2e-tests/test-results/[test-name]/video.webm
```

### Method 5: Trace Viewer
```bash
# Enable traces (already configured for failed tests)
npx playwright show-trace e2e-tests/test-results/[test-name]/trace.zip
```

## 📝 Test Results & Reports

### HTML Report
```bash
# Generate and view
npx playwright test --reporter=html
npx playwright show-report

# Location: e2e-tests/reports/html/index.html
```

### JSON Report
```bash
# Generate
npx playwright test --reporter=json

# Location: e2e-tests/reports/results.json

# Parse with jq
cat e2e-tests/reports/results.json | jq '.suites[0].specs[0]'
```

### JUnit XML (for CI/CD)
```bash
# Generate
npx playwright test --reporter=junit

# Location: e2e-tests/reports/junit.xml
```

## 🔧 Configuration

### Environment Variables
```bash
# Base URL
BASE_URL=http://localhost:3000 npx playwright test

# API URL
API_URL=http://localhost:8000 npx playwright test

# Headless mode
CI=true npx playwright test  # Force headless

# Update snapshots
UPDATE_SNAPSHOTS=true npx playwright test
```

### Config File: `playwright.config.js`
```javascript
// Modify timeouts
timeout: 60000  // 60 seconds

// Change workers
workers: 4      // Parallel workers

// Change browser
use: {
  baseURL: 'http://localhost:3000',
  headless: false,
  screenshot: 'on',  // Always take screenshots
  video: 'on',       // Always record video
}
```

## 📦 Test File Structure

```
e2e-tests/
├── tests/                      # Test files
│   ├── 01-authentication.spec.ts
│   ├── 02-rule-management.spec.ts
│   ├── 03-schedule-generation.spec.ts
│   ├── 04-ai-optimization.spec.ts
│   ├── 05-calendar-integration.spec.ts
│   ├── 06-notifications.spec.ts
│   ├── authentication.spec.js
│   ├── schedule-workflow.spec.js
│   ├── user-workflows.spec.ts
│   ├── navigation-flow.spec.ts
│   ├── demo-test.spec.ts
│   ├── demo-login.spec.ts
│   ├── smoke-test.spec.ts
│   └── dashboard-debug.spec.ts
├── fixtures/                   # Test helpers
│   ├── page-objects.ts         # Page Object Models
│   ├── test-data.ts            # Test data
│   ├── mock-server.ts          # API mocks
│   └── ...
├── helpers/                    # Utilities
│   └── api-helpers.ts
├── reports/                    # Test reports
│   ├── html/                   # HTML reports
│   ├── results.json            # JSON report
│   └── junit.xml               # JUnit XML
├── test-results/               # Artifacts
│   └── [test-name]/
│       ├── test-failed-1.png   # Screenshots
│       ├── video.webm          # Videos
│       └── trace.zip           # Traces
├── global-setup.js             # Pre-test setup
└── global-teardown.js          # Post-test cleanup
```

## ⚡ Performance Tips

### Speed Up Tests
```bash
# Run tests in parallel (default: auto-detect cores)
npx playwright test --workers=8

# Disable videos (faster)
npx playwright test --config playwright.config.js

# Run specific tests only
npx playwright test --grep="@smoke"
```

### Reduce Flakiness
```bash
# Add retries
npx playwright test --retries=2

# Increase timeout
npx playwright test --timeout=60000

# Single worker (sequential)
npx playwright test --workers=1
```

## 🎨 Test Patterns

### Pattern 1: Login Once, Test Multiple
```typescript
// Use storage state to login once
test.use({ storageState: 'e2e-tests/auth.json' });
```

### Pattern 2: Mock External APIs
```typescript
// Intercept API calls
await page.route('**/api/**', route => {
  route.fulfill({ json: mockData });
});
```

### Pattern 3: Wait for Network Idle
```typescript
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');
```

### Pattern 4: Handle Timeouts
```typescript
await expect(page.locator('.button')).toBeVisible({ timeout: 10000 });
```

## 🚨 Troubleshooting

### Problem: Tests Timeout
**Solution**:
```bash
# Check servers are running
curl http://localhost:3000  # Frontend
curl http://localhost:8000/health  # Backend

# Increase timeout
npx playwright test --timeout=60000
```

### Problem: Tests Fail on CI
**Solution**:
```bash
# Use CI configuration
CI=true npx playwright test

# Install dependencies
npx playwright install --with-deps
```

### Problem: Flaky Tests
**Solution**:
```bash
# Add retries
npx playwright test --retries=3

# Run sequentially
npx playwright test --workers=1

# Debug specific test
npx playwright test --debug [test-file]
```

### Problem: Browser Not Found
**Solution**:
```bash
# Reinstall browsers
npx playwright install chromium firefox webkit

# With system dependencies
npx playwright install --with-deps
```

## 📚 Additional Resources

### Official Documentation
- Playwright Docs: https://playwright.dev/docs/intro
- Best Practices: https://playwright.dev/docs/best-practices
- API Reference: https://playwright.dev/docs/api/class-test

### Test Reports
- **HTML Report**: `/e2e-tests/reports/html/index.html`
- **Test Inventory**: `/docs/testing/E2E-TEST-INVENTORY.md`
- **Execution Summary**: `/docs/testing/E2E-TEST-EXECUTION-SUMMARY.md`

### CI/CD Integration
```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: npx playwright test --project=chromium
- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: e2e-tests/reports/html/
```

## ✅ Checklist for Running Tests

- [ ] Backend server running on port 8000
- [ ] Frontend server running on port 3000
- [ ] Playwright installed (`npx playwright --version`)
- [ ] Browsers installed (`npx playwright install chromium`)
- [ ] Test database seeded (if applicable)
- [ ] Environment variables set (if needed)

## 🎯 Quick Commands Reference

| Task | Command |
|------|---------|
| Run all tests | `npx playwright test` |
| Run with UI | `npx playwright test --ui` |
| Run headed | `npx playwright test --headed` |
| Run specific file | `npx playwright test auth.spec.ts` |
| Debug test | `npx playwright test --debug` |
| View report | `npx playwright show-report` |
| Run on Chrome only | `npx playwright test --project=chromium` |
| Run smoke tests | `npx playwright test smoke-test` |
| Update snapshots | `npx playwright test -u` |
| List tests | `npx playwright test --list` |

---

**Happy Testing! 🧪**

For detailed test inventory, see: `/docs/testing/E2E-TEST-INVENTORY.md`
For execution summary, see: `/docs/testing/E2E-TEST-EXECUTION-SUMMARY.md`
