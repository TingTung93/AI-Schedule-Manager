import { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

// Lazy-loaded page components
export const LazyDashboardPage = lazy(() => import('../pages/DashboardPage'));
export const LazyEmployeesPage = lazy(() => import('../pages/EmployeesPage'));
export const LazySchedulePage = lazy(() => import('../pages/SchedulePage'));
export const LazyRulesPage = lazy(() => import('../pages/RulesPage'));
export const LazyAnalyticsPage = lazy(() => import('../pages/AnalyticsPage'));
export const LazySettingsPage = lazy(() => import('../pages/SettingsPage'));
export const LazyProfilePage = lazy(() => import('../pages/ProfilePage'));

// Lazy-loaded components
export const LazyEmployeeManagement = lazy(() => import('../components/EmployeeManagement'));
export const LazyScheduleDisplay = lazy(() => import('../components/ScheduleDisplay'));
export const LazyRuleInput = lazy(() => import('../components/RuleInput'));

// Enhanced loading component with error boundary
const LoadingFallback = ({ componentName = 'Component' }) => (
  <Box 
    display="flex" 
    flexDirection="column"
    alignItems="center" 
    justifyContent="center" 
    height="200px"
    gap={2}
  >
    <CircularProgress size={40} />
    <Typography variant="body2" color="textSecondary">
      Loading {componentName}...
    </Typography>
  </Box>
);

// Preload critical components
export const preloadCriticalComponents = () => {
  // Preload dashboard and employees pages (most commonly accessed)
  const preloadPromises = [
    import('../pages/DashboardPage'),
    import('../pages/EmployeesPage'),
    import('../components/EmployeeManagement')
  ];
  
  return Promise.allSettled(preloadPromises);
};

// Route-based code splitting with enhanced suspense
export const withLazyLoading = (Component, componentName) => {
  return (props) => (
    <Suspense fallback={<LoadingFallback componentName={componentName} />}>
      <Component {...props} />
    </Suspense>
  );
};

// Error boundary for lazy components
export class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lazy loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={3} textAlign="center">
          <Typography variant="h6" color="error" gutterBottom>
            Failed to load component
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Please refresh the page to try again.
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Prefetch components on route hover/focus
export const usePrefetch = () => {
  const prefetchRoute = useCallback((routeName) => {
    switch (routeName) {
      case 'dashboard':
        import('../pages/DashboardPage');
        break;
      case 'employees':
        import('../pages/EmployeesPage');
        import('../components/EmployeeManagement');
        break;
      case 'schedule':
        import('../pages/SchedulePage');
        import('../components/ScheduleDisplay');
        break;
      case 'rules':
        import('../pages/RulesPage');
        import('../components/RuleInput');
        break;
      case 'analytics':
        import('../pages/AnalyticsPage');
        break;
      case 'settings':
        import('../pages/SettingsPage');
        break;
      case 'profile':
        import('../pages/ProfilePage');
        break;
      default:
        break;
    }
  }, []);

  return { prefetchRoute };
};
