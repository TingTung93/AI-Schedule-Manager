/**
 * Services Index
 *
 * Centralized export for all API services and utilities.
 * This provides a clean import interface for components.
 *
 * Usage:
 *   import apiClient, { getErrorMessage, tokenManager } from '@/services';
 *   import departmentService from '@/services/departmentService';
 */

// Core API client and utilities
export { default as apiClient } from './api';
export {
  getErrorMessage,
  errorHandler,
  tokenManager,
  transformUtils,
  withTimeout,
  healthCheck
} from './api';

// Domain-specific services
export { default as departmentService } from './departmentService';
export { default as validationService } from './validationService';
export { default as websocket } from './websocket';

// Default export for convenience
export { default } from './api';
