/**
 * Page Object Model for E2E Tests
 */

import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

export class RulePage {
  readonly page: Page;
  readonly ruleInput: Locator;
  readonly parseButton: Locator;
  readonly confirmButton: Locator;
  readonly rulesList: Locator;
  readonly notification: Locator;

  constructor(page: Page) {
    this.page = page;
    this.ruleInput = page.getByPlaceholder(/Example: Sarah can't work/i);
    this.parseButton = page.getByRole('button', { name: /parse rule/i });
    this.confirmButton = page.getByRole('button', { name: /confirm & add/i });
    this.rulesList = page.getByTestId('rules-list');
    this.notification = page.getByRole('alert');
  }

  async createRule(ruleText: string) {
    await this.ruleInput.fill(ruleText);
    await this.parseButton.click();
    await this.page.waitForSelector('text=Rule Preview');
    await this.confirmButton.click();
  }

  async deleteRule(ruleText: string) {
    const ruleItem = this.page.locator(`text=${ruleText}`).locator('..');
    await ruleItem.getByTestId('delete-button').click();
  }
}

export class SchedulePage {
  readonly page: Page;
  readonly generateButton: Locator;
  readonly calendar: Locator;
  readonly optimizeButton: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.generateButton = page.getByRole('button', { name: /generate schedule/i });
    this.calendar = page.getByTestId('schedule-calendar');
    this.optimizeButton = page.getByRole('button', { name: /optimize with ai/i });
    this.exportButton = page.getByRole('button', { name: /export/i });
  }

  async generateSchedule(startDate: string, endDate: string) {
    await this.page.getByLabel('Start Date').fill(startDate);
    await this.page.getByLabel('End Date').fill(endDate);
    await this.generateButton.click();
  }
}

export class EmployeePage {
  readonly page: Page;
  readonly addButton: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly roleSelect: Locator;
  readonly saveButton: Locator;
  readonly employeeList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /add employee/i });
    this.nameInput = page.getByLabel('Name');
    this.emailInput = page.getByLabel('Email');
    this.roleSelect = page.getByLabel('Role');
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.employeeList = page.getByTestId('employee-list');
  }

  async addEmployee(name: string, email: string, role: string) {
    await this.addButton.click();
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.roleSelect.selectOption(role);
    await this.saveButton.click();
  }
}