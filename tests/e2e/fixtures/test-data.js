/**
 * E2E Test Fixtures and Test Data
 *
 * Centralized test data for department management E2E tests
 */

// User fixtures
const users = {
  admin: {
    id: 'user-admin-001',
    email: 'admin@company.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    permissions: ['all']
  },
  manager: {
    id: 'user-manager-001',
    email: 'manager@company.com',
    password: 'Manager123!',
    firstName: 'Manager',
    lastName: 'Smith',
    role: 'manager',
    department: 'Engineering',
    permissions: ['manage_schedule', 'manage_employees', 'view_analytics']
  },
  employee1: {
    id: 'user-emp-001',
    email: 'alice@company.com',
    password: 'Employee123!',
    firstName: 'Alice',
    lastName: 'Johnson',
    role: 'employee',
    department: 'Engineering',
    position: 'Engineer',
    maxHoursPerWeek: 40,
    minRestHours: 11
  },
  employee2: {
    id: 'user-emp-002',
    email: 'bob@company.com',
    password: 'Employee123!',
    firstName: 'Bob',
    lastName: 'Smith',
    role: 'employee',
    department: 'Engineering',
    position: 'Engineer',
    maxHoursPerWeek: 40,
    minRestHours: 11
  },
  employee3: {
    id: 'user-emp-003',
    email: 'charlie@company.com',
    password: 'Employee123!',
    firstName: 'Charlie',
    lastName: 'Davis',
    role: 'employee',
    department: 'Engineering',
    position: 'Senior Engineer',
    maxHoursPerWeek: 40,
    minRestHours: 11
  }
};

// Department fixtures
const departments = {
  engineering: {
    id: 'dept-eng-001',
    name: 'Engineering',
    code: 'ENG',
    description: 'Software Engineering Department',
    maxEmployees: 50,
    minCoverage: 2,
    manager: users.manager.id
  },
  sales: {
    id: 'dept-sales-001',
    name: 'Sales',
    code: 'SALES',
    description: 'Sales Department',
    maxEmployees: 30,
    minCoverage: 3
  },
  marketing: {
    id: 'dept-mkt-001',
    name: 'Marketing',
    code: 'MKT',
    description: 'Marketing Department',
    maxEmployees: 20,
    minCoverage: 2
  }
};

// Schedule templates
const scheduleTemplates = {
  standardWeek: {
    id: 'template-std-week',
    name: 'Standard Week',
    description: '5-day work week, 8 hours per day',
    shifts: [
      { day: 'Monday', start: '09:00', end: '17:00', position: 'Engineer' },
      { day: 'Tuesday', start: '09:00', end: '17:00', position: 'Engineer' },
      { day: 'Wednesday', start: '09:00', end: '17:00', position: 'Engineer' },
      { day: 'Thursday', start: '09:00', end: '17:00', position: 'Engineer' },
      { day: 'Friday', start: '09:00', end: '17:00', position: 'Engineer' }
    ],
    totalHours: 40,
    coverage: 'standard'
  },
  shiftRotation: {
    id: 'template-shift-rotation',
    name: 'Shift Rotation',
    description: '24/7 coverage with rotating shifts',
    shifts: [
      { day: 'Monday', start: '06:00', end: '14:00', position: 'Morning Engineer' },
      { day: 'Monday', start: '14:00', end: '22:00', position: 'Evening Engineer' },
      { day: 'Monday', start: '22:00', end: '06:00', position: 'Night Engineer' },
      { day: 'Tuesday', start: '06:00', end: '14:00', position: 'Morning Engineer' },
      { day: 'Tuesday', start: '14:00', end: '22:00', position: 'Evening Engineer' },
      { day: 'Tuesday', start: '22:00', end: '06:00', position: 'Night Engineer' }
    ],
    totalHours: 48,
    coverage: '24/7'
  }
};

// Shift type configurations
const shiftTypes = {
  regular: {
    id: 'type-regular',
    name: 'Regular',
    color: '#3B82F6',
    icon: 'clock',
    duration: { min: 6, max: 10 }
  },
  morning: {
    id: 'type-morning',
    name: 'Morning',
    color: '#F59E0B',
    icon: 'sunrise',
    duration: { min: 6, max: 10 }
  },
  evening: {
    id: 'type-evening',
    name: 'Evening',
    color: '#8B5CF6',
    icon: 'sunset',
    duration: { min: 6, max: 10 }
  },
  night: {
    id: 'type-night',
    name: 'Night',
    color: '#1F2937',
    icon: 'moon',
    duration: { min: 6, max: 10 }
  },
  oncall: {
    id: 'type-oncall',
    name: 'On-Call',
    color: '#EF4444',
    icon: 'phone',
    duration: { min: 12, max: 24 }
  }
};

// Sample schedules
const schedules = {
  currentWeek: {
    id: 'schedule-current',
    name: 'Current Week Schedule',
    department: departments.engineering.id,
    startDate: '2024-02-05',
    endDate: '2024-02-11',
    status: 'published',
    shifts: [
      {
        id: 'shift-001',
        date: '2024-02-05',
        start: '09:00',
        end: '17:00',
        employee: users.employee1.id,
        type: shiftTypes.regular.id,
        position: 'Engineer'
      },
      {
        id: 'shift-002',
        date: '2024-02-06',
        start: '09:00',
        end: '17:00',
        employee: users.employee2.id,
        type: shiftTypes.regular.id,
        position: 'Engineer'
      },
      {
        id: 'shift-003',
        date: '2024-02-07',
        start: '14:00',
        end: '22:00',
        employee: users.employee3.id,
        type: shiftTypes.evening.id,
        position: 'Senior Engineer'
      },
      {
        id: 'shift-004',
        date: '2024-02-08',
        start: '06:00',
        end: '14:00',
        employee: users.employee1.id,
        type: shiftTypes.morning.id,
        position: 'Engineer'
      }
    ]
  }
};

// Validation rules
const validationRules = {
  shift: {
    minDuration: 4, // hours
    maxDuration: 12, // hours
    minRestPeriod: 11, // hours between shifts
    maxWeeklyHours: 40
  },
  schedule: {
    maxAdvanceDays: 90,
    minAdvanceDays: 1,
    requireApproval: true
  },
  employee: {
    maxConsecutiveDays: 6,
    minDaysOff: 1,
    maxShiftsPerDay: 1
  }
};

// Notification templates
const notifications = {
  schedulePublished: {
    type: 'schedule_published',
    title: 'New Schedule Published',
    template: 'A new schedule "{scheduleName}" has been published for {dateRange}.',
    channels: ['email', 'push'],
    priority: 'high'
  },
  shiftAssigned: {
    type: 'shift_assigned',
    title: 'Shift Assigned',
    template: 'You have been assigned to a shift on {date} from {startTime} to {endTime}.',
    channels: ['email', 'push'],
    priority: 'medium'
  },
  shiftChanged: {
    type: 'shift_changed',
    title: 'Shift Updated',
    template: 'Your shift on {date} has been updated. New time: {startTime} - {endTime}.',
    channels: ['email', 'push'],
    priority: 'high'
  },
  coverageWarning: {
    type: 'coverage_warning',
    title: 'Coverage Warning',
    template: 'Department {department} has insufficient coverage on {date}.',
    channels: ['email'],
    priority: 'high'
  }
};

// Analytics data
const analyticsData = {
  overview: {
    totalHours: 320,
    totalShifts: 40,
    laborCost: 12800,
    avgCoverage: 2.5,
    utilizationRate: 0.85
  },
  byEmployee: [
    {
      employeeId: users.employee1.id,
      name: 'Alice Johnson',
      totalHours: 120,
      totalShifts: 15,
      avgShiftDuration: 8,
      utilizationRate: 0.75
    },
    {
      employeeId: users.employee2.id,
      name: 'Bob Smith',
      totalHours: 100,
      totalShifts: 12,
      avgShiftDuration: 8.3,
      utilizationRate: 0.62
    }
  ],
  byShiftType: [
    {
      type: shiftTypes.regular.name,
      count: 25,
      totalHours: 200,
      avgDuration: 8
    },
    {
      type: shiftTypes.evening.name,
      count: 10,
      totalHours: 80,
      avgDuration: 8
    },
    {
      type: shiftTypes.morning.name,
      count: 5,
      totalHours: 40,
      avgDuration: 8
    }
  ]
};

// Conflict scenarios
const conflictScenarios = {
  overlappingShifts: {
    existing: {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employee: users.employee1.id
    },
    new: {
      date: '2024-02-05',
      start: '14:00',
      end: '22:00',
      employee: users.employee1.id
    },
    expectedConflict: 'overlapping_shifts',
    overlapHours: 3
  },
  doubleBooking: {
    existing: {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employee: users.employee1.id
    },
    new: {
      date: '2024-02-05',
      start: '09:00',
      end: '17:00',
      employee: users.employee1.id
    },
    expectedConflict: 'double_booking'
  },
  maxHoursExceeded: {
    weeklyHours: 40,
    additionalShift: {
      duration: 8,
      expectedTotal: 48
    },
    expectedConflict: 'max_hours_exceeded'
  },
  insufficientRest: {
    previousShift: {
      date: '2024-02-05',
      end: '22:00'
    },
    nextShift: {
      date: '2024-02-06',
      start: '06:00'
    },
    restPeriod: 8,
    requiredRest: 11,
    expectedConflict: 'insufficient_rest'
  }
};

// Export configuration
const exportConfigs = {
  pdf: {
    format: 'pdf',
    orientation: 'landscape',
    pageSize: 'A4',
    includeHeaders: true,
    includeFooters: true,
    colorCoded: true,
    showEmployeeNames: true,
    showShiftTimes: true,
    showLegend: true
  },
  csv: {
    format: 'csv',
    delimiter: ',',
    includeHeaders: true,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
    columns: [
      'date',
      'employee',
      'position',
      'shiftType',
      'startTime',
      'endTime',
      'duration',
      'department'
    ]
  },
  excel: {
    format: 'xlsx',
    sheetName: 'Schedule',
    includeCharts: true,
    includeSummary: true,
    autoFilter: true,
    freezePanes: true
  }
};

// Helper functions
const helpers = {
  /**
   * Generate date range
   */
  generateDateRange(startDate, days) {
    const dates = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  },

  /**
   * Calculate shift duration in hours
   */
  calculateDuration(startTime, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
  },

  /**
   * Check if two shifts overlap
   */
  shiftsOverlap(shift1, shift2) {
    if (shift1.date !== shift2.date) return false;
    if (shift1.employee !== shift2.employee) return false;

    const start1 = shift1.start;
    const end1 = shift1.end;
    const start2 = shift2.start;
    const end2 = shift2.end;

    return (start1 < end2 && start2 < end1);
  },

  /**
   * Calculate rest period between shifts
   */
  calculateRestPeriod(shift1, shift2) {
    const date1 = new Date(`${shift1.date}T${shift1.end}`);
    const date2 = new Date(`${shift2.date}T${shift2.start}`);

    const diffMs = date2 - date1;
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours;
  },

  /**
   * Generate sample shifts for a week
   */
  generateWeeklyShifts(startDate, employees, shiftType) {
    const shifts = [];
    const dates = this.generateDateRange(startDate, 7);

    dates.forEach((date, index) => {
      const employee = employees[index % employees.length];
      shifts.push({
        id: `shift-gen-${index}`,
        date,
        start: '09:00',
        end: '17:00',
        employee: employee.id,
        type: shiftType,
        position: employee.position
      });
    });

    return shifts;
  }
};

module.exports = {
  users,
  departments,
  scheduleTemplates,
  shiftTypes,
  schedules,
  validationRules,
  notifications,
  analyticsData,
  conflictScenarios,
  exportConfigs,
  helpers
};
