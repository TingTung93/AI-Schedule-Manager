/**
 * Validated DatePicker component with integrated error handling
 */

import React from 'react';
import { DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TextField, Box } from '@mui/material';
import { Controller } from 'react-hook-form';
import { format, isValid, parseISO } from 'date-fns';

const ValidatedDatePicker = ({
  name,
  control,
  label,
  type = 'date', // 'date', 'time', 'datetime'
  required = false,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  margin = 'normal',
  helperText,
  minDate,
  maxDate,
  disablePast = false,
  disableFuture = false,
  shouldDisableDate,
  shouldDisableTime,
  format: dateFormat,
  openTo = 'day',
  views,
  ...props
}) => {
  // Default formats
  const defaultFormats = {
    date: 'yyyy-MM-dd',
    time: 'HH:mm',
    datetime: 'yyyy-MM-dd HH:mm'
  };

  const displayFormat = dateFormat || defaultFormats[type] || defaultFormats.date;

  const parseValue = (value) => {
    if (!value) return null;

    if (value instanceof Date && isValid(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed : null;
    }

    return null;
  };

  const formatValue = (date) => {
    if (!date || !isValid(date)) return '';

    try {
      return format(date, displayFormat);
    } catch (error) {
      console.warn('Date formatting error:', error);
      return '';
    }
  };

  const getPickerComponent = () => {
    switch (type) {
      case 'time':
        return TimePicker;
      case 'datetime':
        return DateTimePicker;
      default:
        return DatePicker;
    }
  };

  const PickerComponent = getPickerComponent();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => {
          const handleChange = (newValue) => {
            if (type === 'time' && newValue) {
              // For time picker, format as HH:mm string
              const formatted = format(newValue, 'HH:mm');
              field.onChange(formatted);
            } else if (newValue && isValid(newValue)) {
              // For date/datetime, store as ISO string
              field.onChange(newValue.toISOString());
            } else {
              field.onChange(null);
            }
          };

          const fieldValue = parseValue(field.value);

          return (
            <Box>
              <PickerComponent
                {...props}
                label={label}
                value={fieldValue}
                onChange={handleChange}
                disabled={disabled}
                minDate={minDate}
                maxDate={maxDate}
                disablePast={disablePast}
                disableFuture={disableFuture}
                shouldDisableDate={shouldDisableDate}
                shouldDisableTime={shouldDisableTime}
                openTo={openTo}
                views={views}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth={fullWidth}
                    size={size}
                    variant={variant}
                    margin={margin}
                    required={required}
                    error={!!error}
                    helperText={error?.message || helperText}
                    onBlur={field.onBlur}
                  />
                )}
                inputFormat={displayFormat}
              />
            </Box>
          );
        }}
      />
    </LocalizationProvider>
  );
};

export default ValidatedDatePicker;