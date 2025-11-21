import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Box
} from '@mui/material';
import api from '../../services/api';

export default function AssignmentForm({
  open,
  onClose,
  onSubmit,
  scheduleId,
  initialData = null
}) {
  const [formData, setFormData] = useState({
    employeeId: initialData?.employeeId || '',
    shiftId: initialData?.shiftId || '',
    status: initialData?.status || 'assigned',
    priority: initialData?.priority || 3,
    notes: initialData?.notes || ''
  });

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && scheduleId) {
      loadFormData();
    }
  }, [open, scheduleId]);

  const loadFormData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load employees
      const employeesRes = await api.get('/api/employees', {
        params: { is_active: true, limit: 1000 }
      });
      const employeeData = employeesRes.data.items || employeesRes.data.employees || employeesRes.data || [];
      setEmployees(employeeData);

      // Load schedule to get date range
      const scheduleRes = await api.get(`/api/schedules/${scheduleId}`);
      const schedule = scheduleRes.data;

      // Load shifts for the schedule's date range
      const shiftsRes = await api.get('/api/shifts', {
        params: {
          date_from: schedule.weekStart || schedule.week_start,
          date_to: schedule.weekEnd || schedule.week_end,
          limit: 1000
        }
      });
      const shiftData = shiftsRes.data.items || shiftsRes.data.shifts || shiftsRes.data || [];
      setShifts(shiftData);

    } catch (err) {
      setError('Failed to load form data: ' + (err.response?.data?.detail || err.message));
      console.error('Load form data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.employeeId || !formData.shiftId) {
      setError('Please select both employee and shift');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
      // Form will be closed by parent component
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {initialData ? 'Edit Assignment' : 'Assign Employee to Shift'}
        </DialogTitle>

        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          ) : (
            <>
              <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                <InputLabel>Employee *</InputLabel>
                <Select
                  value={formData.employeeId}
                  onChange={handleChange('employeeId')}
                  required
                  label="Employee *"
                >
                  {employees.map(emp => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name || `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`}
                      {emp.email && ` (${emp.email})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Shift *</InputLabel>
                <Select
                  value={formData.shiftId}
                  onChange={handleChange('shiftId')}
                  required
                  label="Shift *"
                >
                  {shifts.map(shift => (
                    <MenuItem key={shift.id} value={shift.id}>
                      {shift.name} - {shift.date} ({shift.startTime || shift.start_time} - {shift.endTime || shift.end_time})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={handleChange('status')}
                  label="Status"
                >
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="declined">Declined</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={handleChange('priority')}
                  label="Priority"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                    <MenuItem key={p} value={p}>
                      {p} {p <= 3 ? '(Low)' : p <= 6 ? '(Medium)' : '(High)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={handleChange('notes')}
              />
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || submitting}
          >
            {submitting ? 'Creating...' : (initialData ? 'Update' : 'Create')} Assignment
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
