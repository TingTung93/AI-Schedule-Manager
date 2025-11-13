/**
 * Tests for Schedule Transformers
 */

import {
  transformScheduleToCalendarEvents,
  transformAssignmentToEvent,
  groupAssignmentsByDate,
  groupAssignmentsByEmployee,
  transformScheduleForExport,
  calculateScheduleStats,
  validateScheduleData,
  mergeSchedules,
} from '../scheduleTransformers';

describe('scheduleTransformers', () => {
  const mockSchedule = {
    id: 1,
    name: 'Week 1 Schedule',
    start_date: '2025-01-13',
    end_date: '2025-01-19',
    status: 'active',
    assignments: [
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
    ],
  };

  describe('transformScheduleToCalendarEvents', () => {
    it('should transform schedules to calendar events', () => {
      const events = transformScheduleToCalendarEvents([mockSchedule]);

      expect(events).toHaveLength(2);
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('title');
      expect(events[0]).toHaveProperty('start');
      expect(events[0]).toHaveProperty('end');
      expect(events[0]).toHaveProperty('extendedProps');
    });

    it('should handle empty schedules array', () => {
      const events = transformScheduleToCalendarEvents([]);
      expect(events).toEqual([]);
    });

    it('should handle null input', () => {
      const events = transformScheduleToCalendarEvents(null);
      expect(events).toEqual([]);
    });
  });

  describe('transformAssignmentToEvent', () => {
    it('should transform assignment to calendar event', () => {
      const assignment = mockSchedule.assignments[0];
      const event = transformAssignmentToEvent(assignment, mockSchedule);

      expect(event.id).toBe('assignment-1');
      expect(event.title).toBe('Manager');
      expect(event.start).toBe('2025-01-13T09:00:00');
      expect(event.end).toBe('2025-01-13T17:00:00');
      expect(event.extendedProps.employeeId).toBe(101);
      expect(event.extendedProps.status).toBe('confirmed');
    });

    it('should handle null assignment', () => {
      const event = transformAssignmentToEvent(null, mockSchedule);
      expect(event).toBeNull();
    });

    it('should handle assignment without shift_date', () => {
      const assignment = { ...mockSchedule.assignments[0], shift_date: null };
      const event = transformAssignmentToEvent(assignment, mockSchedule);
      expect(event).toBeNull();
    });
  });

  describe('groupAssignmentsByDate', () => {
    it('should group assignments by date', () => {
      const grouped = groupAssignmentsByDate(mockSchedule.assignments);

      expect(grouped).toHaveProperty('2025-01-13');
      expect(grouped['2025-01-13']).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const grouped = groupAssignmentsByDate([]);
      expect(grouped).toEqual({});
    });

    it('should handle null input', () => {
      const grouped = groupAssignmentsByDate(null);
      expect(grouped).toEqual({});
    });
  });

  describe('groupAssignmentsByEmployee', () => {
    it('should group assignments by employee', () => {
      const grouped = groupAssignmentsByEmployee(mockSchedule.assignments);

      expect(grouped).toHaveProperty('101');
      expect(grouped).toHaveProperty('102');
      expect(grouped[101]).toHaveLength(1);
      expect(grouped[102]).toHaveLength(1);
    });
  });

  describe('transformScheduleForExport', () => {
    it('should transform schedule for export', () => {
      const exportData = transformScheduleForExport(mockSchedule);

      expect(exportData).toHaveLength(2);
      expect(exportData[0]).toHaveProperty('Date');
      expect(exportData[0]).toHaveProperty('Employee');
      expect(exportData[0]).toHaveProperty('Position');
      expect(exportData[0]).toHaveProperty('Start Time');
      expect(exportData[0]).toHaveProperty('End Time');
      expect(exportData[0]).toHaveProperty('Status');
    });

    it('should handle null schedule', () => {
      const exportData = transformScheduleForExport(null);
      expect(exportData).toEqual([]);
    });
  });

  describe('calculateScheduleStats', () => {
    it('should calculate schedule statistics', () => {
      const stats = calculateScheduleStats(mockSchedule);

      expect(stats.totalShifts).toBe(2);
      expect(stats.totalEmployees).toBe(2);
      expect(stats.statusBreakdown.confirmed).toBe(1);
      expect(stats.statusBreakdown.pending).toBe(1);
      expect(stats.positionBreakdown.Manager).toBe(1);
      expect(stats.positionBreakdown.Cashier).toBe(1);
    });

    it('should handle empty schedule', () => {
      const stats = calculateScheduleStats({ assignments: [] });

      expect(stats.totalShifts).toBe(0);
      expect(stats.totalEmployees).toBe(0);
    });

    it('should handle null schedule', () => {
      const stats = calculateScheduleStats(null);

      expect(stats.totalShifts).toBe(0);
      expect(stats.totalEmployees).toBe(0);
    });
  });

  describe('validateScheduleData', () => {
    it('should validate correct schedule data', () => {
      const result = validateScheduleData(mockSchedule);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing name', () => {
      const invalidSchedule = { ...mockSchedule, name: null };
      const result = validateScheduleData(invalidSchedule);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schedule name is required');
    });

    it('should detect invalid date range', () => {
      const invalidSchedule = {
        ...mockSchedule,
        start_date: '2025-01-19',
        end_date: '2025-01-13',
      };
      const result = validateScheduleData(invalidSchedule);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it('should detect invalid assignments', () => {
      const invalidSchedule = {
        ...mockSchedule,
        assignments: [{ id: 1 }], // Missing required fields
      };
      const result = validateScheduleData(invalidSchedule);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mergeSchedules', () => {
    it('should merge multiple schedules', () => {
      const schedule2 = {
        ...mockSchedule,
        id: 2,
        name: 'Week 2 Schedule',
        assignments: [
          {
            id: 3,
            employee_id: 103,
            shift_date: '2025-01-20',
            start_time: '09:00:00',
            end_time: '17:00:00',
            position: 'Server',
            status: 'confirmed',
          },
        ],
      };

      const merged = mergeSchedules([mockSchedule, schedule2]);

      expect(merged).toHaveLength(3);
      expect(merged[0].scheduleName).toBe('Week 1 Schedule');
      expect(merged[2].scheduleName).toBe('Week 2 Schedule');
    });

    it('should handle empty array', () => {
      const merged = mergeSchedules([]);
      expect(merged).toEqual([]);
    });

    it('should handle null input', () => {
      const merged = mergeSchedules(null);
      expect(merged).toEqual([]);
    });
  });
});
