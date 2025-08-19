import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for API calls with loading, error, and data states
 * @param {Function} apiCall - The API function to call
 * @param {Array} dependencies - Dependencies array for useEffect
 * @param {Object} options - Options for the hook
 * @returns {Object} - { data, loading, error, refetch }
 */
export const useApi = (apiCall, dependencies = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { 
    immediate = true, 
    onSuccess, 
    onError,
    retryCount = 0,
    retryDelay = 1000 
  } = options;

  const fetchData = useCallback(async (retries = retryCount) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchData(retries - 1), retryDelay);
      } else {
        setError(err.message || 'An error occurred');
        if (onError) onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, onSuccess, onError, retryCount, retryDelay]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, dependencies);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

/**
 * Custom hook for API mutations (POST, PUT, DELETE)
 * @param {Function} apiCall - The API function to call
 * @param {Object} options - Options for the hook
 * @returns {Object} - { mutate, data, loading, error, reset }
 */
export const useApiMutation = (apiCall, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { onSuccess, onError, onSettled } = options;

  const mutate = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall(...args);
      setData(result);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      if (onError) onError(err);
      throw err;
    } finally {
      setLoading(false);
      if (onSettled) onSettled();
    }
  }, [apiCall, onSuccess, onError, onSettled]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, data, loading, error, reset };
};

/**
 * Custom hook for paginated API calls
 * @param {Function} apiCall - The API function to call
 * @param {Object} options - Options for the hook
 * @returns {Object} - Pagination state and controls
 */
export const usePaginatedApi = (apiCall, options = {}) => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const { pageSize = 10, onSuccess, onError } = options;

  const fetchPage = useCallback(async (pageNum = page) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall({ page: pageNum, pageSize });
      
      if (pageNum === 1) {
        setData(result.items || result.data || []);
      } else {
        setData(prev => [...prev, ...(result.items || result.data || [])]);
      }
      
      setTotalPages(result.totalPages || Math.ceil(result.total / pageSize));
      setHasMore(pageNum < (result.totalPages || Math.ceil(result.total / pageSize)));
      setPage(pageNum);
      
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [apiCall, page, pageSize, onSuccess, onError]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPage(page + 1);
    }
  }, [fetchPage, loading, hasMore, page]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchPage(1);
  }, [fetchPage]);

  useEffect(() => {
    fetchPage(1);
  }, []);

  return {
    data,
    loading,
    error,
    page,
    totalPages,
    hasMore,
    loadMore,
    refresh,
    fetchPage
  };
};

/**
 * Custom hook for real-time data with polling
 * @param {Function} apiCall - The API function to call
 * @param {number} interval - Polling interval in milliseconds
 * @param {Object} options - Options for the hook
 * @returns {Object} - Real-time data state
 */
export const useRealTimeApi = (apiCall, interval = 5000, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  
  const { onUpdate, onError } = options;

  const fetchData = useCallback(async () => {
    try {
      const result = await apiCall();
      setData(prevData => {
        if (JSON.stringify(prevData) !== JSON.stringify(result)) {
          if (onUpdate) onUpdate(result, prevData);
        }
        return result;
      });
      setError(null);
      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [apiCall, onUpdate, onError]);

  useEffect(() => {
    fetchData();
    
    if (isPolling && interval > 0) {
      const timer = setInterval(fetchData, interval);
      return () => clearInterval(timer);
    }
  }, [fetchData, interval, isPolling]);

  const startPolling = useCallback(() => setIsPolling(true), []);
  const stopPolling = useCallback(() => setIsPolling(false), []);
  const refetch = useCallback(() => fetchData(), [fetchData]);

  return {
    data,
    loading,
    error,
    isPolling,
    startPolling,
    stopPolling,
    refetch
  };
};