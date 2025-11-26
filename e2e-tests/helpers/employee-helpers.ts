/**
 * Employee Management E2E Test Helpers
 *
 * Provides utility functions for testing employee management features
 * including CRUD operations, role management, status changes, and validations.
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

export class EmployeeTestHelpers {
  private page: Page;
  private request: APIRequestContext;
  private baseURL: string;
  private authToken?: string;

  constructor(page: Page, request: APIRequestContext, baseURL: string = 'http://localhost') {
    this.page = page;
    this.request = request;
    this.baseURL = baseURL;
  }

  /**
   * Authentication Helpers
   */

  async login(email: string, password: string): Promise<void> {
    await this.page.goto(`${this.baseURL}/login`);
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation to dashboard or employees page
    await this.page.waitForURL(/\/(dashboard|employees)/, { timeout: 10000 });
  }

  async loginAsAdmin(): Promise<void> {
    await this.login('admin@example.com', 'Admin123!');
  }

  async loginAsManager(): Promise<void> {
    await this.login('manager@example.com', 'Manager123!');
  }

  async loginAsEmployee(): Promise<void> {
    await this.login('employee1@example.com', 'Employee123!');
  }

  async logout(): Promise<void> {
    await this.page.getByRole('button', { name: /logout/i }).click();
    await this.page.waitForURL(/\/login/, { timeout: 5000 });
  }

  /**
   * Navigation Helpers
   */

  async navigateToEmployees(): Promise<void> {
    await this.page.goto(`${this.baseURL}/employees`);
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToDashboard(): Promise<void> {
    await this.page.goto(`${this.baseURL}/dashboard`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Employee CRUD Helpers
   */

  async openAddEmployeeDialog(): Promise<void> {
    await this.page.getByRole('button', { name: /add employee/i }).click();
    // Wait for the specific "Add New Employee" dialog to be visible
    await this.page.getByRole('heading', { name: /add new employee/i }).waitFor({ state: 'visible' });
  }

  async fillEmployeeForm(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    department?: string;
    hireDate?: string;
    hourlyRate?: string;
    maxHours?: string;
  }): Promise<void> {
    if (data.firstName) {
      await this.page.getByLabel(/first name/i).fill(data.firstName);
    }
    if (data.lastName) {
      await this.page.getByLabel(/last name/i).fill(data.lastName);
    }
    if (data.email) {
      await this.page.getByLabel(/email/i).first().fill(data.email);
    }
    if (data.phone) {
      await this.page.getByLabel(/phone/i).fill(data.phone);
      // Blur the phone input to remove focus
      await this.page.getByLabel(/phone/i).blur();
    }
    if (data.role) {
      // Find the role dropdown within the dialog by locating it after the "Role" text
      const dialog = this.page.getByRole('dialog', { name: /add new employee/i });
      const roleCombobox = dialog.locator('text=Role').locator('..').getByRole('combobox').first();
      await roleCombobox.click();
      // Wait for MUI dropdown menu to be visible
      await this.page.waitForSelector('[role="listbox"]', { state: 'visible' });
      await this.page.getByRole('option', { name: new RegExp(data.role, 'i') }).click();
    }
    if (data.department) {
      // Find the department dropdown within the dialog
      const dialog = this.page.getByRole('dialog', { name: /add new employee/i });
      const deptCombobox = dialog.getByRole('combobox', { name: /department/i });
      await deptCombobox.click();
      // Wait for MUI dropdown menu to be visible
      await this.page.waitForSelector('[role="listbox"]', { state: 'visible' });
      await this.page.getByRole('option', { name: new RegExp(data.department, 'i') }).click();
    }
    if (data.hireDate) {
      await this.page.getByLabel(/hire date/i).fill(data.hireDate);
    }
    if (data.hourlyRate) {
      await this.page.getByLabel(/hourly rate/i).fill(data.hourlyRate);
    }
    if (data.maxHours) {
      await this.page.getByLabel(/max.*hours/i).fill(data.maxHours);
    }
  }

  async submitEmployeeForm(waitForClose: boolean = false): Promise<void> {
    // Button text is "Add Employee" or "Update Employee" - match the actual text
    // Scope to dialog to avoid finding the "Add Employee" button on the main page
    const dialog = this.page.getByRole('dialog');
    const submitButton = dialog.getByRole('button', { name: /(add|update) employee/i });
    await submitButton.click();
    // Only wait for dialog to close if expected (not for validation errors)
    if (waitForClose) {
      await dialog.waitFor({ state: 'hidden', timeout: 10000 });
    } else {
      // Small delay to allow form submission to process
      await this.page.waitForTimeout(500);
    }
  }

  async cancelEmployeeForm(): Promise<void> {
    const cancelButton = this.page.getByRole('button', { name: /cancel/i }).last();
    await cancelButton.click();
    // Wait for cancel button to disappear
    await cancelButton.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async findEmployeeInList(email: string): Promise<boolean> {
    return await this.page.getByText(email).isVisible();
  }

  async openEmployeeActionsMenu(email: string): Promise<void> {
    // Find the Card containing the employee email, then find the IconButton within it
    const card = this.page.locator('[class*="MuiCard-root"]').filter({ hasText: email });
    const menuButton = card.locator('button[class*="MuiIconButton"]').first();
    await menuButton.waitFor({ state: 'visible', timeout: 5000 });
    await menuButton.click();
    await this.page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 5000 });
  }

  async selectMenuAction(action: string): Promise<void> {
    await this.page.getByRole('menuitem', { name: new RegExp(action, 'i') }).click();
  }

  async editEmployee(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('edit employee');
    // Wait for the edit dialog heading instead of generic dialog
    await this.page.getByRole('heading', { name: /edit employee/i }).waitFor({ state: 'visible', timeout: 5000 });
  }

  async deleteEmployee(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('delete');

    // Confirm deletion
    await this.page.getByRole('button', { name: /confirm|delete|yes/i }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
  }

  /**
   * Search and Filter Helpers
   */

  async searchEmployees(searchTerm: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(searchTerm);
    await this.page.waitForTimeout(500); // Debounce
  }

  async filterByRole(role: string): Promise<void> {
    // Multi-select dropdown - click the Select input to open it
    await this.page.getByLabel('Roles').click();

    // Wait for the dropdown menu to appear
    await this.page.waitForTimeout(500);

    // MUI multi-select renders MenuItems with text content
    // Role is capitalized in the UI (e.g., "Admin" not "admin")
    const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);

    // Click the menu item by its text content
    await this.page.getByText(capitalizedRole, { exact: true }).click();

    // Close the dropdown by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async filterByDepartment(department: string): Promise<void> {
    // Multi-select dropdown - click the Select input to open it
    await this.page.getByLabel('Departments').click();

    // Wait for the dropdown menu to appear
    await this.page.waitForTimeout(500);

    // MUI multi-select renders MenuItems with text content
    // Click the menu item by its text content
    await this.page.getByText(department, { exact: true }).click();

    // Close the dropdown by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
  }

  async filterByStatus(status: string): Promise<void> {
    await this.page.getByLabel(/filter.*status/i).click();
    await this.page.getByRole('option', { name: new RegExp(status, 'i') }).click();
  }

  async clearFilters(): Promise<void> {
    await this.page.getByRole('button', { name: /clear filters/i }).click();
  }

  /**
   * Validation Helpers
   */

  async expectValidationError(message: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(message, 'i'))).toBeVisible({ timeout: 5000 });
  }

  async expectSuccessMessage(message: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(message, 'i'))).toBeVisible({ timeout: 5000 });
  }

  async expectErrorMessage(message: string): Promise<void> {
    await expect(this.page.getByRole('alert')).toContainText(new RegExp(message, 'i'), { timeout: 5000 });
  }

  async expectEmployeeCount(count: number): Promise<void> {
    const cards = this.page.locator('[class*="MuiCard-root"]');
    await expect(cards).toHaveCount(count, { timeout: 5000 });
  }

  /**
   * Status Management Helpers
   */

  async openStatusDialog(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('manage status');
    await this.page.getByRole('heading', { name: /status|manage/i }).waitFor({ state: 'visible' });
  }

  async changeEmployeeStatus(status: 'active' | 'inactive' | 'locked'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(status, 'i') }).click();
    await this.submitEmployeeForm();
  }

  /**
   * Password Management Helpers
   */

  async openResetPasswordDialog(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('reset password');
    await this.page.getByRole('heading', { name: /reset password/i }).waitFor({ state: 'visible' });
  }

  async resetPassword(temporaryPassword: string): Promise<void> {
    await this.page.getByLabel(/temporary password/i).fill(temporaryPassword);
    await this.submitEmployeeForm();
  }

  async openChangePasswordDialog(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('change password');
    await this.page.getByRole('heading', { name: /change password/i }).waitFor({ state: 'visible' });
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    await this.page.getByLabel(/current password/i).fill(currentPassword);
    await this.page.getByLabel(/^new password$/i).fill(newPassword);
    await this.page.getByLabel(/confirm.*password/i).fill(confirmPassword);
    await this.submitEmployeeForm();
  }

  /**
   * History Dialog Helpers
   */

  async openRoleHistory(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('role history');
    await this.page.getByRole('heading', { name: /role.*history/i }).waitFor({ state: 'visible' });
  }

  async openStatusHistory(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('status history');
    await this.page.getByRole('heading', { name: /status.*history/i }).waitFor({ state: 'visible' });
  }

  async openDepartmentHistory(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('department history');
    await this.page.getByRole('heading', { name: /department.*history/i }).waitFor({ state: 'visible' });
  }

  async expectHistoryRecordCount(count: number): Promise<void> {
    const rows = this.page.locator('[role="dialog"] tbody tr');
    await expect(rows).toHaveCount(count, { timeout: 5000 });
  }

  async exportHistoryToCSV(): Promise<void> {
    await this.page.getByRole('button', { name: /export.*csv/i }).click();
    await this.page.waitForTimeout(1000); // Wait for download
  }

  /**
   * Permission Testing Helpers
   */

  async expectElementVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
  }

  async expectElementHidden(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeHidden({ timeout: 5000 });
  }

  async expectMenuItemVisible(itemName: string): Promise<void> {
    await expect(this.page.getByRole('menuitem', { name: new RegExp(itemName, 'i') })).toBeVisible();
  }

  async expectMenuItemHidden(itemName: string): Promise<void> {
    await expect(this.page.getByRole('menuitem', { name: new RegExp(itemName, 'i') })).toBeHidden();
  }

  /**
   * Wait Helpers
   */

  async waitForTableLoad(): Promise<void> {
    // Note: EmployeesPage uses Card-based Grid layout, not tables
    // Wait for employee cards to load
    await this.page.waitForSelector('[class*="MuiCard-root"]', { timeout: 10000 });
  }

  async waitForDialogToClose(): Promise<void> {
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
  }

  async waitForLoadingToFinish(): Promise<void> {
    await this.page.waitForSelector('[role="progressbar"]', { state: 'hidden', timeout: 10000 });
  }

  /**
   * Screenshot Helpers
   */

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e-tests/screenshots/${name}.png`, fullPage: true });
  }
}
