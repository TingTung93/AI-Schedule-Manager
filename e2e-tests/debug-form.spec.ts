import { test, expect } from '@playwright/test';

test('Debug form submission behavior', async ({ page }) => {
  // Capture console messages and errors
  page.on('console', msg => console.log('[CONSOLE]:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('[PAGE ERROR]:', error.message));

  // Login
  console.log('[TEST] Logging in...');
  await page.goto('http://localhost:3000/login');
  await page.getByLabel(/email/i).fill('admin@example.com');
  await page.getByLabel(/password/i).fill('Admin123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|employees)/, { timeout: 10000 });
  console.log('[TEST] Login successful');

  // Navigate to employees
  console.log('[TEST] Navigating to employees...');
  await page.goto('http://localhost:3000/employees');
  await page.waitForSelector('[class*="MuiCard-root"]', { timeout: 10000 });
  console.log('[TEST] Employees page loaded');

  // Open Add Employee dialog
  console.log('[TEST] Opening Add Employee dialog...');
  await page.getByRole('button', { name: /add employee/i }).click();
  await page.getByRole('heading', { name: /add new employee/i }).waitFor({ state: 'visible' });
  console.log('[TEST] Dialog opened');

  // Fill the form
  console.log('[TEST] Filling form...');
  await page.getByLabel(/first name/i).fill('Test');
  await page.getByLabel(/last name/i).fill('Employee');
  await page.getByLabel(/email/i).first().fill(`test${Date.now()}@example.com`);
  await page.getByLabel(/phone/i).fill('555-0123');

  // Select role
  await page.getByLabel(/role/i).click();
  await page.getByRole('option', { name: /employee/i }).click();

  // Select department
  await page.getByLabel(/department/i).click();
  await page.waitForTimeout(500);
  await page.getByRole('option').first().click();

  await page.getByLabel(/hire date/i).fill('2024-01-01');
  console.log('[TEST] Form filled');

  // Click submit and observe
  console.log('[TEST] Clicking submit button...');
  const submitButton = page.getByRole('button', { name: /(add|update) employee/i });

  // Check if button exists
  const buttonCount = await submitButton.count();
  console.log('[TEST] Submit button count:', buttonCount);

  if (buttonCount > 0) {
    console.log('[TEST] Button text:', await submitButton.textContent());

    // Set up network monitoring
    let apiResponse: any = null;
    page.on('response', response => {
      if (response.url().includes('/api/employees')) {
        console.log('[TEST] API Response:', response.status(), response.url());
        apiResponse = { status: response.status(), url: response.url() };
      }
    });

    await submitButton.click();
    console.log('[TEST] Submit button clicked');

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    if (apiResponse) {
      console.log('[TEST] API call completed:', apiResponse.status);
    } else {
      console.log('[TEST] ⚠️  No API call detected!');
    }

    // Check if dialog is still visible
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    console.log('[TEST] Dialog still visible after 2s:', dialogVisible);

    // Check if button is still visible
    const buttonVisible = await submitButton.isVisible();
    console.log('[TEST] Submit button still visible after 2s:', buttonVisible);

    // Check for notifications
    const notification = page.locator('[class*="MuiAlert"]');
    const notificationVisible = await notification.isVisible();
    console.log('[TEST] Notification visible:', notificationVisible);
    if (notificationVisible) {
      console.log('[TEST] Notification text:', await notification.textContent());
    }

    // Wait longer and check again
    await page.waitForTimeout(3000);
    const dialogVisible2 = await page.locator('[role="dialog"]').isVisible();
    console.log('[TEST] Dialog still visible after 5s:', dialogVisible2);

    // Try to wait for dialog to close (with timeout)
    try {
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
      console.log('[TEST] ✅ Dialog closed successfully!');
    } catch (e) {
      console.log('[TEST] ❌ Dialog did NOT close within 5 seconds');
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/dialog-not-closing.png' });
    }
  } else {
    console.log('[TEST] ❌ Submit button not found!');
  }
});
