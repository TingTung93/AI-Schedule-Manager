/**
 * Test Utilities and Fixtures
 * Shared utilities for consistent testing across the application
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create test theme
export const testTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Test wrapper component
export const AllTheProviders = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={testTheme}>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Custom render function
export const renderWithProviders = (ui, options = {}) => {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
};

// Mock data generators
export const mockEmployee = (overrides = {}) => ({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'Server',
  hourly_rate: 15.0,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const mockSchedule = (overrides = {}) => ({
  id: 1,
  name: 'Week Schedule',
  start_date: '2024-01-15',
  end_date: '2024-01-21',
  status: 'published',
  created_at: '2024-01-01T00:00:00Z',
  shifts: [
    mockShift({ id: 'shift-1' }),
    mockShift({ id: 'shift-2', date: '2024-01-16' }),
  ],
  ...overrides,
});

export const mockShift = (overrides = {}) => ({
  id: 'shift-1',
  date: '2024-01-15',
  start_time: '09:00',
  end_time: '17:00',
  position: 'Server',
  employees: ['John Doe'],
  required_employees: 1,
  status: 'scheduled',
  ...overrides,
});

export const mockRule = (overrides = {}) => ({
  id: 1,
  name: 'Availability Rule',
  rule_text: 'John cannot work past 5pm',
  rule_type: 'availability',
  employee_id: 1,
  priority: 5,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  constraints: [
    {
      type: 'time_restriction',
      parameters: {
        max_end_time: '17:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      },
    },
  ],
  ...overrides,
});

export const mockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  role: 'manager',
  name: 'Test User',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const mockAnalytics = (overrides = {}) => ({
  total_employees: 25,
  total_rules: 15,
  total_schedules: 8,
  avg_hours_per_week: 36,
  labor_cost_trend: 'decreasing',
  optimization_score: 87,
  weekly_hours: [32, 35, 38, 36, 34, 37, 36],
  cost_breakdown: {
    salaries: 15000,
    overtime: 2500,
    benefits: 3000,
  },
  efficiency_metrics: {
    schedule_accuracy: 94,
    employee_satisfaction: 82,
    cost_optimization: 78,
  },
  ...overrides,
});

export const mockNotifications = (overrides = {}) => ({
  notifications: [
    {
      id: 1,
      type: 'schedule',
      title: 'New Schedule Published',
      message: 'Your schedule for next week is ready',
      read: false,
      created_at: '2024-01-14T10:00:00Z',
    },
    {
      id: 2,
      type: 'request',
      title: 'Shift Swap Request',
      message: 'John wants to swap shifts with you',
      read: false,
      created_at: '2024-01-14T09:00:00Z',
    },
  ],
  unread_count: 2,
  ...overrides,
});

// Test helpers
export const createMockApiResponse = (data, status = 200) => ({
  status,
  data,
  headers: {},
  config: {},
  statusText: 'OK',
});

export const createMockApiError = (message = 'API Error', status = 500) => {
  const error = new Error(message);
  error.response = {
    status,
    data: { detail: message },
  };
  return error;
};

// Date utilities for testing
export const mockDate = (dateString) => {
  const originalDate = Date;
  const mockDate = new Date(dateString);

  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        return mockDate;
      }
      return new originalDate(...args);
    }

    static now() {
      return mockDate.getTime();
    }
  };

  return () => {
    global.Date = originalDate;
  };
};

// Local storage mock
export const mockLocalStorage = () => {
  const storage = {};

  return {
    getItem: jest.fn((key) => storage[key] || null),
    setItem: jest.fn((key, value) => {
      storage[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
    }),
    clear: jest.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
  };
};

// Window location mock
export const mockWindowLocation = () => {
  const location = new URL('http://localhost:3000');

  delete window.location;
  window.location = {
    ...location,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  };

  return window.location;
};

// Media query mock
export const mockMediaQuery = (matches = false) => {
  const mockMatchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia,
  });

  return mockMatchMedia;
};

// Intersection Observer mock
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });

  window.IntersectionObserver = mockIntersectionObserver;
  window.IntersectionObserverEntry = jest.fn();

  return mockIntersectionObserver;
};

// Resize Observer mock
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });

  window.ResizeObserver = mockResizeObserver;

  return mockResizeObserver;
};

// Performance mock
export const mockPerformance = () => {
  const mockPerformance = {
    now: jest.fn().mockReturnValue(1000),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn().mockReturnValue([]),
    getEntriesByType: jest.fn().mockReturnValue([]),
  };

  Object.defineProperty(window, 'performance', {
    writable: true,
    value: mockPerformance,
  });

  return mockPerformance;
};

// Canvas mock for chart testing
export const mockCanvas = () => {
  const mockContext = {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Array(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  };

  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext);

  return mockContext;
};

// Wait for utilities
export const waitForElementToBeRemoved = async (element, options = {}) => {
  const { timeout = 4000 } = options;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.contains(element)) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
};

// Custom matchers
export const customMatchers = {
  toBeValidEmail: (received) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  },

  toBeValidDate: (received) => {
    const date = new Date(received);
    const pass = !isNaN(date.getTime());

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid date`,
      pass,
    };
  },

  toBeValidTime: (received) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const pass = timeRegex.test(received);

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid time`,
      pass,
    };
  },

  toBeValidPhoneNumber: (received) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const pass = phoneRegex.test(received.replace(/[\s\-\(\)]/g, ''));

    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },
};

// Setup function for common test configuration
export const setupTests = () => {
  // Setup custom matchers
  expect.extend(customMatchers);

  // Mock global objects
  mockLocalStorage();
  mockWindowLocation();
  mockIntersectionObserver();
  mockResizeObserver();
  mockPerformance();
  mockCanvas();

  // Suppress console warnings in tests
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });
};

// Database test utilities (for backend tests)
export const createTestDatabase = async () => {
  // This would be implemented with actual test database setup
  // For now, return a mock
  return {
    query: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn(),
  };
};

export const seedTestData = async (db) => {
  // Seed test database with sample data
  const employees = [
    mockEmployee({ id: 1, name: 'John Doe' }),
    mockEmployee({ id: 2, name: 'Jane Smith', role: 'Cook' }),
    mockEmployee({ id: 3, name: 'Bob Wilson', role: 'Manager' }),
  ];

  const schedules = [
    mockSchedule({ id: 1 }),
    mockSchedule({ id: 2, name: 'Next Week Schedule' }),
  ];

  const rules = [
    mockRule({ id: 1 }),
    mockRule({ id: 2, rule_text: 'Jane prefers morning shifts' }),
  ];

  return {
    employees,
    schedules,
    rules,
  };
};

// API test utilities
export const createMockServer = () => {
  const handlers = new Map();

  return {
    get: (path, handler) => handlers.set(`GET ${path}`, handler),
    post: (path, handler) => handlers.set(`POST ${path}`, handler),
    put: (path, handler) => handlers.set(`PUT ${path}`, handler),
    patch: (path, handler) => handlers.set(`PATCH ${path}`, handler),
    delete: (path, handler) => handlers.set(`DELETE ${path}`, handler),
    handle: (method, path, body) => {
      const handler = handlers.get(`${method} ${path}`);
      return handler ? handler(body) : { status: 404 };
    },
  };
};

// Export all utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';