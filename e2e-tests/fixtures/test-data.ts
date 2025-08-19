/**
 * Test Data Fixtures for E2E Tests
 */

export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin'
  },
  manager: {
    email: 'manager@test.com',
    password: 'Manager123!',
    role: 'manager'
  },
  employee: {
    email: 'employee@test.com',
    password: 'Employee123!',
    role: 'employee'
  }
};

export const testEmployees = [
  {
    name: 'Sarah Johnson',
    email: 'sarah@test.com',
    role: 'Server',
    availability: 'Weekdays 9am-5pm'
  },
  {
    name: 'John Smith',
    email: 'john@test.com',
    role: 'Cook',
    availability: 'Flexible'
  },
  {
    name: 'Mike Davis',
    email: 'mike@test.com',
    role: 'Cashier',
    availability: 'Weekends only'
  }
];

export const testRules = [
  "Sarah can't work past 5pm on weekdays due to childcare",
  "John prefers morning shifts on weekends",
  "Mike needs Mondays off for college classes",
  "Always need at least 2 people during lunch hours",
  "Maximum 40 hours per week for all employees",
  "No consecutive closing and opening shifts"
];

export const testSchedule = {
  startDate: '2025-01-20',
  endDate: '2025-01-26',
  shiftTypes: ['Morning', 'Afternoon', 'Evening'],
  requirements: {
    morning: 2,
    afternoon: 3,
    evening: 2
  }
};