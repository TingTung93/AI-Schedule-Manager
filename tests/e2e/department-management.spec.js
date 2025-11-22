/**
 * End-to-End Tests for Department Management Workflows
 *
 * Tests complete user journeys through department management features:
 * - Creating and managing department schedules
 * - Employee assignment and transfers
 * - Analytics and reporting
 * - Template application and customization
 */

const { test, expect } = require('@playwright/test');

// Test data fixtures
const testUsers = {
  manager: {
    email: 'manager@company.com',
    password: 'Manager123!',
    role: 'manager',
    department: 'Engineering'
  },
  admin: {
    email: 'admin@company.com',
    password: 'Admin123!',
    role: 'admin'
  },
  employee: {
    email: 'employee@company.com',
    password: 'Employee123!',
    role: 'employee',
    department: 'Engineering'
  }
};

const testDepartment = {
  name: 'Engineering',
  code: 'ENG',
  description: 'Engineering Department',
  maxEmployees: 50
};

const testSchedule = {
  name: 'Weekly Engineering Schedule',
  startDate: '2024-01-15',
  endDate: '2024-01-21',
  shifts: [
    { day: 'Monday', start: '09:00', end: '17:00', position: 'Senior Engineer' },
    { day: 'Tuesday', start: '09:00', end: '17:00', position: 'Senior Engineer' },
    { day: 'Wednesday', start: '09:00', end: '17:00', position: 'Junior Engineer' }
  ]
};

// Helper functions
async function login(page, user) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');

  // Verify successful login
  await expect(page.locator('[data-testid="user-menu"]')).toContainText(user.role);
}

async function createDepartment(page, department) {
  await page.click('[data-testid="departments-nav"]');
  await page.click('[data-testid="create-department-button"]');

  await page.fill('[data-testid="department-name"]', department.name);
  await page.fill('[data-testid="department-code"]', department.code);
  await page.fill('[data-testid="department-description"]', department.description);
  await page.fill('[data-testid="max-employees"]', department.maxEmployees.toString());

  await page.click('[data-testid="save-department-button"]');
  await expect(page.locator('[data-testid="success-message"]')).toContainText('Department created');
}

async function assignEmployee(page, employeeEmail, department) {
  await page.click('[data-testid="employees-nav"]');
  await page.fill('[data-testid="employee-search"]', employeeEmail);
  await page.click(`[data-testid="employee-row-${employeeEmail}"]`);

  await page.click('[data-testid="assign-department-button"]');
  await page.selectOption('[data-testid="department-select"]', department);
  await page.click('[data-testid="confirm-assignment-button"]');

  await expect(page.locator('[data-testid="success-message"]')).toContainText('Employee assigned');
}

test.describe('Department Management - Complete Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear test data
    await page.goto('/');
  });

  test('Manager creates department schedule, assigns employees, and publishes', async ({ page }) => {
    // Step 1: Login as manager
    await login(page, testUsers.manager);

    // Step 2: Navigate to schedule creation
    await page.click('[data-testid="schedules-nav"]');
    await page.click('[data-testid="create-schedule-button"]');

    // Step 3: Fill schedule details
    await page.fill('[data-testid="schedule-name"]', testSchedule.name);
    await page.fill('[data-testid="start-date"]', testSchedule.startDate);
    await page.fill('[data-testid="end-date"]', testSchedule.endDate);
    await page.selectOption('[data-testid="department-select"]', testDepartment.code);

    // Step 4: Add shifts
    for (const shift of testSchedule.shifts) {
      await page.click('[data-testid="add-shift-button"]');
      await page.selectOption('[data-testid="shift-day"]', shift.day);
      await page.fill('[data-testid="shift-start"]', shift.start);
      await page.fill('[data-testid="shift-end"]', shift.end);
      await page.fill('[data-testid="shift-position"]', shift.position);
      await page.click('[data-testid="confirm-shift-button"]');
    }

    // Verify shifts added
    await expect(page.locator('[data-testid="shifts-list"]')).toContainText('Monday');
    await expect(page.locator('[data-testid="shifts-list"]')).toContainText('Tuesday');
    await expect(page.locator('[data-testid="shifts-list"]')).toContainText('Wednesday');

    // Step 5: Assign employees to shifts
    await page.click('[data-testid="assign-employees-tab"]');
    const shiftRows = page.locator('[data-testid^="shift-row-"]');
    const count = await shiftRows.count();

    for (let i = 0; i < count; i++) {
      const row = shiftRows.nth(i);
      await row.click('[data-testid="assign-button"]');

      // Select first available employee
      const employeeOptions = page.locator('[data-testid="employee-option"]');
      await employeeOptions.first().click();
      await page.click('[data-testid="confirm-employee-button"]');

      // Verify assignment
      await expect(row.locator('[data-testid="assigned-employee"]')).toBeVisible();
    }

    // Step 6: Review schedule
    await page.click('[data-testid="review-schedule-tab"]');
    await expect(page.locator('[data-testid="schedule-summary"]')).toContainText(testSchedule.name);
    await expect(page.locator('[data-testid="total-shifts"]')).toContainText('3');
    await expect(page.locator('[data-testid="assigned-shifts"]')).toContainText('3');

    // Step 7: Publish schedule
    await page.click('[data-testid="publish-schedule-button"]');

    // Confirm publication
    await page.click('[data-testid="confirm-publish-button"]');

    // Verify publication success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Schedule published');
    await expect(page.locator('[data-testid="schedule-status"]')).toContainText('Published');

    // Verify notification sent
    await expect(page.locator('[data-testid="notifications-badge"]')).toHaveText('3');

    // Step 8: Verify in calendar view
    await page.click('[data-testid="calendar-nav"]');
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();

    // Check shifts appear on calendar
    for (const shift of testSchedule.shifts) {
      await expect(page.locator(`[data-testid="calendar-shift-${shift.day}"]`)).toBeVisible();
    }
  });

  test('Manager identifies coverage gap, adds shift, and verifies conflict detection', async ({ page }) => {
    // Step 1: Login and navigate to calendar
    await login(page, testUsers.manager);
    await page.click('[data-testid="calendar-nav"]');
    await page.selectOption('[data-testid="department-filter"]', testDepartment.code);

    // Step 2: View weekly calendar
    await page.click('[data-testid="week-view-button"]');
    await expect(page.locator('[data-testid="calendar-week-view"]')).toBeVisible();

    // Step 3: Identify coverage gap
    const thursday = page.locator('[data-testid="calendar-day-Thursday"]');
    await expect(thursday.locator('[data-testid^="shift-"]')).toHaveCount(0);

    // Visual indicator for gap
    await expect(thursday.locator('[data-testid="coverage-warning"]')).toBeVisible();
    await expect(thursday.locator('[data-testid="coverage-status"]')).toContainText('Understaffed');

    // Step 4: Add shift to fill gap
    await thursday.click('[data-testid="add-shift-button"]');

    await page.fill('[data-testid="shift-start"]', '09:00');
    await page.fill('[data-testid="shift-end"]', '17:00');
    await page.fill('[data-testid="shift-position"]', 'Senior Engineer');

    // Step 5: Attempt to assign employee who is already scheduled
    await page.click('[data-testid="assign-employee-button"]');
    await page.selectOption('[data-testid="employee-select"]', testUsers.employee.email);

    // Step 6: Verify conflict detection
    await page.click('[data-testid="save-shift-button"]');

    // Should show conflict warning
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflict-message"]')).toContainText('already scheduled');
    await expect(page.locator('[data-testid="conflict-details"]')).toContainText('Wednesday');

    // Step 7: View conflict details
    await page.click('[data-testid="view-conflicts-button"]');

    const conflictList = page.locator('[data-testid="conflicts-list"]');
    await expect(conflictList).toBeVisible();
    await expect(conflictList.locator('[data-testid^="conflict-item-"]')).toHaveCount(1);

    // Step 8: Resolve conflict by choosing different employee
    await page.click('[data-testid="resolve-conflict-button"]');
    await page.click('[data-testid="suggest-alternatives-button"]');

    // System suggests available employees
    const suggestions = page.locator('[data-testid="suggested-employees"]');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.locator('[data-testid^="suggested-employee-"]')).toHaveCount({ min: 1 });

    // Select suggested employee
    await suggestions.locator('[data-testid^="suggested-employee-"]').first().click();
    await page.click('[data-testid="confirm-assignment-button"]');

    // Step 9: Verify shift added without conflicts
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift added');
    await expect(thursday.locator('[data-testid^="shift-"]')).toHaveCount(1);
    await expect(thursday.locator('[data-testid="coverage-status"]')).toContainText('Adequate');
  });

  test('Manager transfers employee between departments and verifies audit trail', async ({ page }) => {
    // Step 1: Login as manager
    await login(page, testUsers.manager);

    // Step 2: Navigate to employee management
    await page.click('[data-testid="employees-nav"]');

    // Step 3: Search for employee
    await page.fill('[data-testid="employee-search"]', testUsers.employee.email);
    await page.click(`[data-testid="employee-row-${testUsers.employee.email}"]`);

    // Step 4: View current department
    await expect(page.locator('[data-testid="current-department"]')).toContainText(testDepartment.name);

    // Step 5: Initiate transfer
    await page.click('[data-testid="transfer-employee-button"]');

    // Fill transfer form
    await page.selectOption('[data-testid="target-department"]', 'Sales');
    await page.fill('[data-testid="transfer-reason"]', 'Organizational restructuring');
    await page.fill('[data-testid="transfer-effective-date"]', '2024-02-01');

    // Step 6: Preview impact
    await page.click('[data-testid="preview-impact-button"]');

    const impactSummary = page.locator('[data-testid="transfer-impact"]');
    await expect(impactSummary).toBeVisible();
    await expect(impactSummary).toContainText('Affected schedules: 3');
    await expect(impactSummary).toContainText('Coverage warnings: 1');

    // Step 7: Confirm transfer
    await page.click('[data-testid="confirm-transfer-button"]');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Transfer scheduled');

    // Step 8: Verify schedule updates
    await page.click('[data-testid="schedules-nav"]');
    await page.selectOption('[data-testid="department-filter"]', testDepartment.code);

    // Future schedules should show transfer notice
    const futureSchedules = page.locator('[data-testid^="schedule-"]');
    await expect(futureSchedules.first().locator('[data-testid="transfer-notice"]')).toContainText('Employee transferring');

    // Step 9: View audit trail
    await page.click('[data-testid="employees-nav"]');
    await page.fill('[data-testid="employee-search"]', testUsers.employee.email);
    await page.click(`[data-testid="employee-row-${testUsers.employee.email}"]`);
    await page.click('[data-testid="view-history-button"]');

    const auditTrail = page.locator('[data-testid="audit-trail"]');
    await expect(auditTrail).toBeVisible();

    // Verify audit entries
    const auditEntries = auditTrail.locator('[data-testid^="audit-entry-"]');
    await expect(auditEntries).toHaveCount({ min: 2 });

    // Most recent entry should be transfer
    const latestEntry = auditEntries.first();
    await expect(latestEntry).toContainText('Department Transfer');
    await expect(latestEntry).toContainText('Engineering → Sales');
    await expect(latestEntry).toContainText(testUsers.manager.email);
    await expect(latestEntry).toContainText('Organizational restructuring');

    // Step 10: Verify notification sent to employee
    // (Would check employee's notification feed in real scenario)
  });

  test('Admin bulk assigns employees and verifies department list', async ({ page }) => {
    // Step 1: Login as admin
    await login(page, testUsers.admin);

    // Step 2: Navigate to bulk operations
    await page.click('[data-testid="admin-nav"]');
    await page.click('[data-testid="bulk-operations-link"]');

    // Step 3: Select bulk assign operation
    await page.click('[data-testid="bulk-assign-departments-button"]');

    // Step 4: Upload employee list
    const fileInput = page.locator('[data-testid="employee-file-input"]');
    await fileInput.setInputFiles({
      name: 'employees.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`email,department
john.doe@company.com,Engineering
jane.smith@company.com,Engineering
bob.wilson@company.com,Sales
alice.johnson@company.com,Marketing`)
    });

    // Step 5: Preview assignments
    await page.click('[data-testid="preview-assignments-button"]');

    const preview = page.locator('[data-testid="assignments-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('[data-testid^="preview-row-"]')).toHaveCount(4);

    // Verify department distribution
    await expect(preview).toContainText('Engineering: 2 employees');
    await expect(preview).toContainText('Sales: 1 employee');
    await expect(preview).toContainText('Marketing: 1 employee');

    // Step 6: Execute bulk assignment
    await page.click('[data-testid="execute-bulk-assignment-button"]');

    // Confirm action
    await page.click('[data-testid="confirm-bulk-action-button"]');

    // Step 7: Monitor progress
    const progressBar = page.locator('[data-testid="bulk-progress"]');
    await expect(progressBar).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="bulk-complete-message"]')).toBeVisible({ timeout: 10000 });

    // Step 8: View results
    const results = page.locator('[data-testid="bulk-results"]');
    await expect(results).toContainText('Successful: 4');
    await expect(results).toContainText('Failed: 0');

    // Step 9: Verify department employee lists
    await page.click('[data-testid="departments-nav"]');

    // Check Engineering department
    await page.click('[data-testid="department-Engineering"]');
    const engEmployees = page.locator('[data-testid="department-employees-list"]');
    await expect(engEmployees.locator('[data-testid^="employee-"]')).toHaveCount(2);
    await expect(engEmployees).toContainText('john.doe@company.com');
    await expect(engEmployees).toContainText('jane.smith@company.com');

    // Check Sales department
    await page.click('[data-testid="departments-nav"]');
    await page.click('[data-testid="department-Sales"]');
    const salesEmployees = page.locator('[data-testid="department-employees-list"]');
    await expect(salesEmployees.locator('[data-testid^="employee-"]')).toHaveCount(1);
    await expect(salesEmployees).toContainText('bob.wilson@company.com');
  });

  test('Manager views analytics, exports report, and verifies data accuracy', async ({ page }) => {
    // Step 1: Login as manager
    await login(page, testUsers.manager);

    // Step 2: Navigate to analytics dashboard
    await page.click('[data-testid="analytics-nav"]');
    await page.selectOption('[data-testid="department-filter"]', testDepartment.code);

    // Step 3: Select date range
    await page.fill('[data-testid="date-range-start"]', '2024-01-01');
    await page.fill('[data-testid="date-range-end"]', '2024-01-31');
    await page.click('[data-testid="apply-filters-button"]');

    // Step 4: Verify analytics widgets load
    await expect(page.locator('[data-testid="total-hours-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="labor-cost-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="coverage-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="employee-utilization-widget"]')).toBeVisible();

    // Step 5: Capture analytics data for verification
    const totalHours = await page.locator('[data-testid="total-hours-value"]').textContent();
    const laborCost = await page.locator('[data-testid="labor-cost-value"]').textContent();
    const avgCoverage = await page.locator('[data-testid="avg-coverage-value"]').textContent();

    // Step 6: View detailed breakdown
    await page.click('[data-testid="view-breakdown-button"]');

    const breakdown = page.locator('[data-testid="analytics-breakdown"]');
    await expect(breakdown).toBeVisible();

    // Verify breakdown by employee
    await page.click('[data-testid="breakdown-by-employee-tab"]');
    const employeeRows = breakdown.locator('[data-testid^="employee-row-"]');
    await expect(employeeRows).toHaveCount({ min: 1 });

    // Verify breakdown by shift type
    await page.click('[data-testid="breakdown-by-shift-tab"]');
    const shiftRows = breakdown.locator('[data-testid^="shift-row-"]');
    await expect(shiftRows).toHaveCount({ min: 1 });

    // Step 7: Export report
    await page.click('[data-testid="export-report-button"]');

    // Select export format
    await page.selectOption('[data-testid="export-format"]', 'PDF');
    await page.check('[data-testid="include-charts-checkbox"]');
    await page.check('[data-testid="include-breakdown-checkbox"]');

    // Initiate download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/analytics-report.*\.pdf/);

    // Step 8: Verify exported data accuracy
    // In a real test, we would parse the PDF and verify the data
    // For now, verify the success message
    await expect(page.locator('[data-testid="export-success-message"]')).toContainText('Report exported');

    // Step 9: Compare with raw data
    await page.click('[data-testid="view-raw-data-button"]');

    const rawDataTable = page.locator('[data-testid="raw-data-table"]');
    await expect(rawDataTable).toBeVisible();

    // Verify totals match
    const rawTotalHours = await rawDataTable.locator('[data-testid="total-hours-sum"]').textContent();
    expect(rawTotalHours).toBe(totalHours);
  });

  test('Manager applies template, customizes shifts, publishes, and verifies notifications', async ({ page }) => {
    // Step 1: Login as manager
    await login(page, testUsers.manager);

    // Step 2: Navigate to templates
    await page.click('[data-testid="schedules-nav"]');
    await page.click('[data-testid="templates-tab"]');

    // Step 3: Browse available templates
    const templates = page.locator('[data-testid="templates-list"]');
    await expect(templates).toBeVisible();
    await expect(templates.locator('[data-testid^="template-"]')).toHaveCount({ min: 1 });

    // Step 4: Select template
    await page.click('[data-testid="template-Standard-Week"]');

    // Preview template
    const preview = page.locator('[data-testid="template-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('5 shifts');
    await expect(preview).toContainText('40 hours coverage');

    // Step 5: Apply template
    await page.click('[data-testid="apply-template-button"]');

    // Configure template application
    await page.fill('[data-testid="schedule-name"]', 'Feb Week 1 Schedule');
    await page.fill('[data-testid="start-date"]', '2024-02-05');
    await page.selectOption('[data-testid="department-select"]', testDepartment.code);

    await page.click('[data-testid="confirm-apply-button"]');

    // Step 6: Verify template applied
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Template applied');

    const shiftsList = page.locator('[data-testid="shifts-list"]');
    await expect(shiftsList.locator('[data-testid^="shift-"]')).toHaveCount(5);

    // Step 7: Customize shifts
    // Modify first shift
    await shiftsList.locator('[data-testid^="shift-"]').first().click('[data-testid="edit-button"]');

    await page.fill('[data-testid="shift-start"]', '08:00');
    await page.fill('[data-testid="shift-end"]', '16:00');
    await page.click('[data-testid="save-changes-button"]');

    // Add additional shift
    await page.click('[data-testid="add-shift-button"]');
    await page.selectOption('[data-testid="shift-day"]', 'Friday');
    await page.fill('[data-testid="shift-start"]', '14:00');
    await page.fill('[data-testid="shift-end"]', '22:00');
    await page.fill('[data-testid="shift-position"]', 'Evening Engineer');
    await page.click('[data-testid="confirm-shift-button"]');

    // Verify customizations
    await expect(shiftsList.locator('[data-testid^="shift-"]')).toHaveCount(6);

    // Step 8: Auto-assign employees
    await page.click('[data-testid="auto-assign-button"]');

    // Configure auto-assignment
    await page.check('[data-testid="respect-preferences-checkbox"]');
    await page.check('[data-testid="balance-workload-checkbox"]');
    await page.click('[data-testid="start-auto-assign-button"]');

    // Wait for auto-assignment to complete
    await expect(page.locator('[data-testid="auto-assign-complete"]')).toBeVisible({ timeout: 10000 });

    // Verify all shifts assigned
    const unassigned = shiftsList.locator('[data-testid="unassigned-shift"]');
    await expect(unassigned).toHaveCount(0);

    // Step 9: Publish schedule
    await page.click('[data-testid="publish-schedule-button"]');

    // Configure notifications
    await page.check('[data-testid="notify-employees-checkbox"]');
    await page.check('[data-testid="notify-managers-checkbox"]');
    await page.selectOption('[data-testid="notification-method"]', 'email-and-push');

    await page.click('[data-testid="confirm-publish-button"]');

    // Step 10: Verify publication success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Schedule published');
    await expect(page.locator('[data-testid="schedule-status"]')).toContainText('Published');

    // Step 11: Verify notifications sent
    const notificationLog = page.locator('[data-testid="notification-log"]');
    await page.click('[data-testid="view-notifications-button"]');
    await expect(notificationLog).toBeVisible();

    // Count notifications
    const notifications = notificationLog.locator('[data-testid^="notification-"]');
    const notificationCount = await notifications.count();
    expect(notificationCount).toBeGreaterThan(0);

    // Verify notification content
    const firstNotification = notifications.first();
    await expect(firstNotification).toContainText('Schedule Published');
    await expect(firstNotification).toContainText('Feb Week 1 Schedule');
    await expect(firstNotification).toContainText('Sent');

    // Step 12: Verify employee can view schedule
    // (In a real test, we would logout and login as employee)
  });
});

// Accessibility tests
test.describe('Department Management - Accessibility', () => {
  test('should support keyboard navigation throughout workflows', async ({ page }) => {
    await login(page, testUsers.manager);

    // Navigate to schedules using keyboard
    await page.keyboard.press('Tab'); // Focus on navigation
    await page.keyboard.press('Tab'); // Move to schedules
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/.*schedules/);

    // Create schedule with keyboard only
    await page.keyboard.press('Tab'); // Move to create button
    await page.keyboard.press('Enter');

    // Fill form with keyboard
    await page.keyboard.type('Test Schedule');
    await page.keyboard.press('Tab');
    await page.keyboard.type('2024-02-01');
    await page.keyboard.press('Tab');
    await page.keyboard.type('2024-02-07');

    // Verify all interactive elements are keyboard accessible
    const focusableElements = await page.locator('[tabindex]:not([tabindex="-1"])').count();
    expect(focusableElements).toBeGreaterThan(0);
  });

  test('should have proper ARIA labels for screen readers', async ({ page }) => {
    await login(page, testUsers.manager);
    await page.click('[data-testid="calendar-nav"]');

    // Verify ARIA labels
    await expect(page.locator('[aria-label="Calendar view"]')).toBeVisible();
    await expect(page.locator('[aria-label="Add shift"]')).toBeVisible();
    await expect(page.locator('[role="grid"]')).toBeVisible(); // Calendar grid

    // Verify screen reader announcements
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeVisible();
  });
});

// Mobile tests
test.describe('Department Management - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should work on mobile devices', async ({ page }) => {
    await login(page, testUsers.manager);

    // Verify mobile menu
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    // Navigate on mobile
    await page.click('[data-testid="mobile-nav-schedules"]');
    await expect(page).toHaveURL(/.*schedules/);

    // Verify responsive calendar
    await page.click('[data-testid="calendar-nav"]');
    await expect(page.locator('[data-testid="mobile-calendar"]')).toBeVisible();
  });

  test('should handle touch interactions', async ({ page }) => {
    await login(page, testUsers.manager);
    await page.click('[data-testid="calendar-nav"]');

    // Swipe to navigate dates
    const calendar = page.locator('[data-testid="calendar-view"]');
    const box = await calendar.boundingBox();

    // Swipe left
    await page.touchscreen.tap(box.x + box.width - 50, box.y + box.height / 2);
    await page.touchscreen.swipe(
      { x: box.x + box.width - 50, y: box.y + box.height / 2 },
      { x: box.x + 50, y: box.y + box.height / 2 }
    );

    // Verify date changed
    // (Implementation depends on calendar component)
  });
});
