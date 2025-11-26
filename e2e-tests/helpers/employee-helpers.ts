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

  constructor(page: Page, request: APIRequestContext, baseURL: string = 'http://localhost:3000') {
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
    await this.login('admin@example.com', 'Admin123!@#');
  }

  async loginAsManager(): Promise<void> {
    await this.login('manager@example.com', 'Manager123!@#');
  }

  async loginAsEmployee(): Promise<void> {
    await this.login('employee@example.com', 'Employee123!@#');
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
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
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
    }
    if (data.role) {
      await this.page.getByLabel(/role/i).click();
      await this.page.getByRole('option', { name: new RegExp(data.role, 'i') }).click();
    }
    if (data.department) {
      await this.page.getByLabel(/department/i).click();
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

  async submitEmployeeForm(): Promise<void> {
    await this.page.getByRole('button', { name: /save|create|submit/i }).click();
    // Wait for dialog to close
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
  }

  async cancelEmployeeForm(): Promise<void> {
    await this.page.getByRole('button', { name: /cancel/i }).click();
    await this.page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 });
  }

  async findEmployeeInList(email: string): Promise<boolean> {
    return await this.page.getByText(email).isVisible();
  }

  async openEmployeeActionsMenu(email: string): Promise<void> {
    const row = this.page.locator(`tr:has-text("${email}")`);
    await row.getByRole('button', { name: /more|actions|menu/i }).click();
    await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
  }

  async selectMenuAction(action: string): Promise<void> {
    await this.page.getByRole('menuitem', { name: new RegExp(action, 'i') }).click();
  }

  async editEmployee(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('edit employee');
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
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
    await this.page.getByLabel(/filter.*role/i).click();
    await this.page.getByRole('option', { name: new RegExp(role, 'i') }).click();
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
    const rows = this.page.locator('tbody tr');
    await expect(rows).toHaveCount(count, { timeout: 5000 });
  }

  /**
   * Status Management Helpers
   */

  async openStatusDialog(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('manage status');
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
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
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
  }

  async resetPassword(temporaryPassword: string): Promise<void> {
    await this.page.getByLabel(/temporary password/i).fill(temporaryPassword);
    await this.submitEmployeeForm();
  }

  async openChangePasswordDialog(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('change password');
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
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
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
  }

  async openStatusHistory(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('status history');
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
  }

  async openDepartmentHistory(email: string): Promise<void> {
    await this.openEmployeeActionsMenu(email);
    await this.selectMenuAction('department history');
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' });
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
    await this.page.waitForSelector('table tbody tr', { timeout: 10000 });
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
