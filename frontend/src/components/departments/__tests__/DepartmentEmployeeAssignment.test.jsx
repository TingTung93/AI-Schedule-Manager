/**
 * Tests for DepartmentEmployeeAssignment Component
 *
 * Tests:
 * - Drag-and-drop functionality
 * - Bulk assignment
 * - Transfer dialog
 * - Employee list rendering
 * - Error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import '@testing-library/jest-dom';
import DepartmentEmployeeAssignment from '../DepartmentEmployeeAssignment';
import * as departmentService from '../../../services/departmentService';

// Mock the department service
jest.mock('../../../services/departmentService');

describe('DepartmentEmployeeAssignment Component', () => {
  const mockDepartments = [
    { id: 1, name: 'Sales', employeeCount: 10 },
    { id: 2, name: 'Engineering', employeeCount: 25 },
    { id: 3, name: 'Marketing', employeeCount: 8 }
  ];

  const mockEmployees = [
    { id: 1, name: 'John Doe', email: 'john@example.com', departmentId: 1 },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', departmentId: 1 },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', departmentId: 2 }
  ];

  const mockUnassigned = [
    { id: 4, name: 'Alice Johnson', email: 'alice@example.com', departmentId: null },
    { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', departmentId: null }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    departmentService.getDepartments = jest.fn().mockResolvedValue({
      items: mockDepartments,
      total: 3
    });

    departmentService.getUnassignedEmployees = jest.fn().mockResolvedValue(mockUnassigned);
  });

  const renderWithDnd = (component) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        {component}
      </DndProvider>
    );
  };

  describe('Component Rendering', () => {
    it('should render department list', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('Engineering')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
      });
    });

    it('should render unassigned employees section', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText(/unassigned employees/i)).toBeInTheDocument();
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      });
    });

    it('should display employee count per department', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const salesDept = screen.getByText('Sales').closest('div');
        expect(within(salesDept).getByText('10')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={[]} loading={true} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle empty employee list', async () => {
      departmentService.getUnassignedEmployees.mockResolvedValueOnce([]);

      renderWithDnd(<DepartmentEmployeeAssignment employees={[]} />);

      await waitFor(() => {
        expect(screen.getByText(/no employees/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should allow dragging employee to department', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales');

        // Simulate drag and drop
        fireEvent.dragStart(employee);
        fireEvent.dragEnter(department);
        fireEvent.drop(department);
      });

      await waitFor(() => {
        expect(departmentService.bulkAssignDepartment).toHaveBeenCalledWith([4], 1);
      });
    });

    it('should highlight drop zone on drag over', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales').closest('[data-dropzone]');

        fireEvent.dragStart(employee);
        fireEvent.dragEnter(department);
      });

      expect(department).toHaveClass('drag-over');
    });

    it('should remove highlight when drag leaves', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales').closest('[data-dropzone]');

        fireEvent.dragStart(employee);
        fireEvent.dragEnter(department);
        fireEvent.dragLeave(department);
      });

      expect(department).not.toHaveClass('drag-over');
    });

    it('should show success message after successful drop', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales');

        fireEvent.dragStart(employee);
        fireEvent.drop(department);
      });

      await waitFor(() => {
        expect(screen.getByText(/successfully assigned/i)).toBeInTheDocument();
      });
    });

    it('should handle drop errors', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockRejectedValue(
        new Error('Assignment failed')
      );

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales');

        fireEvent.dragStart(employee);
        fireEvent.drop(department);
      });

      await waitFor(() => {
        expect(screen.getByText(/assignment failed/i)).toBeInTheDocument();
      });
    });

    it('should prevent dropping on same department', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('John Doe'); // Already in Sales
        const department = screen.getByText('Sales');

        fireEvent.dragStart(employee);
        fireEvent.drop(department);
      });

      // Should not call bulk assign
      expect(departmentService.bulkAssignDepartment).not.toHaveBeenCalled();
    });
  });

  describe('Bulk Assignment', () => {
    it('should select multiple employees', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const checkbox1 = screen.getByLabelText('Select Alice Johnson');
        const checkbox2 = screen.getByLabelText('Select Charlie Brown');

        fireEvent.click(checkbox1);
        fireEvent.click(checkbox2);
      });

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it('should select all employees', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAllCheckbox);
      });

      expect(screen.getByText(/5 selected/i)).toBeInTheDocument();
    });

    it('should deselect all employees', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAllCheckbox); // Select all
        fireEvent.click(selectAllCheckbox); // Deselect all
      });

      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });

    it('should bulk assign selected employees', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        // Select employees
        fireEvent.click(screen.getByLabelText('Select Alice Johnson'));
        fireEvent.click(screen.getByLabelText('Select Charlie Brown'));

        // Click bulk assign button
        const bulkAssignButton = screen.getByRole('button', { name: /assign selected/i });
        fireEvent.click(bulkAssignButton);
      });

      // Select department in modal
      const departmentSelect = screen.getByLabelText(/select department/i);
      fireEvent.change(departmentSelect, { target: { value: '1' } });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(departmentService.bulkAssignDepartment).toHaveBeenCalledWith([4, 5], 1);
      });
    });

    it('should show bulk assignment modal', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Select Alice Johnson'));
        fireEvent.click(screen.getByRole('button', { name: /assign selected/i }));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/bulk assign employees/i)).toBeInTheDocument();
    });

    it('should clear selection after successful bulk assignment', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Select Alice Johnson'));
        fireEvent.click(screen.getByRole('button', { name: /assign selected/i }));
      });

      const departmentSelect = screen.getByLabelText(/select department/i);
      fireEvent.change(departmentSelect, { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
      });
    });

    it('should disable bulk assign button when no employees selected', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const bulkAssignButton = screen.getByRole('button', { name: /assign selected/i });
        expect(bulkAssignButton).toBeDisabled();
      });
    });
  });

  describe('Transfer Dialog', () => {
    it('should open transfer dialog', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const transferButton = screen.getAllByRole('button', { name: /transfer/i })[0];
        fireEvent.click(transferButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/transfer employees/i)).toBeInTheDocument();
    });

    it('should select source department', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      const fromDeptSelect = screen.getByLabelText(/from department/i);
      fireEvent.change(fromDeptSelect, { target: { value: '1' } });

      expect(fromDeptSelect).toHaveValue('1');
    });

    it('should select target department', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      const toDeptSelect = screen.getByLabelText(/to department/i);
      fireEvent.change(toDeptSelect, { target: { value: '2' } });

      expect(toDeptSelect).toHaveValue('2');
    });

    it('should transfer all employees from department', async () => {
      departmentService.transferDepartment = jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(departmentService.transferDepartment).toHaveBeenCalledWith(1, 2, null);
      });
    });

    it('should transfer specific employees', async () => {
      departmentService.transferDepartment = jest.fn().mockResolvedValue({
        successCount: 1,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });

      // Select specific employees
      fireEvent.click(screen.getByLabelText('Select John Doe'));

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(departmentService.transferDepartment).toHaveBeenCalledWith(1, 2, [1]);
      });
    });

    it('should validate source and target are different', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '1' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(screen.getByText(/must select different departments/i)).toBeInTheDocument();
      });
    });

    it('should close transfer dialog on cancel', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should show transfer confirmation message', async () => {
      departmentService.transferDepartment = jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0
      });

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        expect(screen.getByText(/2 employees transferred successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter', () => {
    it('should filter employees by name', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search employees/i);
        fireEvent.change(searchInput, { target: { value: 'Alice' } });
      });

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });

    it('should filter by department', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const deptFilter = screen.getByLabelText(/filter by department/i);
        fireEvent.change(deptFilter, { target: { value: '1' } });
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
    });

    it('should show only unassigned employees', async () => {
      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const unassignedFilter = screen.getByLabelText(/show unassigned only/i);
        fireEvent.click(unassignedFilter);
      });

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors during load', async () => {
      departmentService.getDepartments.mockRejectedValueOnce(
        new Error('Failed to load departments')
      );

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load departments/i)).toBeInTheDocument();
      });
    });

    it('should show error on bulk assignment failure', async () => {
      departmentService.bulkAssignDepartment = jest.fn().mockRejectedValue(
        new Error('Assignment failed')
      );

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales');

        fireEvent.dragStart(employee);
        fireEvent.drop(department);
      });

      await waitFor(() => {
        expect(screen.getByText(/assignment failed/i)).toBeInTheDocument();
      });
    });

    it('should show error on transfer failure', async () => {
      departmentService.transferDepartment = jest.fn().mockRejectedValue(
        new Error('Transfer failed')
      );

      renderWithDnd(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
        fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/transfer failed/i)).toBeInTheDocument();
      });
    });
  });
});
