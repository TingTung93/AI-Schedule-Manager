/**
 * End-to-End Tests for Schedule Conflict Detection
 *
 * Tests comprehensive conflict detection and resolution:
 * - Overlapping shift detection
 * - Double-booking prevention
 * - Maximum hours validation
 * - Minimum rest period enforcement
 * - Conflict resolution suggestions
 */

const { test, expect } = require('@playwright/test');

// Test data
const testUsers = {
  manager: {
    email: 'manager@company.com',
    password: 'Manager123!',
    role: 'manager'
  }
};

const testEmployee = {
  id: 'emp-123',
  email: 'employee@company.com',
  name: 'John Doe',
  maxHoursPerWeek: 40,
  minRestHours: 11
};

// Helper functions
async function login(page, user) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function createShift(page, shiftData) {
  await page.click('[data-testid="add-shift-button"]');
  await page.fill('[data-testid="shift-date"]', shiftData.date);
  await page.fill('[data-testid="shift-start"]', shiftData.start);
  await page.fill('[data-testid="shift-end"]', shiftData.end);
  await page.selectOption('[data-testid="employee-select"]', shiftData.employeeId);
  if (shiftData.position) {
    await page.fill('[data-testid="shift-position"]', shiftData.position);
  }
}

async function saveShift(page) {
  await page.click('[data-testid="save-shift-button"]');
}

test.describe('Schedule Conflicts - Detection and Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await page.click('[data-testid="schedules-nav"]');
    await page.click('[data-testid="create-schedule-button"]');
    await page.fill('[data-testid="schedule-name"]', 'Conflict Test Schedule');
    await page.fill('[data-testid="start-date"]', '2024-02-01');
    await page.fill('[data-testid="end-date"]', '2024-02-07');
  });

  test('should detect and warn about overlapping shifts for same employee', async ({ page }) => {
    // Create first shift: 9 AM - 5 PM
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });
    await saveShift(page);

    // Verify first shift created successfully
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift added');

    // Attempt to create overlapping shift: 2 PM - 10 PM (overlaps by 3 hours)
    await createShift(page, {
      date: '2024-02-05',
      start: '14:00',
      end: '22:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should show conflict warning before saving
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="conflict-warning"]')).toContainText('overlapping shift');

    // Attempt to save anyway
    await saveShift(page);

    // Should prevent saving and show detailed error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Cannot create overlapping shifts');

    // Verify conflict details shown
    const conflictDetails = page.locator('[data-testid="conflict-details"]');
    await expect(conflictDetails).toBeVisible();
    await expect(conflictDetails).toContainText(testEmployee.name);
    await expect(conflictDetails).toContainText('09:00');
    await expect(conflictDetails).toContainText('17:00');
    await expect(conflictDetails).toContainText('Overlap: 3 hours');

    // Verify visual indicators
    const timeline = page.locator('[data-testid="shift-timeline"]');
    await expect(timeline.locator('[data-testid="overlap-indicator"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="overlap-indicator"]')).toHaveCSS('background-color', /rgb\(255, 0, 0\)/); // Red
  });

  test('should prevent double-booking with clear error message', async ({ page }) => {
    // Create shift: 9 AM - 5 PM
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Senior Engineer'
    });
    await saveShift(page);

    // Attempt exact duplicate: 9 AM - 5 PM same day
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Junior Engineer' // Different position, same time
    });

    // Should immediately show double-booking error
    await expect(page.locator('[data-testid="double-booking-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="double-booking-error"]')).toContainText('Employee already has a shift');

    // Save button should be disabled
    await expect(page.locator('[data-testid="save-shift-button"]')).toBeDisabled();

    // Show existing shift details
    const existingShift = page.locator('[data-testid="existing-shift-details"]');
    await expect(existingShift).toBeVisible();
    await expect(existingShift).toContainText('Senior Engineer');
    await expect(existingShift).toContainText('09:00 - 17:00');

    // Offer to edit existing shift instead
    await expect(page.locator('[data-testid="edit-existing-button"]')).toBeVisible();
  });

  test('should enforce maximum weekly hours and show validation error', async ({ page }) => {
    // Create shifts totaling 40 hours (max allowed)
    const shifts = [
      { date: '2024-02-05', start: '09:00', end: '17:00' }, // 8 hours (Mon)
      { date: '2024-02-06', start: '09:00', end: '17:00' }, // 8 hours (Tue)
      { date: '2024-02-07', start: '09:00', end: '17:00' }, // 8 hours (Wed)
      { date: '2024-02-08', start: '09:00', end: '17:00' }, // 8 hours (Thu)
      { date: '2024-02-09', start: '09:00', end: '17:00' }, // 8 hours (Fri)
    ];

    for (const shift of shifts) {
      await createShift(page, {
        ...shift,
        employeeId: testEmployee.id,
        position: 'Engineer'
      });
      await saveShift(page);
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }

    // Verify weekly hours counter
    await expect(page.locator('[data-testid="weekly-hours-counter"]')).toContainText('40 / 40 hours');
    await expect(page.locator('[data-testid="hours-limit-indicator"]')).toHaveClass(/at-limit/);

    // Attempt to add one more shift (would exceed limit)
    await createShift(page, {
      date: '2024-02-09',
      start: '18:00',
      end: '20:00', // 2 more hours
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should show max hours exceeded error
    await expect(page.locator('[data-testid="max-hours-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="max-hours-error"]')).toContainText('exceed maximum weekly hours');
    await expect(page.locator('[data-testid="max-hours-error"]')).toContainText('42 hours');
    await expect(page.locator('[data-testid="max-hours-error"]')).toContainText('Limit: 40 hours');

    // Save button disabled
    await expect(page.locator('[data-testid="save-shift-button"]')).toBeDisabled();

    // Show weekly hours breakdown
    await page.click('[data-testid="view-hours-breakdown-button"]');
    const breakdown = page.locator('[data-testid="hours-breakdown"]');
    await expect(breakdown).toBeVisible();

    const dailyHours = breakdown.locator('[data-testid^="day-hours-"]');
    await expect(dailyHours).toHaveCount(5);

    // Verify calculation
    for (let i = 0; i < 5; i++) {
      await expect(dailyHours.nth(i)).toContainText('8 hours');
    }
  });

  test('should enforce minimum rest period between shifts', async ({ page }) => {
    // Create evening shift: 2 PM - 10 PM
    await createShift(page, {
      date: '2024-02-05',
      start: '14:00',
      end: '22:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });
    await saveShift(page);
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Attempt to create morning shift next day: 6 AM - 2 PM (only 8 hours rest)
    await createShift(page, {
      date: '2024-02-06',
      start: '06:00',
      end: '14:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should show insufficient rest period error
    await expect(page.locator('[data-testid="rest-period-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="rest-period-error"]')).toContainText('Insufficient rest period');
    await expect(page.locator('[data-testid="rest-period-error"]')).toContainText('8 hours');
    await expect(page.locator('[data-testid="rest-period-error"]')).toContainText('Required: 11 hours');

    // Show timeline visualization
    const timeline = page.locator('[data-testid="rest-period-timeline"]');
    await expect(timeline).toBeVisible();

    // Previous shift end
    await expect(timeline.locator('[data-testid="previous-shift-end"]')).toContainText('22:00');

    // Rest period (highlighted in red)
    const restPeriod = timeline.locator('[data-testid="rest-period-indicator"]');
    await expect(restPeriod).toBeVisible();
    await expect(restPeriod).toHaveClass(/insufficient/);

    // Next shift start
    await expect(timeline.locator('[data-testid="next-shift-start"]')).toContainText('06:00');

    // Suggest valid start time
    await expect(page.locator('[data-testid="suggested-start-time"]')).toContainText('09:00');

    // Quick fix button
    await page.click('[data-testid="apply-suggested-time-button"]');

    // Verify time updated
    await expect(page.locator('[data-testid="shift-start"]')).toHaveValue('09:00');

    // Error should disappear
    await expect(page.locator('[data-testid="rest-period-error"]')).not.toBeVisible();
  });

  test('should provide conflict resolution suggestions', async ({ page }) => {
    // Create multiple shifts for different employees
    const employees = [
      { id: 'emp-1', name: 'Alice', email: 'alice@company.com' },
      { id: 'emp-2', name: 'Bob', email: 'bob@company.com' },
      { id: 'emp-3', name: 'Charlie', email: 'charlie@company.com' }
    ];

    // Alice has Monday shift
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: employees[0].id,
      position: 'Engineer'
    });
    await saveShift(page);

    // Bob has Tuesday shift
    await createShift(page, {
      date: '2024-02-06',
      start: '09:00',
      end: '17:00',
      employeeId: employees[1].id,
      position: 'Engineer'
    });
    await saveShift(page);

    // Attempt to schedule Alice again on Monday (conflict)
    await createShift(page, {
      date: '2024-02-05',
      start: '13:00',
      end: '21:00',
      employeeId: employees[0].id,
      position: 'Senior Engineer'
    });

    // Conflict detected
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible();

    // Click on resolution suggestions
    await page.click('[data-testid="show-suggestions-button"]');

    const suggestions = page.locator('[data-testid="conflict-suggestions"]');
    await expect(suggestions).toBeVisible();

    // Suggestion 1: Use different employee
    const altEmployees = suggestions.locator('[data-testid="suggested-employees"]');
    await expect(altEmployees).toBeVisible();
    await expect(altEmployees.locator('[data-testid^="suggested-employee-"]')).toHaveCount(2);

    // Should show Bob and Charlie as available
    await expect(altEmployees).toContainText('Bob');
    await expect(altEmployees).toContainText('Charlie');

    // Should NOT show Alice
    await expect(altEmployees).not.toContainText('Alice');

    // Show availability for each suggestion
    const bobCard = altEmployees.locator('[data-testid="suggested-employee-emp-2"]');
    await expect(bobCard).toContainText('Available');
    await expect(bobCard).toContainText('Weekly hours: 8/40');

    // Suggestion 2: Adjust shift time
    const timeAdjustments = suggestions.locator('[data-testid="suggested-times"]');
    await expect(timeAdjustments).toBeVisible();

    // Suggest time after existing shift
    await expect(timeAdjustments).toContainText('17:00 - 01:00'); // After 5 PM

    // Suggestion 3: Split shift between multiple employees
    const splitOption = suggestions.locator('[data-testid="split-shift-suggestion"]');
    await expect(splitOption).toBeVisible();
    await expect(splitOption).toContainText('Split shift into 2 shorter shifts');

    // Apply suggestion: Use Bob instead
    await bobCard.click('[data-testid="apply-suggestion-button"]');

    // Employee should update
    await expect(page.locator('[data-testid="employee-select"]')).toHaveValue(employees[1].id);

    // Conflict should be resolved
    await expect(page.locator('[data-testid="conflict-warning"]')).not.toBeVisible();

    // Save should now work
    await expect(page.locator('[data-testid="save-shift-button"]')).toBeEnabled();
  });

  test('should detect conflicts across multiple schedules', async ({ page }) => {
    // Navigate to existing schedule with shifts
    await page.click('[data-testid="schedules-nav"]');
    await page.click('[data-testid="schedule-existing-week-1"]');

    // Verify employee has shifts this week
    await expect(page.locator('[data-testid="employee-shifts"]')).toContainText(testEmployee.name);

    // Create new schedule for same time period
    await page.click('[data-testid="schedules-nav"]');
    await page.click('[data-testid="create-schedule-button"]');
    await page.fill('[data-testid="schedule-name"]', 'Overlapping Schedule');
    await page.fill('[data-testid="start-date"]', '2024-02-01');
    await page.fill('[data-testid="end-date"]', '2024-02-07');

    // Attempt to add shift for same employee
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should detect cross-schedule conflict
    await expect(page.locator('[data-testid="cross-schedule-conflict"]')).toBeVisible();
    await expect(page.locator('[data-testid="cross-schedule-conflict"]')).toContainText('scheduled in another schedule');

    // Show conflicting schedule details
    const conflictInfo = page.locator('[data-testid="conflicting-schedule-info"]');
    await expect(conflictInfo).toBeVisible();
    await expect(conflictInfo).toContainText('Week 1 Schedule');

    // Link to view conflicting schedule
    await expect(page.locator('[data-testid="view-conflicting-schedule-link"]')).toBeVisible();
  });

  test('should validate shift duration limits', async ({ page }) => {
    // Attempt to create 16-hour shift (over maximum)
    await createShift(page, {
      date: '2024-02-05',
      start: '06:00',
      end: '22:00', // 16 hours
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should show duration error
    await expect(page.locator('[data-testid="duration-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="duration-error"]')).toContainText('exceeds maximum shift duration');
    await expect(page.locator('[data-testid="duration-error"]')).toContainText('16 hours');
    await expect(page.locator('[data-testid="duration-error"]')).toContainText('Maximum: 12 hours');

    // Suggest split into two shifts
    await expect(page.locator('[data-testid="split-shift-suggestion"]')).toBeVisible();
    await page.click('[data-testid="apply-split-suggestion-button"]');

    // Should create two 8-hour shifts
    await expect(page.locator('[data-testid="shifts-list"]')).toContainText('Shift 1: 06:00 - 14:00');
    await expect(page.locator('[data-testid="shifts-list"]')).toContainText('Shift 2: 14:00 - 22:00');
  });

  test('should handle complex multi-conflict scenarios', async ({ page }) => {
    // Create scenario with multiple violations:
    // - Overlapping shifts
    // - Max hours exceeded
    // - Insufficient rest

    // Day 1: 9 AM - 9 PM (12 hours)
    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '21:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });
    await saveShift(page);

    // Day 2: 6 AM - 6 PM (12 hours, insufficient rest)
    await createShift(page, {
      date: '2024-02-06',
      start: '06:00',
      end: '18:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Multiple errors should be shown
    const errors = page.locator('[data-testid="validation-errors"]');
    await expect(errors).toBeVisible();

    const errorItems = errors.locator('[data-testid^="error-item-"]');
    await expect(errorItems).toHaveCount({ min: 2 });

    // Check for rest period error
    await expect(errors).toContainText('Insufficient rest period');

    // Continue adding shifts to exceed weekly hours
    const moreShifts = [
      { date: '2024-02-07', start: '09:00', end: '21:00' }, // 12 hours
      { date: '2024-02-08', start: '09:00', end: '21:00' }, // 12 hours
    ];

    for (const shift of moreShifts) {
      await createShift(page, {
        ...shift,
        employeeId: testEmployee.id,
        position: 'Engineer'
      });

      // Override rest period warning
      await page.click('[data-testid="override-warning-button"]');
      await saveShift(page);
    }

    // Now try to add one more shift - should fail on hours limit
    await createShift(page, {
      date: '2024-02-09',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Should show critical error (non-overrideable)
    await expect(page.locator('[data-testid="critical-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="critical-error"]')).toContainText('Cannot override maximum hours limit');

    // No override option available
    await expect(page.locator('[data-testid="override-warning-button"]')).not.toBeVisible();

    // Save button disabled
    await expect(page.locator('[data-testid="save-shift-button"]')).toBeDisabled();
  });
});

// Performance and stress tests
test.describe('Schedule Conflicts - Performance', () => {
  test('should handle conflict detection for large schedules efficiently', async ({ page }) => {
    await login(page, testUsers.manager);

    // Load schedule with 100+ shifts
    await page.goto('/schedules/large-schedule');

    // Measure time to detect conflicts
    const startTime = Date.now();

    await createShift(page, {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employeeId: testEmployee.id,
      position: 'Engineer'
    });

    // Conflict detection should complete within 2 seconds
    await expect(page.locator('[data-testid="conflict-warning"]')).toBeVisible({ timeout: 2000 });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(2000);
  });
});
