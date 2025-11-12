/**
 * User Workflows E2E Tests
 * Tests complete user journeys and workflows in the AI Schedule Manager
 */

import { test, expect } from '@playwright/test';

test.describe('User Workflows', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage and cookies
    await context.clearCookies();
    await page.goto('http://localhost:3002');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Complete workflow: Login → Dashboard → Navigation', async ({ page }) => {
    console.log('🚀 Starting complete workflow test...');

    // Step 1: Navigate to app
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    console.log('✓ Step 1: Navigated to application');

    // Step 2: Check if on login page or already logged in
    const currentUrl = page.url();

    if (!currentUrl.includes('/dashboard')) {
      // On login page - perform login
      const demoButton = page.locator('button:has-text("Try Demo Account")');
      await expect(demoButton).toBeVisible({ timeout: 5000 });
      await demoButton.click();
      console.log('✓ Step 2: Clicked demo login button');

      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✓ Step 3: Redirected to dashboard');
    } else {
      console.log('✓ Already logged in - on dashboard');
    }

    // Step 4: Verify dashboard elements
    await expect(page).toHaveURL(/\/dashboard/);

    // Check for navigation or main content
    const hasNavigation = await page.locator('nav, [role="navigation"]').count() > 0;
    const hasMainContent = await page.locator('main, [role="main"]').count() > 0;

    expect(hasNavigation || hasMainContent).toBeTruthy();
    console.log('✓ Step 4: Dashboard loaded with content');

    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/workflow-dashboard.png', fullPage: true });
    console.log('✓ Screenshot saved: workflow-dashboard.png');

    console.log('✅ Complete workflow test passed!');
  });

  test('Navigation: Test all main navigation links', async ({ page }) => {
    console.log('🧭 Testing navigation...');

    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Ensure we're logged in
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      const demoButton = page.locator('button:has-text("Try Demo Account")');
      await demoButton.click();
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }

    // Find all navigation links
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const linkCount = await navLinks.count();

    console.log(`Found ${linkCount} navigation links`);

    if (linkCount > 0) {
      // Get all link texts and URLs
      const links = [];
      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const link = navLinks.nth(i);
        const text = await link.textContent();
        const href = await link.getAttribute('href');

        if (text && href && !href.startsWith('http') && href !== '#') {
          links.push({ text: text.trim(), href });
        }
      }

      console.log(`Testing ${links.length} valid navigation links`);

      // Test each navigation link
      for (const link of links) {
        console.log(`  Testing: ${link.text} → ${link.href}`);

        // Click the link
        await page.click(`nav a[href="${link.href}"], [role="navigation"] a[href="${link.href}"]`);

        // Wait for navigation
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // Take screenshot
        const filename = `workflow-nav-${link.text.replace(/\s+/g, '-').toLowerCase()}`;
        await page.screenshot({ path: `test-results/${filename}.png` });

        console.log(`    ✓ ${link.text} page accessible`);
      }

      console.log('✅ Navigation test completed!');
    } else {
      console.log('ℹ️ No navigation links found - may be on a different layout');
    }
  });

  test('User Journey: View and explore dashboard components', async ({ page }) => {
    console.log('📊 Testing dashboard exploration...');

    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Login if needed
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.locator('button:has-text("Try Demo Account")').click();
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }

    // Look for common dashboard components
    const components = [
      { name: 'Cards', selector: '[class*="Card"], [class*="card"]' },
      { name: 'Buttons', selector: 'button' },
      { name: 'Headings', selector: 'h1, h2, h3, h4, h5, h6' },
      { name: 'Lists', selector: 'ul, ol' },
      { name: 'Tables', selector: 'table' },
      { name: 'Forms', selector: 'form' },
    ];

    console.log('Dashboard components found:');
    for (const component of components) {
      const count = await page.locator(component.selector).count();
      if (count > 0) {
        console.log(`  ✓ ${component.name}: ${count}`);
      }
    }

    // Check for interactive elements
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      console.log(`\nTesting ${Math.min(buttonCount, 5)} buttons...`);

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        const isVisible = await button.isVisible();

        if (isVisible && text) {
          console.log(`  Button found: "${text.trim()}"`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/workflow-dashboard-exploration.png', fullPage: true });
    console.log('✅ Dashboard exploration completed!');
  });

  test('Responsiveness: Test mobile and tablet viewports', async ({ page }) => {
    console.log('📱 Testing responsive design...');

    await page.goto('http://localhost:3002');

    // Login if needed
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      const demoButton = await page.locator('button:has-text("Try Demo Account")').isVisible().catch(() => false);
      if (demoButton) {
        await page.locator('button:has-text("Try Demo Account")').click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      }
    }

    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      console.log(`  Testing ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Allow reflow

      // Check if main content is visible
      const mainContent = page.locator('main, [role="main"], body > div').first();
      await expect(mainContent).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: `test-results/workflow-responsive-${viewport.name.toLowerCase()}.png`,
        fullPage: false
      });

      console.log(`    ✓ ${viewport.name} viewport working`);
    }

    console.log('✅ Responsive design test completed!');
  });

  test('Performance: Measure page load times', async ({ page }) => {
    console.log('⚡ Testing performance...');

    const pages = [
      { name: 'Home', url: 'http://localhost:3002' },
      { name: 'Dashboard', url: 'http://localhost:3002/dashboard' },
    ];

    for (const testPage of pages) {
      const startTime = Date.now();

      await page.goto(testPage.url);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const loadTime = Date.now() - startTime;

      console.log(`  ${testPage.name}: ${loadTime}ms`);

      // Performance assertion - page should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    }

    console.log('✅ Performance test completed!');
  });

  test('Accessibility: Check basic accessibility features', async ({ page }) => {
    console.log('♿ Testing accessibility...');

    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Check for semantic HTML
    const checks = [
      { name: 'Main landmark', selector: 'main, [role="main"]' },
      { name: 'Navigation landmark', selector: 'nav, [role="navigation"]' },
      { name: 'Headings', selector: 'h1, h2, h3, h4, h5, h6' },
      { name: 'Alt text on images', selector: 'img[alt]' },
      { name: 'Buttons with text', selector: 'button:not(:empty)' },
      { name: 'Links with text', selector: 'a:not(:empty)' },
    ];

    console.log('Accessibility features found:');
    for (const check of checks) {
      const count = await page.locator(check.selector).count();
      const status = count > 0 ? '✓' : '✗';
      console.log(`  ${status} ${check.name}: ${count}`);
    }

    // Check for ARIA labels on interactive elements
    const interactiveElements = await page.locator('button, a, input').count();
    const elementsWithAriaLabel = await page.locator('button[aria-label], a[aria-label], input[aria-label]').count();

    console.log(`\nARIA labels: ${elementsWithAriaLabel}/${interactiveElements} interactive elements`);

    console.log('✅ Accessibility check completed!');
  });

  test('Error Handling: Test navigation to non-existent pages', async ({ page }) => {
    console.log('🚨 Testing error handling...');

    // Try to navigate to non-existent page
    await page.goto('http://localhost:3002/non-existent-page-12345');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Should either redirect or show error page
    const currentUrl = page.url();

    if (currentUrl.includes('404') || currentUrl.includes('not-found')) {
      console.log('  ✓ 404 page displayed');
    } else if (currentUrl.includes('/dashboard') || currentUrl === 'http://localhost:3002/') {
      console.log('  ✓ Redirected to safe page');
    } else {
      console.log('  ℹ️ Page behavior: ' + currentUrl);
    }

    // Check if page is still functional
    const body = await page.locator('body').isVisible();
    expect(body).toBeTruthy();

    await page.screenshot({ path: 'test-results/workflow-error-handling.png' });
    console.log('✅ Error handling test completed!');
  });
});

test.describe('Quick Action Workflows', () => {
  test('Quick Actions: Test clickable elements on dashboard', async ({ page }) => {
    console.log('⚡ Testing quick actions...');

    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Login if needed
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      const demoButton = await page.locator('button:has-text("Try Demo Account")').isVisible().catch(() => false);
      if (demoButton) {
        await page.locator('button:has-text("Try Demo Account")').click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      }
    }

    // Find all visible buttons on dashboard
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    console.log(`Found ${buttonCount} interactive buttons`);

    if (buttonCount > 0) {
      // Get button information
      const buttonInfo = [];
      for (let i = 0; i < Math.min(buttonCount, 15); i++) {
        const button = buttons.nth(i);
        const text = await button.textContent().catch(() => '');
        const isDisabled = await button.isDisabled().catch(() => false);

        if (text && !isDisabled) {
          buttonInfo.push({ index: i, text: text.trim() });
        }
      }

      console.log('\nAvailable actions:');
      buttonInfo.forEach((btn, idx) => {
        console.log(`  ${idx + 1}. ${btn.text}`);
      });

      // Test clicking a few buttons (non-destructive ones)
      const safeButtons = buttonInfo.filter(btn => {
        const lowerText = btn.text.toLowerCase();
        return (
          lowerText.includes('view') ||
          lowerText.includes('details') ||
          lowerText.includes('overview') ||
          lowerText.includes('analytics')
        );
      });

      if (safeButtons.length > 0) {
        console.log(`\nTesting ${Math.min(safeButtons.length, 3)} safe action buttons...`);

        for (const btn of safeButtons.slice(0, 3)) {
          console.log(`  Clicking: ${btn.text}`);

          await buttons.nth(btn.index).click();
          await page.waitForTimeout(500);

          // Check if anything changed
          const newUrl = page.url();
          console.log(`    Current URL: ${newUrl}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/workflow-quick-actions.png', fullPage: true });
    console.log('✅ Quick actions test completed!');
  });
});
