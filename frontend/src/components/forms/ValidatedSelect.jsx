/**
 * Validated Select component with integrated error handling
 */

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Box,
  ListItemText,
  Checkbox,
  OutlinedInput
} from '@mui/material';
import { Controller } from 'react-hook-form';

const ValidatedSelect = ({
  name,
  control,
  label,
  options = [],
  required = false,
  multiple = false,
  placeholder,
  helperText,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  margin = 'normal',
  renderValue,
  displayEmpty = false,
  ...props
}) => {
  const getOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option?.label || option?.name || option?.toString() || '';
  };

  const getOptionValue = (option) => {
    if (typeof option === 'string') return option;
    return option?.value || option?.id || option;
  };

  const defaultRenderValue = (selected) => {
    if (!selected || (Array.isArray(selected) && selected.length === 0)) {
      return placeholder || '';
    }

    if (multiple) {
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {selected.map((value) => {
            const option = options.find(opt => getOptionValue(opt) === value);
            return (
              <Chip
                key={value}
                label={getOptionLabel(option) || value}
                size="small"
                variant="outlined"
              />
            );
          })}
        </Box>
      );
    }

    const option = options.find(opt => getOptionValue(opt) === selected);
    return getOptionLabel(option) || selected;
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <FormControl
          fullWidth={fullWidth}
          size={size}
          variant={variant}
          margin={margin}
          required={required}
          disabled={disabled}
          error={!!error}
        >
          <InputLabel id={`${name}-label`}>
            {label}
          </InputLabel>
          <Select
            {...field}
            {...props}
            labelId={`${name}-label`}
            label={label}
            multiple={multiple}
            displayEmpty={displayEmpty}
            input={multiple ? <OutlinedInput label={label} /> : undefined}
            renderValue={renderValue || defaultRenderValue}
            value={field.value || (multiple ? [] : '')}
            onChange={(event) => {
              const value = event.target.value;
              field.onChange(value);
            }}
          >
            {displayEmpty && !multiple && (
              <MenuItem value="">
                <em>{placeholder || 'None'}</em>
              </MenuItem>
            )}

            {options.map((option, index) => {
              const value = getOptionValue(option);
              const label = getOptionLabel(option);

              return (
                <MenuItem
                  key={`${value}-${index}`}
                  value={value}
                  disabled={option.disabled}
                >
                  {multiple && (
                    <Checkbox
                      checked={field.value?.includes(value) || false}
                      size="small"
                    />
                  )}
                  <ListItemText primary={label} />
                </MenuItem>
              );
            })}
          </Select>

          {(error?.message || helperText) && (
            <FormHelperText>
              {error?.message || helperText}
            </FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
};

export default ValidatedSelect;