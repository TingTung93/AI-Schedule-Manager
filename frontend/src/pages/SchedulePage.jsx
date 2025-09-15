import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add,
  CalendarToday,
  Schedule as ScheduleIcon,
  Person,
  AccessTime,
  Today,
  ViewWeek,
  ViewModule
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const SchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [view, setView] = useState('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    employee: '',
    startTime: '',
    endTime: '',
    date: '',
    type: 'shift',
    notes: ''
  });

  useEffect(() => {
    // Simulate loading schedules
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    setSchedules([
      {
        id: 1,
        title: 'Morning Shift - John Doe',
        start: today.toISOString().split('T')[0] + 'T09:00:00',
        end: today.toISOString().split('T')[0] + 'T17:00:00',
        employee: 'John Doe',
        type: 'shift',
        backgroundColor: '#1976d2'
      },
      {
        id: 2,
        title: 'Evening Shift - Jane Smith',
        start: today.toISOString().split('T')[0] + 'T14:00:00',
        end: today.toISOString().split('T')[0] + 'T22:00:00',
        employee: 'Jane Smith',
        type: 'shift',
        backgroundColor: '#2e7d32'
      },
      {
        id: 3,
        title: 'Team Meeting',
        start: tomorrow.toISOString().split('T')[0] + 'T10:00:00',
        end: tomorrow.toISOString().split('T')[0] + 'T11:00:00',
        type: 'meeting',
        backgroundColor: '#ed6c02'
      }
    ]);
  }, []);

  const handleDateClick = (arg) => {
    setSelectedDate(arg.date);
    setScheduleForm(prev => ({
      ...prev,
      date: arg.dateStr
    }));
    setDialogOpen(true);
  };

  const handleEventClick = (arg) => {
    const event = schedules.find(s => s.id === parseInt(arg.event.id));
    if (event) {
      setScheduleForm({
        ...event,
        date: event.start.split('T')[0],
        startTime: event.start.split('T')[1]?.split(':').slice(0, 2).join(':') || '',
        endTime: event.end.split('T')[1]?.split(':').slice(0, 2).join(':') || ''
      });
      setDialogOpen(true);
    }
  };

  const handleFormSubmit = () => {
    const newSchedule = {
      id: scheduleForm.id || Math.max(...schedules.map(s => s.id), 0) + 1,
      title: scheduleForm.title,
      start: `${scheduleForm.date}T${scheduleForm.startTime}:00`,
      end: `${scheduleForm.date}T${scheduleForm.endTime}:00`,
      employee: scheduleForm.employee,
      type: scheduleForm.type,
      backgroundColor: getTypeColor(scheduleForm.type),
      notes: scheduleForm.notes
    };

    if (scheduleForm.id) {
      setSchedules(prev => prev.map(s => s.id === scheduleForm.id ? newSchedule : s));
    } else {
      setSchedules(prev => [...prev, newSchedule]);
    }

    setDialogOpen(false);
    setScheduleForm({
      title: '',
      employee: '',
      startTime: '',
      endTime: '',
      date: '',
      type: 'shift',
      notes: ''
    });
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'shift': return '#1976d2';
      case 'meeting': return '#ed6c02';
      case 'break': return '#9c27b0';
      case 'overtime': return '#d32f2f';
      default: return '#1976d2';
    }
  };

  const getCalendarView = () => {
    switch (view) {
      case 'day': return 'timeGridDay';
      case 'week': return 'timeGridWeek';
      case 'month': return 'dayGridMonth';
      default: return 'timeGridWeek';
    }
  };

  const todaySchedules = schedules.filter(schedule => {
    const today = new Date().toISOString().split('T')[0];
    return schedule.start.startsWith(today);
  });

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
              Manage shifts, meetings, and time-off requests
            </Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(e, newView) => newView && setView(newView)}
              size="small"
            >
              <ToggleButton value="day">
                <Today fontSize="small" />
              </ToggleButton>
              <ToggleButton value="week">
                <ViewWeek fontSize="small" />
              </ToggleButton>
              <ToggleButton value="month">
                <ViewModule fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setDialogOpen(true)}
              size="large"
            >
              Add Schedule
            </Button>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Calendar */}
        <Grid item xs={12} lg={9}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                initialView={getCalendarView()}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                events={schedules}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                height="auto"
                slotMinTime="06:00:00"
                slotMaxTime="24:00:00"
                allDaySlot={false}
              />
            </Paper>
          </motion.div>
        </Grid>

        {/* Today's Schedule */}
        <Grid item xs={12} lg={3}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                Today's Schedule
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {todaySchedules.length === 0 ? (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={4}>
                  No schedules for today
                </Typography>
              ) : (
                <List>
                  {todaySchedules.map((schedule, index) => (
                    <ListItem key={schedule.id} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <Chip
                          size="small"
                          label={schedule.type}
                          sx={{
                            backgroundColor: schedule.backgroundColor,
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={schedule.title}
                        secondary={`${new Date(schedule.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(schedule.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        primaryTypographyProps={{ fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ fontSize: '0.8rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Quick Stats
              </Typography>
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Total Hours Today:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {todaySchedules.reduce((total, schedule) => {
                      const start = new Date(schedule.start);
                      const end = new Date(schedule.end);
                      return total + (end - start) / (1000 * 60 * 60);
                    }, 0).toFixed(1)}h
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Active Schedules:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {todaySchedules.length}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

      {/* Add/Edit Schedule Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {scheduleForm.id ? 'Edit Schedule' : 'Add New Schedule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Employee"
                  value={scheduleForm.employee}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    employee: e.target.value
                  }))}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={scheduleForm.type}
                    label="Type"
                    onChange={(e) => setScheduleForm(prev => ({
                      ...prev,
                      type: e.target.value
                    }))}
                  >
                    <MenuItem value="shift">Shift</MenuItem>
                    <MenuItem value="meeting">Meeting</MenuItem>
                    <MenuItem value="break">Break</MenuItem>
                    <MenuItem value="overtime">Overtime</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    date: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    startTime: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    endTime: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm(prev => ({
                    ...prev,
                    notes: e.target.value
                  }))}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            {scheduleForm.id ? 'Update' : 'Add'} Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchedulePage;