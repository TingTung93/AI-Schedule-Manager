/**
 * Employee Management Test Fixtures
 *
 * Comprehensive test data for employee management E2E tests
 */

export interface TestEmployee {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: 'admin' | 'manager' | 'employee' | 'scheduler';
  department?: string;
  hireDate?: string;
  hourlyRate?: number;
  maxHoursPerWeek?: number;
  qualifications?: string[];
  availability?: {
    monday?: { available: boolean; start?: string; end?: string };
    tuesday?: { available: boolean; start?: string; end?: string };
    wednesday?: { available: boolean; start?: string; end?: string };
    thursday?: { available: boolean; start?: string; end?: string };
    friday?: { available: boolean; start?: string; end?: string };
    saturday?: { available: boolean; start?: string; end?: string };
    sunday?: { available: boolean; start?: string; end?: string };
  };
}

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'employee' | 'scheduler';
  firstName?: string;
  lastName?: string;
}

/**
 * Test Users for Authentication (Pre-seeded in database)
 */
export const testUsers: Record<string, TestUser> = {
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  },
  manager: {
    email: 'manager@example.com',
    password: 'Manager123!',
    role: 'manager',
    firstName: 'Sarah',
    lastName: 'Johnson'
  },
  employee: {
    email: 'employee1@example.com',
    password: 'Employee123!',
    role: 'employee',
    firstName: 'John',
    lastName: 'Smith'
  },
  // Using supervisor as scheduler proxy (no scheduler role in seed data)
  scheduler: {
    email: 'supervisor@example.com',
    password: 'Supervisor123!',
    role: 'scheduler',
    firstName: 'Mike',
    lastName: 'Williams'
  }
};

/**
 * Valid Employee Test Data
 */
export const validEmployees: TestEmployee[] = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@test.com',
    phone: '+12125550100',
    role: 'employee',
    department: 'Engineering',
    hireDate: '2025-01-15',
    hourlyRate: 25.50,
    maxHoursPerWeek: 40,
    qualifications: ['JavaScript', 'React', 'Node.js'],
    availability: {
      monday: { available: true, start: '09:00', end: '17:00' },
      tuesday: { available: true, start: '09:00', end: '17:00' },
      wednesday: { available: true, start: '09:00', end: '17:00' },
      thursday: { available: true, start: '09:00', end: '17:00' },
      friday: { available: true, start: '09:00', end: '17:00' },
      saturday: { available: false },
      sunday: { available: false }
    }
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@test.com',
    phone: '+12125550111',
    role: 'manager',
    department: 'Sales',
    hireDate: '2025-01-10',
    hourlyRate: 35.00,
    maxHoursPerWeek: 45,
    qualifications: ['Sales', 'Team Management', 'CRM'],
    availability: {
      monday: { available: true, start: '08:00', end: '18:00' },
      tuesday: { available: true, start: '08:00', end: '18:00' },
      wednesday: { available: true, start: '08:00', end: '18:00' },
      thursday: { available: true, start: '08:00', end: '18:00' },
      friday: { available: true, start: '08:00', end: '18:00' },
      saturday: { available: true, start: '10:00', end: '14:00' },
      sunday: { available: false }
    }
  },
  {
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@test.com',
    phone: '+12125550122',
    role: 'employee',
    department: 'Support',
    hireDate: '2025-01-20',
    hourlyRate: 22.00,
    maxHoursPerWeek: 30,
    qualifications: ['Customer Service', 'Technical Support'],
    availability: {
      monday: { available: false },
      tuesday: { available: true, start: '14:00', end: '22:00' },
      wednesday: { available: true, start: '14:00', end: '22:00' },
      thursday: { available: true, start: '14:00', end: '22:00' },
      friday: { available: true, start: '14:00', end: '22:00' },
      saturday: { available: true, start: '10:00', end: '18:00' },
      sunday: { available: true, start: '10:00', end: '18:00' }
    }
  }
];

/**
 * Invalid Employee Data for Validation Testing
 */
export const invalidEmployees = {
  missingFirstName: {
    firstName: '',
    lastName: 'Doe',
    email: 'missing.firstname@test.com'
  },
  missingLastName: {
    firstName: 'John',
    lastName: '',
    email: 'missing.lastname@test.com'
  },
  invalidEmail: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'invalid-email'
  },
  duplicateEmail: {
    firstName: 'John',
    lastName: 'Duplicate',
    email: 'john.doe@test.com' // Same as first valid employee
  },
  invalidPhone: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.invalidphone@test.com',
    phone: 'invalid-phone'
  },
  negativeHourlyRate: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.negativerate@test.com',
    hourlyRate: -10
  },
  excessiveHourlyRate: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.highrate@test.com',
    hourlyRate: 1500 // Max is 1000
  },
  invalidMaxHours: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.invalidhours@test.com',
    maxHoursPerWeek: 200 // Max is 168
  },
  tooManyQualifications: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.manyquals@test.com',
    qualifications: Array(25).fill('Qualification') // Max is 20
  }
};

/**
 * Password Test Data
 */
export const passwordTestData = {
  valid: {
    current: 'Employee123!',
    new: 'NewPassword123!',
    confirm: 'NewPassword123!'
  },
  weakPasswords: [
    'weak',           // Too short
    'password',       // No uppercase, numbers, or special chars
    'Password',       // No numbers or special chars
    'Password123',    // No special chars
    'pass123!',       // Too short
    '12345678',       // No letters or special chars
    'UPPERCASE123!'   // No lowercase
  ],
  mismatchedPasswords: {
    current: 'Employee123!@#',
    new: 'NewPassword123!@#',
    confirm: 'DifferentPassword123!@#'
  },
  wrongCurrentPassword: {
    current: 'WrongPassword123!@#',
    new: 'NewPassword123!@#',
    confirm: 'NewPassword123!@#'
  }
};

/**
 * Search and Filter Test Data
 */
export const searchTestData = {
  exactMatch: 'john.doe@test.com',
  partialMatch: 'john',
  noMatch: 'nonexistent@test.com',
  caseInsensitive: 'JOHN DOE'
};

export const filterTestData = {
  roles: ['admin', 'manager', 'employee', 'scheduler'],
  statuses: ['active', 'inactive', 'locked'],
  departments: ['Engineering', 'Sales', 'Support', 'Marketing']
};

/**
 * Pagination Test Data
 */
export const paginationTestData = {
  pageSize: 10,
  largeBatch: Array(50).fill(null).map((_, i) => ({
    firstName: `Test${i}`,
    lastName: `Employee${i}`,
    email: `test.employee${i}@test.com`,
    role: 'employee' as const
  }))
};

/**
 * Extended Fields Test Data
 */
export const extendedFieldsTestData = {
  qualifications: {
    valid: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
    tooMany: Array(25).fill('Skill'), // Max is 20
    withSpecialChars: ['C++', 'C#', 'ASP.NET', 'SQL Server']
  },
  hourlyRates: {
    minimum: 0,
    typical: 25.50,
    maximum: 1000,
    belowMin: -10,
    aboveMax: 1500,
    twoDecimals: 25.99,
    threeDecimals: 25.999 // Should round to 2
  },
  maxHours: {
    minimum: 1,
    typical: 40,
    maximum: 168,
    belowMin: 0,
    aboveMax: 200
  },
  availability: {
    fullTime: {
      monday: { available: true, start: '09:00', end: '17:00' },
      tuesday: { available: true, start: '09:00', end: '17:00' },
      wednesday: { available: true, start: '09:00', end: '17:00' },
      thursday: { available: true, start: '09:00', end: '17:00' },
      friday: { available: true, start: '09:00', end: '17:00' },
      saturday: { available: false },
      sunday: { available: false }
    },
    partTime: {
      monday: { available: false },
      tuesday: { available: false },
      wednesday: { available: true, start: '18:00', end: '22:00' },
      thursday: { available: true, start: '18:00', end: '22:00' },
      friday: { available: false },
      saturday: { available: true, start: '10:00', end: '18:00' },
      sunday: { available: true, start: '10:00', end: '18:00' }
    },
    flexible: {
      monday: { available: true, start: '06:00', end: '14:00' },
      tuesday: { available: true, start: '14:00', end: '22:00' },
      wednesday: { available: true, start: '06:00', end: '14:00' },
      thursday: { available: true, start: '14:00', end: '22:00' },
      friday: { available: true, start: '06:00', end: '14:00' },
      saturday: { available: false },
      sunday: { available: false }
    }
  }
};

/**
 * Department Test Data
 */
export const departmentTestData = {
  validDepartments: [
    { id: 1, name: 'Engineering', code: 'ENG' },
    { id: 2, name: 'Sales', code: 'SALES' },
    { id: 3, name: 'Support', code: 'SUP' },
    { id: 4, name: 'Marketing', code: 'MKT' }
  ],
  invalidDepartmentId: 999
};

/**
 * Role Change Test Data
 */
export const roleChangeTestData = {
  validChanges: [
    { from: 'employee', to: 'manager', reason: 'Promotion after 1 year' },
    { from: 'manager', to: 'employee', reason: 'Requested demotion' },
    { from: 'employee', to: 'scheduler', reason: 'Schedule management role' }
  ],
  invalidChanges: [
    { from: 'admin', to: 'employee', reason: 'Cannot demote admin' },
    { from: 'employee', to: 'employee', reason: 'Same role' }
  ]
};

/**
 * Status Change Test Data
 */
export const statusChangeTestData = {
  validChanges: [
    { from: 'active', to: 'inactive', reason: 'Leave of absence' },
    { from: 'inactive', to: 'active', reason: 'Returned from leave' },
    { from: 'active', to: 'locked', reason: 'Security violation' },
    { from: 'locked', to: 'active', reason: 'Issue resolved' }
  ]
};
