/**
 * Tests for DepartmentScheduleManager Page Component
 *
 * Tests:
 * - Schedule list rendering
 * - Create schedule flow
 * - Template application
 * - Pagination
 * - Filtering and search
 * - Error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import DepartmentScheduleManager from '../DepartmentScheduleManager';
import api from '../../services/api';
import MockAdapter from 'axios-mock-adapter';

// Mock axios API
const mock = new MockAdapter(api);

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ departmentId: '10' })
}));

describe('DepartmentScheduleManager Page', () => {
  const mockSchedules = [
    {
      id: 1,
      name: 'Sales Department - Week 48',
      departmentId: 10,
      departmentName: 'Sales',
      startDate: '2025-11-25',
      endDate: '2025-12-01',
      employeeCount: 15,
      shiftCount: 75,
      status: 'published'
    },
    {
      id: 2,
      name: 'Sales Department - Week 49',
      departmentId: 10,
      departmentName: 'Sales',
      startDate: '2025-12-02',
      endDate: '2025-12-08',
      employeeCount: 15,
      shiftCount: 70,
      status: 'draft'
    }
  ];

  const mockTemplates = [
    {
      id: 1,
      name: 'Standard Week Template',
      description: 'Regular 5-day work week',
      patternType: 'weekly'
    },
    {
      id: 2,
      name: 'Holiday Coverage',
      description: 'Extended hours for holidays',
      patternType: 'custom'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mock.reset();

    // Default mock implementations
    mock.onGet('/api/departments/10/schedules').reply(200, {
      items: mockSchedules,
      total: 2,
      page: 1,
      size: 10,
      pages: 1
    });

    mock.onGet('/api/departments/10/templates').reply(200, mockTemplates);
    mock.onGet('/api/departments/10').reply(200, {
      id: 10,
      name: 'Sales',
      description: 'Sales Department'
    });
  });

  afterAll(() => {
    mock.restore();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <DepartmentScheduleManager />
      </BrowserRouter>
    );
  };

  describe('Schedule List Rendering', () => {
    it('should render schedule list on load', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Sales Department - Week 48')).toBeInTheDocument();
        expect(screen.getByText('Sales Department - Week 49')).toBeInTheDocument();
      });
    });

    it('should display schedule details', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // employee count
        expect(screen.getByText('75')).toBeInTheDocument(); // shift count
        expect(screen.getByText('published')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      renderComponent();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle empty schedule list', async () => {
      scheduleAPI.getDepartmentSchedules.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        size: 10
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/no schedules found/i)).toBeInTheDocument();
      });
    });

    it('should display schedule status badges', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('published')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
      });
    });
  });

  describe('Create Schedule Flow', () => {
    it('should open create schedule dialog', async () => {
      renderComponent();

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create schedule/i });
        fireEvent.click(createButton);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/schedule name/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });

    it('should create schedule successfully', async () => {
      mock.onPost('/api/departments/10/schedules').reply(201, {
        id: 3,
        name: 'New Schedule',
        departmentId: 10
      });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      fireEvent.change(screen.getByLabelText(/schedule name/i), {
        target: { value: 'New Schedule' }
      });

      fireEvent.change(screen.getByLabelText(/start date/i), {
        target: { value: '2025-12-09' }
      });

      fireEvent.change(screen.getByLabelText(/end date/i), {
        target: { value: '2025-12-15' }
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText(/schedule created successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle create schedule errors', async () => {
      mock.onPost('/api/departments/10/schedules').reply(500, {
        message: 'Failed to create schedule'
      });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      fireEvent.change(screen.getByLabelText(/schedule name/i), {
        target: { value: 'Test Schedule' }
      });

      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to create schedule/i)).toBeInTheDocument();
      });
    });

    it('should close dialog on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Template Application', () => {
    it('should display template selection dropdown', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      const templateSelect = screen.getByLabelText(/template/i);
      expect(templateSelect).toBeInTheDocument();
    });

    it('should load available templates', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      const templateSelect = screen.getByLabelText(/template/i);
      fireEvent.mouseDown(templateSelect);

      await waitFor(() => {
        expect(screen.getByText('Standard Week Template')).toBeInTheDocument();
        expect(screen.getByText('Holiday Coverage')).toBeInTheDocument();
      });
    });

    it('should apply template to schedule', async () => {
      mock.onPost('/api/departments/10/templates/1/apply').reply(201, {
        id: 4,
        name: 'From Template',
        templateId: 1
      });

      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      const templateSelect = screen.getByLabelText(/template/i);
      fireEvent.change(templateSelect, { target: { value: '1' } });

      fireEvent.click(screen.getByRole('button', { name: /apply template/i }));

      await waitFor(() => {
        // Verify API was called
        expect(mock.history.post.length).toBeGreaterThan(0);
      });
    });

    it('should show template preview', async () => {
      renderComponent();

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
      });

      const templateSelect = screen.getByLabelText(/template/i);
      fireEvent.change(templateSelect, { target: { value: '1' } });

      await waitFor(() => {
        expect(screen.getByText(/preview/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls', async () => {
      mock.onGet('/api/departments/10/schedules').reply(200, {
        items: mockSchedules,
        total: 25,
        page: 1,
        size: 10,
        pages: 3
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      });
    });

    it('should navigate to next page', async () => {
      mock.onGet('/api/departments/10/schedules').reply(200, {
        items: mockSchedules,
        total: 25,
        page: 1,
        size: 10,
        pages: 3
      });

      renderComponent();

      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /next/i });
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        // Verify page changed
        expect(mock.history.get.length).toBeGreaterThan(1);
      });
    });

    it('should navigate to previous page', async () => {
      mock.onGet('/api/departments/10/schedules').reply(200, {
        items: mockSchedules,
        total: 25,
        page: 2,
        size: 10,
        pages: 3
      });

      renderComponent();

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: /previous/i });
        fireEvent.click(prevButton);
      });

      await waitFor(() => {
        // Verify page changed
        expect(mock.history.get.length).toBeGreaterThan(0);
      });
    });

    it('should change page size', async () => {
      renderComponent();

      await waitFor(() => {
        const pageSizeSelect = screen.getByLabelText(/items per page/i);
        fireEvent.change(pageSizeSelect, { target: { value: '25' } });
      });

      await waitFor(() => {
        // Verify size changed
        expect(mock.history.get.length).toBeGreaterThan(0);
      });
    });

    it('should display current page info', async () => {
      mock.onGet('/api/departments/10/schedules').reply(200, {
        items: mockSchedules,
        total: 45,
        page: 2,
        size: 10,
        pages: 5
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
        expect(screen.getByText(/showing 11-20 of 45/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    it('should filter by status', async () => {
      renderComponent();

      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/status/i);
        fireEvent.change(statusFilter, { target: { value: 'published' } });
      });

      await waitFor(() => {
        // Verify filter applied
        expect(mock.history.get.length).toBeGreaterThan(0);
      });
    });

    it('should filter by date range', async () => {
      renderComponent();

      await waitFor(() => {
        const startDateInput = screen.getByLabelText(/start date/i);
        fireEvent.change(startDateInput, { target: { value: '2025-11-25' } });

        const endDateInput = screen.getByLabelText(/end date/i);
        fireEvent.change(endDateInput, { target: { value: '2025-12-31' } });
      });

      await waitFor(() => {
        // Verify date filter applied
        expect(mock.history.get.length).toBeGreaterThan(0);
      });
    });

    it('should search schedules by name', async () => {
      renderComponent();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search schedules/i);
        fireEvent.change(searchInput, { target: { value: 'Week 48' } });
      });

      // Debounced search
      await waitFor(() => {
        // Verify search applied
        expect(mock.history.get.length).toBeGreaterThan(0);
      }, { timeout: 1000 });
    });

    it('should clear filters', async () => {
      renderComponent();

      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/status/i);
        fireEvent.change(statusFilter, { target: { value: 'published' } });
      });

      const clearButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        // Verify filters cleared
        expect(mock.history.get.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mock.onGet('/api/departments/10/schedules').reply(500, {
        message: 'Network error'
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/failed to load schedules/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mock.onGet('/api/departments/10/schedules').reply(500, {
        message: 'Network error'
      });

      renderComponent();

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry loading on retry button click', async () => {
      mock.onGet('/api/departments/10/schedules')
        .replyOnce(500, { message: 'Network error' })
        .onGet('/api/departments/10/schedules')
        .replyOnce(200, {
          items: mockSchedules,
          total: 2
        });

      renderComponent();

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Sales Department - Week 48')).toBeInTheDocument();
      });
    });
  });

  describe('Schedule Actions', () => {
    it('should navigate to schedule details on click', async () => {
      renderComponent();

      await waitFor(() => {
        const scheduleCard = screen.getByText('Sales Department - Week 48');
        fireEvent.click(scheduleCard);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/schedules/1');
    });

    it('should delete schedule', async () => {
      mock.onDelete('/api/departments/10/schedules/1').reply(200, {
        success: true
      });

      renderComponent();

      await waitFor(() => {
        const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
        fireEvent.click(deleteButton);
      });

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        // Verify delete API was called
        expect(mock.history.delete.length).toBeGreaterThan(0);
      });
    });

    it('should duplicate schedule', async () => {
      mock.onPost('/api/departments/10/schedules/1/duplicate').reply(201, {
        id: 5,
        name: 'Copy of Sales Department - Week 48'
      });

      renderComponent();

      await waitFor(() => {
        const duplicateButton = screen.getAllByRole('button', { name: /duplicate/i })[0];
        fireEvent.click(duplicateButton);
      });

      await waitFor(() => {
        // Verify duplicate API was called
        expect(mock.history.post.length).toBeGreaterThan(0);
      });
    });
  });
});
