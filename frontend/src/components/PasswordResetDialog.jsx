import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ContentCopy,
  CheckCircle
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

const PasswordResetDialog = ({ open, onClose, employee, onSuccess }) => {
  const [sendEmail, setSendEmail] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post(
        `/api/employees/${employee.id}/reset-password`,
        null,
        {
          params: { send_email: sendEmail }
        }
      );

      setPassword(response.data.temporary_password);

      if (onSuccess) {
        onSuccess('Password reset successfully');
      }
    } catch (err) {
      console.error('[PasswordResetDialog] Error resetting password:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setShowPassword(false);
    setCopied(false);
    setSendEmail(true);
    onClose();
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
        Reset Password
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!password ? (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Reset password for: <strong>{employeeName}</strong>
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Send temporary password via email"
              />

              {!sendEmail && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  You will need to manually provide the temporary password to the employee.
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Warning:</strong> This password is displayed only once. Copy it now!
              </Alert>

              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Temporary Password:
              </Typography>

              <TextField
                fullWidth
                value={password}
                type={showPassword ? 'text' : 'password'}
                InputProps={{
                  readOnly: true,
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '1.1rem',
                    bgcolor: 'action.hover'
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton
                        onClick={handleCopy}
                        edge="end"
                        color={copied ? 'success' : 'default'}
                      >
                        {copied ? <CheckCircle /> : <ContentCopy />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2 }}
              />

              {sendEmail && (
                <Alert severity="info">
                  An email with the temporary password has been sent to: <strong>{employee.email}</strong>
                </Alert>
              )}

              {!sendEmail && (
                <Alert severity="warning">
                  Make sure to securely provide this password to the employee.
                </Alert>
              )}
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {password ? 'Close' : 'Cancel'}
        </Button>
        {!password && (
          <Button
            onClick={handleReset}
            variant="contained"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            Reset Password
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PasswordResetDialog;
