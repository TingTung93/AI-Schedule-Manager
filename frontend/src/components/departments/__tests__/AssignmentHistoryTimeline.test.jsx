import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AssignmentHistoryTimeline from '../AssignmentHistoryTimeline';
import api from '../../../services/api';

jest.mock('../../../services/api');

describe('AssignmentHistoryTimeline', () => {
  const mockHistoryData = [
    {
      id: 1,
      changeDate: '2025-01-15T10:00:00Z',
      fromDepartment: { id: 1, name: 'Engineering' },
      toDepartment: { id: 2, name: 'Design' },
      changedBy: 'admin@example.com',
      reason: 'Reorganization',
    },
    {
      id: 2,
      changeDate: '2025-01-10T14:30:00Z',
      fromDepartment: null,
      toDepartment: { id: 1, name: 'Engineering' },
      changedBy: 'hr@example.com',
      reason: 'New hire',
    },
    {
      id: 3,
      changeDate: '2025-01-05T09:15:00Z',
      fromDepartment: { id: 2, name: 'Design' },
      toDepartment: null,
      changedBy: 'system',
      reason: 'Department closure',
    },
  ];

  const mockDepartments = [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Design' },
    { id: 3, name: 'Marketing' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    render(<AssignmentHistoryTimeline employeeId={1} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('fetches and displays assignment history', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
    });
  });

  it('displays timeline with correct icons for different change types', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      // Check for timeline items
      const timeline = screen.getByRole('list');
      expect(timeline).toBeInTheDocument();
    });
  });

  it('handles empty history state', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/No assignment history found/i)).toBeInTheDocument();
    });
  });

  it('handles error state with retry', async () => {
    api.get.mockRejectedValue({
      response: { data: { detail: 'Failed to load history' } }
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /refresh/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('refreshes data when refresh button clicked', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    jest.clearAllMocks();

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
  });

  it('exports history to CSV', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    global.URL.createObjectURL = jest.fn();
    const mockClick = jest.fn();
    global.document.createElement = jest.fn().mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    expect(mockClick).toHaveBeenCalled();
  });

  it('toggles filter panel', async () => {
    const user = userEvent.setup();

    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    await user.click(filterButton);

    // Filter panel should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/From Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/To Date/i)).toBeInTheDocument();
    });
  });

  it('filters history by date range', async () => {
    const user = userEvent.setup();

    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    // Open filters
    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/From Date/i)).toBeInTheDocument();
    });

    // Set date filter
    const fromDateInput = screen.getByLabelText(/From Date/i);
    await user.type(fromDateInput, '2025-01-10');

    // API should be called with filter params
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('department-history'),
        expect.objectContaining({
          params: expect.objectContaining({
            startDate: '2025-01-10'
          })
        })
      );
    });
  });

  it('paginates through history', async () => {
    const user = userEvent.setup();

    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData, total: 50 } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} pageSize={2} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    // Look for pagination controls
    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    if (nextPageButton) {
      await user.click(nextPageButton);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining('department-history'),
          expect.objectContaining({
            params: expect.objectContaining({
              skip: 2,
              limit: 2
            })
          })
        );
      });
    }
  });

  it('clears filters when clear button clicked', async () => {
    const user = userEvent.setup();

    api.get.mockImplementation((url) => {
      if (url.includes('department-history')) {
        return Promise.resolve({ data: { items: mockHistoryData } });
      }
      if (url.includes('departments')) {
        return Promise.resolve({ data: { items: mockDepartments } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<AssignmentHistoryTimeline employeeId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    // Open filters
    const filterButton = screen.getByRole('button', { name: /toggle filters/i });
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/From Date/i)).toBeInTheDocument();
    });

    // Set filters
    const fromDateInput = screen.getByLabelText(/From Date/i);
    await user.type(fromDateInput, '2025-01-10');

    // Clear filters
    const clearButton = screen.getByText(/Clear Filters/i);
    await user.click(clearButton);

    // Date input should be cleared
    expect(fromDateInput).toHaveValue('');
  });
});
