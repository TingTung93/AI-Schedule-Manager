import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Chip,
  Badge,
  Divider,
  OutlinedInput,
  useMediaQuery,
  useTheme,
  Collapse,
  IconButton
} from '@mui/material';
import {
  FilterList,
  Clear,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import DateRangeFilter from './DateRangeFilter';

const SHIFT_TYPES = ['Morning', 'Afternoon', 'Evening', 'Night'];

const FilterPanel = ({
  departments = [],
  onFilterChange,
  initialFilters = {},
  showDateFilter = true,
  showShiftTypeFilter = true,
  showDepartmentFilter = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expanded, setExpanded] = useState(!isMobile);

  const [filters, setFilters] = useState({
    departments: initialFilters.departments || [],
    shiftTypes: initialFilters.shiftTypes || [],
    dateRange: initialFilters.dateRange || { start: null, end: null }
  });

  // Update parent when filters change
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.departments.length > 0) count += filters.departments.length;
    if (filters.shiftTypes.length > 0) count += filters.shiftTypes.length;
    if (filters.dateRange.start && filters.dateRange.end) count += 1;
    return count;
  };

  const handleDepartmentChange = (event) => {
    const {
      target: { value }
    } = event;
    setFilters(prev => ({
      ...prev,
      departments: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const handleShiftTypeChange = (type) => {
    setFilters(prev => ({
      ...prev,
      shiftTypes: prev.shiftTypes.includes(type)
        ? prev.shiftTypes.filter(t => t !== type)
        : [...prev.shiftTypes, type]
    }));
  };

  const handleDateRangeChange = (dateRange) => {
    setFilters(prev => ({
      ...prev,
      dateRange
    }));
  };

  const handleClearAll = () => {
    setFilters({
      departments: [],
      shiftTypes: [],
      dateRange: { start: null, end: null }
    });
  };

  const handleRemoveFilter = (filterType, value) => {
    if (filterType === 'department') {
      setFilters(prev => ({
        ...prev,
        departments: prev.departments.filter(d => d !== value)
      }));
    } else if (filterType === 'shiftType') {
      setFilters(prev => ({
        ...prev,
        shiftTypes: prev.shiftTypes.filter(t => t !== value)
      }));
    } else if (filterType === 'dateRange') {
      setFilters(prev => ({
        ...prev,
        dateRange: { start: null, end: null }
      }));
    }
  };

  const formatDateRange = (dateRange) => {
    if (!dateRange.start || !dateRange.end) return '';
    const start = new Date(dateRange.start).toLocaleDateString();
    const end = new Date(dateRange.end).toLocaleDateString();
    return `${start} - ${end}`;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: expanded ? 2 : 0 }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Badge badgeContent={activeFilterCount} color="primary">
            <FilterList />
          </Badge>
          <Typography variant="h6" fontWeight="bold">
            Filters
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          {activeFilterCount > 0 && (
            <Button
              size="small"
              startIcon={<Clear />}
              onClick={handleClearAll}
              color="secondary"
            >
              Clear All
            </Button>
          )}
          {isMobile && (
            <IconButton
              onClick={() => setExpanded(!expanded)}
              size="small"
              aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Filter Content */}
      <Collapse in={expanded}>
        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
              Active Filters ({activeFilterCount})
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {filters.departments.map(dept => (
                <Chip
                  key={dept}
                  label={`Dept: ${dept}`}
                  onDelete={() => handleRemoveFilter('department', dept)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
              {filters.shiftTypes.map(type => (
                <Chip
                  key={type}
                  label={`Shift: ${type}`}
                  onDelete={() => handleRemoveFilter('shiftType', type)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
              {filters.dateRange.start && filters.dateRange.end && (
                <Chip
                  label={formatDateRange(filters.dateRange)}
                  onDelete={() => handleRemoveFilter('dateRange')}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        {/* Department Filter */}
        {showDepartmentFilter && departments.length > 0 && (
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel id="department-filter-label">Departments</InputLabel>
            <Select
              labelId="department-filter-label"
              multiple
              value={filters.departments}
              onChange={handleDepartmentChange}
              input={<OutlinedInput label="Departments" />}
              renderValue={(selected) =>
                selected.length === 0
                  ? 'All Departments'
                  : `${selected.length} selected`
              }
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.name}>
                  <Checkbox checked={filters.departments.indexOf(dept.name) > -1} />
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Shift Type Filter */}
        {showShiftTypeFilter && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Shift Types
            </Typography>
            <FormGroup row>
              {SHIFT_TYPES.map(type => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={filters.shiftTypes.includes(type)}
                      onChange={() => handleShiftTypeChange(type)}
                      size="small"
                    />
                  }
                  label={type}
                />
              ))}
            </FormGroup>
          </Box>
        )}

        {/* Date Range Filter */}
        {showDateFilter && (
          <DateRangeFilter
            onDateRangeChange={handleDateRangeChange}
            initialRange={filters.dateRange}
          />
        )}
      </Collapse>
    </Paper>
  );
};

export default FilterPanel;
