const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(`ERROR: ${error.message}`);
  });

  console.log('🔍 Detailed Dashboard Debug\n');

  // Navigate
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check URL
  const currentURL = page.url();
  console.log(`📍 Current URL: ${currentURL}`);

  // Check for React root
  const reactRoot = await page.locator('#root').innerHTML();
  console.log(`\n📦 React Root HTML Length: ${reactRoot.length} characters`);
  console.log(`📦 React Root Empty: ${reactRoot.trim() === ''}`);

  // Check for specific components
  const checks = {
    'Layout component': await page.locator('[class*="Layout"]').count() > 0,
    'Main content area': await page.locator('main, [role="main"]').count() > 0,
    'Navigation': await page.locator('nav, [role="navigation"]').count() > 0,
    'Dashboard container': await page.locator('[class*="dashboard" i], [class*="Dashboard" i]').count() > 0,
    'MUI Box components': await page.locator('[class*="MuiBox"]').count(),
    'MUI Card components': await page.locator('[class*="MuiCard"]').count(),
    'Any text content': (await page.locator('body').textContent()).length > 100
  };

  console.log('\n🔍 Component Detection:');
  Object.entries(checks).forEach(([name, result]) => {
    const status = typeof result === 'boolean' ? (result ? '✓' : '✗') : result;
    console.log(`  ${name}: ${status}`);
  });

  // Check for React error boundary
  const errorBoundary = await page.locator('text=/Something went wrong/i, text=/Error/i').count();
  console.log(`\n⚠️  Error Boundary Triggered: ${errorBoundary > 0 ? 'YES' : 'NO'}`);

  // Log console messages
  console.log('\n📋 Console Logs:');
  if (logs.length > 0) {
    logs.forEach(log => console.log(`  ${log}`));
  } else {
    console.log('  No console messages');
  }

  // Log errors
  console.log('\n❌ JavaScript Errors:');
  if (errors.length > 0) {
    errors.forEach(error => console.log(`  ${error}`));
  } else {
    console.log('  No JavaScript errors');
  }

  // Take screenshot
  await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });
  console.log('\n📸 Screenshot saved: debug-dashboard.png');

  await browser.close();
  console.log('\n✅ Debug complete');
})();
