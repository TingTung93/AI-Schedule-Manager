"""
Comprehensive tests for Dashboard component.
Tests widgets, analytics display, and user interactions.
"""

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';

import Dashboard from '../../components/Dashboard';
import { analyticsService, scheduleService } from '../../services/api';
import api from '../../services/api';

// Mock the API services
jest.mock('../../services/api', () => ({
  analyticsService: {
    getOverview: jest.fn(),
    getLaborCosts: jest.fn(),
    getOptimizationMetrics: jest.fn(),
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
}));

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }) => (
    <div data-testid="line-chart">
      Line Chart: {data.datasets[0].label}
    </div>
  ),
  Bar: ({ data, options }) => (
    <div data-testid="bar-chart">
      Bar Chart: {data.datasets[0].label}
    </div>
  ),
  Doughnut: ({ data, options }) => (
    <div data-testid="doughnut-chart">
      Doughnut Chart: {data.labels?.join(', ')}
    </div>
  ),
}));

// Test wrapper component
const TestWrapper = ({ children }) => {
  const theme = createTheme();
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Dashboard Component', () => {
  const mockAnalytics = {
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
  };

  const mockSchedules = [
    {
      id: 1,
      name: 'Current Week',
      status: 'published',
      start_date: '2024-01-15',
      end_date: '2024-01-21',
    },
    {
      id: 2,
      name: 'Next Week',
      status: 'draft',
      start_date: '2024-01-22',
      end_date: '2024-01-28',
    },
  ];

  const mockEmployees = [
    { id: 1, name: 'John Doe', role: 'Server', is_active: true },
    { id: 2, name: 'Jane Smith', role: 'Cook', is_active: true },
    { id: 3, name: 'Bob Wilson', role: 'Manager', is_active: false },
  ];

  const mockNotifications = {
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService.getOverview.mockResolvedValue(mockAnalytics);
    analyticsService.getLaborCosts.mockResolvedValue({
      current_week: 5200,
      last_week: 5400,
      trend: 'down',
      breakdown: mockAnalytics.cost_breakdown,
    });
    analyticsService.getOptimizationMetrics.mockResolvedValue(mockAnalytics.efficiency_metrics);
    scheduleService.getSchedules.mockResolvedValue({ schedules: mockSchedules });
    api.get.mockResolvedValue({ data: { employees: mockEmployees } });
  });

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    analyticsService.getOverview.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays analytics overview', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(analyticsService.getOverview).toHaveBeenCalled();
    });

    expect(screen.getByText('25')).toBeInTheDocument(); // total_employees
    expect(screen.getByText('15')).toBeInTheDocument(); // total_rules
    expect(screen.getByText('8')).toBeInTheDocument(); // total_schedules
    expect(screen.getByText('87')).toBeInTheDocument(); // optimization_score
  });

  it('displays key performance indicators (KPIs)', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/total employees/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/active schedules/i)).toBeInTheDocument();
    expect(screen.getByText(/avg hours\/week/i)).toBeInTheDocument();
    expect(screen.getByText(/optimization score/i)).toBeInTheDocument();
  });

  it('shows labor cost trends with charts', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    expect(screen.getByText(/labor costs/i)).toBeInTheDocument();
    expect(screen.getByText(/decreasing/i)).toBeInTheDocument();
  });

  it('displays schedule status overview', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/schedule overview/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Current Week')).toBeInTheDocument();
    expect(screen.getByText('Next Week')).toBeInTheDocument();
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows employee statistics', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/employee overview/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/active employees/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Active employees count
  });

  it('displays recent notifications', async () => {
    const { notificationService } = require('../../services/api');
    notificationService.getNotifications.mockResolvedValue(mockNotifications);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/recent notifications/i)).toBeInTheDocument();
    });

    expect(screen.getByText('New Schedule Published')).toBeInTheDocument();
    expect(screen.getByText('Shift Swap Request')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Unread count
  });

  it('allows refreshing dashboard data', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/refresh/i));

    await waitFor(() => {
      expect(analyticsService.getOverview).toHaveBeenCalledTimes(2);
    });
  });

  it('handles data loading errors gracefully', async () => {
    analyticsService.getOverview.mockRejectedValue(new Error('Failed to load analytics'));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });

  it('displays quick action buttons', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/create schedule/i)).toBeInTheDocument();
    expect(screen.getByText(/add employee/i)).toBeInTheDocument();
    expect(screen.getByText(/add rule/i)).toBeInTheDocument();
  });

  it('navigates to appropriate pages from quick actions', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/create schedule/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/create schedule/i));

    // Should navigate to schedule creation page
    // In a real test, you'd verify the navigation occurred
    expect(window.location.pathname).toBe('/schedules/create');
  });

  it('shows time-based greetings', () => {
    // Mock different times of day
    const mockDate = new Date('2024-01-15T09:30:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText(/good morning/i)).toBeInTheDocument();

    global.Date.mockRestore();
  });

  it('displays optimization suggestions', async () => {
    const mockSuggestions = {
      suggestions: [
        {
          type: 'cost_saving',
          title: 'Reduce overtime hours',
          description: 'Optimize shift assignments to reduce overtime by 15%',
          potential_savings: '$1,200',
        },
        {
          type: 'efficiency',
          title: 'Improve coverage',
          description: 'Add one more server during peak hours',
          impact: 'High',
        },
      ],
    };

    analyticsService.getOptimizationMetrics.mockResolvedValue(mockSuggestions);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/optimization suggestions/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Reduce overtime hours')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });

  it('shows upcoming shifts for current user', async () => {
    const mockUpcomingShifts = [
      {
        id: 1,
        date: '2024-01-16',
        start_time: '09:00',
        end_time: '17:00',
        position: 'Server',
      },
      {
        id: 2,
        date: '2024-01-17',
        start_time: '14:00',
        end_time: '22:00',
        position: 'Server',
      },
    ];

    scheduleService.getEmployeeSchedule = jest.fn().mockResolvedValue({
      shifts: mockUpcomingShifts,
    });

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/my upcoming shifts/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/jan 16/i)).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 17:00/i)).toBeInTheDocument();
  });

  it('displays weather information for outdoor businesses', async () => {
    const mockWeather = {
      current: {
        temperature: 22,
        condition: 'Sunny',
        humidity: 65,
      },
      forecast: [
        { date: '2024-01-16', high: 24, low: 18, condition: 'Partly Cloudy' },
        { date: '2024-01-17', high: 26, low: 20, condition: 'Sunny' },
      ],
    };

    // Mock weather service
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWeather,
    });

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/weather/i)).toBeInTheDocument();
    });

    expect(screen.getByText('22°')).toBeInTheDocument();
    expect(screen.getByText('Sunny')).toBeInTheDocument();
  });

  it('allows customizing dashboard layout', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/customize dashboard/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/customize dashboard/i));

    expect(screen.getByText(/dashboard settings/i)).toBeInTheDocument();
    expect(screen.getByText(/widget preferences/i)).toBeInTheDocument();
  });

  it('supports dark mode toggle', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/toggle dark mode/i)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(/toggle dark mode/i));

    // Check if dark mode class is applied
    expect(document.body.classList).toContain('dark-mode');
  });

  it('displays recent activity feed', async () => {
    const mockActivity = [
      {
        id: 1,
        type: 'schedule_created',
        message: 'New schedule created for Week of Jan 15-21',
        timestamp: '2024-01-14T15:30:00Z',
        user: 'Manager',
      },
      {
        id: 2,
        type: 'employee_added',
        message: 'New employee John Doe added',
        timestamp: '2024-01-14T14:00:00Z',
        user: 'HR Admin',
      },
    ];

    analyticsService.getRecentActivity = jest.fn().mockResolvedValue(mockActivity);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/new schedule created/i)).toBeInTheDocument();
    expect(screen.getByText(/new employee john doe added/i)).toBeInTheDocument();
  });

  it('shows system health status', async () => {
    const mockHealthStatus = {
      database: 'healthy',
      api: 'healthy',
      notifications: 'warning',
      overall: 'healthy',
    };

    analyticsService.getSystemHealth = jest.fn().mockResolvedValue(mockHealthStatus);

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/system status/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/database.*healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications.*warning/i)).toBeInTheDocument();
  });

  it('handles real-time data updates', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // Initial employee count
    });

    // Simulate real-time update (WebSocket or polling)
    const updatedAnalytics = { ...mockAnalytics, total_employees: 26 };
    analyticsService.getOverview.mockResolvedValue(updatedAnalytics);

    // Trigger update (in real app, this would come from WebSocket)
    fireEvent(window, new CustomEvent('analytics-update'));

    await waitFor(() => {
      expect(screen.getByText('26')).toBeInTheDocument();
    });
  });

  it('provides accessibility features', () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    // Check for ARIA labels and roles
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText(/dashboard overview/i)).toBeInTheDocument();

    // Check for screen reader announcements
    const announcements = screen.getByLabelText(/live announcements/i);
    expect(announcements).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/create schedule/i)).toBeInTheDocument();
    });

    // Tab through interactive elements
    await user.tab();
    expect(screen.getByText(/create schedule/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByText(/add employee/i)).toHaveFocus();

    // Enter should activate focused element
    await user.keyboard('{Enter}');
    // Should navigate to add employee page
  });

  it('handles offline state gracefully', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });

    analyticsService.getOverview.mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/limited functionality/i)).toBeInTheDocument();

    // Restore online state
    Object.defineProperty(navigator, 'onLine', {
      value: true,
    });
  });

  it('displays mobile-optimized layout on small screens', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    // Should show mobile layout
    expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-widgets')).toBeInTheDocument();
  });
});