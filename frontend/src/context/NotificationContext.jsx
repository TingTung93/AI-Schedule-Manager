import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { persistState, restoreState } from '../utils/persistence';

const NotificationContext = createContext();

// Notification action types
const NOTIFICATION_ACTIONS = {
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  MARK_AS_READ: 'MARK_AS_READ',
  MARK_ALL_AS_READ: 'MARK_ALL_AS_READ',
  CLEAR_ALL: 'CLEAR_ALL',
  CLEAR_READ: 'CLEAR_READ',
  SET_PREFERENCES: 'SET_PREFERENCES',
  SET_PERMISSION_STATUS: 'SET_PERMISSION_STATUS',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  UPDATE_UNREAD_COUNT: 'UPDATE_UNREAD_COUNT',
  SET_SOUND_ENABLED: 'SET_SOUND_ENABLED',
  SET_DESKTOP_ENABLED: 'SET_DESKTOP_ENABLED',
  SET_EMAIL_ENABLED: 'SET_EMAIL_ENABLED',
  SNOOZE_NOTIFICATION: 'SNOOZE_NOTIFICATION',
  UNSNOOZE_NOTIFICATION: 'UNSNOOZE_NOTIFICATION',
};

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SCHEDULE_REMINDER: 'schedule_reminder',
  SCHEDULE_CONFLICT: 'schedule_conflict',
  SYSTEM: 'system',
  REAL_TIME: 'real_time',
};

// Notification priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

// Initial notification state
const initialState = {
  notifications: [],
  unreadCount: 0,

  // Preferences
  preferences: {
    sound: true,
    desktop: true,
    email: false,
    scheduleReminders: true,
    conflictAlerts: true,
    systemNotifications: true,
    realTimeUpdates: true,
    autoMarkAsRead: false,
    showPreview: true,
    groupSimilar: true,
    maxNotifications: 100,
    defaultSnoozeTime: 10, // minutes
  },

  // System state
  permissionStatus: 'default', // 'default' | 'granted' | 'denied'
  isConnected: false,
  soundEnabled: true,

  // Snooze tracking
  snoozedNotifications: new Map(),
};

// Notification reducer
function notificationReducer(state, action) {
  switch (action.type) {
    case NOTIFICATION_ACTIONS.ADD_NOTIFICATION:
      const newNotification = {
        id: action.payload.id || generateId(),
        type: action.payload.type || NOTIFICATION_TYPES.INFO,
        priority: action.payload.priority || NOTIFICATION_PRIORITIES.MEDIUM,
        title: action.payload.title,
        message: action.payload.message,
        timestamp: action.payload.timestamp || new Date().toISOString(),
        isRead: false,
        persistent: action.payload.persistent || false,
        actions: action.payload.actions || [],
        data: action.payload.data || {},
        category: action.payload.category || 'general',
        source: action.payload.source || 'app',
        expiresAt: action.payload.expiresAt,
        dismissible: action.payload.dismissible !== false,
      };

      const updatedNotifications = [newNotification, ...state.notifications];

      // Limit notifications count
      if (updatedNotifications.length > state.preferences.maxNotifications) {
        updatedNotifications.splice(state.preferences.maxNotifications);
      }

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: state.unreadCount + 1,
      };

    case NOTIFICATION_ACTIONS.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
        unreadCount: state.notifications.find(n => n.id === action.payload && !n.isRead)
          ? state.unreadCount - 1
          : state.unreadCount,
      };

    case NOTIFICATION_ACTIONS.MARK_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, isRead: true } : n
        ),
        unreadCount: state.notifications.find(n => n.id === action.payload && !n.isRead)
          ? state.unreadCount - 1
          : state.unreadCount,
      };

    case NOTIFICATION_ACTIONS.MARK_ALL_AS_READ:
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      };

    case NOTIFICATION_ACTIONS.CLEAR_ALL:
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      };

    case NOTIFICATION_ACTIONS.CLEAR_READ:
      const unreadNotifications = state.notifications.filter(n => !n.isRead);
      return {
        ...state,
        notifications: unreadNotifications,
      };

    case NOTIFICATION_ACTIONS.SET_PREFERENCES:
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };

    case NOTIFICATION_ACTIONS.SET_PERMISSION_STATUS:
      return {
        ...state,
        permissionStatus: action.payload,
      };

    case NOTIFICATION_ACTIONS.SET_CONNECTION_STATUS:
      return {
        ...state,
        isConnected: action.payload,
      };

    case NOTIFICATION_ACTIONS.UPDATE_UNREAD_COUNT:
      return {
        ...state,
        unreadCount: action.payload,
      };

    case NOTIFICATION_ACTIONS.SET_SOUND_ENABLED:
      return {
        ...state,
        soundEnabled: action.payload,
      };

    case NOTIFICATION_ACTIONS.SET_DESKTOP_ENABLED:
      return {
        ...state,
        preferences: { ...state.preferences, desktop: action.payload },
      };

    case NOTIFICATION_ACTIONS.SET_EMAIL_ENABLED:
      return {
        ...state,
        preferences: { ...state.preferences, email: action.payload },
      };

    case NOTIFICATION_ACTIONS.SNOOZE_NOTIFICATION:
      const snoozedNotifications = new Map(state.snoozedNotifications);
      snoozedNotifications.set(action.payload.id, {
        until: action.payload.until,
        originalNotification: state.notifications.find(n => n.id === action.payload.id),
      });

      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload.id),
        snoozedNotifications,
        unreadCount: state.notifications.find(n => n.id === action.payload.id && !n.isRead)
          ? state.unreadCount - 1
          : state.unreadCount,
      };

    case NOTIFICATION_ACTIONS.UNSNOOZE_NOTIFICATION:
      const updatedSnoozedNotifications = new Map(state.snoozedNotifications);
      const snoozedNotification = updatedSnoozedNotifications.get(action.payload);
      updatedSnoozedNotifications.delete(action.payload);

      if (snoozedNotification) {
        return {
          ...state,
          notifications: [snoozedNotification.originalNotification, ...state.notifications],
          snoozedNotifications: updatedSnoozedNotifications,
          unreadCount: !snoozedNotification.originalNotification.isRead
            ? state.unreadCount + 1
            : state.unreadCount,
        };
      }

      return {
        ...state,
        snoozedNotifications: updatedSnoozedNotifications,
      };

    default:
      return state;
  }
}

// Notification Provider Component
export function NotificationProvider({ children }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const wsRef = useRef(null);
  const snoozeTimeoutRef = useRef(new Map());

  // Restore notification state on mount
  useEffect(() => {
    const savedState = restoreState('notifications');
    if (savedState) {
      if (savedState.preferences) {
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_PREFERENCES,
          payload: savedState.preferences,
        });
      }

      // Don't restore actual notifications on reload to avoid spam
      // Only restore preferences and settings
    }
  }, []);

  // Persist notification preferences
  useEffect(() => {
    const stateToSave = {
      preferences: state.preferences,
    };

    persistState('notifications', stateToSave);
  }, [state.preferences]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      dispatch({
        type: NOTIFICATION_ACTIONS.SET_PERMISSION_STATUS,
        payload: Notification.permission,
      });

      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          dispatch({
            type: NOTIFICATION_ACTIONS.SET_PERMISSION_STATUS,
            payload: permission,
          });
        });
      }
    }
  }, []);

  // Setup WebSocket connection for real-time notifications
  useEffect(() => {
    if (!state.preferences.realTimeUpdates) return;

    const connectWebSocket = () => {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_CONNECTION_STATUS,
          payload: true,
        });
      };

      wsRef.current.onclose = () => {
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_CONNECTION_STATUS,
          payload: false,
        });

        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = () => {
        dispatch({
          type: NOTIFICATION_ACTIONS.SET_CONNECTION_STATUS,
          payload: false,
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          addNotification(notification);
        } catch (error) {
          console.error('Failed to parse notification:', error);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [state.preferences.realTimeUpdates]);

  // Handle snooze timeouts
  useEffect(() => {
    state.snoozedNotifications.forEach((snoozedData, id) => {
      const timeUntilUnsnooze = new Date(snoozedData.until).getTime() - Date.now();

      if (timeUntilUnsnooze > 0) {
        const timeoutId = setTimeout(() => {
          dispatch({
            type: NOTIFICATION_ACTIONS.UNSNOOZE_NOTIFICATION,
            payload: id,
          });
          snoozeTimeoutRef.current.delete(id);
        }, timeUntilUnsnooze);

        snoozeTimeoutRef.current.set(id, timeoutId);
      } else {
        // Immediately unsnooze if time has passed
        dispatch({
          type: NOTIFICATION_ACTIONS.UNSNOOZE_NOTIFICATION,
          payload: id,
        });
      }
    });

    return () => {
      snoozeTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      snoozeTimeoutRef.current.clear();
    };
  }, [state.snoozedNotifications]);

  // Auto-remove expired notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      state.notifications.forEach(notification => {
        if (notification.expiresAt && new Date(notification.expiresAt) < now) {
          removeNotification(notification.id);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.notifications]);

  // Notification functions
  const addNotification = (notificationData) => {
    const notification = {
      ...notificationData,
      id: notificationData.id || generateId(),
    };

    dispatch({
      type: NOTIFICATION_ACTIONS.ADD_NOTIFICATION,
      payload: notification,
    });

    // Show desktop notification if enabled and permitted
    if (state.preferences.desktop && state.permissionStatus === 'granted') {
      showDesktopNotification(notification);
    }

    // Play sound if enabled
    if (state.preferences.sound && state.soundEnabled) {
      playNotificationSound(notification.type);
    }

    // Auto-mark as read if enabled
    if (state.preferences.autoMarkAsRead) {
      setTimeout(() => {
        markAsRead(notification.id);
      }, 3000);
    }

    // Send email notification if enabled
    if (state.preferences.email && notification.priority === NOTIFICATION_PRIORITIES.URGENT) {
      sendEmailNotification(notification);
    }

    return notification.id;
  };

  const removeNotification = (id) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.REMOVE_NOTIFICATION,
      payload: id,
    });
  };

  const markAsRead = (id) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.MARK_AS_READ,
      payload: id,
    });
  };

  const markAllAsRead = () => {
    dispatch({ type: NOTIFICATION_ACTIONS.MARK_ALL_AS_READ });
  };

  const clearAll = () => {
    dispatch({ type: NOTIFICATION_ACTIONS.CLEAR_ALL });
  };

  const clearRead = () => {
    dispatch({ type: NOTIFICATION_ACTIONS.CLEAR_READ });
  };

  const updatePreferences = (preferences) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.SET_PREFERENCES,
      payload: preferences,
    });
  };

  const snoozeNotification = (id, minutes = state.preferences.defaultSnoozeTime) => {
    const until = new Date(Date.now() + minutes * 60 * 1000);
    dispatch({
      type: NOTIFICATION_ACTIONS.SNOOZE_NOTIFICATION,
      payload: { id, until },
    });
  };

  const unsnoozeNotification = (id) => {
    dispatch({
      type: NOTIFICATION_ACTIONS.UNSNOOZE_NOTIFICATION,
      payload: id,
    });
  };

  // Utility functions
  const showDesktopNotification = (notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === NOTIFICATION_PRIORITIES.URGENT,
      });

      desktopNotification.onclick = () => {
        window.focus();
        markAsRead(notification.id);
        desktopNotification.close();
      };

      // Auto-close after 5 seconds for non-urgent notifications
      if (notification.priority !== NOTIFICATION_PRIORITIES.URGENT) {
        setTimeout(() => {
          desktopNotification.close();
        }, 5000);
      }
    }
  };

  const playNotificationSound = (type) => {
    const audio = new Audio();

    switch (type) {
      case NOTIFICATION_TYPES.ERROR:
        audio.src = '/sounds/error.mp3';
        break;
      case NOTIFICATION_TYPES.SUCCESS:
        audio.src = '/sounds/success.mp3';
        break;
      case NOTIFICATION_TYPES.WARNING:
        audio.src = '/sounds/warning.mp3';
        break;
      case NOTIFICATION_TYPES.SCHEDULE_REMINDER:
        audio.src = '/sounds/reminder.mp3';
        break;
      default:
        audio.src = '/sounds/notification.mp3';
    }

    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore audio play errors (user interaction required)
    });
  };

  const sendEmailNotification = async (notification) => {
    try {
      await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  };

  // Convenience methods for different notification types
  const showSuccess = (title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      title,
      message,
      ...options,
    });
  };

  const showError = (title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      persistent: true,
      ...options,
    });
  };

  const showWarning = (title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      ...options,
    });
  };

  const showInfo = (title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.INFO,
      title,
      message,
      ...options,
    });
  };

  const showScheduleReminder = (title, message, scheduleData, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SCHEDULE_REMINDER,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      data: scheduleData,
      actions: [
        { label: 'View', action: 'view' },
        { label: 'Snooze', action: 'snooze' },
      ],
      ...options,
    });
  };

  const value = {
    ...state,
    // Core functions
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    clearRead,
    updatePreferences,
    snoozeNotification,
    unsnoozeNotification,
    // Convenience methods
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showScheduleReminder,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// Custom hook to use notification context
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Utility function to generate unique IDs
function generateId() {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default NotificationContext;