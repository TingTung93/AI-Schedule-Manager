# E2E Tests for Department Management

Comprehensive end-to-end tests for the AI Schedule Manager department management features using Playwright.

## Test Coverage

### 1. Department Management Workflows (`department-management.spec.js`)
- ✅ Complete schedule creation workflow
- ✅ Employee assignment and shift management
- ✅ Coverage gap identification and resolution
- ✅ Employee transfer between departments
- ✅ Bulk employee assignment operations
- ✅ Analytics dashboard and reporting
- ✅ Schedule template application and customization
- ✅ Accessibility testing (keyboard navigation, ARIA labels)
- ✅ Mobile responsive testing

### 2. Schedule Conflict Detection (`schedule-conflicts.spec.js`)
- ✅ Overlapping shift detection
- ✅ Double-booking prevention
- ✅ Maximum weekly hours enforcement
- ✅ Minimum rest period validation
- ✅ Conflict resolution suggestions
- ✅ Cross-schedule conflict detection
- ✅ Shift duration limits
- ✅ Multi-conflict scenarios
- ✅ Performance testing for large schedules

### 3. Calendar Functionality (`department-calendar.spec.js`)
- ✅ Multiple view modes (month/week/day)
- ✅ Date navigation and date picker
- ✅ Employee and shift type filtering
- ✅ Inline shift editing
- ✅ Drag-and-drop rescheduling
- ✅ Calendar export (PDF, CSV)
- ✅ Keyboard navigation
- ✅ Mobile swipe gestures

## Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test tests/e2e/department-management.spec.js
npx playwright test tests/e2e/schedule-conflicts.spec.js
npx playwright test tests/e2e/department-calendar.spec.js
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests on specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run mobile tests
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Update snapshots
```bash
npx playwright test --update-snapshots
```

## Test Reports

### View HTML report
```bash
npx playwright show-report e2e-tests/reports/html
```

### View test results
Test results are saved to:
- HTML: `e2e-tests/reports/html/`
- JSON: `e2e-tests/reports/results.json`
- JUnit: `e2e-tests/reports/junit.xml`

## Test Data

Test fixtures are located in `tests/e2e/fixtures/`:
- `test-data.js` - Centralized test data (users, departments, schedules, etc.)
- `setup.js` - Global setup and teardown functions

### Test Users

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| Admin | admin@company.com | Admin123! | All |
| Manager | manager@company.com | Manager123! | Schedule, Employee, Analytics |
| Employee | employee@company.com | Employee123! | View own schedule |

## Writing New Tests

### Basic Test Structure

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup
    await login(page, testUsers.manager);
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/feature');

    // Act
    await page.click('[data-testid="action-button"]');

    // Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** - Don't rely on CSS classes or text content
2. **Test user workflows** - Test complete user journeys, not individual components
3. **Verify visual feedback** - Check success messages, error states, loading indicators
4. **Test error cases** - Ensure errors are handled gracefully
5. **Test accessibility** - Verify keyboard navigation and screen reader support
6. **Test mobile** - Ensure responsive design works correctly
7. **Use fixtures** - Leverage centralized test data from `fixtures/test-data.js`
8. **Clean up** - Reset state between tests to avoid interdependencies

### Common Patterns

```javascript
// Login helper
async function login(page, user) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

// Wait for API response
await page.waitForResponse(response =>
  response.url().includes('/api/schedules') && response.status() === 200
);

// Handle dialogs
page.on('dialog', async dialog => {
  await dialog.accept();
});

// Screenshot on failure (automatic with config)
// Video recording (automatic for failed tests)
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: e2e-tests/reports/
```

## Debugging Failed Tests

### View trace
```bash
npx playwright show-trace e2e-tests/test-results/<test-name>/trace.zip
```

### View screenshots
Failed test screenshots are saved to `e2e-tests/test-results/<test-name>/`

### View videos
Failed test videos are saved to `e2e-tests/test-results/<test-name>/video.webm`

### Common Issues

1. **Timeouts** - Increase timeout in test or use `{ timeout: 60000 }`
2. **Flaky tests** - Add explicit waits: `await page.waitForLoadState('networkidle')`
3. **Element not found** - Verify data-testid exists and element is visible
4. **Authentication issues** - Check auth state is saved in `.auth/` directory
5. **API errors** - Verify backend is running on port 8000

## Performance

Tests are configured for optimal performance:
- Parallel execution (multiple workers)
- Shared browser contexts
- Reused server instances
- Efficient test data seeding

Expected test duration:
- Single test: 5-30 seconds
- Full suite: 5-15 minutes (depending on workers)

## Browser Support

Tests run on:
- ✅ Chromium (Chrome, Edge)
- ✅ Firefox
- ✅ WebKit (Safari)
- ✅ Mobile Chrome
- ✅ Mobile Safari

## Accessibility

All tests verify:
- ✅ Keyboard navigation
- ✅ ARIA labels and roles
- ✅ Screen reader compatibility
- ✅ Focus management
- ✅ Color contrast (with axe)

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Examples](https://playwright.dev/docs/ci)
