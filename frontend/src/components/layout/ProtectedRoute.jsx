import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, isLoading, user, hasAnyRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
        p={3}
      >
        <Typography variant="h4" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="textSecondary" textAlign="center">
          You don't have permission to access this page.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Required roles: {requiredRoles.join(', ')}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Your role: {user?.role || 'Unknown'}
        </Typography>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;