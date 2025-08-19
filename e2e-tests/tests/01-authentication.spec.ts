/**
 * E2E Tests for Authentication Features
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../fixtures/page-objects';
import { testUsers } from '../fixtures/test-data';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Schedule Manager/);
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await loginPage.login('invalid@test.com', 'wrongpassword');
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('should validate email format', async ({ page }) => {
    await loginPage.emailInput.fill('invalid-email');
    await loginPage.passwordInput.fill('password123');
    await loginPage.loginButton.click();
    await expect(page.getByText('Please enter a valid email')).toBeVisible();
  });

  test('should require password', async ({ page }) => {
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.loginButton.click();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL('/dashboard');
    
    // Logout
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL('/login');
    
    // Verify can't access protected routes
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('should handle session timeout', async ({ page }) => {
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Simulate session timeout by clearing cookies
    await page.context().clearCookies();
    
    // Try to navigate to protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Session expired')).toBeVisible();
  });

  test('should support remember me option', async ({ page }) => {
    const rememberCheckbox = page.getByLabel('Remember me');
    await rememberCheckbox.check();
    
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await expect(page).toHaveURL('/dashboard');
    
    // Close and reopen browser context
    await page.context().close();
    const newContext = await page.context().browser()?.newContext();
    const newPage = await newContext!.newPage();
    
    await newPage.goto('/dashboard');
    await expect(newPage).toHaveURL('/dashboard');
  });
});