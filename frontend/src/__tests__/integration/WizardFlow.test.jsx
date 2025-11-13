/**
 * Integration tests for Schedule Builder Wizard Flow
 *
 * Tests the complete schedule creation workflow through the wizard interface,
 * including configuration, employee selection, shift assignment, validation,
 * and publishing.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { BrowserRouter } from 'react-router-dom';
import ScheduleBuilder from '../../pages/ScheduleBuilder';

// Mock API handlers
const server = setupServer(
  // Create schedule
  rest.post('/api/schedules', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 1,
        weekStart: '2025-11-17',
        weekEnd: '2025-11-23',
        title: 'Test Schedule',
        status: 'draft',
        createdBy: 1,
        version: 1,
      })
    );
  }),

  // Get employees
  rest.get('/api/employees', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          name: 'Alice Manager',
          email: 'alice@test.com',
          role: 'manager',
          qualifications: ['management', 'customer_service'],
          maxHoursPerWeek: 40,
        },
        {
          id: 2,
          name: 'Bob Server',
          email: 'bob@test.com',
          role: 'server',
          qualifications: ['customer_service'],
          maxHoursPerWeek: 35,
        },
        {
          id: 3,
          name: 'Carol Cashier',
          email: 'carol@test.com',
          role: 'cashier',
          qualifications: ['cashier'],
          maxHoursPerWeek: 30,
        },
      ])
    );
  }),

  // Get shift templates
  rest.get('/api/shifts/templates', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          name: 'Morning Shift',
          shiftType: 'morning',
          startTime: '09:00',
          endTime: '17:00',
          requiredStaff: 2,
        },
        {
          id: 2,
          name: 'Evening Shift',
          shiftType: 'evening',
          startTime: '14:00',
          endTime: '22:00',
          requiredStaff: 1,
        },
      ])
    );
  }),

  // Generate AI schedule
  rest.post('/api/schedules/:id/generate', (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'optimal',
        assignments: [
          {
            id: 1,
            employeeId: 1,
            shiftId: 1,
            status: 'assigned',
          },
          {
            id: 2,
            employeeId: 2,
            shiftId: 2,
            status: 'assigned',
          },
        ],
        conflicts: [],
        coverage: {
          totalShifts: 10,
          coveredShifts: 8,
          coveragePercentage: 80,
        },
      })
    );
  }),

  // Validate schedule
  rest.post('/api/schedules/:id/validate', (req, res, ctx) => {
    return res(
      ctx.json({
        isValid: true,
        conflicts: [],
        warnings: [],
        coverage: {
          totalShifts: 10,
          coveredShifts: 8,
          coveragePercentage: 80,
        },
      })
    );
  }),

  // Bulk create assignments
  rest.post('/api/assignments/bulk', (req, res, ctx) => {
    const body = req.body;
    return res(
      ctx.status(201),
      ctx.json({
        totalCreated: body.assignments?.length || 0,
        created: body.assignments?.map((a, i) => ({
          id: i + 1,
          ...a,
          status: 'assigned',
        })) || [],
        errors: [],
      })
    );
  }),

  // Publish schedule
  rest.post('/api/schedules/:id/publish', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 1,
        status: 'published',
        publishedAt: new Date().toISOString(),
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Helper to render with router
const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Schedule Builder Wizard Flow', () => {
  test('completes full wizard workflow from start to publish', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Step 1: Configuration
    await waitFor(() => {
      expect(screen.getByText(/configuration/i)).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText(/schedule name/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Weekly Schedule Nov 17-23');

    const startDateInput = screen.getByLabelText(/start date/i);
    await user.type(startDateInput, '2025-11-17');

    const endDateInput = screen.getByLabelText(/end date/i);
    await user.type(endDateInput, '2025-11-23');

    // Click Next
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Step 2: Employee Selection
    await waitFor(() => {
      expect(screen.getByText(/select employees/i)).toBeInTheDocument();
    });

    // Select employees
    const employeeCheckboxes = await screen.findAllByRole('checkbox');
    for (const checkbox of employeeCheckboxes) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: Shift Templates
    await waitFor(() => {
      expect(screen.getByText(/shift templates/i)).toBeInTheDocument();
    });

    // Select shift templates
    const shiftCheckboxes = await screen.findAllByRole('checkbox');
    for (const checkbox of shiftCheckboxes.slice(0, 2)) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: AI Generation
    await waitFor(() => {
      expect(screen.getByText(/generate schedule/i)).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: /generate/i });
    await user.click(generateButton);

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.getByText(/generation complete/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: Review & Validate
    await waitFor(() => {
      expect(screen.getByText(/review/i)).toBeInTheDocument();
    });

    // Validate should run automatically or on button click
    const validateButton = screen.queryByRole('button', { name: /validate/i });
    if (validateButton) {
      await user.click(validateButton);
    }

    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 6: Publish
    await waitFor(() => {
      expect(screen.getByText(/publish/i)).toBeInTheDocument();
    });

    const publishButton = screen.getByRole('button', { name: /publish schedule/i });
    await user.click(publishButton);

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/successfully published/i)).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully during schedule creation', async () => {
    // Override handler to return error
    server.use(
      rest.post('/api/schedules', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ detail: 'Database connection failed' })
        );
      })
    );

    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  test('validates employee selection before proceeding', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Navigate to employee selection without configuring schedule
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Test');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Try to proceed without selecting employees
    await waitFor(() => {
      expect(screen.getByText(/select employees/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/select at least one employee/i)).toBeInTheDocument();
    });
  });

  test('allows navigation between wizard steps', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Complete first step
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Test Schedule');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Go to step 2
    await waitFor(() => {
      expect(screen.getByText(/select employees/i)).toBeInTheDocument();
    });

    // Navigate back
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Should be back at step 1
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    // Value should be preserved
    expect(screen.getByLabelText(/schedule name/i)).toHaveValue('Test Schedule');
  });

  test('displays generation progress and results', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Navigate to generation step (simplified navigation)
    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Test');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Select employees
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      user.click(checkboxes[0]);
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Select shifts
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      user.click(checkboxes[0]);
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    // Generate
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /generate/i }));

    // Should show progress
    await waitFor(() => {
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });

    // Should show results
    await waitFor(() => {
      expect(screen.getByText(/80%/i)).toBeInTheDocument(); // Coverage percentage
    });
  });

  test('handles conflicts during validation', async () => {
    // Override validation to return conflicts
    server.use(
      rest.post('/api/schedules/:id/validate', (req, res, ctx) => {
        return res(
          ctx.json({
            isValid: false,
            conflicts: [
              {
                type: 'double_booking',
                severity: 'high',
                description: 'Employee 1 assigned to overlapping shifts',
                employeeId: 1,
                shiftIds: [1, 2],
              },
            ],
            warnings: ['Low coverage on weekends'],
          })
        );
      })
    );

    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Navigate through wizard to validation step (simplified)
    // ... (navigation code similar to above)

    // When validation runs, should display conflicts
    await waitFor(() => {
      expect(screen.getByText(/conflicts detected/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/double_booking/i)).toBeInTheDocument();
    expect(screen.getByText(/Employee 1/i)).toBeInTheDocument();
  });

  test('saves draft and allows resuming', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/schedule name/i), 'Draft Schedule');

    // Click save draft button
    const saveDraftButton = screen.getByRole('button', { name: /save draft/i });
    await user.click(saveDraftButton);

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
    });
  });

  test('displays coverage summary correctly', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Navigate to review step (simplified)
    // After generation completes, coverage should be displayed

    await waitFor(() => {
      // These would appear after generation
      expect(screen.queryByText(/80% coverage/i)).toBeInTheDocument();
      expect(screen.queryByText(/8 of 10 shifts covered/i)).toBeInTheDocument();
    });
  });

  test('confirms before publishing', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    // Navigate to publish step (simplified)

    await waitFor(() => {
      const publishButton = screen.getByRole('button', { name: /publish/i });
      user.click(publishButton);
    });

    // Should show confirmation dialog
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    // Confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Should publish
    await waitFor(() => {
      expect(screen.getByText(/published/i)).toBeInTheDocument();
    });
  });
});

describe('Schedule Builder Accessibility', () => {
  test('has proper ARIA labels on form inputs', async () => {
    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/schedule name/i);
      expect(titleInput).toHaveAttribute('aria-label');
    });
  });

  test('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ScheduleBuilder />);

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/schedule name/i);
      titleInput.focus();
    });

    // Tab through form fields
    await user.tab();

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toHaveFocus();
  });
});
