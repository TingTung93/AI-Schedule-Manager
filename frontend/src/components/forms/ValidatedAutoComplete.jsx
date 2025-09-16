/**
 * Validated AutoComplete component with integrated error handling
 */

import React from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  CircularProgress,
  Popper,
  Paper
} from '@mui/material';
import { Controller } from 'react-hook-form';
import { styled } from '@mui/material/styles';

const StyledPopper = styled(Popper)(({ theme }) => ({
  zIndex: theme.zIndex.modal + 1,
}));

const ValidatedAutoComplete = ({
  name,
  control,
  label,
  options = [],
  loading = false,
  multiple = false,
  freeSolo = false,
  required = false,
  disabled = false,
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  margin = 'normal',
  placeholder,
  helperText,
  getOptionLabel,
  getOptionValue,
  isOptionEqualToValue,
  renderOption,
  renderTags,
  filterOptions,
  onInputChange,
  noOptionsText = 'No options',
  loadingText = 'Loading...',
  limitTags = -1,
  disableCloseOnSelect = false,
  clearOnBlur = true,
  selectOnFocus = true,
  handleHomeEndKeys = true,
  ...props
}) => {
  // Default option handlers
  const defaultGetOptionLabel = (option) => {
    if (typeof option === 'string') return option;
    return option?.label || option?.name || option?.title || option?.toString() || '';
  };

  const defaultGetOptionValue = (option) => {
    if (typeof option === 'string') return option;
    return option?.value || option?.id || option;
  };

  const defaultIsOptionEqualToValue = (option, value) => {
    const optionValue = (getOptionValue || defaultGetOptionValue)(option);
    const valueValue = (getOptionValue || defaultGetOptionValue)(value);
    return optionValue === valueValue;
  };

  const defaultRenderTags = (tagValue, getTagProps) => {
    return tagValue.map((option, index) => (
      <Chip
        variant="outlined"
        label={(getOptionLabel || defaultGetOptionLabel)(option)}
        size="small"
        {...getTagProps({ index })}
        key={index}
      />
    ));
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const handleChange = (event, newValue) => {
          if (multiple) {
            // For multiple selection, store array of values
            const values = newValue.map(option =>
              (getOptionValue || defaultGetOptionValue)(option)
            );
            field.onChange(values);
          } else {
            // For single selection, store the value
            const value = newValue ? (getOptionValue || defaultGetOptionValue)(newValue) : null;
            field.onChange(value);
          }
        };

        const getCurrentValue = () => {
          if (!field.value) {
            return multiple ? [] : null;
          }

          if (multiple) {
            // Convert stored values back to option objects
            if (Array.isArray(field.value)) {
              return field.value.map(value => {
                const option = options.find(opt =>
                  (getOptionValue || defaultGetOptionValue)(opt) === value
                );
                return option || (freeSolo ? value : null);
              }).filter(Boolean);
            }
            return [];
          } else {
            // Convert stored value back to option object
            const option = options.find(opt =>
              (getOptionValue || defaultGetOptionValue)(opt) === field.value
            );
            return option || (freeSolo ? field.value : null);
          }
        };

        return (
          <Autocomplete
            {...props}
            value={getCurrentValue()}
            onChange={handleChange}
            onInputChange={onInputChange}
            options={options}
            loading={loading}
            multiple={multiple}
            freeSolo={freeSolo}
            disabled={disabled}
            getOptionLabel={getOptionLabel || defaultGetOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue || defaultIsOptionEqualToValue}
            renderOption={renderOption}
            renderTags={renderTags || defaultRenderTags}
            filterOptions={filterOptions}
            noOptionsText={noOptionsText}
            loadingText={loadingText}
            limitTags={limitTags}
            disableCloseOnSelect={disableCloseOnSelect}
            clearOnBlur={clearOnBlur}
            selectOnFocus={selectOnFocus}
            handleHomeEndKeys={handleHomeEndKeys}
            PopperComponent={StyledPopper}
            PaperComponent={(paperProps) => (
              <Paper {...paperProps} sx={{ maxHeight: 300, overflow: 'auto' }} />
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                required={required}
                fullWidth={fullWidth}
                size={size}
                variant={variant}
                margin={margin}
                placeholder={placeholder}
                error={!!error}
                helperText={error?.message || helperText}
                onBlur={field.onBlur}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {loading && <CircularProgress color="inherit" size={20} />}
                      {params.InputProps.endAdornment}
                    </Box>
                  ),
                }}
              />
            )}
          />
        );
      }}
    />
  );
};

export default ValidatedAutoComplete;