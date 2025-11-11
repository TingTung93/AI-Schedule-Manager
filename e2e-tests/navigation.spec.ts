import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate through main pages', async ({ page }) => {
    await page.goto('/');

    // Login page is default
    await expect(page).toHaveURL(/\/(login)?$/);

    // Navigate to register
    await page.getByRole('link', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // Navigate back to login
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should display responsive navigation', async ({ page }) => {
    await page.goto('/');

    // Check for main navigation elements
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should display 404 page for invalid routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    // Check for 404 or redirect to login (depending on implementation)
    const is404 = await page.getByText(/404|not found/i).isVisible().catch(() => false);
    const isLogin = await page.getByRole('heading', { name: /sign in/i }).isVisible().catch(() => false);

    expect(is404 || isLogin).toBeTruthy();
  });
});
