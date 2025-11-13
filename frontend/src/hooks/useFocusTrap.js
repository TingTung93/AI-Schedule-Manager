import { useEffect, useRef } from 'react';

/**
 * Hook to trap focus within a container (e.g., modal dialogs)
 * Ensures keyboard users can't tab outside the container
 * @param {boolean} isActive - Whether focus trap is active
 * @param {Function} onClose - Callback when Escape is pressed
 * @returns {React.RefObject} - Ref to attach to container element
 */
export const useFocusTrap = (isActive = true, onClose = null) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the element that was focused before opening the trap
    previousActiveElement.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const getFocusableElements = () => {
      return container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
    };

    // Focus first focusable element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle tab key to trap focus
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // If no focusable elements, prevent default
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        // Shift + Tab on first element -> focus last
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        // Tab on last element -> focus first
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }

      // Handle Escape key
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup: restore focus to previous element
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Return focus to the element that had focus before
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, onClose]);

  return containerRef;
};

/**
 * Enhanced focus trap with auto-focus management
 * @param {Object} options - Configuration options
 * @param {boolean} options.isActive - Whether focus trap is active
 * @param {Function} options.onClose - Callback when Escape is pressed
 * @param {boolean} options.autoFocus - Auto-focus first element (default: true)
 * @param {boolean} options.restoreFocus - Restore focus on close (default: true)
 * @param {string} options.initialFocusSelector - CSS selector for initial focus element
 */
export const useFocusTrapAdvanced = ({
  isActive = true,
  onClose = null,
  autoFocus = true,
  restoreFocus = true,
  initialFocusSelector = null
} = {}) => {
  const containerRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Store previous focus
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement;
    }

    // Auto-focus logic
    if (autoFocus) {
      let elementToFocus = null;

      // Try to find custom initial focus element
      if (initialFocusSelector) {
        elementToFocus = container.querySelector(initialFocusSelector);
      }

      // Fallback to first focusable element
      if (!elementToFocus) {
        const focusableElements = container.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        elementToFocus = focusableElements[0];
      }

      if (elementToFocus) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => elementToFocus.focus(), 0);
      }
    }

    return () => {
      // Restore focus on cleanup
      if (restoreFocus && previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, autoFocus, restoreFocus, initialFocusSelector]);

  return containerRef;
};

export default useFocusTrap;
