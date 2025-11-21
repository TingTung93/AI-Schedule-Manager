import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  GetApp,
  CalendarToday,
  ViewWeek,
  ViewModule
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

// Shift type configurations with colors and abbreviations
const SHIFT_TYPES = {
  morning: { abbr: 'M', color: '#4caf50', label: 'Morning', hours: '6:00 AM - 2:00 PM' },
  day: { abbr: 'D', color: '#2196f3', label: 'Day', hours: '9:00 AM - 5:00 PM' },
  evening: { abbr: 'E', color: '#ff9800', label: 'Evening', hours: '2:00 PM - 10:00 PM' },
  night: { abbr: 'N', color: '#9c27b0', label: 'Night', hours: '10:00 PM - 6:00 AM' },
  split: { abbr: 'S', color: '#00bcd4', label: 'Split', hours: 'Variable' },
  oncall: { abbr: 'OC', color: '#f44336', label: 'On-Call', hours: 'Variable' },
  training: { abbr: 'T', color: '#795548', label: 'Training', hours: 'Variable' },
  meeting: { abbr: 'MT', color: '#607d8b', label: 'Meeting', hours: 'Variable' },
  default: { abbr: 'X', color: '#9e9e9e', label: 'Other', hours: 'Variable' }
};

// View types
const VIEW_TYPES = {
  WEEK: 'week',
  MONTH: 'month'
};

const DepartmentOverview = () => {
  // State management
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState(VIEW_TYPES.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notification, setNotification] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editForm, setEditForm] = useState({ shiftType: '', notes: '' });

  // Load initial data
  useEffect(() => {
    loadDepartments();
  }, []);

  // Load department staff when department changes
  useEffect(() => {
    if (selectedDepartment) {
      loadDepartmentData();
    }
  }, [selectedDepartment, currentDate, viewType]);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/departments');
      const depts = response.data.departments || [];
      setDepartments(depts);

      // Auto-select first department if available
      if (depts.length > 0 && !selectedDepartment) {
        setSelectedDepartment(depts[0].id);
      }
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentData = async () => {
    if (!selectedDepartment) return;

    try {
      setLoading(true);

      // Calculate date range
      const { startDate, endDate } = getDateRange();

      // Fetch data in parallel
      const [employeesRes, shiftsRes, schedulesRes] = await Promise.all([
        api.get(`/api/departments/${selectedDepartment}/staff`),
        api.get(`/api/departments/${selectedDepartment}/shifts`),
        api.get('/api/schedules', {
          params: {
            department_id: selectedDepartment,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
          }
        })
      ]);

      setEmployees(employeesRes.data.employees || employeesRes.data.staff || []);
      setShifts(shiftsRes.data.shifts || []);
      setSchedules(schedulesRes.data.schedules || []);
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  // Get date range based on view type
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewType === VIEW_TYPES.WEEK) {
      // Get start of week (Sunday)
      const day = start.getDay();
      start.setDate(start.getDate() - day);

      // Get end of week (Saturday)
      end.setDate(start.getDate() + 6);
    } else {
      // Get start of month
      start.setDate(1);

      // Get end of month
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    }

    return { startDate: start, endDate: end };
  };

  // Generate date columns for the grid
  const dateColumns = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const columns = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      columns.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return columns;
  }, [currentDate, viewType]);

  // Build schedule grid data structure
  const scheduleGrid = useMemo(() => {
    const grid = {};

    // Initialize grid for each employee
    employees.forEach(emp => {
      grid[emp.id] = {};
      dateColumns.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        grid[emp.id][dateKey] = null;
      });
    });

    // Fill grid with schedule data
    schedules.forEach(schedule => {
      const employeeId = schedule.employee_id;
      const dateKey = schedule.date || schedule.start_time?.split('T')[0];

      if (grid[employeeId] && dateKey && grid[employeeId][dateKey] !== undefined) {
        grid[employeeId][dateKey] = schedule;
      }
    });

    return grid;
  }, [employees, schedules, dateColumns]);

  // Get shift type configuration
  const getShiftTypeConfig = (schedule) => {
    if (!schedule) return null;

    const type = schedule.type?.toLowerCase() || schedule.shift_type?.toLowerCase() || 'default';
    return SHIFT_TYPES[type] || SHIFT_TYPES.default;
  };

  // Handle cell click for editing
  const handleCellClick = (employee, date) => {
    const dateKey = date.toISOString().split('T')[0];
    const existingSchedule = scheduleGrid[employee.id]?.[dateKey];

    setSelectedCell({ employee, date, dateKey, existingSchedule });
    setEditForm({
      shiftType: existingSchedule?.type || existingSchedule?.shift_type || '',
      notes: existingSchedule?.notes || ''
    });
    setEditDialogOpen(true);
  };

  // Handle schedule edit/create
  const handleScheduleSave = async () => {
    if (!selectedCell) return;

    try {
      const scheduleData = {
        employee_id: selectedCell.employee.id,
        department_id: selectedDepartment,
        date: selectedCell.dateKey,
        type: editForm.shiftType,
        shift_type: editForm.shiftType,
        notes: editForm.notes,
        status: 'confirmed'
      };

      if (selectedCell.existingSchedule) {
        // Update existing schedule
        await api.patch(`/api/schedules/${selectedCell.existingSchedule.id}`, scheduleData);
        setNotification({ type: 'success', message: 'Schedule updated successfully' });
      } else {
        // Create new schedule
        await api.post('/api/schedules', scheduleData);
        setNotification({ type: 'success', message: 'Schedule created successfully' });
      }

      setEditDialogOpen(false);
      loadDepartmentData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // Handle schedule deletion
  const handleScheduleDelete = async () => {
    if (!selectedCell?.existingSchedule) return;

    try {
      await api.delete(`/api/schedules/${selectedCell.existingSchedule.id}`);
      setNotification({ type: 'success', message: 'Schedule deleted successfully' });
      setEditDialogOpen(false);
      loadDepartmentData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // Export to CSV
  const handleExport = () => {
    try {
      // Build CSV content
      const headers = ['Employee', ...dateColumns.map(d => d.toLocaleDateString())];
      const rows = employees.map(emp => {
        const firstName = emp.firstName || emp.first_name || '';
        const lastName = emp.lastName || emp.last_name || '';
        const name = `${firstName} ${lastName}`.trim();

        const row = [name];
        dateColumns.forEach(date => {
          const dateKey = date.toISOString().split('T')[0];
          const schedule = scheduleGrid[emp.id]?.[dateKey];
          const config = getShiftTypeConfig(schedule);
          row.push(config ? config.abbr : '');
        });

        return row;
      });

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule-${selectedDepartment}-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      setNotification({ type: 'success', message: 'Schedule exported successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to export schedule' });
    }
  };

  // Navigate dates
  const handlePreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewType === VIEW_TYPES.WEEK) {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewType === VIEW_TYPES.WEEK) {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Check if date is weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  if (loading && !selectedDepartment) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Department Schedule Overview
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Pivot table view of department schedules
            </Typography>
          </Box>

          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Department</InputLabel>
              <Select
                value={selectedDepartment}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <ToggleButtonGroup
              value={viewType}
              exclusive
              onChange={(e, newView) => newView && setViewType(newView)}
              size="small"
            >
              <ToggleButton value={VIEW_TYPES.WEEK}>
                <ViewWeek sx={{ mr: 1 }} fontSize="small" />
                Week
              </ToggleButton>
              <ToggleButton value={VIEW_TYPES.MONTH}>
                <ViewModule sx={{ mr: 1 }} fontSize="small" />
                Month
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="contained"
              startIcon={<GetApp />}
              onClick={handleExport}
              disabled={!selectedDepartment || employees.length === 0}
            >
              Export
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Date Navigation */}
      <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={3}>
        <Button onClick={handlePreviousPeriod} size="small">
          Previous
        </Button>
        <Button onClick={handleToday} size="small" variant="outlined">
          <CalendarToday sx={{ mr: 1 }} fontSize="small" />
          Today
        </Button>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {viewType === VIEW_TYPES.WEEK
            ? `Week of ${dateColumns[0]?.toLocaleDateString()}`
            : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Typography>
        <Button onClick={handleNextPeriod} size="small">
          Next
        </Button>
      </Box>

      {/* Shift Legend */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom fontWeight="bold">
          Shift Types Legend:
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {Object.entries(SHIFT_TYPES).map(([key, config]) => (
            key !== 'default' && (
              <Chip
                key={key}
                label={`${config.abbr} - ${config.label} (${config.hours})`}
                size="small"
                sx={{
                  backgroundColor: config.color,
                  color: '#fff',
                  fontWeight: 'bold'
                }}
              />
            )
          ))}
        </Box>
      </Paper>

      {/* Schedule Grid */}
      {!selectedDepartment ? (
        <Alert severity="info">Please select a department to view schedules</Alert>
      ) : employees.length === 0 ? (
        <Alert severity="info">No employees found in this department</Alert>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Paper sx={{ overflowX: 'auto', position: 'relative' }}>
            <Box sx={{ minWidth: 800 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                {/* Header Row */}
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th
                      style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: '#f5f5f5',
                        padding: '12px',
                        textAlign: 'left',
                        borderBottom: '2px solid #ddd',
                        zIndex: 3,
                        minWidth: 150
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Employee
                      </Typography>
                    </th>
                    {dateColumns.map((date, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          borderBottom: '2px solid #ddd',
                          backgroundColor: isWeekend(date) ? '#e8f4f8' : '#f5f5f5',
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          minWidth: 60
                        }}
                      >
                        <Typography variant="caption" display="block">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Typography>
                        <Typography variant="caption" fontWeight="bold">
                          {date.getDate()}
                        </Typography>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body Rows */}
                <tbody>
                  {employees.map((employee, empIdx) => {
                    const firstName = employee.firstName || employee.first_name || '';
                    const lastName = employee.lastName || employee.last_name || '';
                    const name = `${firstName} ${lastName}`.trim();

                    return (
                      <tr
                        key={employee.id}
                        style={{
                          backgroundColor: empIdx % 2 === 0 ? '#fff' : '#fafafa'
                        }}
                      >
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            backgroundColor: empIdx % 2 === 0 ? '#fff' : '#fafafa',
                            padding: '12px',
                            borderBottom: '1px solid #e0e0e0',
                            fontWeight: 500,
                            zIndex: 1
                          }}
                        >
                          <Typography variant="body2">{name}</Typography>
                        </td>
                        {dateColumns.map((date, dateIdx) => {
                          const dateKey = date.toISOString().split('T')[0];
                          const schedule = scheduleGrid[employee.id]?.[dateKey];
                          const config = getShiftTypeConfig(schedule);

                          return (
                            <td
                              key={dateIdx}
                              style={{
                                padding: '4px',
                                textAlign: 'center',
                                borderBottom: '1px solid #e0e0e0',
                                borderLeft: dateIdx > 0 ? '1px solid #f0f0f0' : 'none',
                                backgroundColor: isWeekend(date) ? '#f8fbfc' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => handleCellClick(employee, date)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e3f2fd';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isWeekend(date) ? '#f8fbfc' : 'transparent';
                              }}
                            >
                              {config ? (
                                <Tooltip
                                  title={
                                    <Box>
                                      <Typography variant="caption" display="block">
                                        <strong>{name}</strong>
                                      </Typography>
                                      <Typography variant="caption" display="block">
                                        {config.label} ({config.hours})
                                      </Typography>
                                      {schedule?.notes && (
                                        <Typography variant="caption" display="block">
                                          Notes: {schedule.notes}
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                  arrow
                                >
                                  <Box
                                    sx={{
                                      display: 'inline-block',
                                      backgroundColor: config.color,
                                      color: '#fff',
                                      borderRadius: 1,
                                      px: 1,
                                      py: 0.5,
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem',
                                      minWidth: 30
                                    }}
                                  >
                                    {config.abbr}
                                  </Box>
                                </Tooltip>
                              ) : (
                                <Box sx={{ minHeight: 28 }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Paper>
        </motion.div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedCell?.existingSchedule ? 'Edit Schedule' : 'Add Schedule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {selectedCell && (
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Employee: <strong>
                    {selectedCell.employee.firstName || selectedCell.employee.first_name}{' '}
                    {selectedCell.employee.lastName || selectedCell.employee.last_name}
                  </strong>
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Date: <strong>{selectedCell.date.toLocaleDateString()}</strong>
                </Typography>
              </Box>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={editForm.shiftType}
                label="Shift Type"
                onChange={(e) => setEditForm(prev => ({ ...prev, shiftType: e.target.value }))}
              >
                {Object.entries(SHIFT_TYPES)
                  .filter(([key]) => key !== 'default')
                  .map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            backgroundColor: config.color,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {config.abbr}
                        </Box>
                        {config.label} ({config.hours})
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedCell?.existingSchedule && (
            <Button onClick={handleScheduleDelete} color="error">
              Delete
            </Button>
          )}
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleScheduleSave} variant="contained" disabled={!editForm.shiftType}>
            {selectedCell?.existingSchedule ? 'Update' : 'Create'}
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
          <Alert onClose={() => setNotification(null)} severity={notification.type}>
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default DepartmentOverview;
