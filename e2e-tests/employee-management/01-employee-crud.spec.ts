/**
 * Employee CRUD Operations E2E Tests
 *
 * Comprehensive test suite for employee creation, reading, updating, and deletion
 * including validation, error handling, and permission checks.
 *
 * Coverage: 28 tests
 * Priority: CRITICAL
 */

import { test, expect } from '@playwright/test';
import { EmployeeTestHelpers } from '../helpers/employee-helpers';
import { testUsers, validEmployees, invalidEmployees, searchTestData, filterTestData } from '../fixtures/employee-fixtures';

test.describe('Employee CRUD Operations', () => {
  let helpers: EmployeeTestHelpers;

  test.beforeEach(async ({ page, request }) => {
    helpers = new EmployeeTestHelpers(page, request);
  });

  // Clean up test data after each test to prevent pollution
  test.afterEach(async ({ request }) => {
    try {
      // Delete test employees and users with @test.com emails
      await request.delete('http://localhost/api/test/cleanup');
    } catch (error) {
      // Cleanup is best-effort - don't fail tests if it doesn't work
      console.warn('Test cleanup failed:', error);
    }
  });

  test.describe('01. Employee Creation (Create)', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('01.01 Should create employee with all required fields', async () => {
      const employee = validEmployees[0];

      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee created successfully');
      const exists = await helpers.findEmployeeInList(employee.email);
      expect(exists).toBeTruthy();
    });

    test('01.02 Should create employee with all extended fields', async () => {
      const employee = {
        ...validEmployees[1],
        email: 'extended.fields@test.com'
      };

      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        hireDate: employee.hireDate,
        hourlyRate: employee.hourlyRate?.toString(),
        maxHours: employee.maxHoursPerWeek?.toString()
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee created successfully');
      const exists = await helpers.findEmployeeInList(employee.email);
      expect(exists).toBeTruthy();
    });

    test('01.03 Should validate required first name', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: '',
        lastName: 'Doe',
        email: `test.${Date.now()}@example.com`
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for validation error

      await helpers.expectValidationError('first name is required');
    });

    test('01.04 Should validate required last name', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'John',
        lastName: '',
        email: `test.${Date.now()}@example.com`
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for validation error

      await helpers.expectValidationError('last name is required');
    });

    test('01.05 Should validate email format', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email'
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for validation error

      await helpers.expectValidationError('valid email');
    });

    test('01.06 Should prevent duplicate email addresses', async () => {
      const uniqueEmail = `duplicate.test.${Date.now()}@example.com`;
      const employee = {
        ...validEmployees[0],
        email: uniqueEmail
      };

      // Create first employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success
      await helpers.expectSuccessMessage('employee created successfully');

      // Try to create duplicate
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Different',
        lastName: 'Person',
        email: employee.email // Same email
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for API error

      await helpers.expectErrorMessage('already registered');
    });

    test('01.07 Should validate hourly rate range (0-1000)', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'John',
        lastName: 'Doe',
        email: `rate.test.${Date.now()}@example.com`,
        hourlyRate: '1500' // Above max
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for validation error

      await helpers.expectValidationError('hourly rate must be between 0 and 1000');
    });

    test('01.08 Should validate max hours per week (1-168)', async () => {
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'John',
        lastName: 'Doe',
        email: `hours.test.${Date.now()}@example.com`,
        maxHours: '200' // Above max
      });
      await helpers.submitEmployeeForm(); // Dialog stays open for validation error

      await helpers.expectValidationError('max hours must be between 1 and 168');
    });

    test('01.09 Should allow canceling employee creation', async () => {
      const cancelEmail = `cancel.test.${Date.now()}@example.com`;
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'John',
        lastName: 'Doe',
        email: cancelEmail
      });
      await helpers.cancelEmployeeForm();

      const exists = await helpers.findEmployeeInList(cancelEmail);
      expect(exists).toBeFalsy();
    });
  });

  test.describe('02. Employee Reading (Read)', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('02.01 Should display all employees in table', async () => {
      await helpers.waitForTableLoad();

      // Should see at least the admin user
      const exists = await helpers.findEmployeeInList(testUsers.admin.email);
      expect(exists).toBeTruthy();
    });

    test('02.02 Should display employee details correctly', async ({ page }) => {
      const employee = validEmployees[0];

      // Create employee first
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Verify details in card
      const card = page.locator('[class*="MuiCard-root"]').filter({ hasText: employee.email });
      await expect(card).toContainText(employee.firstName);
      await expect(card).toContainText(employee.lastName);
      await expect(card).toContainText(employee.email);
    });

    test('02.03 Should search employees by name', async () => {
      await helpers.searchEmployees('Admin');
      await helpers.waitForTableLoad();

      const exists = await helpers.findEmployeeInList(testUsers.admin.email);
      expect(exists).toBeTruthy();
    });

    test('02.04 Should search employees by email', async () => {
      await helpers.searchEmployees('admin@example.com');
      await helpers.waitForTableLoad();

      const exists = await helpers.findEmployeeInList(testUsers.admin.email);
      expect(exists).toBeTruthy();
    });

    test('02.05 Should perform case-insensitive search', async () => {
      await helpers.searchEmployees('ADMIN');
      await helpers.waitForTableLoad();

      const exists = await helpers.findEmployeeInList(testUsers.admin.email);
      expect(exists).toBeTruthy();
    });

    test('02.06 Should filter employees by role', async () => {
      // Create test employees with specific roles first
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'Manager',
        email: 'test.manager@test.com',
        role: 'manager'
      });
      await helpers.submitEmployeeForm(true);

      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test.employee@test.com',
        role: 'employee'
      });
      await helpers.submitEmployeeForm(true);

      // Wait for role options to be populated with the newly created roles
      await helpers.waitForRoleOptionsPopulated(['manager', 'employee']);

      // Now filter by manager role
      await helpers.filterByRole('manager');
      await helpers.waitForTableLoad();

      const managerExists = await helpers.findEmployeeInList('test.manager@test.com');
      const employeeExists = await helpers.findEmployeeInList('test.employee@test.com');

      expect(managerExists).toBeTruthy();
      expect(employeeExists).toBeFalsy(); // Should be filtered out
    });

    test('02.07 Should clear all filters', async ({ page }) => {
      // Create test employees
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Filter',
        lastName: 'TestOne',
        email: 'filter.testone@test.com',
        role: 'manager'
      });
      await helpers.submitEmployeeForm(true);

      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Filter',
        lastName: 'TestTwo',
        email: 'filter.testtwo@test.com',
        role: 'employee'
      });
      await helpers.submitEmployeeForm(true);

      // Wait for role options to be populated with the newly created roles
      await helpers.waitForRoleOptionsPopulated(['manager', 'employee']);

      // Apply filters
      await helpers.searchEmployees('Filter');
      await helpers.filterByRole('manager');
      await helpers.waitForTableLoad();

      // Verify filter is applied - only manager role employees should show
      await expect(page.getByTestId('clear-filters-button')).toBeVisible({ timeout: 5000 });

      // Clear filters and verify all employees visible again
      await helpers.clearFilters();
      await helpers.waitForTableLoad();

      const test1Exists = await helpers.findEmployeeInList('filter.testone@test.com');
      const test2Exists = await helpers.findEmployeeInList('filter.testtwo@test.com');

      expect(test1Exists).toBeTruthy();
      expect(test2Exists).toBeTruthy();
    });
  });

  test.describe('03. Employee Updating (Update)', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('03.01 Should update employee first name', async ({ page }) => {
      const testEmail = 'update.firstname@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Original',
        lastName: 'Name',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Edit employee
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ firstName: 'Updated' });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Verify update
      await helpers.expectSuccessMessage('employee updated successfully');
      const card = page.locator('[class*="MuiCard-root"]').filter({ hasText: testEmail });
      await expect(card).toContainText('Updated');
    });

    test('03.02 Should update employee last name', async ({ page }) => {
      const testEmail = 'update.lastname@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'Original',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Edit employee
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ lastName: 'Updated' });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Verify update
      await helpers.expectSuccessMessage('employee updated successfully');
      const card = page.locator('[class*="MuiCard-root"]').filter({ hasText: testEmail });
      await expect(card).toContainText('Updated');
    });

    test('03.03 Should update employee phone number', async ({ page }) => {
      const testEmail = 'update.phone@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'User',
        email: testEmail,
        phone: '(212) 555-0100'
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Debug: Check page state after create
      console.log('After create - URL:', page.url());
      console.log('After create - Cards found:', await page.locator('[class*="MuiCard-root"]').count());

      // Explicitly verify employee exists in list before trying to edit
      const exists = await helpers.findEmployeeInList(testEmail, { timeout: 10000 });
      expect(exists).toBeTruthy();

      // Edit employee
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ phone: '(212) 555-0199' });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee updated successfully');
    });

    test('03.04 Should update employee hourly rate', async () => {
      const testEmail = 'update.rate@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'User',
        email: testEmail,
        hourlyRate: '25.00'
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Edit employee
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ hourlyRate: '30.50' });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee updated successfully');
    });

    test('03.05 Should update employee max hours', async () => {
      const testEmail = 'update.hours@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Test',
        lastName: 'User',
        email: testEmail,
        maxHours: '40'
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Edit employee
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ maxHours: '35' });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee updated successfully');
    });

    test('03.06 Should prevent updating email to duplicate', async () => {
      const email1 = 'first@test.com';
      const email2 = 'second@test.com';

      // Create first employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'First',
        lastName: 'User',
        email: email1
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Create second employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Second',
        lastName: 'User',
        email: email2
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Wait for the employee to appear in the list before trying to edit
      await helpers.waitForTableLoad();

      // Try to change second email to first
      await helpers.editEmployee(email2);
      await helpers.fillEmployeeForm({ email: email1 });
      await helpers.submitEmployeeForm(); // Dialog stays open for API error

      await helpers.expectErrorMessage('already registered');
    });

    test('03.07 Should allow canceling update', async () => {
      const testEmail = 'cancel.update@test.com';

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Original',
        lastName: 'Name',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Start edit but cancel
      await helpers.editEmployee(testEmail);
      await helpers.fillEmployeeForm({ firstName: 'Changed' });
      await helpers.cancelEmployeeForm();

      // Verify no change
      const exists = await helpers.findEmployeeInList(testEmail);
      expect(exists).toBeTruthy();
    });
  });

  test.describe('04. Employee Deletion (Delete)', () => {

    test.beforeEach(async () => {
      await helpers.loginAsAdmin();
      await helpers.navigateToEmployees();
    });

    test('04.01 Should delete employee successfully', async ({ page }) => {
      // Use timestamp to ensure unique email
      const testEmail = `delete.test.${Date.now()}@test.com`;

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Delete',
        lastName: 'Me',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Wait for employee to be fully persisted before attempting deletion
      await helpers.waitForTableLoad();
      const exists = await helpers.findEmployeeInList(testEmail, { timeout: 10000 });
      expect(exists).toBeTruthy();

      // Additional wait to ensure backend has fully persisted the employee
      await page.waitForTimeout(1000);

      // Delete employee
      await helpers.deleteEmployee(testEmail);

      // Verify deletion
      await helpers.expectSuccessMessage('employee deleted successfully');
      const stillExists = await helpers.findEmployeeInList(testEmail);
      expect(stillExists).toBeFalsy();
    });

    test('04.02 Should require confirmation before deletion', async ({ page }) => {
      // Use timestamp to ensure unique email
      const testEmail = `confirm.delete.${Date.now()}@test.com`;

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Confirm',
        lastName: 'Delete',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Open delete menu
      await helpers.openEmployeeActionsMenu(testEmail);
      await helpers.selectMenuAction('delete employee');

      // Should see confirmation dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/are you sure/i)).toBeVisible();
    });

    test('04.03 Should allow canceling deletion', async () => {
      // Use timestamp to ensure unique email
      const testEmail = `cancel.delete.${Date.now()}@test.com`;

      // Create employee
      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Cancel',
        lastName: 'Delete',
        email: testEmail
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      // Start delete but cancel
      await helpers.openEmployeeActionsMenu(testEmail);
      await helpers.selectMenuAction('delete employee');
      await helpers.cancelEmployeeForm();

      // Verify still exists
      const exists = await helpers.findEmployeeInList(testEmail);
      expect(exists).toBeTruthy();
    });
  });

  test.describe('05. Permission-Based CRUD', () => {

    test('05.01 Managers should be able to create employees', async () => {
      await helpers.loginAsManager();
      await helpers.navigateToEmployees();

      await helpers.openAddEmployeeDialog();
      await helpers.fillEmployeeForm({
        firstName: 'Manager',
        lastName: 'Created',
        email: 'manager.created@test.com'
      });
      await helpers.submitEmployeeForm(true); // Wait for dialog to close on success

      await helpers.expectSuccessMessage('employee created successfully');
    });

    test('05.02 Regular employees should NOT be able to create employees', async ({ page }) => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      // Add Employee button should be hidden
      await helpers.expectElementHidden('button:has-text("Add Employee")');
    });

    test('05.03 Regular employees should NOT be able to delete employees', async ({ page }) => {
      await helpers.loginAsEmployee();
      await helpers.navigateToEmployees();

      // Employees don't have permission to access employee management page
      // They should see "Access Denied" instead of the employee list
      await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible({ timeout: 10000 });
    });
  });
});
