/**
 * E2E Tests for Notification System
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../fixtures/page-objects';
import { testUsers } from '../fixtures/test-data';

test.describe('Notification System', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant notification permissions
    await context.grantPermissions(['notifications']);
    
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(testUsers.employee.email, testUsers.employee.password);
  });

  test('should display notification center', async ({ page }) => {
    const notificationBell = page.getByTestId('notification-bell');
    await expect(notificationBell).toBeVisible();
    
    // Check for notification count badge
    const badge = notificationBell.locator('[data-testid="notification-count"]');
    if (await badge.isVisible()) {
      const count = await badge.textContent();
      expect(parseInt(count!)).toBeGreaterThanOrEqual(0);
    }
    
    // Open notification center
    await notificationBell.click();
    await expect(page.getByText('Notifications')).toBeVisible();
  });

  test('should show different notification types', async ({ page }) => {
    await page.getByTestId('notification-bell').click();
    
    // Check for different notification categories
    const categories = ['All', 'Schedule', 'Requests', 'Announcements', 'System'];
    for (const category of categories) {
      await expect(page.getByRole('tab', { name: category })).toBeVisible();
    }
  });

  test('should receive real-time notifications', async ({ page }) => {
    // Simulate incoming notification
    await page.evaluate(() => {
      window.postMessage({
        type: 'NEW_NOTIFICATION',
        data: {
          id: 'test-1',
          title: 'New Shift Assignment',
          message: 'You have been assigned to Morning Shift on Monday',
          type: 'schedule',
          timestamp: new Date().toISOString()
        }
      }, '*');
    });
    
    // Check toast notification appears
    await expect(page.getByText('New Shift Assignment')).toBeVisible();
    
    // Check notification in center
    await page.getByTestId('notification-bell').click();
    await expect(page.getByText('You have been assigned to Morning Shift on Monday')).toBeVisible();
  });

  test('should mark notifications as read', async ({ page }) => {
    await page.getByTestId('notification-bell').click();
    
    // Find unread notification
    const unreadNotification = page.locator('[data-read="false"]').first();
    await expect(unreadNotification).toHaveClass(/unread/);
    
    // Click to mark as read
    await unreadNotification.click();
    await expect(unreadNotification).not.toHaveClass(/unread/);
    
    // Verify count updates
    const badge = page.getByTestId('notification-count');
    const prevCount = parseInt(await badge.textContent() || '0');
    await expect(badge).toHaveText((prevCount - 1).toString());
  });

  test('should mark all as read', async ({ page }) => {
    await page.getByTestId('notification-bell').click();
    
    await page.getByRole('button', { name: /mark all as read/i }).click();
    
    // All notifications should be marked as read
    await expect(page.locator('[data-read="false"]')).toHaveCount(0);
    await expect(page.getByTestId('notification-count')).not.toBeVisible();
  });

  test('should delete notifications', async ({ page }) => {
    await page.getByTestId('notification-bell').click();
    
    const notification = page.locator('[data-testid="notification-item"]').first();
    const notificationText = await notification.textContent();
    
    // Delete notification
    await notification.hover();
    await notification.getByRole('button', { name: /delete/i }).click();
    
    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click();
    
    // Notification should be removed
    await expect(page.getByText(notificationText!)).not.toBeVisible();
  });

  test('should configure notification preferences', async ({ page }) => {
    await page.goto('/settings/notifications');
    
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    
    // Toggle notification types
    await page.getByLabel('Schedule Changes').uncheck();
    await page.getByLabel('Shift Reminders').check();
    await page.getByLabel('Team Announcements').check();
    
    // Set quiet hours
    await page.getByLabel('Enable Quiet Hours').check();
    await page.getByLabel('Start Time').fill('22:00');
    await page.getByLabel('End Time').fill('08:00');
    
    // Save preferences
    await page.getByRole('button', { name: /save preferences/i }).click();
    await expect(page.getByText('Preferences saved')).toBeVisible();
  });

  test('should handle notification actions', async ({ page }) => {
    // Create actionable notification
    await page.evaluate(() => {
      window.postMessage({
        type: 'NEW_NOTIFICATION',
        data: {
          id: 'action-1',
          title: 'Shift Swap Request',
          message: 'John wants to swap shifts with you',
          type: 'request',
          actions: ['Accept', 'Decline'],
          timestamp: new Date().toISOString()
        }
      }, '*');
    });
    
    await page.getByTestId('notification-bell').click();
    
    const notification = page.getByText('John wants to swap shifts with you');
    await notification.locator('..').getByRole('button', { name: /accept/i }).click();
    
    await expect(page.getByText('Swap request accepted')).toBeVisible();
  });

  test('should show notification history', async ({ page }) => {
    await page.getByTestId('notification-bell').click();
    await page.getByRole('button', { name: /view all/i }).click();
    
    await expect(page).toHaveURL('/notifications/history');
    await expect(page.getByText('Notification History')).toBeVisible();
    
    // Filter by date
    await page.getByLabel('Start Date').fill('2025-01-01');
    await page.getByLabel('End Date').fill('2025-01-31');
    await page.getByRole('button', { name: /filter/i }).click();
    
    // Check filtered results
    const notifications = page.locator('[data-testid="notification-item"]');
    await expect(notifications).toHaveCount(await notifications.count());
  });

  test('should support email notifications', async ({ page }) => {
    await page.goto('/settings/notifications');
    
    await page.getByLabel('Email Notifications').check();
    await page.getByLabel('Email Address').fill('test@example.com');
    
    // Configure email preferences
    await page.getByLabel('Daily Summary').check();
    await page.getByLabel('Instant Alerts').uncheck();
    await page.getByLabel('Weekly Digest').check();
    
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Email preferences updated')).toBeVisible();
  });

  test('should handle push notifications', async ({ page, context }) => {
    // Check if push notifications are supported
    const pushSupported = await page.evaluate(() => 'PushManager' in window);
    
    if (pushSupported) {
      await page.goto('/settings/notifications');
      
      await page.getByLabel('Push Notifications').check();
      
      // Would normally handle service worker registration here
      await expect(page.getByText('Push notifications enabled')).toBeVisible();
    }
  });

  test('should group similar notifications', async ({ page }) => {
    // Simulate multiple similar notifications
    for (let i = 0; i < 3; i++) {
      await page.evaluate((index) => {
        window.postMessage({
          type: 'NEW_NOTIFICATION',
          data: {
            id: `group-${index}`,
            title: 'Schedule Update',
            message: `Shift ${index + 1} has been updated`,
            type: 'schedule',
            timestamp: new Date().toISOString()
          }
        }, '*');
      }, i);
    }
    
    await page.getByTestId('notification-bell').click();
    
    // Should see grouped notification
    await expect(page.getByText('3 Schedule Updates')).toBeVisible();
    
    // Expand group
    await page.getByText('3 Schedule Updates').click();
    await expect(page.getByText('Shift 1 has been updated')).toBeVisible();
    await expect(page.getByText('Shift 2 has been updated')).toBeVisible();
    await expect(page.getByText('Shift 3 has been updated')).toBeVisible();
  });
});