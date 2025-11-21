import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for keyboard navigation support
 * @param {Array} items - Array of items to navigate
 * @param {Object} options - Configuration options
 * @param {Function} options.onSelect - Callback when item is selected
 * @param {Function} options.onClose - Callback when navigation is closed
 * @param {string} options.orientation - Navigation orientation ('vertical' or 'horizontal')
 * @returns {Object} - selectedIndex and setSelectedIndex
 */
export const useKeyboardNavigation = (items, { onSelect, onClose, orientation = 'vertical' } = {}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback((e) => {
    if (!items || items.length === 0) return;

    // Vertical navigation (default)
    if (orientation === 'vertical') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      }
    }
    // Horizontal navigation
    else {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      }
    }

    // Selection
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onSelect && items[selectedIndex]) {
        onSelect(items[selectedIndex], selectedIndex);
      }
    }

    // Close/Cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onClose) onClose();
    }

    // Jump to start
    if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    }

    // Jump to end
    if (e.key === 'End') {
      e.preventDefault();
      setSelectedIndex(items.length - 1);
    }

    // Page Up/Down for larger lists
    if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(0, prev - 10));
    }

    if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(items.length - 1, prev + 10));
    }
  }, [items, selectedIndex, onSelect, onClose, orientation]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selected index if items change
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items, selectedIndex]);

  return { selectedIndex, setSelectedIndex };
};

/**
 * Hook for managing focus within a container
 * @param {React.RefObject} containerRef - Reference to container element
 * @param {boolean} isActive - Whether keyboard navigation is active
 */
export const useKeyboardFocus = (containerRef, isActive = true) => {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [containerRef, isActive]);
};

export default useKeyboardNavigation;
