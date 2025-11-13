import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * useVirtualScroll Hook
 *
 * Custom hook for implementing virtual scrolling with dynamic item heights.
 * Provides advanced features like scroll-to-index and performance tracking.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.items - Array of items to virtualize
 * @param {number|Function} options.itemHeight - Fixed height or function to calculate height
 * @param {number} options.containerHeight - Height of scrollable container
 * @param {number} options.overscan - Number of items to render outside visible area
 * @param {Function} options.onRangeChange - Callback when visible range changes
 * @returns {Object} Virtual scroll state and methods
 */
export const useVirtualScroll = ({
  items = [],
  itemHeight,
  containerHeight,
  overscan = 3,
  onRangeChange
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const renderCountRef = useRef(0);

  // Support both fixed and dynamic item heights
  const getItemHeight = useCallback((index) => {
    if (typeof itemHeight === 'function') {
      return itemHeight(items[index], index);
    }
    return itemHeight;
  }, [itemHeight, items]);

  // Calculate item positions for dynamic heights
  const itemOffsets = useMemo(() => {
    const offsets = [0];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      totalHeight += height;
      offsets.push(totalHeight);
    }

    return offsets;
  }, [items, getItemHeight]);

  const totalHeight = itemOffsets[itemOffsets.length - 1] || 0;

  // Binary search to find first visible item
  const findStartIndex = useCallback((scrollTop) => {
    let low = 0;
    let high = itemOffsets.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (itemOffsets[mid] < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return Math.max(0, low - 1);
  }, [itemOffsets]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = findStartIndex(scrollTop);
    let end = start;
    let accumulatedHeight = 0;

    while (end < items.length && accumulatedHeight < containerHeight) {
      accumulatedHeight += getItemHeight(end);
      end++;
    }

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan)
    };
  }, [scrollTop, containerHeight, items.length, overscan, findStartIndex, getItemHeight]);

  // Get visible items with their positions
  const visibleItems = useMemo(() => {
    const result = [];

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      result.push({
        item: items[i],
        index: i,
        offset: itemOffsets[i],
        height: getItemHeight(i)
      });
    }

    renderCountRef.current++;

    return result;
  }, [items, visibleRange, itemOffsets, getItemHeight]);

  // Throttled scroll handler
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set timeout to detect scroll end
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Scroll to specific index
  const scrollToIndex = useCallback((index, align = 'start') => {
    if (!containerRef.current || index < 0 || index >= items.length) return;

    const offset = itemOffsets[index];
    const itemHeight = getItemHeight(index);

    let scrollTop = offset;

    if (align === 'center') {
      scrollTop = offset - (containerHeight - itemHeight) / 2;
    } else if (align === 'end') {
      scrollTop = offset - containerHeight + itemHeight;
    }

    containerRef.current.scrollTop = Math.max(0, Math.min(scrollTop, totalHeight - containerHeight));
  }, [items.length, itemOffsets, getItemHeight, containerHeight, totalHeight]);

  // Scroll to specific offset
  const scrollToOffset = useCallback((offset) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = Math.max(0, Math.min(offset, totalHeight - containerHeight));
  }, [totalHeight, containerHeight]);

  // Track performance metrics
  const getMetrics = useCallback(() => {
    return {
      totalItems: items.length,
      visibleItems: visibleRange.end - visibleRange.start,
      renderCount: renderCountRef.current,
      scrollTop,
      totalHeight,
      scrollPercentage: totalHeight > 0 ? (scrollTop / (totalHeight - containerHeight)) * 100 : 0
    };
  }, [items.length, visibleRange, scrollTop, totalHeight, containerHeight]);

  // Notify when visible range changes
  useEffect(() => {
    if (onRangeChange) {
      onRangeChange(visibleRange);
    }
  }, [visibleRange, onRangeChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    containerRef,
    visibleItems,
    visibleRange,
    totalHeight,
    scrollTop,
    isScrolling,
    handleScroll,
    scrollToIndex,
    scrollToOffset,
    getMetrics
  };
};

export default useVirtualScroll;
