import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Navigation from './Navigation';

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
      type: 'info',
      read: false,
      createdAt: '2024-01-15T08:00:00.000Z',
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
  const { authService, notificationService } = require('../services/api');

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

  it('renders children content in main area', () => {
    render(
      <MockedNavigation>
        <div data-testid="child-content">Custom Content</div>
      </MockedNavigation>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
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
  });
});