// Central export for all custom hooks

export { useAuth } from './useAuth';
export { useApp } from './useApp';
export { useSchedule } from './useSchedule';
export { useNotifications } from './useNotifications';
export { useUndoRedo } from './useUndoRedo';
export { useOptimisticUpdates } from './useOptimisticUpdates';
export {
  useLocalStorage,
  useLocalStorageObject,
  useLocalStorageArray,
  useTempLocalStorage,
  useSecureLocalStorage
} from './useLocalStorage';

// Re-export context hooks with cleaner names
export { default as useAuthContext } from './useAuth';
export { default as useAppContext } from './useApp';
export { default as useScheduleContext } from './useSchedule';
export { default as useNotificationsContext } from './useNotifications';