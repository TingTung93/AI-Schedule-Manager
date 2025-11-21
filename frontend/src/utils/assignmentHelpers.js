/**
 * Helper utilities for working with schedule assignments
 *
 * Backend structure:
 * - Schedule contains assignments[]
 * - Each assignment links employee_id + shift_id
 * - Assignments have status, priority, notes, etc.
 */

/**
 * Extract shifts from schedule with assignment details
 * Transforms assignments into shift-like objects for calendar display
 *
 * @param {Object} schedule - Schedule object with assignments
 * @returns {Array} Array of shift objects for display
 */
export function extractShiftsFromSchedule(schedule) {
  if (!schedule || !schedule.assignments || !Array.isArray(schedule.assignments)) {
    return [];
  }

  return schedule.assignments
    .filter(assignment => assignment.status === 'assigned' || assignment.status === 'confirmed')
    .map(assignment => ({
      id: assignment.id,
      assignmentId: assignment.id,
      scheduleId: assignment.scheduleId || assignment.schedule_id,
      employeeId: assignment.employeeId || assignment.employee_id,
      shiftId: assignment.shiftId || assignment.shift_id,

      // Shift details (from nested shift object or flattened)
      startTime: assignment.shift?.startTime || assignment.shift?.start_time || assignment.startTime || assignment.start_time,
      endTime: assignment.shift?.endTime || assignment.shift?.end_time || assignment.endTime || assignment.end_time,
      date: assignment.shift?.date || assignment.date,
      shiftType: assignment.shift?.shiftType || assignment.shift?.shift_type || assignment.shiftType || assignment.shift_type,

      // Assignment details
      status: assignment.status,
      priority: assignment.priority,
      notes: assignment.notes,
      autoAssigned: assignment.autoAssigned || assignment.auto_assigned,
      isConfirmed: assignment.isConfirmed || assignment.is_confirmed || assignment.status === 'confirmed',
      needsConfirmation: assignment.needsConfirmation || assignment.needs_confirmation,

      // Employee details (if included)
      employee: assignment.employee,
      employeeName: assignment.employee ?
        `${assignment.employee.firstName || assignment.employee.first_name} ${assignment.employee.lastName || assignment.employee.last_name}` :
        null,

      // Metadata
      assignedBy: assignment.assignedBy || assignment.assigned_by,
      assignedAt: assignment.assignedAt || assignment.assigned_at,
      conflictsResolved: assignment.conflictsResolved || assignment.conflicts_resolved,
    }));
}

/**
 * Group shifts by date for calendar display
 *
 * @param {Array} shifts - Array of shift objects
 * @returns {Object} Object with dates as keys and shift arrays as values
 */
export function groupShiftsByDate(shifts) {
  if (!shifts || !Array.isArray(shifts)) {
    return {};
  }

  return shifts.reduce((acc, shift) => {
    const date = shift.date || (shift.startTime ? shift.startTime.split('T')[0] : null);
    if (!date) return acc;

    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(shift);
    return acc;
  }, {});
}

/**
 * Group shifts by employee for roster views
 *
 * @param {Array} shifts - Array of shift objects
 * @returns {Object} Object with employee IDs as keys and shift arrays as values
 */
export function groupShiftsByEmployee(shifts) {
  if (!shifts || !Array.isArray(shifts)) {
    return {};
  }

  return shifts.reduce((acc, shift) => {
    const employeeId = shift.employeeId;
    if (!employeeId) return acc;

    if (!acc[employeeId]) {
      acc[employeeId] = [];
    }
    acc[employeeId].push(shift);
    return acc;
  }, {});
}

/**
 * Filter shifts by date range
 *
 * @param {Array} shifts - Array of shift objects
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {Array} Filtered shifts
 */
export function filterShiftsByDateRange(shifts, startDate, endDate) {
  if (!shifts || !Array.isArray(shifts)) {
    return [];
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return shifts.filter(shift => {
    const shiftDate = new Date(shift.date || shift.startTime);
    return shiftDate >= start && shiftDate <= end;
  });
}

/**
 * Filter shifts by status
 *
 * @param {Array} shifts - Array of shift objects
 * @param {Array|string} statuses - Status or array of statuses to filter
 * @returns {Array} Filtered shifts
 */
export function filterShiftsByStatus(shifts, statuses) {
  if (!shifts || !Array.isArray(shifts)) {
    return [];
  }

  const statusArray = Array.isArray(statuses) ? statuses : [statuses];

  return shifts.filter(shift => statusArray.includes(shift.status));
}

/**
 * Check if shift has conflicts
 *
 * @param {Object} shift - Shift object
 * @param {Array} allShifts - All shifts to check against
 * @returns {Array} Array of conflicting shifts
 */
export function detectShiftConflicts(shift, allShifts) {
  if (!shift || !allShifts || !Array.isArray(allShifts)) {
    return [];
  }

  const shiftStart = new Date(shift.startTime);
  const shiftEnd = new Date(shift.endTime);

  return allShifts.filter(otherShift => {
    // Don't compare with self
    if (otherShift.id === shift.id) return false;

    // Only check same employee
    if (otherShift.employeeId !== shift.employeeId) return false;

    // Check for time overlap
    const otherStart = new Date(otherShift.startTime);
    const otherEnd = new Date(otherShift.endTime);

    return shiftStart < otherEnd && shiftEnd > otherStart;
  });
}

/**
 * Calculate total hours for shifts
 *
 * @param {Array} shifts - Array of shift objects
 * @returns {number} Total hours
 */
export function calculateTotalHours(shifts) {
  if (!shifts || !Array.isArray(shifts)) {
    return 0;
  }

  return shifts.reduce((total, shift) => {
    if (!shift.startTime || !shift.endTime) return total;

    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const hours = (end - start) / (1000 * 60 * 60);

    return total + hours;
  }, 0);
}

/**
 * Transform schedule for calendar events (FullCalendar format)
 *
 * @param {Object} schedule - Schedule object
 * @param {Object} employeeMap - Map of employee IDs to employee objects
 * @returns {Array} Array of calendar events
 */
export function transformScheduleToCalendarEvents(schedule, employeeMap = {}) {
  const shifts = extractShiftsFromSchedule(schedule);

  return shifts.map(shift => {
    const employee = employeeMap[shift.employeeId] || shift.employee;
    const employeeName = employee ?
      `${employee.firstName || employee.first_name || ''} ${employee.lastName || employee.last_name || ''}`.trim() :
      'Unknown Employee';

    return {
      id: shift.id,
      title: `${employeeName} - ${shift.shiftType || 'Shift'}`,
      start: shift.startTime,
      end: shift.endTime,
      backgroundColor: getShiftColor(shift, employee),
      borderColor: shift.isConfirmed ? '#4caf50' : '#ff9800',
      extendedProps: {
        employeeId: shift.employeeId,
        employeeName: employeeName,
        shiftId: shift.shiftId,
        assignmentId: shift.assignmentId,
        status: shift.status,
        priority: shift.priority,
        shiftType: shift.shiftType,
        department: employee?.department || '',
        notes: shift.notes,
        isConfirmed: shift.isConfirmed,
        needsConfirmation: shift.needsConfirmation,
        autoAssigned: shift.autoAssigned,
      }
    };
  });
}

/**
 * Get color for shift based on status and employee role
 *
 * @param {Object} shift - Shift object
 * @param {Object} employee - Employee object
 * @returns {string} Hex color code
 */
function getShiftColor(shift, employee) {
  // Color by status first
  if (shift.status === 'confirmed') return '#2e7d32';
  if (shift.status === 'pending') return '#ed6c02';
  if (shift.status === 'declined') return '#d32f2f';
  if (shift.status === 'cancelled') return '#757575';

  // Color by employee role if available
  if (employee && employee.role) {
    const roleColors = {
      manager: '#1976d2',
      supervisor: '#7b1fa2',
      cashier: '#388e3c',
      cook: '#f57c00',
      server: '#00796b',
      cleaner: '#5d4037',
    };
    return roleColors[employee.role.toLowerCase()] || '#1976d2';
  }

  // Default color
  return '#1976d2';
}

/**
 * Format assignment for API submission
 *
 * @param {Object} formData - Form data with assignment details
 * @returns {Object} Formatted assignment data for API
 */
export function formatAssignmentForAPI(formData) {
  return {
    employee_id: parseInt(formData.employeeId),
    shift_id: parseInt(formData.shiftId),
    status: formData.status || 'assigned',
    priority: parseInt(formData.priority) || 1,
    notes: formData.notes || null,
  };
}

/**
 * Check if assignment needs attention (conflicts, pending confirmation, etc.)
 *
 * @param {Object} assignment - Assignment object
 * @returns {Object} Object with needsAttention flag and reasons
 */
export function checkAssignmentAttention(assignment) {
  const reasons = [];
  let needsAttention = false;

  if (assignment.needsConfirmation) {
    needsAttention = true;
    reasons.push('Needs employee confirmation');
  }

  if (!assignment.conflictsResolved) {
    needsAttention = true;
    reasons.push('Has unresolved conflicts');
  }

  if (assignment.status === 'pending') {
    needsAttention = true;
    reasons.push('Assignment pending');
  }

  if (assignment.status === 'declined') {
    needsAttention = true;
    reasons.push('Assignment declined by employee');
  }

  return {
    needsAttention,
    reasons,
    severity: assignment.status === 'declined' ? 'error' :
              !assignment.conflictsResolved ? 'warning' :
              'info'
  };
}

export default {
  extractShiftsFromSchedule,
  groupShiftsByDate,
  groupShiftsByEmployee,
  filterShiftsByDateRange,
  filterShiftsByStatus,
  detectShiftConflicts,
  calculateTotalHours,
  transformScheduleToCalendarEvents,
  formatAssignmentForAPI,
  checkAssignmentAttention,
};
