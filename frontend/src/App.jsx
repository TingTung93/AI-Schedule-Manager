import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, Typography, Alert } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Context and Hooks
import { AuthProvider } from './contexts/AuthContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';

// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Performance Monitoring
import { initPerformanceMonitoring } from './utils/performanceMonitor';

// Public pages (no code splitting for critical routes)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

// Dashboard (keep immediate for first render)
import DashboardPage from './pages/DashboardPage';

// Heavy pages - lazy loaded for code splitting
const ScheduleBuilder = lazy(() => import(/* webpackChunkName: "schedule-builder" */ './pages/ScheduleBuilder'));
const SchedulePage = lazy(() => import(/* webpackChunkName: "schedule-page" */ './pages/SchedulePage'));
const EmployeesPage = lazy(() => import(/* webpackChunkName: "employees-page" */ './pages/EmployeesPage'));
const AnalyticsPage = lazy(() => import(/* webpackChunkName: "analytics-page" */ './pages/AnalyticsPage'));
const DepartmentManager = lazy(() => import(/* webpackChunkName: "department-manager" */ './pages/DepartmentManager'));
const ShiftManager = lazy(() => import(/* webpackChunkName: "shift-manager" */ './pages/ShiftManager'));
const DepartmentOverview = lazy(() => import(/* webpackChunkName: "department-overview" */ './pages/DepartmentOverview'));
const RulesPage = lazy(() => import(/* webpackChunkName: "rules-page" */ './pages/RulesPage'));
const RoleManager = lazy(() => import(/* webpackChunkName: "role-manager" */ './pages/RoleManager'));
const SettingsPage = lazy(() => import(/* webpackChunkName: "settings-page" */ './pages/SettingsPage'));
const ProfilePage = lazy(() => import(/* webpackChunkName: "profile-page" */ './pages/ProfilePage'));

// Route configuration
import { ROUTES, ROUTE_CONFIG } from './utils/routeConfig';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#f06292',
      dark: '#c51162',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// Loading component for Suspense fallback
const LoadingFallback = () => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    gap={2}
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <CircularProgress size={60} />
    </motion.div>
    <Typography variant="h6" color="textSecondary">
      Loading...
    </Typography>
  </Box>
);

// Route component mapping
const routeComponents = {
  LoginPage,
  RegisterPage,
  DashboardPage,
  EmployeesPage,
  DepartmentManager,
  ShiftManager,
  SchedulePage,
  DepartmentOverview,
  RulesPage,
  AnalyticsPage,
  RoleManager,
  SettingsPage,
  ProfilePage
};

function App() {
  const isOnline = useOnlineStatus();

  // Initialize performance monitoring
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  // Generate routes from configuration
  const generateRoutes = () => {
    return ROUTE_CONFIG.map((route) => {
      const Component = routeComponents[route.component];

      if (!Component) {
        console.warn(`Component ${route.component} not found for route ${route.path}`);
        return null;
      }

      // Public routes (login, register)
      if (route.isPublic) {
        return (
          <Route
            key={route.path}
            path={route.path}
            element={<Component />}
          />
        );
      }

      // Protected routes
      return (
        <Route
          key={route.path}
          path={route.path}
          element={
            <ProtectedRoute requiredRoles={route.requiredRoles}>
              <Component />
            </ProtectedRoute>
          }
        />
      );
    }).filter(Boolean);
  };

  return (
    <ErrorBoundary name="App">
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {/* Offline Banner */}
        {!isOnline && (
          <Alert
            severity="warning"
            sx={{
              position: 'fixed',
              top: 0,
              width: '100%',
              zIndex: 9999,
              borderRadius: 0
            }}
          >
            You are offline. Some features may not work.
          </Alert>
        )}

        <AuthProvider>
          <Router>
            <Suspense fallback={<LoadingFallback />}>
              <AnimatePresence mode="wait">
                <Routes>
                {/* Root redirect to dashboard */}
                <Route
                  path="/"
                  element={<Navigate to={ROUTES.DASHBOARD} replace />}
                />

                {/* Public routes */}
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

                {/* Protected routes with layout */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  {/* Dashboard */}
                  <Route
                    path="dashboard"
                    element={
                      <ErrorBoundary name="Dashboard">
                        <DashboardPage />
                      </ErrorBoundary>
                    }
                  />

                  {/* Employee Management */}
                  <Route
                    path="employees"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <ErrorBoundary name="Employees">
                          <EmployeesPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Department Management */}
                  <Route
                    path="departments"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <ErrorBoundary name="Departments">
                          <DepartmentManager />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Shift Management */}
                  <Route
                    path="shifts"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <ErrorBoundary name="Shifts">
                          <ShiftManager />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Schedule Management */}
                  <Route
                    path="schedule"
                    element={
                      <ErrorBoundary name="Schedule">
                        <SchedulePage />
                      </ErrorBoundary>
                    }
                  />

                  {/* Schedule Builder */}
                  <Route
                    path="schedule/builder"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <ErrorBoundary name="ScheduleBuilder">
                          <ScheduleBuilder />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />

                  {/* Department Overview */}
                  <Route
                    path="department-overview"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <DepartmentOverview />
                      </ProtectedRoute>
                    }
                  />

                  {/* Business Rules */}
                  <Route
                    path="rules"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <RulesPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Analytics */}
                  <Route
                    path="analytics"
                    element={
                      <ProtectedRoute requiredRoles={['admin', 'manager']}>
                        <AnalyticsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Role Management */}
                  <Route
                    path="roles"
                    element={
                      <ProtectedRoute requiredRoles={['admin']}>
                        <RoleManager />
                      </ProtectedRoute>
                    }
                  />

                  {/* Settings */}
                  <Route
                    path="settings"
                    element={<SettingsPage />}
                  />

                  {/* Profile */}
                  <Route
                    path="profile"
                    element={<ProfilePage />}
                  />

                  {/* 404 for unmatched protected routes */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* 404 for unmatched routes */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;