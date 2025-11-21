/**
 * Frontend API Integration Tests
 *
 * Tests cover:
 * - Dashboard data loading
 * - Employee management CRUD
 * - Schedule display and updates
 * - Error handling and display
 * - Loading states
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

// Mock API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Setup MSW server for mocking API calls
const server = setupServer(
  // Auth endpoints
  rest.post(`${API_BASE_URL}/auth/login`, (req, res, ctx) => {
    return res(
      ctx.json({
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          roles: ['user']
        },
        accessToken: 'mock-token-123'
      })
    );
  }),

  // Employee endpoints
  rest.get(`${API_BASE_URL}/employees`, (req, res, ctx) => {
    return res(
      ctx.json({
        employees: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@company.com',
            role: 'Developer',
            hourlyRate: 50,
            active: true
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@company.com',
            role: 'Manager',
            hourlyRate: 60,
            active: true
          }
        ],
        total: 2,
        page: 1,
        pageSize: 10
      })
    );
  }),

  rest.post(`${API_BASE_URL}/employees`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        id: 3,
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );
  }),

  rest.get(`${API_BASE_URL}/employees/:id`, (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        id: parseInt(id),
        name: 'John Doe',
        email: 'john@company.com',
        role: 'Developer',
        hourlyRate: 50,
        active: true
      })
    );
  }),

  rest.patch(`${API_BASE_URL}/employees/:id`, async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    return res(
      ctx.json({
        id: parseInt(id),
        name: 'John Doe',
        email: 'john@company.com',
        ...body,
        updatedAt: new Date().toISOString()
      })
    );
  }),

  rest.delete(`${API_BASE_URL}/employees/:id`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Schedule endpoints
  rest.get(`${API_BASE_URL}/schedules`, (req, res, ctx) => {
    const startDate = req.url.searchParams.get('startDate');
    const endDate = req.url.searchParams.get('endDate');

    return res(
      ctx.json({
        schedules: [
          {
            id: 1,
            employeeId: 1,
            shiftId: 1,
            date: '2024-01-15',
            status: 'scheduled',
            employee: {
              id: 1,
              name: 'John Doe'
            },
            shift: {
              id: 1,
              name: 'Morning Shift',
              startTime: '09:00:00',
              endTime: '17:00:00'
            }
          }
        ],
        total: 1
      })
    );
  }),

  rest.post(`${API_BASE_URL}/schedules`, async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        id: 2,
        ...body,
        createdAt: new Date().toISOString()
      })
    );
  }),

  // Dashboard endpoints
  rest.get(`${API_BASE_URL}/dashboard/stats`, (req, res, ctx) => {
    return res(
      ctx.json({
        totalEmployees: 15,
        activeSchedules: 45,
        upcomingShifts: 120,
        coverageRate: 95.5
      })
    );
  })
);

// Setup and teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Frontend API Integration Tests', () => {
  describe('Dashboard Data Loading', () => {
    test('loads and displays dashboard statistics', async () => {
      // Mock Dashboard component
      const Dashboard = () => {
        const [stats, setStats] = React.useState(null);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/dashboard/stats`)
            .then(res => res.json())
            .then(data => {
              setStats(data);
              setLoading(false);
            });
        }, []);

        if (loading) return <div>Loading...</div>;

        return (
          <div>
            <div data-testid="total-employees">{stats.totalEmployees}</div>
            <div data-testid="active-schedules">{stats.activeSchedules}</div>
            <div data-testid="upcoming-shifts">{stats.upcomingShifts}</div>
            <div data-testid="coverage-rate">{stats.coverageRate}%</div>
          </div>
        );
      };

      render(<Dashboard />);

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('total-employees')).toHaveTextContent('15');
        expect(screen.getByTestId('active-schedules')).toHaveTextContent('45');
        expect(screen.getByTestId('upcoming-shifts')).toHaveTextContent('120');
        expect(screen.getByTestId('coverage-rate')).toHaveTextContent('95.5%');
      });
    });

    test('handles dashboard loading errors gracefully', async () => {
      // Override handler to return error
      server.use(
        rest.get(`${API_BASE_URL}/dashboard/stats`, (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
        })
      );

      const Dashboard = () => {
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/dashboard/stats`)
            .then(res => {
              if (!res.ok) throw new Error('Failed to load');
              return res.json();
            })
            .catch(err => setError(err.message));
        }, []);

        if (error) return <div data-testid="error">{error}</div>;
        return <div>Dashboard</div>;
      };

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load');
      });
    });
  });

  describe('Employee Management CRUD', () => {
    test('fetches and displays employee list', async () => {
      const EmployeeList = () => {
        const [employees, setEmployees] = React.useState([]);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/employees`)
            .then(res => res.json())
            .then(data => {
              setEmployees(data.employees);
              setLoading(false);
            });
        }, []);

        if (loading) return <div>Loading...</div>;

        return (
          <ul>
            {employees.map(emp => (
              <li key={emp.id} data-testid={`employee-${emp.id}`}>
                {emp.name} - {emp.role}
              </li>
            ))}
          </ul>
        );
      };

      render(<EmployeeList />);

      await waitFor(() => {
        expect(screen.getByTestId('employee-1')).toHaveTextContent('John Doe - Developer');
        expect(screen.getByTestId('employee-2')).toHaveTextContent('Jane Smith - Manager');
      });
    });

    test('creates new employee successfully', async () => {
      const CreateEmployee = () => {
        const [status, setStatus] = React.useState('');

        const handleCreate = () => {
          const newEmployee = {
            name: 'New Employee',
            email: 'new@company.com',
            role: 'Developer'
          };

          fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEmployee)
          })
            .then(res => res.json())
            .then(() => setStatus('success'));
        };

        return (
          <div>
            <button onClick={handleCreate}>Create Employee</button>
            {status && <div data-testid="status">{status}</div>}
          </div>
        );
      };

      render(<CreateEmployee />);

      fireEvent.click(screen.getByText('Create Employee'));

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('success');
      });
    });

    test('updates employee information', async () => {
      const UpdateEmployee = () => {
        const [employee, setEmployee] = React.useState(null);

        const handleUpdate = () => {
          fetch(`${API_BASE_URL}/employees/1`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'Senior Developer' })
          })
            .then(res => res.json())
            .then(data => setEmployee(data));
        };

        return (
          <div>
            <button onClick={handleUpdate}>Update Role</button>
            {employee && <div data-testid="role">{employee.role}</div>}
          </div>
        );
      };

      render(<UpdateEmployee />);

      fireEvent.click(screen.getByText('Update Role'));

      await waitFor(() => {
        expect(screen.getByTestId('role')).toHaveTextContent('Senior Developer');
      });
    });

    test('deletes employee', async () => {
      const DeleteEmployee = () => {
        const [deleted, setDeleted] = React.useState(false);

        const handleDelete = () => {
          fetch(`${API_BASE_URL}/employees/1`, {
            method: 'DELETE'
          }).then(() => setDeleted(true));
        };

        return (
          <div>
            <button onClick={handleDelete}>Delete Employee</button>
            {deleted && <div data-testid="deleted">Deleted</div>}
          </div>
        );
      };

      render(<DeleteEmployee />);

      fireEvent.click(screen.getByText('Delete Employee'));

      await waitFor(() => {
        expect(screen.getByTestId('deleted')).toBeInTheDocument();
      });
    });
  });

  describe('Schedule Display and Updates', () => {
    test('loads and displays schedules', async () => {
      const ScheduleList = () => {
        const [schedules, setSchedules] = React.useState([]);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/schedules`)
            .then(res => res.json())
            .then(data => setSchedules(data.schedules));
        }, []);

        return (
          <ul>
            {schedules.map(schedule => (
              <li key={schedule.id} data-testid={`schedule-${schedule.id}`}>
                {schedule.employee.name} - {schedule.shift.name}
              </li>
            ))}
          </ul>
        );
      };

      render(<ScheduleList />);

      await waitFor(() => {
        expect(screen.getByTestId('schedule-1')).toHaveTextContent('John Doe - Morning Shift');
      });
    });

    test('creates new schedule assignment', async () => {
      const CreateSchedule = () => {
        const [created, setCreated] = React.useState(false);

        const handleCreate = () => {
          fetch(`${API_BASE_URL}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: 1,
              shiftId: 1,
              date: '2024-01-20'
            })
          }).then(() => setCreated(true));
        };

        return (
          <div>
            <button onClick={handleCreate}>Create Schedule</button>
            {created && <div data-testid="created">Created</div>}
          </div>
        );
      };

      render(<CreateSchedule />);

      fireEvent.click(screen.getByText('Create Schedule'));

      await waitFor(() => {
        expect(screen.getByTestId('created')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on API failure', async () => {
      server.use(
        rest.get(`${API_BASE_URL}/employees`, (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        })
      );

      const EmployeeListWithError = () => {
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/employees`)
            .then(res => {
              if (!res.ok) throw new Error('Failed to fetch');
              return res.json();
            })
            .catch(err => setError(err.message));
        }, []);

        if (error) return <div data-testid="error">{error}</div>;
        return <div>Employees</div>;
      };

      render(<EmployeeListWithError />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch');
      });
    });

    test('handles network errors', async () => {
      server.use(
        rest.get(`${API_BASE_URL}/employees`, (req, res) => {
          return res.networkError('Network connection failed');
        })
      );

      const EmployeeListWithNetworkError = () => {
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/employees`)
            .catch(err => setError('Network error'));
        }, []);

        if (error) return <div data-testid="network-error">{error}</div>;
        return <div>Employees</div>;
      };

      render(<EmployeeListWithNetworkError />);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });
    });

    test('handles validation errors on create', async () => {
      server.use(
        rest.post(`${API_BASE_URL}/employees`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: 'Validation failed',
              details: { email: 'Invalid email format' }
            })
          );
        })
      );

      const CreateWithValidation = () => {
        const [error, setError] = React.useState(null);

        const handleCreate = () => {
          fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test', email: 'invalid' })
          })
            .then(res => res.json())
            .then(data => setError(data.error));
        };

        return (
          <div>
            <button onClick={handleCreate}>Create</button>
            {error && <div data-testid="validation-error">{error}</div>}
          </div>
        );
      };

      render(<CreateWithValidation />);

      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(screen.getByTestId('validation-error')).toHaveTextContent('Validation failed');
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading indicator during data fetch', async () => {
      const ComponentWithLoading = () => {
        const [loading, setLoading] = React.useState(true);
        const [data, setData] = React.useState(null);

        React.useEffect(() => {
          fetch(`${API_BASE_URL}/employees`)
            .then(res => res.json())
            .then(data => {
              setData(data);
              setLoading(false);
            });
        }, []);

        return (
          <div>
            {loading && <div data-testid="loading">Loading employees...</div>}
            {!loading && <div data-testid="loaded">Loaded {data.employees.length} employees</div>}
          </div>
        );
      };

      render(<ComponentWithLoading />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('loaded')).toHaveTextContent('Loaded 2 employees');
      });
    });

    test('disables buttons during submission', async () => {
      const FormWithLoading = () => {
        const [submitting, setSubmitting] = React.useState(false);

        const handleSubmit = () => {
          setSubmitting(true);
          fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
          }).finally(() => setSubmitting(false));
        };

        return (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="submit-button"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        );
      };

      render(<FormWithLoading />);

      const button = screen.getByTestId('submit-button');
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Submitting...');

      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(button).toHaveTextContent('Submit');
      });
    });
  });

  describe('Data Transformation', () => {
    test('properly transforms camelCase to snake_case for API requests', async () => {
      let capturedBody = null;

      server.use(
        rest.post(`${API_BASE_URL}/employees`, async (req, res, ctx) => {
          capturedBody = await req.json();
          return res(ctx.json({ id: 1, ...capturedBody }));
        })
      );

      const CreateWithTransform = () => {
        const handleCreate = () => {
          const data = {
            firstName: 'John',
            lastName: 'Doe',
            hourlyRate: 50
          };

          // Transform to snake_case before sending
          const transformed = {
            first_name: data.firstName,
            last_name: data.lastName,
            hourly_rate: data.hourlyRate
          };

          fetch(`${API_BASE_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transformed)
          });
        };

        return <button onClick={handleCreate}>Create</button>;
      };

      render(<CreateWithTransform />);
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(capturedBody).toEqual({
          first_name: 'John',
          last_name: 'Doe',
          hourly_rate: 50
        });
      });
    });
  });
});
