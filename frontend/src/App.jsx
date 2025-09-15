import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Context and Hooks
import { AuthProvider } from './context/AuthContext';

// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages (Lazy loaded for better performance)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import SchedulePage from './pages/SchedulePage';
import RulesPage from './pages/RulesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

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
  SchedulePage,
  RulesPage,
  AnalyticsPage,
  SettingsPage,
  ProfilePage
};

function App() {
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
                      <Layout>
                        <Routes>
                          {/* Dashboard */}
                          <Route
                            path={ROUTES.DASHBOARD}
                            element={<DashboardPage />}
                          />

                          {/* Employee Management */}
                          <Route
                            path={ROUTES.EMPLOYEES}
                            element={
                              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                                <EmployeesPage />
                              </ProtectedRoute>
                            }
                          />

                          {/* Schedule Management */}
                          <Route
                            path={ROUTES.SCHEDULE}
                            element={<SchedulePage />}
                          />

                          {/* Business Rules */}
                          <Route
                            path={ROUTES.RULES}
                            element={
                              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                                <RulesPage />
                              </ProtectedRoute>
                            }
                          />

                          {/* Analytics */}
                          <Route
                            path={ROUTES.ANALYTICS}
                            element={
                              <ProtectedRoute requiredRoles={['admin', 'manager']}>
                                <AnalyticsPage />
                              </ProtectedRoute>
                            }
                          />

                          {/* Settings */}
                          <Route
                            path={ROUTES.SETTINGS}
                            element={<SettingsPage />}
                          />

                          {/* Profile */}
                          <Route
                            path={ROUTES.PROFILE}
                            element={<ProfilePage />}
                          />

                          {/* 404 for unmatched protected routes */}
                          <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* 404 for unmatched routes */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;