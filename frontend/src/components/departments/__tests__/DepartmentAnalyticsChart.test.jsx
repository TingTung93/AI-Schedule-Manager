import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentAnalyticsChart from '../DepartmentAnalyticsChart';
import api from '../../../services/api';

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Pie: () => <div data-testid="pie-chart">Pie Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}));

jest.mock('../../../services/api');

describe('DepartmentAnalyticsChart', () => {
  const mockAnalyticsData = {
    totalDepartments: 5,
    totalEmployees: 50,
    activeEmployees: 45,
    inactiveEmployees: 5,
    unassignedEmployees: 3,
  };

  const mockDistributionData = [
    { departmentName: 'Engineering', employeeCount: 20, capacity: 25 },
    { departmentName: 'Sales', employeeCount: 15, capacity: 20 },
    { departmentName: 'Marketing', employeeCount: 10, capacity: 15 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<DepartmentAnalyticsChart />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('fetches and displays analytics overview', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Total departments
      expect(screen.getByText('50')).toBeInTheDocument(); // Total employees
      expect(screen.getByText('45')).toBeInTheDocument(); // Active employees
      expect(screen.getByText('3')).toBeInTheDocument(); // Unassigned
    });
  });

  it('renders all chart types by default', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('handles error state with retry button', async () => {
    api.get.mockRejectedValue({
      response: { data: { detail: 'Failed to fetch analytics' } }
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch analytics/i)).toBeInTheDocument();
    });

    // Retry button should be visible
    const retryButton = screen.getByRole('button', { name: /refresh/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('refreshes data when refresh button clicked', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    // Clear previous calls
    jest.clearAllMocks();

    // Click refresh
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2); // Overview + distribution
    });
  });

  it('exports data to CSV', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn();
    const mockClick = jest.fn();
    global.document.createElement = jest.fn().mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    expect(mockClick).toHaveBeenCalled();
  });

  it('fetches department-specific analytics when departmentId provided', async () => {
    const mockDeptAnalytics = {
      ...mockAnalyticsData,
      departmentName: 'Engineering',
    };

    api.get.mockResolvedValue({ data: mockDeptAnalytics });

    render(<DepartmentAnalyticsChart departmentId={1} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/departments/1/analytics',
        expect.any(Object)
      );
    });
  });

  it('auto-refreshes on interval', async () => {
    jest.useFakeTimers();

    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<DepartmentAnalyticsChart refreshInterval={1000} />);

    await waitFor(() => {
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    // Clear initial calls
    jest.clearAllMocks();

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    jest.useRealTimers();
  });

  it('filters charts based on selected view', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('overview')) {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url.includes('distribution')) {
        return Promise.resolve({ data: mockDistributionData });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<DepartmentAnalyticsChart />);

    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    // Change view to distribution only
    // Note: This would require finding and interacting with the Select component
    // This is a simplified test - full implementation would need proper selector
  });
});
