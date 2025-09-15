// Local storage utilities for state persistence

const STORAGE_PREFIX = 'ai_schedule_manager_';
const STORAGE_VERSION = '1.0.0';

// Encryption key for sensitive data (in production, use proper key management)
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'default_key';

/**
 * Persist state to localStorage with optional encryption
 * @param {string} key - Storage key
 * @param {any} data - Data to persist
 * @param {Object} options - Storage options
 * @param {boolean} options.encrypt - Whether to encrypt the data
 * @param {number} options.ttl - Time to live in milliseconds
 * @param {boolean} options.compress - Whether to compress the data
 */
export function persistState(key, data, options = {}) {
  try {
    const {
      encrypt = false,
      ttl = null,
      compress = false,
    } = options;

    const storageKey = `${STORAGE_PREFIX}${key}`;

    const storageData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      ttl,
      data,
    };

    let serializedData = JSON.stringify(storageData);

    // Compress data if requested
    if (compress && window.CompressionStream) {
      serializedData = compressString(serializedData);
    }

    // Encrypt data if requested
    if (encrypt) {
      serializedData = encryptData(serializedData);
    }

    localStorage.setItem(storageKey, serializedData);

    // Set up TTL cleanup if specified
    if (ttl) {
      setTimeout(() => {
        removeState(key);
      }, ttl);
    }

    return true;
  } catch (error) {
    console.warn(`Failed to persist state for key "${key}":`, error);
    return false;
  }
}

/**
 * Restore state from localStorage with optional decryption
 * @param {string} key - Storage key
 * @param {Object} options - Restore options
 * @param {boolean} options.decrypt - Whether to decrypt the data
 * @param {boolean} options.decompress - Whether to decompress the data
 * @param {any} options.defaultValue - Default value if restore fails
 * @returns {any} Restored data or default value
 */
export function restoreState(key, options = {}) {
  try {
    const {
      decrypt = false,
      decompress = false,
      defaultValue = null,
    } = options;

    const storageKey = `${STORAGE_PREFIX}${key}`;
    let serializedData = localStorage.getItem(storageKey);

    if (!serializedData) {
      return defaultValue;
    }

    // Decrypt data if necessary
    if (decrypt) {
      serializedData = decryptData(serializedData);
    }

    // Decompress data if necessary
    if (decompress && window.DecompressionStream) {
      serializedData = decompressString(serializedData);
    }

    const storageData = JSON.parse(serializedData);

    // Check version compatibility
    if (storageData.version !== STORAGE_VERSION) {
      console.warn(`Version mismatch for key "${key}". Expected ${STORAGE_VERSION}, got ${storageData.version}`);
      // Handle migration here if needed
      return handleVersionMigration(key, storageData, defaultValue);
    }

    // Check TTL expiration
    if (storageData.ttl && Date.now() - storageData.timestamp > storageData.ttl) {
      removeState(key);
      return defaultValue;
    }

    return storageData.data;
  } catch (error) {
    console.warn(`Failed to restore state for key "${key}":`, error);
    return options.defaultValue || null;
  }
}

/**
 * Remove state from localStorage
 * @param {string} key - Storage key
 */
export function removeState(key) {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.warn(`Failed to remove state for key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all app-related data from localStorage
 */
export function clearAllState() {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    appKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    return true;
  } catch (error) {
    console.warn('Failed to clear all state:', error);
    return false;
  }
}

/**
 * Get storage usage information
 * @returns {Object} Storage usage statistics
 */
export function getStorageUsage() {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    let totalSize = 0;
    const keyDetails = {};

    appKeys.forEach(key => {
      const value = localStorage.getItem(key);
      const size = new Blob([value]).size;
      totalSize += size;

      keyDetails[key.replace(STORAGE_PREFIX, '')] = {
        size,
        lastModified: getLastModified(key),
      };
    });

    return {
      totalSize,
      totalKeys: appKeys.length,
      availableSpace: getAvailableSpace(),
      keyDetails,
    };
  } catch (error) {
    console.warn('Failed to get storage usage:', error);
    return null;
  }
}

/**
 * Backup all app state to a downloadable file
 * @returns {string} JSON string of all app state
 */
export function exportState() {
  try {
    const keys = Object.keys(localStorage);
    const appKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    const backup = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      data: {},
    };

    appKeys.forEach(key => {
      const cleanKey = key.replace(STORAGE_PREFIX, '');
      backup.data[cleanKey] = restoreState(cleanKey);
    });

    return JSON.stringify(backup, null, 2);
  } catch (error) {
    console.error('Failed to export state:', error);
    throw error;
  }
}

/**
 * Import state from a backup file
 * @param {string} backupData - JSON string of backup data
 * @param {Object} options - Import options
 * @param {boolean} options.merge - Whether to merge with existing data
 * @returns {boolean} Success status
 */
export function importState(backupData, options = {}) {
  try {
    const { merge = false } = options;
    const backup = JSON.parse(backupData);

    if (!backup.version || !backup.data) {
      throw new Error('Invalid backup format');
    }

    // Clear existing data if not merging
    if (!merge) {
      clearAllState();
    }

    // Import each key
    Object.entries(backup.data).forEach(([key, data]) => {
      if (data !== null && data !== undefined) {
        persistState(key, data);
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to import state:', error);
    return false;
  }
}

/**
 * Check if localStorage is available and working
 * @returns {boolean} Whether localStorage is available
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the last modified timestamp for a storage key
 * @param {string} key - Storage key
 * @returns {number|null} Timestamp or null
 */
function getLastModified(key) {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.timestamp || null;
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Get available localStorage space (approximate)
 * @returns {number} Available space in bytes
 */
function getAvailableSpace() {
  try {
    const testKey = '__space_test__';
    let testData = '';
    let maxSize = 0;

    // Binary search for maximum size
    let low = 0;
    let high = 10 * 1024 * 1024; // 10MB upper limit

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      testData = 'x'.repeat(mid);

      try {
        localStorage.setItem(testKey, testData);
        localStorage.removeItem(testKey);
        maxSize = mid;
        low = mid + 1;
      } catch (error) {
        high = mid - 1;
      }
    }

    return maxSize;
  } catch (error) {
    return 0;
  }
}

/**
 * Handle version migration for stored data
 * @param {string} key - Storage key
 * @param {Object} storageData - Stored data object
 * @param {any} defaultValue - Default value to return
 * @returns {any} Migrated data or default value
 */
function handleVersionMigration(key, storageData, defaultValue) {
  // Add migration logic here based on version differences
  // For now, return default value for any version mismatch
  console.warn(`No migration path available for key "${key}". Using default value.`);
  return defaultValue;
}

/**
 * Simple encryption function (for demo purposes only)
 * In production, use proper encryption libraries
 */
function encryptData(data) {
  // This is a simple XOR cipher for demo purposes
  // In production, use proper encryption like AES
  const key = ENCRYPTION_KEY;
  let result = '';

  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(
      data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }

  return btoa(result); // Base64 encode
}

/**
 * Simple decryption function (for demo purposes only)
 */
function decryptData(encryptedData) {
  try {
    const data = atob(encryptedData); // Base64 decode
    const key = ENCRYPTION_KEY;
    let result = '';

    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }

    return result;
  } catch (error) {
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Compress string data (placeholder for actual compression)
 */
function compressString(data) {
  // Placeholder for actual compression implementation
  // In production, use libraries like pako or browser's CompressionStream
  return data;
}

/**
 * Decompress string data (placeholder for actual decompression)
 */
function decompressString(data) {
  // Placeholder for actual decompression implementation
  return data;
}

// Default export for convenience
export default {
  persistState,
  restoreState,
  removeState,
  clearAllState,
  getStorageUsage,
  exportState,
  importState,
  isStorageAvailable,
};