/**
 * E2E Tests for Calendar Integration Features
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../fixtures/page-objects';
import { testUsers } from '../fixtures/test-data';

test.describe('Calendar Integration', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(testUsers.employee.email, testUsers.employee.password);
    await page.goto('/calendar');
  });

  test('should display calendar view', async ({ page }) => {
    await expect(page.getByTestId('calendar-view')).toBeVisible();
    await expect(page.getByText(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))).toBeVisible();
  });

  test('should switch between calendar views', async ({ page }) => {
    // Month view (default)
    await expect(page.getByTestId('month-view')).toBeVisible();
    
    // Switch to week view
    await page.getByRole('button', { name: /week/i }).click();
    await expect(page.getByTestId('week-view')).toBeVisible();
    
    // Switch to day view
    await page.getByRole('button', { name: /day/i }).click();
    await expect(page.getByTestId('day-view')).toBeVisible();
    
    // Switch to list view
    await page.getByRole('button', { name: /list/i }).click();
    await expect(page.getByTestId('list-view')).toBeVisible();
  });

  test('should navigate between dates', async ({ page }) => {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Go to next month
    await page.getByRole('button', { name: /next/i }).click();
    const nextMonth = new Date(new Date().setMonth(new Date().getMonth() + 1))
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(page.getByText(nextMonth)).toBeVisible();
    
    // Go to previous month
    await page.getByRole('button', { name: /previous/i }).click();
    await page.getByRole('button', { name: /previous/i }).click();
    const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(page.getByText(prevMonth)).toBeVisible();
    
    // Go to today
    await page.getByRole('button', { name: /today/i }).click();
    await expect(page.getByText(currentMonth)).toBeVisible();
  });

  test('should display employee shifts on calendar', async ({ page }) => {
    // Check for shift events
    const shifts = page.locator('[data-testid="shift-event"]');
    await expect(shifts.first()).toBeVisible();
    
    // Verify shift details
    const firstShift = shifts.first();
    await expect(firstShift).toContainText(/\d{1,2}:\d{2}/); // Time
    await expect(firstShift).toContainText(/Morning|Afternoon|Evening/); // Shift type
  });

  test('should show shift details on click', async ({ page }) => {
    const shift = page.locator('[data-testid="shift-event"]').first();
    await shift.click();
    
    // Check modal/popover appears
    await expect(page.getByText('Shift Details')).toBeVisible();
    await expect(page.getByText('Start Time:')).toBeVisible();
    await expect(page.getByText('End Time:')).toBeVisible();
    await expect(page.getByText('Location:')).toBeVisible();
    await expect(page.getByText('Role:')).toBeVisible();
  });

  test('should request shift swap', async ({ page }) => {
    const shift = page.locator('[data-testid="shift-event"]').first();
    await shift.click();
    
    await page.getByRole('button', { name: /request swap/i }).click();
    
    // Fill swap request form
    await page.getByLabel('Reason').fill('Personal appointment');
    await page.getByLabel('Preferred Date').fill('2025-01-25');
    await page.getByRole('button', { name: /submit request/i }).click();
    
    await expect(page.getByText('Swap request submitted')).toBeVisible();
  });

  test('should request time off', async ({ page }) => {
    await page.getByRole('button', { name: /request time off/i }).click();
    
    // Fill time off request
    await page.getByLabel('Start Date').fill('2025-02-01');
    await page.getByLabel('End Date').fill('2025-02-03');
    await page.getByLabel('Reason').selectOption('vacation');
    await page.getByLabel('Notes').fill('Family vacation');
    
    await page.getByRole('button', { name: /submit/i }).click();
    
    await expect(page.getByText('Time off request submitted')).toBeVisible();
    
    // Verify request appears on calendar
    await expect(page.locator('[data-testid="time-off-pending"]')).toBeVisible();
  });

  test('should sync with external calendars', async ({ page }) => {
    await page.getByRole('button', { name: /calendar settings/i }).click();
    await page.getByRole('tab', { name: /sync/i }).click();
    
    // Google Calendar
    await page.getByRole('button', { name: /connect google calendar/i }).click();
    // Would normally handle OAuth flow here
    
    // iCal export
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export ical/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.ics');
  });

  test('should show availability overview', async ({ page }) => {
    await page.getByRole('button', { name: /availability/i }).click();
    
    await expect(page.getByText('Your Availability')).toBeVisible();
    
    // Check availability grid
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      await expect(page.getByText(day)).toBeVisible();
    }
    
    // Update availability
    await page.locator('[data-day="Monday"][data-time="morning"]').click();
    await expect(page.getByText('Availability updated')).toBeVisible();
  });

  test('should filter calendar by shift type', async ({ page }) => {
    // Apply filters
    await page.getByRole('button', { name: /filters/i }).click();
    
    await page.getByLabel('Morning Shifts').uncheck();
    await page.getByLabel('Evening Shifts').uncheck();
    
    // Only afternoon shifts should be visible
    const shifts = await page.locator('[data-testid="shift-event"]').all();
    for (const shift of shifts) {
      await expect(shift).toContainText('Afternoon');
    }
  });

  test('should print calendar', async ({ page }) => {
    // Trigger print
    page.on('dialog', dialog => dialog.accept());
    
    await page.getByRole('button', { name: /print calendar/i }).click();
    
    // Verify print preview opens (browser-specific behavior)
    // In real scenario, would check print CSS is applied
  });

  test('should show notifications for schedule changes', async ({ page }) => {
    // Simulate schedule change (would normally come from WebSocket)
    await page.evaluate(() => {
      window.postMessage({ type: 'SCHEDULE_CHANGE', data: { 
        message: 'Your shift on Monday has been updated' 
      }}, '*');
    });
    
    await expect(page.getByText('Schedule Update')).toBeVisible();
    await expect(page.getByText('Your shift on Monday has been updated')).toBeVisible();
  });

  test('should integrate with team calendar', async ({ page }) => {
    await page.getByRole('button', { name: /team view/i }).click();
    
    // Should show all team members' schedules
    await expect(page.getByText('Team Schedule')).toBeVisible();
    await expect(page.locator('[data-testid="team-member"]')).toHaveCount(3);
    
    // Toggle team member visibility
    await page.getByLabel('Show John Smith').uncheck();
    const johnShifts = page.locator('[data-employee="John Smith"]');
    await expect(johnShifts).toHaveCount(0);
  });
});