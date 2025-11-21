const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  console.log('🔍 Checking Dashboard Component Rendering\n');

  // Navigate
  await page.goto('http://localhost:3002/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Get all text content
  const bodyText = await page.locator('body').textContent();
  console.log('📄 All visible text on page:');
  console.log(bodyText);
  console.log('\n');

  // Check React DevTools data
  const reactData = await page.evaluate(() => {
    const root = document.getElementById('root');
    return {
      rootHTML: root?.innerHTML?.substring(0, 500),
      mainHTML: document.querySelector('main')?.innerHTML?.substring(0, 500),
      hasReactRoot: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    };
  });

  console.log('🔍 React Data:');
  console.log('  Has React DevTools Hook:', reactData.hasReactRoot);
  console.log('  Root HTML (first 500 chars):', reactData.rootHTML);
  console.log('  Main HTML (first 500 chars):', reactData.mainHTML);

  await browser.close();
})();
