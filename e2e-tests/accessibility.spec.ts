import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('login page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/login');

    // Check for form labels
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Check for buttons with accessible names
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('register page should have proper ARIA labels', async ({ page }) => {
    await page.goto('/register');

    // Check all form fields have labels
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Check password toggle is accessible
    const toggleButton = page.getByRole('button', { name: /show password/i }).first();
    await expect(toggleButton).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login');

    // Tab through form fields
    await page.keyboard.press('Tab'); // Focus on email
    const emailFocus = await page.getByLabel(/email/i).evaluate(el => el === document.activeElement);
    expect(emailFocus).toBeTruthy();

    await page.keyboard.press('Tab'); // Focus on password
    const passwordFocus = await page.getByLabel(/password/i).evaluate(el => el === document.activeElement);
    expect(passwordFocus).toBeTruthy();
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    // Check for main heading
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThanOrEqual(1);

    // Ensure there's only one h1
    expect(h1).toBeLessThanOrEqual(1);
  });
});
