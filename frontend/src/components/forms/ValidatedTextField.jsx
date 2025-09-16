/**
 * Validated TextField component with integrated error handling and formatting
 */

import React, { useState, useCallback } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Box,
  Tooltip
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
  Warning,
  Info
} from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import { validateAndFormatPhone, checkPasswordStrength } from '../../utils/validation';

const ValidatedTextField = ({
  name,
  control,
  label,
  type = 'text',
  required = false,
  multiline = false,
  rows = 1,
  placeholder,
  helperText,
  startAdornment,
  endAdornment,
  autoFormat = false,
  showPasswordStrength = false,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  margin = 'normal',
  autoComplete,
  inputProps,
  onBlur,
  onChange,
  validation,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  const handlePasswordToggle = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const formatValue = useCallback((value, fieldType) => {
    if (!value || !autoFormat) return value;

    switch (fieldType) {
      case 'phone':
        const { formatted } = validateAndFormatPhone(value);
        return formatted;
      case 'currency':
        const numericValue = value.replace(/[^\d.]/g, '');
        return numericValue ? `$${parseFloat(numericValue).toFixed(2)}` : '';
      default:
        return value;
    }
  }, [autoFormat]);

  const getPasswordStrengthColor = (strength) => {
    switch (strength?.score) {
      case 0:
      case 1:
        return 'error';
      case 2:
        return 'warning';
      case 3:
        return 'info';
      case 4:
        return 'success';
      default:
        return 'default';
    }
  };

  const getPasswordStrengthIcon = (strength) => {
    switch (strength?.score) {
      case 0:
      case 1:
        return <Error color="error" />;
      case 2:
        return <Warning color="warning" />;
      case 3:
        return <Info color="info" />;
      case 4:
        return <CheckCircle color="success" />;
      default:
        return null;
    }
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const handleChange = (event) => {
          let value = event.target.value;

          // Handle password strength checking
          if (type === 'password' && showPasswordStrength) {
            const strength = checkPasswordStrength(value);
            setPasswordStrength(strength);
          }

          // Handle auto-formatting
          if (autoFormat) {
            value = formatValue(value, type);
          }

          // Call custom onChange if provided
          if (onChange) {
            onChange(event);
          }

          // Update form field
          field.onChange(value);
        };

        const handleBlur = (event) => {
          // Handle auto-formatting on blur
          if (autoFormat && field.value) {
            const formattedValue = formatValue(field.value, type);
            if (formattedValue !== field.value) {
              field.onChange(formattedValue);
            }
          }

          // Call custom onBlur if provided
          if (onBlur) {
            onBlur(event);
          }

          field.onBlur();
        };

        // Determine field type for rendering
        const fieldType = type === 'password' && showPassword ? 'text' : type;

        // Build end adornment
        let endAdornmentElement = endAdornment;

        if (type === 'password') {
          const passwordToggle = (
            <IconButton
              onClick={handlePasswordToggle}
              edge="end"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          );

          endAdornmentElement = endAdornment ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {endAdornment}
              {passwordToggle}
            </Box>
          ) : passwordToggle;
        }

        return (
          <Box>
            <TextField
              {...field}
              {...props}
              label={label}
              type={fieldType}
              required={required}
              multiline={multiline}
              rows={rows}
              placeholder={placeholder}
              disabled={disabled}
              fullWidth={fullWidth}
              size={size}
              variant={variant}
              margin={margin}
              autoComplete={autoComplete}
              error={!!error}
              helperText={error?.message || helperText}
              onChange={handleChange}
              onBlur={handleBlur}
              InputProps={{
                startAdornment: startAdornment && (
                  <InputAdornment position="start">
                    {startAdornment}
                  </InputAdornment>
                ),
                endAdornment: endAdornmentElement && (
                  <InputAdornment position="end">
                    {endAdornmentElement}
                  </InputAdornment>
                ),
                ...inputProps
              }}
            />

            {/* Password Strength Indicator */}
            {type === 'password' && showPasswordStrength && passwordStrength && field.value && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getPasswordStrengthIcon(passwordStrength)}
                  <Typography
                    variant="caption"
                    color={getPasswordStrengthColor(passwordStrength)}
                  >
                    Password Strength: {passwordStrength.strength}
                  </Typography>
                </Box>

                {/* Strength Bar */}
                <Box sx={{ mt: 0.5, width: '100%', height: 4, bgcolor: 'grey.300', borderRadius: 2 }}>
                  <Box
                    sx={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      height: '100%',
                      bgcolor: `${getPasswordStrengthColor(passwordStrength)}.main`,
                      borderRadius: 2,
                      transition: 'all 0.3s ease'
                    }}
                  />
                </Box>

                {/* Feedback Messages */}
                {passwordStrength.feedback.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    {passwordStrength.feedback.map((feedback, index) => (
                      <Typography
                        key={index}
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        • {feedback}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Validation Status Icon */}
            {!error && field.value && validation?.success && (
              <Tooltip title="Valid input">
                <CheckCircle
                  color="success"
                  sx={{
                    position: 'absolute',
                    right: type === 'password' ? 80 : 48,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 20
                  }}
                />
              </Tooltip>
            )}
          </Box>
        );
      }}
    />
  );
};

export default ValidatedTextField;