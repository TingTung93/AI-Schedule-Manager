/**
 * Error Scenarios E2E Tests
 *
 * Tests error handling, network failures, offline mode, retry mechanisms,
 * and user feedback for various error conditions.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { createMockServer, renderWithRouter, cleanupTestEnvironment, simulateNetworkDelay, simulateNetworkError } from '../setup/e2eSetup';

// Mock main app component
const MockApp = () => <div data-testid="app">App Mock</div>;
const App = MockApp;

const server = createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanupTestEnvironment();
});
afterAll(() => server.close());

describe('Error Scenarios E2E Tests', () => {
  test('handles network timeout errors with retry', async () => {
    const user = userEvent.setup();

    let requestCount = 0;

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        requestCount++;

        // Fail first two attempts, succeed on third
        if (requestCount < 3) {
          return res(ctx.delay(10000)); // Simulate timeout
        }

        return res(ctx.json([
          { id: 1, name: 'Test Schedule', status: 'published' }
        ]));
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Timeout error should appear
    await waitFor(() => {
      expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
    }, { timeout: 15000 });

    // Retry button should be available
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await user.click(retryButton);

    // Should show retrying indicator
    expect(screen.getByText(/retrying/i)).toBeInTheDocument();

    // After retry, should still timeout
    await waitFor(() => {
      expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
    }, { timeout: 15000 });

    // Retry again
    await user.click(screen.getByRole('button', { name: /retry/i }));

    // Third attempt should succeed
    await waitFor(() => {
      expect(screen.getByText('Test Schedule')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Error message should be cleared
    expect(screen.queryByText(/request timed out/i)).not.toBeInTheDocument();
  });

  test('handles 404 not found errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules/:id', (req, res, ctx) => {
        return res(
          ctx.status(404),
          ctx.json({ error: 'Schedule not found' })
        );
      })
    );

    renderWithRouter(<App />, { route: '/schedules/999' });

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // 404 error message should appear
    await waitFor(() => {
      expect(screen.getByText(/schedule not found/i)).toBeInTheDocument();
    });

    // Should show helpful message
    expect(screen.getByText(/the schedule you're looking for does not exist/i)).toBeInTheDocument();

    // Should offer navigation options
    expect(screen.getByRole('link', { name: /back to schedules/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create new schedule/i })).toBeInTheDocument();
  });

  test('handles 500 internal server errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/generate', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Internal server error', message: 'An unexpected error occurred' })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Trigger action that causes 500 error
    const generateButton = screen.getByRole('button', { name: /generate schedule/i });
    await user.click(generateButton);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();

    // Should show error code
    expect(screen.getByText(/error code: 500/i)).toBeInTheDocument();

    // Should offer retry
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Should offer support contact
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
  });

  test('handles 401 unauthorized errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({ error: 'Unauthorized', message: 'Authentication required' })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Should redirect to login or show auth error
    await waitFor(() => {
      expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
    });

    // Should show login button
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();

    // Should clear any sensitive data
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  test('handles 403 forbidden errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.delete('/api/schedules/:id', (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({ error: 'Forbidden', message: 'You do not have permission to delete this schedule' })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Try to delete schedule
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));

    // Permission error should appear
    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/you do not have permission to delete this schedule/i)).toBeInTheDocument();

    // Schedule should still exist
    expect(screen.getByText('Test Schedule')).toBeInTheDocument();
  });

  test('handles offline mode gracefully', async () => {
    const user = userEvent.setup();

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Simulate going offline
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false
    });

    window.dispatchEvent(new Event('offline'));

    // Offline indicator should appear
    await waitFor(() => {
      expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/changes will be saved locally/i)).toBeInTheDocument();

    // Try to perform action while offline
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should queue action for later
    await waitFor(() => {
      expect(screen.getByText(/saved locally/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/will sync when back online/i)).toBeInTheDocument();

    // Simulate coming back online
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true
    });

    window.dispatchEvent(new Event('online'));

    // Online indicator should appear
    await waitFor(() => {
      expect(screen.getByText(/back online/i)).toBeInTheDocument();
    });

    // Should sync queued changes
    expect(screen.getByText(/syncing changes/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/all changes synced/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('implements exponential backoff retry mechanism', async () => {
    const user = userEvent.setup();

    const requestTimes = [];

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        requestTimes.push(Date.now());

        // Fail first 3 requests
        if (requestTimes.length < 4) {
          return res(
            ctx.status(503),
            ctx.json({ error: 'Service unavailable' })
          );
        }

        return res(ctx.json([{ id: 1, name: 'Test Schedule' }]));
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Initial request fails
    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
    });

    // Auto-retry should be in progress
    expect(screen.getByText(/retrying automatically/i)).toBeInTheDocument();

    // Wait for all retries to complete
    await waitFor(() => {
      expect(screen.getByText('Test Schedule')).toBeInTheDocument();
    }, { timeout: 15000 });

    // Verify exponential backoff (1s, 2s, 4s delays)
    expect(requestTimes).toHaveLength(4);

    const delay1 = requestTimes[1] - requestTimes[0];
    const delay2 = requestTimes[2] - requestTimes[1];
    const delay3 = requestTimes[3] - requestTimes[2];

    // Allow 500ms tolerance
    expect(delay1).toBeGreaterThanOrEqual(500);
    expect(delay1).toBeLessThan(2000);

    expect(delay2).toBeGreaterThanOrEqual(1500);
    expect(delay2).toBeLessThan(3000);

    expect(delay3).toBeGreaterThanOrEqual(3500);
    expect(delay3).toBeLessThan(5000);
  });

  test('displays user-friendly error messages', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'Validation error',
            message: 'Invalid schedule configuration',
            details: {
              start_date: ['Start date is required'],
              end_date: ['End date must be after start date'],
              employees: ['At least one employee must be selected']
            }
          })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Try to create schedule with invalid data
    const createButton = screen.getByRole('button', { name: /create schedule/i });
    await user.click(createButton);

    // User-friendly error summary
    await waitFor(() => {
      expect(screen.getByText(/please fix the following errors/i)).toBeInTheDocument();
    });

    // Individual field errors
    expect(screen.getByText(/start date is required/i)).toBeInTheDocument();
    expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument();
    expect(screen.getByText(/at least one employee must be selected/i)).toBeInTheDocument();

    // Errors should be highlighted near relevant fields
    const startDateField = screen.getByLabelText(/start date/i);
    expect(startDateField).toHaveClass('error');
  });

  test('handles concurrent request errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/generate', (req, res, ctx) => {
        return res(
          ctx.status(409),
          ctx.json({
            error: 'Conflict',
            message: 'Another schedule generation is in progress'
          })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Click generate multiple times quickly
    const generateButton = screen.getByRole('button', { name: /generate/i });
    await user.click(generateButton);
    await user.click(generateButton);
    await user.click(generateButton);

    // Should show conflict error
    await waitFor(() => {
      expect(screen.getByText(/another schedule generation is in progress/i)).toBeInTheDocument();
    });

    // Should disable button
    expect(generateButton).toBeDisabled();

    // Should show progress indicator
    expect(screen.getByText(/generation in progress/i)).toBeInTheDocument();
  });

  test('provides error recovery options', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Database connection failed' })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Error should appear
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    // Recovery options should be available
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report issue/i })).toBeInTheDocument();

    // Error details can be expanded
    const showDetailsButton = screen.getByRole('button', { name: /show details/i });
    await user.click(showDetailsButton);

    // Technical details should appear
    await waitFor(() => {
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/error code: 500/i)).toBeInTheDocument();
    expect(screen.getByText(/timestamp:/i)).toBeInTheDocument();
  });

  test('logs errors for debugging', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Test error' })
        );
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('API Error'),
      expect.objectContaining({
        status: 500,
        error: 'Test error'
      })
    );

    consoleSpy.mockRestore();
  });

  test('clears error messages after successful retry', async () => {
    const user = userEvent.setup();

    let requestCount = 0;

    server.use(
      rest.get('/api/schedules', (req, res, ctx) => {
        requestCount++;

        if (requestCount === 1) {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Temporary failure' })
          );
        }

        return res(ctx.json([{ id: 1, name: 'Test Schedule' }]));
      })
    );

    renderWithRouter(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('app')).toBeInTheDocument();
    });

    // Error appears
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    // Retry
    await user.click(screen.getByRole('button', { name: /retry/i }));

    // Success - error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Test Schedule')).toBeInTheDocument();

    // Success notification should appear briefly
    expect(screen.getByText(/loaded successfully/i)).toBeInTheDocument();

    // Success notification should auto-dismiss
    await waitFor(() => {
      expect(screen.queryByText(/loaded successfully/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
