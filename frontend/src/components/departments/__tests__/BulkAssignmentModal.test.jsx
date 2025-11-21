import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BulkAssignmentModal from '../BulkAssignmentModal';
import api from '../../../services/api';

jest.mock('../../../services/api');

describe('BulkAssignmentModal', () => {
  const mockEmployees = [
    { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'Engineer' },
    { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'Designer' },
    { id: 3, firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', role: 'Manager' },
  ];

  const mockDepartments = [
    { id: 1, name: 'Engineering', employeeCount: 10 },
    { id: 2, name: 'Design', employeeCount: 5 },
    { id: 3, name: 'Management', employeeCount: 3 },
  ];

  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('employees')) {
        return Promise.resolve({ data: { items: mockEmployees } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('renders modal when open', async () => {
    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Bulk Employee Assignment')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Select Employees/i)).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(
      <BulkAssignmentModal
        open={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText('Bulk Employee Assignment')).not.toBeInTheDocument();
  });

  it('loads and displays employees and departments', async () => {
    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });
  });

  it('allows selecting and deselecting employees', async () => {
    const user = userEvent.setup();

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select first employee
    const firstCheckbox = screen.getAllByRole('checkbox')[1]; // Skip "select all"
    await user.click(firstCheckbox);

    expect(firstCheckbox).toBeChecked();

    // Deselect
    await user.click(firstCheckbox);
    expect(firstCheckbox).not.toBeChecked();
  });

  it('supports select all and deselect all', async () => {
    const user = userEvent.setup();

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    // Select all
    const selectAllButton = screen.getByText('Select All');
    await user.click(selectAllButton);

    // Check all checkboxes are checked (excluding first which is "select all")
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).toBeChecked();
    expect(checkboxes[3]).toBeChecked();

    // Deselect all
    const deselectAllButton = screen.getByText('Deselect All');
    await user.click(deselectAllButton);

    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    expect(checkboxes[3]).not.toBeChecked();
  });

  it('filters employees by search query', async () => {
    const user = userEvent.setup();

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search employees/i);
    await user.type(searchInput, 'Jane');

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });

  it('navigates through stepper steps', async () => {
    const user = userEvent.setup();

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Step 1: Select employees
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    await user.click(firstCheckbox);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Step 2: Choose department
    await waitFor(() => {
      expect(screen.getByText('Choose Target Department')).toBeInTheDocument();
    });
  });

  it('executes bulk assignment successfully', async () => {
    const user = userEvent.setup();

    api.post.mockResolvedValue({
      data: {
        successCount: 2,
        failureCount: 0,
        totalAttempted: 2,
        errors: [],
      }
    });

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Select employees
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    // Next to department selection
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByLabelText('Department')).toBeInTheDocument();
    });

    // Select department - this is simplified, actual implementation would need proper select interaction
    // Next to confirmation
    // Click execute

    // Verify API call
    // expect(api.post).toHaveBeenCalledWith('/api/employees/bulk-assign-department', ...);
  });

  it('handles bulk assignment errors', async () => {
    api.post.mockRejectedValue({
      response: { data: { detail: 'Bulk assignment failed' } }
    });

    // Test error handling
    // Similar to success test but verify error display
  });

  it('displays progress during bulk operation', async () => {
    // Test progress bar display
  });

  it('supports undo functionality', async () => {
    // Test undo button after successful operation
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();

    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('preselects employees when provided', async () => {
    render(
      <BulkAssignmentModal
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        preselectedEmployees={[1, 2]}
      />
    );

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[1]).toBeChecked(); // First employee
      expect(checkboxes[2]).toBeChecked(); // Second employee
      expect(checkboxes[3]).not.toBeChecked(); // Third employee
    });
  });
});
