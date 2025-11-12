import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add,
  Today,
  ViewWeek,
  ViewModule,
  AutoFixHigh
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api, { getErrorMessage, scheduleService } from '../services/api';

const SchedulePage = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('timeGridWeek');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [notification, setNotification] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    employeeId: '',
    startTime: '',
    endTime: '',
    date: '',
    type: 'shift',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, employeesRes] = await Promise.all([
        scheduleService.getSchedules(),
        api.get('/api/employees')
      ]);
      
      const schedulesData = schedulesRes.data.schedules || [];
      const employeesData = employeesRes.data.employees || [];
      
      // Transform schedules to FullCalendar events
      const events = schedulesData.map(schedule => ({
        id: schedule.id,
        title: schedule.title || `Shift - ${schedule.employee_name || 'Employee'}`,
        start: schedule.start_time || schedule.date,
        end: schedule.end_time,
        backgroundColor: getEventColor(schedule.status),
        extendedProps: {
          employeeId: schedule.employee_id,
          type: schedule.type || 'shift',
          status: schedule.status
        }
      }));
      
      setSchedules(events);
      setEmployees(employeesData);
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (status) => {
    switch (status) {
      case 'confirmed': return '#2e7d32';
      case 'pending': return '#ed6c02';
      case 'cancelled': return '#d32f2f';
      default: return '#1976d2';
    }
  };

  const handleDateClick = (arg) => {
    setSelectedDate(arg.date);
    setScheduleForm(prev => ({
      ...prev,
      date: arg.dateStr,
      startTime: arg.dateStr + 'T09:00',
      endTime: arg.dateStr + 'T17:00'
    }));
    setDialogOpen(true);
  };

  const handleEventClick = (info) => {
    // Handle event click - could open edit dialog
    // Event info available in info.event
  };

  const handleFormSubmit = async () => {
    try {
      const scheduleData = {
        title: scheduleForm.title,
        employee_id: parseInt(scheduleForm.employeeId),
        start_time: scheduleForm.startTime,
        end_time: scheduleForm.endTime,
        date: scheduleForm.date,
        type: scheduleForm.type,
        notes: scheduleForm.notes
      };

      await scheduleService.createSchedule(scheduleData);
      setNotification({ type: 'success', message: 'Schedule created successfully' });
      setDialogOpen(false);
      loadData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleViewChange = (event, newView) => {
    if (newView !== null) {
      setView(newView);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Schedule Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              View and manage employee schedules
            </Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={handleViewChange}
              size="small"
            >
              <ToggleButton value="timeGridDay">
                <Today sx={{ mr: 1 }} fontSize="small" />
                Day
              </ToggleButton>
              <ToggleButton value="timeGridWeek">
                <ViewWeek sx={{ mr: 1 }} fontSize="small" />
                Week
              </ToggleButton>
              <ToggleButton value="dayGridMonth">
                <ViewModule sx={{ mr: 1 }} fontSize="small" />
                Month
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AutoFixHigh />}
              onClick={() => navigate('/schedule/builder')}
            >
              Schedule Builder
            </Button>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setDialogOpen(true)}
            >
              Add Schedule
            </Button>
          </Box>
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2 }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            events={schedules}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            height="auto"
          />
        </Box>
      </motion.div>

      {/* Add Schedule Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Schedule</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Title"
              value={scheduleForm.title}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, title: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Employee</InputLabel>
              <Select
                value={scheduleForm.employeeId}
                label="Employee"
                onChange={(e) => setScheduleForm(prev => ({ ...prev, employeeId: e.target.value }))}
              >
                {employees.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.firstName || emp.first_name} {emp.lastName || emp.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={scheduleForm.date}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Start Time"
              type="datetime-local"
              value={scheduleForm.startTime}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="End Time"
              type="datetime-local"
              value={scheduleForm.endTime}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={scheduleForm.type}
                label="Type"
                onChange={(e) => setScheduleForm(prev => ({ ...prev, type: e.target.value }))}
              >
                <MenuItem value="shift">Shift</MenuItem>
                <MenuItem value="meeting">Meeting</MenuItem>
                <MenuItem value="training">Training</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={scheduleForm.notes}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            Create Schedule
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

export default SchedulePage;
