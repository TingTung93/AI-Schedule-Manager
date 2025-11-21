import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * ARIA Live Region component for screen reader announcements
 * Provides real-time updates to assistive technologies
 * WCAG 2.1 Success Criterion 4.1.3 (Level AA)
 */
const LiveRegion = ({ message, priority = 'polite', autoClean = true, cleanDelay = 5000 }) => {
  const [currentMessage, setCurrentMessage] = useState('');

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);

      // Auto-clear message after delay
      if (autoClean) {
        const timer = setTimeout(() => {
          setCurrentMessage('');
        }, cleanDelay);

        return () => clearTimeout(timer);
      }
    }
  }, [message, autoClean, cleanDelay]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap'
      }}
    >
      {currentMessage}
    </div>
  );
};

LiveRegion.propTypes = {
  message: PropTypes.string,
  priority: PropTypes.oneOf(['polite', 'assertive', 'off']),
  autoClean: PropTypes.bool,
  cleanDelay: PropTypes.number
};

/**
 * Hook to manage live region announcements
 */
export const useLiveRegion = (priority = 'polite') => {
  const [message, setMessage] = useState('');

  const announce = (newMessage) => {
    setMessage(newMessage);
  };

  const clear = () => {
    setMessage('');
  };

  return { message, announce, clear };
};

/**
 * Global Live Region Manager
 * Provides a singleton pattern for managing app-wide announcements
 */
export class LiveRegionManager {
  static instance = null;
  static listeners = new Set();

  static getInstance() {
    if (!LiveRegionManager.instance) {
      LiveRegionManager.instance = new LiveRegionManager();
    }
    return LiveRegionManager.instance;
  }

  subscribe(callback) {
    LiveRegionManager.listeners.add(callback);
    return () => LiveRegionManager.listeners.delete(callback);
  }

  announce(message, priority = 'polite') {
    LiveRegionManager.listeners.forEach(listener => {
      listener({ message, priority, timestamp: Date.now() });
    });
  }
}

/**
 * Global Live Region Component
 * Renders announcements from the LiveRegionManager
 */
export const GlobalLiveRegion = () => {
  const [announcement, setAnnouncement] = useState({ message: '', priority: 'polite' });

  useEffect(() => {
    const manager = LiveRegionManager.getInstance();
    const unsubscribe = manager.subscribe(setAnnouncement);
    return unsubscribe;
  }, []);

  return <LiveRegion message={announcement.message} priority={announcement.priority} />;
};

export default LiveRegion;
