/**
 * Filter utility functions for client-side data filtering
 * Supports employees, shifts, and assignments filtering
 */

/**
 * Get date range for quick filters
 * @param {string} filterType - Type of filter (today, week, month)
 * @returns {Object} Object with start and end Date objects
 */
export const getQuickDateRange = (filterType) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (filterType) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      // Start of week (Monday)
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      // End of week (Sunday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return { start: null, end: null };
  }

  return { start, end };
};

/**
 * Check if a date is within a date range
 * @param {Date|string} date - Date to check
 * @param {Object} dateRange - Object with start and end dates
 * @returns {boolean} True if date is in range
 */
export const isDateInRange = (date, dateRange) => {
  if (!dateRange || !dateRange.start || !dateRange.end) return true;

  const checkDate = new Date(date);
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  return checkDate >= startDate && checkDate <= endDate;
};

/**
 * Filter employees by search term, departments, and roles
 * @param {Array} employees - Array of employee objects
 * @param {string} searchTerm - Search string
 * @param {Array} departments - Array of department names to filter by
 * @param {Array} roles - Array of role names to filter by
 * @returns {Array} Filtered employees
 */
export const filterEmployees = (employees, searchTerm = '', departments = [], roles = []) => {
  if (!employees || employees.length === 0) return [];

  return employees.filter(employee => {
    // Search filter - check name and email
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const firstName = (employee.firstName || employee.first_name || '').toLowerCase();
      const lastName = (employee.lastName || employee.last_name || '').toLowerCase();
      const email = (employee.email || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`;

      const matchesSearch =
        fullName.includes(term) ||
        firstName.includes(term) ||
        lastName.includes(term) ||
        email.includes(term);

      if (!matchesSearch) return false;
    }

    // Department filter
    if (departments.length > 0) {
      const empDept = employee.department || employee.departmentName || '';
      if (!departments.includes(empDept)) return false;
    }

    // Role filter
    if (roles.length > 0) {
      const empRole = employee.role || '';
      if (!roles.includes(empRole)) return false;
    }

    return true;
  });
};

/**
 * Filter shifts by shift types and date range
 * @param {Array} shifts - Array of shift objects
 * @param {Array} shiftTypes - Array of shift types to filter by
 * @param {Object} dateRange - Date range object with start and end
 * @returns {Array} Filtered shifts
 */
export const filterShifts = (shifts, shiftTypes = [], dateRange = null) => {
  if (!shifts || shifts.length === 0) return [];

  return shifts.filter(shift => {
    // Shift type filter
    if (shiftTypes.length > 0) {
      const shiftType = shift.shiftType || shift.shift_type || '';
      if (!shiftTypes.includes(shiftType)) return false;
    }

    // Date range filter
    if (dateRange && dateRange.start && dateRange.end) {
      const shiftDate = shift.date || shift.startTime || shift.start_time;
      if (!isDateInRange(shiftDate, dateRange)) return false;
    }

    return true;
  });
};

/**
 * Filter assignments by employee IDs and shift IDs
 * @param {Array} assignments - Array of assignment objects
 * @param {Array} employeeIds - Array of employee IDs to filter by
 * @param {Array} shiftIds - Array of shift IDs to filter by
 * @returns {Array} Filtered assignments
 */
export const filterAssignments = (assignments, employeeIds = [], shiftIds = []) => {
  if (!assignments || assignments.length === 0) return [];

  return assignments.filter(assignment => {
    // Employee filter
    if (employeeIds.length > 0) {
      const empId = assignment.employeeId || assignment.employee_id;
      if (!employeeIds.includes(empId)) return false;
    }

    // Shift filter
    if (shiftIds.length > 0) {
      const shiftId = assignment.shiftId || assignment.shift_id;
      if (!shiftIds.includes(shiftId)) return false;
    }

    return true;
  });
};

/**
 * Filter calendar events by departments, shift types, and date range
 * @param {Array} events - Array of calendar event objects
 * @param {Object} filters - Filter object with departments, shiftTypes, dateRange
 * @returns {Array} Filtered events
 */
export const filterCalendarEvents = (events, filters = {}) => {
  if (!events || events.length === 0) return [];

  const { departments = [], shiftTypes = [], dateRange = null } = filters;

  return events.filter(event => {
    // Department filter
    if (departments.length > 0) {
      const eventDept = event.extendedProps?.department || '';
      if (!departments.includes(eventDept)) return false;
    }

    // Shift type filter
    if (shiftTypes.length > 0) {
      const eventType = event.extendedProps?.shiftType || '';
      if (!shiftTypes.includes(eventType)) return false;
    }

    // Date range filter
    if (dateRange && dateRange.start && dateRange.end) {
      const eventDate = event.start;
      if (!isDateInRange(eventDate, dateRange)) return false;
    }

    return true;
  });
};

/**
 * Search employees by term (name or email)
 * @param {Array} employees - Array of employee objects
 * @param {string} searchTerm - Search string
 * @returns {Array} Filtered employees
 */
export const searchEmployees = (employees, searchTerm) => {
  return filterEmployees(employees, searchTerm, [], []);
};

/**
 * Combine multiple filter criteria
 * @param {Array} items - Array of items to filter
 * @param {Object} criteria - Filter criteria object
 * @returns {Array} Filtered items
 */
export const applyFilters = (items, criteria) => {
  if (!items || items.length === 0) return [];
  if (!criteria || Object.keys(criteria).length === 0) return items;

  return items.filter(item => {
    // Apply each criterion
    for (const [key, value] of Object.entries(criteria)) {
      if (value === null || value === undefined) continue;

      // Array criteria (e.g., departments, roles)
      if (Array.isArray(value) && value.length > 0) {
        if (!value.includes(item[key])) return false;
      }
      // String criteria (e.g., search term)
      else if (typeof value === 'string' && value.trim() !== '') {
        const itemValue = String(item[key] || '').toLowerCase();
        const searchValue = value.toLowerCase();
        if (!itemValue.includes(searchValue)) return false;
      }
      // Object criteria (e.g., date range)
      else if (typeof value === 'object' && value.start && value.end) {
        if (!isDateInRange(item[key], value)) return false;
      }
    }

    return true;
  });
};

export default {
  getQuickDateRange,
  isDateInRange,
  filterEmployees,
  filterShifts,
  filterAssignments,
  filterCalendarEvents,
  searchEmployees,
  applyFilters
};
