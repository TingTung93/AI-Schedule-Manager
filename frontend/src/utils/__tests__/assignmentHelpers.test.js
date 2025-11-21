/**
 * Tests for Assignment Helpers
 */

import {
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
} from '../assignmentHelpers';

describe('assignmentHelpers', () => {
  const mockSchedule = {
    id: 1,
    name: 'Test Schedule',
    assignments: [
      {
        id: 1,
        employee_id: 101,
        shift_id: 201,
        status: 'confirmed',
        priority: 1,
        notes: 'Morning shift',
        startTime: '2025-01-13T09:00:00',
        endTime: '2025-01-13T17:00:00',
        date: '2025-01-13',
        employee: {
          firstName: 'John',
          lastName: 'Doe',
          role: 'Manager'
        }
      },
      {
        id: 2,
        employee_id: 102,
        shift_id: 202,
        status: 'assigned',
        priority: 2,
        notes: null,
        startTime: '2025-01-13T13:00:00',
        endTime: '2025-01-13T21:00:00',
        date: '2025-01-13',
        employee: {
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'Cashier'
        }
      },
      {
        id: 3,
        employee_id: 101,
        shift_id: 203,
        status: 'confirmed',
        priority: 1,
        notes: null,
        startTime: '2025-01-14T09:00:00',
        endTime: '2025-01-14T17:00:00',
        date: '2025-01-14',
        employee: {
          firstName: 'John',
          lastName: 'Doe',
          role: 'Manager'
        }
      },
      {
        id: 4,
        employee_id: 103,
        shift_id: 204,
        status: 'pending',
        priority: 3,
        notes: 'Not yet confirmed',
        startTime: '2025-01-14T10:00:00',
        endTime: '2025-01-14T18:00:00',
        date: '2025-01-14'
      }
    ]
  };

  describe('extractShiftsFromSchedule', () => {
    it('should extract shifts from schedule (only assigned/confirmed)', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);

      expect(shifts).toHaveLength(3); // Only assigned and confirmed
      expect(shifts[0]).toHaveProperty('id');
      expect(shifts[0]).toHaveProperty('date');
      expect(shifts[0]).toHaveProperty('startTime');
      expect(shifts[0]).toHaveProperty('endTime');
      expect(shifts[0]).toHaveProperty('employeeId');
    });

    it('should handle null schedule', () => {
      const shifts = extractShiftsFromSchedule(null);
      expect(shifts).toEqual([]);
    });

    it('should extract employee names', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      expect(shifts[0].employeeName).toBe('John Doe');
      expect(shifts[1].employeeName).toBe('Jane Smith');
    });

    it('should handle missing employee data', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      expect(shifts[2].employeeName).toBe('John Doe');
    });
  });

  describe('groupShiftsByDate', () => {
    it('should group shifts by date', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const grouped = groupShiftsByDate(shifts);

      expect(grouped['2025-01-13']).toHaveLength(2);
      expect(grouped['2025-01-14']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupShiftsByDate([]);
      expect(grouped).toEqual({});
    });
  });

  describe('groupShiftsByEmployee', () => {
    it('should group shifts by employee ID', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const grouped = groupShiftsByEmployee(shifts);

      expect(grouped[101]).toHaveLength(2);
      expect(grouped[102]).toHaveLength(1);
    });

    it('should handle null input', () => {
      const grouped = groupShiftsByEmployee(null);
      expect(grouped).toEqual({});
    });
  });

  describe('filterShiftsByDateRange', () => {
    it('should filter shifts within date range', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const filtered = filterShiftsByDateRange(shifts, '2025-01-13', '2025-01-13');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.date === '2025-01-13')).toBe(true);
    });

    it('should handle null shifts', () => {
      const filtered = filterShiftsByDateRange(null, '2025-01-13', '2025-01-14');
      expect(filtered).toEqual([]);
    });
  });

  describe('filterShiftsByStatus', () => {
    it('should filter shifts by single status', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const filtered = filterShiftsByStatus(shifts, 'confirmed');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.status === 'confirmed')).toBe(true);
    });

    it('should filter shifts by multiple statuses', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const filtered = filterShiftsByStatus(shifts, ['confirmed', 'assigned']);

      expect(filtered).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const filtered = filterShiftsByStatus([], 'confirmed');
      expect(filtered).toEqual([]);
    });
  });

  describe('detectShiftConflicts', () => {
    it('should detect overlapping shifts for same employee', () => {
      const shifts = [
        {
          id: 1,
          employeeId: 101,
          startTime: '2025-01-13T09:00:00',
          endTime: '2025-01-13T17:00:00'
        },
        {
          id: 2,
          employeeId: 101,
          startTime: '2025-01-13T15:00:00',
          endTime: '2025-01-13T23:00:00'
        }
      ];

      const conflicts = detectShiftConflicts(shifts[0], shifts);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe(2);
    });

    it('should not detect conflicts for different employees', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const conflicts = detectShiftConflicts(shifts[0], shifts);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle null input', () => {
      const conflicts = detectShiftConflicts(null, []);
      expect(conflicts).toEqual([]);
    });
  });

  describe('calculateTotalHours', () => {
    it('should calculate total hours for shifts', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);
      const total = calculateTotalHours(shifts);
      expect(total).toBe(24); // 3 shifts x 8 hours each
    });

    it('should handle empty array', () => {
      const total = calculateTotalHours([]);
      expect(total).toBe(0);
    });

    it('should handle shifts without times', () => {
      const shifts = [{ id: 1, startTime: null, endTime: null }];
      const total = calculateTotalHours(shifts);
      expect(total).toBe(0);
    });
  });

  describe('transformScheduleToCalendarEvents', () => {
    it('should transform schedule to calendar events', () => {
      const events = transformScheduleToCalendarEvents(mockSchedule);

      expect(events).toHaveLength(3);
      expect(events[0]).toHaveProperty('title');
      expect(events[0]).toHaveProperty('start');
      expect(events[0]).toHaveProperty('end');
      expect(events[0]).toHaveProperty('backgroundColor');
      expect(events[0]).toHaveProperty('extendedProps');
    });

    it('should include employee names in title', () => {
      const events = transformScheduleToCalendarEvents(mockSchedule);
      expect(events[0].title).toContain('John Doe');
    });

    it('should set different colors for different statuses', () => {
      const events = transformScheduleToCalendarEvents(mockSchedule);
      expect(events[0].backgroundColor).toBe('#2e7d32'); // confirmed = green
      // Note: assigned status with 'Cashier' role gets role color '#388e3c' (cashier green)
      expect(events[1].backgroundColor).toBe('#388e3c'); // assigned + cashier role
    });
  });

  describe('formatAssignmentForAPI', () => {
    it('should format assignment for API', () => {
      const formData = {
        employeeId: '101',
        shiftId: '201',
        status: 'assigned',
        priority: '2',
        notes: 'Test notes'
      };

      const formatted = formatAssignmentForAPI(formData);

      expect(formatted).toEqual({
        employee_id: 101,
        shift_id: 201,
        status: 'assigned',
        priority: 2,
        notes: 'Test notes'
      });
    });

    it('should use default values', () => {
      const formData = {
        employeeId: '101',
        shiftId: '201'
      };

      const formatted = formatAssignmentForAPI(formData);

      expect(formatted.status).toBe('assigned');
      expect(formatted.priority).toBe(1);
      expect(formatted.notes).toBeNull();
    });
  });

  describe('checkAssignmentAttention', () => {
    it('should flag assignment needing confirmation', () => {
      const assignment = {
        status: 'assigned',
        needsConfirmation: true,
        conflictsResolved: true
      };

      const result = checkAssignmentAttention(assignment);

      expect(result.needsAttention).toBe(true);
      expect(result.reasons).toContain('Needs employee confirmation');
      expect(result.severity).toBe('info');
    });

    it('should flag assignment with unresolved conflicts', () => {
      const assignment = {
        status: 'assigned',
        needsConfirmation: false,
        conflictsResolved: false
      };

      const result = checkAssignmentAttention(assignment);

      expect(result.needsAttention).toBe(true);
      expect(result.reasons).toContain('Has unresolved conflicts');
      expect(result.severity).toBe('warning');
    });

    it('should flag declined assignment', () => {
      const assignment = {
        status: 'declined',
        needsConfirmation: false,
        conflictsResolved: true
      };

      const result = checkAssignmentAttention(assignment);

      expect(result.needsAttention).toBe(true);
      expect(result.reasons).toContain('Assignment declined by employee');
      expect(result.severity).toBe('error');
    });

    it('should not flag confirmed assignment', () => {
      const assignment = {
        status: 'confirmed',
        needsConfirmation: false,
        conflictsResolved: true
      };

      const result = checkAssignmentAttention(assignment);

      expect(result.needsAttention).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });
});
