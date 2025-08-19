/**
 * E2E Tests for AI-Powered Schedule Optimization
 */

import { test, expect } from '@playwright/test';
import { SchedulePage, LoginPage } from '../fixtures/page-objects';
import { testUsers, testSchedule } from '../fixtures/test-data';

test.describe('AI Schedule Optimization', () => {
  let schedulePage: SchedulePage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('/login');
    await loginPage.login(testUsers.manager.email, testUsers.manager.password);
    
    await page.goto('/schedule');
    schedulePage = new SchedulePage(page);
    
    // Generate initial schedule
    await schedulePage.generateSchedule(testSchedule.startDate, testSchedule.endDate);
    await page.waitForSelector('[data-testid="schedule-calendar"]');
  });

  test('should display AI optimization options', async ({ page }) => {
    await expect(schedulePage.optimizeButton).toBeVisible();
    
    await schedulePage.optimizeButton.click();
    
    await expect(page.getByText('AI Optimization Settings')).toBeVisible();
    await expect(page.getByLabel('Minimize Labor Costs')).toBeVisible();
    await expect(page.getByLabel('Balance Workload')).toBeVisible();
    await expect(page.getByLabel('Maximize Coverage')).toBeVisible();
    await expect(page.getByLabel('Employee Preferences')).toBeVisible();
  });

  test('should optimize for minimal labor costs', async ({ page }) => {
    const initialCost = await page.locator('[data-testid="labor-cost"]').textContent();
    
    await schedulePage.optimizeButton.click();
    await page.getByLabel('Minimize Labor Costs').check();
    await page.getByRole('button', { name: /start optimization/i }).click();
    
    // Wait for optimization
    await expect(page.getByText('Optimizing schedule...')).toBeVisible();
    await expect(page.getByText('Optimization complete')).toBeVisible({ timeout: 15000 });
    
    const optimizedCost = await page.locator('[data-testid="labor-cost"]').textContent();
    
    // Verify cost reduction
    await expect(page.getByText(/Saved: \$\d+/)).toBeVisible();
    expect(parseFloat(optimizedCost!.replace('$', ''))).toBeLessThan(
      parseFloat(initialCost!.replace('$', ''))
    );
  });

  test('should balance employee workload', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByLabel('Balance Workload').check();
    await page.getByRole('button', { name: /start optimization/i }).click();
    
    await expect(page.getByText('Optimization complete')).toBeVisible({ timeout: 15000 });
    
    // Check workload distribution
    await page.getByRole('button', { name: /view statistics/i }).click();
    
    const hoursElements = await page.locator('[data-testid="employee-hours"]').all();
    const hours = await Promise.all(hoursElements.map(el => el.textContent()));
    
    // Verify hours are balanced (within 10% of average)
    const hoursNumbers = hours.map(h => parseFloat(h!));
    const avg = hoursNumbers.reduce((a, b) => a + b) / hoursNumbers.length;
    
    for (const h of hoursNumbers) {
      expect(Math.abs(h - avg) / avg).toBeLessThan(0.1);
    }
  });

  test('should respect employee preferences', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByLabel('Employee Preferences').check();
    await page.getByLabel('Preference Weight').fill('90'); // 90% weight
    await page.getByRole('button', { name: /start optimization/i }).click();
    
    await expect(page.getByText('Optimization complete')).toBeVisible({ timeout: 15000 });
    
    // Verify preferences are respected
    await expect(page.getByText('Preference Score: High')).toBeVisible();
    await expect(page.getByText(/\d+% preferences met/)).toBeVisible();
  });

  test('should show optimization progress', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByLabel('Maximize Coverage').check();
    await page.getByRole('button', { name: /start optimization/i }).click();
    
    // Check progress indicators
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/Processing: \d+%/)).toBeVisible();
    await expect(page.getByText('Analyzing constraints')).toBeVisible();
    await expect(page.getByText('Generating solutions')).toBeVisible();
    await expect(page.getByText('Evaluating options')).toBeVisible();
  });

  test('should provide optimization recommendations', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByRole('button', { name: /analyze schedule/i }).click();
    
    await expect(page.getByText('AI Recommendations')).toBeVisible();
    await expect(page.getByText(/Suggestion \d+:/)).toBeVisible();
    
    // Apply a recommendation
    await page.getByRole('button', { name: /apply suggestion 1/i }).click();
    await expect(page.getByText('Recommendation applied')).toBeVisible();
  });

  test('should detect and resolve conflicts', async ({ page }) => {
    // Create a conflict manually
    const shift = page.locator('[data-shift-id="1"]');
    await shift.dblclick();
    await page.getByLabel('End Time').fill('23:00'); // Late night shift
    await page.getByRole('button', { name: /save/i }).click();
    
    // Run AI conflict resolution
    await page.getByRole('button', { name: /resolve conflicts/i }).click();
    
    await expect(page.getByText('1 conflict detected')).toBeVisible();
    await expect(page.getByText('Suggested resolution')).toBeVisible();
    
    await page.getByRole('button', { name: /apply resolution/i }).click();
    await expect(page.getByText('Conflicts resolved')).toBeVisible();
  });

  test('should predict staffing needs', async ({ page }) => {
    await page.getByRole('tab', { name: /predictions/i }).click();
    
    await expect(page.getByText('AI Staffing Predictions')).toBeVisible();
    await expect(page.getByChart({ name: /demand forecast/i })).toBeVisible();
    
    // View predictions for next week
    await page.getByRole('button', { name: /next week/i }).click();
    
    await expect(page.getByText('Predicted Peak Hours')).toBeVisible();
    await expect(page.getByText(/Recommended staff: \d+/)).toBeVisible();
  });

  test('should learn from historical data', async ({ page }) => {
    await page.getByRole('button', { name: /ai settings/i }).click();
    await page.getByRole('tab', { name: /learning/i }).click();
    
    await expect(page.getByText('AI Learning Status')).toBeVisible();
    await expect(page.getByText(/Training data: \d+ schedules/)).toBeVisible();
    await expect(page.getByText(/Accuracy: \d+%/)).toBeVisible();
    
    // Trigger retraining
    await page.getByRole('button', { name: /retrain model/i }).click();
    await expect(page.getByText('Training in progress')).toBeVisible();
  });

  test('should compare multiple optimization strategies', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByRole('button', { name: /compare strategies/i }).click();
    
    // Select strategies to compare
    await page.getByLabel('Cost Minimization').check();
    await page.getByLabel('Coverage Maximization').check();
    await page.getByLabel('Employee Satisfaction').check();
    
    await page.getByRole('button', { name: /run comparison/i }).click();
    
    await expect(page.getByText('Strategy Comparison')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTable({ name: /comparison results/i })).toBeVisible();
    
    // Select best strategy
    await page.locator('[data-strategy="1"]').getByRole('button', { name: /select/i }).click();
    await expect(page.getByText('Strategy applied')).toBeVisible();
  });

  test('should export optimization report', async ({ page }) => {
    await schedulePage.optimizeButton.click();
    await page.getByLabel('Balance Workload').check();
    await page.getByRole('button', { name: /start optimization/i }).click();
    
    await expect(page.getByText('Optimization complete')).toBeVisible({ timeout: 15000 });
    
    // Export report
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export report/i }).click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('optimization-report');
    expect(download.suggestedFilename()).toContain('.pdf');
  });
});