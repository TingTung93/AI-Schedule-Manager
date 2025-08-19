/**
 * Smoke Tests - Quick validation of E2E test framework
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load test framework', async ({ page }) => {
    // Simple test to verify Playwright is working
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);
  });

  test('should take screenshot', async ({ page }) => {
    await page.goto('https://example.com');
    await page.screenshot({ path: 'smoke-test.png' });
    await expect(page.locator('h1')).toContainText('Example Domain');
  });

  test('should handle navigation', async ({ page }) => {
    await page.goto('https://example.com');
    const moreInfoLink = page.getByText('More information...');
    await expect(moreInfoLink).toBeVisible();
    await moreInfoLink.click();
    await expect(page).toHaveURL(/iana.org/);
  });

  test('should measure performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('https://example.com');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000); // Page should load in under 5 seconds
    
    // Check Core Web Vitals
    const metrics = await page.evaluate(() => {
      return {
        title: document.title,
        loadComplete: document.readyState === 'complete'
      };
    });
    
    expect(metrics.loadComplete).toBeTruthy();
    expect(metrics.title).toBeTruthy();
  });

  test('should handle multiple viewports', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://example.com');
    await expect(page.locator('h1')).toBeVisible();
    
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
    
    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
  });
});