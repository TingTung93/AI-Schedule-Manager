/**
 * Calendar Interactions E2E Tests
 *
 * Tests all calendar-related functionality including event creation,
 * editing, deletion, view switching, navigation, and filtering.
 */

import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { createMockServer, renderWithRouter, cleanupTestEnvironment, testData } from '../setup/e2eSetup';

// Mock calendar component - adjust path as needed
const MockCalendar = () => <div data-testid="calendar">Calendar Mock</div>;
const Calendar = MockCalendar;

const server = createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanupTestEnvironment();
});
afterAll(() => server.close());

describe('Calendar Interactions E2E Tests', () => {
  test('creates event by drag-selecting dates', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/shifts', (req, res, ctx) => {
        return res(ctx.json({
          id: 100,
          ...req.body,
          created_at: new Date().toISOString()
        }));
      })
    );

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Find date cells
    const startDateCell = screen.getByTestId('date-cell-2025-01-20');
    const endDateCell = screen.getByTestId('date-cell-2025-01-22');

    // Simulate drag selection
    fireEvent.mouseDown(startDateCell);
    fireEvent.mouseEnter(endDateCell);
    fireEvent.mouseUp(endDateCell);

    // Event creation dialog should open
    await waitFor(() => {
      expect(screen.getByText(/create shift/i)).toBeInTheDocument();
    });

    // Verify date range is pre-filled
    expect(screen.getByLabelText(/start date/i)).toHaveValue('2025-01-20');
    expect(screen.getByLabelText(/end date/i)).toHaveValue('2025-01-22');

    // Fill in shift details
    await user.type(screen.getByLabelText(/shift name/i), 'New Morning Shift');

    const startTime = screen.getByLabelText(/start time/i);
    await user.clear(startTime);
    await user.type(startTime, '08:00');

    const endTime = screen.getByLabelText(/end time/i);
    await user.clear(endTime);
    await user.type(endTime, '16:00');

    // Select employee
    await user.click(screen.getByLabelText(/employee/i));
    await user.click(screen.getByText('John Doe'));

    // Save shift
    await user.click(screen.getByRole('button', { name: /create shift/i }));

    // Verify shift appears on calendar
    await waitFor(() => {
      expect(screen.getByText('New Morning Shift')).toBeInTheDocument();
    });
  });

  test('edits existing event by clicking', async () => {
    const user = userEvent.setup();

    server.use(
      rest.put('/api/shifts/:id', (req, res, ctx) => {
        return res(ctx.json({
          id: req.params.id,
          ...req.body,
          updated_at: new Date().toISOString()
        }));
      })
    );

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Wait for shifts to load
    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
    });

    // Click on existing shift
    const shiftEvent = screen.getByText('Morning Shift');
    await user.click(shiftEvent);

    // Edit dialog should open
    await waitFor(() => {
      expect(screen.getByText(/edit shift/i)).toBeInTheDocument();
    });

    // Verify current values are loaded
    expect(screen.getByLabelText(/shift name/i)).toHaveValue('Morning Shift');

    // Modify shift name
    const nameInput = screen.getByLabelText(/shift name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Morning Shift');

    // Modify time
    const startTime = screen.getByLabelText(/start time/i);
    await user.clear(startTime);
    await user.type(startTime, '07:00');

    // Save changes
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // Verify shift updated on calendar
    await waitFor(() => {
      expect(screen.getByText('Updated Morning Shift')).toBeInTheDocument();
      expect(screen.queryByText('Morning Shift')).not.toBeInTheDocument();
    });

    // Verify time updated
    expect(screen.getByText(/7:00 AM/i)).toBeInTheDocument();
  });

  test('deletes event with confirmation', async () => {
    const user = userEvent.setup();

    server.use(
      rest.delete('/api/shifts/:id', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
    });

    // Click on shift to open edit dialog
    await user.click(screen.getByText('Morning Shift'));

    await waitFor(() => {
      expect(screen.getByText(/edit shift/i)).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });

    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));

    // Shift should be removed from calendar
    await waitFor(() => {
      expect(screen.queryByText('Morning Shift')).not.toBeInTheDocument();
    });

    // Success message should appear
    expect(screen.getByText(/shift deleted successfully/i)).toBeInTheDocument();
  });

  test('switches between calendar views (month, week, day)', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Default should be month view
    expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-view', 'month');

    // Switch to week view
    const weekViewButton = screen.getByRole('button', { name: /week/i });
    await user.click(weekViewButton);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-view', 'week');
    });

    // Verify week view shows correct days
    expect(screen.getByText(/monday/i)).toBeInTheDocument();
    expect(screen.getByText(/sunday/i)).toBeInTheDocument();

    // Switch to day view
    const dayViewButton = screen.getByRole('button', { name: /day/i });
    await user.click(dayViewButton);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-view', 'day');
    });

    // Verify day view shows hourly slots
    expect(screen.getByText(/8:00 AM/i)).toBeInTheDocument();
    expect(screen.getByText(/5:00 PM/i)).toBeInTheDocument();

    // Switch back to month view
    const monthViewButton = screen.getByRole('button', { name: /month/i });
    await user.click(monthViewButton);

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-view', 'month');
    });
  });

  test('navigates between dates (prev, next, today)', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Current month should be displayed
    const currentMonthDisplay = screen.getByTestId('calendar-month-display');
    expect(currentMonthDisplay).toHaveTextContent(/january 2025/i);

    // Click next month
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(currentMonthDisplay).toHaveTextContent(/february 2025/i);
    });

    // Click next again
    await user.click(nextButton);

    await waitFor(() => {
      expect(currentMonthDisplay).toHaveTextContent(/march 2025/i);
    });

    // Click previous month
    const prevButton = screen.getByRole('button', { name: /previous/i });
    await user.click(prevButton);

    await waitFor(() => {
      expect(currentMonthDisplay).toHaveTextContent(/february 2025/i);
    });

    // Click today button
    const todayButton = screen.getByRole('button', { name: /today/i });
    await user.click(todayButton);

    await waitFor(() => {
      expect(currentMonthDisplay).toHaveTextContent(/january 2025/i);
    });

    // Verify today's date is highlighted
    const todayCell = screen.getByTestId('date-cell-today');
    expect(todayCell).toHaveClass('today');
  });

  test('handles mobile touch interactions', async () => {
    // Simulate mobile viewport
    global.innerWidth = 375;
    global.innerHeight = 667;
    fireEvent(window, new Event('resize'));

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Find a shift event
    const shiftEvent = screen.getByText('Morning Shift');

    // Simulate touch start
    fireEvent.touchStart(shiftEvent, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    // Simulate touch end (tap)
    fireEvent.touchEnd(shiftEvent, {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    });

    // Edit dialog should open
    await waitFor(() => {
      expect(screen.getByText(/edit shift/i)).toBeInTheDocument();
    });

    // Swipe gesture for navigation
    const calendar = screen.getByTestId('calendar');

    // Swipe left (next)
    fireEvent.touchStart(calendar, {
      touches: [{ clientX: 300, clientY: 300 }]
    });

    fireEvent.touchMove(calendar, {
      touches: [{ clientX: 100, clientY: 300 }]
    });

    fireEvent.touchEnd(calendar, {
      changedTouches: [{ clientX: 100, clientY: 300 }]
    });

    // Calendar should advance to next period
    await waitFor(() => {
      const monthDisplay = screen.getByTestId('calendar-month-display');
      expect(monthDisplay).toHaveTextContent(/february 2025/i);
    });
  });

  test('integrates with filters to show/hide shifts', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Initially all shifts visible
    expect(screen.getByText('Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('Evening Shift')).toBeInTheDocument();

    // Open filters
    const filterButton = screen.getByRole('button', { name: /filters/i });
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByText(/filter options/i)).toBeInTheDocument();
    });

    // Filter by department
    const departmentFilter = screen.getByLabelText(/department/i);
    await user.click(departmentFilter);
    await user.click(screen.getByText('Kitchen'));

    // Apply filters
    await user.click(screen.getByRole('button', { name: /apply/i }));

    // Only Kitchen shifts should be visible
    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
      expect(screen.queryByText('Day Service')).not.toBeInTheDocument();
    });

    // Filter by employee
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/employee/i)).toBeInTheDocument();
    });

    const employeeFilter = screen.getByLabelText(/employee/i);
    await user.click(employeeFilter);
    await user.click(screen.getByText('John Doe'));

    await user.click(screen.getByRole('button', { name: /apply/i }));

    // Only John's shifts should be visible
    await waitFor(() => {
      const shifts = screen.getAllByTestId('calendar-shift');
      shifts.forEach(shift => {
        expect(within(shift).getByText(/john doe/i)).toBeInTheDocument();
      });
    });

    // Clear filters
    await user.click(filterButton);
    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    // All shifts should be visible again
    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
      expect(screen.getByText('Evening Shift')).toBeInTheDocument();
      expect(screen.getByText('Day Service')).toBeInTheDocument();
    });
  });

  test('integrates with search to highlight matching shifts', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Open search
    const searchInput = screen.getByPlaceholderText(/search shifts/i);
    expect(searchInput).toBeInTheDocument();

    // Search for employee name
    await user.type(searchInput, 'John');

    // Shifts assigned to John should be highlighted
    await waitFor(() => {
      const johnShifts = screen.getAllByTestId('calendar-shift-highlighted');
      expect(johnShifts.length).toBeGreaterThan(0);

      johnShifts.forEach(shift => {
        expect(shift).toHaveClass('highlighted');
      });
    });

    // Other shifts should be dimmed
    const allShifts = screen.getAllByTestId('calendar-shift');
    const dimmedShifts = allShifts.filter(shift => !shift.classList.contains('highlighted'));
    dimmedShifts.forEach(shift => {
      expect(shift).toHaveClass('dimmed');
    });

    // Clear search
    await user.clear(searchInput);

    // All shifts should return to normal
    await waitFor(() => {
      const shifts = screen.getAllByTestId('calendar-shift');
      shifts.forEach(shift => {
        expect(shift).not.toHaveClass('highlighted');
        expect(shift).not.toHaveClass('dimmed');
      });
    });
  });

  test('displays shift tooltips on hover', async () => {
    const user = userEvent.setup();

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Hover over a shift
    const shift = screen.getByText('Morning Shift');
    await user.hover(shift);

    // Tooltip should appear with shift details
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    const tooltip = screen.getByRole('tooltip');
    expect(within(tooltip).getByText('Morning Shift')).toBeInTheDocument();
    expect(within(tooltip).getByText(/8:00 AM - 4:00 PM/i)).toBeInTheDocument();
    expect(within(tooltip).getByText(/john doe/i)).toBeInTheDocument();

    // Unhover
    await user.unhover(shift);

    // Tooltip should disappear
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('handles drag-and-drop to reschedule shifts', async () => {
    const user = userEvent.setup();

    server.use(
      rest.put('/api/shifts/:id', (req, res, ctx) => {
        return res(ctx.json({
          id: req.params.id,
          ...req.body,
          updated_at: new Date().toISOString()
        }));
      })
    );

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Find shift to drag
    const shift = screen.getByText('Morning Shift');
    const sourceDate = screen.getByTestId('date-cell-2025-01-20');
    const targetDate = screen.getByTestId('date-cell-2025-01-22');

    // Simulate drag and drop
    fireEvent.dragStart(shift);
    fireEvent.dragEnter(targetDate);
    fireEvent.dragOver(targetDate);
    fireEvent.drop(targetDate);
    fireEvent.dragEnd(shift);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/reschedule shift/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/move to january 22/i)).toBeInTheDocument();

    // Confirm reschedule
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // Shift should appear in new date
    await waitFor(() => {
      const newDateCell = screen.getByTestId('date-cell-2025-01-22');
      expect(within(newDateCell).getByText('Morning Shift')).toBeInTheDocument();
    });

    // Shift should be removed from original date
    const originalDateCell = screen.getByTestId('date-cell-2025-01-20');
    expect(within(originalDateCell).queryByText('Morning Shift')).not.toBeInTheDocument();
  });

  test('shows loading state when fetching shifts', async () => {
    server.use(
      rest.get('/api/shifts', (req, res, ctx) => {
        return res(ctx.delay(2000), ctx.json([]));
      })
    );

    renderWithRouter(<Calendar />);

    // Loading indicator should be visible
    expect(screen.getByTestId('calendar-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading shifts/i)).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('calendar-loading')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Calendar should be displayed
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
  });

  test('handles empty state when no shifts exist', async () => {
    server.use(
      rest.get('/api/shifts', (req, res, ctx) => {
        return res(ctx.json([]));
      })
    );

    renderWithRouter(<Calendar />);

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Empty state message should be displayed
    expect(screen.getByText(/no shifts scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first shift/i)).toBeInTheDocument();

    // Create shift button should be available
    expect(screen.getByRole('button', { name: /create shift/i })).toBeInTheDocument();
  });
});
