import * as Sentry from '@sentry/react';

// Initialize Sentry (should be called in your main App component)
export const initErrorReporting = (config = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: process.env.NODE_ENV,
      debug: !isProduction,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: isProduction ? 0.1 : 1.0,
      replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        // Filter out non-critical errors in production
        if (isProduction && event.level === 'warning') {
          return null;
        }
        return event;
      },
    });
  }
};

// Set user context for error reporting
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
};

// Report errors to monitoring service
export const reportError = async (error, context = {}) => {
  const errorData = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...context,
  };

  // Report to Sentry if available
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach((key) => {
        scope.setTag(key, context[key]);
      });
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error reported:', errorData);
  }

  // Send to custom backend endpoint if configured
  try {
    if (process.env.REACT_APP_ERROR_REPORTING_ENDPOINT) {
      await fetch(process.env.REACT_APP_ERROR_REPORTING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    }
  } catch (reportingError) {
    console.error('Failed to send error to backend:', reportingError);
  }
};

// Report performance issues
export const reportPerformance = (name, value, context = {}) => {
  const performanceData = {
    name,
    value,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...context,
  };

  // Report to Sentry
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name}: ${value}ms`,
      level: 'info',
      data: performanceData,
    });
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Performance metric:', performanceData);
  }
};

// Report user actions for debugging
export const reportUserAction = (action, details = {}) => {
  const actionData = {
    action,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...details,
  };

  // Add as breadcrumb to Sentry
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.addBreadcrumb({
      category: 'user',
      message: action,
      level: 'info',
      data: actionData,
    });
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('User action:', actionData);
  }
};

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason, {
    type: 'unhandled_promise_rejection',
    promise: event.promise,
  });
});

// Capture global errors
window.addEventListener('error', (event) => {
  reportError(event.error || new Error(event.message), {
    type: 'global_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});