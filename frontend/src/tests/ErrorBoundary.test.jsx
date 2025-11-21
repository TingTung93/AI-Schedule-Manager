import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../components/ErrorBoundary';
import { reportError } from '../utils/errorReporting';

// Mock the error reporting utility
jest.mock('../utils/errorReporting', () => ({
  reportError: jest.fn()
}));

// Component that throws an error
const BuggyComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/we encountered an unexpected error/i)).toBeInTheDocument();
  });

  it('displays error count when error occurs multiple times', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BuggyComponent key="1" />
      </ErrorBoundary>
    );

    // First error
    expect(screen.getByText(/we encountered an unexpected error/i)).toBeInTheDocument();

    // Reset and trigger second error
    fireEvent.click(screen.getByText('Try Again'));

    rerender(
      <ErrorBoundary>
        <BuggyComponent key="2" />
      </ErrorBoundary>
    );

    // Should show error count
    await waitFor(() => {
      expect(screen.getByText(/this error has occurred 2 times/i)).toBeInTheDocument();
    });
  });

  it('shows warning alert for multiple errors (>2)', () => {
    const errorBoundary = new ErrorBoundary({ children: <div>test</div> });
    errorBoundary.setState({ errorCount: 3, hasError: true });

    const { container } = render(errorBoundary.render());

    expect(screen.getByText(/multiple errors detected/i)).toBeInTheDocument();
  });

  it('calls reportError when error is caught', async () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <BuggyComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(reportError).toHaveBeenCalled();
      const callArgs = reportError.mock.calls[0];
      expect(callArgs[0].message).toBe('Test error');
      expect(callArgs[1]).toMatchObject({
        errorBoundary: 'TestBoundary'
      });
    });
  });

  it('provides retry functionality', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try Again'));

    // After retry, error should clear and children should render
    rerender(
      <ErrorBoundary>
        <BuggyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('provides reload page functionality', () => {
    // Mock window.location.reload
    delete window.location;
    window.location = { reload: jest.fn() };

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reload Page'));
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('provides go home functionality', () => {
    // Mock window.location.href
    delete window.location;
    window.location = { href: '' };

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Go Home'));
    expect(window.location.href).toBe('/');
  });

  it('shows stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    // Should show error details in dev mode
    expect(screen.getByText(/Error:/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();

    // Should have button to show stack trace
    const showStackButton = screen.getByText('Show Stack Trace');
    expect(showStackButton).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('hides stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    // Should not show detailed error in production
    expect(screen.queryByText(/Error:/i)).not.toBeInTheDocument();

    // Should show error ID and time instead
    expect(screen.getByText(/Error ID:/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('allows manual error reporting in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    const reportButton = screen.getByText('Report This Error');
    expect(reportButton).toBeInTheDocument();

    fireEvent.click(reportButton);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Sending Report...')).toBeInTheDocument();
    });

    // After report sent
    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('uses custom fallback component when provided', () => {
    const CustomFallback = ({ error, errorCount, resetError }) => (
      <div>
        <h1>Custom Error UI</h1>
        <p>Error count: {errorCount}</p>
        <button onClick={resetError}>Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <BuggyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });

  it('expands and collapses stack trace', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <BuggyComponent />
      </ErrorBoundary>
    );

    const toggleButton = screen.getByText('Show Stack Trace');

    // Initially collapsed
    expect(screen.queryByText(/at BuggyComponent/i)).not.toBeVisible();

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByText('Hide Stack Trace')).toBeInTheDocument();

    // Collapse again
    fireEvent.click(screen.getByText('Hide Stack Trace'));
    expect(screen.getByText('Show Stack Trace')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});
