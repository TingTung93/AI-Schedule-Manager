import React from 'react';
import { Box, Typography, Button, Paper, Alert, Collapse } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BugReportIcon from '@mui/icons-material/BugReport';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';
import { reportError } from '../utils/errorReporting';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isExpanded: false,
      isReporting: false,
      reportSent: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log error to monitoring service
    this.logError(error, errorInfo);
  }

  logError = async (error, errorInfo) => {
    try {
      await reportError(error, {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.props.name || 'ErrorBoundary',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.props.userId || 'anonymous',
        errorCount: this.state.errorCount + 1
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  handleReportError = async () => {
    this.setState({ isReporting: true });

    try {
      await reportError(this.state.error, {
        componentStack: this.state.errorInfo?.componentStack,
        userFeedback: 'User manually reported error',
        timestamp: new Date().toISOString(),
        errorCount: this.state.errorCount
      });

      this.setState({ reportSent: true });
    } catch (error) {
      console.error('Failed to send error report:', error);
    } finally {
      this.setState({ isReporting: false });
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isExpanded: false,
      isReporting: false,
      reportSent: false
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState({ isExpanded: !this.state.isExpanded });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, isExpanded, isReporting, reportSent, errorCount } = this.state;
      const { fallback: FallbackComponent } = this.props;
      const isDev = process.env.NODE_ENV === 'development';

      // Use custom fallback component if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            errorCount={errorCount}
            resetError={this.handleReset}
            reloadPage={this.handleReload}
          />
        );
      }

      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            bgcolor: 'background.default'
          }}
        >
          <Paper sx={{ maxWidth: 600, p: 4, width: '100%' }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <BugReportIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                Oops! Something went wrong
              </Typography>
              <Typography color="text.secondary">
                {errorCount > 1
                  ? `This error has occurred ${errorCount} times. You may need to refresh the page.`
                  : 'We encountered an unexpected error. You can try again or refresh the page.'}
              </Typography>
            </Box>

            {errorCount > 2 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Multiple errors detected. Please try refreshing the page or contact support if the problem persists.
              </Alert>
            )}

            {isDev && error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Error:</strong> {error.toString()}
                </Typography>
                {errorInfo?.componentStack && (
                  <Button
                    size="small"
                    startIcon={<ExpandMoreIcon sx={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
                    onClick={this.toggleDetails}
                    sx={{ mt: 1 }}
                  >
                    {isExpanded ? 'Hide' : 'Show'} Stack Trace
                  </Button>
                )}
              </Alert>
            )}

            <Collapse in={isDev && isExpanded}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={{
                    overflow: 'auto',
                    maxHeight: 300,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {errorInfo?.componentStack}
                </Typography>
              </Paper>
            </Collapse>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
            </Box>

            {!isDev && !reportSent && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button
                  variant="text"
                  color="error"
                  onClick={this.handleReportError}
                  disabled={isReporting}
                >
                  {isReporting ? 'Sending Report...' : 'Report This Error'}
                </Button>
              </Box>
            )}

            {reportSent && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Thank you! The error has been reported to our team.
              </Alert>
            )}

            {!isDev && (
              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', mt: 2, color: 'text.secondary' }}
              >
                Error ID: {Date.now()} | Time: {new Date().toLocaleTimeString()}
              </Typography>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
