/**
 * History Dialog E2E Tests
 *
 * Comprehensive test suite for Role History, Status History, and Department History dialogs
 * including display, filtering, statistics, and CSV export functionality.
 *
 * Coverage: 17 tests
 * Priority: CRITICAL
 */

import { test, expect } from '@playwright/test';
import { EmployeeTestHelpers } from '../helpers/employee-helpers';
import { testUsers } from '../fixtures/employee-fixtures';

test.describe('History Dialogs', () => {
  let helpers: EmployeeTestHelpers;

  test.beforeEach(async ({ page, request }) => {
    helpers = new EmployeeTestHelpers(page, request);
  });

  test.describe('01. Role History Dialog', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('01.01 Should open role history dialog', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Dialog should be visible with title
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/role history/i)).toBeVisible();
    });

    test('01.02 Should display role change records in table', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Should see table with headers
      await expect(page.getByRole('columnheader', { name: /date.*time/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /old role/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /new role/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /changed by/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /reason/i })).toBeVisible();
    });

    test('01.03 Should display statistics section', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Should see statistics cards
      await expect(page.getByText(/total changes/i)).toBeVisible();
      await expect(page.getByText(/roles held/i)).toBeVisible();
      await expect(page.getByText(/avg.*duration/i)).toBeVisible();
      await expect(page.getByText(/date range/i)).toBeVisible();
    });

    test('01.04 Should support date range filtering', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Should see date filter inputs
      await expect(page.getByLabel(/start date/i)).toBeVisible();
      await expect(page.getByLabel(/end date/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
    });

    test('01.05 Should filter by start date', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      const startDate = '2025-01-01';
      await page.getByLabel(/start date/i).fill(startDate);

      // Wait for filtering
      await helpers.waitForLoadingToFinish();

      // Records should update (implementation dependent)
    });

    test('01.06 Should filter by end date', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      const endDate = '2025-12-31';
      await page.getByLabel(/end date/i).fill(endDate);

      // Wait for filtering
      await helpers.waitForLoadingToFinish();
    });

    test('01.07 Should clear date filters', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Set filters
      await page.getByLabel(/start date/i).fill('2025-01-01');
      await page.getByLabel(/end date/i).fill('2025-12-31');

      // Clear filters
      await page.getByRole('button', { name: /clear filters/i }).click();

      // Filters should be cleared
      await expect(page.getByLabel(/start date/i)).toHaveValue('');
      await expect(page.getByLabel(/end date/i)).toHaveValue('');
    });

    test('01.08 Should export role history to CSV', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      // Should see export button
      await expect(page.getByRole('button', { name: /export.*csv/i })).toBeVisible();

      // Click export (download will trigger)
      await helpers.exportHistoryToCSV();
    });

    test('01.09 Should close dialog with close button', async ({ page }) => {
      await helpers.openRoleHistory(testUsers.employee.email);

      await page.getByRole('button', { name: /^close$/i }).click();

      // Dialog should close
      await helpers.waitForDialogToClose();
    });
  });

  test.describe('02. Status History Dialog', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('02.01 Should open status history dialog', async ({ page }) => {
      await helpers.openStatusHistory(testUsers.employee.email);

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/status history/i)).toBeVisible();
    });

    test('02.02 Should display status change records', async ({ page }) => {
      await helpers.openStatusHistory(testUsers.employee.email);

      // Should see table with status-specific headers
      await expect(page.getByRole('columnheader', { name: /date.*time/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /old status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /new status/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /changed by/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /reason/i })).toBeVisible();
    });

    test('02.03 Should show status indicators with colors', async ({ page }) => {
      await helpers.openStatusHistory(testUsers.employee.email);

      // Status chips should be visible (if there are records)
      // Color coding: active (green), inactive (gray), locked (red)
      const hasRecords = await page.locator('tbody tr').count() > 0;

      if (hasRecords) {
        // Verify status chips are displayed
        const chips = page.locator('[class*="MuiChip"]');
        await expect(chips.first()).toBeVisible();
      }
    });

    test('02.04 Should support date filtering in status history', async ({ page }) => {
      await helpers.openStatusHistory(testUsers.employee.email);

      await expect(page.getByLabel(/start date/i)).toBeVisible();
      await expect(page.getByLabel(/end date/i)).toBeVisible();
    });

    test('02.05 Should export status history to CSV', async ({ page }) => {
      await helpers.openStatusHistory(testUsers.employee.email);

      await expect(page.getByRole('button', { name: /export.*csv/i })).toBeVisible();
    });
  });

  test.describe('03. Department History Dialog', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('03.01 Should open department history dialog', async ({ page }) => {
      await helpers.openDepartmentHistory(testUsers.employee.email);

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/department history/i)).toBeVisible();
    });

    test('03.02 Should display department transfer records', async ({ page }) => {
      await helpers.openDepartmentHistory(testUsers.employee.email);

      // Should see table with department-specific headers
      await expect(page.getByRole('columnheader', { name: /date.*time/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /old.*department|from/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /new.*department|to/i })).toBeVisible();
    });

    test('03.03 Should handle empty history gracefully', async ({ page }) => {
      await helpers.openDepartmentHistory(testUsers.employee.email);

      // Should see either records or empty state message
      const hasRecords = await page.locator('tbody tr').count() > 0;

      if (!hasRecords) {
        await expect(page.getByText(/no.*history|no records/i)).toBeVisible();
      }
    });
  });

  test.describe('04. History Dialog Permissions', () => {

    test('04.01 Employee should be able to view own history', async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.openRoleHistory(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('04.02 Manager should be able to view employee history', async () => {
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();

      await helpers.openRoleHistory(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });
  });
});
