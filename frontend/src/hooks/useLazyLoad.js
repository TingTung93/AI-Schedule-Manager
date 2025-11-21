import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useLazyLoad Hook
 *
 * Custom hook for implementing infinite scroll and lazy loading of data.
 * Uses Intersection Observer API for efficient scroll detection.
 *
 * Features:
 * - Automatic data fetching on scroll
 * - Configurable threshold for trigger point
 * - Error handling and retry logic
 * - Loading state management
 *
 * @param {Function} fetchFn - Async function to fetch data (receives page number)
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Intersection threshold (0-1, default: 0.5)
 * @param {boolean} options.initialLoad - Whether to load data on mount (default: true)
 * @param {number} options.retryAttempts - Number of retry attempts on error (default: 3)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Object} Lazy load state and methods
 */
export const useLazyLoad = (
  fetchFn,
  {
    threshold = 0.5,
    initialLoad = true,
    retryAttempts = 3,
    retryDelay = 1000
  } = {}
) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const observerRef = useRef(null);
  const retryCountRef = useRef(0);

  /**
   * Load more data with retry logic
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      const newData = await fetchFn(page);

      if (!newData || newData.length === 0) {
        setHasMore(false);
      } else {
        setData(prev => [...prev, ...newData]);
        setPage(prev => prev + 1);
        retryCountRef.current = 0; // Reset retry count on success
      }
    } catch (err) {
      console.error('Lazy load error:', err);
      setError(err);

      // Retry logic
      if (retryCountRef.current < retryAttempts) {
        retryCountRef.current++;
        console.log(`Retrying... Attempt ${retryCountRef.current}/${retryAttempts}`);

        setTimeout(() => {
          setLoading(false);
          loadMore();
        }, retryDelay * retryCountRef.current);
      } else {
        setHasMore(false);
        retryCountRef.current = 0;
      }
    } finally {
      if (retryCountRef.current === 0) {
        setLoading(false);
      }
    }
  }, [fetchFn, page, loading, hasMore, retryAttempts, retryDelay]);

  /**
   * Initial data load
   */
  useEffect(() => {
    if (initialLoad && data.length === 0 && !loading) {
      loadMore();
    }
  }, [initialLoad]); // Only run on mount

  /**
   * Intersection Observer callback
   */
  const observerCallback = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  /**
   * Set up Intersection Observer
   */
  const setObserver = useCallback((node) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(observerCallback, {
      threshold,
      rootMargin: '50px' // Start loading slightly before reaching the element
    });

    // Observe new node
    if (node) {
      observerRef.current.observe(node);
    }
  }, [observerCallback, threshold]);

  /**
   * Reset all state and reload from beginning
   */
  const reset = useCallback(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    retryCountRef.current = 0;

    if (initialLoad) {
      // Trigger initial load after reset
      setTimeout(() => loadMore(), 0);
    }
  }, [initialLoad, loadMore]);

  /**
   * Manually trigger load (useful for pull-to-refresh)
   */
  const refresh = useCallback(() => {
    reset();
  }, [reset]);

  /**
   * Remove item from data
   */
  const removeItem = useCallback((predicate) => {
    setData(prev => prev.filter(item => !predicate(item)));
  }, []);

  /**
   * Update item in data
   */
  const updateItem = useCallback((predicate, updater) => {
    setData(prev => prev.map(item =>
      predicate(item) ? updater(item) : item
    ));
  }, []);

  /**
   * Add items programmatically
   */
  const addItems = useCallback((newItems) => {
    setData(prev => [...prev, ...newItems]);
  }, []);

  /**
   * Cleanup observer on unmount
   */
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    data,
    loading,
    hasMore,
    error,
    loadMore,
    setObserver,
    reset,
    refresh,
    removeItem,
    updateItem,
    addItems,
    // Utility getters
    isEmpty: data.length === 0 && !loading,
    totalItems: data.length
  };
};

export default useLazyLoad;
