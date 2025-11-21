/**
 * E2E Test Setup and Utilities
 *
 * This file provides common setup, mock configurations, and utilities
 * for end-to-end testing of the AI Schedule Manager.
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

/**
 * Mock Server Configuration
 * Sets up MSW server with default handlers for all API endpoints
 */
export const createMockServer = (customHandlers = []) => {
  const defaultHandlers = [
    // Departments
    rest.get('/api/departments', (req, res, ctx) => {
      return res(ctx.json([
        { id: 1, name: 'Kitchen', description: 'Kitchen staff', active: true },
        { id: 2, name: 'Service', description: 'Service staff', active: true },
        { id: 3, name: 'Bar', description: 'Bar staff', active: true },
        { id: 4, name: 'Management', description: 'Management', active: true }
      ]));
    }),

    // Employees
    rest.get('/api/employees', (req, res, ctx) => {
      return res(ctx.json([
        { id: 1, name: 'John Doe', email: 'john@example.com', department_id: 1, role: 'chef', active: true },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', department_id: 1, role: 'cook', active: true },
        { id: 3, name: 'Bob Wilson', email: 'bob@example.com', department_id: 2, role: 'server', active: true },
        { id: 4, name: 'Alice Brown', email: 'alice@example.com', department_id: 2, role: 'server', active: true },
        { id: 5, name: 'Charlie Davis', email: 'charlie@example.com', department_id: 3, role: 'bartender', active: true }
      ]));
    }),

    // Shift Templates
    rest.get('/api/shift-templates', (req, res, ctx) => {
      return res(ctx.json([
        { id: 1, name: 'Morning Shift', start_time: '08:00', end_time: '16:00', department_id: 1 },
        { id: 2, name: 'Evening Shift', start_time: '16:00', end_time: '00:00', department_id: 1 },
        { id: 3, name: 'Day Service', start_time: '11:00', end_time: '19:00', department_id: 2 },
        { id: 4, name: 'Night Service', start_time: '17:00', end_time: '01:00', department_id: 2 },
        { id: 5, name: 'Bar Hours', start_time: '15:00', end_time: '23:00', department_id: 3 }
      ]));
    }),

    // Schedule Generation
    rest.post('/api/schedules/generate', (req, res, ctx) => {
      return res(ctx.json({
        schedule_id: 1,
        assignments: generateMockAssignments(),
        coverage: { total_shifts: 14, assigned: 12, coverage_percentage: 85.7 },
        conflicts: [],
        warnings: []
      }));
    }),

    // Schedule Publish
    rest.post('/api/schedules/:id/publish', (req, res, ctx) => {
      return res(ctx.json({
        success: true,
        message: 'Schedule published successfully',
        schedule_id: req.params.id
      }));
    }),

    // Schedule CRUD
    rest.get('/api/schedules', (req, res, ctx) => {
      return res(ctx.json([
        { id: 1, name: 'Week of Jan 20-26', status: 'published', start_date: '2025-01-20', end_date: '2025-01-26' },
        { id: 2, name: 'Week of Jan 27-Feb 2', status: 'draft', start_date: '2025-01-27', end_date: '2025-02-02' }
      ]));
    }),

    rest.get('/api/schedules/:id', (req, res, ctx) => {
      return res(ctx.json({
        id: req.params.id,
        name: 'Week of Jan 20-26',
        status: 'published',
        start_date: '2025-01-20',
        end_date: '2025-01-26',
        assignments: generateMockAssignments()
      }));
    }),

    // Import/Export
    rest.post('/api/schedules/import', (req, res, ctx) => {
      return res(ctx.json({
        success: true,
        imported_count: 15,
        errors: [],
        warnings: ['Employee "Unknown User" not found']
      }));
    }),

    rest.get('/api/schedules/:id/export', (req, res, ctx) => {
      const format = req.url.searchParams.get('format') || 'csv';
      return res(
        ctx.set('Content-Type', `application/${format}`),
        ctx.set('Content-Disposition', `attachment; filename=schedule.${format}`),
        ctx.text('mock,csv,data')
      );
    })
  ];

  return setupServer(...defaultHandlers, ...customHandlers);
};

/**
 * Test Data Factories
 */
export const testData = {
  createEmployee: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    name: 'Test Employee',
    email: 'test@example.com',
    department_id: 1,
    role: 'staff',
    active: true,
    ...overrides
  }),

  createDepartment: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    name: 'Test Department',
    description: 'Test Description',
    active: true,
    ...overrides
  }),

  createShiftTemplate: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    name: 'Test Shift',
    start_time: '09:00',
    end_time: '17:00',
    department_id: 1,
    ...overrides
  }),

  createSchedule: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    name: 'Test Schedule',
    status: 'draft',
    start_date: '2025-01-20',
    end_date: '2025-01-26',
    department_id: 1,
    ...overrides
  }),

  createAssignment: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000),
    employee_id: 1,
    shift_id: 1,
    date: '2025-01-20',
    status: 'assigned',
    ...overrides
  })
};

/**
 * Custom Render Function
 * Wraps components with necessary providers
 */
export const renderWithRouter = (ui, { route = '/', ...renderOptions } = {}) => {
  window.history.pushState({}, 'Test page', route);

  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    ...renderOptions
  });
};

/**
 * Cleanup Helpers
 */
export const cleanupTestEnvironment = () => {
  // Clear local storage
  localStorage.clear();

  // Clear session storage
  sessionStorage.clear();

  // Reset any global state
  window.history.replaceState({}, '', '/');
};

/**
 * Wait Utilities
 */
export const waitForLoadingToFinish = async (screen) => {
  const { queryByTestId, queryByText } = screen;

  // Wait for common loading indicators to disappear
  await new Promise(resolve => {
    const checkLoading = () => {
      const loadingSpinner = queryByTestId('loading-spinner');
      const loadingText = queryByText(/loading/i);

      if (!loadingSpinner && !loadingText) {
        resolve();
      } else {
        setTimeout(checkLoading, 100);
      }
    };
    checkLoading();
  });
};

/**
 * Mock Assignments Generator
 */
function generateMockAssignments() {
  const assignments = [];
  const dates = ['2025-01-20', '2025-01-21', '2025-01-22', '2025-01-23', '2025-01-24', '2025-01-25', '2025-01-26'];

  dates.forEach((date, dateIndex) => {
    // Morning shift
    assignments.push({
      id: dateIndex * 3 + 1,
      employee_id: (dateIndex % 2) + 1, // Alternate between employees 1 and 2
      shift_id: 1,
      date: date,
      status: 'assigned'
    });

    // Evening shift
    assignments.push({
      id: dateIndex * 3 + 2,
      employee_id: ((dateIndex + 1) % 2) + 1,
      shift_id: 2,
      date: date,
      status: 'assigned'
    });
  });

  return assignments;
}

/**
 * Mock File Upload Helper
 */
export const createMockFile = (name, size = 1024, type = 'text/csv') => {
  const content = 'mock,file,content\nrow1,data1,value1\nrow2,data2,value2';
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });

  Object.defineProperty(file, 'size', { value: size });

  return file;
};

/**
 * Accessibility Test Helpers
 */
export const testKeyboardNavigation = async (user, elements) => {
  for (const element of elements) {
    element.focus();
    expect(document.activeElement).toBe(element);
    await user.keyboard('{Tab}');
  }
};

/**
 * Network Simulation Helpers
 */
export const simulateNetworkDelay = (ms = 1000) => {
  return (req, res, ctx) => {
    return res(ctx.delay(ms));
  };
};

export const simulateNetworkError = (statusCode = 500, message = 'Internal Server Error') => {
  return (req, res, ctx) => {
    return res(
      ctx.status(statusCode),
      ctx.json({ error: message })
    );
  };
};
