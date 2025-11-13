/**
 * Complete Wizard Flow E2E Tests
 *
 * Tests the entire schedule creation wizard from initial configuration
 * through to final publication, including validation, navigation, and error handling.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { rest } from 'msw';
import { createMockServer, renderWithRouter, cleanupTestEnvironment, testData } from '../setup/e2eSetup';

// Mock the ScheduleBuilder component - adjust path as needed
const MockScheduleBuilder = () => <div>Schedule Builder Mock</div>;
const ScheduleBuilder = MockScheduleBuilder;

const server = createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanupTestEnvironment();
});
afterAll(() => server.close());

describe('Complete Wizard Flow E2E Tests', () => {
  test('completes full wizard workflow from configuration to publish', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    // Step 1: Configuration
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Fill in schedule name
    const scheduleNameInput = screen.getByLabelText(/schedule name/i);
    await user.clear(scheduleNameInput);
    await user.type(scheduleNameInput, 'Week of Jan 20-26');
    expect(scheduleNameInput).toHaveValue('Week of Jan 20-26');

    // Select department
    const departmentSelect = screen.getByLabelText(/department/i);
    await user.click(departmentSelect);

    await waitFor(() => {
      expect(screen.getByText('Kitchen')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Kitchen'));

    // Set start date
    const startDate = screen.getByLabelText(/start date/i);
    await user.clear(startDate);
    await user.type(startDate, '2025-01-20');
    expect(startDate).toHaveValue('2025-01-20');

    // Set end date
    const endDate = screen.getByLabelText(/end date/i);
    await user.clear(endDate);
    await user.type(endDate, '2025-01-26');
    expect(endDate).toHaveValue('2025-01-26');

    // Select employees
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    await user.click(screen.getByText('John Doe'));
    await user.click(screen.getByText('Jane Smith'));

    // Verify employee selection
    const selectedEmployees = screen.getAllByRole('checkbox', { checked: true });
    expect(selectedEmployees).toHaveLength(2);

    // Proceed to next step
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    // Step 2: Requirements
    await waitFor(() => {
      expect(screen.getByText(/requirements/i)).toBeInTheDocument();
    });

    // Set max hours per week
    const maxHoursInput = screen.getByLabelText(/max hours per week/i);
    await user.clear(maxHoursInput);
    await user.type(maxHoursInput, '40');
    expect(maxHoursInput).toHaveValue(40);

    // Set min hours per week
    const minHoursInput = screen.getByLabelText(/min hours per week/i);
    await user.clear(minHoursInput);
    await user.type(minHoursInput, '20');
    expect(minHoursInput).toHaveValue(20);

    // Set consecutive days limit
    const consecutiveDaysInput = screen.getByLabelText(/consecutive days/i);
    await user.clear(consecutiveDaysInput);
    await user.type(consecutiveDaysInput, '5');

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: Shift Template Selection
    await waitFor(() => {
      expect(screen.getByText(/shift templates/i)).toBeInTheDocument();
    });

    // Select shift templates
    await waitFor(() => {
      expect(screen.getByText('Morning Shift')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Morning Shift'));
    await user.click(screen.getByText('Evening Shift'));

    // Verify template selection
    const selectedTemplates = screen.getAllByRole('checkbox', { checked: true });
    expect(selectedTemplates.length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: AI Generation
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate schedule/i })).toBeInTheDocument();
    });

    // Click generate button
    const generateButton = screen.getByRole('button', { name: /generate schedule/i });
    await user.click(generateButton);

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.getByText(/schedule generated/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Verify generation results
    expect(screen.getByText(/12 of 14 shifts assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/85.7% coverage/i)).toBeInTheDocument();

    // Check for no conflicts
    expect(screen.queryByText(/conflicts detected/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: Review Schedule
    await waitFor(() => {
      expect(screen.getByText(/review schedule/i)).toBeInTheDocument();
    });

    // Verify schedule details are displayed
    expect(screen.getByText(/Week of Jan 20-26/i)).toBeInTheDocument();
    expect(screen.getByText(/85.7% coverage/i)).toBeInTheDocument();

    // Check that calendar is rendered with assignments
    const calendar = screen.getByTestId('schedule-calendar');
    expect(calendar).toBeInTheDocument();

    // Verify assignment count
    const assignments = within(calendar).getAllByTestId('schedule-assignment');
    expect(assignments.length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: Publish
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publish schedule/i })).toBeInTheDocument();
    });

    // Verify publish confirmation message
    expect(screen.getByText(/ready to publish/i)).toBeInTheDocument();

    // Click publish button
    const publishButton = screen.getByRole('button', { name: /publish schedule/i });
    await user.click(publishButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/schedule published successfully/i)).toBeInTheDocument();
    });

    // Verify redirect or completion state
    expect(screen.getByText(/view schedule/i)).toBeInTheDocument();
  }, 30000);

  test('validates required fields and prevents progress', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Try to proceed without filling required fields
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    // Fill only schedule name
    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');

    // Next button should still be disabled
    expect(nextButton).toBeDisabled();

    // Fill department
    await user.click(screen.getByLabelText(/department/i));
    await user.click(screen.getByText('Kitchen'));

    // Still disabled without dates
    expect(nextButton).toBeDisabled();

    // Fill start date
    await user.type(screen.getByLabelText(/start date/i), '2025-01-20');

    // Still disabled without end date
    expect(nextButton).toBeDisabled();

    // Fill end date
    await user.type(screen.getByLabelText(/end date/i), '2025-01-26');

    // Still disabled without employees
    expect(nextButton).toBeDisabled();

    // Select at least one employee
    await user.click(screen.getByText('John Doe'));

    // Now button should be enabled
    expect(nextButton).toBeEnabled();
  });

  test('validates date range logic', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Fill required fields
    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');
    await user.click(screen.getByLabelText(/department/i));
    await user.click(screen.getByText('Kitchen'));

    // Set end date before start date
    await user.type(screen.getByLabelText(/start date/i), '2025-01-26');
    await user.type(screen.getByLabelText(/end date/i), '2025-01-20');

    // Should show validation error
    expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();

    // Next button should be disabled
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  test('saves and resumes draft workflow', async () => {
    const user = userEvent.setup();

    // Add handler for draft save
    server.use(
      rest.post('/api/schedules/draft', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          draft_id: 'draft-123',
          message: 'Draft saved'
        }));
      })
    );

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Fill in configuration
    await user.type(screen.getByLabelText(/schedule name/i), 'Draft Schedule');
    await user.click(screen.getByLabelText(/department/i));
    await user.click(screen.getByText('Kitchen'));
    await user.type(screen.getByLabelText(/start date/i), '2025-01-20');
    await user.type(screen.getByLabelText(/end date/i), '2025-01-26');
    await user.click(screen.getByText('John Doe'));

    // Click save draft button
    const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
    await user.click(saveDraftButton);

    // Wait for save confirmation
    await waitFor(() => {
      expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
    });

    // Verify draft ID is stored
    expect(localStorage.getItem('scheduleDraftId')).toBe('draft-123');
  });

  test('handles back navigation correctly', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    // Complete step 1
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');
    await user.click(screen.getByLabelText(/department/i));
    await user.click(screen.getByText('Kitchen'));
    await user.type(screen.getByLabelText(/start date/i), '2025-01-20');
    await user.type(screen.getByLabelText(/end date/i), '2025-01-26');
    await user.click(screen.getByText('John Doe'));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // On step 2
    await waitFor(() => {
      expect(screen.getByText(/requirements/i)).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Should be back on step 1
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Verify data is preserved
    expect(screen.getByLabelText(/schedule name/i)).toHaveValue('Test Schedule');
    expect(screen.getByLabelText(/start date/i)).toHaveValue('2025-01-20');
    expect(screen.getByLabelText(/end date/i)).toHaveValue('2025-01-26');
  });

  test('displays progress indicators throughout flow', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Check for progress indicator
    const progressIndicator = screen.getByTestId('wizard-progress');
    expect(progressIndicator).toBeInTheDocument();

    // Verify we're on step 1 of 6
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();

    // Complete step 1 and move to step 2
    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');
    await user.click(screen.getByLabelText(/department/i));
    await user.click(screen.getByText('Kitchen'));
    await user.type(screen.getByLabelText(/start date/i), '2025-01-20');
    await user.type(screen.getByLabelText(/end date/i), '2025-01-26');
    await user.click(screen.getByText('John Doe'));
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Verify progress updated to step 2
    await waitFor(() => {
      expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument();
    });

    // Verify step 1 is marked as complete
    const step1Indicator = screen.getByTestId('step-indicator-1');
    expect(step1Indicator).toHaveClass('completed');
  });

  test('handles keyboard navigation and accessibility', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Tab through form fields
    const scheduleNameInput = screen.getByLabelText(/schedule name/i);
    scheduleNameInput.focus();
    expect(document.activeElement).toBe(scheduleNameInput);

    await user.keyboard('{Tab}');

    // Should focus department select
    const departmentSelect = screen.getByLabelText(/department/i);
    expect(document.activeElement).toBe(departmentSelect);

    // Use Enter to open dropdown
    await user.keyboard('{Enter}');

    // Use arrow keys to navigate options
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    // Verify selection
    expect(departmentSelect).toHaveTextContent('Kitchen');
  });

  test('displays validation errors inline', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Fill schedule name with too few characters
    const scheduleNameInput = screen.getByLabelText(/schedule name/i);
    await user.type(scheduleNameInput, 'AB');
    await user.tab(); // Trigger blur validation

    // Should show validation error
    expect(screen.getByText(/schedule name must be at least 3 characters/i)).toBeInTheDocument();

    // Error should disappear when valid input is provided
    await user.clear(scheduleNameInput);
    await user.type(scheduleNameInput, 'Valid Schedule Name');
    await user.tab();

    expect(screen.queryByText(/schedule name must be at least 3 characters/i)).not.toBeInTheDocument();
  });

  test('handles generation with conflicts', async () => {
    const user = userEvent.setup();

    // Override generation endpoint to return conflicts
    server.use(
      rest.post('/api/schedules/generate', (req, res, ctx) => {
        return res(ctx.json({
          schedule_id: 1,
          assignments: [],
          coverage: { total_shifts: 14, assigned: 8, coverage_percentage: 57.1 },
          conflicts: [
            { employee_id: 1, date: '2025-01-20', reason: 'Double booking' },
            { employee_id: 2, date: '2025-01-22', reason: 'Exceeds max hours' }
          ],
          warnings: ['Low coverage on weekends']
        }));
      })
    );

    renderWithRouter(<ScheduleBuilder />);

    // Navigate to generation step (steps 1-3)
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // ... complete steps 1-3 ...

    // On generation step
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate schedule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /generate schedule/i }));

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/conflicts detected/i)).toBeInTheDocument();
    });

    // Verify conflict details are shown
    expect(screen.getByText(/double booking/i)).toBeInTheDocument();
    expect(screen.getByText(/exceeds max hours/i)).toBeInTheDocument();

    // Verify warnings are shown
    expect(screen.getByText(/low coverage on weekends/i)).toBeInTheDocument();

    // Should offer option to regenerate or manually fix
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manual adjustments/i })).toBeInTheDocument();
  });

  test('supports manual schedule adjustments', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    // Navigate to review step (after generation)
    // ... navigate through steps ...

    await waitFor(() => {
      expect(screen.getByText(/review schedule/i)).toBeInTheDocument();
    });

    // Find an assignment to edit
    const assignment = screen.getAllByTestId('schedule-assignment')[0];
    await user.click(assignment);

    // Edit dialog should open
    await waitFor(() => {
      expect(screen.getByText(/edit assignment/i)).toBeInTheDocument();
    });

    // Change employee
    const employeeSelect = screen.getByLabelText(/employee/i);
    await user.click(employeeSelect);
    await user.click(screen.getByText('Jane Smith'));

    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Verify assignment updated
    await waitFor(() => {
      expect(screen.queryByText(/edit assignment/i)).not.toBeInTheDocument();
    });

    // Verify schedule shows as modified
    expect(screen.getByText(/schedule modified/i)).toBeInTheDocument();
  });

  test('cancels wizard and shows confirmation', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Fill in some data
    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to cancel/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/unsaved changes will be lost/i)).toBeInTheDocument();

    // Confirm cancellation
    await user.click(screen.getByRole('button', { name: /yes, cancel/i }));

    // Should navigate away or reset
    await waitFor(() => {
      expect(screen.queryByLabelText(/schedule name/i)).not.toBeInTheDocument();
    });
  });
});
