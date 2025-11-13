/**
 * Tests for Assignment Helpers
 */

import {
  extractShiftsFromSchedule,
  filterAssignmentsByEmployee,
  filterAssignmentsByPosition,
  filterAssignmentsByStatus,
  getAssignmentStatus,
  sortAssignmentsByDateTime,
  sortAssignmentsByEmployee,
  calculateShiftDuration,
  calculateTotalHours,
  findConflictingAssignments,
  formatAssignmentForDisplay,
  getUniquePositions,
  getCoverageStats,
} from '../assignmentHelpers';

describe('assignmentHelpers', () => {
  const mockAssignments = [
    {
      id: 1,
      employee_id: 101,
      employee_name: 'John Doe',
      shift_date: '2025-01-13',
      start_time: '09:00:00',
      end_time: '17:00:00',
      position: 'Manager',
      status: 'confirmed',
      notes: 'Morning shift',
    },
    {
      id: 2,
      employee_id: 102,
      employee_name: 'Jane Smith',
      shift_date: '2025-01-13',
      start_time: '13:00:00',
      end_time: '21:00:00',
      position: 'Cashier',
      status: 'pending',
      notes: null,
    },
    {
      id: 3,
      employee_id: 101,
      employee_name: 'John Doe',
      shift_date: '2025-01-14',
      start_time: '09:00:00',
      end_time: '17:00:00',
      position: 'Manager',
      status: 'confirmed',
      notes: null,
    },
  ];

  const mockSchedule = {
    id: 1,
    name: 'Test Schedule',
    assignments: mockAssignments,
  };

  describe('extractShiftsFromSchedule', () => {
    it('should extract shifts from schedule', () => {
      const shifts = extractShiftsFromSchedule(mockSchedule);

      expect(shifts).toHaveLength(3);
      expect(shifts[0]).toHaveProperty('id');
      expect(shifts[0]).toHaveProperty('date');
      expect(shifts[0]).toHaveProperty('startTime');
      expect(shifts[0]).toHaveProperty('endTime');
      expect(shifts[0]).toHaveProperty('duration');
    });

    it('should handle null schedule', () => {
      const shifts = extractShiftsFromSchedule(null);
      expect(shifts).toEqual([]);
    });
  });

  describe('filterAssignmentsByEmployee', () => {
    it('should filter assignments by employee ID', () => {
      const filtered = filterAssignmentsByEmployee(mockAssignments, 101);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.employee_id === 101)).toBe(true);
    });

    it('should return empty array for non-existent employee', () => {
      const filtered = filterAssignmentsByEmployee(mockAssignments, 999);
      expect(filtered).toEqual([]);
    });
  });

  describe('filterAssignmentsByPosition', () => {
    it('should filter assignments by position', () => {
      const filtered = filterAssignmentsByPosition(mockAssignments, 'Manager');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.position === 'Manager')).toBe(true);
    });
  });

  describe('filterAssignmentsByStatus', () => {
    it('should filter assignments by status', () => {
      const filtered = filterAssignmentsByStatus(mockAssignments, 'confirmed');

      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.status === 'confirmed')).toBe(true);
    });
  });

  describe('getAssignmentStatus', () => {
    it('should return status info for confirmed assignment', () => {
      const status = getAssignmentStatus(mockAssignments[0]);

      expect(status.label).toBe('Confirmed');
      expect(status.color).toBe('#10b981');
      expect(status.icon).toBe('✓');
    });

    it('should return status info for pending assignment', () => {
      const status = getAssignmentStatus(mockAssignments[1]);

      expect(status.label).toBe('Pending');
      expect(status.color).toBe('#f59e0b');
      expect(status.icon).toBe('⏳');
    });

    it('should handle null assignment', () => {
      const status = getAssignmentStatus(null);
      expect(status.label).toBe('Pending');
    });
  });

  describe('sortAssignmentsByDateTime', () => {
    it('should sort assignments by date and time ascending', () => {
      const sorted = sortAssignmentsByDateTime(mockAssignments, 'asc');

      expect(sorted[0].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });

    it('should sort assignments by date and time descending', () => {
      const sorted = sortAssignmentsByDateTime(mockAssignments, 'desc');

      expect(sorted[0].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe('sortAssignmentsByEmployee', () => {
    it('should sort assignments by employee name', () => {
      const sorted = sortAssignmentsByEmployee(mockAssignments, 'asc');

      expect(sorted[0].employee_name).toBe('Jane Smith');
      expect(sorted[1].employee_name).toBe('John Doe');
    });
  });

  describe('calculateShiftDuration', () => {
    it('should calculate shift duration in hours', () => {
      const duration = calculateShiftDuration('09:00:00', '17:00:00');
      expect(duration).toBe(8);
    });

    it('should handle half-hour increments', () => {
      const duration = calculateShiftDuration('09:00:00', '13:30:00');
      expect(duration).toBe(4.5);
    });

    it('should handle null times', () => {
      const duration = calculateShiftDuration(null, null);
      expect(duration).toBe(0);
    });
  });

  describe('calculateTotalHours', () => {
    it('should calculate total hours for assignments', () => {
      const total = calculateTotalHours(mockAssignments);
      expect(total).toBe(24); // 3 shifts x 8 hours each
    });

    it('should handle empty array', () => {
      const total = calculateTotalHours([]);
      expect(total).toBe(0);
    });
  });

  describe('findConflictingAssignments', () => {
    it('should find overlapping shifts for same employee', () => {
      const conflictingAssignments = [
        {
          id: 1,
          employee_id: 101,
          shift_date: '2025-01-13',
          start_time: '09:00:00',
          end_time: '17:00:00',
          position: 'Manager',
        },
        {
          id: 2,
          employee_id: 101,
          shift_date: '2025-01-13',
          start_time: '13:00:00',
          end_time: '21:00:00',
          position: 'Cashier',
        },
      ];

      const conflicts = findConflictingAssignments(conflictingAssignments);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].reason).toBe('Overlapping shifts for same employee');
    });

    it('should not find conflicts for different employees', () => {
      const conflicts = findConflictingAssignments(mockAssignments);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('formatAssignmentForDisplay', () => {
    it('should format assignment for display', () => {
      const formatted = formatAssignmentForDisplay(mockAssignments[0]);

      expect(formatted).toHaveProperty('employeeName');
      expect(formatted).toHaveProperty('date');
      expect(formatted).toHaveProperty('time');
      expect(formatted).toHaveProperty('duration');
      expect(formatted).toHaveProperty('statusColor');
      expect(formatted.duration).toBe('8.0 hrs');
    });

    it('should handle null assignment', () => {
      const formatted = formatAssignmentForDisplay(null);
      expect(formatted).toBeNull();
    });
  });

  describe('getUniquePositions', () => {
    it('should get unique positions from assignments', () => {
      const positions = getUniquePositions(mockAssignments);

      expect(positions).toHaveLength(2);
      expect(positions).toContain('Manager');
      expect(positions).toContain('Cashier');
    });

    it('should return sorted positions', () => {
      const positions = getUniquePositions(mockAssignments);
      expect(positions).toEqual(['Cashier', 'Manager']);
    });
  });

  describe('getCoverageStats', () => {
    it('should get coverage statistics for a date', () => {
      const stats = getCoverageStats(mockAssignments, '2025-01-13');

      expect(stats.total).toBe(2);
      expect(stats.confirmed).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('should return zero stats for date with no assignments', () => {
      const stats = getCoverageStats(mockAssignments, '2025-01-15');

      expect(stats.total).toBe(0);
      expect(stats.confirmed).toBe(0);
    });
  });
});
