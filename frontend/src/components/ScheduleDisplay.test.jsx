import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import ScheduleDisplay from './ScheduleDisplay';
import { scheduleService } from '../services/api';
import api from '../services/api';

// Create mock functions
const mockGetSchedules = jest.fn();
const mockUpdateShift = jest.fn();
const mockGenerateSchedule = jest.fn();

// Mock axios for employee API calls
jest.mock('../services/api', () => ({
  ...jest.requireActual('../services/api'),
  scheduleService: {
    getSchedules: jest.fn(),
    updateShift: jest.fn(),
    generateSchedule: jest.fn(),
  },
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock date-fns functions
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  startOfWeek: jest.fn(() => new Date('2024-01-15')), // Monday
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'yyyy-MM-dd') return '2024-01-15';
    if (formatStr === 'MMM d, yyyy') return 'Jan 15, 2024';
    if (formatStr === 'EEE') return 'Mon';
    if (formatStr === 'MMM d') return 'Jan 15';
    if (formatStr === 'h:mm a') return '9:00 AM';
    if (formatStr === 'h:mm') return '9:00';
    if (formatStr === "yyyy-MM-dd'T'HH:mm") return '2024-01-15T09:00';
    if (formatStr === 'EEEE, MMM d, yyyy') return 'Monday, Jan 15, 2024';
    if (formatStr === 'EEEE') return 'Monday';
    return date.toString();
  }),
  addDays: jest.fn((date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)),
  addWeeks: jest.fn((date, weeks) => new Date(date.getTime() + weeks * 7 * 24 * 60 * 60 * 1000)),
  subWeeks: jest.fn((date, weeks) => new Date(date.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)),
  parseISO: jest.fn((str) => new Date(str)),
  isSameDay: jest.fn(() => true),
  isWithinInterval: jest.fn(() => true),
  isToday: jest.fn(() => true),
  isFuture: jest.fn(() => false),
}));

// Mock Material-UI date picker
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange, renderInput }) => {
    const TextField = renderInput({
      value: value?.toISOString?.() || '',
      onChange: (e) => onChange(new Date(e.target.value)),
    });
    return (
      <div>
        <label>{label}</label>
        {TextField}
      </div>
    );
  },
}));

jest.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: function() { return {}; },
}));

// Mock useApi and useApiMutation hooks
jest.mock('../hooks/useApi', () => ({
  useApi: jest.fn((apiCall, deps, options) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      apiCall()
        .then((result) => {
          setData(result);
          setLoading(false);
          if (options?.onSuccess) options.onSuccess(result);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
          if (options?.onError) options.onError(err);
        });
    }, []);

    return {
      data,
      loading,
      error,
      refetch: jest.fn(),
    };
  }),
  useApiMutation: jest.fn((apiCall, options) => {
    const [loading, setLoading] = React.useState(false);

    const mutate = jest.fn(async (...args) => {
      setLoading(true);
      try {
        const result = await apiCall(...args);
        setLoading(false);
        if (options?.onSuccess) options.onSuccess(result);
        return result;
      } catch (error) {
        setLoading(false);
        if (options?.onError) options.onError(error);
        throw error;
      }
    });

    return {
      mutate,
      loading,
      data: null,
      error: null,
      reset: jest.fn(),
    };
  }),
}));

const mockSchedules = {
  schedules: [
    {
      id: '1',
      name: 'Week 1 Schedule',
      startDate: '2024-01-15T00:00:00.000Z',
      endDate: '2024-01-21T00:00:00.000Z',
      status: 'published',
      shifts: [
        {
          id: 'shift1',
          employeeId: 'emp1',
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T17:00:00.000Z',
          role: 'manager',
          notes: 'Opening shift',
        },
        {
          id: 'shift2',
          employeeId: 'emp2',
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: '2024-01-15T18:00:00.000Z',
          role: 'cashier',
          notes: '',
        },
      ],
    },
  ],
};

const mockEmployees = {
  employees: [
    {
      id: 'emp1',
      firstName: 'John',
      lastName: 'Doe',
      role: 'manager',
      availability: {
        monday: { available: true, start: '09:00', end: '17:00' },
        tuesday: { available: true, start: '09:00', end: '17:00' },
        wednesday: { available: true, start: '09:00', end: '17:00' },
        thursday: { available: true, start: '09:00', end: '17:00' },
        friday: { available: true, start: '09:00', end: '17:00' },
        saturday: { available: false, start: '09:00', end: '17:00' },
        sunday: { available: false, start: '09:00', end: '17:00' },
      },
    },
    {
      id: 'emp2',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'cashier',
      availability: {
        monday: { available: true, start: '10:00', end: '18:00' },
        tuesday: { available: true, start: '10:00', end: '18:00' },
        wednesday: { available: false, start: '10:00', end: '18:00' },
        thursday: { available: true, start: '10:00', end: '18:00' },
        friday: { available: true, start: '10:00', end: '18:00' },
        saturday: { available: true, start: '09:00', end: '17:00' },
        sunday: { available: false, start: '09:00', end: '17:00' },
      },
    },
  ],
};

describe('ScheduleDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduleService.getSchedules.mockResolvedValue(mockSchedules);
    scheduleService.updateShift.mockResolvedValue({});
    scheduleService.generateSchedule.mockResolvedValue({ id: '2', name: 'Generated Schedule', shifts: [] });
    api.get.mockResolvedValue({ data: mockEmployees });
  });

  it('renders the schedule display interface', async () => {
    render(<ScheduleDisplay />);

    expect(screen.getByText('Schedule Management')).toBeInTheDocument();
    expect(screen.getByLabelText('Select schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('Select view mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate new schedule')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument();
    });
  });

  it('displays week view by default', async () => {
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });
  });

  it('switches between week and day view', async () => {
    const user = userEvent.setup();
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument();
    });

    // Switch to day view
    const viewSelect = screen.getByLabelText('Select view mode');
    await user.click(viewSelect);
    await user.click(screen.getByText('Day'));

    expect(screen.getByText('Monday, Jan 15, 2024')).toBeInTheDocument();
  });

  it('displays shifts in the calendar grid', async () => {
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    // Check shift time display
    expect(screen.getByText('9:00 - 9:00')).toBeInTheDocument();
  });

  it('opens shift edit dialog when clicking on a shift', async () => {
    const user = userEvent.setup();
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Click on John's shift
    const johnShift = screen.getByLabelText('Shift for John Doe');
    await user.click(johnShift);

    expect(screen.getByText('Edit Shift')).toBeInTheDocument();
    expect(screen.getByLabelText('Select employee')).toBeInTheDocument();
    expect(screen.getByLabelText('Shift start time')).toBeInTheDocument();
    expect(screen.getByLabelText('Shift end time')).toBeInTheDocument();
  });

  it('allows editing shift details', async () => {
    const user = userEvent.setup();
    mockUpdateShift.mockResolvedValue({});

    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    // Click on John's shift
    const johnShift = screen.getByLabelText('Shift for John Doe');
    await user.click(johnShift);

    // Change role
    const roleInput = screen.getByLabelText('Shift role');
    await user.clear(roleInput);
    await user.type(roleInput, 'supervisor');

    // Add notes
    const notesInput = screen.getByLabelText('Shift notes');
    await user.type(notesInput, 'Updated notes');

    // Submit changes
    const updateButton = screen.getByRole('button', { name: 'Update Shift' });
    await user.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateShift).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: '1',
          shiftId: 'shift1',
          updates: expect.objectContaining({
            role: 'supervisor',
            notes: 'Updated notes',
          }),
        })
      );
    });
  });

  it('navigates between weeks', async () => {
    const user = userEvent.setup();
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument();
    });

    // Navigate to previous week
    const prevButton = screen.getByLabelText('Previous week');
    await user.click(prevButton);

    // Navigate to next week
    const nextButton = screen.getByLabelText('Next week');
    await user.click(nextButton);

    // Go to current week
    const todayButton = screen.getByLabelText('Go to current week');
    await user.click(todayButton);
  });

  it('generates new schedule', async () => {
    const user = userEvent.setup();
    mockGenerateSchedule.mockResolvedValue({
      id: '2',
      name: 'Generated Schedule',
      shifts: [],
    });

    render(<ScheduleDisplay />);

    const generateButton = screen.getByLabelText('Generate new schedule');
    await user.click(generateButton);

    await waitFor(() => {
      expect(mockGenerateSchedule).toHaveBeenCalledWith({
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      });
    });
  });

  it('detects and displays scheduling conflicts', async () => {
    // Create overlapping shifts for same employee
    const conflictSchedules = {
      schedules: [
        {
          id: '1',
          name: 'Conflict Schedule',
          startDate: '2024-01-15T00:00:00.000Z',
          endDate: '2024-01-21T00:00:00.000Z',
          shifts: [
            {
              id: 'shift1',
              employeeId: 'emp1',
              startTime: '2024-01-15T09:00:00.000Z',
              endTime: '2024-01-15T17:00:00.000Z',
              role: 'manager',
            },
            {
              id: 'shift2',
              employeeId: 'emp1', // Same employee
              startTime: '2024-01-15T16:00:00.000Z', // Overlaps with shift1
              endTime: '2024-01-15T20:00:00.000Z',
              role: 'supervisor',
            },
          ],
        },
      ],
    };

    mockGetSchedules.mockResolvedValue(conflictSchedules);

    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Scheduling Conflicts Detected (1)')).toBeInTheDocument();
      expect(screen.getByText(/Overlapping shifts for John/)).toBeInTheDocument();
    });
  });

  it('detects availability conflicts', async () => {
    // Create shift when employee is not available
    const unavailableSchedule = {
      schedules: [
        {
          id: '1',
          name: 'Unavailable Schedule',
          startDate: '2024-01-15T00:00:00.000Z',
          endDate: '2024-01-21T00:00:00.000Z',
          shifts: [
            {
              id: 'shift1',
              employeeId: 'emp1',
              startTime: '2024-01-20T09:00:00.000Z', // Saturday (not available)
              endTime: '2024-01-20T17:00:00.000Z',
              role: 'manager',
            },
          ],
        },
      ],
    };

    mockGetSchedules.mockResolvedValue(unavailableSchedule);

    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Scheduling Conflicts Detected (1)')).toBeInTheDocument();
    });
  });

  it('supports drag and drop for shifts', async () => {
    const user = userEvent.setup();
    mockUpdateShift.mockResolvedValue({});

    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const johnShift = screen.getByLabelText('Shift for John Doe');

    // Simulate drag start
    fireEvent.dragStart(johnShift, {
      dataTransfer: {
        effectAllowed: 'move',
      },
    });

    // Find a drop target (different time slot)
    const dropTarget = screen.getByLabelText('Monday 10:00');

    // Simulate drag over
    fireEvent.dragOver(dropTarget, {
      dataTransfer: {
        dropEffect: 'move',
      },
    });

    // Simulate drop
    fireEvent.drop(dropTarget);

    await waitFor(() => {
      expect(mockUpdateShift).toHaveBeenCalled();
    });
  });

  it('shows loading state while fetching data', () => {
    mockGetSchedules.mockImplementation(() => new Promise(() => {}));

    render(<ScheduleDisplay />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays day view with shift list', async () => {
    const user = userEvent.setup();
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Week of Jan 15, 2024')).toBeInTheDocument();
    });

    // Switch to day view
    const viewSelect = screen.getByLabelText('Select view mode');
    await user.click(viewSelect);
    await user.click(screen.getByText('Day'));

    // Should show shifts as a list
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('allows switching between different schedules', async () => {
    const user = userEvent.setup();
    const multipleSchedules = {
      schedules: [
        ...mockSchedules.schedules,
        {
          id: '2',
          name: 'Week 2 Schedule',
          startDate: '2024-01-22T00:00:00.000Z',
          endDate: '2024-01-28T00:00:00.000Z',
          shifts: [],
        },
      ],
    };

    mockGetSchedules.mockResolvedValue(multipleSchedules);

    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Week 1 Schedule')).toBeInTheDocument();
    });

    // Switch to different schedule
    const scheduleSelect = screen.getByLabelText('Select schedule');
    await user.click(scheduleSelect);
    await user.click(screen.getByText('Week 2 Schedule'));

    // Should update display
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    render(<ScheduleDisplay />);

    // Check for proper ARIA labels
    expect(screen.getByLabelText('Select schedule')).toBeInTheDocument();
    expect(screen.getByLabelText('Select view mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to current week')).toBeInTheDocument();
    expect(screen.getByLabelText('Generate new schedule')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Shift for John Doe')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation for shifts', async () => {
    const user = userEvent.setup();
    render(<ScheduleDisplay />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
    });

    const johnShift = screen.getByLabelText('Shift for John Doe');

    // Test Enter key
    await user.type(johnShift, '{enter}');
    expect(screen.getByText('Edit Shift')).toBeInTheDocument();

    // Close dialog
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    // Test Space key
    await user.type(johnShift, ' ');
    expect(screen.getByText('Edit Shift')).toBeInTheDocument();
  });
});