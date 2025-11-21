import React, { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  ListItem,
  ListItemText,
  Checkbox,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import GroupIcon from '@mui/icons-material/Group';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../../services/api';

/**
 * DepartmentSelector Component
 *
 * Reusable hierarchical department selector with advanced features.
 *
 * Features:
 * - Hierarchical department tree dropdown
 * - Search departments by name
 * - Show employee count per department
 * - Highlight departments at capacity
 * - Multi-select option
 * - Keyboard navigation support
 * - Recent selections memory
 * - Loading states
 *
 * @param {Object} props
 * @param {string|number|Array} [props.value] - Selected department ID(s)
 * @param {Function} props.onChange - Change handler (value, option)
 * @param {boolean} [props.multiple=false] - Enable multi-select
 * @param {boolean} [props.showEmployeeCount=true] - Show employee count
 * @param {boolean} [props.showInactive=false] - Include inactive departments
 * @param {boolean} [props.disableAtCapacity=true] - Disable departments at capacity
 * @param {string} [props.label='Department'] - Input label
 * @param {string} [props.placeholder='Select department...'] - Placeholder text
 * @param {boolean} [props.required=false] - Required field
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.error] - Error message
 * @param {string} [props.size='medium'] - Input size
 */
const DepartmentSelector = ({
  value,
  onChange,
  multiple = false,
  showEmployeeCount = true,
  showInactive = false,
  disableAtCapacity = true,
  label = 'Department',
  placeholder = 'Select department...',
  required = false,
  disabled = false,
  error = '',
  size = 'medium',
}) => {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [recentSelections, setRecentSelections] = useState([]);

  // Load departments
  useEffect(() => {
    loadDepartments();
    loadRecentSelections();
  }, [showInactive]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (!showInactive) {
        params.active = true;
      }

      const response = await api.get('/api/departments', { params });
      const deptData = response.data.items || response.data;

      // Sort departments hierarchically
      const sorted = sortDepartmentsHierarchically(deptData);
      setDepartments(sorted);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSelections = () => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentDepartments') || '[]');
      setRecentSelections(recent);
    } catch (err) {
      console.error('Failed to load recent selections:', err);
    }
  };

  const saveRecentSelection = (departmentId) => {
    try {
      let recent = JSON.parse(localStorage.getItem('recentDepartments') || '[]');

      // Add to front and remove duplicates
      recent = [departmentId, ...recent.filter(id => id !== departmentId)];

      // Keep only last 5
      recent = recent.slice(0, 5);

      localStorage.setItem('recentDepartments', JSON.stringify(recent));
      setRecentSelections(recent);
    } catch (err) {
      console.error('Failed to save recent selection:', err);
    }
  };

  // Sort departments hierarchically
  const sortDepartmentsHierarchically = (depts) => {
    const sorted = [];
    const deptMap = new Map();

    // Create map for quick lookup
    depts.forEach(dept => deptMap.set(dept.id, { ...dept, children: [] }));

    // Build tree structure
    const roots = [];
    deptMap.forEach(dept => {
      if (dept.parentDepartmentId) {
        const parent = deptMap.get(dept.parentDepartmentId);
        if (parent) {
          parent.children.push(dept);
        } else {
          roots.push(dept); // Parent not found, treat as root
        }
      } else {
        roots.push(dept);
      }
    });

    // Flatten tree with indentation
    const flatten = (dept, level = 0) => {
      sorted.push({ ...dept, level });
      dept.children
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .forEach(child => flatten(child, level + 1));
    };

    roots
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(dept => flatten(dept));

    return sorted;
  };

  // Get selected option(s)
  const selectedOption = useMemo(() => {
    if (!value) return multiple ? [] : null;

    if (multiple) {
      return departments.filter(dept => value.includes(dept.id));
    } else {
      return departments.find(dept => dept.id === value) || null;
    }
  }, [value, departments, multiple]);

  // Handle change
  const handleChange = (event, newValue) => {
    if (multiple) {
      const selectedIds = newValue.map(opt => opt.id);
      onChange(selectedIds, newValue);
      selectedIds.forEach(id => saveRecentSelection(id));
    } else {
      onChange(newValue?.id || null, newValue);
      if (newValue) {
        saveRecentSelection(newValue.id);
      }
    }
  };

  // Check if department is at capacity
  const isAtCapacity = (dept) => {
    if (!dept.capacity) return false;
    return dept.employeeCount >= dept.capacity;
  };

  // Get option disabled state
  const getOptionDisabled = (option) => {
    if (disabled) return true;
    if (!option.active) return true;
    if (disableAtCapacity && isAtCapacity(option)) return true;
    return false;
  };

  // Render option
  const renderOption = (props, option, { selected }) => {
    const atCapacity = isAtCapacity(option);
    const isRecent = recentSelections.includes(option.id);

    return (
      <ListItem
        {...props}
        key={option.id}
        sx={{
          pl: option.level * 3 + 2,
          opacity: option.active ? 1 : 0.6,
        }}
      >
        {multiple && (
          <Checkbox
            checked={selected}
            sx={{ mr: 1 }}
          />
        )}
        <Box sx={{ mr: 1 }}>
          <FolderIcon fontSize="small" color={option.active ? 'primary' : 'disabled'} />
        </Box>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2">
                {option.name}
              </Typography>
              {isRecent && (
                <Chip label="Recent" size="small" color="info" />
              )}
              {!option.active && (
                <Chip label="Inactive" size="small" />
              )}
              {atCapacity && (
                <Chip
                  icon={<WarningIcon fontSize="small" />}
                  label="At Capacity"
                  size="small"
                  color="warning"
                />
              )}
            </Box>
          }
          secondary={
            showEmployeeCount && (
              <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                <GroupIcon fontSize="small" sx={{ fontSize: 14 }} />
                <Typography variant="caption">
                  {option.employeeCount || 0} employee(s)
                  {option.capacity && ` / ${option.capacity} capacity`}
                </Typography>
              </Box>
            )
          }
        />
      </ListItem>
    );
  };

  // Render input
  const renderInput = (params) => (
    <TextField
      {...params}
      label={label}
      placeholder={placeholder}
      required={required}
      error={!!error}
      helperText={error}
      size={size}
      InputProps={{
        ...params.InputProps,
        endAdornment: (
          <>
            {loading ? <CircularProgress color="inherit" size={20} /> : null}
            {params.InputProps.endAdornment}
          </>
        ),
      }}
    />
  );

  return (
    <Autocomplete
      multiple={multiple}
      value={selectedOption}
      onChange={handleChange}
      options={departments}
      getOptionLabel={(option) => option.name || ''}
      getOptionDisabled={getOptionDisabled}
      renderOption={renderOption}
      renderInput={renderInput}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      filterOptions={(options, { inputValue }) => {
        if (!inputValue) return options;

        const query = inputValue.toLowerCase();
        return options.filter(opt =>
          opt.name?.toLowerCase().includes(query) ||
          opt.description?.toLowerCase().includes(query)
        );
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            key={option.id}
            label={option.name}
            size="small"
            {...getTagProps({ index })}
          />
        ))
      }
      sx={{
        minWidth: 200,
      }}
    />
  );
};

export default DepartmentSelector;
