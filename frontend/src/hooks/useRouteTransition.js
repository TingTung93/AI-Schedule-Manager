import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RouteHistory } from '../utils/routeHistory';

export const useRouteTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('forward');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Start transition
    setIsTransitioning(true);

    // Determine transition direction
    const previousRoute = RouteHistory.getPreviousRoute();
    if (previousRoute && previousRoute.path === location.pathname) {
      setTransitionDirection('backward');
    } else {
      setTransitionDirection('forward');
    }

    // Add current route to history
    RouteHistory.push(location.pathname);

    // End transition after a short delay
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const navigateWithTransition = (path, options = {}) => {
    setIsTransitioning(true);
    setTransitionDirection('forward');

    setTimeout(() => {
      navigate(path, options);
    }, 50);
  };

  const goBackWithTransition = () => {
    setIsTransitioning(true);
    setTransitionDirection('backward');

    setTimeout(() => {
      if (RouteHistory.canGoBack()) {
        navigate(RouteHistory.getBackRoute());
      } else {
        navigate('/dashboard');
      }
    }, 50);
  };

  return {
    isTransitioning,
    transitionDirection,
    navigateWithTransition,
    goBackWithTransition,
    canGoBack: RouteHistory.canGoBack(),
    history: RouteHistory.getHistory()
  };
};

export default useRouteTransition;