/**
 * Performance Monitoring Utilities
 *
 * Comprehensive performance tracking and monitoring for the application.
 * Tracks render times, network requests, bundle sizes, and user interactions.
 *
 * Features:
 * - Render time measurement
 * - Network request tracking
 * - Bundle size analysis
 * - User interaction metrics
 * - Performance marks and measures
 * - Web Vitals tracking
 */

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  RENDER_WARN: 16.67, // 60fps threshold
  RENDER_CRITICAL: 33.33, // 30fps threshold
  NETWORK_WARN: 1000,
  NETWORK_CRITICAL: 3000,
  INTERACTION_WARN: 100,
  INTERACTION_CRITICAL: 300
};

// Performance metrics storage
const metrics = {
  renders: [],
  networks: [],
  interactions: [],
  bundles: []
};

/**
 * Measure component render time
 *
 * @param {string} componentName - Name of component being measured
 * @returns {Function} Cleanup function to call when render completes
 *
 * @example
 * const endMeasure = measureRenderTime('EmployeeList');
 * // ... render logic ...
 * endMeasure();
 */
export const measureRenderTime = (componentName) => {
  const markName = `render-${componentName}-start`;
  const measureName = `render-${componentName}`;

  performance.mark(markName);
  const start = performance.now();

  return () => {
    const end = performance.now();
    const duration = end - start;

    // Create performance measure
    try {
      performance.measure(measureName, markName);
    } catch (e) {
      console.warn('Performance measurement failed:', e);
    }

    // Store metric
    metrics.renders.push({
      component: componentName,
      duration,
      timestamp: Date.now()
    });

    // Warn if render is slow
    if (duration > THRESHOLDS.RENDER_CRITICAL) {
      console.error(
        `🔴 ${componentName} render took ${duration.toFixed(2)}ms (CRITICAL - below 30fps)`
      );
    } else if (duration > THRESHOLDS.RENDER_WARN) {
      console.warn(
        `⚠️ ${componentName} render took ${duration.toFixed(2)}ms (WARNING - below 60fps)`
      );
    } else if (process.env.NODE_ENV === 'development') {
      console.log(
        `✅ ${componentName} render took ${duration.toFixed(2)}ms`
      );
    }

    return duration;
  };
};

/**
 * Measure network request performance
 *
 * @param {string} url - URL being requested
 * @param {Function} fetchFn - Async function to execute
 * @returns {Promise} Result from fetchFn with timing metadata
 *
 * @example
 * const data = await measureNetworkRequest('/api/employees', () =>
 *   fetch('/api/employees').then(r => r.json())
 * );
 */
export const measureNetworkRequest = async (url, fetchFn) => {
  const markName = `network-${url}-start`;
  const measureName = `network-${url}`;

  performance.mark(markName);
  const start = performance.now();

  try {
    const result = await fetchFn();
    const end = performance.now();
    const duration = end - start;

    // Create performance measure
    try {
      performance.measure(measureName, markName);
    } catch (e) {
      console.warn('Network measurement failed:', e);
    }

    // Store metric
    metrics.networks.push({
      url,
      duration,
      success: true,
      timestamp: Date.now()
    });

    // Warn if request is slow
    if (duration > THRESHOLDS.NETWORK_CRITICAL) {
      console.error(
        `🔴 Request to ${url} took ${duration.toFixed(2)}ms (CRITICAL)`
      );
    } else if (duration > THRESHOLDS.NETWORK_WARN) {
      console.warn(
        `⚠️ Request to ${url} took ${duration.toFixed(2)}ms (WARNING)`
      );
    } else if (process.env.NODE_ENV === 'development') {
      console.log(
        `✅ Request to ${url} took ${duration.toFixed(2)}ms`
      );
    }

    return result;
  } catch (error) {
    const end = performance.now();
    const duration = end - start;

    // Store failed request metric
    metrics.networks.push({
      url,
      duration,
      success: false,
      error: error.message,
      timestamp: Date.now()
    });

    console.error(
      `❌ Request to ${url} failed after ${duration.toFixed(2)}ms:`,
      error
    );

    throw error;
  }
};

/**
 * Measure user interaction performance
 *
 * @param {string} interactionName - Name of interaction (e.g., 'button-click')
 * @param {Function} handler - Interaction handler function
 * @returns {Function} Wrapped handler with performance tracking
 *
 * @example
 * const handleClick = measureInteraction('save-button', async () => {
 *   await saveData();
 * });
 */
export const measureInteraction = (interactionName, handler) => {
  return async (...args) => {
    const markName = `interaction-${interactionName}-start`;
    const measureName = `interaction-${interactionName}`;

    performance.mark(markName);
    const start = performance.now();

    try {
      const result = await handler(...args);
      const end = performance.now();
      const duration = end - start;

      // Create performance measure
      try {
        performance.measure(measureName, markName);
      } catch (e) {
        console.warn('Interaction measurement failed:', e);
      }

      // Store metric
      metrics.interactions.push({
        name: interactionName,
        duration,
        success: true,
        timestamp: Date.now()
      });

      // Warn if interaction is slow
      if (duration > THRESHOLDS.INTERACTION_CRITICAL) {
        console.error(
          `🔴 ${interactionName} took ${duration.toFixed(2)}ms (CRITICAL)`
        );
      } else if (duration > THRESHOLDS.INTERACTION_WARN) {
        console.warn(
          `⚠️ ${interactionName} took ${duration.toFixed(2)}ms (WARNING)`
        );
      }

      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;

      metrics.interactions.push({
        name: interactionName,
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  };
};

/**
 * Log bundle sizes in production
 * Analyzes all script tags and reports bundle information
 */
export const logBundleSize = () => {
  if (typeof window === 'undefined') return;

  const scripts = document.querySelectorAll('script[src]');
  const bundles = [];

  scripts.forEach(script => {
    const src = script.src;
    const size = script.getAttribute('data-size') || 'unknown';

    bundles.push({ src, size });
    metrics.bundles.push({ src, size, timestamp: Date.now() });

    if (process.env.NODE_ENV === 'production') {
      console.log(`📦 Bundle: ${src} (${size})`);
    }
  });

  return bundles;
};

/**
 * Get performance summary statistics
 *
 * @returns {Object} Summary of all performance metrics
 */
export const getPerformanceSummary = () => {
  const summary = {
    renders: {
      total: metrics.renders.length,
      average: metrics.renders.length > 0
        ? metrics.renders.reduce((sum, m) => sum + m.duration, 0) / metrics.renders.length
        : 0,
      slowest: metrics.renders.length > 0
        ? metrics.renders.reduce((max, m) => m.duration > max.duration ? m : max, metrics.renders[0])
        : null
    },
    networks: {
      total: metrics.networks.length,
      successful: metrics.networks.filter(m => m.success).length,
      failed: metrics.networks.filter(m => !m.success).length,
      average: metrics.networks.length > 0
        ? metrics.networks.reduce((sum, m) => sum + m.duration, 0) / metrics.networks.length
        : 0,
      slowest: metrics.networks.length > 0
        ? metrics.networks.reduce((max, m) => m.duration > max.duration ? m : max, metrics.networks[0])
        : null
    },
    interactions: {
      total: metrics.interactions.length,
      successful: metrics.interactions.filter(m => m.success).length,
      failed: metrics.interactions.filter(m => !m.success).length,
      average: metrics.interactions.length > 0
        ? metrics.interactions.reduce((sum, m) => sum + m.duration, 0) / metrics.interactions.length
        : 0
    },
    bundles: metrics.bundles
  };

  return summary;
};

/**
 * Clear all performance metrics
 */
export const clearMetrics = () => {
  metrics.renders = [];
  metrics.networks = [];
  metrics.interactions = [];
  metrics.bundles = [];

  // Clear performance marks and measures
  if (typeof performance !== 'undefined' && performance.clearMarks) {
    performance.clearMarks();
    performance.clearMeasures();
  }
};

/**
 * Export metrics to console
 */
export const exportMetrics = () => {
  const summary = getPerformanceSummary();
  console.group('📊 Performance Metrics Summary');
  console.table(summary.renders);
  console.table(summary.networks);
  console.table(summary.interactions);
  console.groupEnd();

  return summary;
};

/**
 * Track Web Vitals (LCP, FID, CLS)
 * Requires web-vitals library
 */
export const trackWebVitals = () => {
  if (typeof window === 'undefined') return;

  // Use native Performance Observer if available
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP tracking failed:', e);
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID tracking failed:', e);
    }
  }
};

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined') return;

  // Log bundle sizes
  window.addEventListener('load', () => {
    setTimeout(() => {
      logBundleSize();
      trackWebVitals();
    }, 0);
  });

  // Export metrics on page unload (for analytics)
  window.addEventListener('beforeunload', () => {
    if (process.env.NODE_ENV === 'development') {
      exportMetrics();
    }
  });

  console.log('✅ Performance monitoring initialized');
};

export default {
  measureRenderTime,
  measureNetworkRequest,
  measureInteraction,
  logBundleSize,
  getPerformanceSummary,
  clearMetrics,
  exportMetrics,
  trackWebVitals,
  initPerformanceMonitoring,
  THRESHOLDS
};
