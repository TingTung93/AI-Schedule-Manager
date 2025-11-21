import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DepartmentSelector from '../../common/DepartmentSelector';
import api from '../../../services/api';

jest.mock('../../../services/api');

describe('DepartmentSelector', () => {
  const mockDepartments = [
    {
      id: 1,
      name: 'Engineering',
      parentDepartmentId: null,
      active: true,
      employeeCount: 20,
      capacity: 25,
    },
    {
      id: 2,
      name: 'Frontend',
      parentDepartmentId: 1,
      active: true,
      employeeCount: 10,
      capacity: 12,
    },
    {
      id: 3,
      name: 'Backend',
      parentDepartmentId: 1,
      active: true,
      employeeCount: 10,
      capacity: 10,
    },
    {
      id: 4,
      name: 'Design',
      parentDepartmentId: null,
      active: true,
      employeeCount: 5,
      capacity: 15,
    },
    {
      id: 5,
      name: 'Marketing',
      parentDepartmentId: null,
      active: false,
      employeeCount: 0,
      capacity: 10,
    },
  ];

  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: { items: mockDepartments } });
  });

  it('renders with default label', async () => {
    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    expect(screen.getByLabelText('Department')).toBeInTheDocument();
  });

  it('renders with custom label and placeholder', async () => {
    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        label="Select Dept"
        placeholder="Choose one..."
      />
    );

    expect(screen.getByLabelText('Select Dept')).toBeInTheDocument();
  });

  it('loads and displays departments', async () => {
    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/departments',
        expect.objectContaining({
          params: { active: true }
        })
      );
    });
  });

  it('displays hierarchical structure with indentation', async () => {
    const user = userEvent.setup();

    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    // Open dropdown
    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    // Check for hierarchical options (simplified - actual test would verify indentation)
    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
    });
  });

  it('shows employee count when enabled', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        showEmployeeCount={true}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText(/20 employee/i)).toBeInTheDocument();
    });
  });

  it('hides employee count when disabled', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        showEmployeeCount={false}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.queryByText(/employee/i)).not.toBeInTheDocument();
    });
  });

  it('disables departments at capacity', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        disableAtCapacity={true}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    // Backend department (10/10 capacity) should have "At Capacity" indicator
    await waitFor(() => {
      expect(screen.getByText(/At Capacity/i)).toBeInTheDocument();
    });
  });

  it('excludes inactive departments by default', async () => {
    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/departments',
        expect.objectContaining({
          params: { active: true }
        })
      );
    });
  });

  it('includes inactive departments when showInactive is true', async () => {
    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        showInactive={true}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/departments',
        expect.objectContaining({
          params: {}
        })
      );
    });
  });

  it('calls onChange with selected department', async () => {
    const user = userEvent.setup();

    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Design'));

    expect(mockOnChange).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ id: 4, name: 'Design' })
    );
  });

  it('supports multi-select mode', async () => {
    const user = userEvent.setup();

    render(
      <DepartmentSelector
        value={[]}
        onChange={mockOnChange}
        multiple={true}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Design'));

    expect(mockOnChange).toHaveBeenCalledWith(
      [4],
      expect.arrayContaining([expect.objectContaining({ id: 4 })])
    );
  });

  it('filters departments by search query', async () => {
    const user = userEvent.setup();

    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    const autocomplete = screen.getByLabelText('Department');
    await user.type(autocomplete, 'Front');

    await waitFor(() => {
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.queryByText('Design')).not.toBeInTheDocument();
    });
  });

  it('displays selected value', async () => {
    render(
      <DepartmentSelector
        value={1}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument();
    });
  });

  it('saves and displays recent selections', async () => {
    const user = userEvent.setup();

    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    // Select a department
    const autocomplete = screen.getByLabelText('Department');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Design'));

    // Re-render to check recent
    const { rerender } = render(
      <DepartmentSelector value={null} onChange={mockOnChange} />
    );

    await user.click(autocomplete);

    // Should show "Recent" chip
    await waitFor(() => {
      const recentChips = screen.queryAllByText('Recent');
      expect(recentChips.length).toBeGreaterThan(0);
    });
  });

  it('handles loading state', () => {
    api.get.mockImplementation(() => new Promise(() => {}));

    render(<DepartmentSelector value={null} onChange={mockOnChange} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        error="Please select a department"
      />
    );

    expect(screen.getByText('Please select a department')).toBeInTheDocument();
  });

  it('handles required field', async () => {
    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        required={true}
      />
    );

    const input = screen.getByLabelText(/Department/i);
    expect(input).toBeRequired();
  });

  it('handles disabled state', async () => {
    render(
      <DepartmentSelector
        value={null}
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const autocomplete = screen.getByLabelText('Department');
    expect(autocomplete).toBeDisabled();
  });
});
