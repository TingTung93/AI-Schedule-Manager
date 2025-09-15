import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { persistState, restoreState } from '../utils/persistence';

const AppContext = createContext();

// App action types
const APP_ACTIONS = {
  SET_THEME: 'SET_THEME',
  SET_LANGUAGE: 'SET_LANGUAGE',
  SET_TIMEZONE: 'SET_TIMEZONE',
  SET_DATE_FORMAT: 'SET_DATE_FORMAT',
  SET_TIME_FORMAT: 'SET_TIME_FORMAT',
  SET_FIRST_DAY_OF_WEEK: 'SET_FIRST_DAY_OF_WEEK',
  SET_NOTIFICATIONS_ENABLED: 'SET_NOTIFICATIONS_ENABLED',
  SET_SOUND_ENABLED: 'SET_SOUND_ENABLED',
  SET_SIDEBAR_COLLAPSED: 'SET_SIDEBAR_COLLAPSED',
  SET_VIEW_MODE: 'SET_VIEW_MODE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_ONLINE_STATUS: 'SET_ONLINE_STATUS',
  ADD_RECENT_SEARCH: 'ADD_RECENT_SEARCH',
  CLEAR_RECENT_SEARCHES: 'CLEAR_RECENT_SEARCHES',
  SET_USER_PREFERENCES: 'SET_USER_PREFERENCES',
  TOGGLE_DEBUG_MODE: 'TOGGLE_DEBUG_MODE',
};

// Initial app state
const initialState = {
  // Theme and appearance
  theme: 'light', // 'light' | 'dark' | 'auto'
  language: 'en',

  // Date and time preferences
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/dd/yyyy', // 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
  timeFormat: '12h', // '12h' | '24h'
  firstDayOfWeek: 0, // 0 = Sunday, 1 = Monday

  // Notification preferences
  notificationsEnabled: true,
  soundEnabled: true,

  // UI preferences
  sidebarCollapsed: false,
  viewMode: 'calendar', // 'calendar' | 'list' | 'agenda'

  // App state
  isLoading: false,
  error: null,
  isOnline: navigator.onLine,

  // User activity
  recentSearches: [],
  lastActivity: new Date().toISOString(),

  // Debug mode
  debugMode: process.env.NODE_ENV === 'development',

  // Performance tracking
  performanceMetrics: {
    renderTime: 0,
    apiCallsCount: 0,
    lastLoadTime: 0,
  },
};

// App reducer
function appReducer(state, action) {
  switch (action.type) {
    case APP_ACTIONS.SET_THEME:
      return {
        ...state,
        theme: action.payload,
      };

    case APP_ACTIONS.SET_LANGUAGE:
      return {
        ...state,
        language: action.payload,
      };

    case APP_ACTIONS.SET_TIMEZONE:
      return {
        ...state,
        timezone: action.payload,
      };

    case APP_ACTIONS.SET_DATE_FORMAT:
      return {
        ...state,
        dateFormat: action.payload,
      };

    case APP_ACTIONS.SET_TIME_FORMAT:
      return {
        ...state,
        timeFormat: action.payload,
      };

    case APP_ACTIONS.SET_FIRST_DAY_OF_WEEK:
      return {
        ...state,
        firstDayOfWeek: action.payload,
      };

    case APP_ACTIONS.SET_NOTIFICATIONS_ENABLED:
      return {
        ...state,
        notificationsEnabled: action.payload,
      };

    case APP_ACTIONS.SET_SOUND_ENABLED:
      return {
        ...state,
        soundEnabled: action.payload,
      };

    case APP_ACTIONS.SET_SIDEBAR_COLLAPSED:
      return {
        ...state,
        sidebarCollapsed: action.payload,
      };

    case APP_ACTIONS.SET_VIEW_MODE:
      return {
        ...state,
        viewMode: action.payload,
      };

    case APP_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case APP_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case APP_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case APP_ACTIONS.SET_ONLINE_STATUS:
      return {
        ...state,
        isOnline: action.payload,
      };

    case APP_ACTIONS.ADD_RECENT_SEARCH:
      const newSearches = [
        action.payload,
        ...state.recentSearches.filter(search => search !== action.payload)
      ].slice(0, 10); // Keep only last 10 searches

      return {
        ...state,
        recentSearches: newSearches,
      };

    case APP_ACTIONS.CLEAR_RECENT_SEARCHES:
      return {
        ...state,
        recentSearches: [],
      };

    case APP_ACTIONS.SET_USER_PREFERENCES:
      return {
        ...state,
        ...action.payload,
      };

    case APP_ACTIONS.TOGGLE_DEBUG_MODE:
      return {
        ...state,
        debugMode: !state.debugMode,
      };

    default:
      return state;
  }
}

// App Provider Component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Restore app state on mount
  useEffect(() => {
    const savedState = restoreState('app');
    if (savedState) {
      dispatch({
        type: APP_ACTIONS.SET_USER_PREFERENCES,
        payload: {
          ...savedState,
          isOnline: navigator.onLine, // Always use current online status
          lastActivity: new Date().toISOString(),
        },
      });
    }
  }, []);

  // Persist app state changes
  useEffect(() => {
    const stateToSave = {
      theme: state.theme,
      language: state.language,
      timezone: state.timezone,
      dateFormat: state.dateFormat,
      timeFormat: state.timeFormat,
      firstDayOfWeek: state.firstDayOfWeek,
      notificationsEnabled: state.notificationsEnabled,
      soundEnabled: state.soundEnabled,
      sidebarCollapsed: state.sidebarCollapsed,
      viewMode: state.viewMode,
      recentSearches: state.recentSearches,
      debugMode: state.debugMode,
    };

    persistState('app', stateToSave);
  }, [
    state.theme,
    state.language,
    state.timezone,
    state.dateFormat,
    state.timeFormat,
    state.firstDayOfWeek,
    state.notificationsEnabled,
    state.soundEnabled,
    state.sidebarCollapsed,
    state.viewMode,
    state.recentSearches,
    state.debugMode,
  ]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: APP_ACTIONS.SET_ONLINE_STATUS, payload: true });
    const handleOffline = () => dispatch({ type: APP_ACTIONS.SET_ONLINE_STATUS, payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (state.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', state.theme);
    }
  }, [state.theme]);

  // Action creators
  const setTheme = (theme) => {
    dispatch({ type: APP_ACTIONS.SET_THEME, payload: theme });
  };

  const setLanguage = (language) => {
    dispatch({ type: APP_ACTIONS.SET_LANGUAGE, payload: language });
  };

  const setTimezone = (timezone) => {
    dispatch({ type: APP_ACTIONS.SET_TIMEZONE, payload: timezone });
  };

  const setDateFormat = (format) => {
    dispatch({ type: APP_ACTIONS.SET_DATE_FORMAT, payload: format });
  };

  const setTimeFormat = (format) => {
    dispatch({ type: APP_ACTIONS.SET_TIME_FORMAT, payload: format });
  };

  const setFirstDayOfWeek = (day) => {
    dispatch({ type: APP_ACTIONS.SET_FIRST_DAY_OF_WEEK, payload: day });
  };

  const setNotificationsEnabled = (enabled) => {
    dispatch({ type: APP_ACTIONS.SET_NOTIFICATIONS_ENABLED, payload: enabled });
  };

  const setSoundEnabled = (enabled) => {
    dispatch({ type: APP_ACTIONS.SET_SOUND_ENABLED, payload: enabled });
  };

  const setSidebarCollapsed = (collapsed) => {
    dispatch({ type: APP_ACTIONS.SET_SIDEBAR_COLLAPSED, payload: collapsed });
  };

  const setViewMode = (mode) => {
    dispatch({ type: APP_ACTIONS.SET_VIEW_MODE, payload: mode });
  };

  const setLoading = (loading) => {
    dispatch({ type: APP_ACTIONS.SET_LOADING, payload: loading });
  };

  const setError = (error) => {
    dispatch({ type: APP_ACTIONS.SET_ERROR, payload: error });
  };

  const clearError = () => {
    dispatch({ type: APP_ACTIONS.CLEAR_ERROR });
  };

  const addRecentSearch = (search) => {
    dispatch({ type: APP_ACTIONS.ADD_RECENT_SEARCH, payload: search });
  };

  const clearRecentSearches = () => {
    dispatch({ type: APP_ACTIONS.CLEAR_RECENT_SEARCHES });
  };

  const toggleDebugMode = () => {
    dispatch({ type: APP_ACTIONS.TOGGLE_DEBUG_MODE });
  };

  // Utility functions
  const formatDate = (date, options = {}) => {
    const formatter = new Intl.DateTimeFormat(state.language, {
      timeZone: state.timezone,
      dateStyle: options.dateStyle || 'medium',
      timeStyle: options.timeStyle,
      ...options,
    });

    return formatter.format(new Date(date));
  };

  const formatTime = (date, options = {}) => {
    const formatter = new Intl.DateTimeFormat(state.language, {
      timeZone: state.timezone,
      hour12: state.timeFormat === '12h',
      hour: 'numeric',
      minute: '2-digit',
      ...options,
    });

    return formatter.format(new Date(date));
  };

  const value = {
    ...state,
    // Actions
    setTheme,
    setLanguage,
    setTimezone,
    setDateFormat,
    setTimeFormat,
    setFirstDayOfWeek,
    setNotificationsEnabled,
    setSoundEnabled,
    setSidebarCollapsed,
    setViewMode,
    setLoading,
    setError,
    clearError,
    addRecentSearch,
    clearRecentSearches,
    toggleDebugMode,
    // Utilities
    formatDate,
    formatTime,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use app context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;