/**
 * Performance optimization utilities for React application
 */

import { lazy, Suspense, useState, useEffect, useRef, memo } from 'react';

/**
 * Lazy load components with loading fallback
 */
export const lazyLoadComponent = (importFunc, fallback = null) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Default loading spinner component
 */
const LoadingSpinner = () => (
  <div className="loading-spinner">
    <div className="spinner"></div>
  </div>
);

/**
 * Debounce function to limit API calls
 */
export const debounce = (func, delay = 300) => {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Throttle function for scroll/resize events
 */
export const throttle = (func, limit = 100) => {
  let inThrottle;
  
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Memoize expensive computations
 */
export const memoize = (fn) => {
  const cache = new Map();
  
  return (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
};

/**
 * Virtual scrolling hook for large lists
 */
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight)
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
};

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (ref, options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);
  
  return isIntersecting;
};

/**
 * Request idle callback wrapper
 */
export const whenIdle = (callback) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback);
  } else {
    setTimeout(callback, 1);
  }
};

/**
 * Batch DOM updates
 */
export const batchUpdates = (updates) => {
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
};

/**
 * Image lazy loading with placeholder
 */
export const LazyImage = memo(({ src, alt, placeholder, ...props }) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef();
  const isIntersecting = useIntersectionObserver(imgRef, {
    threshold: 0.1,
    rootMargin: '50px'
  });
  
  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageSrc(src);
        setIsLoading(false);
      };
    }
  }, [isIntersecting, src]);
  
  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={isLoading ? 'loading' : 'loaded'}
      {...props}
    />
  );
});

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.observers = [];
  }
  
  measureComponent(componentName) {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.metrics[componentName]) {
        this.metrics[componentName] = [];
      }
      
      this.metrics[componentName].push(duration);
      
      // Keep only last 100 measurements
      if (this.metrics[componentName].length > 100) {
        this.metrics[componentName].shift();
      }
      
      this.notifyObservers(componentName, duration);
    };
  }
  
  getMetrics(componentName) {
    if (!componentName) return this.metrics;
    
    const measurements = this.metrics[componentName] || [];
    if (measurements.length === 0) return null;
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const max = Math.max(...measurements);
    const min = Math.min(...measurements);
    
    return { avg, max, min, count: measurements.length };
  }
  
  subscribe(callback) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(cb => cb !== callback);
    };
  }
  
  notifyObservers(componentName, duration) {
    this.observers.forEach(callback => {
      callback({ componentName, duration, timestamp: Date.now() });
    });
  }
  
  reset(componentName) {
    if (componentName) {
      delete this.metrics[componentName];
    } else {
      this.metrics = {};
    }
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export const usePerformanceMonitor = (componentName) => {
  useEffect(() => {
    const endMeasure = perfMonitor.measureComponent(componentName);
    
    return () => {
      endMeasure();
    };
  }, [componentName]);
};

/**
 * Web Worker manager for heavy computations
 */
export class WorkerManager {
  constructor() {
    this.workers = new Map();
  }
  
  createWorker(workerScript) {
    const id = Math.random().toString(36).substr(2, 9);
    const worker = new Worker(workerScript);
    this.workers.set(id, worker);
    return id;
  }
  
  postMessage(workerId, message) {
    const worker = this.workers.get(workerId);
    if (worker) {
      return new Promise((resolve, reject) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.onerror = reject;
        worker.postMessage(message);
      });
    }
    return Promise.reject('Worker not found');
  }
  
  terminateWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerId);
    }
  }
  
  terminateAll() {
    this.workers.forEach(worker => worker.terminate());
    this.workers.clear();
  }
}

export const workerManager = new WorkerManager();