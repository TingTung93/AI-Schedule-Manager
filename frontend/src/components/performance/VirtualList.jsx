import { useRef, useState, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * VirtualList Component
 *
 * High-performance virtual scrolling component for rendering large lists.
 * Only renders visible items plus an overscan buffer to improve perceived performance.
 *
 * Performance benefits:
 * - Handles 1000+ items without performance degradation
 * - Constant memory usage regardless of list size
 * - Smooth 60fps scrolling
 *
 * @param {Array} items - Array of items to render
 * @param {number} itemHeight - Height of each item in pixels
 * @param {number} containerHeight - Height of the scrollable container
 * @param {Function} renderItem - Function to render each item
 * @param {number} overscan - Number of items to render outside visible area (default: 3)
 */
const VirtualList = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onScroll,
  className
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Calculate total height of all items
  const totalHeight = items.length * itemHeight;

  // Calculate which items are currently visible
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Get only the visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index
    }));
  }, [items, visibleRange]);

  const handleScroll = (e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);

    // Call optional external scroll handler
    if (onScroll) {
      onScroll(newScrollTop, visibleRange);
    }
  };

  // Expose scroll methods
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollToIndex = (index) => {
        const scrollTop = index * itemHeight;
        containerRef.current.scrollTop = scrollTop;
        setScrollTop(scrollTop);
      };
    }
  }, [itemHeight]);

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      sx={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform', // GPU acceleration
        contain: 'strict', // CSS containment for better performance
      }}
    >
      <Box
        sx={{
          height: totalHeight,
          position: 'relative',
          pointerEvents: 'none' // Prevent child events from bubbling
        }}
      >
        {visibleItems.map(({ item, index }) => (
          <Box
            key={item.id || index}
            sx={{
              position: 'absolute',
              top: index * itemHeight,
              height: itemHeight,
              width: '100%',
              pointerEvents: 'auto', // Re-enable events on items
              transform: 'translateZ(0)', // Force GPU layer
            }}
          >
            {renderItem(item, index)}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

VirtualList.propTypes = {
  items: PropTypes.array.isRequired,
  itemHeight: PropTypes.number.isRequired,
  containerHeight: PropTypes.number.isRequired,
  renderItem: PropTypes.func.isRequired,
  overscan: PropTypes.number,
  onScroll: PropTypes.func,
  className: PropTypes.string,
};

export default VirtualList;
