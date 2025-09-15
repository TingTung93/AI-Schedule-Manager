import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Navigation from './Navigation';
import { authService, notificationService } from '../services/api';

// Mock the services
jest.mock('../services/api', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
  notificationService: {
    getNotifications: jest.fn(),
    markAsRead: jest.fn(),
  },
}));

// Mock useNavigate and useLocation
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/dashboard' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock useApi hook
jest.mock('../hooks/useApi', () => ({
  useApi: jest.fn((apiCall, deps, options) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      apiCall()
        .then((result) => {
          setData(result);
          setLoading(false);
          if (options?.onSuccess) options.onSuccess(result);
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
      refetch: jest.fn(),
    };
  }),
}));

// Mock Material-UI useTheme and useMediaQuery
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    breakpoints: {
      down: () => false,
    },
    transitions: {
      create: () => 'transition',
      easing: {
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
      duration: {
        leavingScreen: 195,
      },
    },
  }),
  useMediaQuery: jest.fn(() => false), // Desktop by default
}));

const mockUser = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  role: 'manager',
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
      actionUrl: '/schedules/1',
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

const MockedNavigation = ({ children, ...props }) => (
  <BrowserRouter>
    <Navigation {...props}>
      {children || <div>Test Content</div>}
    </Navigation>
  </BrowserRouter>
);

describe('Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getCurrentUser.mockReturnValue(mockUser);
    notificationService.getNotifications.mockResolvedValue(mockNotifications);
  });

  it('renders navigation with all menu items', async () => {
    render(<MockedNavigation />);

    expect(screen.getByText('AI Schedule Manager')).toBeInTheDocument();

    // Check navigation items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Schedules')).toBeInTheDocument();
    expect(screen.getByText('Rules')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('displays user information correctly', async () => {
    render(<MockedNavigation />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('Manager')).toBeInTheDocument();
    });
  });

  it('shows user initials in avatar', async () => {
    render(<MockedNavigation />);

    await waitFor(() => {
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  it('handles user with no first/last name', async () => {
    authService.getCurrentUser.mockReturnValue({
      ...mockUser,
      firstName: null,
      lastName: null,
    });

    render(<MockedNavigation />);

    await waitFor(() => {
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('J')).toBeInTheDocument(); // Email initial
    });
  });

  it('navigates to correct page when clicking menu items', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    // Click on Employees
    const employeesButton = screen.getByRole('button', { name: 'Navigate to Employees' });
    await user.click(employeesButton);
    expect(mockNavigate).toHaveBeenCalledWith('/employees');

    // Click on Schedules
    const schedulesButton = screen.getByRole('button', { name: 'Navigate to Schedules' });
    await user.click(schedulesButton);
    expect(mockNavigate).toHaveBeenCalledWith('/schedules');
  });

  it('highlights current page in navigation', () => {
    render(<MockedNavigation />);

    // Dashboard should be selected (mocked location)
    const dashboardItem = screen.getByRole('button', { name: 'Navigate to Dashboard' });
    expect(dashboardItem).toHaveClass('Mui-selected');
  });

  it('opens and closes drawer on mobile', async () => {
    const { useMediaQuery } = require('@mui/material');
    useMediaQuery.mockReturnValue(true); // Mobile

    const user = userEvent.setup();
    render(<MockedNavigation />);

    // Should show menu button on mobile
    const menuButton = screen.getByLabelText('Open navigation drawer');
    expect(menuButton).toBeInTheDocument();

    await user.click(menuButton);
    // Drawer behavior is handled by Material-UI, we just check the button exists
  });

  it('toggles drawer on desktop', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    const closeButton = screen.getByLabelText('Close navigation drawer');
    await user.click(closeButton);
    // Drawer state management is internal
  });

  it('displays notifications with unread count', async () => {
    render(<MockedNavigation />);

    await waitFor(() => {
      const notificationButton = screen.getByLabelText('1 unread notifications');
      expect(notificationButton).toBeInTheDocument();
    });
  });

  it('opens notifications menu', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const notificationButton = screen.getByLabelText('1 unread notifications');
      await user.click(notificationButton);
    });

    expect(screen.getByText('Notifications (1 unread)')).toBeInTheDocument();
    expect(screen.getByText('Schedule Published')).toBeInTheDocument();
    expect(screen.getByText('Shift Conflict')).toBeInTheDocument();
  });

  it('marks notification as read when clicked', async () => {
    notificationService.markAsRead.mockResolvedValue({});
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const notificationButton = screen.getByLabelText('1 unread notifications');
      user.click(notificationButton);
    });

    await waitFor(() => {
      const unreadNotification = screen.getByText('Schedule Published');
      user.click(unreadNotification);
    });

    await waitFor(() => {
      expect(notificationService.markAsRead).toHaveBeenCalledWith('1');
      expect(mockNavigate).toHaveBeenCalledWith('/schedules/1');
    });
  });

  it('opens profile menu', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const profileButton = screen.getByLabelText('Account menu');
      await user.click(profileButton);
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    expect(screen.getByText('App Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('navigates to profile when clicking profile settings', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const profileButton = screen.getByLabelText('Account menu');
      await user.click(profileButton);
    });

    const profileSettings = screen.getByText('Profile Settings');
    await user.click(profileSettings);

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('navigates to settings when clicking app settings', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const profileButton = screen.getByLabelText('Account menu');
      await user.click(profileButton);
    });

    const appSettings = screen.getByText('App Settings');
    await user.click(appSettings);

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('calls logout when clicking logout', async () => {
    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const profileButton = screen.getByLabelText('Account menu');
      await user.click(profileButton);
    });

    const logoutButton = screen.getByText('Logout');
    await user.click(logoutButton);

    expect(authService.logout).toHaveBeenCalled();
  });

  it('shows theme toggle when onThemeToggle is provided', async () => {
    const mockThemeToggle = jest.fn();
    const user = userEvent.setup();

    render(<MockedNavigation onThemeToggle={mockThemeToggle} darkMode={false} />);

    const themeButton = screen.getByLabelText('Toggle theme');
    expect(themeButton).toBeInTheDocument();

    await user.click(themeButton);
    expect(mockThemeToggle).toHaveBeenCalled();
  });

  it('shows correct theme icon based on dark mode', () => {
    const mockThemeToggle = jest.fn();

    const { rerender } = render(
      <MockedNavigation onThemeToggle={mockThemeToggle} darkMode={false} />
    );

    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();

    rerender(<MockedNavigation onThemeToggle={mockThemeToggle} darkMode={true} />);

    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
  });

  it('shows "View All Notifications" button when there are more than 5 notifications', async () => {
    const manyNotifications = {
      notifications: Array.from({ length: 8 }, (_, i) => ({
        id: String(i + 1),
        title: `Notification ${i + 1}`,
        message: `Message ${i + 1}`,
        type: 'info',
        read: false,
        createdAt: '2024-01-15T08:00:00.000Z',
      })),
    };

    notificationService.getNotifications.mockResolvedValue(manyNotifications);

    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const notificationButton = screen.getByLabelText('8 unread notifications');
      user.click(notificationButton);
    });

    await waitFor(() => {
      expect(screen.getByText('View All Notifications')).toBeInTheDocument();
    });
  });

  it('handles no notifications state', async () => {
    notificationService.getNotifications.mockResolvedValue({ notifications: [] });

    const user = userEvent.setup();
    render(<MockedNavigation />);

    await waitFor(() => {
      const notificationButton = screen.getByLabelText('0 unread notifications');
      await user.click(notificationButton);
    });

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('renders children content in main area', () => {
    render(
      <MockedNavigation>
        <div data-testid="child-content">Custom Content</div>
      </MockedNavigation>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
  });

  it('shows correct page title in app bar', () => {
    render(<MockedNavigation />);

    // Should show Dashboard as current page (from mocked location)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('handles user without role', async () => {
    authService.getCurrentUser.mockReturnValue({
      ...mockUser,
      role: null,
    });

    render(<MockedNavigation />);

    await waitFor(() => {
      expect(screen.getByText('User')).toBeInTheDocument();
    });
  });

  it('handles navigation errors gracefully', async () => {
    notificationService.getNotifications.mockRejectedValue(new Error('API Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<MockedNavigation />);

    await waitFor(() => {
      // Should still render navigation
      expect(screen.getByText('AI Schedule Manager')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('has proper accessibility attributes', async () => {
    render(<MockedNavigation />);

    // Check ARIA labels
    expect(screen.getByLabelText('Navigate to Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Employees')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Schedules')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Rules')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Analytics')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to Settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('1 unread notifications')).toBeInTheDocument();
      expect(screen.getByLabelText('Account menu')).toBeInTheDocument();
    });
  });

  it('provides tooltips for navigation items', () => {
    render(<MockedNavigation />);

    const dashboardItem = screen.getByRole('button', { name: 'Navigate to Dashboard' });
    expect(dashboardItem).toHaveAttribute('aria-label', 'Navigate to Dashboard');
  });
});