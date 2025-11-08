import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmployeeManagement from './EmployeeManagement';
import api from '../services/api';

// Mock the API module
jest.mock('../services/api', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => error.message || 'An error occurred'),
}));

// Mock useApi and useApiMutation hooks
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
  useApiMutation: jest.fn((apiCall, options) => {
    const [loading, setLoading] = React.useState(false);

    const mutate = jest.fn(async (...args) => {
      setLoading(true);
      try {
        const result = await apiCall(...args);
        setLoading(false);
        if (options?.onSuccess) options.onSuccess(result);
        return result;
      } catch (error) {
        setLoading(false);
        if (options?.onError) options.onError(error);
        throw error;
      }
    });

    return {
      mutate,
      loading,
      data: null,
      error: null,
      reset: jest.fn(),
    };
  }),
}));

const mockEmployees = {
  employees: [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '123-456-7890',
      role: 'manager',
      hourlyRate: 25.0,
      qualifications: ['First Aid', 'Manager Training'],
      availability: {
        monday: { available: true, start: '09:00', end: '17:00' },
        tuesday: { available: true, start: '09:00', end: '17:00' },
        wednesday: { available: true, start: '09:00', end: '17:00' },
        thursday: { available: true, start: '09:00', end: '17:00' },
        friday: { available: true, start: '09:00', end: '17:00' },
        saturday: { available: false, start: '09:00', end: '17:00' },
        sunday: { available: false, start: '09:00', end: '17:00' },
      },
      maxHoursPerWeek: 40,
      isActive: true,
    },
    {
      id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '098-765-4321',
      role: 'cashier',
      hourlyRate: 15.0,
      qualifications: ['Customer Service'],
      availability: {
        monday: { available: true, start: '10:00', end: '18:00' },
        tuesday: { available: true, start: '10:00', end: '18:00' },
        wednesday: { available: false, start: '10:00', end: '18:00' },
        thursday: { available: true, start: '10:00', end: '18:00' },
        friday: { available: true, start: '10:00', end: '18:00' },
        saturday: { available: true, start: '09:00', end: '17:00' },
        sunday: { available: false, start: '09:00', end: '17:00' },
      },
      maxHoursPerWeek: 30,
      isActive: true,
    },
  ],
};

describe('EmployeeManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: mockEmployees });
    api.post.mockResolvedValue({ data: {} });
    api.patch.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: {} });
  });

  it('renders the employee management interface', async () => {
    render(<EmployeeManagement />);

    expect(screen.getByText('Employee Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search employees...')).toBeInTheDocument();
    expect(screen.getByText('Add Employee')).toBeInTheDocument();

    // Wait for employees to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays employee information correctly', async () => {
    render(<EmployeeManagement />);

    await waitFor(() => {
      // Check first employee
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText('123-456-7890')).toBeInTheDocument();
      expect(screen.getByText('manager')).toBeInTheDocument();
      expect(screen.getByText('$25.00/hr')).toBeInTheDocument();

      // Check qualifications
      expect(screen.getByText('First Aid')).toBeInTheDocument();
      expect(screen.getByText('Manager Training')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching employees', () => {
    // Mock loading state
    api.get.mockImplementation(() => new Promise(() => {}));

    render(<EmployeeManagement />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    render(<EmployeeManagement />);

    // Check for proper ARIA labels
    expect(screen.getByLabelText('Search employees')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by role')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Add new employee')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Edit John Doe')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete John Doe')).toBeInTheDocument();
    });
  });
});