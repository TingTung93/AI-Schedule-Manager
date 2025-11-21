import { useState, useEffect } from 'react';

/**
 * Custom hook to detect online/offline status
 *
 * @returns {boolean} isOnline - Whether the browser is online
 */
const useOnlineStatus = () => {
  // Initialize with the current online status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    // Event handlers
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Application is online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Application is offline');
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export default useOnlineStatus;
