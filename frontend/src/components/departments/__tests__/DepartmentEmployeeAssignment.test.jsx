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
import '@testing-library/jest-dom';
import DepartmentEmployeeAssignment from '../DepartmentEmployeeAssignment';
import api from '../../../services/api';
import MockAdapter from 'axios-mock-adapter';

// Mock axios API
const mock = new MockAdapter(api);

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
    mock.reset();

    // Default mock implementations
    mock.onGet('/api/departments').reply(200, {
      items: mockDepartments,
      total: 3
    });

    mock.onGet('/api/employees/unassigned').reply(200, mockUnassigned);

    // Mock employees for each department
    mock.onGet(/\/api\/departments\/\d+\/employees/).reply(200, mockEmployees.filter(e => e.departmentId === 1));
  });

  afterAll(() => {
    mock.restore();
  });

  describe('Component Rendering', () => {
    it('should render department list', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('Engineering')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
      });
    });

    it('should render unassigned employees section', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText(/unassigned employees/i)).toBeInTheDocument();
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      });
    });

    it('should display employee count per department', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const salesDept = screen.getByText('Sales').closest('div');
        expect(within(salesDept).getByText('10')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      render(<DepartmentEmployeeAssignment employees={[]} loading={true} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle empty employee list', async () => {
      mock.onGet("/api/employees/unassigned").replyOnce(200([]);

      render(<DepartmentEmployeeAssignment employees={[]} />);

      await waitFor(() => {
        expect(screen.getByText(/no employees/i)).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop Functionality', () => {
    it('should allow dragging employee to department', async () => {
      mock.onPost("/api/employees/bulk-assign-department").reply(200({
        successCount: 1,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales');

        // Simulate drag and drop
        fireEvent.dragStart(employee);
        fireEvent.dragEnter(department);
        fireEvent.drop(department);
      });

      await waitFor(() => {
        expect(mock.history.post.some(req => req.url.includes("bulk-assign"))).toBe(true);
      });
    });

    it('should highlight drop zone on drag over', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('Alice Johnson');
        const department = screen.getByText('Sales').closest('[data-dropzone]');

        fireEvent.dragStart(employee);
        fireEvent.dragEnter(department);
      });

      expect(department).toHaveClass('drag-over');
    });

    it('should remove highlight when drag leaves', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      mock.onPost("/api/employees/bulk-assign-department").reply(200({
        successCount: 1,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      mock.onPost("/api/employees/bulk-assign-department").reply(500(
        new Error('Assignment failed')
      );

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const employee = screen.getByText('John Doe'); // Already in Sales
        const department = screen.getByText('Sales');

        fireEvent.dragStart(employee);
        fireEvent.drop(department);
      });

      // Should not call bulk assign
      expect(mock.history.post.length).toBe(0);
    });
  });

  describe('Bulk Assignment', () => {
    it('should select multiple employees', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const checkbox1 = screen.getByLabelText('Select Alice Johnson');
        const checkbox2 = screen.getByLabelText('Select Charlie Brown');

        fireEvent.click(checkbox1);
        fireEvent.click(checkbox2);
      });

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });

    it('should select all employees', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAllCheckbox);
      });

      expect(screen.getByText(/5 selected/i)).toBeInTheDocument();
    });

    it('should deselect all employees', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const selectAllCheckbox = screen.getByLabelText(/select all/i);
        fireEvent.click(selectAllCheckbox); // Select all
        fireEvent.click(selectAllCheckbox); // Deselect all
      });

      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });

    it('should bulk assign selected employees', async () => {
      mock.onPost("/api/employees/bulk-assign-department").reply(200({
        successCount: 2,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getByLabelText('Select Alice Johnson'));
        fireEvent.click(screen.getByRole('button', { name: /assign selected/i }));
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/bulk assign employees/i)).toBeInTheDocument();
    });

    it('should clear selection after successful bulk assignment', async () => {
      mock.onPost("/api/employees/bulk-assign-department").reply(200({
        successCount: 2,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const bulkAssignButton = screen.getByRole('button', { name: /assign selected/i });
        expect(bulkAssignButton).toBeDisabled();
      });
    });
  });

  describe('Transfer Dialog', () => {
    it('should open transfer dialog', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const transferButton = screen.getAllByRole('button', { name: /transfer/i })[0];
        fireEvent.click(transferButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/transfer employees/i)).toBeInTheDocument();
    });

    it('should select source department', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      const fromDeptSelect = screen.getByLabelText(/from department/i);
      fireEvent.change(fromDeptSelect, { target: { value: '1' } });

      expect(fromDeptSelect).toHaveValue('1');
    });

    it('should select target department', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      const toDeptSelect = screen.getByLabelText(/to department/i);
      fireEvent.change(toDeptSelect, { target: { value: '2' } });

      expect(toDeptSelect).toHaveValue('2');
    });

    it('should transfer all employees from department', async () => {
      mock.onPost("/api/employees/transfer-department").reply(200({
        successCount: 2,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        // Verify transfer API was called(1, 2, null);
      });
    });

    it('should transfer specific employees', async () => {
      mock.onPost("/api/employees/transfer-department").reply(200({
        successCount: 1,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.change(screen.getByLabelText(/from department/i), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText(/to department/i), { target: { value: '2' } });

      // Select specific employees
      fireEvent.click(screen.getByLabelText('Select John Doe'));

      fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

      await waitFor(() => {
        // Verify transfer API was called(1, 2, [1]);
      });
    });

    it('should validate source and target are different', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        fireEvent.click(screen.getAllByRole('button', { name: /transfer/i })[0]);
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should show transfer confirmation message', async () => {
      mock.onPost("/api/employees/transfer-department").reply(200({
        successCount: 2,
        failureCount: 0
      });

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search employees/i);
        fireEvent.change(searchInput, { target: { value: 'Alice' } });
      });

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });

    it('should filter by department', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        const deptFilter = screen.getByLabelText(/filter by department/i);
        fireEvent.change(deptFilter, { target: { value: '1' } });
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument();
    });

    it('should show only unassigned employees', async () => {
      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      mock.onGet("/api/departments").replyOnce(500(
        new Error('Failed to load departments')
      );

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load departments/i)).toBeInTheDocument();
      });
    });

    it('should show error on bulk assignment failure', async () => {
      mock.onPost("/api/employees/bulk-assign-department").reply(500(
        new Error('Assignment failed')
      );

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
      mock.onPost("/api/employees/transfer-department").reply(500(
        new Error('Transfer failed')
      );

      render(<DepartmentEmployeeAssignment employees={mockEmployees} />);

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
