import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export const useDeepLinking = () => {
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Handle deep linking after authentication is resolved
    if (!isLoading) {
      if (isAuthenticated && pendingNavigation) {
        // Navigate to the originally requested URL
        navigate(pendingNavigation, { replace: true });
        setPendingNavigation(null);
      } else if (!isAuthenticated && !isPublicRoute(location.pathname)) {
        // Store the attempted URL and redirect to login
        setPendingNavigation(location.pathname + location.search);
        navigate('/login', {
          replace: true,
          state: { from: location.pathname + location.search }
        });
      }
    }
  }, [isAuthenticated, isLoading, location, navigate, pendingNavigation]);

  // Parse URL parameters for deep linking
  const parseUrlParams = () => {
    const urlParams = new URLSearchParams(location.search);
    const params = {};

    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }

    return params;
  };

  // Build URLs with parameters for sharing
  const buildShareableUrl = (path, params = {}) => {
    const url = new URL(window.location.origin + path);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  };

  // Handle bookmark creation
  const createBookmark = (title, path, params = {}) => {
    const url = buildShareableUrl(path, params);

    // Try to use the Web Share API if available
    if (navigator.share) {
      navigator.share({
        title,
        url
      }).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard?.writeText(url).then(() => {
        console.log('URL copied to clipboard');
      }).catch(console.error);
    }
  };

  // Check if route is public (doesn't require authentication)
  const isPublicRoute = (path) => {
    const publicRoutes = ['/login', '/register', '/forgot-password'];
    return publicRoutes.includes(path);
  };

  // Generate route with preserved state
  const generateStatefulUrl = (path, state = {}) => {
    const stateParam = btoa(JSON.stringify(state));
    return buildShareableUrl(path, { state: stateParam });
  };

  // Restore state from URL
  const restoreStateFromUrl = () => {
    const params = parseUrlParams();
    if (params.state) {
      try {
        return JSON.parse(atob(params.state));
      } catch (error) {
        console.warn('Could not parse state from URL:', error);
      }
    }
    return {};
  };

  return {
    parseUrlParams,
    buildShareableUrl,
    createBookmark,
    generateStatefulUrl,
    restoreStateFromUrl,
    pendingNavigation,
    isPublicRoute
  };
};

export default useDeepLinking;