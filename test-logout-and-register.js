const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(`ERROR: ${error.message}`);
  });

  console.log('🔍 Testing Logout and Registration Flow\n');

  // First, logout to clear the session
  console.log('📍 Step 1: Logging out...');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Try to find and click logout button
  try {
    const logoutButton = page.locator('text=/logout/i, [aria-label*="logout" i]').first();
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForTimeout(1000);
      console.log('  ✓ Logged out successfully');
    }
  } catch (err) {
    console.log('  ⚠️  Could not find logout button, clearing cookies instead');
  }

  // Clear cookies to ensure logout
  await context.clearCookies();
  console.log('  ✓ Cleared cookies');

  // Navigate to registration page
  console.log('\n📍 Step 2: Navigating to registration page...');
  await page.goto('http://localhost:3002/register', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log(`Current URL: ${page.url()}`);

  // Check if we're on the registration page
  if (page.url().includes('/register')) {
    console.log('  ✓ Registration page loaded');

    // Check for form elements
    const formChecks = {
      'First name input': await page.locator('input[name="firstName"], input[placeholder*="first" i]').count(),
      'Last name input': await page.locator('input[name="lastName"], input[placeholder*="last" i]').count(),
      'Email input': await page.locator('input[type="email"], input[name="email"]').count(),
      'Password inputs': await page.locator('input[type="password"]').count(),
      'Submit button': await page.locator('button[type="submit"]').count()
    };

    console.log('\n📋 Form Elements:');
    Object.entries(formChecks).forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });

    // Try to fill and submit registration form
    console.log('\n🧪 Attempting registration...');
    try {
      // Fill first name
      const firstNameInput = page.locator('input[name="firstName"], input[placeholder*="first" i]').first();
      if (await firstNameInput.count() > 0) {
        await firstNameInput.fill('Test');
        console.log('  ✓ Filled first name');
      }

      // Fill last name
      const lastNameInput = page.locator('input[name="lastName"], input[placeholder*="last" i]').first();
      if (await lastNameInput.count() > 0) {
        await lastNameInput.fill('User');
        console.log('  ✓ Filled last name');
      }

      // Fill email
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      if (await emailInput.count() > 0) {
        await emailInput.fill('testuser@example.com');
        console.log('  ✓ Filled email');
      }

      // Fill passwords
      const passwordInputs = page.locator('input[type="password"]');
      const passwordCount = await passwordInputs.count();
      if (passwordCount >= 2) {
        await passwordInputs.nth(0).fill('TestPassword123!');
        await passwordInputs.nth(1).fill('TestPassword123!');
        console.log('  ✓ Filled passwords');
      }

      // Check for role/department fields
      const roleSelect = page.locator('select[name="role"], [role="combobox"]');
      if (await roleSelect.count() > 0) {
        console.log('  ℹ️  Role selection field found');
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.count() > 0) {
        console.log('  🔘 Clicking submit button...');
        await submitButton.click();
        await page.waitForTimeout(3000);

        const afterSubmitUrl = page.url();
        console.log(`  Current URL after submit: ${afterSubmitUrl}`);

        if (afterSubmitUrl.includes('/dashboard')) {
          console.log('  ✅ Registration successful - redirected to dashboard');
        } else if (afterSubmitUrl.includes('/register')) {
          console.log('  ⚠️  Still on registration page - check for errors');

          // Check for error messages
          const errorMessages = await page.locator('[role="alert"], .error, [class*="error" i]').allTextContents();
          if (errorMessages.length > 0) {
            console.log('  Error messages:');
            errorMessages.forEach(msg => console.log(`    - ${msg}`));
          }
        }
      }
    } catch (err) {
      console.log(`  ❌ Registration error: ${err.message}`);
    }
  } else {
    console.log('  ❌ Not on registration page - redirected to:', page.url());
  }

  // Show recent console logs
  console.log('\n📋 Recent Console Logs (last 20):');
  logs.slice(-20).forEach(log => console.log(`  ${log}`));

  // Show errors
  console.log('\n❌ JavaScript Errors:');
  if (errors.length > 0) {
    errors.forEach(error => console.log(`  ${error}`));
  } else {
    console.log('  No JavaScript errors');
  }

  await page.screenshot({ path: 'registration-flow-test.png', fullPage: true });
  console.log('\n📸 Screenshot saved: registration-flow-test.png');

  await browser.close();
  console.log('\n✅ Test complete');
})();
