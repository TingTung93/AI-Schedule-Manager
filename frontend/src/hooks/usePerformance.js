import { useEffect, useCallback, useRef } from 'react';

// Performance monitoring hook
export const usePerformance = (componentName) => {
  const mountTime = useRef(performance.now());
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = performance.now() - lastRenderTime.current;
    
    // Log slow renders (> 16ms)
    if (renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}:`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        renderCount: renderCount.current,
        timestamp: new Date().toISOString()
      });
    }
    
    lastRenderTime.current = performance.now();
  });

  useEffect(() => {
    return () => {
      const totalTime = performance.now() - mountTime.current;
      console.log(`Component ${componentName} unmounted:`, {
        totalTime: `${totalTime.toFixed(2)}ms`,
        renderCount: renderCount.current,
        avgRenderTime: `${(totalTime / renderCount.current).toFixed(2)}ms`
      });
    };
  }, [componentName]);

  const markRenderStart = useCallback(() => {
    lastRenderTime.current = performance.now();
  }, []);

  return { markRenderStart, renderCount: renderCount.current };
};

// Web Vitals monitoring
export const useWebVitals = () => {
  useEffect(() => {
    const vitalsScript = document.createElement('script');
    vitalsScript.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.js';
    vitalsScript.onload = () => {
      if (window.webVitals) {
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = window.webVitals;
        
        getCLS(console.log);
        getFID(console.log);
        getFCP(console.log);
        getLCP(console.log);
        getTTFB(console.log);
      }
    };
    document.head.appendChild(vitalsScript);
    
    return () => {
      if (vitalsScript.parentNode) {
        vitalsScript.parentNode.removeChild(vitalsScript);
      }
    };
  }, []);
};

// Memory usage monitoring
export const useMemoryMonitor = () => {
  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = performance.memory;
        console.log('Memory usage:', {
          used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
        });
      }
    };

    const interval = setInterval(checkMemory, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  const chunks = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes('.js') || entry.name.includes('.css')) {
        chunks.push({
          name: entry.name,
          size: entry.transferSize,
          type: entry.name.includes('.js') ? 'javascript' : 'css'
        });
      }
    }
  });
  
  observer.observe({ entryTypes: ['resource'] });
  
  setTimeout(() => {
    observer.disconnect();
    console.table(chunks);
  }, 3000);
};
