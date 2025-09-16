/**
 * Comprehensive validation utilities for the AI Schedule Manager
 * Provides email, phone, password, date/time, and business rule validation
 */

/**
 * Email validation using regex pattern
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(String(email).toLowerCase());
};

/**
 * Phone number formatting and validation
 * Supports US phone number formats: (123) 456-7890, 123-456-7890, 1234567890
 * @param {string} phone - Phone number to validate
 * @returns {object} - {isValid: boolean, formatted: string}
 */
export const validateAndFormatPhone = (phone) => {
  if (!phone) return { isValid: true, formatted: '' }; // Phone is optional

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Check if it's a valid US phone number (10 or 11 digits)
  if (digits.length === 10) {
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return { isValid: true, formatted };
  } else if (digits.length === 11 && digits[0] === '1') {
    const formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return { isValid: true, formatted };
  }

  return { isValid: false, formatted: phone };
};

/**
 * Password strength checker
 * @param {string} password - Password to check
 * @returns {object} - {score: number (0-4), feedback: string[], isValid: boolean}
 */
export const checkPasswordStrength = (password) => {
  if (!password) return { score: 0, feedback: ['Password is required'], isValid: false };

  let score = 0;
  const feedback = [];

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password must be at least 8 characters long');
  }

  // Uppercase letter
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain at least one lowercase letter');
  }

  // Number
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain at least one number');
  }

  // Special character
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain at least one special character');
  }

  return {
    score: Math.min(score, 4),
    feedback,
    isValid: score >= 4,
    strength: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(score, 4)]
  };
};

/**
 * Date validation utility
 * @param {string|Date} date - Date to validate
 * @param {object} options - Validation options
 * @returns {object} - {isValid: boolean, error: string}
 */
export const validateDate = (date, options = {}) => {
  const {
    allowPast = false,
    allowFuture = true,
    minDate = null,
    maxDate = null,
    required = true
  } = options;

  if (!date) {
    return {
      isValid: !required,
      error: required ? 'Date is required' : null
    };
  }

  const dateObj = new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      error: 'Invalid date format'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateObj.setHours(0, 0, 0, 0);

  // Check past dates
  if (!allowPast && dateObj < today) {
    return {
      isValid: false,
      error: 'Date cannot be in the past'
    };
  }

  // Check future dates
  if (!allowFuture && dateObj > today) {
    return {
      isValid: false,
      error: 'Date cannot be in the future'
    };
  }

  // Check min date
  if (minDate && dateObj < new Date(minDate)) {
    return {
      isValid: false,
      error: `Date must be after ${new Date(minDate).toLocaleDateString()}`
    };
  }

  // Check max date
  if (maxDate && dateObj > new Date(maxDate)) {
    return {
      isValid: false,
      error: `Date must be before ${new Date(maxDate).toLocaleDateString()}`
    };
  }

  return { isValid: true, error: null };
};

/**
 * Time validation utility
 * @param {string} time - Time in HH:MM format
 * @param {object} options - Validation options
 * @returns {object} - {isValid: boolean, error: string}
 */
export const validateTime = (time, options = {}) => {
  const { required = true, minTime = null, maxTime = null } = options;

  if (!time) {
    return {
      isValid: !required,
      error: required ? 'Time is required' : null
    };
  }

  // Validate HH:MM format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return {
      isValid: false,
      error: 'Time must be in HH:MM format'
    };
  }

  const [hours, minutes] = time.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;

  // Check min time
  if (minTime) {
    const [minHours, minMinutes] = minTime.split(':').map(Number);
    const minTimeInMinutes = minHours * 60 + minMinutes;
    if (timeInMinutes < minTimeInMinutes) {
      return {
        isValid: false,
        error: `Time must be after ${minTime}`
      };
    }
  }

  // Check max time
  if (maxTime) {
    const [maxHours, maxMinutes] = maxTime.split(':').map(Number);
    const maxTimeInMinutes = maxHours * 60 + maxMinutes;
    if (timeInMinutes > maxTimeInMinutes) {
      return {
        isValid: false,
        error: `Time must be before ${maxTime}`
      };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Time range validation (start time before end time)
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {object} - {isValid: boolean, error: string}
 */
export const validateTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) {
    return { isValid: false, error: 'Both start and end times are required' };
  }

  const startValidation = validateTime(startTime);
  const endValidation = validateTime(endTime);

  if (!startValidation.isValid) return startValidation;
  if (!endValidation.isValid) return endValidation;

  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  const startInMinutes = startHours * 60 + startMinutes;
  const endInMinutes = endHours * 60 + endMinutes;

  if (startInMinutes >= endInMinutes) {
    return {
      isValid: false,
      error: 'Start time must be before end time'
    };
  }

  return { isValid: true, error: null };
};

/**
 * Hourly rate validation
 * @param {number|string} rate - Hourly rate to validate
 * @param {object} options - Validation options
 * @returns {object} - {isValid: boolean, error: string}
 */
export const validateHourlyRate = (rate, options = {}) => {
  const { min = 0, max = 200, required = false } = options;

  if (!rate && rate !== 0) {
    return {
      isValid: !required,
      error: required ? 'Hourly rate is required' : null
    };
  }

  const numericRate = parseFloat(rate);

  if (isNaN(numericRate)) {
    return {
      isValid: false,
      error: 'Hourly rate must be a valid number'
    };
  }

  if (numericRate < min) {
    return {
      isValid: false,
      error: `Hourly rate must be at least $${min}`
    };
  }

  if (numericRate > max) {
    return {
      isValid: false,
      error: `Hourly rate cannot exceed $${max}`
    };
  }

  return { isValid: true, error: null };
};

/**
 * Business rule: Validate employee availability conflicts
 * @param {object} availability - Availability object with days and times
 * @returns {object} - {isValid: boolean, errors: string[]}
 */
export const validateAvailability = (availability) => {
  const errors = [];

  if (!availability || typeof availability !== 'object') {
    return {
      isValid: false,
      errors: ['Availability data is required']
    };
  }

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Check if at least one day is available
  const availableDays = daysOfWeek.filter(day =>
    availability[day] && availability[day].available
  );

  if (availableDays.length === 0) {
    errors.push('Employee must be available for at least one day');
  }

  // Validate each available day's time range
  availableDays.forEach(day => {
    const dayData = availability[day];
    if (dayData && dayData.available) {
      const timeRangeValidation = validateTimeRange(dayData.start, dayData.end);
      if (!timeRangeValidation.isValid) {
        errors.push(`${day}: ${timeRangeValidation.error}`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Business rule: Validate max hours per week
 * @param {number} maxHours - Maximum hours per week
 * @param {object} availability - Employee availability
 * @returns {object} - {isValid: boolean, error: string}
 */
export const validateMaxHoursPerWeek = (maxHours, availability) => {
  if (!maxHours && maxHours !== 0) {
    return {
      isValid: false,
      error: 'Maximum hours per week is required'
    };
  }

  const numericHours = parseInt(maxHours);

  if (isNaN(numericHours) || numericHours <= 0) {
    return {
      isValid: false,
      error: 'Maximum hours must be a positive number'
    };
  }

  if (numericHours > 168) {
    return {
      isValid: false,
      error: 'Maximum hours cannot exceed 168 (24 hours × 7 days)'
    };
  }

  // Calculate maximum possible hours based on availability
  if (availability) {
    let maxPossibleHours = 0;
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    daysOfWeek.forEach(day => {
      const dayData = availability[day];
      if (dayData && dayData.available && dayData.start && dayData.end) {
        const [startHours, startMinutes] = dayData.start.split(':').map(Number);
        const [endHours, endMinutes] = dayData.end.split(':').map(Number);
        const startInMinutes = startHours * 60 + startMinutes;
        const endInMinutes = endHours * 60 + endMinutes;
        maxPossibleHours += (endInMinutes - startInMinutes) / 60;
      }
    });

    if (numericHours > maxPossibleHours) {
      return {
        isValid: false,
        error: `Maximum hours (${numericHours}) exceeds available hours (${maxPossibleHours.toFixed(1)}) based on availability`
      };
    }
  }

  return { isValid: true, error: null };
};

/**
 * Business rule: Check for shift time conflicts
 * @param {object} newShift - New shift object with date, startTime, endTime
 * @param {array} existingShifts - Array of existing shifts for the employee
 * @returns {object} - {hasConflict: boolean, conflicts: array}
 */
export const checkShiftConflicts = (newShift, existingShifts = []) => {
  const conflicts = [];

  if (!newShift || !newShift.date || !newShift.startTime || !newShift.endTime) {
    return { hasConflict: false, conflicts };
  }

  const newDate = new Date(newShift.date).toDateString();
  const [newStartHours, newStartMinutes] = newShift.startTime.split(':').map(Number);
  const [newEndHours, newEndMinutes] = newShift.endTime.split(':').map(Number);
  const newStartInMinutes = newStartHours * 60 + newStartMinutes;
  const newEndInMinutes = newEndHours * 60 + newEndMinutes;

  existingShifts.forEach(shift => {
    const shiftDate = new Date(shift.date).toDateString();

    // Only check shifts on the same date
    if (shiftDate === newDate) {
      const [shiftStartHours, shiftStartMinutes] = shift.startTime.split(':').map(Number);
      const [shiftEndHours, shiftEndMinutes] = shift.endTime.split(':').map(Number);
      const shiftStartInMinutes = shiftStartHours * 60 + shiftStartMinutes;
      const shiftEndInMinutes = shiftEndHours * 60 + shiftEndMinutes;

      // Check for overlap
      if (
        (newStartInMinutes < shiftEndInMinutes && newEndInMinutes > shiftStartInMinutes) ||
        (shiftStartInMinutes < newEndInMinutes && shiftEndInMinutes > newStartInMinutes)
      ) {
        conflicts.push({
          shiftId: shift.id,
          conflictTime: `${shift.startTime} - ${shift.endTime}`,
          date: shift.date
        });
      }
    }
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
};

/**
 * Business rule: Validate employee qualifications for a shift
 * @param {array} employeeQualifications - Employee's qualifications
 * @param {array} requiredQualifications - Required qualifications for the shift
 * @returns {object} - {isQualified: boolean, missingQualifications: array}
 */
export const validateEmployeeQualifications = (employeeQualifications = [], requiredQualifications = []) => {
  const missingQualifications = requiredQualifications.filter(
    required => !employeeQualifications.includes(required)
  );

  return {
    isQualified: missingQualifications.length === 0,
    missingQualifications
  };
};

/**
 * Custom error formatter for form validation
 * @param {object} errors - Form errors object
 * @returns {array} - Array of formatted error messages
 */
export const formatValidationErrors = (errors) => {
  const errorMessages = [];

  const processError = (error, path = '') => {
    if (typeof error === 'string') {
      errorMessages.push(error);
    } else if (error && typeof error === 'object') {
      if (error.message) {
        errorMessages.push(error.message);
      } else {
        Object.keys(error).forEach(key => {
          const newPath = path ? `${path}.${key}` : key;
          processError(error[key], newPath);
        });
      }
    }
  };

  if (errors && typeof errors === 'object') {
    Object.keys(errors).forEach(key => {
      processError(errors[key], key);
    });
  }

  return errorMessages;
};

/**
 * Debounced validation function
 * @param {function} validationFn - Validation function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {function} - Debounced validation function
 */
export const debounceValidation = (validationFn, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(validationFn(...args));
      }, delay);
    });
  };
};

export default {
  validateEmail,
  validateAndFormatPhone,
  checkPasswordStrength,
  validateDate,
  validateTime,
  validateTimeRange,
  validateHourlyRate,
  validateAvailability,
  validateMaxHoursPerWeek,
  checkShiftConflicts,
  validateEmployeeQualifications,
  formatValidationErrors,
  debounceValidation
};