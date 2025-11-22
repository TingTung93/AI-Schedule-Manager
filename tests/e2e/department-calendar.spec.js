/**
 * End-to-End Tests for Department Calendar Functionality
 *
 * Tests interactive calendar features:
 * - Multiple view modes (month/week/day)
 * - Filtering by employee and shift type
 * - Inline shift editing
 * - Drag-and-drop rescheduling
 * - Calendar export (PDF)
 */

const { test, expect } = require('@playwright/test');

// Test data
const testUsers = {
  manager: {
    email: 'manager@company.com',
    password: 'Manager123!',
    role: 'manager'
  },
  employee: {
    email: 'employee@company.com',
    password: 'Employee123!',
    role: 'employee'
  }
};

const testShifts = [
  {
    id: 'shift-1',
    date: '2024-02-05',
    start: '09:00',
    end: '17:00',
    employee: 'Alice Johnson',
    type: 'Regular',
    position: 'Engineer'
  },
  {
    id: 'shift-2',
    date: '2024-02-06',
    start: '09:00',
    end: '17:00',
    employee: 'Bob Smith',
    type: 'Regular',
    position: 'Engineer'
  },
  {
    id: 'shift-3',
    date: '2024-02-07',
    start: '14:00',
    end: '22:00',
    employee: 'Charlie Davis',
    type: 'Evening',
    position: 'Senior Engineer'
  },
  {
    id: 'shift-4',
    date: '2024-02-08',
    start: '06:00',
    end: '14:00',
    employee: 'Alice Johnson',
    type: 'Morning',
    position: 'Engineer'
  }
];

// Helper functions
async function login(page, user) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function navigateToCalendar(page) {
  await page.click('[data-testid="calendar-nav"]');
  await expect(page.locator('[data-testid="calendar-container"]')).toBeVisible();
}

test.describe('Department Calendar - View Modes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);
  });

  test('should switch between month, week, and day views', async ({ page }) => {
    // Default view should be week
    await expect(page.locator('[data-testid="calendar-view-mode"]')).toContainText('Week');
    const weekView = page.locator('[data-testid="week-view-container"]');
    await expect(weekView).toBeVisible();

    // Verify week view shows 7 days
    const dayColumns = weekView.locator('[data-testid^="day-column-"]');
    await expect(dayColumns).toHaveCount(7);

    // Switch to month view
    await page.click('[data-testid="month-view-button"]');
    await expect(page.locator('[data-testid="calendar-view-mode"]')).toContainText('Month');

    const monthView = page.locator('[data-testid="month-view-container"]');
    await expect(monthView).toBeVisible();

    // Month view shows calendar grid
    const monthGrid = monthView.locator('[data-testid="month-grid"]');
    await expect(monthGrid).toBeVisible();

    // Should show 4-6 weeks (28-42 days)
    const dateCells = monthGrid.locator('[data-testid^="date-cell-"]');
    const cellCount = await dateCells.count();
    expect(cellCount).toBeGreaterThanOrEqual(28);
    expect(cellCount).toBeLessThanOrEqual(42);

    // Switch to day view
    await page.click('[data-testid="day-view-button"]');
    await expect(page.locator('[data-testid="calendar-view-mode"]')).toContainText('Day');

    const dayView = page.locator('[data-testid="day-view-container"]');
    await expect(dayView).toBeVisible();

    // Day view shows hourly timeline
    const timeline = dayView.locator('[data-testid="hourly-timeline"]');
    await expect(timeline).toBeVisible();

    // Should show 24 hours
    const hourSlots = timeline.locator('[data-testid^="hour-slot-"]');
    await expect(hourSlots).toHaveCount(24);

    // Verify shifts displayed in each view
    for (const view of ['week', 'month', 'day']) {
      await page.click(`[data-testid="${view}-view-button"]`);

      // Should display shifts (at least one visible)
      const shifts = page.locator('[data-testid^="calendar-shift-"]');
      const shiftCount = await shifts.count();
      expect(shiftCount).toBeGreaterThan(0);
    }
  });

  test('should navigate between dates in different views', async ({ page }) => {
    // Week view navigation
    await page.click('[data-testid="week-view-button"]');

    const currentWeek = await page.locator('[data-testid="current-date-range"]').textContent();

    // Navigate to next week
    await page.click('[data-testid="next-period-button"]');
    const nextWeek = await page.locator('[data-testid="current-date-range"]').textContent();
    expect(nextWeek).not.toBe(currentWeek);

    // Navigate to previous week
    await page.click('[data-testid="previous-period-button"]');
    const backToCurrentWeek = await page.locator('[data-testid="current-date-range"]').textContent();
    expect(backToCurrentWeek).toBe(currentWeek);

    // Jump to today
    await page.click('[data-testid="next-period-button"]'); // Go away from current week
    await page.click('[data-testid="today-button"]');
    const todayWeek = await page.locator('[data-testid="current-date-range"]').textContent();
    expect(todayWeek).toBe(currentWeek);

    // Month view navigation
    await page.click('[data-testid="month-view-button"]');

    const currentMonth = await page.locator('[data-testid="current-month-year"]').textContent();

    await page.click('[data-testid="next-period-button"]');
    const nextMonth = await page.locator('[data-testid="current-month-year"]').textContent();
    expect(nextMonth).not.toBe(currentMonth);

    await page.click('[data-testid="previous-period-button"]');
    const backToCurrentMonth = await page.locator('[data-testid="current-month-year"]').textContent();
    expect(backToCurrentMonth).toBe(currentMonth);

    // Day view navigation
    await page.click('[data-testid="day-view-button"]');

    const currentDay = await page.locator('[data-testid="current-date"]').textContent();

    await page.click('[data-testid="next-period-button"]');
    const nextDay = await page.locator('[data-testid="current-date"]').textContent();
    expect(nextDay).not.toBe(currentDay);

    await page.click('[data-testid="previous-period-button"]');
    const backToCurrentDay = await page.locator('[data-testid="current-date"]').textContent();
    expect(backToCurrentDay).toBe(currentDay);
  });

  test('should use date picker to jump to specific date', async ({ page }) => {
    // Open date picker
    await page.click('[data-testid="date-picker-button"]');

    const datePicker = page.locator('[data-testid="date-picker-dialog"]');
    await expect(datePicker).toBeVisible();

    // Select specific date
    await page.click('[data-testid="date-2024-03-15"]');

    // Verify calendar updated
    await expect(page.locator('[data-testid="current-date"]')).toContainText('March 15');

    // Date picker should close
    await expect(datePicker).not.toBeVisible();
  });
});

test.describe('Department Calendar - Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);
  });

  test('should filter calendar by employee', async ({ page }) => {
    // Get initial shift count
    const initialShifts = page.locator('[data-testid^="calendar-shift-"]');
    const initialCount = await initialShifts.count();
    expect(initialCount).toBeGreaterThan(0);

    // Open employee filter
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="filter-by-employee-tab"]');

    // Select specific employee
    await page.click('[data-testid="employee-filter-Alice Johnson"]');
    await page.click('[data-testid="apply-filters-button"]');

    // Verify only Alice's shifts visible
    const filteredShifts = page.locator('[data-testid^="calendar-shift-"]');
    const filteredCount = await filteredShifts.count();

    expect(filteredCount).toBeLessThan(initialCount);

    // All visible shifts should be for Alice
    for (let i = 0; i < filteredCount; i++) {
      const shift = filteredShifts.nth(i);
      await expect(shift.locator('[data-testid="shift-employee"]')).toContainText('Alice Johnson');
    }

    // Verify filter indicator
    await expect(page.locator('[data-testid="active-filters-badge"]')).toContainText('1');
    await expect(page.locator('[data-testid="filter-chip-employee"]')).toContainText('Alice Johnson');

    // Clear filter
    await page.click('[data-testid="clear-filters-button"]');

    // All shifts should be visible again
    const clearedShifts = page.locator('[data-testid^="calendar-shift-"]');
    const clearedCount = await clearedShifts.count();
    expect(clearedCount).toBe(initialCount);
  });

  test('should filter calendar by shift type', async ({ page }) => {
    // Filter by "Evening" shifts
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="filter-by-type-tab"]');
    await page.click('[data-testid="type-filter-Evening"]');
    await page.click('[data-testid="apply-filters-button"]');

    // Verify only evening shifts visible
    const eveningShifts = page.locator('[data-testid^="calendar-shift-"]');
    const eveningCount = await eveningShifts.count();

    for (let i = 0; i < eveningCount; i++) {
      const shift = eveningShifts.nth(i);
      await expect(shift.locator('[data-testid="shift-type-badge"]')).toContainText('Evening');
    }

    // Filter chip should show
    await expect(page.locator('[data-testid="filter-chip-type"]')).toContainText('Evening');
  });

  test('should combine multiple filters', async ({ page }) => {
    // Apply employee and type filters
    await page.click('[data-testid="filter-button"]');

    // Select employee
    await page.click('[data-testid="filter-by-employee-tab"]');
    await page.click('[data-testid="employee-filter-Alice Johnson"]');

    // Select shift type
    await page.click('[data-testid="filter-by-type-tab"]');
    await page.click('[data-testid="type-filter-Regular"]');

    await page.click('[data-testid="apply-filters-button"]');

    // Verify both filters active
    await expect(page.locator('[data-testid="active-filters-badge"]')).toContainText('2');

    // Verify shifts match both criteria
    const filteredShifts = page.locator('[data-testid^="calendar-shift-"]');
    const count = await filteredShifts.count();

    for (let i = 0; i < count; i++) {
      const shift = filteredShifts.nth(i);
      await expect(shift.locator('[data-testid="shift-employee"]')).toContainText('Alice Johnson');
      await expect(shift.locator('[data-testid="shift-type-badge"]')).toContainText('Regular');
    }
  });

  test('should filter by position/role', async ({ page }) => {
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="filter-by-position-tab"]');
    await page.click('[data-testid="position-filter-Senior Engineer"]');
    await page.click('[data-testid="apply-filters-button"]');

    const seniorShifts = page.locator('[data-testid^="calendar-shift-"]');
    const count = await seniorShifts.count();

    for (let i = 0; i < count; i++) {
      const shift = seniorShifts.nth(i);
      await expect(shift.locator('[data-testid="shift-position"]')).toContainText('Senior Engineer');
    }
  });
});

test.describe('Department Calendar - Shift Editing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);
  });

  test('should edit shift inline by clicking', async ({ page }) => {
    // Click on shift to view details
    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');
    await shift.click();

    // Shift details modal should appear
    const modal = page.locator('[data-testid="shift-details-modal"]');
    await expect(modal).toBeVisible();

    // Verify shift details
    await expect(modal.locator('[data-testid="shift-employee"]')).toContainText('Alice Johnson');
    await expect(modal.locator('[data-testid="shift-time"]')).toContainText('09:00 - 17:00');
    await expect(modal.locator('[data-testid="shift-position"]')).toContainText('Engineer');

    // Click edit button
    await modal.click('[data-testid="edit-shift-button"]');

    // Edit form should appear
    await expect(modal.locator('[data-testid="shift-edit-form"]')).toBeVisible();

    // Modify shift time
    await modal.fill('[data-testid="shift-start-input"]', '10:00');
    await modal.fill('[data-testid="shift-end-input"]', '18:00');

    // Save changes
    await modal.click('[data-testid="save-changes-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift updated');

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Verify shift updated on calendar
    await shift.click();
    await expect(modal.locator('[data-testid="shift-time"]')).toContainText('10:00 - 18:00');
  });

  test('should quick edit shift time with double-click', async ({ page }) => {
    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');

    // Double-click shift
    await shift.dblclick();

    // Inline edit should activate
    const inlineEditor = shift.locator('[data-testid="inline-time-editor"]');
    await expect(inlineEditor).toBeVisible();

    // Update time
    await inlineEditor.fill('[data-testid="quick-start-input"]', '08:00');
    await inlineEditor.fill('[data-testid="quick-end-input"]', '16:00');

    // Save with Enter key
    await page.keyboard.press('Enter');

    // Verify update
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift updated');

    // Inline editor should close
    await expect(inlineEditor).not.toBeVisible();
  });

  test('should delete shift from calendar', async ({ page }) => {
    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');
    await shift.click();

    const modal = page.locator('[data-testid="shift-details-modal"]');
    await modal.click('[data-testid="delete-shift-button"]');

    // Confirmation dialog
    const confirmDialog = page.locator('[data-testid="confirm-delete-dialog"]');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('delete this shift');

    await confirmDialog.click('[data-testid="confirm-delete-button"]');

    // Verify deletion
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift deleted');

    // Shift should no longer appear on calendar
    await expect(shift).not.toBeVisible();
  });
});

test.describe('Department Calendar - Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);
  });

  test('should reschedule shift by dragging to different day', async ({ page }) => {
    // Switch to week view for easier drag-and-drop
    await page.click('[data-testid="week-view-button"]');

    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');
    const targetDay = page.locator('[data-testid="day-column-2024-02-07"]');

    // Get initial position
    const shiftBox = await shift.boundingBox();
    const targetBox = await targetDay.boundingBox();

    // Drag shift to Wednesday
    await page.mouse.move(shiftBox.x + shiftBox.width / 2, shiftBox.y + shiftBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 100);
    await page.mouse.up();

    // Confirmation dialog should appear
    const confirmDialog = page.locator('[data-testid="confirm-reschedule-dialog"]');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Move shift to February 7');

    await confirmDialog.click('[data-testid="confirm-button"]');

    // Verify shift moved
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Shift rescheduled');

    // Shift should now appear in Wednesday column
    const wednesdayShifts = targetDay.locator('[data-testid^="calendar-shift-"]');
    await expect(wednesdayShifts).toContainText('Alice Johnson');
  });

  test('should adjust shift time by dragging in day view', async ({ page }) => {
    await page.click('[data-testid="day-view-button"]');

    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');

    // Drag bottom edge to extend shift
    const resizeHandle = shift.locator('[data-testid="resize-handle-bottom"]');
    const handleBox = await resizeHandle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + 100); // Drag down 100px (about 2 hours)
    await page.mouse.up();

    // Verify time updated
    await shift.click();
    const modal = page.locator('[data-testid="shift-details-modal"]');
    await expect(modal.locator('[data-testid="shift-time"]')).toContainText('09:00 - 19:00');
  });

  test('should prevent invalid drag-and-drop operations', async ({ page }) => {
    await page.click('[data-testid="week-view-button"]');

    // Try to drag shift to past date
    const shift = page.locator('[data-testid="calendar-shift-shift-1"]');
    const pastDay = page.locator('[data-testid="day-column-2024-01-15"]');

    // If past day visible (should show as disabled)
    const isPastDayPresent = await pastDay.count() > 0;
    if (isPastDayPresent) {
      await expect(pastDay).toHaveClass(/disabled/);

      // Attempt drag
      const shiftBox = await shift.boundingBox();
      const pastBox = await pastDay.boundingBox();

      await page.mouse.move(shiftBox.x + shiftBox.width / 2, shiftBox.y + shiftBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(pastBox.x + pastBox.width / 2, pastBox.y + 100);
      await page.mouse.up();

      // Should show error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Cannot schedule in the past');

      // Shift should return to original position
      await expect(shift).toBeVisible();
    }
  });

  test('should show conflict warning when dragging to occupied slot', async ({ page }) => {
    await page.click('[data-testid="day-view-button"]');

    // Drag shift to time slot occupied by another shift
    const shift1 = page.locator('[data-testid="calendar-shift-shift-1"]');
    const shift2 = page.locator('[data-testid="calendar-shift-shift-2"]');

    const shift2Box = await shift2.boundingBox();

    const shift1Box = await shift1.boundingBox();
    await page.mouse.move(shift1Box.x + shift1Box.width / 2, shift1Box.y + shift1Box.height / 2);
    await page.mouse.down();
    await page.mouse.move(shift2Box.x + shift2Box.width / 2, shift2Box.y + shift2Box.height / 2);

    // Conflict indicator should show
    await expect(page.locator('[data-testid="drop-conflict-indicator"]')).toBeVisible();

    await page.mouse.up();

    // Conflict dialog should appear
    await expect(page.locator('[data-testid="conflict-warning-dialog"]')).toBeVisible();
  });
});

test.describe('Department Calendar - Export', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);
  });

  test('should export calendar view to PDF', async ({ page }) => {
    // Switch to month view for export
    await page.click('[data-testid="month-view-button"]');

    // Open export menu
    await page.click('[data-testid="export-button"]');

    const exportMenu = page.locator('[data-testid="export-menu"]');
    await expect(exportMenu).toBeVisible();

    // Select PDF format
    await exportMenu.click('[data-testid="export-pdf-option"]');

    // Export configuration dialog
    const configDialog = page.locator('[data-testid="export-config-dialog"]');
    await expect(configDialog).toBeVisible();

    // Configure export
    await configDialog.check('[data-testid="include-employee-names"]');
    await configDialog.check('[data-testid="include-shift-times"]');
    await configDialog.check('[data-testid="color-code-types"]');
    await configDialog.selectOption('[data-testid="page-orientation"]', 'landscape');

    // Initiate download
    const downloadPromise = page.waitForEvent('download');
    await configDialog.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/calendar.*\.pdf/);

    // Success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Calendar exported');
  });

  test('should export filtered calendar view', async ({ page }) => {
    // Apply filters
    await page.click('[data-testid="filter-button"]');
    await page.click('[data-testid="employee-filter-Alice Johnson"]');
    await page.click('[data-testid="apply-filters-button"]');

    // Export with filters
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-pdf-option"]');

    const configDialog = page.locator('[data-testid="export-config-dialog"]');

    // Should note active filters
    await expect(configDialog.locator('[data-testid="active-filters-notice"]')).toContainText('Active filters will be applied');

    const downloadPromise = page.waitForEvent('download');
    await configDialog.click('[data-testid="export-button"]');
    await downloadPromise;
  });

  test('should export to CSV format', async ({ page }) => {
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-csv-option"]');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="confirm-export-button"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/calendar.*\.csv/);
  });

  test('should print calendar view', async ({ page }) => {
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="print-option"]');

    // Print dialog should be triggered
    // (In real test, we would verify print CSS and layout)
  });
});

// Accessibility tests for calendar
test.describe('Department Calendar - Accessibility', () => {
  test('should support keyboard navigation in calendar', async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);

    // Tab through calendar elements
    await page.keyboard.press('Tab'); // Focus first shift
    await expect(page.locator('[data-testid^="calendar-shift-"]:first-child')).toBeFocused();

    // Arrow keys to navigate between shifts
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Enter to open shift details
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="shift-details-modal"]')).toBeVisible();

    // Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="shift-details-modal"]')).not.toBeVisible();
  });

  test('should have proper ARIA labels for calendar components', async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);

    // Calendar should be marked as application
    await expect(page.locator('[role="application"]')).toBeVisible();

    // Grid structure
    await expect(page.locator('[role="grid"]')).toBeVisible();

    // Shifts should have labels
    const shifts = page.locator('[data-testid^="calendar-shift-"]');
    const firstShift = shifts.first();
    await expect(firstShift).toHaveAttribute('aria-label', /.*shift.*/i);
  });
});

// Mobile calendar tests
test.describe('Department Calendar - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display responsive calendar on mobile', async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);

    // Mobile calendar should adapt
    await expect(page.locator('[data-testid="mobile-calendar-view"]')).toBeVisible();

    // Should default to day view on mobile
    await expect(page.locator('[data-testid="calendar-view-mode"]')).toContainText('Day');
  });

  test('should support swipe gestures on mobile calendar', async ({ page }) => {
    await login(page, testUsers.manager);
    await navigateToCalendar(page);

    const calendar = page.locator('[data-testid="calendar-container"]');
    const box = await calendar.boundingBox();

    // Swipe left to go to next day
    await page.touchscreen.swipe(
      { x: box.x + box.width - 50, y: box.y + box.height / 2 },
      { x: box.x + 50, y: box.y + box.height / 2 }
    );

    // Date should change
    // (Verification depends on implementation)
  });
});
