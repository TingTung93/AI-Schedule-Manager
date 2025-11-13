import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import {
  Today,
  DateRange,
  CalendarMonth,
  Event
} from '@mui/icons-material';

const DateRangeFilter = ({ onDateRangeChange, initialRange = null }) => {
  const [quickFilter, setQuickFilter] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState(initialRange || { start: null, end: null });

  // Get date range for quick filters
  const getQuickDateRange = (filterType) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (filterType) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Start of week (Monday)
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        // End of week (Sunday)
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        return { start: null, end: null };
      default:
        return { start: null, end: null };
    }

    return { start, end };
  };

  const handleQuickFilterChange = (event, newFilter) => {
    if (newFilter === null) {
      // Clear filter
      setQuickFilter('');
      setCustomStart('');
      setCustomEnd('');
      const newRange = { start: null, end: null };
      setDateRange(newRange);
      onDateRangeChange(newRange);
      return;
    }

    setQuickFilter(newFilter);

    if (newFilter === 'custom') {
      // Custom filter selected, wait for date inputs
      return;
    }

    // Apply quick filter
    const range = getQuickDateRange(newFilter);
    setDateRange(range);
    onDateRangeChange(range);

    // Clear custom inputs
    setCustomStart('');
    setCustomEnd('');
  };

  const handleCustomStartChange = (e) => {
    const startDate = e.target.value;
    setCustomStart(startDate);

    if (startDate && customEnd) {
      const start = new Date(startDate);
      const end = new Date(customEnd);

      // Validate end date is after start date
      if (end >= start) {
        const newRange = { start, end };
        setDateRange(newRange);
        onDateRangeChange(newRange);
      }
    }
  };

  const handleCustomEndChange = (e) => {
    const endDate = e.target.value;
    setCustomEnd(endDate);

    if (customStart && endDate) {
      const start = new Date(customStart);
      const end = new Date(endDate);

      // Validate end date is after start date
      if (end >= start) {
        const newRange = { start, end };
        setDateRange(newRange);
        onDateRangeChange(newRange);
      }
    }
  };

  // Format date for display
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
        Date Range
      </Typography>

      <ToggleButtonGroup
        value={quickFilter}
        exclusive
        onChange={handleQuickFilterChange}
        size="small"
        fullWidth
        sx={{ mb: 2 }}
      >
        <ToggleButton value="today" aria-label="Today">
          <Today sx={{ mr: 0.5, fontSize: 18 }} />
          Today
        </ToggleButton>
        <ToggleButton value="week" aria-label="This Week">
          <DateRange sx={{ mr: 0.5, fontSize: 18 }} />
          Week
        </ToggleButton>
        <ToggleButton value="month" aria-label="This Month">
          <CalendarMonth sx={{ mr: 0.5, fontSize: 18 }} />
          Month
        </ToggleButton>
        <ToggleButton value="custom" aria-label="Custom Range">
          <Event sx={{ mr: 0.5, fontSize: 18 }} />
          Custom
        </ToggleButton>
      </ToggleButtonGroup>

      {quickFilter === 'custom' && (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={customStart}
            onChange={handleCustomStartChange}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={customEnd}
            onChange={handleCustomEndChange}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: customStart }}
            fullWidth
            error={customStart && customEnd && new Date(customEnd) < new Date(customStart)}
            helperText={
              customStart && customEnd && new Date(customEnd) < new Date(customStart)
                ? 'End date must be after start date'
                : ''
            }
          />
        </Box>
      )}
    </Box>
  );
};

export default DateRangeFilter;
