import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment,
  LinearProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

const ChangePasswordDialog = ({ open, onClose, employee, isSelf, onSuccess }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculateStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  const getStrengthColor = (strength) => {
    if (strength <= 1) return 'error';
    if (strength <= 2) return 'warning';
    if (strength <= 3) return 'info';
    return 'success';
  };

  const getStrengthLabel = (strength) => {
    if (strength === 0) return 'Too weak';
    if (strength === 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    if (strength === 4) return 'Strong';
    return 'Very strong';
  };

  const passwordStrength = calculateStrength(formData.newPassword);

  const validatePassword = () => {
    if (!formData.newPassword) {
      return 'New password is required';
    }
    if (formData.newPassword.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    if (passwordStrength < 3) {
      return 'Password is too weak. Use a mix of uppercase, lowercase, numbers, and special characters';
    }
    if (isSelf && !formData.currentPassword) {
      return 'Current password is required';
    }
    return null;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        new_password: formData.newPassword
      };

      if (isSelf) {
        payload.current_password = formData.currentPassword;
      }

      await api.post(`/api/employees/${employee.id}/change-password`, payload);

      if (onSuccess) {
        onSuccess('Password changed successfully');
      }

      handleClose();
    } catch (err) {
      console.error('[ChangePasswordDialog] Error changing password:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
    setError('');
    onClose();
  };

  const toggleShowPassword = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const employeeName = employee
    ? `${employee.firstName || employee.first_name} ${employee.lastName || employee.last_name}`
    : '';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Change Password
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body1" sx={{ mb: 3 }}>
            {isSelf ? 'Update your password' : `Change password for: ${employeeName}`}
          </Typography>

          {isSelf && (
            <TextField
              fullWidth
              label="Current Password"
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => handleChange('currentPassword', e.target.value)}
              disabled={loading}
              required
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => toggleShowPassword('current')}
                      edge="end"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          )}

          <TextField
            fullWidth
            label="New Password"
            type={showPasswords.new ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={(e) => handleChange('newPassword', e.target.value)}
            disabled={loading}
            required
            sx={{ mb: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => toggleShowPassword('new')}
                    edge="end"
                  >
                    {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {formData.newPassword && (
            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" color="textSecondary">
                  Password Strength:
                </Typography>
                <Typography variant="caption" color={`${getStrengthColor(passwordStrength)}.main`}>
                  {getStrengthLabel(passwordStrength)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(passwordStrength / 5) * 100}
                color={getStrengthColor(passwordStrength)}
                sx={{ height: 6, borderRadius: 1 }}
              />
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                Requirements: 8+ characters, uppercase, lowercase, numbers, special characters
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            label="Confirm New Password"
            type={showPasswords.confirm ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            disabled={loading}
            required
            error={formData.confirmPassword && formData.newPassword !== formData.confirmPassword}
            helperText={
              formData.confirmPassword && formData.newPassword !== formData.confirmPassword
                ? 'Passwords do not match'
                : ''
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => toggleShowPassword('confirm')}
                    edge="end"
                  >
                    {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !formData.newPassword || !formData.confirmPassword}
          startIcon={loading && <CircularProgress size={20} />}
        >
          Change Password
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangePasswordDialog;
