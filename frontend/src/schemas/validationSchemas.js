/**
 * Yup validation schemas for all forms in the AI Schedule Manager
 */

import * as yup from 'yup';
import { validateEmail, validateAndFormatPhone, checkPasswordStrength } from '../utils/validation';

// Custom Yup validation methods
yup.addMethod(yup.string, 'email', function(message = 'Invalid email format') {
  return this.test('email', message, function(value) {
    if (!value) return true; // Let required() handle empty values
    return validateEmail(value);
  });
});

yup.addMethod(yup.string, 'phone', function(message = 'Invalid phone number format') {
  return this.test('phone', message, function(value) {
    if (!value) return true; // Phone is optional
    const { isValid } = validateAndFormatPhone(value);
    return isValid;
  });
});

yup.addMethod(yup.string, 'strongPassword', function(message = 'Password does not meet strength requirements') {
  return this.test('strong-password', message, function(value) {
    if (!value) return true; // Let required() handle empty values
    const { isValid, feedback } = checkPasswordStrength(value);
    if (!isValid) {
      return this.createError({ message: feedback.join(', ') });
    }
    return true;
  });
});

yup.addMethod(yup.string, 'timeFormat', function(message = 'Time must be in HH:MM format') {
  return this.test('time-format', message, function(value) {
    if (!value) return true;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(value);
  });
});

yup.addMethod(yup.object, 'timeRange', function(startField, endField, message = 'Start time must be before end time') {
  return this.test('time-range', message, function(value) {
    const startTime = value?.[startField];
    const endTime = value?.[endField];

    if (!startTime || !endTime) return true;

    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startInMinutes = startHours * 60 + startMinutes;
    const endInMinutes = endHours * 60 + endMinutes;

    return startInMinutes < endInMinutes;
  });
});

// Employee validation schema
export const employeeSchema = yup.object({
  firstName: yup
    .string()
    .required('First name is required')
    .min(1, 'First name must be at least 1 character')
    .max(50, 'First name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),

  lastName: yup
    .string()
    .required('Last name is required')
    .min(1, 'Last name must be at least 1 character')
    .max(50, 'Last name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),

  email: yup
    .string()
    .required('Email is required')
    .email()
    .max(255, 'Email cannot exceed 255 characters'),

  phone: yup
    .string()
    .phone()
    .nullable(),

  role: yup
    .string()
    .required('Role is required')
    .oneOf(['manager', 'supervisor', 'cashier', 'cook', 'server', 'cleaner'], 'Invalid role selected'),

  hourlyRate: yup
    .number()
    .nullable()
    .transform((value, originalValue) => {
      return originalValue === '' ? null : value;
    })
    .min(0, 'Hourly rate cannot be negative')
    .max(200, 'Hourly rate cannot exceed $200/hour'),

  maxHoursPerWeek: yup
    .number()
    .required('Maximum hours per week is required')
    .integer('Maximum hours must be a whole number')
    .min(1, 'Maximum hours must be at least 1')
    .max(168, 'Maximum hours cannot exceed 168 (24 hours × 7 days)'),

  qualifications: yup
    .array()
    .of(yup.string())
    .default([]),

  isActive: yup
    .boolean()
    .default(true),

  availability: yup.object({
    monday: yup.object({
      available: yup.boolean().default(true),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    tuesday: yup.object({
      available: yup.boolean().default(true),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    wednesday: yup.object({
      available: yup.boolean().default(true),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    thursday: yup.object({
      available: yup.boolean().default(true),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    friday: yup.object({
      available: yup.boolean().default(true),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    saturday: yup.object({
      available: yup.boolean().default(false),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end'),

    sunday: yup.object({
      available: yup.boolean().default(false),
      start: yup.string().when('available', {
        is: true,
        then: schema => schema.required('Start time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      }),
      end: yup.string().when('available', {
        is: true,
        then: schema => schema.required('End time is required').timeFormat(),
        otherwise: schema => schema.nullable()
      })
    }).timeRange('start', 'end')
  }).test('at-least-one-day', 'Employee must be available for at least one day', function(availability) {
    if (!availability) return false;

    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const availableDays = daysOfWeek.filter(day => availability[day]?.available);

    return availableDays.length > 0;
  })
});

// Login schema
export const loginSchema = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email(),

  password: yup
    .string()
    .required('Password is required')
    .min(1, 'Password is required')
});

// Registration schema
export const registrationSchema = yup.object({
  firstName: yup
    .string()
    .required('First name is required')
    .min(1, 'First name must be at least 1 character')
    .max(50, 'First name cannot exceed 50 characters'),

  lastName: yup
    .string()
    .required('Last name is required')
    .min(1, 'Last name must be at least 1 character')
    .max(50, 'Last name cannot exceed 50 characters'),

  email: yup
    .string()
    .required('Email is required')
    .email(),

  password: yup
    .string()
    .required('Password is required')
    .strongPassword(),

  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password'), null], 'Passwords must match')
});

// Shift schema
export const shiftSchema = yup.object({
  name: yup
    .string()
    .required('Shift name is required')
    .min(1, 'Shift name must be at least 1 character')
    .max(100, 'Shift name cannot exceed 100 characters'),

  shiftType: yup
    .string()
    .required('Shift type is required')
    .min(1, 'Shift type must be at least 1 character')
    .max(50, 'Shift type cannot exceed 50 characters'),

  startTime: yup
    .string()
    .required('Start time is required')
    .timeFormat(),

  endTime: yup
    .string()
    .required('End time is required')
    .timeFormat(),

  requiredStaff: yup
    .number()
    .required('Required staff count is required')
    .integer('Required staff must be a whole number')
    .min(1, 'At least 1 staff member is required'),

  requiredQualifications: yup
    .array()
    .of(yup.string())
    .default([]),

  department: yup
    .string()
    .nullable()
    .max(100, 'Department name cannot exceed 100 characters'),

  hourlyRateMultiplier: yup
    .number()
    .required('Hourly rate multiplier is required')
    .min(0, 'Hourly rate multiplier cannot be negative')
    .max(10, 'Hourly rate multiplier cannot exceed 10'),

  active: yup
    .boolean()
    .default(true)
}).timeRange('startTime', 'endTime');

// Schedule schema
export const scheduleSchema = yup.object({
  employeeId: yup
    .number()
    .required('Employee is required')
    .integer('Employee ID must be a number')
    .min(1, 'Invalid employee selected'),

  shiftId: yup
    .number()
    .required('Shift is required')
    .integer('Shift ID must be a number')
    .min(1, 'Invalid shift selected'),

  date: yup
    .date()
    .required('Date is required')
    .min(new Date(), 'Date cannot be in the past'),

  status: yup
    .string()
    .oneOf(['scheduled', 'completed', 'cancelled', 'no_show'], 'Invalid status')
    .default('scheduled'),

  notes: yup
    .string()
    .nullable()
    .max(500, 'Notes cannot exceed 500 characters'),

  overtimeApproved: yup
    .boolean()
    .default(false)
});

// Rule schema
export const ruleSchema = yup.object({
  ruleType: yup
    .string()
    .required('Rule type is required')
    .oneOf(['availability', 'preference', 'requirement', 'restriction'], 'Invalid rule type'),

  originalText: yup
    .string()
    .required('Rule description is required')
    .min(5, 'Rule description must be at least 5 characters')
    .max(500, 'Rule description cannot exceed 500 characters'),

  priority: yup
    .number()
    .required('Priority is required')
    .integer('Priority must be a whole number')
    .min(1, 'Priority must be at least 1')
    .max(5, 'Priority cannot exceed 5'),

  employeeId: yup
    .number()
    .nullable()
    .integer('Employee ID must be a number')
    .min(1, 'Invalid employee selected'),

  constraints: yup
    .object()
    .default({}),

  active: yup
    .boolean()
    .default(true)
});

// Schedule generation schema
export const scheduleGenerationSchema = yup.object({
  startDate: yup
    .date()
    .required('Start date is required')
    .min(new Date(), 'Start date cannot be in the past'),

  endDate: yup
    .date()
    .required('End date is required')
    .min(yup.ref('startDate'), 'End date must be after start date'),

  templateId: yup
    .number()
    .nullable()
    .integer('Template ID must be a number')
    .min(1, 'Invalid template selected'),

  constraints: yup
    .object()
    .default({})
});

// Settings schema
export const settingsSchema = yup.object({
  companyName: yup
    .string()
    .required('Company name is required')
    .min(1, 'Company name must be at least 1 character')
    .max(100, 'Company name cannot exceed 100 characters'),

  timezone: yup
    .string()
    .required('Timezone is required'),

  weekStart: yup
    .string()
    .required('Week start day is required')
    .oneOf(['sunday', 'monday'], 'Week must start on Sunday or Monday'),

  defaultShiftLength: yup
    .number()
    .required('Default shift length is required')
    .min(0.5, 'Shift length must be at least 0.5 hours')
    .max(24, 'Shift length cannot exceed 24 hours'),

  minimumStaffing: yup
    .number()
    .required('Minimum staffing is required')
    .integer('Minimum staffing must be a whole number')
    .min(1, 'Minimum staffing must be at least 1'),

  overtimeThreshold: yup
    .number()
    .required('Overtime threshold is required')
    .min(1, 'Overtime threshold must be at least 1 hour')
    .max(60, 'Overtime threshold cannot exceed 60 hours'),

  notifications: yup.object({
    email: yup.boolean().default(true),
    sms: yup.boolean().default(false),
    push: yup.boolean().default(true),
    scheduleReminders: yup.boolean().default(true),
    shiftChanges: yup.boolean().default(true),
    overtimeAlerts: yup.boolean().default(true)
  })
});

// Password change schema
export const passwordChangeSchema = yup.object({
  currentPassword: yup
    .string()
    .required('Current password is required'),

  newPassword: yup
    .string()
    .required('New password is required')
    .strongPassword(),

  confirmNewPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword'), null], 'Passwords must match')
});

// Availability update schema (for employee self-service)
export const availabilityUpdateSchema = yup.object({
  availability: employeeSchema.fields.availability,
  effectiveDate: yup
    .date()
    .required('Effective date is required')
    .min(new Date(), 'Effective date cannot be in the past'),

  reason: yup
    .string()
    .nullable()
    .max(200, 'Reason cannot exceed 200 characters')
});

export default {
  employeeSchema,
  loginSchema,
  registrationSchema,
  shiftSchema,
  scheduleSchema,
  ruleSchema,
  scheduleGenerationSchema,
  settingsSchema,
  passwordChangeSchema,
  availabilityUpdateSchema
};