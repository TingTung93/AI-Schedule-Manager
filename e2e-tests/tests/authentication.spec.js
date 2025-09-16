/**
 * End-to-End Authentication Flow Tests
 * Tests complete authentication workflows using Playwright
 */

const { test, expect } = require('@playwright/test');

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Login Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
      // Navigate to login page
      await page.click('text=Login');
      await expect(page).toHaveURL('/login');

      // Fill login form
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // Submit form
      await page.click('[data-testid="login-button"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('text=Welcome')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.click('text=Login');

      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=Invalid credentials')).toBeVisible();

      // Should remain on login page
      await expect(page).toHaveURL('/login');
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('text=Login');

      // Try to submit without filling fields
      await page.click('[data-testid="login-button"]');

      // Should show validation errors
      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept and fail the login request
      await page.route('/api/auth/login', route => {
        route.abort('failed');
      });

      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      // Should show network error
      await expect(page.locator('text=Network error')).toBeVisible();
    });

    test('should remember login state across sessions', async ({ page, context }) => {
      // Login
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Create new page in same context
      const newPage = await context.newPage();
      await newPage.goto('/');

      // Should automatically redirect to dashboard
      await expect(newPage).toHaveURL('/dashboard');
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.click('text=Login');

      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="email-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="password-input"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="login-button"]')).toBeFocused();

      // Submit with Enter
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.keyboard.press('Enter');

      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');
      await expect(page).toHaveURL('/dashboard');
    });

    test('should logout successfully', async ({ page }) => {
      // Click user menu
      await page.click('[data-testid="user-menu"]');

      // Click logout
      await page.click('[data-testid="logout-button"]');

      // Should redirect to login page
      await expect(page).toHaveURL('/login');

      // Should not be able to access protected pages
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login');
    });

    test('should clear authentication state on logout', async ({ page, context }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Create new page to verify state is cleared
      const newPage = await context.newPage();
      await newPage.goto('/dashboard');

      // Should redirect to login
      await expect(newPage).toHaveURL('/login');
    });

    test('should handle logout errors gracefully', async ({ page }) => {
      // Intercept and fail logout request
      await page.route('/api/auth/logout', route => {
        route.abort('failed');
      });

      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Should still logout locally even if server request fails
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      const protectedRoutes = [
        '/dashboard',
        '/schedules',
        '/employees',
        '/rules',
        '/analytics'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL('/login');
      }
    });

    test('should allow authenticated users to access protected routes', async ({ page }) => {
      // Login first
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      const protectedRoutes = [
        '/dashboard',
        '/schedules',
        '/employees',
        '/rules'
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(route);
        await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      }
    });

    test('should handle expired tokens', async ({ page }) => {
      // Mock expired token scenario
      await page.addInitScript(() => {
        localStorage.setItem('token', 'expired-token');
        localStorage.setItem('user', JSON.stringify({ email: 'test@example.com' }));
      });

      // Intercept API requests and return 401
      await page.route('/api/**', route => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ detail: 'Token expired' })
        });
      });

      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL('/login');

      // Should show expired session message
      await expect(page.locator('text=Session expired')).toBeVisible();
    });
  });

  test.describe('Role-Based Access', () => {
    test('should display manager features for manager role', async ({ page }) => {
      // Login as manager
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Manager should see admin features
      await expect(page.locator('[data-testid="manage-employees"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-settings"]')).toBeVisible();
      await expect(page.locator('[data-testid="analytics-panel"]')).toBeVisible();
    });

    test('should hide admin features for employee role', async ({ page }) => {
      // Login as employee
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'employee@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Employee should not see admin features
      await expect(page.locator('[data-testid="manage-employees"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="system-settings"]')).not.toBeVisible();

      // But should see their own schedule
      await expect(page.locator('[data-testid="my-schedule"]')).toBeVisible();
    });

    test('should prevent unauthorized access to admin pages', async ({ page }) => {
      // Login as employee
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'employee@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      // Try to access admin page
      await page.goto('/admin/users');

      // Should show access denied or redirect
      const isAccessDenied = await page.locator('text=Access denied').isVisible();
      const isRedirected = page.url() !== 'http://localhost:3000/admin/users';

      expect(isAccessDenied || isRedirected).toBeTruthy();
    });
  });

  test.describe('Security Features', () => {
    test('should enforce rate limiting on login attempts', async ({ page }) => {
      await page.click('text=Login');

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');

        // Wait for response
        await page.waitForTimeout(500);
      }

      // Should show rate limit message
      await expect(page.locator('text=Too many login attempts')).toBeVisible();

      // Login button should be disabled
      await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();
    });

    test('should clear sensitive data on browser close', async ({ page, context }) => {
      // Login
      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      // Verify token exists
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();

      // Close context (simulates browser close)
      await context.close();

      // Create new context
      const newContext = await page.context().browser().newContext();
      const newPage = await newContext.newPage();

      await newPage.goto('/dashboard');

      // Should redirect to login (no persistent session)
      await expect(newPage).toHaveURL('/login');

      await newContext.close();
    });

    test('should handle CSRF protection', async ({ page }) => {
      // This test would verify CSRF token handling
      // Implementation depends on your CSRF protection strategy

      await page.click('text=Login');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');

      // Check for CSRF token in form or headers
      const csrfToken = await page.locator('[name="csrf-token"]').getAttribute('value');

      if (csrfToken) {
        expect(csrfToken).toBeTruthy();
        expect(csrfToken.length).toBeGreaterThan(10);
      }

      await page.click('[data-testid="login-button"]');
      await expect(page).toHaveURL('/dashboard');
    });

    test('should enforce secure password requirements', async ({ page }) => {
      // This test assumes a registration or password change form exists
      await page.goto('/register');

      // Test weak passwords
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty'
      ];

      for (const weakPassword of weakPasswords) {
        await page.fill('[data-testid="password-input"]', weakPassword);
        await page.fill('[data-testid="confirm-password-input"]', weakPassword);

        // Should show password strength warning
        await expect(page.locator('[data-testid="password-strength"]')).toContainText('Weak');
      }

      // Test strong password
      await page.fill('[data-testid="password-input"]', 'StrongP@ssw0rd123!');
      await page.fill('[data-testid="confirm-password-input"]', 'StrongP@ssw0rd123!');

      await expect(page.locator('[data-testid="password-strength"]')).toContainText('Strong');
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible to screen readers', async ({ page }) => {
      await page.click('text=Login');

      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="email-input"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="password-input"]')).toHaveAttribute('aria-label');

      // Check for form role
      await expect(page.locator('form')).toHaveAttribute('role', 'form');

      // Check for error announcements
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
    });

    test('should support high contrast mode', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            * { border: 1px solid white !important; }
          }
        `
      });

      await page.click('text=Login');

      // Elements should still be visible and accessible
      await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });

    test('should work with keyboard navigation only', async ({ page }) => {
      await page.click('text=Login');

      // Navigate through all interactive elements with Tab
      await page.keyboard.press('Tab'); // Email input
      await page.keyboard.type('manager@example.com');

      await page.keyboard.press('Tab'); // Password input
      await page.keyboard.type('password123');

      await page.keyboard.press('Tab'); // Login button
      await page.keyboard.press('Enter'); // Submit

      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Mobile Authentication', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

    test('should work on mobile devices', async ({ page }) => {
      await page.click('text=Login');

      // Mobile layout should be responsive
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Mobile navigation should be visible
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    });

    test('should handle touch interactions', async ({ page }) => {
      await page.click('text=Login');

      // Test touch/tap interactions
      await page.tap('[data-testid="email-input"]');
      await page.fill('[data-testid="email-input"]', 'manager@example.com');

      await page.tap('[data-testid="password-input"]');
      await page.fill('[data-testid="password-input"]', 'password123');

      await page.tap('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Performance', () => {
    test('should load login page quickly', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/login');

      // Page should load within 2 seconds
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);

      // Critical elements should be visible
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should handle login process efficiently', async ({ page }) => {
      await page.click('text=Login');

      const startTime = Date.now();

      await page.fill('[data-testid="email-input"]', 'manager@example.com');
      await page.fill('[data-testid="password-input"]', 'password123');
      await page.click('[data-testid="login-button"]');

      await expect(page).toHaveURL('/dashboard');

      // Login process should complete within 3 seconds
      const loginTime = Date.now() - startTime;
      expect(loginTime).toBeLessThan(3000);
    });
  });
});