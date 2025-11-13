/**
 * Wizard Draft Persistence Utility
 *
 * Manages saving, loading, and clearing wizard draft data in localStorage.
 * Implements automatic expiration and version control for draft data.
 *
 * @module wizardDraft
 */

const STORAGE_KEY = 'wizard_draft';
const DRAFT_VERSION = '1.0';
const MAX_DRAFT_AGE_DAYS = 7;

/**
 * Save wizard data as a draft to localStorage
 *
 * @param {Object} wizardData - The complete wizard form data
 * @returns {boolean} Success status
 */
export const saveDraft = (wizardData) => {
  try {
    const draft = {
      ...wizardData,
      savedAt: new Date().toISOString(),
      version: DRAFT_VERSION
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    console.log('Draft saved successfully at', draft.savedAt);
    return true;
  } catch (error) {
    console.error('Failed to save draft:', error);
    // Handle quota exceeded or other localStorage errors
    if (error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Clearing old data...');
      clearDraft();
    }
    return false;
  }
};

/**
 * Load draft from localStorage with age validation
 *
 * @returns {Object|null} Draft data or null if no valid draft exists
 */
export const loadDraft = () => {
  try {
    const draftString = localStorage.getItem(STORAGE_KEY);

    if (!draftString) {
      return null;
    }

    const draft = JSON.parse(draftString);

    // Validate draft version
    if (draft.version !== DRAFT_VERSION) {
      console.warn('Draft version mismatch. Clearing old draft.');
      clearDraft();
      return null;
    }

    // Check if draft is too old (> 7 days)
    const savedAt = new Date(draft.savedAt);
    const daysOld = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld > MAX_DRAFT_AGE_DAYS) {
      console.warn(`Draft is ${Math.round(daysOld)} days old. Clearing expired draft.`);
      clearDraft();
      return null;
    }

    console.log('Draft loaded successfully from', draft.savedAt);
    return draft;

  } catch (error) {
    console.error('Failed to load draft:', error);
    // Clear corrupted data
    clearDraft();
    return null;
  }
};

/**
 * Clear draft data from localStorage
 */
export const clearDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Draft cleared successfully');
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
};

/**
 * Check if a valid draft exists
 *
 * @returns {boolean} True if draft exists
 */
export const hasDraft = () => {
  try {
    const draftString = localStorage.getItem(STORAGE_KEY);
    if (!draftString) {
      return false;
    }

    // Validate draft by attempting to load it
    const draft = loadDraft();
    return draft !== null;

  } catch (error) {
    console.error('Failed to check draft existence:', error);
    return false;
  }
};

/**
 * Get draft metadata without loading full draft
 *
 * @returns {Object|null} Draft metadata (savedAt, version, age)
 */
export const getDraftMetadata = () => {
  try {
    const draftString = localStorage.getItem(STORAGE_KEY);
    if (!draftString) {
      return null;
    }

    const draft = JSON.parse(draftString);
    const savedAt = new Date(draft.savedAt);
    const ageInDays = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

    return {
      savedAt: draft.savedAt,
      version: draft.version,
      ageInDays: Math.round(ageInDays * 10) / 10,
      scheduleName: draft.scheduleName || 'Untitled Schedule',
      department: draft.department || '',
      activeStep: draft.activeStep || 0
    };

  } catch (error) {
    console.error('Failed to get draft metadata:', error);
    return null;
  }
};

/**
 * Auto-save functionality with debouncing
 * Returns a function that can be called with wizard data
 *
 * @param {number} delay - Debounce delay in milliseconds (default: 2000)
 * @returns {Function} Debounced save function
 */
export const createAutoSave = (delay = 2000) => {
  let timeoutId = null;

  return (wizardData) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      saveDraft(wizardData);
    }, delay);
  };
};

export default {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  getDraftMetadata,
  createAutoSave
};
