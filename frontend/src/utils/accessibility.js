/**
 * Accessibility utility functions for WCAG 2.1 AA compliance
 */

/**
 * Generate descriptive ARIA labels based on component and context
 * @param {string} component - Component type (button, input, link, etc.)
 * @param {Object} context - Context information for generating label
 * @returns {string} - Generated ARIA label
 */
export const getAriaLabel = (component, context = {}) => {
  const labels = {
    button: {
      save: 'Save changes',
      cancel: 'Cancel and close',
      delete: `Delete ${context.item || 'item'}`,
      edit: `Edit ${context.item || 'item'}`,
      add: `Add new ${context.item || 'item'}`,
      next: 'Go to next step',
      previous: 'Go to previous step',
      submit: 'Submit form',
      close: 'Close dialog'
    },
    input: {
      search: 'Search input field',
      email: 'Email address input',
      password: 'Password input',
      text: `${context.label || 'Text'} input field`,
      date: 'Date picker',
      time: 'Time picker'
    },
    link: {
      external: `${context.text || 'Link'} (opens in new window)`,
      internal: context.text || 'Navigate to page',
      download: `Download ${context.file || 'file'}`
    }
  };

  return labels[component]?.[context.type] || context.label || 'Interactive element';
};

/**
 * Announce message to screen readers using ARIA live region
 * @param {string} message - Message to announce
 * @param {string} priority - Announcement priority ('polite' or 'assertive')
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  const liveRegion = document.getElementById('aria-live-region') || createLiveRegion();

  // Set the appropriate aria-live attribute
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;

  // Clear after 5 seconds to prevent stale announcements
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 5000);
};

/**
 * Create ARIA live region if it doesn't exist
 * @returns {HTMLElement} - Live region element
 */
const createLiveRegion = () => {
  const liveRegion = document.createElement('div');
  liveRegion.id = 'aria-live-region';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';
  document.body.appendChild(liveRegion);
  return liveRegion;
};

/**
 * Calculate relative luminance for color contrast
 * @param {string} color - Hex color code
 * @returns {number} - Relative luminance value
 */
const getRelativeLuminance = (color) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Check color contrast ratio and validate against WCAG standards
 * @param {string} foreground - Foreground color (hex)
 * @param {string} background - Background color (hex)
 * @returns {Object} - Contrast ratio and compliance information
 */
export const checkColorContrast = (foreground, background) => {
  const l1 = getRelativeLuminance(foreground);
  const l2 = getRelativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const contrastRatio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: contrastRatio.toFixed(2),
    meetsAA: contrastRatio >= 4.5,  // WCAG 2.1 AA for normal text
    meetsAALarge: contrastRatio >= 3,  // WCAG 2.1 AA for large text (18pt+)
    meetsAAA: contrastRatio >= 7,  // WCAG 2.1 AAA for normal text
    meetsAAALarge: contrastRatio >= 4.5  // WCAG 2.1 AAA for large text
  };
};

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container element to search within
 * @returns {NodeList} - List of focusable elements
 */
export const getFocusableElements = (container) => {
  if (!container) return [];

  return container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]), select:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
  );
};

/**
 * Check if an element is visible to screen readers
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - Whether element is visible to screen readers
 */
export const isVisibleToScreenReader = (element) => {
  if (!element) return false;

  const style = window.getComputedStyle(element);

  // Check if element is hidden
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  // Check ARIA hidden
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  return true;
};

/**
 * Generate unique ID for ARIA relationships
 * @param {string} prefix - Prefix for the ID
 * @returns {string} - Unique ID
 */
export const generateAriaId = (prefix = 'aria') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate form accessibility
 * @param {HTMLFormElement} form - Form element to validate
 * @returns {Object} - Validation results
 */
export const validateFormAccessibility = (form) => {
  const issues = [];

  if (!form) {
    return { valid: false, issues: ['Form element not found'] };
  }

  // Check for labels
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach((input, index) => {
    const label = form.querySelector(`label[for="${input.id}"]`);
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');

    if (!label && !ariaLabel && !ariaLabelledBy) {
      issues.push(`Input at index ${index} (type: ${input.type}) is missing a label`);
    }
  });

  // Check for required field indicators
  const requiredInputs = form.querySelectorAll('[required]');
  requiredInputs.forEach((input, index) => {
    const ariaRequired = input.getAttribute('aria-required');
    if (ariaRequired !== 'true') {
      issues.push(`Required input at index ${index} is missing aria-required="true"`);
    }
  });

  // Check for error messages
  const invalidInputs = form.querySelectorAll('[aria-invalid="true"]');
  invalidInputs.forEach((input, index) => {
    const ariaDescribedBy = input.getAttribute('aria-describedby');
    if (!ariaDescribedBy) {
      issues.push(`Invalid input at index ${index} is missing aria-describedby for error message`);
    }
  });

  return {
    valid: issues.length === 0,
    issues
  };
};

export default {
  getAriaLabel,
  announceToScreenReader,
  checkColorContrast,
  getFocusableElements,
  isVisibleToScreenReader,
  generateAriaId,
  validateFormAccessibility
};
