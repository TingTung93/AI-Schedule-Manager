import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing async data fetching with automatic error handling and retry logic
 *
 * @param {Function} asyncFunction - The async function to execute
 * @param {Array} dependencies - Dependencies array for re-fetching (like useEffect)
 * @param {Object} options - Configuration options
 * @param {boolean} options.immediate - Whether to execute immediately on mount (default: true)
 * @param {Function} options.onSuccess - Optional callback on successful data fetch
 * @param {Function} options.onError - Optional callback on error
 *
 * @returns {Object} - { data, loading, error, retry, retryCount, execute }
 */
const useAsyncData = (asyncFunction, dependencies = [], options = {}) => {
  const {
    immediate = true,
    onSuccess,
    onError
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Execute the async function
  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await asyncFunction();

      setData(result);

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      console.error('useAsyncData error:', err);
      setError(err);

      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction, onSuccess, onError]);

  // Retry function that increments retry count
  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    return execute();
  }, [execute]);

  // Execute on mount and when dependencies change
  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, retryCount]);

  return {
    data,
    loading,
    error,
    retry,
    retryCount,
    execute
  };
};

export default useAsyncData;
