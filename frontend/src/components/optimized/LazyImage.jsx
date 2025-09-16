import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Box, Skeleton } from '@mui/material';

// Optimized lazy loading image component
const LazyImage = memo(({ 
  src, 
  alt, 
  width, 
  height, 
  placeholder, 
  className,
  loading = 'lazy',
  onLoad,
  onError,
  ...props 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef();
  const observerRef = useRef();

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observerRef.current = observer;

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback((e) => {
    setLoaded(true);
    onLoad?.(e);
  }, [onLoad]);

  const handleError = useCallback((e) => {
    setError(true);
    onError?.(e);
  }, [onError]);

  // Generate responsive srcSet for different densities
  const generateSrcSet = useCallback((baseSrc) => {
    if (!baseSrc) return '';
    
    const ext = baseSrc.split('.').pop();
    const base = baseSrc.replace(`.${ext}`, '');
    
    return [
      `${base}.${ext} 1x`,
      `${base}@2x.${ext} 2x`,
      `${base}@3x.${ext} 3x`
    ].join(', ');
  }, []);

  return (
    <Box 
      ref={imgRef}
      width={width}
      height={height}
      className={className}
      position="relative"
      overflow="hidden"
      {...props}
    >
      {!loaded && !error && (
        <Skeleton 
          variant="rectangular" 
          width="100%" 
          height="100%" 
          animation="wave"
        />
      )}
      
      {inView && (
        <img
          src={src}
          srcSet={generateSrcSet(src)}
          alt={alt}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: loaded ? 'block' : 'none',
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
      
      {error && placeholder && (
        <Box 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
          width="100%" 
          height="100%"
          bgcolor="grey.100"
        >
          {placeholder}
        </Box>
      )}
    </Box>
  );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;
