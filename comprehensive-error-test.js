const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const networkErrors = [];
  const consoleWarnings = [];

  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      consoleErrors.push(text);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  // Capture network failures
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      });
    }
  });

  console.log('🔍 Comprehensive Error Detection Test\n');

  // Test 1: Dashboard functionality
  console.log('📍 Test 1: Dashboard Page');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Try to interact with dashboard elements
  try {
    // Click on a quick action card
    const quickActionCard = page.locator('[class*="MuiCard"]').first();
    if (await quickActionCard.count() > 0) {
      await quickActionCard.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Clicked quick action card');
    }
  } catch (err) {
    console.log(`  ❌ Error clicking card: ${err.message}`);
  }

  // Test 2: Navigation
  console.log('\n📍 Test 2: Navigation');
  const pages = [
    { name: 'Employees', path: '/employees' },
    { name: 'Schedule', path: '/schedule' },
    { name: 'Rules', path: '/rules' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Settings', path: '/settings' },
    { name: 'Profile', path: '/profile' }
  ];

  for (const testPage of pages) {
    try {
      await page.goto(`http://localhost:3002${testPage.path}`, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      if (currentUrl.includes(testPage.path)) {
        console.log(`  ✓ ${testPage.name} page loaded`);
      } else {
        console.log(`  ⚠️  ${testPage.name} redirected to: ${currentUrl}`);
      }
    } catch (err) {
      console.log(`  ❌ ${testPage.name} page error: ${err.message}`);
    }
  }

  // Test 3: Form interactions
  console.log('\n📍 Test 3: Form Interactions');
  await page.goto('http://localhost:3002/employees', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  try {
    // Look for add button
    const addButton = page.locator('button:has-text("Add"), button:has-text("New")').first();
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Clicked add button');
    } else {
      console.log('  ℹ️  No add button found');
    }
  } catch (err) {
    console.log(`  ❌ Form interaction error: ${err.message}`);
  }

  // Test 4: API calls
  console.log('\n📍 Test 4: API Functionality');
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 ERROR SUMMARY');
  console.log('═══════════════════════════════════════\n');

  console.log(`❌ Console Errors (${consoleErrors.length}):`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 10).forEach(error => {
      console.log(`  • ${error}`);
    });
    if (consoleErrors.length > 10) {
      console.log(`  ... and ${consoleErrors.length - 10} more`);
    }
  } else {
    console.log('  None');
  }

  console.log(`\n⚠️  Console Warnings (${consoleWarnings.length}):`);
  if (consoleWarnings.length > 0) {
    consoleWarnings.slice(0, 10).forEach(warning => {
      console.log(`  • ${warning}`);
    });
    if (consoleWarnings.length > 10) {
      console.log(`  ... and ${consoleWarnings.length - 10} more`);
    }
  } else {
    console.log('  None');
  }

  console.log(`\n💥 Page Errors (${pageErrors.length}):`);
  if (pageErrors.length > 0) {
    pageErrors.forEach(error => {
      console.log(`  • ${error.message}`);
      if (error.stack) {
        console.log(`    ${error.stack.split('\n')[0]}`);
      }
    });
  } else {
    console.log('  None');
  }

  console.log(`\n🌐 Network Errors (${networkErrors.length}):`);
  if (networkErrors.length > 0) {
    networkErrors.forEach(error => {
      console.log(`  • ${error.method} ${error.url} - Status ${error.status}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n═══════════════════════════════════════');

  if (consoleErrors.length === 0 && pageErrors.length === 0 && networkErrors.length === 0) {
    console.log('✅ No critical errors detected!');
  } else {
    console.log('⚠️  Issues detected - see details above');
  }

  await page.screenshot({ path: 'error-detection-test.png', fullPage: true });
  console.log('\n📸 Screenshot saved: error-detection-test.png');

  await browser.close();
  console.log('\n✅ Test complete');
})();
