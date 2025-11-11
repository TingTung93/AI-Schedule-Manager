import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

// Mock the router
const MockedDashboard = () => (
  <BrowserRouter>
    <Dashboard />
  </BrowserRouter>
);

// Mock Chart.js
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn(),
  },
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  Title: {},
}));

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Doughnut: ({ data, options }) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} />
  ),
  Line: ({ data, options }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} />
  ),
}));

// Mock the API services
jest.mock('../services/api', () => ({
  analyticsService: {
    getOverview: jest.fn(),
    getLaborCosts: jest.fn(),
  },
  scheduleService: {
    getSchedules: jest.fn(),
  },
  notificationService: {
    getNotifications: jest.fn(),
  },
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => error.message || 'An error occurred'),
}));

// Mock date-fns functions
jest.mock('date-fns', () => ({
  format: jest.fn(() => 'Jan 15, 2024'),
  startOfWeek: jest.fn(() => new Date('2024-01-15')),
  addDays: jest.fn((date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)),
  parseISO: jest.fn((str) => new Date(str)),
  isToday: jest.fn(() => true),
  isFuture: jest.fn(() => false),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useApi and useRealTimeApi hooks
jest.mock('../hooks/useApi', () => ({
  useApi: jest.fn((apiCall, deps, options) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      apiCall()
        .then((result) => {
          setData(result);
          setLoading(false);
          if (options?.onSuccess) options.onSuccess(result);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
          if (options?.onError) options.onError(err);
        });
    }, []);

    return {
      data,
      loading,
      error,
      refetch: jest.fn(),
    };
  }),
  useRealTimeApi: jest.fn((apiCall, interval, options) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      apiCall()
        .then((result) => {
          setData(result);
          setLoading(false);
          if (options?.onUpdate) options.onUpdate(result);
        })
        .catch((err) => {
          setLoading(false);
          if (options?.onError) options.onError(err);
        });
    }, []);

    return {
      data,
      loading,
      error: null,
      isPolling: true,
      startPolling: jest.fn(),
      stopPolling: jest.fn(),
      refetch: jest.fn(),
    };
  }),
}));

const mockSchedules = {
  schedules: [
    {
      id: '1',
      name: 'Week 1 Schedule',
      startDate: '2024-01-15T00:00:00.000Z',
      endDate: '2024-01-21T00:00:00.000Z',
      status: 'published',
      createdAt: '2024-01-14T10:00:00.000Z',
      shifts: [
        {
          id: 'shift1',
          employeeId: 'emp1',
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T17:00:00.000Z',
          role: 'manager',
        },
      ],
    },
  ],
};

const mockEmployees = {
  employees: [
    {
      id: 'emp1',
      firstName: 'John',
      lastName: 'Doe',
      role: 'manager',
      isActive: true,
    },
  ],
};

const mockNotifications = {
  notifications: [
    {
      id: '1',
      title: 'Schedule Published',
      message: 'Week 1 schedule has been published',
      type: 'info',
      read: false,
      createdAt: '2024-01-15T08:00:00.000Z',
    },
  ],
};

describe('Dashboard', () => {
  const {
    analyticsService,
    scheduleService,
    notificationService,
    default: api
  } = require('../services/api');

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService.getOverview.mockResolvedValue({});
    scheduleService.getSchedules.mockResolvedValue(mockSchedules);
    api.get.mockResolvedValue({ data: mockEmployees });
    notificationService.getNotifications.mockResolvedValue(mockNotifications);
    analyticsService.getLaborCosts.mockResolvedValue({ data: [] });
  });

  it('renders the dashboard interface', async () => {
    render(<MockedDashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh dashboard data')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Total employees
    });
  });

  it('renders quick action buttons', async () => {
    render(<MockedDashboard />);

    expect(screen.getByLabelText('Add new employee')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate new schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('View all employees')).toBeInTheDocument();
    expect(screen.getByLabelText('View all schedules')).toBeInTheDocument();
  });

  it('shows loading state while fetching data', () => {
    analyticsService.getOverview.mockImplementation(() => new Promise(() => {}));

    render(<MockedDashboard />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('has proper accessibility attributes', async () => {
    render(<MockedDashboard />);

    // Check for proper ARIA labels on buttons
    expect(screen.getByLabelText('Refresh dashboard data')).toBeInTheDocument();
    expect(screen.getByLabelText('Add new employee')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate new schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('View all employees')).toBeInTheDocument();
    expect(screen.getByLabelText('View all schedules')).toBeInTheDocument();
  });
});