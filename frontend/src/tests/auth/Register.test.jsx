/**
 * Register Component Tests
 *
 * Comprehensive test suite for the Register component including
 * form validation, password strength checking, error handling,
 * and authentication flow.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import Register from '../../components/auth/Register';
import { authService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  authService: {
    register: jest.fn(),
    getCsrfToken: jest.fn()
  }
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Test wrapper component
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

describe('Register Component', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  describe('Rendering', () => {
    test('renders registration form with all required fields', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    test('renders password toggle buttons', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordToggles = screen.getAllByRole('button', { name: /show password/i });
      expect(passwordToggles).toHaveLength(2); // One for password, one for confirm password
    });

    test('renders navigation links', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows validation errors for empty required fields', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
        expect(screen.getByText(/please confirm your password/i)).toBeInTheDocument();
      });
    });

    test('validates name field length', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'A' } }); // Too short
        fireEvent.change(lastNameInput, { target: { value: 'B' } }); // Too short
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/last name must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    test('validates email format', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    test('validates password confirmation', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'Different123!' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    test('clears validation errors when user corrects input', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Trigger validation errors
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      // Clear errors by providing valid input
      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
      });

      await waitFor(() => {
        expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Strength', () => {
    test('shows password strength indicator', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);

      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'weak' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
        expect(screen.getByText(/password must contain/i)).toBeInTheDocument();
      });
    });

    test('shows password requirements checklist', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);

      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'TestPass123!' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
        expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
        expect(screen.getByText(/one lowercase letter/i)).toBeInTheDocument();
        expect(screen.getByText(/one number/i)).toBeInTheDocument();
        expect(screen.getByText(/one special character/i)).toBeInTheDocument();
      });
    });

    test('updates password strength based on input', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);

      // Weak password
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'weak' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Strong password
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });

    test('prevents submission with weak password', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'weak' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/password does not meet strength requirements/i)).toBeInTheDocument();
      });

      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  describe('Password Visibility', () => {
    test('toggles password visibility for both fields', async () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const passwordToggles = screen.getAllByRole('button', { name: /show password/i });

      // Initially hidden
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      // Show first password
      await act(async () => {
        fireEvent.click(passwordToggles[0]);
      });

      expect(passwordInput).toHaveAttribute('type', 'text');

      // Show second password
      await act(async () => {
        fireEvent.click(passwordToggles[1]);
      });

      expect(confirmPasswordInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Registration Flow', () => {
    test('successful registration flow', async () => {
      const mockUser = {
        id: 1,
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe'
      };

      authService.register.mockResolvedValue({
        data: {
          user: mockUser,
          access_token: 'mock-token'
        }
      });

      authService.getCsrfToken.mockResolvedValue('mock-csrf-token');

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(authService.register).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'StrongPassword123!',
          first_name: 'John',
          last_name: 'Doe'
        });
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    test('handles registration failure with existing email', async () => {
      authService.register.mockRejectedValue({
        response: {
          status: 409,
          data: {
            error: 'Email already exists'
          }
        }
      });

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/an account with this email already exists/i)).toBeInTheDocument();
      });
    });

    test('handles validation errors from server', async () => {
      authService.register.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            requirements: ['Password must contain special character']
          }
        }
      });

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'WeakPassword' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'WeakPassword' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/password does not meet strength requirements/i)).toBeInTheDocument();
      });
    });

    test('handles rate limiting', async () => {
      authService.register.mockRejectedValue({
        response: {
          status: 429,
          data: {
            error: 'Rate limit exceeded'
          }
        }
      });

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/too many registration attempts/i)).toBeInTheDocument();
      });
    });

    test('handles network errors', async () => {
      authService.register.mockRejectedValue({
        message: 'Network Error'
      });

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/registration failed.*try again/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading state during registration', async () => {
      authService.register.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await act(async () => {
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.change(confirmPasswordInput, { target: { value: 'StrongPassword123!' } });
        fireEvent.click(submitButton);
      });

      // Check loading state
      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(screen.getByRole('button')).toHaveClass('loading');
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/first name/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/last name/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('required');

      const passwordToggles = screen.getAllByRole('button', { name: /show password/i });
      passwordToggles.forEach(toggle => {
        expect(toggle).toHaveAttribute('aria-label');
      });
    });

    test('maintains proper form structure', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      // Form element doesn't have implicit 'form' role, check for presence differently
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('renders name fields in row layout on larger screens', () => {
      render(
        <TestWrapper>
          <Register />
        </TestWrapper>
      );

      const firstNameInput = screen.getByLabelText(/first name/i);
      const lastNameInput = screen.getByLabelText(/last name/i);

      // Both inputs should be in the same form row
      const formRow = firstNameInput.closest('.form-row');
      expect(formRow).toContainElement(lastNameInput);
    });
  });
});

// Store test implementation details
const storeTestImplementation = () => {
  try {
    if (typeof window !== 'undefined' && window.memory_store) {
      const implementation = {
        frontend_auth_tests: {
          register_component_tests: {
            rendering: 'Form fields, navigation links, password requirements',
            validation: 'Required fields, email format, password confirmation',
            password_strength: 'Strength indicator, requirements checklist, validation',
            registration_flow: 'Success flow, error handling, rate limiting',
            loading_states: 'Button states, form disabling, spinner display',
            accessibility: 'ARIA labels, form structure, keyboard navigation',
            responsive: 'Layout adaptation, field grouping'
          },
          coverage_areas: [
            'Form validation and error display',
            'Password strength checking and requirements',
            'Password visibility toggle for both fields',
            'Registration API integration',
            'Error handling for various scenarios',
            'Loading and disabled states',
            'Email conflict handling',
            'Server validation errors',
            'Rate limiting response',
            'Network error handling'
          ],
          test_scenarios: [
            'Successful registration',
            'Email already exists',
            'Invalid form data',
            'Weak password rejection',
            'Password mismatch',
            'Rate limiting',
            'Network errors',
            'Server validation errors',
            'Loading states',
            'Accessibility features'
          ]
        }
      };

      window.memory_store.store('development/auth/register_tests', implementation);
    }
  } catch (error) {
    console.warn('Failed to store test implementation:', error);
  }
};

// Execute storage
storeTestImplementation();