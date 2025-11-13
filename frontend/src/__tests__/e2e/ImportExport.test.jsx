/**
 * Import/Export Workflow E2E Tests
 *
 * Tests file upload, import validation, import execution, and export
 * functionality for CSV, Excel, PDF, and iCal formats.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { createMockServer, renderWithRouter, cleanupTestEnvironment, createMockFile } from '../setup/e2eSetup';

// Mock import/export components
const MockImportExport = () => <div data-testid="import-export">Import/Export Mock</div>;
const ImportExport = MockImportExport;

const server = createMockServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanupTestEnvironment();
});
afterAll(() => server.close());

describe('Import/Export Workflow E2E Tests', () => {
  test('uploads and validates CSV file successfully', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        return res(ctx.json({
          valid: true,
          row_count: 15,
          preview: [
            { date: '2025-01-20', employee: 'John Doe', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' },
            { date: '2025-01-21', employee: 'Jane Smith', shift: 'Evening Shift', start_time: '16:00', end_time: '00:00' },
            { date: '2025-01-22', employee: 'John Doe', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' }
          ],
          errors: [],
          warnings: []
        }));
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    // Click import button
    const importButton = screen.getByRole('button', { name: /import/i });
    await user.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/import schedule/i)).toBeInTheDocument();
    });

    // Create and upload CSV file
    const csvFile = createMockFile('schedule.csv', 2048, 'text/csv');
    const fileInput = screen.getByLabelText(/choose file/i);

    await user.upload(fileInput, csvFile);

    // File should be selected
    expect(fileInput.files[0]).toBe(csvFile);
    expect(fileInput.files).toHaveLength(1);

    // Validation should start automatically
    await waitFor(() => {
      expect(screen.getByText(/validating/i)).toBeInTheDocument();
    });

    // Wait for validation results
    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Preview should be displayed
    expect(screen.getByText(/15 rows found/i)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Morning Shift')).toBeInTheDocument();

    // No errors should be shown
    expect(screen.queryByText(/errors found/i)).not.toBeInTheDocument();
  });

  test('uploads and validates Excel file successfully', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        return res(ctx.json({
          valid: true,
          row_count: 20,
          preview: [
            { date: '2025-01-20', employee: 'Alice Brown', shift: 'Day Service', start_time: '11:00', end_time: '19:00' }
          ],
          errors: [],
          warnings: []
        }));
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /import/i }));

    // Upload Excel file
    const excelFile = createMockFile('schedule.xlsx', 4096, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const fileInput = screen.getByLabelText(/choose file/i);

    await user.upload(fileInput, excelFile);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify Excel file processed
    expect(screen.getByText(/20 rows found/i)).toBeInTheDocument();
  });

  test('displays import preview with data table', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        return res(ctx.json({
          valid: true,
          row_count: 5,
          preview: [
            { date: '2025-01-20', employee: 'John Doe', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' },
            { date: '2025-01-21', employee: 'Jane Smith', shift: 'Evening Shift', start_time: '16:00', end_time: '00:00' },
            { date: '2025-01-22', employee: 'Bob Wilson', shift: 'Day Service', start_time: '11:00', end_time: '19:00' },
            { date: '2025-01-23', employee: 'Alice Brown', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' },
            { date: '2025-01-24', employee: 'Charlie Davis', shift: 'Bar Hours', start_time: '15:00', end_time: '23:00' }
          ],
          errors: [],
          warnings: []
        }));
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /import/i }));

    const csvFile = createMockFile('schedule.csv', 2048, 'text/csv');
    await user.upload(screen.getByLabelText(/choose file/i), csvFile);

    // Wait for preview table
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const table = screen.getByRole('table');

    // Verify table headers
    expect(within(table).getByText('Date')).toBeInTheDocument();
    expect(within(table).getByText('Employee')).toBeInTheDocument();
    expect(within(table).getByText('Shift')).toBeInTheDocument();
    expect(within(table).getByText('Start Time')).toBeInTheDocument();
    expect(within(table).getByText('End Time')).toBeInTheDocument();

    // Verify data rows
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(6); // 5 data rows + 1 header row

    // Verify specific data
    expect(within(table).getByText('2025-01-20')).toBeInTheDocument();
    expect(within(table).getByText('John Doe')).toBeInTheDocument();
    expect(within(table).getByText('Morning Shift')).toBeInTheDocument();
  });

  test('executes import after preview confirmation', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        return res(ctx.json({
          valid: true,
          row_count: 10,
          preview: [
            { date: '2025-01-20', employee: 'John Doe', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' }
          ],
          errors: [],
          warnings: []
        }));
      }),
      rest.post('/api/schedules/import', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          imported_count: 10,
          created_schedule_id: 123,
          errors: [],
          warnings: []
        }));
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /import/i }));

    const csvFile = createMockFile('schedule.csv', 2048, 'text/csv');
    await user.upload(screen.getByLabelText(/choose file/i), csvFile);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
    });

    // Click import button
    const executeImportButton = screen.getByRole('button', { name: /execute import/i });
    expect(executeImportButton).toBeEnabled();
    await user.click(executeImportButton);

    // Progress indicator should appear
    await waitFor(() => {
      expect(screen.getByText(/importing/i)).toBeInTheDocument();
    });

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText(/10 shifts imported/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule #123 created/i)).toBeInTheDocument();
  });

  test('handles import validation errors', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        return res(ctx.json({
          valid: false,
          row_count: 15,
          preview: [],
          errors: [
            { row: 3, field: 'employee', message: 'Employee "Unknown User" not found' },
            { row: 7, field: 'date', message: 'Invalid date format' },
            { row: 12, field: 'shift', message: 'Shift template does not exist' }
          ],
          warnings: [
            { row: 5, message: 'Employee has time off requested for this date' }
          ]
        }));
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /import/i }));

    const csvFile = createMockFile('schedule_with_errors.csv', 2048, 'text/csv');
    await user.upload(screen.getByLabelText(/choose file/i), csvFile);

    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText(/validation failed/i)).toBeInTheDocument();
    });

    // Errors should be displayed
    expect(screen.getByText(/3 errors found/i)).toBeInTheDocument();
    expect(screen.getByText(/row 3.*employee "unknown user" not found/i)).toBeInTheDocument();
    expect(screen.getByText(/row 7.*invalid date format/i)).toBeInTheDocument();
    expect(screen.getByText(/row 12.*shift template does not exist/i)).toBeInTheDocument();

    // Warnings should be displayed
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/row 5.*time off requested/i)).toBeInTheDocument();

    // Import button should be disabled
    expect(screen.getByRole('button', { name: /execute import/i })).toBeDisabled();

    // Option to download error report
    expect(screen.getByRole('button', { name: /download error report/i })).toBeInTheDocument();
  });

  test('exports schedule to CSV format', async () => {
    const user = userEvent.setup();

    const mockCsvData = 'Date,Employee,Shift,Start Time,End Time\n2025-01-20,John Doe,Morning Shift,08:00,16:00';

    server.use(
      rest.get('/api/schedules/:id/export', (req, res, ctx) => {
        const format = req.url.searchParams.get('format');
        return res(
          ctx.set('Content-Type', `application/${format}`),
          ctx.set('Content-Disposition', `attachment; filename=schedule.${format}`),
          ctx.text(mockCsvData)
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/export schedule/i)).toBeInTheDocument();
    });

    // Select CSV format
    const formatSelect = screen.getByLabelText(/format/i);
    await user.click(formatSelect);
    await user.click(screen.getByText('CSV'));

    // Click download button
    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    // Verify download initiated
    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });
  });

  test('exports schedule to Excel format', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules/:id/export', (req, res, ctx) => {
        return res(
          ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          ctx.set('Content-Disposition', 'attachment; filename=schedule.xlsx'),
          ctx.body(new ArrayBuffer(8))
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Select Excel format
    const formatSelect = screen.getByLabelText(/format/i);
    await user.click(formatSelect);
    await user.click(screen.getByText('Excel'));

    // Download
    await user.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });
  });

  test('exports schedule to PDF format', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules/:id/export', (req, res, ctx) => {
        return res(
          ctx.set('Content-Type', 'application/pdf'),
          ctx.set('Content-Disposition', 'attachment; filename=schedule.pdf'),
          ctx.body(new ArrayBuffer(8))
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Select PDF format
    const formatSelect = screen.getByLabelText(/format/i);
    await user.click(formatSelect);
    await user.click(screen.getByText('PDF'));

    // PDF should have additional options
    expect(screen.getByLabelText(/include summary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/landscape orientation/i)).toBeInTheDocument();

    // Toggle options
    await user.click(screen.getByLabelText(/include summary/i));
    await user.click(screen.getByLabelText(/landscape orientation/i));

    // Download
    await user.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });
  });

  test('exports schedule to iCal format', async () => {
    const user = userEvent.setup();

    const mockICalData = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nEND:VEVENT\nEND:VCALENDAR';

    server.use(
      rest.get('/api/schedules/:id/export', (req, res, ctx) => {
        return res(
          ctx.set('Content-Type', 'text/calendar'),
          ctx.set('Content-Disposition', 'attachment; filename=schedule.ics'),
          ctx.text(mockICalData)
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Select iCal format
    const formatSelect = screen.getByLabelText(/format/i);
    await user.click(formatSelect);
    await user.click(screen.getByText('iCal'));

    // iCal should have calendar app options
    expect(screen.getByText(/compatible with google calendar, apple calendar, outlook/i)).toBeInTheDocument();

    // Download
    await user.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });
  });

  test('applies filters before export', async () => {
    const user = userEvent.setup();

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /export/i }));

    // Apply filters
    const departmentFilter = screen.getByLabelText(/department/i);
    await user.click(departmentFilter);
    await user.click(screen.getByText('Kitchen'));

    const dateRangeStart = screen.getByLabelText(/start date/i);
    await user.type(dateRangeStart, '2025-01-20');

    const dateRangeEnd = screen.getByLabelText(/end date/i);
    await user.type(dateRangeEnd, '2025-01-26');

    // Verify filter summary
    expect(screen.getByText(/exporting kitchen shifts from jan 20 to jan 26/i)).toBeInTheDocument();

    // Select format and download
    await user.click(screen.getByLabelText(/format/i));
    await user.click(screen.getByText('CSV'));
    await user.click(screen.getByRole('button', { name: /download/i }));

    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });
  });

  test('verifies download completion', async () => {
    const user = userEvent.setup();

    server.use(
      rest.get('/api/schedules/:id/export', (req, res, ctx) => {
        return res(
          ctx.set('Content-Type', 'text/csv'),
          ctx.set('Content-Disposition', 'attachment; filename=schedule.csv'),
          ctx.text('mock,csv,data')
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /export/i }));

    await user.click(screen.getByLabelText(/format/i));
    await user.click(screen.getByText('CSV'));

    // Mock download
    const downloadButton = screen.getByRole('button', { name: /download/i });
    await user.click(downloadButton);

    // Wait for download started
    await waitFor(() => {
      expect(screen.getByText(/download started/i)).toBeInTheDocument();
    });

    // Verify success notification
    await waitFor(() => {
      expect(screen.getByText(/file downloaded successfully/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify file name displayed
    expect(screen.getByText(/schedule.csv/i)).toBeInTheDocument();
  });

  test('handles large file upload with progress indicator', async () => {
    const user = userEvent.setup();

    server.use(
      rest.post('/api/schedules/import/validate', (req, res, ctx) => {
        // Simulate slow upload
        return res(
          ctx.delay(3000),
          ctx.json({
            valid: true,
            row_count: 1000,
            preview: [],
            errors: [],
            warnings: []
          })
        );
      })
    );

    renderWithRouter(<ImportExport />);

    await waitFor(() => {
      expect(screen.getByTestId('import-export')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /import/i }));

    // Upload large file
    const largeFile = createMockFile('large_schedule.csv', 5 * 1024 * 1024, 'text/csv'); // 5MB
    await user.upload(screen.getByLabelText(/choose file/i), largeFile);

    // Progress bar should appear
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Progress percentage should be visible
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Progress bar should disappear
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
