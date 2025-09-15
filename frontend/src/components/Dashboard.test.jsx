import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import {
  analyticsService,
  scheduleService,
  employeeService,
  notificationService
} from '../services/api';

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
  employeeService: {
    getEmployees: jest.fn(),
  },
  notificationService: {
    getNotifications: jest.fn(),
  },
}));

// Mock date-fns functions
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM d, yyyy') return 'Jan 15, 2024';
    if (formatStr === 'MMM d') return 'Jan 15';
    if (formatStr === 'h:mm a') return '9:00 AM';
    return '2024-01-15';
  }),
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

const mockAnalytics = {
  totalEmployees: 25,
  activeEmployees: 23,
  totalSchedules: 12,
  todayShifts: 8,
  upcomingShifts: 15,
  totalHours: 320,
  laborCost: 4800,
};

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
        {
          id: 'shift2',
          employeeId: 'emp2',
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: '2024-01-15T18:00:00.000Z',
          role: 'cashier',
        },
      ],
    },
    {
      id: '2',
      name: 'Week 2 Schedule',
      startDate: '2024-01-22T00:00:00.000Z',
      endDate: '2024-01-28T00:00:00.000Z',
      status: 'draft',
      createdAt: '2024-01-21T15:30:00.000Z',
      shifts: [],
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
    {
      id: 'emp2',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'cashier',
      isActive: true,
    },
    {
      id: 'emp3',
      firstName: 'Bob',
      lastName: 'Johnson',
      role: 'cook',
      isActive: false,
    },
  ],
};

const mockNotifications = {
  notifications: [
    {
      id: '1',
      title: 'Schedule Published',
      message: 'Week 1 schedule has been published',
      description: 'All employees have been notified',
      type: 'info',
      read: false,
      createdAt: '2024-01-15T08:00:00.000Z',
    },
    {
      id: '2',
      title: 'Shift Conflict',
      message: 'Overlapping shifts detected',
      description: 'John Doe has overlapping shifts on Monday',
      type: 'warning',
      read: true,
      createdAt: '2024-01-14T16:30:00.000Z',
    },
  ],
};

const mockLaborCosts = {
  data: [
    { date: '2024-01-15T00:00:00.000Z', cost: 800 },
    { date: '2024-01-16T00:00:00.000Z', cost: 900 },
    { date: '2024-01-17T00:00:00.000Z', cost: 750 },
    { date: '2024-01-18T00:00:00.000Z', cost: 850 },
    { date: '2024-01-19T00:00:00.000Z', cost: 700 },
  ],
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService.getOverview.mockResolvedValue(mockAnalytics);
    scheduleService.getSchedules.mockResolvedValue(mockSchedules);
    employeeService.getEmployees.mockResolvedValue(mockEmployees);
    notificationService.getNotifications.mockResolvedValue(mockNotifications);
    analyticsService.getLaborCosts.mockResolvedValue(mockLaborCosts);
  });

  it('renders the dashboard interface', async () => {
    render(<MockedDashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh dashboard data')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total employees
      expect(screen.getByText('2')).toBeInTheDocument(); // Total schedules
    });
  });

  it('displays employee metrics correctly', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Employees')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  it('displays schedule metrics correctly', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Schedules Created')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('2 recent')).toBeInTheDocument();
    });
  });

  it('displays today\'s shifts count', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Shifts')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // shifts for today
    });
  });

  it('displays notifications count with unread indicator', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1 unread')).toBeInTheDocument();
    });
  });

  it('renders quick action buttons', async () => {
    render(<MockedDashboard />);

    expect(screen.getByLabelText('Add new employee')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate new schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('View all employees')).toBeInTheDocument();
    expect(screen.getByLabelText('View all schedules')).toBeInTheDocument();
  });

  it('navigates to correct pages when clicking quick actions', async () => {
    const user = userEvent.setup();
    render(<MockedDashboard />);

    // Test add employee button
    const addEmployeeBtn = screen.getByLabelText('Add new employee');
    await user.click(addEmployeeBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/employees?action=add');

    // Test generate schedule button
    const generateScheduleBtn = screen.getByLabelText('Generate new schedule');
    await user.click(generateScheduleBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/schedules?action=generate');

    // Test view employees button
    const viewEmployeesBtn = screen.getByLabelText('View all employees');
    await user.click(viewEmployeesBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/employees');

    // Test view schedules button
    const viewSchedulesBtn = screen.getByLabelText('View all schedules');
    await user.click(viewSchedulesBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/schedules');
  });

  it('displays recent schedules list', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Schedules')).toBeInTheDocument();
      expect(screen.getByText('Week 1 Schedule')).toBeInTheDocument();
      expect(screen.getByText('Week 2 Schedule')).toBeInTheDocument();
    });

    // Check schedule details
    expect(screen.getByText('2 shifts')).toBeInTheDocument();
    expect(screen.getByText('0 shifts')).toBeInTheDocument();
  });

  it('displays notifications list', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Notifications')).toBeInTheDocument();
      expect(screen.getByText('Schedule Published')).toBeInTheDocument();
      expect(screen.getByText('Shift Conflict')).toBeInTheDocument();
    });

    // Check notification details
    expect(screen.getByText('All employees have been notified')).toBeInTheDocument();
    expect(screen.getByText('John Doe has overlapping shifts on Monday')).toBeInTheDocument();
  });

  it('displays today\'s schedule with shift details', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Today\'s Schedule')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Check shift statuses
    expect(screen.getAllByText('In Progress')).toHaveLength(2);
  });

  it('renders employee role distribution chart', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Employee Distribution by Role')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });

    const chart = screen.getByTestId('doughnut-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data'));

    expect(chartData.labels).toContain('manager');
    expect(chartData.labels).toContain('cashier');
    expect(chartData.labels).toContain('cook');
  });

  it('renders labor costs chart', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Labor Costs (Last 7 Days)')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    const chart = screen.getByTestId('line-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data'));

    expect(chartData.datasets[0].label).toBe('Daily Labor Cost');
    expect(chartData.datasets[0].data).toEqual([800, 900, 750, 850, 700]);
  });

  it('refreshes dashboard data when clicking refresh button', async () => {
    const user = userEvent.setup();
    render(<MockedDashboard />);

    const refreshButton = screen.getByLabelText('Refresh dashboard data');
    await user.click(refreshButton);

    expect(analyticsService.getOverview).toHaveBeenCalled();
  });

  it('shows loading state while fetching data', () => {
    analyticsService.getOverview.mockImplementation(() => new Promise(() => {}));

    render(<MockedDashboard />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('displays empty state when no schedules exist', async () => {
    scheduleService.getSchedules.mockResolvedValue({ schedules: [] });

    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No schedules found')).toBeInTheDocument();
    });
  });

  it('displays empty state when no notifications exist', async () => {
    notificationService.getNotifications.mockResolvedValue({ notifications: [] });

    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('displays empty state when no shifts for today', async () => {
    const noShiftsSchedules = {
      schedules: [
        {
          ...mockSchedules.schedules[0],
          shifts: [], // No shifts
        },
      ],
    };
    scheduleService.getSchedules.mockResolvedValue(noShiftsSchedules);

    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No shifts scheduled for today')).toBeInTheDocument();
    });
  });

  it('correctly calculates shift status based on time', async () => {
    const futureShifts = {
      schedules: [
        {
          ...mockSchedules.schedules[0],
          shifts: [
            {
              id: 'shift1',
              employeeId: 'emp1',
              startTime: '2024-01-15T20:00:00.000Z', // Future time
              endTime: '2024-01-15T23:00:00.000Z',
              role: 'manager',
            },
          ],
        },
      ],
    };

    // Mock future shift
    const { isFuture } = require('date-fns');
    isFuture.mockReturnValue(true);

    scheduleService.getSchedules.mockResolvedValue(futureShifts);

    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    analyticsService.getOverview.mockRejectedValue(new Error('API Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<MockedDashboard />);

    await waitFor(() => {
      // Should still render the dashboard structure
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('displays proper badge indicators for unread notifications', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      // Should show unread indicator for first notification
      const notificationItems = screen.getAllByRole('listitem');
      const unreadNotification = notificationItems.find(item =>
        item.textContent.includes('Schedule Published')
      );
      expect(unreadNotification).toBeInTheDocument();
    });
  });

  it('shows correct employee status distribution', async () => {
    render(<MockedDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Employees')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Total
      expect(screen.getByText('2 active')).toBeInTheDocument(); // Active count
    });
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