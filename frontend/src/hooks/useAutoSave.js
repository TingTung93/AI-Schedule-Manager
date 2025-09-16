import { useState, useEffect, useRef, useCallback } from 'react';
import { useErrorHandler } from './useErrorHandler';
import { reportUserAction } from '../utils/errorReporting';

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const STORAGE_PREFIX = 'autosave_';

export const useAutoSave = (
  key,
  data,
  saveFunction,
  options = {}
) => {
  const {
    interval = AUTO_SAVE_INTERVAL,
    immediate = false,
    enableLocalStorage = true,
    onSave = null,
    onRestore = null,
    onError = null
  } = options;

  const { handleApiError } = useErrorHandler();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localStorageData, setLocalStorageData] = useState(null);

  const saveTimeoutRef = useRef(null);
  const dataRef = useRef(data);
  const lastSavedDataRef = useRef(null);

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = lastSavedDataRef.current !== null &&
      JSON.stringify(data) !== JSON.stringify(lastSavedDataRef.current);
    setHasUnsavedChanges(hasChanges);
  }, [data]);

  // Load data from localStorage on mount
  useEffect(() => {
    if (enableLocalStorage && key) {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) {
        try {
          const parsedData = JSON.parse(stored);
          setLocalStorageData(parsedData);
        } catch (error) {
          console.error('Failed to parse autosaved data:', error);
          localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        }
      }
    }
  }, [key, enableLocalStorage]);

  // Save to localStorage
  const saveToLocalStorage = useCallback((dataToSave) => {
    if (!enableLocalStorage || !key) return;

    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${key}`,
        JSON.stringify({
          data: dataToSave,
          timestamp: Date.now(),
          version: 1
        })
      );
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [key, enableLocalStorage]);

  // Remove from localStorage
  const clearLocalStorage = useCallback(() => {
    if (!enableLocalStorage || !key) return;

    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      setLocalStorageData(null);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, [key, enableLocalStorage]);

  // Perform save operation
  const performSave = useCallback(async (dataToSave, isManual = false) => {
    if (!saveFunction) return;

    setIsSaving(true);

    try {
      await handleApiError(
        () => saveFunction(dataToSave),
        {
          serviceName: 'autosave',
          showNotification: isManual,
          enableRetry: true,
          onError: (error) => {
            if (onError) onError(error);
            // Save to localStorage as fallback
            saveToLocalStorage(dataToSave);
          }
        }
      );

      // Save successful
      lastSavedDataRef.current = dataToSave;
      setLastSaved(new Date());
      setHasUnsavedChanges(false);

      // Clear localStorage backup since we saved successfully
      clearLocalStorage();

      // Report success
      reportUserAction('autosave_success', {
        key,
        isManual,
        dataSize: JSON.stringify(dataToSave).length
      });

      if (onSave) onSave(dataToSave);

    } catch (error) {
      console.error('Autosave failed:', error);

      // Save to localStorage as fallback
      saveToLocalStorage(dataToSave);

      reportUserAction('autosave_failed', {
        key,
        isManual,
        error: error.message
      });

    } finally {
      setIsSaving(false);
    }
  }, [saveFunction, handleApiError, key, onSave, onError, saveToLocalStorage, clearLocalStorage]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (dataRef.current && hasUnsavedChanges) {
        performSave(dataRef.current, false);
      }
    }, interval);
  }, [interval, performSave, hasUnsavedChanges]);

  // Manual save
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    return performSave(dataRef.current, true);
  }, [performSave]);

  // Restore from localStorage
  const restoreFromLocalStorage = useCallback(() => {
    if (localStorageData && onRestore) {
      onRestore(localStorageData.data);
      reportUserAction('autosave_restore', {
        key,
        timestamp: localStorageData.timestamp
      });
    }
  }, [localStorageData, onRestore, key]);

  // Discard localStorage data
  const discardLocalStorage = useCallback(() => {
    clearLocalStorage();
    reportUserAction('autosave_discard', { key });
  }, [clearLocalStorage, key]);

  // Setup auto-save scheduling
  useEffect(() => {
    if (data && (hasUnsavedChanges || immediate)) {
      scheduleAutoSave();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, hasUnsavedChanges, immediate, scheduleAutoSave]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges && dataRef.current) {
        // Save to localStorage immediately
        saveToLocalStorage(dataRef.current);

        // Show confirmation dialog
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, saveToLocalStorage]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    localStorageData,
    saveNow,
    restoreFromLocalStorage,
    discardLocalStorage,
    clearLocalStorage
  };
};

// Hook for session recovery
export const useSessionRecovery = () => {
  const [hasRecoverableSession, setHasRecoverableSession] = useState(false);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    // Check for recoverable sessions on mount
    const keys = Object.keys(localStorage);
    const autosaveKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    if (autosaveKeys.length > 0) {
      const sessions = autosaveKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return {
            key: key.replace(STORAGE_PREFIX, ''),
            data: data.data,
            timestamp: data.timestamp,
            age: Date.now() - data.timestamp
          };
        } catch (error) {
          localStorage.removeItem(key);
          return null;
        }
      }).filter(Boolean);

      if (sessions.length > 0) {
        setHasRecoverableSession(true);
        setSessionData(sessions);
      }
    }
  }, []);

  const clearAllSessions = useCallback(() => {
    const keys = Object.keys(localStorage);
    const autosaveKeys = keys.filter(key => key.startsWith(STORAGE_PREFIX));

    autosaveKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    setHasRecoverableSession(false);
    setSessionData(null);
  }, []);

  const recoverSession = useCallback((sessionKey) => {
    const key = `${STORAGE_PREFIX}${sessionKey}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        localStorage.removeItem(key);

        // Update session list
        setSessionData(prev =>
          prev ? prev.filter(s => s.key !== sessionKey) : null
        );

        if (sessionData && sessionData.length <= 1) {
          setHasRecoverableSession(false);
        }

        return data.data;
      } catch (error) {
        console.error('Failed to recover session:', error);
        localStorage.removeItem(key);
      }
    }

    return null;
  }, [sessionData]);

  return {
    hasRecoverableSession,
    sessionData,
    clearAllSessions,
    recoverSession
  };
};