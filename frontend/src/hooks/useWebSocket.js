/**
 * React hooks for WebSocket functionality
 * Provides easy-to-use hooks for real-time features
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import websocketManager from '../services/websocket';

/**
 * Main WebSocket hook for connection management
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(websocketManager.isConnected);
  const [connectionStatus, setConnectionStatus] = useState(websocketManager.getStatus());

  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setConnectionStatus(websocketManager.getStatus());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setConnectionStatus(websocketManager.getStatus());
    };

    websocketManager.addEventListener('connected', handleConnected);
    websocketManager.addEventListener('disconnected', handleDisconnected);

    return () => {
      websocketManager.removeEventListener('connected', handleConnected);
      websocketManager.removeEventListener('disconnected', handleDisconnected);
    };
  }, []);

  const connect = useCallback(async (token) => {
    try {
      await websocketManager.connect(token);
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    websocketManager.disconnect();
  }, []);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect
  };
}

/**
 * Hook for listening to specific WebSocket events
 */
export function useWebSocketEvent(eventType, callback, dependencies = []) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (data) => {
      callbackRef.current(data);
    };

    websocketManager.addEventListener(eventType, handler);

    return () => {
      websocketManager.removeEventListener(eventType, handler);
    };
  }, [eventType, ...dependencies]);
}

/**
 * Hook for managing room subscriptions
 */
export function useWebSocketRoom(roomName, autoJoin = true) {
  const [isInRoom, setIsInRoom] = useState(false);

  useEffect(() => {
    if (autoJoin && websocketManager.isConnected) {
      websocketManager.joinRoom(roomName);
      setIsInRoom(true);
    }

    return () => {
      if (isInRoom) {
        websocketManager.leaveRoom(roomName);
        setIsInRoom(false);
      }
    };
  }, [roomName, autoJoin, websocketManager.isConnected]);

  const joinRoom = useCallback(() => {
    websocketManager.joinRoom(roomName);
    setIsInRoom(true);
  }, [roomName]);

  const leaveRoom = useCallback(() => {
    websocketManager.leaveRoom(roomName);
    setIsInRoom(false);
  }, [roomName]);

  return {
    isInRoom,
    joinRoom,
    leaveRoom
  };
}

/**
 * Hook for real-time schedule updates
 */
export function useScheduleUpdates(scheduleId = null) {
  const [schedules, setSchedules] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useWebSocketRoom('schedules');

  useWebSocketEvent('schedule_created', (data) => {
    if (!scheduleId || data.schedule_id === scheduleId) {
      setSchedules(prev => [...prev, data.data]);
      setLastUpdate({ type: 'created', data });
    }
  });

  useWebSocketEvent('schedule_updated', (data) => {
    if (!scheduleId || data.schedule_id === scheduleId) {
      setSchedules(prev =>
        prev.map(schedule =>
          schedule.id === data.schedule_id
            ? { ...schedule, ...data.changes }
            : schedule
        )
      );
      setLastUpdate({ type: 'updated', data });
    }
  });

  useWebSocketEvent('schedule_deleted', (data) => {
    if (!scheduleId || data.schedule_id === scheduleId) {
      setSchedules(prev =>
        prev.filter(schedule => schedule.id !== data.schedule_id)
      );
      setLastUpdate({ type: 'deleted', data });
    }
  });

  return {
    schedules,
    lastUpdate,
    setSchedules
  };
}

/**
 * Hook for real-time employee status updates
 */
export function useEmployeeUpdates() {
  const [employees, setEmployees] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState([]);

  useWebSocketRoom('employees');

  useWebSocketEvent('employee_status_changed', (data) => {
    setEmployees(prev =>
      prev.map(employee =>
        employee.id === data.employee_id
          ? { ...employee, status: data.new_status }
          : employee
      )
    );
    setStatusUpdates(prev => [data, ...prev.slice(0, 9)]); // Keep last 10 updates
  });

  useWebSocketEvent('employee_availability_updated', (data) => {
    setEmployees(prev =>
      prev.map(employee =>
        employee.id === data.employee_id
          ? { ...employee, availability: data.availability }
          : employee
      )
    );
  });

  useWebSocketEvent('employee_shift_assigned', (data) => {
    setEmployees(prev =>
      prev.map(employee =>
        employee.id === data.employee_id
          ? {
              ...employee,
              assigned_shifts: [...(employee.assigned_shifts || []), data.shift_id]
            }
          : employee
      )
    );
  });

  return {
    employees,
    statusUpdates,
    setEmployees
  };
}

/**
 * Hook for real-time notifications
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useWebSocketEvent('notification_new', (data) => {
    const notification = {
      id: Date.now(),
      ...data.data,
      timestamp: data.timestamp,
      read: false
    };

    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  });

  useWebSocketEvent('notification_read', (data) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === data.notification_id
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  });

  const markAsRead = useCallback((notificationId) => {
    websocketManager.send('mark_notification_read', { notification_id: notificationId });
  }, []);

  const markAllAsRead = useCallback(() => {
    websocketManager.send('mark_all_notifications_read');
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    setNotifications
  };
}

/**
 * Hook for presence and online users
 */
export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userActivity, setUserActivity] = useState({});

  useWebSocketRoom('presence');

  useWebSocketEvent('user_connected', (data) => {
    setOnlineUsers(prev => {
      if (!prev.includes(data.user_id)) {
        return [...prev, data.user_id];
      }
      return prev;
    });
  });

  useWebSocketEvent('user_disconnected', (data) => {
    setOnlineUsers(prev => prev.filter(id => id !== data.user_id));
    setUserActivity(prev => {
      const updated = { ...prev };
      delete updated[data.user_id];
      return updated;
    });
  });

  useWebSocketEvent('user_editing', (data) => {
    setUserActivity(prev => ({
      ...prev,
      [data.user_id]: {
        type: 'editing',
        resource_type: data.resource_type,
        resource_id: data.resource_id,
        timestamp: data.timestamp
      }
    }));
  });

  useWebSocketEvent('user_typing', (data) => {
    setUserActivity(prev => ({
      ...prev,
      [data.user_id]: {
        type: 'typing',
        location: data.location,
        timestamp: data.timestamp
      }
    }));
  });

  useWebSocketEvent('user_stopped_editing', (data) => {
    setUserActivity(prev => {
      const updated = { ...prev };
      if (updated[data.user_id]?.type === 'editing') {
        delete updated[data.user_id];
      }
      return updated;
    });
  });

  useWebSocketEvent('user_stopped_typing', (data) => {
    setUserActivity(prev => {
      const updated = { ...prev };
      if (updated[data.user_id]?.type === 'typing') {
        delete updated[data.user_id];
      }
      return updated;
    });
  });

  return {
    onlineUsers,
    userActivity,
    setOnlineUsers
  };
}

/**
 * Hook for conflict alerts
 */
export function useConflictAlerts() {
  const [conflicts, setConflicts] = useState([]);
  const [activeConflicts, setActiveConflicts] = useState([]);

  useWebSocketRoom('conflicts');

  useWebSocketEvent('conflict_detected', (data) => {
    const conflict = {
      id: Date.now(),
      ...data.data,
      severity: data.severity,
      timestamp: data.timestamp,
      status: 'active'
    };

    setConflicts(prev => [conflict, ...prev]);
    setActiveConflicts(prev => [conflict, ...prev]);
  });

  useWebSocketEvent('conflict_resolved', (data) => {
    setActiveConflicts(prev =>
      prev.filter(conflict => conflict.id !== data.conflict_id)
    );

    setConflicts(prev =>
      prev.map(conflict =>
        conflict.id === data.conflict_id
          ? { ...conflict, status: 'resolved', resolution: data.resolution }
          : conflict
      )
    );
  });

  return {
    conflicts,
    activeConflicts,
    setConflicts
  };
}

/**
 * Hook for typing indicators
 */
export function useTypingIndicator(location) {
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);

  useWebSocketEvent('user_typing', (data) => {
    if (data.location === location) {
      setTypingUsers(prev => {
        if (!prev.includes(data.user_id)) {
          return [...prev, data.user_id];
        }
        return prev;
      });
    }
  });

  useWebSocketEvent('user_stopped_typing', (data) => {
    if (data.location === location) {
      setTypingUsers(prev => prev.filter(id => id !== data.user_id));
    }
  });

  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      websocketManager.sendTyping(location);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      websocketManager.stopTyping(location);
    }, 2000);
  }, [location, isTyping]);

  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      websocketManager.stopTyping(location);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [location, isTyping]);

  return {
    typingUsers,
    startTyping,
    stopTyping
  };
}