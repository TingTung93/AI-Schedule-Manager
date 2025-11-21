import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Login as LoginIcon
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/api';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const location = useLocation();

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = location.state?.from || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Call backend API to authenticate
      const response = await authService.login(formData.email, formData.password);

      // Extract token from response (handle both camelCase and snake_case)
      const token = response.data.accessToken || response.data.access_token;
      const user = response.data.user;

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // Update auth context with user data and token
      const result = await login(user, token);

      if (!result.success) {
        throw new Error(result.error || 'Login failed');
      }

      // Navigation will be handled by the auth state change
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      // Call backend API to authenticate with demo account
      const response = await authService.login('demo@example.com', 'Demo123!');

      // Extract token from response (handle both camelCase and snake_case)
      const token = response.data.accessToken || response.data.access_token;
      const user = response.data.user;

      if (!token || !user) {
        throw new Error('Invalid response from server');
      }

      // Update auth context with user data and token
      const result = await login(user, token);

      if (!result.success) {
        throw new Error(result.error || 'Demo login failed');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setError(err.response?.data?.message || err.message || 'Demo login failed. Please try manual login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        p: 2
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card
          sx={{
            maxWidth: 400,
            width: '100%',
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Header */}
            <Box textAlign="center" mb={4}>
              <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
                ScheduleAI
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Sign in to manage your schedules
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                name="email"
                type="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                name="password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                sx={{ mb: 3 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
                sx={{ mb: 2, py: 1.5 }}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>

              <Divider sx={{ my: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  OR
                </Typography>
              </Divider>

              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={handleDemoLogin}
                disabled={isLoading}
                sx={{ mb: 3, py: 1.5 }}
              >
                Try Demo Account
              </Button>

              <Box textAlign="center">
                <Typography variant="body2" color="textSecondary">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 600 }}
                  >
                    Sign up here
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
};

export default LoginPage;