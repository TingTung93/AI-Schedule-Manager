/**
 * Tests for DepartmentEmployeeAssignment Component
 *
 * Tests drag-and-drop functionality, bulk operations, and transfer dialog.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DepartmentEmployeeAssignment from './DepartmentEmployeeAssignment';
import * as departmentService from '../../services/departmentService';
import * as employeeService from '../../services/employeeService';

// Mock services
jest.mock('../../services/departmentService');
jest.mock('../../services/employeeService');

describe('DepartmentEmployeeAssignment', () => {
  const mockDepartment = {
    id: 1,
    name: 'Engineering',
    description: 'Software Development',
  };

  const mockUnassignedEmployees = [
    { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', role: 'Developer' },
    { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', role: 'Designer' },
  ];

  const mockAssignedEmployees = [
    { id: 3, firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', role: 'Manager' },
    { id: 4, firstName: 'Alice', lastName: 'Williams', email: 'alice@example.com', role: 'Developer' },
  ];

  const mockDepartments = [
    { id: 1, name: 'Engineering', active: true },
    { id: 2, name: 'Sales', active: true },
    { id: 3, name: 'Marketing', active: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    departmentService.getUnassignedEmployees.mockResolvedValue(mockUnassignedEmployees);
    departmentService.getDepartment.mockResolvedValue(mockDepartment);
    departmentService.getDepartments.mockResolvedValue({ items: mockDepartments });
    employeeService.getEmployees.mockResolvedValue({ items: mockAssignedEmployees });
    departmentService.bulkAssignDepartment.mockResolvedValue({
      successCount: 1,
      totalAttempted: 1,
      failureCount: 0,
      failures: [],
    });
    departmentService.transferDepartment.mockResolvedValue({
      successCount: 1,
      totalAttempted: 1,
    });
  });

  describe('Initial Rendering', () => {
    it('should render component with header', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/Employee Assignment/i)).toBeInTheDocument();
        expect(screen.getByText(/Engineering/i)).toBeInTheDocument();
      });
    });

    it('should load and display unassigned employees', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should load and display assigned employees', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.getByText('Alice Williams')).toBeInTheDocument();
      });
    });

    it('should display employee count badges', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        const unassignedBadge = screen.getByText('Unassigned Employees').closest('div');
        expect(unassignedBadge).toBeInTheDocument();

        const assignedBadge = screen.getByText('Department Employees').closest('div');
        expect(assignedBadge).toBeInTheDocument();
      });
    });
  });

  describe('Selection Functionality', () => {
    it('should allow selecting individual unassigned employees', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );

      fireEvent.click(johnCheckbox);

      expect(johnCheckbox).toBeChecked();
    });

    it('should allow selecting individual assigned employees', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );

      fireEvent.click(bobCheckbox);

      expect(bobCheckbox).toBeChecked();
    });

    it('should allow select all unassigned employees', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]; // First checkbox is select all
      fireEvent.click(selectAllCheckbox);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        const unassignedCheckboxes = checkboxes.slice(1, 3); // First two employee checkboxes
        unassignedCheckboxes.forEach(cb => {
          expect(cb).toBeChecked();
        });
      });
    });
  });

  describe('Bulk Assign Operations', () => {
    it('should show bulk assign button when employees are selected', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select an employee
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Assign 1 Selected/i)).toBeInTheDocument();
      });
    });

    it('should call bulkAssignDepartment when bulk assign is clicked', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select an employee
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      // Click bulk assign button
      const assignButton = await screen.findByText(/Assign 1 Selected/i);
      fireEvent.click(assignButton);

      await waitFor(() => {
        expect(departmentService.bulkAssignDepartment).toHaveBeenCalledWith([1], 1);
      });
    });

    it('should show success message after successful bulk assign', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select and assign
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      const assignButton = await screen.findByText(/Assign 1 Selected/i);
      fireEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully assigned/i)).toBeInTheDocument();
      });
    });

    it('should handle bulk assign errors', async () => {
      departmentService.bulkAssignDepartment.mockRejectedValue({
        response: { data: { message: 'Assignment failed' } }
      });

      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select and assign
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      const assignButton = await screen.findByText(/Assign 1 Selected/i);
      fireEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText(/Assignment failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Unassign Operations', () => {
    it('should show bulk unassign button when assigned employees are selected', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Select an assigned employee
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Unassign 1/i)).toBeInTheDocument();
      });
    });

    it('should call bulkAssignDepartment with null when unassigning', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Select and unassign
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      const unassignButton = await screen.findByText(/Unassign 1/i);
      fireEvent.click(unassignButton);

      await waitFor(() => {
        expect(departmentService.bulkAssignDepartment).toHaveBeenCalledWith([3], null);
      });
    });
  });

  describe('Transfer Dialog', () => {
    it('should show transfer button when assigned employees are selected', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Select an assigned employee
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      await waitFor(() => {
        expect(screen.getByText(/Transfer/i)).toBeInTheDocument();
      });
    });

    it('should open transfer dialog when transfer button is clicked', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Select and click transfer
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      const transferButton = screen.getByRole('button', { name: /Transfer/i });
      fireEvent.click(transferButton);

      await waitFor(() => {
        expect(screen.getByText(/Transfer Employees to Another Department/i)).toBeInTheDocument();
      });
    });

    it('should load available departments for transfer', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Open transfer dialog
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      const transferButton = screen.getByRole('button', { name: /Transfer/i });
      fireEvent.click(transferButton);

      await waitFor(() => {
        expect(departmentService.getDepartments).toHaveBeenCalledWith({ active: true });
      });
    });

    it('should call transferDepartment when transfer is confirmed', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Open transfer dialog
      const checkboxes = screen.getAllByRole('checkbox');
      const bobCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('Bob Johnson')
      );
      fireEvent.click(bobCheckbox);

      const transferButton = screen.getByRole('button', { name: /Transfer/i });
      fireEvent.click(transferButton);

      // Wait for dialog
      await waitFor(() => {
        expect(screen.getByLabelText(/Target Department/i)).toBeInTheDocument();
      });

      // Select target department
      const select = screen.getByLabelText(/Target Department/i);
      fireEvent.mouseDown(select);

      const salesOption = await screen.findByText('Sales');
      fireEvent.click(salesOption);

      // Confirm transfer
      const confirmButton = screen.getByRole('button', { name: /Transfer/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(departmentService.transferDepartment).toHaveBeenCalledWith(1, 2, [3]);
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload data when refresh button is clicked', async () => {
      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Clear mock calls
      jest.clearAllMocks();

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /Refresh data/i });
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(departmentService.getUnassignedEmployees).toHaveBeenCalled();
        expect(departmentService.getDepartment).toHaveBeenCalledWith(1);
        expect(employeeService.getEmployees).toHaveBeenCalledWith({ departmentId: 1 });
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when data loading fails', async () => {
      departmentService.getUnassignedEmployees.mockRejectedValue({
        response: { data: { message: 'Failed to load data' } }
      });

      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load employee data/i)).toBeInTheDocument();
      });
    });

    it('should allow closing error messages', async () => {
      departmentService.bulkAssignDepartment.mockRejectedValue({
        response: { data: { message: 'Assignment failed' } }
      });

      render(<DepartmentEmployeeAssignment departmentId={1} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Trigger error
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      const assignButton = await screen.findByText(/Assign 1 Selected/i);
      fireEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText(/Assignment failed/i)).toBeInTheDocument();
      });

      // Close error
      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Assignment failed/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('No Department Selected', () => {
    it('should show message when no department is selected', () => {
      render(<DepartmentEmployeeAssignment />);

      expect(screen.getByText(/Select a department to view assigned employees/i)).toBeInTheDocument();
    });

    it('should not show bulk assign button when no department is selected', async () => {
      departmentService.getUnassignedEmployees.mockResolvedValue(mockUnassignedEmployees);

      render(<DepartmentEmployeeAssignment />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Try to select an employee
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      // Bulk assign button should not appear
      expect(screen.queryByText(/Assign.*Selected/i)).not.toBeInTheDocument();
    });
  });

  describe('Callback Functionality', () => {
    it('should call onAssignmentChange after successful assignment', async () => {
      const onAssignmentChange = jest.fn();
      render(<DepartmentEmployeeAssignment departmentId={1} onAssignmentChange={onAssignmentChange} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select and assign
      const checkboxes = screen.getAllByRole('checkbox');
      const johnCheckbox = checkboxes.find(cb =>
        cb.closest('.MuiCard-root')?.textContent?.includes('John Doe')
      );
      fireEvent.click(johnCheckbox);

      const assignButton = await screen.findByText(/Assign 1 Selected/i);
      fireEvent.click(assignButton);

      await waitFor(() => {
        expect(onAssignmentChange).toHaveBeenCalled();
      });
    });
  });
});
