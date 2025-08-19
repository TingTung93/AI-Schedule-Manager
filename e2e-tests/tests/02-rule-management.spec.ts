/**
 * E2E Tests for Rule Management Features
 */

import { test, expect } from '@playwright/test';
import { RulePage, LoginPage } from '../fixtures/page-objects';
import { testUsers, testRules } from '../fixtures/test-data';

test.describe('Rule Management', () => {
  let rulePage: RulePage;

  test.beforeEach(async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(testUsers.manager.email, testUsers.manager.password);
    
    // Navigate to rules page
    await page.goto('/rules');
    rulePage = new RulePage(page);
  });

  test('should display rule creation interface', async ({ page }) => {
    await expect(page.getByText('AI Schedule Manager - Rule Creator')).toBeVisible();
    await expect(rulePage.ruleInput).toBeVisible();
    await expect(rulePage.parseButton).toBeDisabled(); // Initially disabled
  });

  test('should parse and add availability rule', async ({ page }) => {
    const rule = testRules[0]; // Sarah can't work past 5pm
    await rulePage.createRule(rule);
    
    await expect(rulePage.notification).toContainText('Rule added successfully');
    await expect(page.getByText(rule)).toBeVisible();
    await expect(page.getByText('Active Rules (1)')).toBeVisible();
  });

  test('should parse and add preference rule', async ({ page }) => {
    const rule = testRules[1]; // John prefers morning shifts
    await rulePage.createRule(rule);
    
    await expect(page.getByText('preference')).toBeVisible();
    await expect(page.getByText(rule)).toBeVisible();
  });

  test('should parse and add requirement rule', async ({ page }) => {
    const rule = testRules[3]; // Always need at least 2 people
    await rulePage.createRule(rule);
    
    await expect(page.getByText('requirement')).toBeVisible();
    await expect(page.getByText(rule)).toBeVisible();
  });

  test('should handle multiple rules', async ({ page }) => {
    // Add multiple rules
    for (const rule of testRules.slice(0, 3)) {
      await rulePage.createRule(rule);
      await page.waitForTimeout(500); // Brief delay between rules
    }
    
    await expect(page.getByText('Active Rules (3)')).toBeVisible();
    
    // Verify all rules are displayed
    for (const rule of testRules.slice(0, 3)) {
      await expect(page.getByText(rule)).toBeVisible();
    }
  });

  test('should toggle rule active status', async ({ page }) => {
    await rulePage.createRule(testRules[0]);
    
    // Find and toggle the rule
    const ruleItem = page.locator(`text=${testRules[0]}`).locator('..');
    const toggleButton = ruleItem.getByRole('switch');
    
    await toggleButton.click();
    await expect(page.getByText('Inactive')).toBeVisible();
    
    await toggleButton.click();
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('should delete rule', async ({ page }) => {
    const rule = testRules[0];
    await rulePage.createRule(rule);
    
    await expect(page.getByText(rule)).toBeVisible();
    
    await rulePage.deleteRule(rule);
    
    await expect(page.getByText('Rule removed')).toBeVisible();
    await expect(page.getByText(rule)).not.toBeVisible();
    await expect(page.getByText('Active Rules (0)')).toBeVisible();
  });

  test('should validate rule syntax', async ({ page }) => {
    await rulePage.ruleInput.fill('Invalid rule syntax @#$%');
    await rulePage.parseButton.click();
    
    await expect(page.getByText('Failed to parse rule')).toBeVisible();
  });

  test('should show rule preview before adding', async ({ page }) => {
    await rulePage.ruleInput.fill(testRules[0]);
    await rulePage.parseButton.click();
    
    // Check preview dialog
    await expect(page.getByText('Rule Preview')).toBeVisible();
    await expect(page.getByText('Type:')).toBeVisible();
    await expect(page.getByText('Employee:')).toBeVisible();
    await expect(page.getByText('Constraints:')).toBeVisible();
    
    // Can cancel
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText('Rule Preview')).not.toBeVisible();
  });

  test('should handle rule conflicts', async ({ page }) => {
    // Add conflicting rules
    await rulePage.createRule("Sarah must work mornings");
    await rulePage.createRule("Sarah can't work mornings");
    
    await expect(page.getByText('Warning: Conflicting rules detected')).toBeVisible();
  });

  test('should search and filter rules', async ({ page }) => {
    // Add multiple rules
    for (const rule of testRules.slice(0, 3)) {
      await rulePage.createRule(rule);
    }
    
    // Search for specific employee
    const searchInput = page.getByPlaceholder('Search rules...');
    await searchInput.fill('Sarah');
    
    await expect(page.getByText(testRules[0])).toBeVisible();
    await expect(page.getByText(testRules[1])).not.toBeVisible();
  });

  test('should export rules', async ({ page }) => {
    // Add rules
    for (const rule of testRules.slice(0, 2)) {
      await rulePage.createRule(rule);
    }
    
    // Export rules
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export rules/i }).click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('rules');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should import rules from file', async ({ page }) => {
    // Prepare rules file
    const rulesData = JSON.stringify({
      rules: testRules.slice(0, 2).map(r => ({ text: r, active: true }))
    });
    
    // Import rules
    await page.setInputFiles('input[type="file"]', {
      name: 'rules.json',
      mimeType: 'application/json',
      buffer: Buffer.from(rulesData)
    });
    
    await page.getByRole('button', { name: /import/i }).click();
    
    await expect(page.getByText('2 rules imported successfully')).toBeVisible();
    await expect(page.getByText('Active Rules (2)')).toBeVisible();
  });
});