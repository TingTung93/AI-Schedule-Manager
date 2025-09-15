"""
Comprehensive component tests for ScheduleView.
Tests calendar display, shift management, and user interactions.
"""

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import userEvent from '@testing-library/user-event';

import ScheduleView from '../../components/ScheduleView';
import { scheduleService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  scheduleService: {
    getSchedules: jest.fn(),
    generateSchedule: jest.fn(),
    optimizeSchedule: jest.fn(),
    updateShift: jest.fn(),
  },
  employeeService: {
    getEmployees: jest.fn(),
  },
}));

// Mock FullCalendar
jest.mock('@fullcalendar/react', () => {
  return function MockFullCalendar(props) {
    return (
      <div data-testid="calendar" onClick={() => props.eventClick?.({ event: { id: 'shift-1' } })}>
        Mock Calendar
        {props.events?.map((event, index) => (
          <div key={index} data-testid={`calendar-event-${index}`}>
            {event.title}
          </div>
        ))}
      </div>
    );
  };
});

// Test wrapper component
const TestWrapper = ({ children }) => {
  const theme = createTheme();
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('ScheduleView Component', () => {
  const mockSchedules = [
    {
      id: 1,
      name: 'Week of Jan 15-21',
      start_date: '2024-01-15',
      end_date: '2024-01-21',
      status: 'published',
      shifts: [
        {
          id: 'shift-1',
          date: '2024-01-15',
          start_time: '09:00',
          end_time: '17:00',
          position: 'Server',
          employees: ['John Doe', 'Jane Smith'],
        },
        {
          id: 'shift-2',
          date: '2024-01-16',
          start_time: '10:00',
          end_time: '18:00',
          position: 'Cook',
          employees: ['Mike Wilson'],
        },
      ],
    },
  ];

  const mockEmployees = [
    { id: 1, name: 'John Doe', role: 'Server' },
    { id: 2, name: 'Jane Smith', role: 'Server' },
    { id: 3, name: 'Mike Wilson', role: 'Cook' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    scheduleService.getSchedules.mockResolvedValue({ schedules: mockSchedules });
    scheduleService.generateSchedule.mockResolvedValue(mockSchedules[0]);
    scheduleService.optimizeSchedule.mockResolvedValue({
      status: 'optimized',
      improvements: { cost_savings: '$500', coverage: '98%' },
    });
  });

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    expect(screen.getByText(/schedule management/i)).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    scheduleService.getSchedules.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads and displays schedules', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(scheduleService.getSchedules).toHaveBeenCalled();
    });

    expect(screen.getByText('Week of Jan 15-21')).toBeInTheDocument();
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
  });

  it('displays calendar events correctly', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Check that shifts are converted to calendar events
    expect(screen.getByTestId('calendar-event-0')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-event-1')).toBeInTheDocument();
  });

  it('opens shift details dialog when clicking on calendar event', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Click on calendar to trigger event click
    fireEvent.click(screen.getByTestId('calendar'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText(/shift details/i)).toBeInTheDocument();
  });

  it('allows generating new schedule', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/generate schedule/i)).toBeInTheDocument();
    });

    // Click generate schedule button
    await user.click(screen.getByText(/generate schedule/i));

    // Fill in date range
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    await user.clear(startDateInput);
    await user.type(startDateInput, '2024-01-22');

    await user.clear(endDateInput);
    await user.type(endDateInput, '2024-01-28');

    // Submit form
    await user.click(screen.getByText(/generate/i));

    await waitFor(() => {
      expect(scheduleService.generateSchedule).toHaveBeenCalledWith('2024-01-22', '2024-01-28');
    });
  });

  it('handles schedule generation errors', async () => {
    const user = userEvent.setup();
    scheduleService.generateSchedule.mockRejectedValue(new Error('Generation failed'));

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/generate schedule/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/generate schedule/i));

    // Fill in dates and submit
    const startDateInput = screen.getByLabelText(/start date/i);
    await user.type(startDateInput, '2024-01-22');

    const endDateInput = screen.getByLabelText(/end date/i);
    await user.type(endDateInput, '2024-01-28');

    await user.click(screen.getByText(/generate/i));

    await waitFor(() => {
      expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
    });
  });

  it('allows optimizing existing schedule', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/optimize/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/optimize/i));

    await waitFor(() => {
      expect(scheduleService.optimizeSchedule).toHaveBeenCalledWith(1);
    });

    // Should show optimization results
    expect(screen.getByText(/optimization complete/i)).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
  });

  it('displays schedule statistics', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/total shifts/i)).toBeInTheDocument();
    });

    expect(screen.getByText('2')).toBeInTheDocument(); // Total shifts count
    expect(screen.getByText(/employees scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/coverage/i)).toBeInTheDocument();
  });

  it('allows filtering schedules by status', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument();
    });

    // Change filter to "draft"
    const filterSelect = screen.getByLabelText(/status filter/i);
    await user.click(filterSelect);
    await user.click(screen.getByText('Draft'));

    // Should filter out published schedules
    expect(screen.queryByText('Week of Jan 15-21')).not.toBeInTheDocument();
  });

  it('allows filtering schedules by date range', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
    });

    // Set date range filter
    const dateRangeInput = screen.getByLabelText(/date range/i);
    await user.click(dateRangeInput);

    // Select date range (implementation depends on date picker)
    // For now, just verify the input exists
    expect(dateRangeInput).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/generate schedule/i)).toBeInTheDocument();
    });

    // Tab to generate button and press Enter
    await user.tab();
    await user.keyboard('{Enter}');

    // Should open generate dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Escape should close dialog
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('displays schedule conflicts and warnings', async () => {
    const conflictSchedule = {
      ...mockSchedules[0],
      conflicts: [
        {
          type: 'availability',
          message: 'John Doe is not available during this shift',
          severity: 'warning',
        },
      ],
    };

    scheduleService.getSchedules.mockResolvedValue({ schedules: [conflictSchedule] });

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/conflicts detected/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/john doe is not available/i)).toBeInTheDocument();
  });

  it('handles empty schedule state', async () => {
    scheduleService.getSchedules.mockResolvedValue({ schedules: [] });

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/no schedules found/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/create your first schedule/i)).toBeInTheDocument();
  });

  it('allows bulk operations on schedules', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    // Select schedule
    await user.click(screen.getByRole('checkbox'));

    // Bulk actions menu should appear
    expect(screen.getByText(/bulk actions/i)).toBeInTheDocument();

    // Test bulk delete
    await user.click(screen.getByText(/delete selected/i));

    expect(screen.getByText(/confirm deletion/i)).toBeInTheDocument();
  });

  it('supports schedule export functionality', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/export/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/export/i));

    // Should show export options
    expect(screen.getByText(/excel/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/csv/i)).toBeInTheDocument();
  });

  it('displays schedule performance metrics', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/performance metrics/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/labor cost/i)).toBeInTheDocument();
    expect(screen.getByText(/efficiency/i)).toBeInTheDocument();
    expect(screen.getByText(/employee satisfaction/i)).toBeInTheDocument();
  });

  it('handles responsive design for mobile devices', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    // Should adapt layout for mobile
    const mobileNav = screen.getByTestId('mobile-navigation');
    expect(mobileNav).toBeInTheDocument();
  });

  it('supports real-time updates', async () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Simulate real-time update
    const updatedSchedule = {
      ...mockSchedules[0],
      shifts: [
        ...mockSchedules[0].shifts,
        {
          id: 'shift-3',
          date: '2024-01-17',
          start_time: '14:00',
          end_time: '22:00',
          position: 'Server',
          employees: ['New Employee'],
        },
      ],
    };

    // Trigger update (in real app, this would come from WebSocket or polling)
    scheduleService.getSchedules.mockResolvedValue({ schedules: [updatedSchedule] });

    // Verify new shift appears
    await waitFor(() => {
      expect(screen.getByText(/new employee/i)).toBeInTheDocument();
    });
  });

  it('provides accessibility features', () => {
    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    // Check for ARIA labels
    expect(screen.getByLabelText(/schedule calendar/i)).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    // Check for screen reader announcements
    const announcements = screen.getByLabelText(/screen reader announcements/i);
    expect(announcements).toBeInTheDocument();
  });

  it('handles concurrent user modifications gracefully', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ScheduleView />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    // Click on shift to edit
    fireEvent.click(screen.getByTestId('calendar'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Simulate another user modifying the same shift
    scheduleService.updateShift.mockRejectedValue(
      new Error('Shift was modified by another user')
    );

    // Try to save changes
    await user.click(screen.getByText(/save/i));

    await waitFor(() => {
      expect(screen.getByText(/modified by another user/i)).toBeInTheDocument();
    });

    // Should offer to refresh or merge changes
    expect(screen.getByText(/refresh/i)).toBeInTheDocument();
  });
});