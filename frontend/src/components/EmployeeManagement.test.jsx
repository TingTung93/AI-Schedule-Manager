import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import EmployeeManagement from './EmployeeManagement';
import { employeeService } from '../services/api';

// Mock the API service
jest.mock('../services/api', () => ({
  employeeService: {
    getEmployees: jest.fn(),
    createEmployee: jest.fn(),
    updateEmployee: jest.fn(),
    deleteEmployee: jest.fn(),
  },
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
    employeeService.getEmployees.mockResolvedValue(mockEmployees);
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

  it('allows searching employees', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search employees...');
    await user.type(searchInput, 'John');

    // Should filter to show only John
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('allows filtering by role', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Open role filter dropdown
    const roleFilter = screen.getByLabelText('Filter by role');
    await user.click(roleFilter);

    // Select cashier role
    const cashierOption = screen.getByText('Cashier');
    await user.click(cashierOption);

    // Should show only Jane
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('opens add employee dialog when clicking Add Employee button', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    const addButton = screen.getByText('Add Employee');
    await user.click(addButton);

    expect(screen.getByText('Add New Employee')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('validates required fields in add employee form', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    const addButton = screen.getByText('Add Employee');
    await user.click(addButton);

    // Try to submit with empty form
    const submitButton = screen.getByRole('button', { name: 'Add Employee' });
    expect(submitButton).toBeDisabled();

    // Fill required fields
    await user.type(screen.getByLabelText('First name'), 'Test');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');

    // Select role
    const roleSelect = screen.getByLabelText('Employee role');
    await user.click(roleSelect);
    await user.click(screen.getByText('Manager'));

    // Submit button should now be enabled
    expect(submitButton).toBeEnabled();
  });

  it('calls createEmployee API when submitting new employee form', async () => {
    const user = userEvent.setup();
    employeeService.createEmployee.mockResolvedValue({ id: '3', firstName: 'Test', lastName: 'User' });

    render(<EmployeeManagement />);

    const addButton = screen.getByText('Add Employee');
    await user.click(addButton);

    // Fill form
    await user.type(screen.getByLabelText('First name'), 'Test');
    await user.type(screen.getByLabelText('Last name'), 'User');
    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Phone number'), '555-0123');
    await user.type(screen.getByLabelText('Hourly rate'), '20');

    // Select role
    const roleSelect = screen.getByLabelText('Employee role');
    await user.click(roleSelect);
    await user.click(screen.getByText('Manager'));

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Add Employee' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(employeeService.createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '555-0123',
          role: 'manager',
          hourlyRate: 20,
        })
      );
    });
  });

  it('opens edit dialog when clicking edit button', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click edit button for John Doe
    const johnRow = screen.getByText('John Doe').closest('tr');
    const editButton = within(johnRow).getByLabelText('Edit John Doe');
    await user.click(editButton);

    expect(screen.getByText('Edit Employee')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
  });

  it('calls updateEmployee API when editing employee', async () => {
    const user = userEvent.setup();
    employeeService.updateEmployee.mockResolvedValue({ id: '1', firstName: 'John Updated' });

    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click edit button
    const johnRow = screen.getByText('John Doe').closest('tr');
    const editButton = within(johnRow).getByLabelText('Edit John Doe');
    await user.click(editButton);

    // Update first name
    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'John Updated');

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Update Employee' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(employeeService.updateEmployee).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          firstName: 'John Updated',
        })
      );
    });
  });

  it('opens delete confirmation dialog when clicking delete button', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click delete button for John Doe
    const johnRow = screen.getByText('John Doe').closest('tr');
    const deleteButton = within(johnRow).getByLabelText('Delete John Doe');
    await user.click(deleteButton);

    expect(screen.getByText('Delete Employee')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete John Doe/)).toBeInTheDocument();
  });

  it('calls deleteEmployee API when confirming deletion', async () => {
    const user = userEvent.setup();
    employeeService.deleteEmployee.mockResolvedValue({});

    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click delete button
    const johnRow = screen.getByText('John Doe').closest('tr');
    const deleteButton = within(johnRow).getByLabelText('Delete John Doe');
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(employeeService.deleteEmployee).toHaveBeenCalledWith('1');
    });
  });

  it('handles availability settings correctly', async () => {
    const user = userEvent.setup();
    render(<EmployeeManagement />);

    const addButton = screen.getByText('Add Employee');
    await user.click(addButton);

    // Find Monday availability switch
    const mondaySwitch = screen.getByLabelText('Available on monday');
    expect(mondaySwitch).toBeChecked();

    // Toggle Monday availability off
    await user.click(mondaySwitch);
    expect(mondaySwitch).not.toBeChecked();

    // Monday time inputs should be disabled
    const mondayStart = screen.getByLabelText('Start time for monday');
    const mondayEnd = screen.getByLabelText('End time for monday');
    expect(mondayStart).toBeDisabled();
    expect(mondayEnd).toBeDisabled();
  });

  it('handles pagination correctly', async () => {
    // Mock more employees to test pagination
    const manyEmployees = {
      employees: Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        firstName: `Employee${i + 1}`,
        lastName: 'Test',
        email: `employee${i + 1}@example.com`,
        role: 'cashier',
        isActive: true,
      })),
    };

    employeeService.getEmployees.mockResolvedValue(manyEmployees);

    const user = userEvent.setup();
    render(<EmployeeManagement />);

    await waitFor(() => {
      expect(screen.getByText('Employee1 Test')).toBeInTheDocument();
    });

    // Should show pagination controls
    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();

    // Click next page
    const nextPageButton = screen.getByLabelText('Go to next page');
    await user.click(nextPageButton);

    // Should show next set of employees
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument();
  });

  it('shows loading state while fetching employees', () => {
    // Mock loading state
    employeeService.getEmployees.mockImplementation(() => new Promise(() => {}));

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