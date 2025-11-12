/**
 * Dashboard Debug Test
 * Captures console errors and page state
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Debug', () => {
  test('capture console errors and page state', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errors: string[] = [];

    // Listen for console messages
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Listen for page errors
    page.on('pageerror', error => {
      errors.push(`PAGE ERROR: ${error.message}\n${error.stack}`);
    });

    // Navigate to dashboard
    await page.goto('http://localhost:3002/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Log all console messages
    console.log('\n📋 Console Messages:');
    consoleMessages.forEach(msg => console.log(`  ${msg}`));

    // Log all errors
    console.log('\n❌ Page Errors:');
    if (errors.length > 0) {
      errors.forEach(err => console.log(`  ${err}`));
    } else {
      console.log('  No page errors detected');
    }

    // Check what's actually in the DOM
    const bodyText = await page.locator('body').textContent();
    console.log('\n📄 Body Text Content:');
    console.log(bodyText);

    // Check if main content area exists
    const mainContent = page.locator('main, [role="main"]');
    const hasMain = await mainContent.count() > 0;
    console.log(`\n🔍 Main content area exists: ${hasMain}`);

    if (hasMain) {
      const mainText = await mainContent.textContent();
      console.log(`Main content text: "${mainText}"`);
      console.log(`Main content empty: ${mainText?.trim().length === 0}`);
    }

    // Check for dashboard-specific elements
    const welcomeText = await page.locator('text=/Welcome back/i').count();
    const statsCards = await page.locator('[class*="Card"], [class*="card"]').count();
    const quickActions = await page.locator('text=/Quick Actions/i').count();

    console.log('\n🎯 Dashboard Elements:');
    console.log(`  Welcome message: ${welcomeText}`);
    console.log(`  Cards found: ${statsCards}`);
    console.log(`  Quick Actions: ${quickActions}`);

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-debug.png', fullPage: true });
  });
});
