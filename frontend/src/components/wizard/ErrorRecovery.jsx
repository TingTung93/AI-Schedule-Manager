import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { Refresh, SkipNext } from '@mui/icons-material';

/**
 * Reusable error recovery component with retry and skip options
 *
 * @param {Object} props
 * @param {Error} props.error - The error object to display
 * @param {Function} props.onRetry - Callback function to retry the failed operation
 * @param {Function} props.onSkip - Optional callback function to skip this operation
 * @param {boolean} props.skipAllowed - Whether the skip button should be shown
 * @param {string} props.severity - Alert severity (error, warning, info)
 */
const ErrorRecovery = ({
  error,
  onRetry,
  onSkip,
  skipAllowed = false,
  severity = 'error'
}) => {
  // Extract user-friendly error message
  const getErrorMessage = () => {
    if (!error) return 'An unknown error occurred';

    // Check if error has a response from API
    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    // Check for network errors
    if (error.message === 'Network Error') {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    // Check for timeout errors
    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }

    // Check for 404 errors
    if (error.response?.status === 404) {
      return 'The requested resource was not found.';
    }

    // Check for 500 errors
    if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    }

    // Check for 401/403 errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'You do not have permission to access this resource.';
    }

    // Default to error message
    return error.message || 'An error occurred';
  };

  return (
    <Alert
      severity={severity}
      sx={{ mb: 2 }}
      action={
        <Box display="flex" gap={1}>
          {onRetry && (
            <Button
              color="inherit"
              size="small"
              startIcon={<Refresh />}
              onClick={onRetry}
              variant="outlined"
            >
              Retry
            </Button>
          )}
          {skipAllowed && onSkip && (
            <Button
              color="inherit"
              size="small"
              startIcon={<SkipNext />}
              onClick={onSkip}
              variant="text"
            >
              Continue Without This Data
            </Button>
          )}
        </Box>
      }
    >
      <AlertTitle>Error Loading Data</AlertTitle>
      {getErrorMessage()}
    </Alert>
  );
};

export default ErrorRecovery;
