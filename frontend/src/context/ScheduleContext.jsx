import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { persistState, restoreState } from '../utils/persistence';
import { createOptimisticUpdate, revertOptimisticUpdate } from '../utils/optimisticUpdates';

const ScheduleContext = createContext();

// Schedule action types
const SCHEDULE_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',

  // Schedule data actions
  SET_SCHEDULES: 'SET_SCHEDULES',
  ADD_SCHEDULE: 'ADD_SCHEDULE',
  UPDATE_SCHEDULE: 'UPDATE_SCHEDULE',
  DELETE_SCHEDULE: 'DELETE_SCHEDULE',

  // Optimistic updates
  OPTIMISTIC_ADD: 'OPTIMISTIC_ADD',
  OPTIMISTIC_UPDATE: 'OPTIMISTIC_UPDATE',
  OPTIMISTIC_DELETE: 'OPTIMISTIC_DELETE',
  REVERT_OPTIMISTIC: 'REVERT_OPTIMISTIC',

  // View and filter actions
  SET_SELECTED_DATE: 'SET_SELECTED_DATE',
  SET_DATE_RANGE: 'SET_DATE_RANGE',
  SET_VIEW_TYPE: 'SET_VIEW_TYPE',
  SET_FILTERS: 'SET_FILTERS',
  SET_SEARCH_QUERY: 'SET_SEARCH_QUERY',
  SET_SORT_BY: 'SET_SORT_BY',
  SET_SORT_ORDER: 'SET_SORT_ORDER',

  // Selection actions
  SET_SELECTED_SCHEDULES: 'SET_SELECTED_SCHEDULES',
  TOGGLE_SCHEDULE_SELECTION: 'TOGGLE_SCHEDULE_SELECTION',
  CLEAR_SELECTION: 'CLEAR_SELECTION',

  // Undo/Redo actions
  PUSH_TO_HISTORY: 'PUSH_TO_HISTORY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
};

// Initial schedule state
const initialState = {
  // Data
  schedules: [],
  optimisticUpdates: new Map(),

  // Loading and error states
  isLoading: false,
  error: null,

  // View state
  selectedDate: new Date(),
  dateRange: {
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  },
  viewType: 'week', // 'day' | 'week' | 'month' | 'agenda'

  // Filters and search
  filters: {
    categories: [],
    priorities: [],
    statuses: [],
    assignees: [],
    tags: [],
  },
  searchQuery: '',
  sortBy: 'startDate',
  sortOrder: 'asc', // 'asc' | 'desc'

  // Selection
  selectedSchedules: [],

  // Undo/Redo
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,

  // Cache
  lastFetch: null,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
};

// Schedule reducer
function scheduleReducer(state, action) {
  switch (action.type) {
    case SCHEDULE_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case SCHEDULE_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case SCHEDULE_ACTIONS.SET_SCHEDULES:
      return {
        ...state,
        schedules: action.payload,
        lastFetch: new Date().toISOString(),
        error: null,
        isLoading: false,
      };

    case SCHEDULE_ACTIONS.ADD_SCHEDULE:
      return {
        ...state,
        schedules: [...state.schedules, action.payload],
      };

    case SCHEDULE_ACTIONS.UPDATE_SCHEDULE:
      return {
        ...state,
        schedules: state.schedules.map(schedule =>
          schedule.id === action.payload.id ? { ...schedule, ...action.payload.updates } : schedule
        ),
      };

    case SCHEDULE_ACTIONS.DELETE_SCHEDULE:
      return {
        ...state,
        schedules: state.schedules.filter(schedule => schedule.id !== action.payload),
        selectedSchedules: state.selectedSchedules.filter(id => id !== action.payload),
      };

    case SCHEDULE_ACTIONS.OPTIMISTIC_ADD:
      const newOptimisticUpdates = new Map(state.optimisticUpdates);
      newOptimisticUpdates.set(action.payload.tempId, {
        type: 'add',
        data: action.payload,
        timestamp: Date.now(),
      });

      return {
        ...state,
        schedules: [...state.schedules, action.payload],
        optimisticUpdates: newOptimisticUpdates,
      };

    case SCHEDULE_ACTIONS.OPTIMISTIC_UPDATE:
      const updateOptimisticUpdates = new Map(state.optimisticUpdates);
      updateOptimisticUpdates.set(action.payload.id, {
        type: 'update',
        originalData: state.schedules.find(s => s.id === action.payload.id),
        data: action.payload.updates,
        timestamp: Date.now(),
      });

      return {
        ...state,
        schedules: state.schedules.map(schedule =>
          schedule.id === action.payload.id ? { ...schedule, ...action.payload.updates } : schedule
        ),
        optimisticUpdates: updateOptimisticUpdates,
      };

    case SCHEDULE_ACTIONS.OPTIMISTIC_DELETE:
      const deleteOptimisticUpdates = new Map(state.optimisticUpdates);
      const scheduleToDelete = state.schedules.find(s => s.id === action.payload);
      deleteOptimisticUpdates.set(action.payload, {
        type: 'delete',
        originalData: scheduleToDelete,
        timestamp: Date.now(),
      });

      return {
        ...state,
        schedules: state.schedules.filter(schedule => schedule.id !== action.payload),
        optimisticUpdates: deleteOptimisticUpdates,
      };

    case SCHEDULE_ACTIONS.REVERT_OPTIMISTIC:
      const revertOptimisticUpdates = new Map(state.optimisticUpdates);
      const optimisticUpdate = revertOptimisticUpdates.get(action.payload);
      revertOptimisticUpdates.delete(action.payload);

      if (!optimisticUpdate) return state;

      let revertedSchedules = [...state.schedules];

      switch (optimisticUpdate.type) {
        case 'add':
          revertedSchedules = revertedSchedules.filter(s => s.id !== action.payload);
          break;
        case 'update':
          revertedSchedules = revertedSchedules.map(schedule =>
            schedule.id === action.payload ? optimisticUpdate.originalData : schedule
          );
          break;
        case 'delete':
          revertedSchedules.push(optimisticUpdate.originalData);
          break;
      }

      return {
        ...state,
        schedules: revertedSchedules,
        optimisticUpdates: revertOptimisticUpdates,
      };

    case SCHEDULE_ACTIONS.SET_SELECTED_DATE:
      return {
        ...state,
        selectedDate: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_DATE_RANGE:
      return {
        ...state,
        dateRange: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_VIEW_TYPE:
      return {
        ...state,
        viewType: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_FILTERS:
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };

    case SCHEDULE_ACTIONS.SET_SEARCH_QUERY:
      return {
        ...state,
        searchQuery: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_SORT_BY:
      return {
        ...state,
        sortBy: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_SORT_ORDER:
      return {
        ...state,
        sortOrder: action.payload,
      };

    case SCHEDULE_ACTIONS.SET_SELECTED_SCHEDULES:
      return {
        ...state,
        selectedSchedules: action.payload,
      };

    case SCHEDULE_ACTIONS.TOGGLE_SCHEDULE_SELECTION:
      const isSelected = state.selectedSchedules.includes(action.payload);
      return {
        ...state,
        selectedSchedules: isSelected
          ? state.selectedSchedules.filter(id => id !== action.payload)
          : [...state.selectedSchedules, action.payload],
      };

    case SCHEDULE_ACTIONS.CLEAR_SELECTION:
      return {
        ...state,
        selectedSchedules: [],
      };

    case SCHEDULE_ACTIONS.PUSH_TO_HISTORY:
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        schedules: action.payload.schedules,
        timestamp: Date.now(),
        action: action.payload.action,
      });

      // Limit history size
      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift();
      }

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };

    case SCHEDULE_ACTIONS.UNDO:
      if (state.historyIndex <= 0) return state;

      const undoState = state.history[state.historyIndex - 1];
      return {
        ...state,
        schedules: undoState.schedules,
        historyIndex: state.historyIndex - 1,
      };

    case SCHEDULE_ACTIONS.REDO:
      if (state.historyIndex >= state.history.length - 1) return state;

      const redoState = state.history[state.historyIndex + 1];
      return {
        ...state,
        schedules: redoState.schedules,
        historyIndex: state.historyIndex + 1,
      };

    case SCHEDULE_ACTIONS.CLEAR_HISTORY:
      return {
        ...state,
        history: [],
        historyIndex: -1,
      };

    default:
      return state;
  }
}

// Schedule Provider Component
export function ScheduleProvider({ children }) {
  const [state, dispatch] = useReducer(scheduleReducer, initialState);
  const abortControllerRef = useRef(null);

  // Restore schedule state on mount
  useEffect(() => {
    const savedState = restoreState('schedule');
    if (savedState) {
      dispatch({
        type: SCHEDULE_ACTIONS.SET_FILTERS,
        payload: savedState.filters || initialState.filters,
      });
      dispatch({
        type: SCHEDULE_ACTIONS.SET_VIEW_TYPE,
        payload: savedState.viewType || initialState.viewType,
      });
      dispatch({
        type: SCHEDULE_ACTIONS.SET_SORT_BY,
        payload: savedState.sortBy || initialState.sortBy,
      });
      dispatch({
        type: SCHEDULE_ACTIONS.SET_SORT_ORDER,
        payload: savedState.sortOrder || initialState.sortOrder,
      });
    }
  }, []);

  // Persist schedule state changes
  useEffect(() => {
    const stateToSave = {
      filters: state.filters,
      viewType: state.viewType,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
    };

    persistState('schedule', stateToSave);
  }, [state.filters, state.viewType, state.sortBy, state.sortOrder]);

  // Cleanup optimistic updates after timeout
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      state.optimisticUpdates.forEach((update, id) => {
        if (now - update.timestamp > timeout) {
          dispatch({
            type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
            payload: id,
          });
        }
      });
    };

    const interval = setInterval(cleanup, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [state.optimisticUpdates]);

  // API functions
  const fetchSchedules = async (force = false) => {
    // Check cache validity
    if (!force && state.lastFetch) {
      const cacheAge = Date.now() - new Date(state.lastFetch).getTime();
      if (cacheAge < state.cacheExpiry) {
        return state.schedules;
      }
    }

    dispatch({ type: SCHEDULE_ACTIONS.SET_LOADING, payload: true });

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/schedules?include_assignments=true', {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
      }

      const data = await response.json();
      const schedules = data.schedules || [];

      dispatch({
        type: SCHEDULE_ACTIONS.SET_SCHEDULES,
        payload: schedules,
      });

      return schedules;
    } catch (error) {
      if (error.name !== 'AbortError') {
        dispatch({
          type: SCHEDULE_ACTIONS.SET_ERROR,
          payload: error.message,
        });
      }
      throw error;
    }
  };

  const addSchedule = async (scheduleData) => {
    const tempId = `temp_${Date.now()}`;
    const optimisticSchedule = {
      ...scheduleData,
      id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Push to history before making changes
    dispatch({
      type: SCHEDULE_ACTIONS.PUSH_TO_HISTORY,
      payload: {
        schedules: state.schedules,
        action: 'add',
      },
    });

    // Optimistic update
    dispatch({
      type: SCHEDULE_ACTIONS.OPTIMISTIC_ADD,
      payload: optimisticSchedule,
    });

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) {
        throw new Error('Failed to add schedule');
      }

      const newSchedule = await response.json();

      // Remove optimistic update and add real schedule
      dispatch({
        type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
        payload: tempId,
      });

      dispatch({
        type: SCHEDULE_ACTIONS.ADD_SCHEDULE,
        payload: newSchedule,
      });

      return newSchedule;
    } catch (error) {
      // Revert optimistic update on error
      dispatch({
        type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
        payload: tempId,
      });

      dispatch({
        type: SCHEDULE_ACTIONS.SET_ERROR,
        payload: error.message,
      });

      throw error;
    }
  };

  const updateSchedule = async (id, updates) => {
    // Push to history before making changes
    dispatch({
      type: SCHEDULE_ACTIONS.PUSH_TO_HISTORY,
      payload: {
        schedules: state.schedules,
        action: 'update',
      },
    });

    // Optimistic update
    dispatch({
      type: SCHEDULE_ACTIONS.OPTIMISTIC_UPDATE,
      payload: { id, updates },
    });

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update schedule');
      }

      const updatedSchedule = await response.json();

      // Remove optimistic update and apply real update
      dispatch({
        type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
        payload: id,
      });

      dispatch({
        type: SCHEDULE_ACTIONS.UPDATE_SCHEDULE,
        payload: { id, updates: updatedSchedule },
      });

      return updatedSchedule;
    } catch (error) {
      // Revert optimistic update on error
      dispatch({
        type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
        payload: id,
      });

      dispatch({
        type: SCHEDULE_ACTIONS.SET_ERROR,
        payload: error.message,
      });

      throw error;
    }
  };

  const deleteSchedule = async (id) => {
    // Push to history before making changes
    dispatch({
      type: SCHEDULE_ACTIONS.PUSH_TO_HISTORY,
      payload: {
        schedules: state.schedules,
        action: 'delete',
      },
    });

    // Optimistic update
    dispatch({
      type: SCHEDULE_ACTIONS.OPTIMISTIC_DELETE,
      payload: id,
    });

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete schedule');
      }

      // Confirm deletion
      dispatch({
        type: SCHEDULE_ACTIONS.DELETE_SCHEDULE,
        payload: id,
      });

      return true;
    } catch (error) {
      // Revert optimistic update on error
      dispatch({
        type: SCHEDULE_ACTIONS.REVERT_OPTIMISTIC,
        payload: id,
      });

      dispatch({
        type: SCHEDULE_ACTIONS.SET_ERROR,
        payload: error.message,
      });

      throw error;
    }
  };

  // Action creators
  const setSelectedDate = (date) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_SELECTED_DATE, payload: date });
  };

  const setDateRange = (range) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_DATE_RANGE, payload: range });
  };

  const setViewType = (viewType) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_VIEW_TYPE, payload: viewType });
  };

  const setFilters = (filters) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_FILTERS, payload: filters });
  };

  const setSearchQuery = (query) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_SEARCH_QUERY, payload: query });
  };

  const setSortBy = (sortBy) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_SORT_BY, payload: sortBy });
  };

  const setSortOrder = (order) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_SORT_ORDER, payload: order });
  };

  const setSelectedSchedules = (schedules) => {
    dispatch({ type: SCHEDULE_ACTIONS.SET_SELECTED_SCHEDULES, payload: schedules });
  };

  const toggleScheduleSelection = (id) => {
    dispatch({ type: SCHEDULE_ACTIONS.TOGGLE_SCHEDULE_SELECTION, payload: id });
  };

  const clearSelection = () => {
    dispatch({ type: SCHEDULE_ACTIONS.CLEAR_SELECTION });
  };

  const clearError = () => {
    dispatch({ type: SCHEDULE_ACTIONS.CLEAR_ERROR });
  };

  const undo = () => {
    dispatch({ type: SCHEDULE_ACTIONS.UNDO });
  };

  const redo = () => {
    dispatch({ type: SCHEDULE_ACTIONS.REDO });
  };

  const clearHistory = () => {
    dispatch({ type: SCHEDULE_ACTIONS.CLEAR_HISTORY });
  };

  // Computed values
  const filteredSchedules = React.useMemo(() => {
    let filtered = [...state.schedules];

    // Apply search filter
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(schedule =>
        schedule.title?.toLowerCase().includes(query) ||
        schedule.description?.toLowerCase().includes(query) ||
        schedule.notes?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (state.filters.statuses.length > 0) {
      filtered = filtered.filter(schedule =>
        state.filters.statuses.includes(schedule.status)
      );
    }

    // Apply assignee filter (check assignments for employee IDs)
    if (state.filters.assignees.length > 0) {
      filtered = filtered.filter(schedule =>
        schedule.assignments?.some(assignment =>
          state.filters.assignees.includes(assignment.employeeId || assignment.employee_id)
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[state.sortBy];
      let bValue = b[state.sortBy];

      // Handle date fields
      if (state.sortBy === 'weekStart' || state.sortBy === 'week_start') {
        aValue = new Date(a.weekStart || a.week_start);
        bValue = new Date(b.weekStart || b.week_start);
      } else if (state.sortBy === 'createdAt' || state.sortBy === 'created_at') {
        aValue = new Date(a.createdAt || a.created_at);
        bValue = new Date(b.createdAt || b.created_at);
      }

      if (state.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [state.schedules, state.searchQuery, state.filters, state.sortBy, state.sortOrder]);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const value = {
    ...state,
    filteredSchedules,
    canUndo,
    canRedo,
    // API functions
    fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    // Actions
    setSelectedDate,
    setDateRange,
    setViewType,
    setFilters,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setSelectedSchedules,
    toggleScheduleSelection,
    clearSelection,
    clearError,
    undo,
    redo,
    clearHistory,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

// Custom hook to use schedule context
export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}

export default ScheduleContext;