/**
 * Schedule Data Transformers
 *
 * Transforms backend Schedule + ScheduleAssignment data to frontend-compatible formats
 * Backend structure:
 * - Schedule: { id, name, start_date, end_date, status, assignments[] }
 * - ScheduleAssignment: { id, employee_id, shift_date, start_time, end_time, position, status }
 */

import { format, parseISO, isWithinInterval } from 'date-fns';

/**
 * Transform backend schedules to FullCalendar events
 * @param {Array} schedules - Array of Schedule objects with assignments
 * @returns {Array} Array of FullCalendar event objects
 */
export const transformScheduleToCalendarEvents = (schedules) => {
  if (!schedules || !Array.isArray(schedules)) {
    return [];
  }

  const events = [];

  schedules.forEach(schedule => {
    if (schedule.assignments && Array.isArray(schedule.assignments)) {
      schedule.assignments.forEach(assignment => {
        const event = transformAssignmentToEvent(assignment, schedule);
        if (event) {
          events.push(event);
        }
      });
    }
  });

  return events;
};

/**
 * Transform a single assignment to a FullCalendar event
 * @param {Object} assignment - ScheduleAssignment object
 * @param {Object} schedule - Parent Schedule object
 * @returns {Object} FullCalendar event object
 */
export const transformAssignmentToEvent = (assignment, schedule) => {
  if (!assignment || !assignment.shift_date) {
    return null;
  }

  const { start_time, end_time } = assignment;
  const shiftDate = assignment.shift_date;

  // Combine date with times to create full datetime strings
  const startDateTime = `${shiftDate}T${start_time || '00:00:00'}`;
  const endDateTime = `${shiftDate}T${end_time || '23:59:59'}`;

  return {
    id: `assignment-${assignment.id}`,
    title: assignment.position || 'Shift',
    start: startDateTime,
    end: endDateTime,
    extendedProps: {
      assignmentId: assignment.id,
      scheduleId: schedule?.id,
      scheduleName: schedule?.name,
      employeeId: assignment.employee_id,
      employeeName: assignment.employee_name,
      position: assignment.position,
      status: assignment.status || 'pending',
      notes: assignment.notes,
      shiftDate: shiftDate,
      startTime: start_time,
      endTime: end_time,
    },
    backgroundColor: getStatusColor(assignment.status),
    borderColor: getStatusBorderColor(assignment.status),
    textColor: '#ffffff',
  };
};

/**
 * Group assignments by shift date
 * @param {Array} assignments - Array of ScheduleAssignment objects
 * @returns {Object} Object with dates as keys and arrays of assignments as values
 */
export const groupAssignmentsByDate = (assignments) => {
  if (!assignments || !Array.isArray(assignments)) {
    return {};
  }

  return assignments.reduce((grouped, assignment) => {
    const date = assignment.shift_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(assignment);
    return grouped;
  }, {});
};

/**
 * Group assignments by employee
 * @param {Array} assignments - Array of ScheduleAssignment objects
 * @returns {Object} Object with employee IDs as keys and arrays of assignments as values
 */
export const groupAssignmentsByEmployee = (assignments) => {
  if (!assignments || !Array.isArray(assignments)) {
    return {};
  }

  return assignments.reduce((grouped, assignment) => {
    const employeeId = assignment.employee_id;
    if (!grouped[employeeId]) {
      grouped[employeeId] = [];
    }
    grouped[employeeId].push(assignment);
    return grouped;
  }, {});
};

/**
 * Transform schedule for export (Excel/PDF)
 * @param {Object} schedule - Schedule object with assignments
 * @returns {Array} Array of formatted rows for export
 */
export const transformScheduleForExport = (schedule) => {
  if (!schedule || !schedule.assignments) {
    return [];
  }

  return schedule.assignments.map(assignment => ({
    Date: assignment.shift_date,
    Employee: assignment.employee_name || `Employee ${assignment.employee_id}`,
    Position: assignment.position || '',
    'Start Time': assignment.start_time || '',
    'End Time': assignment.end_time || '',
    Status: assignment.status || 'pending',
    Notes: assignment.notes || '',
  }));
};

/**
 * Filter assignments by date range
 * @param {Array} assignments - Array of ScheduleAssignment objects
 * @param {Date} startDate - Start date of range
 * @param {Date} endDate - End date of range
 * @returns {Array} Filtered assignments
 */
export const filterAssignmentsByDateRange = (assignments, startDate, endDate) => {
  if (!assignments || !Array.isArray(assignments)) {
    return [];
  }

  return assignments.filter(assignment => {
    try {
      const shiftDate = parseISO(assignment.shift_date);
      return isWithinInterval(shiftDate, { start: startDate, end: endDate });
    } catch (error) {
      console.error('Error parsing date:', error);
      return false;
    }
  });
};

/**
 * Calculate schedule statistics
 * @param {Object} schedule - Schedule object with assignments
 * @returns {Object} Statistics object
 */
export const calculateScheduleStats = (schedule) => {
  if (!schedule || !schedule.assignments) {
    return {
      totalShifts: 0,
      totalEmployees: 0,
      statusBreakdown: {},
      positionBreakdown: {},
    };
  }

  const assignments = schedule.assignments;
  const uniqueEmployees = new Set(assignments.map(a => a.employee_id));

  const statusBreakdown = assignments.reduce((acc, assignment) => {
    const status = assignment.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const positionBreakdown = assignments.reduce((acc, assignment) => {
    const position = assignment.position || 'unassigned';
    acc[position] = (acc[position] || 0) + 1;
    return acc;
  }, {});

  return {
    totalShifts: assignments.length,
    totalEmployees: uniqueEmployees.size,
    statusBreakdown,
    positionBreakdown,
    dateRange: {
      start: schedule.start_date,
      end: schedule.end_date,
    },
  };
};

/**
 * Get color for assignment status
 * @param {string} status - Assignment status
 * @returns {string} Color hex code
 */
const getStatusColor = (status) => {
  const colorMap = {
    confirmed: '#10b981', // green
    pending: '#f59e0b',   // amber
    cancelled: '#ef4444', // red
    completed: '#3b82f6', // blue
  };
  return colorMap[status] || colorMap.pending;
};

/**
 * Get border color for assignment status
 * @param {string} status - Assignment status
 * @returns {string} Color hex code
 */
const getStatusBorderColor = (status) => {
  const colorMap = {
    confirmed: '#059669',
    pending: '#d97706',
    cancelled: '#dc2626',
    completed: '#2563eb',
  };
  return colorMap[status] || colorMap.pending;
};

/**
 * Validate schedule data structure
 * @param {Object} schedule - Schedule object to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateScheduleData = (schedule) => {
  const errors = [];

  if (!schedule) {
    return { isValid: false, errors: ['Schedule object is required'] };
  }

  if (!schedule.name) {
    errors.push('Schedule name is required');
  }

  if (!schedule.start_date) {
    errors.push('Start date is required');
  }

  if (!schedule.end_date) {
    errors.push('End date is required');
  }

  if (schedule.start_date && schedule.end_date) {
    if (new Date(schedule.start_date) > new Date(schedule.end_date)) {
      errors.push('Start date must be before end date');
    }
  }

  if (schedule.assignments && Array.isArray(schedule.assignments)) {
    schedule.assignments.forEach((assignment, index) => {
      if (!assignment.employee_id) {
        errors.push(`Assignment ${index + 1}: Employee ID is required`);
      }
      if (!assignment.shift_date) {
        errors.push(`Assignment ${index + 1}: Shift date is required`);
      }
      if (!assignment.start_time) {
        errors.push(`Assignment ${index + 1}: Start time is required`);
      }
      if (!assignment.end_time) {
        errors.push(`Assignment ${index + 1}: End time is required`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Merge multiple schedules into a single view
 * @param {Array} schedules - Array of Schedule objects
 * @returns {Array} Combined array of all assignments
 */
export const mergeSchedules = (schedules) => {
  if (!schedules || !Array.isArray(schedules)) {
    return [];
  }

  const allAssignments = [];

  schedules.forEach(schedule => {
    if (schedule.assignments && Array.isArray(schedule.assignments)) {
      const assignmentsWithScheduleInfo = schedule.assignments.map(assignment => ({
        ...assignment,
        scheduleName: schedule.name,
        scheduleId: schedule.id,
        scheduleStatus: schedule.status,
      }));
      allAssignments.push(...assignmentsWithScheduleInfo);
    }
  });

  return allAssignments;
};
