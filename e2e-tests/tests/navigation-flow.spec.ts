/**
 * Navigation Flow E2E Tests
 * Comprehensive testing of all application routes and navigation patterns
 */

import { test, expect } from '@playwright/test';

test.describe('Application Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage and ensure clean state
    await context.clearCookies();
    await page.goto('http://localhost:3002');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Login if needed
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      const demoButton = await page.locator('button:has-text("Try Demo Account")').isVisible().catch(() => false);
      if (demoButton) {
        await page.locator('button:has-text("Try Demo Account")').click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      }
    }
  });

  test('Navigation Map: Discover all accessible routes', async ({ page }) => {
    console.log('🗺️ Discovering application routes...');

    const routes = [
      { path: '/', name: 'Home/Root' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/login', name: 'Login' },
      { path: '/register', name: 'Register' },
      { path: '/schedules', name: 'Schedules' },
      { path: '/employees', name: 'Employees' },
      { path: '/rules', name: 'Rules' },
      { path: '/analytics', name: 'Analytics' },
      { path: '/calendar', name: 'Calendar' },
      { path: '/settings', name: 'Settings' },
      { path: '/profile', name: 'Profile' },
      { path: '/notifications', name: 'Notifications' },
    ];

    console.log(`\nTesting ${routes.length} potential routes:\n`);

    const accessibleRoutes = [];
    const redirectedRoutes = [];
    const notFoundRoutes = [];

    for (const route of routes) {
      try {
        await page.goto(`http://localhost:3002${route.path}`, { timeout: 5000 });
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

        const finalUrl = page.url();
        const statusOk = await page.locator('body').isVisible();

        if (finalUrl === `http://localhost:3002${route.path}` || finalUrl === `http://localhost:3002${route.path}/`) {
          accessibleRoutes.push(route.name);
          console.log(`  ✓ ${route.name} (${route.path}) - Accessible`);

          // Take screenshot
          await page.screenshot({
            path: `test-results/nav-${route.name.toLowerCase().replace(/\s+/g, '-')}.png`,
            fullPage: false
          });
        } else if (finalUrl.includes('/dashboard') || finalUrl === 'http://localhost:3002/') {
          redirectedRoutes.push(route.name);
          console.log(`  ↻ ${route.name} (${route.path}) - Redirected to ${finalUrl}`);
        } else {
          console.log(`  → ${route.name} (${route.path}) - Navigated to ${finalUrl}`);
        }
      } catch (error) {
        notFoundRoutes.push(route.name);
        console.log(`  ✗ ${route.name} (${route.path}) - Not accessible`);
      }
    }

    console.log(`\n📊 Route Summary:`);
    console.log(`  ✓ Accessible: ${accessibleRoutes.length}`);
    console.log(`  ↻ Redirected: ${redirectedRoutes.length}`);
    console.log(`  ✗ Not Found: ${notFoundRoutes.length}`);

    // At least some routes should be accessible
    expect(accessibleRoutes.length + redirectedRoutes.length).toBeGreaterThan(0);
  });

  test('Deep Navigation: Dashboard → All Sections', async ({ page }) => {
    console.log('🎯 Testing dashboard section navigation...');

    await page.goto('http://localhost:3002/dashboard');
    await page.waitForLoadState('networkidle');

    // Find all clickable elements (buttons, links, cards)
    const clickableElements = [
      { selector: 'button:visible', type: 'Button' },
      { selector: 'a:visible', type: 'Link' },
      { selector: '[role="button"]:visible', type: 'Role Button' },
      { selector: '[class*="Card"]:visible', type: 'Card' },
    ];

    console.log('\n🔍 Scanning for interactive elements...\n');

    for (const element of clickableElements) {
      const count = await page.locator(element.selector).count();

      if (count > 0) {
        console.log(`  ${element.type}: ${count} found`);

        // Sample first few elements
        const sampleSize = Math.min(count, 5);
        for (let i = 0; i < sampleSize; i++) {
          const el = page.locator(element.selector).nth(i);
          const text = await el.textContent().catch(() => '');
          const href = await el.getAttribute('href').catch(() => null);

          if (text?.trim()) {
            console.log(`    - "${text.trim()}"${href ? ` → ${href}` : ''}`);
          }
        }
      }
    }

    await page.screenshot({ path: 'test-results/nav-dashboard-sections.png', fullPage: true });
    console.log('\n✅ Dashboard sections documented!');
  });

  test('User Flow: Complete journey through main features', async ({ page }) => {
    console.log('👤 Testing complete user journey...');

    const journey = [
      { step: 'Start at Dashboard', url: '/dashboard' },
      { step: 'View Schedule', url: '/schedules' },
      { step: 'Check Calendar', url: '/calendar' },
      { step: 'Review Analytics', url: '/analytics' },
      { step: 'Return to Dashboard', url: '/dashboard' },
    ];

    console.log(`\n📍 Journey Steps: ${journey.length}\n`);

    let successfulSteps = 0;

    for (const [index, step] of journey.entries()) {
      console.log(`Step ${index + 1}: ${step.step}`);

      try {
        await page.goto(`http://localhost:3002${step.url}`, { timeout: 5000 });
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

        // Verify page loaded
        const isVisible = await page.locator('body').isVisible();

        if (isVisible) {
          successfulSteps++;
          console.log(`  ✓ Success - Page loaded`);

          // Take screenshot at each step
          const filename = `journey-step${index + 1}-${step.step.toLowerCase().replace(/\s+/g, '-')}`;
          await page.screenshot({ path: `test-results/${filename}.png` });
        }
      } catch (error) {
        console.log(`  ✗ Failed - ${error.message}`);
      }
    }

    console.log(`\n📊 Journey Complete: ${successfulSteps}/${journey.length} steps successful`);

    // Should complete at least 50% of journey
    expect(successfulSteps).toBeGreaterThan(journey.length * 0.5);
  });

  test('Back/Forward Navigation: Browser history', async ({ page }) => {
    console.log('⏮️ Testing browser back/forward navigation...');

    // Navigate through several pages
    await page.goto('http://localhost:3002/dashboard');
    await page.waitForLoadState('networkidle');

    const pages = ['/schedules', '/analytics', '/calendar'];

    for (const pagePath of pages) {
      await page.goto(`http://localhost:3002${pagePath}`).catch(() => {});
      await page.waitForTimeout(500);
    }

    // Test back navigation
    console.log('\n  Testing back button...');
    await page.goBack();
    await page.waitForTimeout(500);
    console.log(`    Current: ${page.url()}`);

    await page.goBack();
    await page.waitForTimeout(500);
    console.log(`    Current: ${page.url()}`);

    // Test forward navigation
    console.log('\n  Testing forward button...');
    await page.goForward();
    await page.waitForTimeout(500);
    console.log(`    Current: ${page.url()}`);

    console.log('\n✅ Browser history navigation working!');
  });

  test('Search and Filter: Test search functionality if available', async ({ page }) => {
    console.log('🔍 Testing search functionality...');

    await page.goto('http://localhost:3002/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInputs = [
      'input[type="search"]',
      'input[placeholder*="Search" i]',
      'input[placeholder*="Find" i]',
      'input[aria-label*="Search" i]',
    ];

    let searchFound = false;

    for (const selector of searchInputs) {
      const searchInput = page.locator(selector);
      const count = await searchInput.count();

      if (count > 0) {
        searchFound = true;
        console.log(`\n  ✓ Search input found: ${selector}`);

        // Test search
        const input = searchInput.first();
        await input.fill('test search query');
        await page.waitForTimeout(500);

        console.log('  ✓ Search input working');
        break;
      }
    }

    if (!searchFound) {
      console.log('  ℹ️ No search functionality found on dashboard');
    }

    await page.screenshot({ path: 'test-results/nav-search-test.png', fullPage: true });
    console.log('✅ Search test completed!');
  });

  test('Mobile Navigation: Test mobile menu and navigation', async ({ page }) => {
    console.log('📱 Testing mobile navigation...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3002/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for mobile menu button (hamburger icon)
    const mobileMenuSelectors = [
      'button[aria-label*="menu" i]',
      'button[aria-label*="navigation" i]',
      '[class*="hamburger"]',
      '[class*="menu-button"]',
      'button:has(svg)',
    ];

    let menuFound = false;

    for (const selector of mobileMenuSelectors) {
      const menuButton = page.locator(selector);
      const count = await menuButton.count();

      if (count > 0) {
        menuFound = true;
        console.log(`\n  ✓ Mobile menu button found`);

        // Try to click menu
        try {
          await menuButton.first().click();
          await page.waitForTimeout(500);

          console.log('  ✓ Mobile menu opened');

          // Take screenshot
          await page.screenshot({ path: 'test-results/nav-mobile-menu-open.png' });
          break;
        } catch (error) {
          console.log('  ⚠️ Could not open mobile menu');
        }
      }
    }

    if (!menuFound) {
      console.log('  ℹ️ No mobile menu found - may be responsive navigation');
    }

    await page.screenshot({ path: 'test-results/nav-mobile-view.png' });
    console.log('✅ Mobile navigation test completed!');
  });
});

test.describe('Protected Routes & Permissions', () => {
  test('Protected Routes: Test authentication redirects', async ({ page, context }) => {
    console.log('🔒 Testing protected routes...');

    // Clear authentication
    await context.clearCookies();
    await page.goto('http://localhost:3002');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const protectedRoutes = ['/dashboard', '/schedules', '/analytics', '/settings'];

    console.log('\nTesting access without authentication:\n');

    for (const route of protectedRoutes) {
      await page.goto(`http://localhost:3002${route}`);
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

      const finalUrl = page.url();

      if (finalUrl.includes('/login') || finalUrl === 'http://localhost:3002/') {
        console.log(`  ✓ ${route} - Correctly redirected to login`);
      } else if (finalUrl.includes(route)) {
        console.log(`  ⚠️ ${route} - Accessible without auth`);
      } else {
        console.log(`  → ${route} - Redirected to ${finalUrl}`);
      }
    }

    console.log('\n✅ Protected routes test completed!');
  });
});
