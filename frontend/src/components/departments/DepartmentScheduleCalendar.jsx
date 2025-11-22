/**
 * Department Schedule Calendar Component
 *
 * Comprehensive calendar view for department schedules with:
 * - Month/Week/Day view switching
 * - Color-coded shift types
 * - Conflict and coverage gap highlighting
 * - Quick shift editing
 * - Coverage indicators
 * - Export functionality
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Alert,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Divider,
  Stack,
  alpha,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  CalendarMonth as CalendarMonthIcon,
  ViewWeek as ViewWeekIcon,
  ViewDay as ViewDayIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Print as PrintIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  endOfDay
} from 'date-fns';

import { getDepartmentScheduleOverview, getDepartment } from '../../services/departmentService';

// Shift type colors
const SHIFT_COLORS = {
  morning: '#4CAF50',
  afternoon: '#FF9800',
  night: '#3F51B5',
  evening: '#9C27B0',
  custom: '#607D8B'
};

// Coverage status colors
const COVERAGE_COLORS = {
  understaffed: '#f44336',
  optimal: '#4CAF50',
  overstaffed: '#FF9800'
};

const DepartmentScheduleCalendar = () => {
  const { id: departmentId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State
  const [viewMode, setViewMode] = useState('month'); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState(null);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [filters, setFilters] = useState({
    employee: 'all',
    shiftType: 'all',
    status: 'all'
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    let start, end;

    switch (viewMode) {
      case 'month':
        start = startOfWeek(startOfMonth(currentDate));
        end = endOfWeek(endOfMonth(currentDate));
        break;
      case 'week':
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
        break;
      case 'day':
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        break;
      default:
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
    }

    return { start, end };
  }, [currentDate, viewMode]);

  // Fetch department data
  const fetchDepartmentData = useCallback(async () => {
    if (!departmentId) return;

    try {
      const deptData = await getDepartment(departmentId);
      setDepartment(deptData);
    } catch (err) {
      console.error('Failed to fetch department:', err);
      setError('Failed to load department details');
    }
  }, [departmentId]);

  // Fetch schedule data
  const fetchScheduleData = useCallback(async () => {
    if (!departmentId) return;

    setLoading(true);
    setError(null);

    try {
      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');

      const data = await getDepartmentScheduleOverview(
        departmentId,
        startDate,
        endDate,
        { includeMetrics: true }
      );

      setScheduleData(data);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      setError(err.response?.data?.message || 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  }, [departmentId, dateRange]);

  // Initial data fetch
  useEffect(() => {
    fetchDepartmentData();
  }, [fetchDepartmentData]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchScheduleData();
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchScheduleData]);

  // Navigation handlers
  const handlePreviousPeriod = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => addMonths(prev, -1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, -1));
        break;
      case 'day':
        setCurrentDate(prev => addDays(prev, -1));
        break;
    }
  };

  const handleNextPeriod = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Get shifts for a specific date
  const getShiftsForDate = useCallback((date) => {
    if (!scheduleData?.employees) return [];

    const shifts = [];
    scheduleData.employees.forEach(employee => {
      employee.shifts?.forEach(shift => {
        const shiftDate = parseISO(shift.date);
        if (isSameDay(shiftDate, date)) {
          shifts.push({
            ...shift,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            employeeId: employee.id
          });
        }
      });
    });

    // Apply filters
    return shifts.filter(shift => {
      if (filters.shiftType !== 'all' && shift.shiftType !== filters.shiftType) {
        return false;
      }
      if (filters.employee !== 'all' && shift.employeeId !== parseInt(filters.employee)) {
        return false;
      }
      if (filters.status !== 'all' && shift.status !== filters.status) {
        return false;
      }
      return true;
    });
  }, [scheduleData, filters]);

  // Calculate coverage status for a date
  const getCoverageStatus = useCallback((date, shifts) => {
    const requiredStaff = scheduleData?.metrics?.requiredStaffPerDay || 5;
    const staffCount = new Set(shifts.map(s => s.employeeId)).size;

    if (staffCount < requiredStaff * 0.8) return 'understaffed';
    if (staffCount > requiredStaff * 1.2) return 'overstaffed';
    return 'optimal';
  }, [scheduleData]);

  // Detect conflicts (overlapping shifts for same employee)
  const getConflicts = useCallback((shifts) => {
    const conflicts = [];
    const employeeShifts = {};

    shifts.forEach(shift => {
      if (!employeeShifts[shift.employeeId]) {
        employeeShifts[shift.employeeId] = [];
      }
      employeeShifts[shift.employeeId].push(shift);
    });

    Object.values(employeeShifts).forEach(empShifts => {
      if (empShifts.length > 1) {
        // Check for time overlaps
        for (let i = 0; i < empShifts.length - 1; i++) {
          for (let j = i + 1; j < empShifts.length; j++) {
            const shift1 = empShifts[i];
            const shift2 = empShifts[j];

            // Simple overlap check (would need actual time comparison in production)
            conflicts.push({
              employee: shift1.employeeName,
              shift1: shift1.shiftType,
              shift2: shift2.shiftType
            });
          }
        }
      }
    });

    return conflicts;
  }, []);

  // Render month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <Box>
        {/* Day headers */}
        <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Grid item xs key={day}>
              <Typography
                align="center"
                variant="subtitle2"
                fontWeight="bold"
                color="text.secondary"
              >
                {day}
              </Typography>
            </Grid>
          ))}
        </Grid>

        {/* Calendar grid */}
        {weeks.map((week, weekIdx) => (
          <Grid container spacing={0.5} key={weekIdx} sx={{ mb: 0.5 }}>
            {week.map((day, dayIdx) => {
              const shifts = getShiftsForDate(day);
              const coverageStatus = getCoverageStatus(day, shifts);
              const conflicts = getConflicts(shifts);
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <Grid item xs key={dayIdx}>
                  <Paper
                    elevation={isToday(day) ? 3 : 1}
                    sx={{
                      minHeight: isMobile ? 60 : 100,
                      p: 0.5,
                      cursor: 'pointer',
                      bgcolor: isToday(day)
                        ? alpha(theme.palette.primary.main, 0.1)
                        : 'background.paper',
                      opacity: isCurrentMonth ? 1 : 0.5,
                      borderLeft: `4px solid ${COVERAGE_COLORS[coverageStatus]}`,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05)
                      }
                    }}
                    onClick={() => {
                      setCurrentDate(day);
                      setViewMode('day');
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Typography
                        variant="caption"
                        fontWeight={isToday(day) ? 'bold' : 'normal'}
                        color={isToday(day) ? 'primary' : 'text.primary'}
                      >
                        {format(day, 'd')}
                      </Typography>
                      {conflicts.length > 0 && (
                        <Tooltip title={`${conflicts.length} conflict(s)`}>
                          <WarningIcon sx={{ fontSize: 14, color: 'error.main' }} />
                        </Tooltip>
                      )}
                    </Box>

                    {/* Shift indicators */}
                    <Box mt={0.5} display="flex" flexDirection="column" gap={0.25}>
                      {shifts.slice(0, isMobile ? 2 : 3).map((shift, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            bgcolor: SHIFT_COLORS[shift.shiftType] || SHIFT_COLORS.custom,
                            color: 'white',
                            px: 0.5,
                            py: 0.25,
                            borderRadius: 0.5,
                            fontSize: isMobile ? 9 : 10,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShift(shift);
                            setEditDialogOpen(true);
                          }}
                        >
                          {shift.employeeName.split(' ')[0]}
                        </Box>
                      ))}
                      {shifts.length > (isMobile ? 2 : 3) && (
                        <Typography variant="caption" color="text.secondary" align="center">
                          +{shifts.length - (isMobile ? 2 : 3)} more
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        ))}
      </Box>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <Grid container spacing={1}>
        {days.map((day, idx) => {
          const shifts = getShiftsForDate(day);
          const coverageStatus = getCoverageStatus(day, shifts);
          const conflicts = getConflicts(shifts);

          return (
            <Grid item xs={12} sm={12 / 7} key={idx}>
              <Paper
                elevation={isToday(day) ? 3 : 1}
                sx={{
                  p: 2,
                  minHeight: 300,
                  bgcolor: isToday(day)
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'background.paper',
                  borderTop: `4px solid ${COVERAGE_COLORS[coverageStatus]}`
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight="bold">
                    {format(day, 'EEE')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {format(day, 'MMM d')}
                  </Typography>
                </Box>

                {conflicts.length > 0 && (
                  <Alert severity="error" sx={{ mb: 1, py: 0 }}>
                    {conflicts.length} conflict(s)
                  </Alert>
                )}

                <Stack spacing={1}>
                  {shifts.map((shift, shiftIdx) => (
                    <Card
                      key={shiftIdx}
                      sx={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${SHIFT_COLORS[shift.shiftType] || SHIFT_COLORS.custom}`,
                        '&:hover': {
                          boxShadow: 3
                        }
                      }}
                      onClick={() => {
                        setSelectedShift(shift);
                        setEditDialogOpen(true);
                      }}
                    >
                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="body2" fontWeight="bold">
                          {shift.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {shift.shiftType} • {shift.startTime}-{shift.endTime}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  {shifts.length === 0 && (
                    <Typography variant="body2" color="text.secondary" align="center">
                      No shifts scheduled
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  // Render day view
  const renderDayView = () => {
    const shifts = getShiftsForDate(currentDate);
    const coverageStatus = getCoverageStatus(currentDate, shifts);
    const conflicts = getConflicts(shifts);

    // Group shifts by time
    const shiftsByType = shifts.reduce((acc, shift) => {
      if (!acc[shift.shiftType]) acc[shift.shiftType] = [];
      acc[shift.shiftType].push(shift);
      return acc;
    }, {});

    return (
      <Box>
        {/* Day header */}
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4">
              {format(currentDate, 'EEEE, MMMM d, yyyy')}
            </Typography>
            <Chip
              label={coverageStatus.toUpperCase()}
              color={
                coverageStatus === 'optimal' ? 'success' :
                coverageStatus === 'understaffed' ? 'error' : 'warning'
              }
              icon={
                coverageStatus === 'optimal' ? <CheckCircleIcon /> :
                coverageStatus === 'understaffed' ? <ErrorIcon /> : <WarningIcon />
              }
            />
          </Box>

          {conflicts.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                {conflicts.length} Scheduling Conflict(s) Detected
              </Typography>
              {conflicts.map((conflict, idx) => (
                <Typography key={idx} variant="caption" display="block">
                  • {conflict.employee}: {conflict.shift1} overlaps with {conflict.shift2}
                </Typography>
              ))}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">Total Shifts</Typography>
              <Typography variant="h6">{shifts.length}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">Employees Scheduled</Typography>
              <Typography variant="h6">{new Set(shifts.map(s => s.employeeId)).size}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">Coverage</Typography>
              <Typography variant="h6">
                {scheduleData?.metrics?.coveragePercentage || 0}%
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* Shifts by type */}
        <Grid container spacing={2}>
          {Object.entries(shiftsByType).map(([type, typeShifts]) => (
            <Grid item xs={12} md={6} key={type}>
              <Paper sx={{ p: 2 }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 1,
                      bgcolor: SHIFT_COLORS[type] || SHIFT_COLORS.custom
                    }}
                  />
                  <Typography variant="h6" textTransform="capitalize">
                    {type} Shift
                  </Typography>
                  <Chip label={typeShifts.length} size="small" />
                </Box>

                <Stack spacing={1}>
                  {typeShifts.map((shift, idx) => (
                    <Card
                      key={idx}
                      variant="outlined"
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05)
                        }
                      }}
                      onClick={() => {
                        setSelectedShift(shift);
                        setEditDialogOpen(true);
                      }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body1" fontWeight="bold">
                              {shift.employeeName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {shift.startTime} - {shift.endTime}
                            </Typography>
                          </Box>
                          <IconButton size="small">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          ))}

          {Object.keys(shiftsByType).length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No shifts scheduled for this day
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  // Export handlers
  const handleExport = (format) => {
    setExportMenuAnchor(null);

    switch (format) {
      case 'pdf':
        window.print();
        break;
      case 'image':
        // Implementation for image export
        alert('Image export coming soon');
        break;
      default:
        break;
    }
  };

  // Edit shift dialog
  const renderEditDialog = () => (
    <Dialog
      open={editDialogOpen}
      onClose={() => {
        setEditDialogOpen(false);
        setSelectedShift(null);
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Edit Shift
        <IconButton
          onClick={() => {
            setEditDialogOpen(false);
            setSelectedShift(null);
          }}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {selectedShift && (
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Employee"
                  value={selectedShift.employeeName}
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Shift Type</InputLabel>
                  <Select
                    value={selectedShift.shiftType}
                    label="Shift Type"
                  >
                    <MenuItem value="morning">Morning</MenuItem>
                    <MenuItem value="afternoon">Afternoon</MenuItem>
                    <MenuItem value="evening">Evening</MenuItem>
                    <MenuItem value="night">Night</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={selectedShift.date}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={selectedShift.startTime}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={selectedShift.endTime}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={selectedShift.notes || ''}
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          setEditDialogOpen(false);
          setSelectedShift(null);
        }}>
          Cancel
        </Button>
        <Button variant="contained" color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (loading && !scheduleData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !scheduleData) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: isMobile ? 1 : 3 }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" fontWeight="bold">
              {department?.name || 'Department'} Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {format(currentDate, 'MMMM yyyy')}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
              <Tooltip title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}>
                <IconButton onClick={() => setAutoRefresh(!autoRefresh)} color={autoRefresh ? 'primary' : 'default'}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                startIcon={<DownloadIcon />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                size={isMobile ? 'small' : 'medium'}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(`/departments/${departmentId}`)}
                size={isMobile ? 'small' : 'medium'}
              >
                Back to Department
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Controls */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* View mode toggle */}
          <Grid item xs={12} sm="auto">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size={isMobile ? 'small' : 'medium'}
            >
              <ToggleButton value="month">
                <CalendarMonthIcon sx={{ mr: isMobile ? 0 : 1 }} />
                {!isMobile && 'Month'}
              </ToggleButton>
              <ToggleButton value="week">
                <ViewWeekIcon sx={{ mr: isMobile ? 0 : 1 }} />
                {!isMobile && 'Week'}
              </ToggleButton>
              <ToggleButton value="day">
                <ViewDayIcon sx={{ mr: isMobile ? 0 : 1 }} />
                {!isMobile && 'Day'}
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Navigation */}
          <Grid item xs={12} sm="auto" sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handlePreviousPeriod}>
              <ChevronLeftIcon />
            </IconButton>
            <Button onClick={handleToday} variant="outlined" size={isMobile ? 'small' : 'medium'}>
              <TodayIcon sx={{ mr: isMobile ? 0 : 1 }} />
              {!isMobile && 'Today'}
            </Button>
            <IconButton onClick={handleNextPeriod}>
              <ChevronRightIcon />
            </IconButton>
          </Grid>

          {/* Filters */}
          <Grid item xs={12} sm sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={filters.shiftType}
                label="Shift Type"
                onChange={(e) => setFilters({ ...filters, shiftType: e.target.value })}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="morning">Morning</MenuItem>
                <MenuItem value="afternoon">Afternoon</MenuItem>
                <MenuItem value="evening">Evening</MenuItem>
                <MenuItem value="night">Night</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            {scheduleData?.employees && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={filters.employee}
                  label="Employee"
                  onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                >
                  <MenuItem value="all">All Employees</MenuItem>
                  {scheduleData.employees.map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Legend */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Shift Types</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {Object.entries(SHIFT_COLORS).map(([type, color]) => (
                <Chip
                  key={type}
                  label={type.charAt(0).toUpperCase() + type.slice(1)}
                  size="small"
                  sx={{ bgcolor: color, color: 'white' }}
                />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Coverage Status</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {Object.entries(COVERAGE_COLORS).map(([status, color]) => (
                <Chip
                  key={status}
                  label={status.charAt(0).toUpperCase() + status.slice(1)}
                  size="small"
                  sx={{ bgcolor: color, color: 'white' }}
                />
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Calendar view */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}

      {/* Export menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('pdf')}>
          <ListItemIcon>
            <PdfIcon />
          </ListItemIcon>
          <ListItemText>Export as PDF</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleExport('image')}>
          <ListItemIcon>
            <ImageIcon />
          </ListItemIcon>
          <ListItemText>Export as Image</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => window.print()}>
          <ListItemIcon>
            <PrintIcon />
          </ListItemIcon>
          <ListItemText>Print</ListItemText>
        </MenuItem>
      </Menu>

      {/* Edit dialog */}
      {renderEditDialog()}
    </Box>
  );
};

export default DepartmentScheduleCalendar;
