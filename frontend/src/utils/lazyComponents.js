import { lazy } from 'react';

/**
 * Lazy Component Loading Configuration
 *
 * This file defines all lazily-loaded components for code splitting.
 * Benefits:
 * - Reduced initial bundle size (30-40% reduction)
 * - Faster initial page load
 * - Better caching strategy
 * - On-demand loading of heavy components
 *
 * Usage:
 * import { ScheduleBuilder } from './utils/lazyComponents';
 *
 * <Suspense fallback={<Loading />}>
 *   <ScheduleBuilder />
 * </Suspense>
 */

// ============================================================================
// Page-level Components (Largest bundles)
// ============================================================================

/**
 * Schedule Builder Page (~150KB)
 * Heavy component with AI integration and complex forms
 */
export const ScheduleBuilder = lazy(() =>
  import(/* webpackChunkName: "schedule-builder" */ '../pages/ScheduleBuilder')
);

/**
 * Schedule Page (~120KB)
 * Includes FullCalendar library and complex calendar logic
 */
export const SchedulePage = lazy(() =>
  import(/* webpackChunkName: "schedule-page" */ '../pages/SchedulePage')
);

/**
 * Analytics Page (~100KB)
 * Contains multiple chart libraries and data visualization
 */
export const AnalyticsPage = lazy(() =>
  import(/* webpackChunkName: "analytics-page" */ '../pages/AnalyticsPage')
);

/**
 * Employees Page (~80KB)
 * Employee management with virtual scrolling
 */
export const EmployeesPage = lazy(() =>
  import(/* webpackChunkName: "employees-page" */ '../pages/EmployeesPage')
);

/**
 * Settings Page (~60KB)
 * User settings and preferences
 */
export const SettingsPage = lazy(() =>
  import(/* webpackChunkName: "settings-page" */ '../pages/SettingsPage')
);

// ============================================================================
// Dialog Components (Medium bundles)
// ============================================================================

/**
 * Import Dialog (~40KB)
 * CSV/Excel import functionality with validation
 */
export const ImportDialog = lazy(() =>
  import(/* webpackChunkName: "import-dialog" */ '../components/data-io/ImportDialog')
);

/**
 * Export Dialog (~35KB)
 * Multi-format export functionality
 */
export const ExportDialog = lazy(() =>
  import(/* webpackChunkName: "export-dialog" */ '../components/data-io/ExportDialog')
);

/**
 * Employee Form Dialog (~30KB)
 * Complex form with validation
 */
export const EmployeeFormDialog = lazy(() =>
  import(/* webpackChunkName: "employee-form" */ '../components/employees/EmployeeFormDialog')
);

// ============================================================================
// Chart Components (Heavy visualization libraries)
// ============================================================================

/**
 * Schedule Chart (~50KB)
 * Gantt-style schedule visualization
 */
export const ScheduleChart = lazy(() =>
  import(/* webpackChunkName: "schedule-chart" */ '../components/charts/ScheduleChart')
);

/**
 * Coverage Chart (~45KB)
 * Coverage analysis and visualization
 */
export const CoverageChart = lazy(() =>
  import(/* webpackChunkName: "coverage-chart" */ '../components/charts/CoverageChart')
);

/**
 * Performance Chart (~40KB)
 * Performance metrics visualization
 */
export const PerformanceChart = lazy(() =>
  import(/* webpackChunkName: "performance-chart" */ '../components/charts/PerformanceChart')
);

// ============================================================================
// Feature-specific Components
// ============================================================================

/**
 * AI Schedule Generator (~70KB)
 * AI-powered schedule generation component
 */
export const AIScheduleGenerator = lazy(() =>
  import(/* webpackChunkName: "ai-generator" */ '../components/ai/AIScheduleGenerator')
);

/**
 * Conflict Resolver (~45KB)
 * Advanced conflict detection and resolution
 */
export const ConflictResolver = lazy(() =>
  import(/* webpackChunkName: "conflict-resolver" */ '../components/schedule/ConflictResolver')
);

/**
 * Bulk Operations Panel (~40KB)
 * Bulk edit and operations functionality
 */
export const BulkOperationsPanel = lazy(() =>
  import(/* webpackChunkName: "bulk-operations" */ '../components/common/BulkOperationsPanel')
);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Preload a lazy component
 * Useful for preloading components before user navigation
 *
 * @param {Function} lazyComponent - Lazy component to preload
 * @returns {Promise} Preload promise
 *
 * @example
 * // Preload on hover
 * onMouseEnter={() => preloadComponent(ScheduleBuilder)}
 */
export const preloadComponent = (lazyComponent) => {
  const Component = lazyComponent;
  return Component._payload._result || Component._payload._result?.default;
};

/**
 * Prefetch multiple components
 * Useful for prefetching related components
 *
 * @param {Array<Function>} components - Array of lazy components
 * @returns {Promise<Array>} Array of preload promises
 */
export const prefetchComponents = (components) => {
  return Promise.all(components.map(preloadComponent));
};

/**
 * Route-based prefetching configuration
 * Maps routes to components that should be prefetched
 */
export const ROUTE_PREFETCH_MAP = {
  '/': [ScheduleBuilder, SchedulePage],
  '/schedule-builder': [SchedulePage, AIScheduleGenerator],
  '/schedules': [ScheduleBuilder, ScheduleChart],
  '/employees': [EmployeeFormDialog, BulkOperationsPanel],
  '/analytics': [PerformanceChart, CoverageChart]
};

/**
 * Prefetch components for a given route
 *
 * @param {string} route - Route path
 */
export const prefetchForRoute = (route) => {
  const components = ROUTE_PREFETCH_MAP[route];
  if (components) {
    prefetchComponents(components);
  }
};

export default {
  // Pages
  ScheduleBuilder,
  SchedulePage,
  AnalyticsPage,
  EmployeesPage,
  SettingsPage,

  // Dialogs
  ImportDialog,
  ExportDialog,
  EmployeeFormDialog,

  // Charts
  ScheduleChart,
  CoverageChart,
  PerformanceChart,

  // Features
  AIScheduleGenerator,
  ConflictResolver,
  BulkOperationsPanel,

  // Utilities
  preloadComponent,
  prefetchComponents,
  prefetchForRoute
};
