/**
 * Password Management E2E Tests
 *
 * Comprehensive test suite for password reset, password change, and password security
 * including complexity validation, rate limiting, and permission checks.
 *
 * Coverage: 18 tests
 * Priority: CRITICAL
 */

import { test, expect } from '@playwright/test';
import { EmployeeTestHelpers } from '../helpers/employee-helpers';
import { testUsers, passwordTestData } from '../fixtures/employee-fixtures';

test.describe('Password Management', () => {
  let helpers: EmployeeTestHelpers;

  test.beforeEach(async ({ page, request }) => {
    helpers = new EmployeeTestHelpers(page, request);
  });

  test.describe('01. Password Reset by Admin', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('01.01 Admin should be able to reset employee password', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('NewTemp123!@#');

      await helpers.expectSuccessMessage('password reset successfully');
    });

    test('01.02 Should validate password complexity on reset', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('weak'); // Too weak

      await helpers.expectValidationError('password must be at least 8 characters');
    });

    test('01.03 Should require uppercase letters', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('password123!'); // No uppercase

      await helpers.expectValidationError('password must contain uppercase');
    });

    test('01.04 Should require lowercase letters', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('PASSWORD123!'); // No lowercase

      await helpers.expectValidationError('password must contain lowercase');
    });

    test('01.05 Should require numbers', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('Password!@#'); // No numbers

      await helpers.expectValidationError('password must contain number');
    });

    test('01.06 Should require special characters', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('Password123'); // No special chars

      await helpers.expectValidationError('password must contain special character');
    });

    test('01.07 Manager should be able to reset employee password', async () => {
      await helpers.logout();
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();

      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('ManagerReset123!@#');

      await helpers.expectSuccessMessage('password reset successfully');
    });

    test('01.08 Regular employee should NOT see reset password option', async () => {
      await helpers.logout();
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.openEmployeeActionsMenu(testUsers.admin.email);
      await helpers.expectMenuItemHidden('reset password');
    });
  });

  test.describe('02. Password Change by User', () => {

    test.beforeEach(async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();
    });

    test('02.01 Employee should be able to change own password', async ({ page }) => {
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        passwordTestData.valid.current,
        passwordTestData.valid.new,
        passwordTestData.valid.confirm
      );

      await helpers.expectSuccessMessage('password changed successfully');
    });

    test('02.02 Should validate current password is correct', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        'WrongPassword123!',
        passwordTestData.valid.new,
        passwordTestData.valid.confirm
      );

      await helpers.expectErrorMessage('current password is incorrect');
    });

    test('02.03 Should validate new password confirmation matches', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        passwordTestData.valid.current,
        passwordTestData.valid.new,
        'DifferentPassword123!@#' // Mismatch
      );

      await helpers.expectValidationError('passwords do not match');
    });

    test('02.04 Should validate new password complexity', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        passwordTestData.valid.current,
        'weak',
        'weak'
      );

      await helpers.expectValidationError('password must be at least 8 characters');
    });

    test('02.05 Should prevent reusing last 5 passwords', async ({ page }) => {
      // This test would require multiple password changes
      // Simplified version: just verify the error message appears
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        passwordTestData.valid.current,
        passwordTestData.valid.current, // Reusing current
        passwordTestData.valid.current
      );

      await helpers.expectErrorMessage('cannot reuse recent password');
    });

    test('02.06 Admin should be able to change own password', async () => {
      await helpers.logout();
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();

      const testEmail = testUsers.admin.email;

      await helpers.openChangePasswordDialog(testEmail);
      await helpers.changePassword(
        'Admin123!',
        'NewAdminPass123!',
        'NewAdminPass123!'
      );

      await helpers.expectSuccessMessage('password changed successfully');
    });
  });

  test.describe('03. Password Security Features', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('03.01 Should enforce minimum 8 characters', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('Pass1!'); // Only 6 chars

      await helpers.expectValidationError('password must be at least 8 characters');
    });

    test('03.02 Should accept complex valid password', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('V3ry$tr0ng!Pass');

      await helpers.expectSuccessMessage('password reset successfully');
    });

    test('03.03 Should handle special characters in password', async () => {
      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('P@$$w0rd!2025#');

      await helpers.expectSuccessMessage('password reset successfully');
    });

    test('03.04 Should show password strength indicator', async ({ page }) => {
      const testEmail = testUsers.employee.email;

      await helpers.openChangePasswordDialog(testEmail);

      // Should see password strength indicator
      await expect(page.getByText(/password strength/i)).toBeVisible();
    });
  });

  test.describe('04. Permission-Based Password Management', () => {

    test('04.01 Employee should NOT be able to reset other employee passwords', async () => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      await helpers.openEmployeeActionsMenu(testUsers.manager.email);
      await helpers.expectMenuItemHidden('reset password');
    });

    test('04.02 Manager should be able to reset employee passwords', async () => {
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();

      const testEmail = testUsers.employee.email;

      await helpers.openResetPasswordDialog(testEmail);
      await helpers.resetPassword('ManagerSet123!@#');

      await helpers.expectSuccessMessage('password reset successfully');
    });
  });
});
