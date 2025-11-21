/**
 * Comprehensive tests for DepartmentForm component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DepartmentForm from '../DepartmentForm';

describe('DepartmentForm Component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty form for new department', () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  test('renders form with initial values for editing', () => {
    const department = {
      id: 1,
      name: 'Nursing',
      description: 'Nursing department'
    };

    render(<DepartmentForm department={department} onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('Nursing');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Nursing department');
  });

  test('validates required name field', async () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('validates name length', async () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} />);

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'AB' } });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'New Department' }
    });

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Department description' }
    });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'New Department',
        description: 'Department description'
      });
    });
  });

  test('calls onCancel when cancel button clicked', () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('disables submit button while submitting', async () => {
    render(<DepartmentForm onSubmit={mockOnSubmit} submitting={true} />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });

  test('shows error message on submission failure', () => {
    const error = 'Failed to save department';

    render(<DepartmentForm onSubmit={mockOnSubmit} error={error} />);

    expect(screen.getByText(error)).toBeInTheDocument();
  });

  test('clears form after successful submission', async () => {
    const { rerender } = render(<DepartmentForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Department' }
    });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    rerender(<DepartmentForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
  });

  test('allows manager selection', () => {
    const managers = [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' }
    ];

    render(<DepartmentForm onSubmit={mockOnSubmit} managers={managers} />);

    const managerSelect = screen.getByLabelText(/manager/i);
    expect(managerSelect).toBeInTheDocument();

    fireEvent.change(managerSelect, { target: { value: '1' } });
    expect(managerSelect).toHaveValue('1');
  });

  test('validates unique department name', async () => {
    const existingNames = ['Nursing', 'Administration'];

    render(
      <DepartmentForm
        onSubmit={mockOnSubmit}
        existingNames={existingNames}
      />
    );

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Nursing' }
    });

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });
});
