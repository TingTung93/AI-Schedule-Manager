/**
 * E2E Tests for Schedule Generation and Management
 */

import { test, expect } from '@playwright/test';
import { SchedulePage, LoginPage, RulePage } from '../fixtures/page-objects';
import { testUsers, testRules, testSchedule } from '../fixtures/test-data';

test.describe('Schedule Generation', () => {
  let schedulePage: SchedulePage;

  test.beforeEach(async ({ page }) => {
    // Login as manager
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(testUsers.manager.email, testUsers.manager.password);
    
    // Add some rules first
    await page.goto('/rules');
    const rulePage = new RulePage(page);
    for (const rule of testRules.slice(0, 3)) {
      await rulePage.createRule(rule);
    }
    
    // Navigate to schedule page
    await page.goto('/schedule');
    schedulePage = new SchedulePage(page);
  });

  test('should display schedule generation interface', async ({ page }) => {
    await expect(page.getByText('Schedule Generator')).toBeVisible();
    await expect(page.getByLabel('Start Date')).toBeVisible();
    await expect(page.getByLabel('End Date')).toBeVisible();
    await expect(schedulePage.generateButton).toBeVisible();
  });

  test('should generate weekly schedule', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    
    await expect(page.getByText('Generating schedule...')).toBeVisible();
    await expect(schedulePage.calendar).toBeVisible({ timeout: 10000 });
    
    // Verify schedule is displayed
    await expect(page.getByText('Week of')).toBeVisible();
    await expect(page.getByText('Morning Shift')).toBeVisible();
    await expect(page.getByText('Afternoon Shift')).toBeVisible();
    await expect(page.getByText('Evening Shift')).toBeVisible();
  });

  test('should respect rules when generating schedule', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    // Check Sarah doesn't work past 5pm
    const sarahShifts = page.locator('text=Sarah Johnson').all();
    for (const shift of await sarahShifts) {
      const shiftTime = await shift.locator('..').textContent();
      expect(shiftTime).not.toContain('Evening');
    }
  });

  test('should handle schedule conflicts', async ({ page }) => {
    // Try to generate with conflicting constraints
    await page.getByLabel('Minimum Staff').fill('10');
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    
    await expect(page.getByText('Unable to generate schedule')).toBeVisible();
    await expect(page.getByText('Insufficient staff')).toBeVisible();
  });

  test('should allow manual schedule adjustments', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    // Drag and drop to swap shifts
    const shift1 = page.locator('[data-shift-id="1"]');
    const shift2 = page.locator('[data-shift-id="2"]');
    
    await shift1.dragTo(shift2);
    
    await expect(page.getByText('Schedule updated')).toBeVisible();
  });

  test('should validate schedule completeness', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    // Remove an employee from a shift
    await page.locator('[data-shift-id="1"]').getByRole('button', { name: /remove/i }).click();
    
    // Try to save incomplete schedule
    await page.getByRole('button', { name: /save schedule/i }).click();
    
    await expect(page.getByText('Schedule incomplete')).toBeVisible();
    await expect(page.getByText('Missing coverage for Morning Shift')).toBeVisible();
  });

  test('should calculate labor costs', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    await expect(page.getByText('Total Hours:')).toBeVisible();
    await expect(page.getByText('Labor Cost:')).toBeVisible();
    await expect(page.getByText(/\$\d+/)).toBeVisible();
  });

  test('should export schedule to different formats', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    // Export as PDF
    const pdfDownload = page.waitForEvent('download');
    await schedulePage.exportButton.click();
    await page.getByRole('menuitem', { name: /pdf/i }).click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toContain('.pdf');
    
    // Export as CSV
    const csvDownload = page.waitForEvent('download');
    await schedulePage.exportButton.click();
    await page.getByRole('menuitem', { name: /csv/i }).click();
    const csv = await csvDownload;
    expect(csv.suggestedFilename()).toContain('.csv');
  });

  test('should publish schedule to employees', async ({ page }) => {
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    
    await page.getByRole('button', { name: /publish schedule/i }).click();
    
    // Confirm publication
    await page.getByRole('button', { name: /confirm/i }).click();
    
    await expect(page.getByText('Schedule published successfully')).toBeVisible();
    await expect(page.getByText('Notifications sent to all employees')).toBeVisible();
  });

  test('should show schedule history', async ({ page }) => {
    // Generate multiple schedules
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
    await page.getByRole('button', { name: /save/i }).click();
    
    // Navigate to history
    await page.getByRole('tab', { name: /history/i }).click();
    
    await expect(page.getByText('Schedule History')).toBeVisible();
    await expect(page.getByText(testSchedule.startDate)).toBeVisible();
  });

  test('should copy from previous schedule', async ({ page }) => {
    await page.getByRole('button', { name: /copy from previous/i }).click();
    
    await expect(page.getByText('Select Previous Schedule')).toBeVisible();
    
    // Select a previous schedule
    await page.locator('[data-schedule-id="prev-1"]').click();
    await page.getByRole('button', { name: /use this schedule/i }).click();
    
    await expect(page.getByText('Schedule copied')).toBeVisible();
    await expect(schedulePage.calendar).toBeVisible();
  });

  test('should handle recurring schedules', async ({ page }) => {
    await page.getByLabel('Recurring').check();
    await page.getByLabel('Frequency').selectOption('weekly');
    await page.getByLabel('Repeat for').fill('4');
    
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    
    await expect(page.getByText('4 weeks of schedules generated')).toBeVisible();
    
    // Navigate through weeks
    await page.getByRole('button', { name: /next week/i }).click();
    await expect(page.getByText('Week 2 of 4')).toBeVisible();
  });
});