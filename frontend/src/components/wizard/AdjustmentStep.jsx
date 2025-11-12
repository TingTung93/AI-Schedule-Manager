import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Tooltip,
  TextField,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  Warning,
  CheckCircle,
  CalendarViewDay,
  CalendarViewWeek
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const AdjustmentStep = ({ data, onChange, setNotification }) => {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'table'
  const [editDialog, setEditDialog] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [conflictWarnings, setConflictWarnings] = useState([]);

  const schedule = data.currentSchedule || {};
  const assignments = schedule.assignments || [];

  useEffect(() => {
    checkConflicts();
  }, [assignments]);

  const checkConflicts = () => {
    const warnings = [];
    const staffAssignments = {};

    assignments.forEach((assignment, index) => {
      const staffId = assignment.staffId;
      const startTime = new Date(assignment.startTime);
      const endTime = new Date(assignment.endTime);

      if (!staffAssignments[staffId]) {
        staffAssignments[staffId] = [];
      }

      // Check for overlapping assignments
      staffAssignments[staffId].forEach(existing => {
        const existingStart = new Date(existing.startTime);
        const existingEnd = new Date(existing.endTime);

        if (
          (startTime >= existingStart && startTime < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd) ||
          (startTime <= existingStart && endTime >= existingEnd)
        ) {
          warnings.push({
            type: 'overlap',
            message: `${assignment.staffName} has overlapping shifts`,
            assignmentIndex: index
          });
        }
      });

      staffAssignments[staffId].push(assignment);
    });

    setConflictWarnings(warnings);
  };

  const handleEditAssignment = (assignment, index) => {
    setCurrentEdit({ ...assignment, index });
    setEditDialog(true);
  };

  const handleSaveEdit = () => {
    const updatedAssignments = [...assignments];
    updatedAssignments[currentEdit.index] = currentEdit;

    onChange('currentSchedule', {
      ...schedule,
      assignments: updatedAssignments
    });

    // Track manual modifications
    const modifications = data.manualModifications || [];
    modifications.push({
      type: 'edit',
      timestamp: new Date().toISOString(),
      assignment: currentEdit
    });
    onChange('manualModifications', modifications);

    setEditDialog(false);
    setCurrentEdit(null);
    setNotification({
      type: 'success',
      message: 'Assignment updated successfully'
    });
  };

  const handleDeleteAssignment = (index) => {
    const updatedAssignments = assignments.filter((_, i) => i !== index);

    onChange('currentSchedule', {
      ...schedule,
      assignments: updatedAssignments
    });

    const modifications = data.manualModifications || [];
    modifications.push({
      type: 'delete',
      timestamp: new Date().toISOString(),
      assignment: assignments[index]
    });
    onChange('manualModifications', modifications);

    setNotification({
      type: 'info',
      message: 'Assignment removed'
    });
  };

  const handleAddAssignment = () => {
    setCurrentEdit({
      staffId: '',
      staffName: '',
      shiftType: '',
      startTime: '',
      endTime: '',
      date: ''
    });
    setEditDialog(true);
  };

  const transformToCalendarEvents = () => {
    return assignments.map((assignment, index) => ({
      id: index.toString(),
      title: `${assignment.staffName} - ${assignment.shiftType}`,
      start: assignment.startTime,
      end: assignment.endTime,
      backgroundColor: getEventColor(assignment),
      extendedProps: {
        ...assignment,
        index
      }
    }));
  };

  const getEventColor = (assignment) => {
    const warnings = conflictWarnings.filter(w => w.assignmentIndex === assignments.indexOf(assignment));
    if (warnings.length > 0) return '#d32f2f'; // Red for conflicts
    return '#1976d2'; // Blue for normal
  };

  const handleEventClick = (info) => {
    const assignment = info.event.extendedProps;
    handleEditAssignment(assignment, assignment.index);
  };

  const renderCalendarView = () => (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'timeGridWeek,timeGridDay'
      }}
      events={transformToCalendarEvents()}
      eventClick={handleEventClick}
      editable={true}
      selectable={true}
      height="auto"
    />
  );

  const renderTableView = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Staff Member</TableCell>
            <TableCell>Shift Type</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Time</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assignments.map((assignment, index) => {
            const hasConflict = conflictWarnings.some(w => w.assignmentIndex === index);
            const startTime = new Date(assignment.startTime);
            const endTime = new Date(assignment.endTime);
            const duration = Math.round((endTime - startTime) / (1000 * 60 * 60 * 10)) / 10;

            return (
              <TableRow key={index} sx={{ bgcolor: hasConflict ? 'error.lighter' : 'inherit' }}>
                <TableCell>{assignment.staffName}</TableCell>
                <TableCell>
                  <Chip label={assignment.shiftType} size="small" />
                </TableCell>
                <TableCell>
                  {startTime.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </TableCell>
                <TableCell>
                  {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} -
                  {endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </TableCell>
                <TableCell>{duration}h</TableCell>
                <TableCell>
                  {hasConflict ? (
                    <Chip
                      icon={<Warning />}
                      label="Conflict"
                      color="error"
                      size="small"
                    />
                  ) : (
                    <Chip
                      icon={<CheckCircle />}
                      label="OK"
                      color="success"
                      size="small"
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => handleEditAssignment(assignment, index)}
                    >
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteAssignment(index)}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Manual Adjustments
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Fine-tune the generated schedule by editing individual assignments
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="calendar">
              <CalendarViewWeek sx={{ mr: 1 }} fontSize="small" />
              Calendar
            </ToggleButton>
            <ToggleButton value="table">
              <CalendarViewDay sx={{ mr: 1 }} fontSize="small" />
              Table
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddAssignment}
          >
            Add Assignment
          </Button>
        </Box>
      </Box>

      {/* Conflict Warnings */}
      {conflictWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {conflictWarnings.length} conflict(s) detected:
          </Typography>
          {conflictWarnings.slice(0, 3).map((warning, index) => (
            <Typography key={index} variant="body2">
              • {warning.message}
            </Typography>
          ))}
          {conflictWarnings.length > 3 && (
            <Typography variant="body2">
              ... and {conflictWarnings.length - 3} more
            </Typography>
          )}
        </Alert>
      )}

      {/* View Content */}
      <Box sx={{ mt: 2 }}>
        {viewMode === 'calendar' ? renderCalendarView() : renderTableView()}
      </Box>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {currentEdit?.index !== undefined ? 'Edit Assignment' : 'Add Assignment'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Staff Member</InputLabel>
              <Select
                value={currentEdit?.staffId || ''}
                label="Staff Member"
                onChange={(e) => {
                  const staff = data.selectedStaff.find(s => s === e.target.value);
                  setCurrentEdit({
                    ...currentEdit,
                    staffId: e.target.value,
                    staffName: staff?.name || ''
                  });
                }}
              >
                {(data.selectedStaff || []).map(staffId => (
                  <MenuItem key={staffId} value={staffId}>
                    Staff {staffId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Shift Type"
              value={currentEdit?.shiftType || ''}
              onChange={(e) => setCurrentEdit({ ...currentEdit, shiftType: e.target.value })}
            />

            <TextField
              fullWidth
              type="date"
              label="Date"
              value={currentEdit?.date || ''}
              onChange={(e) => setCurrentEdit({ ...currentEdit, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              type="time"
              label="Start Time"
              value={currentEdit?.startTime?.split('T')[1]?.substring(0, 5) || ''}
              onChange={(e) => setCurrentEdit({
                ...currentEdit,
                startTime: `${currentEdit.date}T${e.target.value}`
              })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              type="time"
              label="End Time"
              value={currentEdit?.endTime?.split('T')[1]?.substring(0, 5) || ''}
              onChange={(e) => setCurrentEdit({
                ...currentEdit,
                endTime: `${currentEdit.date}T${e.target.value}`
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdjustmentStep;
