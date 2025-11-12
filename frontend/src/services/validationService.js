/**
 * Frontend validation service for async validation and business rule checking
 */

import axios from 'axios';
import { validateEmail, checkShiftConflicts, validateEmployeeQualifications } from '../utils/validation';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

class ValidationService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000
    });

    // Add request interceptor for auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Check if email is available (not already in use)
   * @param {string} email - Email to check
   * @param {number} excludeEmployeeId - Employee ID to exclude from check (for updates)
   * @returns {Promise<{available: boolean, valid: boolean, suggestion?: string}>}
   */
  async checkEmailAvailability(email, excludeEmployeeId = null) {
    try {
      if (!email || !validateEmail(email)) {
        return {
          available: false,
          valid: false,
          error: 'Invalid email format'
        };
      }

      const response = await this.api.post('/api/validation/email', {
        email,
        exclude_employee_id: excludeEmployeeId
      });

      return response.data;
    } catch (error) {
      console.error('Email validation error:', error);
      return {
        available: true, // Assume available on error to prevent blocking
        valid: validateEmail(email),
        error: 'Could not verify email availability'
      };
    }
  }

  /**
   * Check for schedule conflicts
   * @param {object} scheduleData - Schedule data to validate
   * @param {number} excludeScheduleId - Schedule ID to exclude (for updates)
   * @returns {Promise<{hasConflicts: boolean, conflicts: array}>}
   */
  async checkScheduleConflicts(scheduleData, excludeScheduleId = null) {
    try {
      const response = await this.api.post('/api/validation/schedule-conflicts', {
        employee_id: scheduleData.employeeId,
        shift_id: scheduleData.shiftId,
        date: scheduleData.date,
        exclude_schedule_id: excludeScheduleId
      });

      return response.data;
    } catch (error) {
      console.error('Schedule conflict check error:', error);
      return {
        hasConflicts: false,
        conflicts: [],
        error: 'Could not check for conflicts'
      };
    }
  }

  /**
   * Validate employee qualifications for a shift
   * @param {number} employeeId - Employee ID
   * @param {number} shiftId - Shift ID
   * @returns {Promise<{isQualified: boolean, missingQualifications: array}>}
   */
  async validateEmployeeForShift(employeeId, shiftId) {
    try {
      const response = await this.api.post('/api/validation/employee-qualifications', {
        employee_id: employeeId,
        shift_id: shiftId
      });

      return response.data;
    } catch (error) {
      console.error('Employee qualification validation error:', error);
      return {
        isQualified: true, // Assume qualified on error to prevent blocking
        missingQualifications: [],
        error: 'Could not validate qualifications'
      };
    }
  }

  /**
   * Validate business rules for a complete form
   * @param {string} formType - Type of form ('employee', 'schedule', 'rule')
   * @param {object} formData - Form data to validate
   * @param {number} recordId - Record ID for updates
   * @returns {Promise<{isValid: boolean, errors: array, warnings: array}>}
   */
  async validateBusinessRules(formType, formData, recordId = null) {
    try {
      const response = await this.api.post('/api/validation/business-rules', {
        form_type: formType,
        form_data: formData,
        record_id: recordId
      });

      return response.data;
    } catch (error) {
      console.error('Business rules validation error:', error);
      return {
        isValid: true, // Allow submission on validation service error
        errors: [],
        warnings: ['Could not validate all business rules'],
        error: 'Validation service unavailable'
      };
    }
  }

  /**
   * Parse natural language rule text
   * @param {string} ruleText - Natural language rule description
   * @returns {Promise<{parsed: object, confidence: number}>}
   */
  async parseRule(ruleText) {
    try {
      const response = await this.api.post('/api/rules/parse', {
        rule_text: ruleText
      });

      return response.data;
    } catch (error) {
      console.error('Rule parsing error:', error);
      throw new Error('Could not parse rule text');
    }
  }

  /**
   * Validate phone number format and get formatted version
   * @param {string} phone - Phone number to validate
   * @returns {Promise<{valid: boolean, formatted: string}>}
   */
  async validatePhoneNumber(phone) {
    try {
      const response = await this.api.post('/api/validation/phone', {
        phone_number: phone
      });

      return response.data;
    } catch (error) {
      // Fallback to client-side validation
      const { validateAndFormatPhone } = await import('../utils/validation');
      return validateAndFormatPhone(phone);
    }
  }

  /**
   * Validate employee availability and calculate max possible hours
   * @param {object} availability - Availability object
   * @returns {object} - Validation result with max hours calculation
   */
  validateAvailabilityAndHours(availability) {
    if (!availability || typeof availability !== 'object') {
      return {
        isValid: false,
        errors: ['Availability data is required'],
        maxPossibleHours: 0
      };
    }

    const errors = [];
    let maxPossibleHours = 0;
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Check if at least one day is available
    const availableDays = daysOfWeek.filter(day =>
      availability[day] && availability[day].available
    );

    if (availableDays.length === 0) {
      errors.push('Employee must be available for at least one day');
    }

    // Validate each day and calculate total hours
    daysOfWeek.forEach(day => {
      const dayData = availability[day];
      if (dayData && dayData.available) {
        const { start, end } = dayData;

        if (!start || !end) {
          errors.push(`${day}: Start and end times are required`);
          return;
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(start) || !timeRegex.test(end)) {
          errors.push(`${day}: Invalid time format (use HH:MM)`);
          return;
        }

        // Validate time range
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        const startInMinutes = startHours * 60 + startMinutes;
        const endInMinutes = endHours * 60 + endMinutes;

        if (startInMinutes >= endInMinutes) {
          errors.push(`${day}: Start time must be before end time`);
          return;
        }

        // Add to total available hours
        maxPossibleHours += (endInMinutes - startInMinutes) / 60;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      maxPossibleHours: Math.round(maxPossibleHours * 10) / 10 // Round to 1 decimal
    };
  }

  /**
   * Client-side shift conflict detection
   * @param {object} newShift - New shift to check
   * @param {array} existingShifts - Existing shifts
   * @returns {object} - Conflict check result
   */
  checkShiftConflictsLocal(newShift, existingShifts) {
    return checkShiftConflicts(newShift, existingShifts);
  }

  /**
   * Client-side qualification validation
   * @param {array} employeeQualifications - Employee's qualifications
   * @param {array} requiredQualifications - Required qualifications
   * @returns {object} - Qualification check result
   */
  validateQualificationsLocal(employeeQualifications, requiredQualifications) {
    return validateEmployeeQualifications(employeeQualifications, requiredQualifications);
  }

  /**
   * Debounced async validation wrapper
   * @param {function} validationFn - Validation function
   * @param {number} delay - Debounce delay in ms
   * @returns {function} - Debounced function
   */
  debounce(validationFn, delay = 500) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      return new Promise((resolve) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await validationFn.apply(this, args);
            resolve(result);
          } catch (error) {
            resolve({ error: error.message });
          }
        }, delay);
      });
    };
  }

  /**
   * Batch validation for multiple fields
   * @param {array} validations - Array of validation requests
   * @returns {Promise<array>} - Array of validation results
   */
  async batchValidate(validations) {
    try {
      const promises = validations.map(async (validation) => {
        const { type, data, options } = validation;

        switch (type) {
          case 'email':
            return await this.checkEmailAvailability(data, options?.excludeEmployeeId);
          case 'schedule-conflicts':
            return await this.checkScheduleConflicts(data, options?.excludeScheduleId);
          case 'qualifications':
            return await this.validateEmployeeForShift(data.employeeId, data.shiftId);
          case 'phone':
            return await this.validatePhoneNumber(data);
          default:
            return { error: `Unknown validation type: ${type}` };
        }
      });

      return await Promise.all(promises);
    } catch (error) {
      console.error('Batch validation error:', error);
      return validations.map(() => ({ error: 'Validation failed' }));
    }
  }

  /**
   * Real-time validation for form fields
   * @param {string} fieldName - Field name
   * @param {any} value - Field value
   * @param {object} formData - Complete form data
   * @param {object} options - Validation options
   * @returns {Promise<{isValid: boolean, error?: string, warning?: string}>}
   */
  async validateField(fieldName, value, formData, options = {}) {
    try {
      switch (fieldName) {
        case 'email':
          if (!value) return { isValid: true };
          if (!validateEmail(value)) {
            return { isValid: false, error: 'Invalid email format' };
          }
          const emailCheck = await this.debounce(this.checkEmailAvailability, 500)(
            value,
            options.excludeEmployeeId
          );
          return {
            isValid: emailCheck.available,
            error: emailCheck.available ? null : 'Email is already in use',
            warning: emailCheck.suggestion ? `Did you mean: ${emailCheck.suggestion}?` : null
          };

        case 'maxHoursPerWeek':
          if (!value || !formData.availability) return { isValid: true };
          const availabilityCheck = this.validateAvailabilityAndHours(formData.availability);
          if (parseInt(value) > availabilityCheck.maxPossibleHours) {
            return {
              isValid: false,
              error: `Maximum hours (${value}) exceeds available hours (${availabilityCheck.maxPossibleHours})`
            };
          }
          return { isValid: true };

        case 'shiftId':
          if (!value || !formData.employeeId || !formData.date) return { isValid: true };
          const conflictCheck = await this.checkScheduleConflicts(formData, options.excludeScheduleId);
          return {
            isValid: !conflictCheck.hasConflicts,
            error: conflictCheck.hasConflicts ? 'Schedule conflicts detected' : null,
            warning: conflictCheck.conflicts?.length > 0 ? `${conflictCheck.conflicts.length} conflicts found` : null
          };

        default:
          return { isValid: true };
      }
    } catch (error) {
      console.error(`Field validation error for ${fieldName}:`, error);
      return { isValid: true, warning: 'Could not validate field' };
    }
  }
}

// Create singleton instance
const validationService = new ValidationService();

export default validationService;

// Named exports for specific functions
export const {
  checkEmailAvailability,
  checkScheduleConflicts,
  validateEmployeeForShift,
  validateBusinessRules,
  parseRule,
  validatePhoneNumber,
  validateAvailabilityAndHours,
  checkShiftConflictsLocal,
  validateQualificationsLocal,
  debounce,
  batchValidate,
  validateField
} = validationService;