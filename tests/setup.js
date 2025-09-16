/**
 * Test Setup Configuration
 * Global test setup and configuration for Jest
 */

import '@testing-library/jest-dom';
import { setupTests } from './test-utils';
import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Run setup
setupTests();

// Global test configuration
global.console = {
  ...console,
  // Uncomment to hide specific console methods in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock environment variables
process.env.REACT_APP_API_URL = 'http://localhost:8000';
process.env.NODE_ENV = 'test';

// Mock Chart.js
jest.mock('chart.js/auto', () => ({
  Chart: jest.fn(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    reset: jest.fn(),
  })),
  registerables: [],
}));

// Mock FullCalendar
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar(props) {
    return React.createElement('div', {
      'data-testid': 'calendar',
      onClick: () => props.eventClick?.({ event: { id: 'test-event' } }),
    }, 'Mock Calendar');
  };
});

// Mock date-fns for consistent date testing
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    const d = new Date(date);
    if (formatStr === 'yyyy-MM-dd') return d.toISOString().split('T')[0];
    if (formatStr === 'HH:mm') return d.toTimeString().split(' ')[0].slice(0, 5);
    return d.toLocaleString();
  }),
  parseISO: jest.fn((dateStr) => new Date(dateStr)),
  isValid: jest.fn((date) => !isNaN(new Date(date).getTime())),
  addDays: jest.fn((date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
  differenceInDays: jest.fn((dateLeft, dateRight) => {
    const left = new Date(dateLeft);
    const right = new Date(dateRight);
    return Math.floor((left - right) / (1000 * 60 * 60 * 24));
  }),
}));

// Mock Material-UI components that might cause issues in tests
jest.mock('@mui/x-date-pickers/DatePicker', () => {
  return function MockDatePicker(props) {
    return React.createElement('input', {
      'data-testid': 'date-picker',
      type: 'date',
      value: props.value || '',
      onChange: (e) => props.onChange?.(e.target.value),
    });
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
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
}));

// Mock Web APIs that might not be available in test environment
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  },
});

// Mock notification API
global.Notification = {
  requestPermission: jest.fn(() => Promise.resolve('granted')),
  permission: 'granted',
};

// Mock file reader
global.FileReader = class FileReader {
  constructor() {
    this.result = '';
    this.onload = null;
    this.onerror = null;
  }

  readAsText(file) {
    setTimeout(() => {
      this.result = 'mock file content';
      this.onload?.({ target: this });
    }, 0);
  }

  readAsDataURL(file) {
    setTimeout(() => {
      this.result = 'data:text/plain;base64,bW9jayBmaWxlIGNvbnRlbnQ=';
      this.onload?.({ target: this });
    }, 0);
  }
};

// Mock crypto.subtle for security testing
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(16))),
      decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(16))),
      generateKey: jest.fn(() => Promise.resolve({})),
    },
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now() + 1000,
    },
  },
});

// Setup global error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for async operations in tests
jest.setTimeout(10000);

// Clean up after all tests
afterAll(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});