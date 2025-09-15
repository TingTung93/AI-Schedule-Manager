/**
 * Login Component
 *
 * Provides secure login form with validation, rate limiting display,
 * and proper error handling for the JWT authentication system.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';
import './Auth.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockoutInfo, setLockoutInfo] = useState(null);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field-specific errors when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
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
    setRemainingAttempts(null);
    setLockoutInfo(null);

    try {
      const response = await authService.login(formData.email, formData.password);

      // Call login from AuthContext to update app state
      await login(response.data.user, response.data.access_token);

      // Redirect to intended page or dashboard
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });

    } catch (error) {
      console.error('Login error:', error);

      if (error.response?.status === 401) {
        const errorData = error.response.data;

        if (errorData.remaining_attempts !== undefined) {
          setRemainingAttempts(errorData.remaining_attempts);
          setErrors({
            general: `Invalid credentials. ${errorData.remaining_attempts} attempts remaining.`
          });
        } else {
          setErrors({ general: 'Invalid email or password' });
        }
      } else if (error.response?.status === 423) {
        // Account locked
        const errorData = error.response.data;
        setLockoutInfo({
          message: errorData.message,
          lockedUntil: errorData.locked_until
        });
        setErrors({ general: 'Account is temporarily locked' });
      } else if (error.response?.status === 429) {
        // Rate limited
        setErrors({
          general: 'Too many login attempts. Please try again later.'
        });
      } else if (error.response?.status === 403) {
        setErrors({ general: 'Account is deactivated. Please contact support.' });
      } else {
        setErrors({
          general: 'Login failed. Please try again.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatLockoutTime = (lockedUntil) => {
    if (!lockedUntil) return '';

    const lockDate = new Date(lockedUntil);
    const now = new Date();
    const diffMs = lockDate - now;

    if (diffMs <= 0) return 'shortly';

    const diffMins = Math.ceil(diffMs / (1000 * 60));
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Sign In</h1>
          <p>Welcome back! Please sign in to your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* General error message */}
          {errors.general && (
            <div className="error-message general-error">
              <i className="icon-alert-circle"></i>
              <span>{errors.general}</span>
            </div>
          )}

          {/* Account lockout information */}
          {lockoutInfo && (
            <div className="warning-message">
              <i className="icon-lock"></i>
              <div>
                <strong>Account Temporarily Locked</strong>
                <p>Your account will be unlocked in {formatLockoutTime(lockoutInfo.lockedUntil)}.</p>
              </div>
            </div>
          )}

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
                placeholder="Enter your password"
                autoComplete="current-password"
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
            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          {/* Remaining attempts warning */}
          {remainingAttempts !== null && remainingAttempts <= 2 && (
            <div className="warning-message">
              <i className="icon-alert-triangle"></i>
              <span>
                Warning: {remainingAttempts} login attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                before account lockout.
              </span>
            </div>
          )}

          {/* Forgot password link */}
          <div className="form-actions">
            <Link to="/forgot-password" className="link-secondary">
              Forgot your password?
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className={`btn btn-primary btn-full ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || !!lockoutInfo}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Sign up link */}
        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="link-primary">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div className="security-notice">
        <i className="icon-shield"></i>
        <span>Your connection is secure and encrypted</span>
      </div>
    </div>
  );
};

export default Login;