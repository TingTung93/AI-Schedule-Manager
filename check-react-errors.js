const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  const logs = [];
  const errors = [];

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Execute code in browser to check for React
  const reactCheck = await page.evaluate(() => {
    const errors = [];

    // Check if React is loaded
    if (typeof window.React === 'undefined') {
      errors.push('React not found in window object');
    }

    // Check React root
    const root = document.getElementById('root');
    if (!root) {
      errors.push('No #root element found');
    } else {
      const hasChildren = root.children.length > 0;
      errors.push(`Root has ${root.children.length} children`);

      // Get first few layers of HTML
      const firstChild = root.children[0];
      if (firstChild) {
        errors.push(`First child: ${firstChild.className}`);

        // Look for main content
        const main = root.querySelector('main');
        if (main) {
          errors.push(`Main element found, innerHTML length: ${main.innerHTML.length}`);
          errors.push(`Main has ${main.children.length} children`);

          // Check for dashboard specific elements
          const welcomeMsg = root.textContent.includes('Welcome');
          const dashboardTitle = root.textContent.includes('Dashboard');
          errors.push(`Contains 'Welcome': ${welcomeMsg}`);
          errors.push(`Contains 'Dashboard': ${dashboardTitle}`);
        } else {
          errors.push('No main element found');
        }
      }
    }

    return errors;
  });

  console.log('\n🔍 React Check Results:');
  reactCheck.forEach(msg => console.log(`  ${msg}`));

  console.log('\n📋 Console Logs:');
  logs.forEach(log => console.log(`  ${log}`));

  console.log('\n❌ JavaScript Errors:');
  if (errors.length > 0) {
    errors.forEach(err => console.log(`  ${err}`));
  } else {
    console.log('  None');
  }

  await browser.close();
})();
