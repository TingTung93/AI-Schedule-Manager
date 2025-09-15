/**
 * Registration Component
 *
 * Provides secure user registration form with password strength validation,
 * email verification, and proper error handling.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Password strength checker
  const checkPasswordStrength = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)
    };

    const score = Object.values(requirements).filter(Boolean).length;

    let strength = 'weak';
    let color = '#ef4444';

    if (score >= 5) {
      strength = 'strong';
      color = '#10b981';
    } else if (score >= 3) {
      strength = 'medium';
      color = '#f59e0b';
    }

    return {
      score,
      strength,
      color,
      requirements,
      isValid: score >= 4 // Require at least 4 out of 5 criteria
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update password strength for password field
    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }

    // Clear field-specific errors when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear confirm password error if passwords now match
    if (name === 'confirmPassword' || name === 'password') {
      if (errors.confirmPassword &&
          (name === 'confirmPassword' ? value : formData.confirmPassword) ===
          (name === 'password' ? value : formData.password)) {
        setErrors(prev => ({
          ...prev,
          confirmPassword: ''
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!passwordStrength?.isValid) {
      newErrors.password = 'Password does not meet strength requirements';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const registrationData = {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim()
      };

      const response = await authService.register(registrationData);

      // Auto-login after successful registration
      await login(response.data.user, response.data.access_token);

      // Redirect to dashboard
      navigate('/dashboard', { replace: true });

    } catch (error) {
      console.error('Registration error:', error);

      if (error.response?.status === 409) {
        setErrors({ email: 'An account with this email already exists' });
      } else if (error.response?.status === 400) {
        const errorData = error.response.data;

        if (errorData.requirements) {
          setErrors({
            password: 'Password requirements not met',
            passwordRequirements: errorData.requirements
          });
        } else if (errorData.missing_fields) {
          const fieldErrors = {};
          errorData.missing_fields.forEach(field => {
            fieldErrors[field] = 'This field is required';
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ general: errorData.error || 'Invalid registration data' });
        }
      } else if (error.response?.status === 429) {
        setErrors({
          general: 'Too many registration attempts. Please try again later.'
        });
      } else {
        setErrors({
          general: 'Registration failed. Please try again.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordRequirementClass = (requirement) => {
    if (!passwordStrength) return '';
    return passwordStrength.requirements[requirement] ? 'met' : 'unmet';
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join us to get started with your schedule management.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* General error message */}
          {errors.general && (
            <div className="error-message general-error">
              <i className="icon-alert-circle"></i>
              <span>{errors.general}</span>
            </div>
          )}

          {/* Name fields row */}
          <div className="form-row">
            {/* First name */}
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className={`form-input ${errors.firstName ? 'error' : ''}`}
                placeholder="First name"
                autoComplete="given-name"
                required
              />
              {errors.firstName && (
                <span className="error-text">{errors.firstName}</span>
              )}
            </div>

            {/* Last name */}
            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className={`form-input ${errors.lastName ? 'error' : ''}`}
                placeholder="Last name"
                autoComplete="family-name"
                required
              />
              {errors.lastName && (
                <span className="error-text">{errors.lastName}</span>
              )}
            </div>
          </div>

          {/* Email field */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
            {errors.email && (
              <span className="error-text">{errors.email}</span>
            )}
          </div>

          {/* Password field */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Create a secure password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`icon-${showPassword ? 'eye-off' : 'eye'}`}></i>
              </button>
            </div>

            {/* Password strength indicator */}
            {formData.password && passwordStrength && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: `${(passwordStrength.score / 5) * 100}%`,
                      backgroundColor: passwordStrength.color
                    }}
                  ></div>
                </div>
                <span className="strength-text" style={{ color: passwordStrength.color }}>
                  {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                </span>
              </div>
            )}

            {/* Password requirements */}
            {formData.password && (
              <div className="password-requirements">
                <p className="requirements-title">Password must contain:</p>
                <ul className="requirements-list">
                  <li className={getPasswordRequirementClass('length')}>
                    <i className={`icon-${passwordStrength?.requirements.length ? 'check' : 'x'}`}></i>
                    At least 8 characters
                  </li>
                  <li className={getPasswordRequirementClass('uppercase')}>
                    <i className={`icon-${passwordStrength?.requirements.uppercase ? 'check' : 'x'}`}></i>
                    One uppercase letter
                  </li>
                  <li className={getPasswordRequirementClass('lowercase')}>
                    <i className={`icon-${passwordStrength?.requirements.lowercase ? 'check' : 'x'}`}></i>
                    One lowercase letter
                  </li>
                  <li className={getPasswordRequirementClass('number')}>
                    <i className={`icon-${passwordStrength?.requirements.number ? 'check' : 'x'}`}></i>
                    One number
                  </li>
                  <li className={getPasswordRequirementClass('special')}>
                    <i className={`icon-${passwordStrength?.requirements.special ? 'check' : 'x'}`}></i>
                    One special character
                  </li>
                </ul>
              </div>
            )}

            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          {/* Confirm password field */}
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`icon-${showConfirmPassword ? 'eye-off' : 'eye'}`}></i>
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className={`btn btn-primary btn-full ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Sign in link */}
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div className="security-notice">
        <i className="icon-shield"></i>
        <span>Your information is secure and encrypted</span>
      </div>
    </div>
  );
};

export default Register;