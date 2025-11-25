import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  AlertTitle,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

/**
 * AccountStatusDialog Component
 *
 * Modal dialog for managing employee account status.
 *
 * Features:
 * - Status selector: active, inactive, locked, verified
 * - Reason textarea (required for lock/deactivate)
 * - Confirmation for destructive actions
 * - Loading states and error handling
 * - Visual feedback for status changes
 *
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.employee - Employee object with id, name, status
 * @param {Function} [props.onSuccess] - Success callback
 */
const AccountStatusDialog = ({ open, onClose, employee, onSuccess }) => {
  const [status, setStatus] = useState('active');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize status when employee changes
  useEffect(() => {
    if (employee && open) {
      setStatus(employee.status || 'active');
      setReason('');
      setError(null);
      setShowConfirmation(false);
    }
  }, [employee, open]);

  // Status configuration
  const statusConfig = {
    active: {
      label: 'Active',
      color: 'success',
      icon: <CheckCircleIcon />,
      description: 'Employee can access the system normally',
      requiresReason: false,
      isDestructive: false,
    },
    inactive: {
      label: 'Inactive',
      color: 'default',
      icon: <InfoIcon />,
      description: 'Employee cannot log in (e.g., on leave, temporarily disabled)',
      requiresReason: true,
      isDestructive: true,
    },
    locked: {
      label: 'Locked',
      color: 'error',
      icon: <LockIcon />,
      description: 'Account locked due to security concerns or violations',
      requiresReason: true,
      isDestructive: true,
    },
    verified: {
      label: 'Verified',
      color: 'primary',
      icon: <CheckCircleIcon />,
      description: 'Email verified and account fully activated',
      requiresReason: false,
      isDestructive: false,
    },
  };

  const currentConfig = statusConfig[status] || statusConfig.active;
  const originalStatus = employee?.status || 'active';
  const hasChanged = status !== originalStatus;

  // Validation
  const isValid = () => {
    if (!hasChanged) return false;
    if (currentConfig.requiresReason && !reason.trim()) return false;
    return true;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isValid()) return;

    // Show confirmation for destructive actions
    if (currentConfig.isDestructive && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.patch(`/api/employees/${employee.id}/status`, {
        status,
        reason: reason.trim() || undefined,
      });

      if (onSuccess) {
        onSuccess();
      }

      handleClose();
    } catch (err) {
      console.error('Status update failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setStatus(employee?.status || 'active');
    setReason('');
    setError(null);
    setShowConfirmation(false);
    onClose();
  };

  // Handle status change
  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setShowConfirmation(false);
    setError(null);
  };

  if (!employee) return null;

  const employeeName = `${employee.firstName || employee.first_name || ''} ${employee.lastName || employee.last_name || ''}`.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="status-dialog-title"
    >
      <DialogTitle id="status-dialog-title">
        Manage Account Status
      </DialogTitle>

      <DialogContent>
        {/* Employee Info */}
        <Box mb={3}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Employee
          </Typography>
          <Typography variant="h6">{employeeName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {employee.email}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Confirmation Warning */}
        {showConfirmation && currentConfig.isDestructive && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>Confirm Action</AlertTitle>
            <Typography variant="body2">
              You are about to change the status to{' '}
              <strong>{currentConfig.label}</strong>. This will prevent the
              employee from accessing the system.
            </Typography>
            {reason.trim() && (
              <Box mt={1}>
                <Typography variant="body2" fontWeight="medium">
                  Reason: {reason}
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        {/* Status Selector */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Account Status</InputLabel>
          <Select
            value={status}
            label="Account Status"
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={loading}
          >
            {Object.entries(statusConfig).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                <Box display="flex" alignItems="center" gap={1}>
                  {React.cloneElement(config.icon, {
                    fontSize: 'small',
                    color: config.color,
                  })}
                  <span>{config.label}</span>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Status Description */}
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'background.default' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              {React.cloneElement(currentConfig.icon, {
                color: currentConfig.color,
              })}
              <Typography variant="subtitle2">{currentConfig.label}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {currentConfig.description}
            </Typography>
          </CardContent>
        </Card>

        {/* Reason Field (required for certain statuses) */}
        {(currentConfig.requiresReason || reason.trim()) && (
          <TextField
            fullWidth
            multiline
            rows={3}
            label={currentConfig.requiresReason ? 'Reason (Required)' : 'Reason (Optional)'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            required={currentConfig.requiresReason}
            placeholder="Explain why this status change is necessary..."
            helperText={
              currentConfig.requiresReason
                ? 'A reason is required for this status change'
                : 'Optional explanation for the status change'
            }
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid() || loading}
          color={showConfirmation && currentConfig.isDestructive ? 'error' : 'primary'}
        >
          {loading ? (
            <>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              Updating...
            </>
          ) : showConfirmation && currentConfig.isDestructive ? (
            'Confirm Change'
          ) : (
            'Update Status'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccountStatusDialog;
