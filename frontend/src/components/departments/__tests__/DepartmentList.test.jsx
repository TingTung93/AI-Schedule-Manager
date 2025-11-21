/**
 * Comprehensive tests for DepartmentList component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentList from '../DepartmentList';

describe('DepartmentList Component', () => {
  const mockDepartments = [
    { id: 1, name: 'Nursing', employee_count: 25, manager_id: 1 },
    { id: 2, name: 'Administration', employee_count: 10, manager_id: 2 },
    { id: 3, name: 'Laboratory', employee_count: 15, manager_id: 3 }
  ];

  const mockOnSelect = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders department list correctly', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('Nursing')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Laboratory')).toBeInTheDocument();
  });

  test('displays employee count for each department', () => {
    render(<DepartmentList departments={mockDepartments} />);

    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  test('calls onSelect when department is clicked', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText('Nursing'));

    expect(mockOnSelect).toHaveBeenCalledWith(mockDepartments[0]);
  });

  test('shows empty state when no departments', () => {
    render(<DepartmentList departments={[]} />);

    expect(screen.getByText(/no departments/i)).toBeInTheDocument();
  });

  test('renders edit button for each department', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        onEdit={mockOnEdit}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons).toHaveLength(3);
  });

  test('calls onEdit with correct department', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        onEdit={mockOnEdit}
      />
    );

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(mockDepartments[0]);
  });

  test('renders delete button when onDelete provided', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons).toHaveLength(3);
  });

  test('shows confirmation before delete', async () => {
    window.confirm = jest.fn(() => true);

    render(
      <DepartmentList
        departments={mockDepartments}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockOnDelete).toHaveBeenCalledWith(mockDepartments[0].id);
  });

  test('does not delete when confirmation cancelled', () => {
    window.confirm = jest.fn(() => false);

    render(
      <DepartmentList
        departments={mockDepartments}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  test('displays loading state', () => {
    render(<DepartmentList departments={[]} loading={true} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('displays error message', () => {
    const error = 'Failed to load departments';

    render(<DepartmentList departments={[]} error={error} />);

    expect(screen.getByText(error)).toBeInTheDocument();
  });

  test('filters departments by search term', () => {
    render(<DepartmentList departments={mockDepartments} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Nursing' } });

    expect(screen.getByText('Nursing')).toBeInTheDocument();
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  test('sorts departments by name', () => {
    render(<DepartmentList departments={mockDepartments} />);

    const sortButton = screen.getByRole('button', { name: /sort/i });
    fireEvent.click(sortButton);

    const departmentNames = screen.getAllByTestId('department-name')
      .map(el => el.textContent);

    expect(departmentNames[0]).toBe('Administration');
  });

  test('highlights selected department', () => {
    render(
      <DepartmentList
        departments={mockDepartments}
        selectedId={1}
      />
    );

    const nursingDept = screen.getByText('Nursing').closest('div');
    expect(nursingDept).toHaveClass('selected');
  });
});
