import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  TextField,
  CircularProgress,
  Badge,
  Avatar,
  Divider,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Today as TodayIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  SwapHoriz as SwapIcon,
  Circle as OnlineIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import api, { getErrorMessage, scheduleService } from '../services/api';
import { useApi, useApiMutation } from '../hooks/useApi';
import { useScheduleUpdates, usePresence, useTypingIndicator, useWebSocket } from '../hooks/useWebSocket';
import websocketManager from '../services/websocket';
import { extractShiftsFromSchedule, detectShiftConflicts } from '../utils/assignmentHelpers';

const ScheduleDisplay = () => {
  // State management
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [draggedShift, setDraggedShift] = useState(null);
  const [notification, setNotification] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'day'
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [showRealtimeUpdates, setShowRealtimeUpdates] = useState(false);

  // Form state for shift editing
  const [shiftForm, setShiftForm] = useState({
    employeeId: '',
    startTime: '',
    endTime: '',
    role: '',
    notes: '',
  });

  // WebSocket hooks for real-time functionality
  const { isConnected } = useWebSocket();
  const { schedules: realtimeSchedules, lastUpdate } = useScheduleUpdates(selectedSchedule?.id);
  const { onlineUsers, userActivity } = usePresence();
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(`schedule-${selectedSchedule?.id || 'main'}`);

  // API hooks
  const { data: schedulesData, loading: loadingSchedules, refetch: refetchSchedules } = useApi(
    () => scheduleService.getSchedules(),
    [],
    {
      onSuccess: (data) => {
        if (data.schedules && data.schedules.length > 0) {
          setSelectedSchedule(data.schedules[0]);
        }
      },
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load schedules' });
      }
    }
  );

  const { data: employeesData } = useApi(
    () => api.get('/api/employees'),
    [],
    {
      onError: (error) => {
        setNotification({ type: 'error', message: getErrorMessage(error) });
      }
    }
  );

  const { mutate: updateShift, loading: updatingShift } = useApiMutation(
    ({ scheduleId, shiftId, updates }) => scheduleService.updateShift(scheduleId, shiftId, updates),
    {
      onSuccess: () => {
        refetchSchedules();
        setOpenShiftDialog(false);
        resetShiftForm();
        setNotification({ type: 'success', message: 'Shift updated successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: error.message || 'Failed to update shift' });
      }
    }
  );

  const { mutate: generateSchedule, loading: generating } = useApiMutation(
    ({ startDate, endDate }) => scheduleService.generateSchedule(startDate, endDate),
    {
      onSuccess: (newSchedule) => {
        refetchSchedules();
        setSelectedSchedule(newSchedule);
        setNotification({ type: 'success', message: 'Schedule generated successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: error.message || 'Failed to generate schedule' });
      }
    }
  );

  // Data processing
  const schedules = schedulesData?.schedules || [];
  const employees = employeesData?.employees || [];
  const employeeMap = useMemo(() => {
    return employees.reduce((acc, emp) => {
      acc[emp.id] = emp;
      return acc;
    }, {});
  }, [employees]);

  // Get current week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  // Get shifts from assignments for current week
  const weekShifts = useMemo(() => {
    if (!selectedSchedule) return {};

    // Extract shifts from assignments
    const shifts = extractShiftsFromSchedule(selectedSchedule);

    const shiftsMap = {};
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      shiftsMap[dayKey] = shifts.filter(shift => {
        const shiftDate = shift.startTime ? format(parseISO(shift.startTime), 'yyyy-MM-dd') : null;
        return shiftDate === dayKey;
      });
    });

    return shiftsMap;
  }, [selectedSchedule, weekDays]);

  // Conflict detection
  useEffect(() => {
    if (!selectedSchedule) return;

    const detectScheduleConflicts = () => {
      const conflicts = [];
      const shifts = extractShiftsFromSchedule(selectedSchedule);

      shifts.forEach((shift, index) => {
        // Check for overlapping shifts using helper
        const overlapping = detectShiftConflicts(shift, shifts);

        if (overlapping.length > 0) {
          const employee = employeeMap[shift.employeeId];
          conflicts.push({
            type: 'overlap',
            shift,
            message: `Overlapping shifts for ${employee?.firstName || employee?.first_name || 'Unknown'}`,
          });
        }

        // Check for availability conflicts
        const employee = employeeMap[shift.employeeId];
        if (employee?.availability && shift.startTime) {
          const shiftDay = format(parseISO(shift.startTime), 'EEEE').toLowerCase();
          const dayAvailability = employee.availability[shiftDay];

          if (!dayAvailability?.available) {
            conflicts.push({
              type: 'availability',
              shift,
              message: `${employee.firstName || employee.first_name} not available on ${format(parseISO(shift.startTime), 'EEEE')}`,
            });
          }
        }

        // Check for unconfirmed assignments
        if (shift.needsConfirmation) {
          const employee = employeeMap[shift.employeeId];
          conflicts.push({
            type: 'confirmation',
            shift,
            message: `Assignment needs confirmation from ${employee?.firstName || employee?.first_name || 'employee'}`,
          });
        }
      });

      setConflicts(conflicts);
    };

    detectScheduleConflicts();
  }, [selectedSchedule, employeeMap]);

  // WebSocket event handlers
  useEffect(() => {
    if (lastUpdate) {
      setShowRealtimeUpdates(true);
      setNotification({
        type: 'info',
        message: `Schedule ${lastUpdate.type} by user ${lastUpdate.data.updated_by || lastUpdate.data.created_by || 'system'}`
      });

      // Auto-hide realtime update notification
      const timer = setTimeout(() => setShowRealtimeUpdates(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  // Handle editing states with WebSocket
  const handleEditStart = useCallback((shift) => {
    setSelectedShift(shift);
    setShiftForm({
      employeeId: shift.employeeId,
      startTime: format(parseISO(shift.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(parseISO(shift.endTime), "yyyy-MM-dd'T'HH:mm"),
      role: shift.role || '',
      notes: shift.notes || '',
    });
    setOpenShiftDialog(true);

    // Notify others that this shift is being edited
    websocketManager.sendEditing('shift', shift.id);
  }, []);

  const handleEditEnd = useCallback(() => {
    if (selectedShift) {
      websocketManager.stopEditing('shift', selectedShift.id);
    }
    setOpenShiftDialog(false);
    resetShiftForm();
  }, [selectedShift]);

  const handleInputChange = useCallback((field, value) => {
    setShiftForm(prev => ({ ...prev, [field]: value }));
    startTyping();

    // Stop typing after a delay
    const timer = setTimeout(() => stopTyping(), 1000);
    return () => clearTimeout(timer);
  }, [startTyping, stopTyping]);

  // Get users currently editing specific shifts
  const getEditingUsers = useCallback((shiftId) => {
    return Object.entries(userActivity)
      .filter(([userId, activity]) =>
        activity.type === 'editing' &&
        activity.resource_type === 'shift' &&
        activity.resource_id === shiftId
      )
      .map(([userId]) => parseInt(userId));
  }, [userActivity]);

  // Check if a shift is being edited by someone else
  const isShiftBeingEdited = useCallback((shiftId) => {
    const editingUsers = getEditingUsers(shiftId);
    return editingUsers.length > 0;
  }, [getEditingUsers]);

  // Event handlers
  const resetShiftForm = useCallback(() => {
    setShiftForm({
      employeeId: '',
      startTime: '',
      endTime: '',
      role: '',
      notes: '',
    });
    setSelectedShift(null);
  }, []);

  const handleShiftClick = useCallback((shift) => {
    // Check if shift is being edited by someone else
    if (isShiftBeingEdited(shift.id)) {
      setNotification({
        type: 'warning',
        message: 'This shift is currently being edited by another user.'
      });
      return;
    }

    handleEditStart(shift);
  }, [isShiftBeingEdited, handleEditStart]);

  const handleShiftSubmit = useCallback(() => {
    if (!selectedShift || !selectedSchedule) return;

    const updates = {
      employeeId: shiftForm.employeeId,
      startTime: new Date(shiftForm.startTime).toISOString(),
      endTime: new Date(shiftForm.endTime).toISOString(),
      role: shiftForm.role,
      notes: shiftForm.notes,
    };

    updateShift({
      scheduleId: selectedSchedule.id,
      shiftId: selectedShift.id,
      updates,
    });
  }, [selectedShift, selectedSchedule, shiftForm, updateShift]);

  const handleWeekNavigation = useCallback((direction) => {
    if (direction === 'prev') {
      setCurrentWeek(subWeeks(currentWeek, 1));
    } else {
      setCurrentWeek(addWeeks(currentWeek, 1));
    }
  }, [currentWeek]);

  const handleGenerateSchedule = useCallback(() => {
    const startDate = format(currentWeek, 'yyyy-MM-dd');
    const endDate = format(addDays(currentWeek, 6), 'yyyy-MM-dd');
    generateSchedule({ startDate, endDate });
  }, [currentWeek, generateSchedule]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, shift) => {
    setDraggedShift(shift);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, targetDay, targetHour) => {
    e.preventDefault();

    if (!draggedShift || !selectedSchedule) return;

    const newStartTime = new Date(targetDay);
    newStartTime.setHours(targetHour, 0, 0, 0);

    const shiftDuration = parseISO(draggedShift.endTime) - parseISO(draggedShift.startTime);
    const newEndTime = new Date(newStartTime.getTime() + shiftDuration);

    const updates = {
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
    };

    updateShift({
      scheduleId: selectedSchedule.id,
      shiftId: draggedShift.id,
      updates,
    });

    setDraggedShift(null);
  }, [draggedShift, selectedSchedule, updateShift]);

  const getShiftColor = (shift) => {
    const employee = employeeMap[shift.employeeId];
    if (!employee) return '#gray';

    const roleColors = {
      manager: '#1976d2',
      supervisor: '#7b1fa2',
      cashier: '#388e3c',
      cook: '#f57c00',
      server: '#00796b',
      cleaner: '#5d4037',
    };

    return roleColors[employee.role] || '#757575';
  };

  const hasConflict = (shift) => {
    return conflicts.some(conflict => conflict.shift.id === shift.id);
  };

  const getConflictMessage = (shift) => {
    const conflict = conflicts.find(c => c.shift.id === shift.id);
    return conflict?.message || '';
  };

  // Time slots for day view (6 AM to 11 PM)
  const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6);

  if (loadingSchedules) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Schedule Management
        </Typography>

        {/* Header Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* Real-time status bar */}
            <Box sx={{ mb: 2, p: 1, bgcolor: isConnected ? 'success.light' : 'error.light', borderRadius: 1 }}>
              <Grid container alignItems="center" spacing={2}>
                <Grid item>
                  <Box display="flex" alignItems="center" gap={1}>
                    <OnlineIcon
                      sx={{
                        fontSize: 12,
                        color: isConnected ? 'success.main' : 'error.main',
                        animation: isConnected ? 'pulse 2s infinite' : 'none'
                      }}
                    />
                    <Typography variant="body2" color={isConnected ? 'success.main' : 'error.main'}>
                      {isConnected ? 'Live Updates Active' : 'Offline Mode'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item>
                  <Badge badgeContent={onlineUsers.length} color="primary">
                    <Typography variant="body2">Online Users</Typography>
                  </Badge>
                </Grid>
                {typingUsers.length > 0 && (
                  <Grid item>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {typingUsers.length} user{typingUsers.length > 1 ? 's' : ''} typing...
                    </Typography>
                  </Grid>
                )}
                {showRealtimeUpdates && lastUpdate && (
                  <Grid item sx={{ flexGrow: 1 }}>
                    <Alert severity="info" size="small" sx={{ py: 0 }}>
                      Schedule {lastUpdate.type} by user {lastUpdate.data.updated_by || lastUpdate.data.created_by}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>

            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Schedule</InputLabel>
                  <Select
                    value={selectedSchedule?.id || ''}
                    label="Schedule"
                    onChange={(e) => {
                      const schedule = schedules.find(s => s.id === e.target.value);
                      setSelectedSchedule(schedule);
                    }}
                    aria-label="Select schedule"
                  >
                    {schedules.map(schedule => (
                      <MenuItem key={schedule.id} value={schedule.id}>
                        {schedule.name || `Week of ${format(parseISO(schedule.startDate), 'MMM d, yyyy')}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>View</InputLabel>
                  <Select
                    value={viewMode}
                    label="View"
                    onChange={(e) => setViewMode(e.target.value)}
                    aria-label="Select view mode"
                  >
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="day">Day</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton onClick={() => handleWeekNavigation('prev')} aria-label="Previous week">
                    <ChevronLeftIcon />
                  </IconButton>

                  <Typography variant="h6" sx={{ mx: 2 }}>
                    {viewMode === 'week'
                      ? `Week of ${format(currentWeek, 'MMM d, yyyy')}`
                      : format(selectedDay, 'EEEE, MMM d, yyyy')
                    }
                  </Typography>

                  <IconButton onClick={() => handleWeekNavigation('next')} aria-label="Next week">
                    <ChevronRightIcon />
                  </IconButton>

                  <Button
                    size="small"
                    startIcon={<TodayIcon />}
                    onClick={() => {
                      setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
                      setSelectedDay(new Date());
                    }}
                    aria-label="Go to current week"
                  >
                    Today
                  </Button>
                </Box>
              </Grid>

              <Grid item>
                <Button
                  variant="contained"
                  startIcon={generating ? <CircularProgress size={16} /> : <AddIcon />}
                  onClick={handleGenerateSchedule}
                  disabled={generating}
                  aria-label="Generate new schedule"
                >
                  Generate Schedule
                </Button>
              </Grid>
            </Grid>

            {/* Conflicts Alert */}
            {conflicts.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Scheduling Conflicts Detected ({conflicts.length})
                </Typography>
                {conflicts.slice(0, 3).map((conflict, idx) => (
                  <Typography key={idx} variant="body2">
                    • {conflict.message}
                  </Typography>
                ))}
                {conflicts.length > 3 && (
                  <Typography variant="body2">
                    ...and {conflicts.length - 3} more
                  </Typography>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Schedule Grid */}
        <Card>
          <CardContent>
            {viewMode === 'week' ? (
              // Week View
              <Box sx={{ overflow: 'auto' }}>
                <Grid container spacing={1}>
                  {/* Time column header */}
                  <Grid item xs={1}>
                    <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.100' }}>
                      <Typography variant="caption" fontWeight="bold">
                        Time
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* Day headers */}
                  {weekDays.map((day, index) => (
                    <Grid item xs key={index} sx={{ minWidth: 150 }}>
                      <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.100' }}>
                        <Typography variant="caption" fontWeight="bold">
                          {format(day, 'EEE')}
                        </Typography>
                        <Typography variant="body2">
                          {format(day, 'MMM d')}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                {/* Time slots and shifts */}
                {timeSlots.map(hour => (
                  <Grid container spacing={1} key={hour} sx={{ mt: 0.5 }}>
                    {/* Time label */}
                    <Grid item xs={1}>
                      <Paper sx={{ p: 1, textAlign: 'center', minHeight: 60 }}>
                        <Typography variant="caption">
                          {hour}:00
                        </Typography>
                      </Paper>
                    </Grid>

                    {/* Day columns */}
                    {weekDays.map((day, dayIndex) => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const dayShifts = weekShifts[dayKey] || [];
                      const hourShifts = dayShifts.filter(shift => {
                        const shiftHour = parseISO(shift.startTime).getHours();
                        return shiftHour === hour;
                      });

                      return (
                        <Grid item xs key={dayIndex} sx={{ minWidth: 150 }}>
                          <Paper
                            sx={{
                              p: 1,
                              minHeight: 60,
                              border: '1px solid',
                              borderColor: 'grey.300',
                              bgcolor: 'background.paper',
                              '&:hover': { bgcolor: 'grey.50' },
                            }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day, hour)}
                            role="grid cell"
                            aria-label={`${format(day, 'EEEE')} ${hour}:00`}
                          >
                            {hourShifts.map(shift => {
                              const employee = employeeMap[shift.employeeId];
                              const conflict = hasConflict(shift);

                              return (
                                <Tooltip
                                  key={shift.id}
                                  title={
                                    <Box>
                                      <Typography variant="body2">
                                        {employee?.firstName} {employee?.lastName}
                                      </Typography>
                                      <Typography variant="caption">
                                        {format(parseISO(shift.startTime), 'h:mm a')} -
                                        {format(parseISO(shift.endTime), 'h:mm a')}
                                      </Typography>
                                      {conflict && (
                                        <Typography variant="caption" color="error">
                                          {getConflictMessage(shift)}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                >
                                  <Paper
                                    sx={{
                                      p: 0.5,
                                      mb: 0.5,
                                      bgcolor: getShiftColor(shift),
                                      color: 'white',
                                      cursor: 'pointer',
                                      border: conflict ? '2px solid #f44336' : 'none',
                                      fontSize: '0.75rem',
                                      '&:hover': { opacity: 0.8 },
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, shift)}
                                    onClick={() => handleShiftClick(shift)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        handleShiftClick(shift);
                                      }
                                    }}
                                    aria-label={`Shift for ${employee?.firstName} ${employee?.lastName}`}
                                  >
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                      <Typography variant="caption" noWrap>
                                        {employee?.firstName || 'Unknown'}
                                      </Typography>
                                      {conflict && (
                                        <WarningIcon sx={{ fontSize: 12 }} />
                                      )}
                                    </Box>
                                    <Typography variant="caption" display="block">
                                      {format(parseISO(shift.startTime), 'h:mm')} -
                                      {format(parseISO(shift.endTime), 'h:mm')}
                                    </Typography>
                                  </Paper>
                                </Tooltip>
                              );
                            })}
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                ))}
              </Box>
            ) : (
              // Day View
              <Box>
                <Box sx={{ mb: 2 }}>
                  <DatePicker
                    label="Select Date"
                    value={selectedDay}
                    onChange={(newValue) => setSelectedDay(newValue)}
                    renderInput={(params) => <TextField {...params} size="small" />}
                  />
                </Box>

                {/* Day shifts list */}
                <Box>
                  {extractShiftsFromSchedule(selectedSchedule)
                    ?.filter(shift => shift.startTime && isSameDay(parseISO(shift.startTime), selectedDay))
                    ?.sort((a, b) => parseISO(a.startTime) - parseISO(b.startTime))
                    ?.map(shift => {
                      const employee = employeeMap[shift.employeeId];
                      const conflict = hasConflict(shift);

                      return (
                        <Paper key={shift.id} sx={{ p: 2, mb: 1, border: conflict ? '1px solid #f44336' : '1px solid #e0e0e0' }}>
                          <Grid container alignItems="center" spacing={2}>
                            <Grid item>
                              <Avatar sx={{ bgcolor: getShiftColor(shift) }}>
                                <PersonIcon />
                              </Avatar>
                            </Grid>
                            <Grid item xs>
                              <Typography variant="subtitle1">
                                {employee?.firstName} {employee?.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {format(parseISO(shift.startTime), 'h:mm a')} -
                                {format(parseISO(shift.endTime), 'h:mm a')} • {shift.role}
                              </Typography>
                              {conflict && (
                                <Alert severity="warning" size="small" sx={{ mt: 1 }}>
                                  {getConflictMessage(shift)}
                                </Alert>
                              )}
                            </Grid>
                            <Grid item>
                              <IconButton onClick={() => handleShiftClick(shift)} aria-label="Edit shift">
                                <EditIcon />
                              </IconButton>
                            </Grid>
                          </Grid>
                        </Paper>
                      );
                    })}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Shift Edit Dialog */}
        <Dialog open={openShiftDialog} onClose={() => setOpenShiftDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Shift</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Employee</InputLabel>
                  <Select
                    value={shiftForm.employeeId}
                    label="Employee"
                    onChange={(e) => setShiftForm({ ...shiftForm, employeeId: e.target.value })}
                    aria-label="Select employee"
                  >
                    {employees.map(employee => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} - {employee.role}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="datetime-local"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  aria-label="Shift start time"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="datetime-local"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  aria-label="Shift end time"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role"
                  value={shiftForm.role}
                  onChange={(e) => setShiftForm({ ...shiftForm, role: e.target.value })}
                  aria-label="Shift role"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={2}
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  aria-label="Shift notes"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenShiftDialog(false)}>Cancel</Button>
            <Button
              onClick={handleShiftSubmit}
              variant="contained"
              disabled={updatingShift}
              startIcon={updatingShift ? <CircularProgress size={16} /> : null}
            >
              Update Shift
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notification Snackbar */}
        <Snackbar
          open={!!notification}
          autoHideDuration={4000}
          onClose={() => setNotification(null)}
        >
          {notification && (
            <Alert
              onClose={() => setNotification(null)}
              severity={notification.type}
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          )}
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default ScheduleDisplay;