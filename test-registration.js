const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  const networkRequests = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    logs.push(`[${type}] ${text}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(`ERROR: ${error.message}\n${error.stack}`);
  });

  // Capture network requests
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      type: 'request'
    });
  });

  page.on('response', async response => {
    networkRequests.push({
      url: response.url(),
      method: response.request().method(),
      status: response.status(),
      type: 'response'
    });
  });

  console.log('🔍 Testing Registration Flow\n');

  // Test registration page
  console.log('📍 Navigating to registration page...');
  await page.goto('http://localhost:3002/register', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log(`Current URL: ${page.url()}`);

  // Check for form elements
  const formElements = {
    'Email input': await page.locator('input[type="email"], input[name="email"]').count(),
    'Password input': await page.locator('input[type="password"]').count(),
    'Submit button': await page.locator('button[type="submit"]').count(),
    'Register button': await page.locator('button:has-text("Register"), button:has-text("Sign Up")').count()
  };

  console.log('\n📋 Form Elements:');
  Object.entries(formElements).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });

  // Try to fill and submit registration form
  console.log('\n🧪 Attempting to fill registration form...');
  try {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInputs = page.locator('input[type="password"]');

    if (await emailInput.count() > 0) {
      await emailInput.fill('test@example.com');
      console.log('  ✓ Filled email');
    }

    if (await passwordInputs.count() >= 2) {
      await passwordInputs.nth(0).fill('TestPassword123!');
      await passwordInputs.nth(1).fill('TestPassword123!');
      console.log('  ✓ Filled passwords');
    }

    // Check for name fields
    const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"]');
    if (await firstNameInput.count() > 0) {
      await firstNameInput.fill('Test');
      console.log('  ✓ Filled first name');
    }

    const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"]');
    if (await lastNameInput.count() > 0) {
      await lastNameInput.fill('User');
      console.log('  ✓ Filled last name');
    }

    // Try to submit
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.count() > 0) {
      console.log('  🔘 Clicking submit button...');
      await submitButton.click();
      await page.waitForTimeout(2000);

      console.log(`  Current URL after submit: ${page.url()}`);
    }
  } catch (err) {
    console.log(`  ❌ Error during form interaction: ${err.message}`);
  }

  // Test dashboard page
  console.log('\n📍 Testing dashboard page...');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const dashboardElements = {
    'Welcome message': await page.locator('text=/Welcome back/i').count(),
    'MUI Cards': await page.locator('[class*="MuiCard"]').count(),
    'Quick Actions': await page.locator('text=/Quick Actions/i').count(),
    'Weekly Progress': await page.locator('text=/Weekly Progress/i').count()
  };

  console.log('\n📊 Dashboard Elements:');
  Object.entries(dashboardElements).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });

  // Show console logs
  console.log('\n📋 Console Logs:');
  if (logs.length > 0) {
    logs.slice(0, 30).forEach(log => console.log(`  ${log}`));
    if (logs.length > 30) {
      console.log(`  ... and ${logs.length - 30} more logs`);
    }
  } else {
    console.log('  No console messages');
  }

  // Show errors
  console.log('\n❌ JavaScript Errors:');
  if (errors.length > 0) {
    errors.forEach(error => console.log(`  ${error}`));
  } else {
    console.log('  No JavaScript errors');
  }

  // Show failed network requests
  console.log('\n🌐 Failed Network Requests:');
  const failedRequests = networkRequests.filter(req =>
    req.type === 'response' && req.status >= 400
  );
  if (failedRequests.length > 0) {
    failedRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    });
  } else {
    console.log('  No failed requests');
  }

  await page.screenshot({ path: 'registration-test.png', fullPage: true });
  console.log('\n📸 Screenshot saved: registration-test.png');

  await browser.close();
  console.log('\n✅ Test complete');
})();
