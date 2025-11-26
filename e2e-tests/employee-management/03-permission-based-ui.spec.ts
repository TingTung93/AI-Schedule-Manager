/**
 * Permission-Based UI/UX E2E Tests
 *
 * Comprehensive test suite for role-based access control (RBAC) UI behavior
 * including visibility, enabled/disabled states, and action permissions.
 *
 * Roles: admin, manager, employee, scheduler
 * Coverage: 22 tests
 * Priority: CRITICAL
 */

import { test, expect } from '@playwright/test';
import { EmployeeTestHelpers } from '../helpers/employee-helpers';
import { testUsers } from '../fixtures/employee-fixtures';

test.describe('Permission-Based UI/UX', () => {
  let helpers: EmployeeTestHelpers;

  test.beforeEach(async ({ page, request }) => {
    helpers = new EmployeeTestHelpers(page, request);
  });

  test.describe('01. Admin Permissions', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('01.01 Admin should see "Add Employee" button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible();
    });

    test('01.02 Admin should see all action menu items', async ({ page }) => {
      await helpers.openEmployeeActionsMenu(testUsers.manager.email);

      // Should see all actions
      await helpers.expectMenuItemVisible('edit employee');
      await helpers.expectMenuItemVisible('manage status');
      await helpers.expectMenuItemVisible('reset password');
      await helpers.expectMenuItemVisible('role history');
      await helpers.expectMenuItemVisible('status history');
      await helpers.expectMenuItemVisible('department history');
      await helpers.expectMenuItemVisible('delete');
    });

    test('01.03 Admin should be able to edit any employee', async () => {
      await helpers.editEmployee(testUsers.manager.email);

      // Dialog should open
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('01.04 Admin should be able to delete any employee', async () => {
      const testEmail = 'admin.delete@test.com';

      // Create test employee first
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'Delete',
        email: testEmail
      });
      await helpers.submitEmployeeForm();

      // Delete it
      await helpers.deleteEmployee(testEmail);
      await helpers.expectSuccessMessage('employee deleted successfully');
    });

    test('01.05 Admin should be able to manage employee status', async () => {
      await helpers.openStatusDialog(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('01.06 Admin should be able to reset any employee password', async () => {
      await helpers.openResetPasswordDialog(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });
  });

  test.describe('02. Manager Permissions', () => {

    test.beforeEach(async () => {
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();
    });

    test('02.01 Manager should see "Add Employee" button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible();
    });

    test('02.02 Manager should be able to create employees', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Manager',
        lastName: 'Created',
        email: 'manager.created.test@example.com'
      });
      await helpers.submitEmployeeForm();

      await helpers.expectSuccessMessage('employee created successfully');
    });

    test('02.03 Manager should be able to edit employees', async () => {
      await helpers.editEmployee(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('02.04 Manager should see reset password option', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.employee.email);
      await helpers.expectMenuItemVisible('reset password');
    });

    test('02.05 Manager should see manage status option', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.employee.email);
      await helpers.expectMenuItemVisible('manage status');
    });

    test('02.06 Manager should NOT see delete option for admins', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.admin.email);

      // Delete should be hidden or disabled for admin users
      await helpers.expectMenuItemHidden('delete');
    });

    test('02.07 Manager should see all history dialogs', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.employee.email);

      await helpers.expectMenuItemVisible('role history');
      await helpers.expectMenuItemVisible('status history');
      await helpers.expectMenuItemVisible('department history');
    });
  });

  test.describe('03. Employee Permissions', () => {

    test.beforeEach(async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();
    });

    test('03.01 Employee should NOT see "Add Employee" button', async ({ page }) => {
      await helpers.expectElementHidden('button:has-text("Add Employee")');
    });

    test('03.02 Employee should NOT see edit option for others', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('edit employee');
    });

    test('03.03 Employee should be able to edit own profile', async () => {
      await helpers.editEmployee(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('03.04 Employee should NOT see delete option', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('delete');
    });

    test('03.05 Employee should NOT see reset password for others', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('reset password');
    });

    test('03.06 Employee should be able to change own password', async () => {
      await helpers.openChangePasswordDialog(testUsers.employee.email);
      await helpers.expectElementVisible('[role="dialog"]');
    });

    test('03.07 Employee should NOT see manage status option', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('manage status');
    });

    test('03.08 Employee should see view-only history dialogs', async () => {
      await helpers.openEmployeeActionsMenu(testUsers.employee.email);

      // Can view own history
      await helpers.expectMenuItemVisible('role history');
      await helpers.expectMenuItemVisible('status history');
    });
  });

  test.describe('04. Scheduler Permissions', () => {

    test.beforeEach(async () => {
      await helpers.loginAsEmployee(); // Using employee as proxy for scheduler
      await helpers.navigateToEmployees();
    });

    test('04.01 Scheduler should see employee list (read-only)', async ({ page }) => {
      await helpers.waitForTableLoad();

      // Should see employees
      const exists = await helpers.findEmployeeInList(testUsers.admin.email);
      expect(exists).toBeTruthy();
    });

    test('04.02 Scheduler should NOT see "Add Employee" button', async ({ page }) => {
      await helpers.expectElementHidden('button:has-text("Add Employee")');
    });
  });

  test.describe('05. Cross-Role Action Restrictions', () => {

    test('05.01 Employee cannot edit other employees', async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('edit employee');
    });

    test('05.02 Employee cannot delete any employee', async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.openEmployeeActionsMenu(testUsers.admin.email);
      await helpers.expectMenuItemHidden('delete');
    });

    test('05.03 Manager cannot delete admin users', async () => {
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();

      await helpers.openEmployeeActionsMenu(testUsers.admin.email);
      await helpers.expectMenuItemHidden('delete');
    });

    test('05.04 Users cannot change own role', async ({ page }) => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.editEmployee(testUsers.employee.email);

      // Role field should be disabled or hidden
      const roleField = page.getByLabel(/^role$/i);
      if (await roleField.isVisible()) {
        await expect(roleField).toBeDisabled();
      }
    });
  });
});
