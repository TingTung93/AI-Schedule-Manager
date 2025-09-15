import { useState, useEffect, useCallback } from 'react';
import { persistState, restoreState, removeState } from '../utils/persistence';

/**
 * Custom hook for localStorage with React state sync
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if nothing in storage
 * @param {Object} options - Storage options
 * @returns {Array} [value, setValue, removeValue]
 */
export function useLocalStorage(key, defaultValue, options = {}) {
  const [value, setValue] = useState(() => {
    return restoreState(key, { defaultValue, ...options });
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Update value and persist to localStorage
   */
  const setStoredValue = useCallback((newValue) => {
    try {
      setIsLoading(true);
      setError(null);

      // Allow value to be a function for functional updates
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;

      setValue(valueToStore);

      // Persist to localStorage
      if (valueToStore === undefined || valueToStore === null) {
        removeState(key);
      } else {
        persistState(key, valueToStore, options);
      }
    } catch (err) {
      setError(err);
      console.error(`Failed to set localStorage key "${key}":`, err);
    } finally {
      setIsLoading(false);
    }
  }, [key, value, options]);

  /**
   * Remove value from both state and localStorage
   */
  const removeStoredValue = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      setValue(defaultValue);
      removeState(key);
    } catch (err) {
      setError(err);
      console.error(`Failed to remove localStorage key "${key}":`, err);
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue]);

  /**
   * Refresh value from localStorage
   */
  const refreshValue = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const storedValue = restoreState(key, { defaultValue, ...options });
      setValue(storedValue);
    } catch (err) {
      setError(err);
      console.error(`Failed to refresh localStorage key "${key}":`, err);
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue, options]);

  return [
    value,
    setStoredValue,
    removeStoredValue,
    {
      isLoading,
      error,
      refresh: refreshValue,
    }
  ];
}

/**
 * Hook for storing objects with deep merge capability
 */
export function useLocalStorageObject(key, defaultValue = {}, options = {}) {
  const [value, setValue, removeValue, meta] = useLocalStorage(key, defaultValue, options);

  /**
   * Update specific properties of the object
   */
  const updateObject = useCallback((updates) => {
    if (typeof updates === 'function') {
      setValue(currentValue => ({
        ...currentValue,
        ...updates(currentValue),
      }));
    } else {
      setValue(currentValue => ({
        ...currentValue,
        ...updates,
      }));
    }
  }, [setValue]);

  /**
   * Set a specific property
   */
  const setProperty = useCallback((property, propertyValue) => {
    setValue(currentValue => ({
      ...currentValue,
      [property]: propertyValue,
    }));
  }, [setValue]);

  /**
   * Remove a specific property
   */
  const removeProperty = useCallback((property) => {
    setValue(currentValue => {
      const newValue = { ...currentValue };
      delete newValue[property];
      return newValue;
    });
  }, [setValue]);

  return [
    value,
    setValue,
    removeValue,
    {
      ...meta,
      updateObject,
      setProperty,
      removeProperty,
    }
  ];
}

/**
 * Hook for storing arrays with helper methods
 */
export function useLocalStorageArray(key, defaultValue = [], options = {}) {
  const [value, setValue, removeValue, meta] = useLocalStorage(key, defaultValue, options);

  /**
   * Add item to array
   */
  const addItem = useCallback((item) => {
    setValue(currentArray => [...currentArray, item]);
  }, [setValue]);

  /**
   * Remove item from array by index
   */
  const removeItem = useCallback((index) => {
    setValue(currentArray => currentArray.filter((_, i) => i !== index));
  }, [setValue]);

  /**
   * Remove item from array by value
   */
  const removeItemByValue = useCallback((item) => {
    setValue(currentArray => currentArray.filter(arrayItem => arrayItem !== item));
  }, [setValue]);

  /**
   * Update item at specific index
   */
  const updateItem = useCallback((index, newItem) => {
    setValue(currentArray => currentArray.map((item, i) => i === index ? newItem : item));
  }, [setValue]);

  /**
   * Clear all items
   */
  const clearItems = useCallback(() => {
    setValue([]);
  }, [setValue]);

  /**
   * Filter items
   */
  const filterItems = useCallback((predicate) => {
    setValue(currentArray => currentArray.filter(predicate));
  }, [setValue]);

  return [
    value,
    setValue,
    removeValue,
    {
      ...meta,
      addItem,
      removeItem,
      removeItemByValue,
      updateItem,
      clearItems,
      filterItems,
    }
  ];
}

/**
 * Hook for temporary storage with TTL
 */
export function useTempLocalStorage(key, defaultValue, ttlMinutes = 60) {
  const options = {
    ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
  };

  return useLocalStorage(key, defaultValue, options);
}

/**
 * Hook for encrypted storage (for sensitive data)
 */
export function useSecureLocalStorage(key, defaultValue) {
  const options = {
    encrypt: true,
  };

  return useLocalStorage(key, defaultValue, options);
}

export default useLocalStorage;