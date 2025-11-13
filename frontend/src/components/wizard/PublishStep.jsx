import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  Publish,
  Save,
  GetApp,
  Email,
  CheckCircle,
  Schedule,
  People,
  AttachMoney,
  TrendingUp,
  Star
} from '@mui/icons-material';
import api, { getErrorMessage } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const PublishStep = ({ data, onChange, setNotification }) => {
  const [publishing, setPublishing] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const navigate = useNavigate();

  const statistics = data.statistics || calculateStatistics();

  function calculateStatistics() {
    const schedule = data.currentSchedule || {};
    const assignments = schedule.assignments || [];

    const totalShifts = assignments.length;
    const uniqueStaff = new Set(assignments.map(a => a.staffId)).size;

    let totalHours = 0;
    let overtimeHours = 0;

    assignments.forEach(assignment => {
      const start = new Date(assignment.startTime);
      const end = new Date(assignment.endTime);
      const hours = (end - start) / (1000 * 60 * 60);
      totalHours += hours;
      if (hours > 8) overtimeHours += (hours - 8);
    });

    const coveragePercentage = data.requirements?.length > 0
      ? Math.round((totalShifts / data.requirements.length) * 100)
      : 100;

    const estimatedCost = totalHours * 25 + overtimeHours * 37.5;

    const fairnessScore = calculateFairnessScore(assignments);

    return {
      totalShifts,
      uniqueStaff,
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      coveragePercentage,
      estimatedCost: Math.round(estimatedCost),
      fairnessScore
    };
  }

  function calculateFairnessScore(assignments) {
    if (assignments.length === 0) return 100;

    const staffHours = {};
    assignments.forEach(assignment => {
      const staffId = assignment.staffId;
      const start = new Date(assignment.startTime);
      const end = new Date(assignment.endTime);
      const hours = (end - start) / (1000 * 60 * 60);

      staffHours[staffId] = (staffHours[staffId] || 0) + hours;
    });

    const hours = Object.values(staffHours);
    const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);

    const fairness = Math.max(0, 100 - (stdDev / avg * 100));
    return Math.round(fairness);
  }

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Validate data before proceeding
      if (!data.currentSchedule?.assignments || data.currentSchedule.assignments.length === 0) {
        setNotification({
          type: 'error',
          message: 'No assignments to publish. Please complete the Generation step first.'
        });
        return;
      }

      if (!data.dateRange?.start || !data.dateRange?.end) {
        setNotification({
          type: 'error',
          message: 'Invalid date range. Please go back to Configuration step.'
        });
        return;
      }

      // Step 1: Create Schedule container
      console.log('Creating schedule container...');
      const scheduleResponse = await api.post('/api/schedules', {
        week_start: data.dateRange.start,
        week_end: data.dateRange.end,
        title: data.scheduleName || `Schedule for ${data.dateRange.start}`,
        description: data.scheduleDescription || '',
        notes: data.notes || ''
      });

      const scheduleId = scheduleResponse.data.id;
      console.log(`Schedule created with ID: ${scheduleId}`);

      // Step 2: Create schedule assignments in bulk
      const assignments = data.currentSchedule.assignments.map(assignment => ({
        employee_id: assignment.employeeId || assignment.employee_id || assignment.staffId,
        shift_id: assignment.shiftId || assignment.shift_id,
        status: assignment.status || 'assigned',
        priority: assignment.priority || 1,
        notes: assignment.notes || ''
      }));

      console.log(`Creating ${assignments.length} assignments via bulk endpoint...`);

      const bulkResponse = await api.post('/api/assignments/bulk', {
        schedule_id: scheduleId,
        assignments: assignments,
        validate_conflicts: true
      });

      console.log(`Created ${bulkResponse.data.total_created} assignments successfully`);

      // Handle any conflicts or errors
      if (bulkResponse.data.errors && bulkResponse.data.errors.length > 0) {
        console.warn('Some assignments had conflicts:', bulkResponse.data.errors);
        setNotification({
          type: 'warning',
          message: `Schedule created, but ${bulkResponse.data.errors.length} assignment(s) had conflicts and were skipped.`
        });
      } else {
        setNotification({
          type: 'success',
          message: `Schedule published successfully with ${bulkResponse.data.total_created} assignments!`
        });
      }

      // Step 3: Optionally publish the schedule (change status)
      if (data.publishOptions?.notifyEmployees) {
        try {
          await api.put(`/api/schedules/${scheduleId}`, {
            status: 'published'
          });
          console.log('Schedule status changed to published');
        } catch (err) {
          console.warn('Failed to update schedule status:', err);
          // Continue anyway - schedule is created
        }
      }

      // Clear saved progress
      localStorage.removeItem('scheduleBuilderProgress');

      // Redirect to schedule view
      setTimeout(() => {
        navigate(`/schedules/${scheduleId}`);
      }, 2000);

    } catch (error) {
      console.error('Failed to publish schedule:', error);
      setNotification({
        type: 'error',
        message: 'Failed to publish schedule: ' + getErrorMessage(error)
      });
    } finally {
      setPublishing(false);
      setPublishDialog(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Create Schedule container with draft status
      console.log('Saving schedule as draft...');
      const scheduleResponse = await api.post('/api/schedules', {
        week_start: data.dateRange.start,
        week_end: data.dateRange.end,
        title: data.scheduleName || `Draft Schedule for ${data.dateRange.start}`,
        description: data.scheduleDescription || '',
        notes: data.notes || ''
        // Status defaults to 'draft' in backend
      });

      const scheduleId = scheduleResponse.data.id;
      console.log(`Draft schedule created with ID: ${scheduleId}`);

      // Save assignments if they exist using bulk endpoint
      const assignmentsData = data.currentSchedule?.assignments || [];
      if (assignmentsData.length > 0) {
        console.log(`Saving ${assignmentsData.length} draft assignments...`);

        const assignments = assignmentsData.map(assignment => ({
          employee_id: assignment.employeeId || assignment.employee_id || assignment.staffId,
          shift_id: assignment.shiftId || assignment.shift_id,
          status: 'pending',  // Draft assignments are pending
          priority: assignment.priority || 1,
          notes: assignment.notes || ''
        }));

        try {
          const bulkResponse = await api.post('/api/assignments/bulk', {
            schedule_id: scheduleId,
            assignments: assignments,
            validate_conflicts: false  // Don't validate conflicts for drafts
          });
          console.log(`Saved ${bulkResponse.data.total_created} draft assignments`);
        } catch (err) {
          console.warn('Failed to save draft assignments:', err);
          // Continue anyway - schedule container is created
        }
      }

      setNotification({
        type: 'success',
        message: 'Schedule saved as draft'
      });

      localStorage.removeItem('scheduleBuilderProgress');

      setTimeout(() => {
        navigate(`/schedules/${scheduleId}`);
      }, 1500);

    } catch (error) {
      console.error('Failed to save draft:', error);
      setNotification({
        type: 'error',
        message: 'Failed to save draft: ' + getErrorMessage(error)
      });
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await api.post('/api/schedule/export', {
        schedule: data.currentSchedule,
        format,
        name: data.scheduleName
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${data.scheduleName}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setNotification({
        type: 'success',
        message: `Schedule exported as ${format.toUpperCase()}`
      });

    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Export failed: ' + getErrorMessage(error)
      });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Preview & Publish
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Review the final schedule and publish to notify employees
      </Typography>

      {/* Schedule Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Schedule Summary
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {data.scheduleName}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {new Date(data.dateRange.start).toLocaleDateString()} - {new Date(data.dateRange.end).toLocaleDateString()}
          </Typography>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Schedule color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Total Shifts
                  </Typography>
                  <Typography variant="h5">
                    {statistics.totalShifts}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <People color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Staff Assigned
                  </Typography>
                  <Typography variant="h5">
                    {statistics.uniqueStaff}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <TrendingUp color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Coverage
                  </Typography>
                  <Typography variant="h5">
                    {statistics.coveragePercentage}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <AttachMoney color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Estimated Cost
                  </Typography>
                  <Typography variant="h5">
                    ${statistics.estimatedCost.toLocaleString()}
                  </Typography>
                  {statistics.overtimeHours > 0 && (
                    <Typography variant="caption" color="warning.main">
                      {statistics.overtimeHours}h overtime
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Star color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Fairness Score
                  </Typography>
                  <Typography variant="h5">
                    {statistics.fairnessScore}
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      statistics.fairnessScore >= 80 ? 'Excellent' :
                      statistics.fairnessScore >= 60 ? 'Good' : 'Fair'
                    }
                    color={
                      statistics.fairnessScore >= 80 ? 'success' :
                      statistics.fairnessScore >= 60 ? 'primary' : 'warning'
                    }
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Schedule color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Total Hours
                  </Typography>
                  <Typography variant="h5">
                    {statistics.totalHours}h
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Publishing Options */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Publishing Options
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={data.publishOptions?.notifyEmployees ?? true}
                onChange={(e) => onChange('publishOptions', {
                  ...data.publishOptions,
                  notifyEmployees: e.target.checked
                })}
              />
            }
            label={
              <Box>
                <Typography variant="body1">Notify Employees</Typography>
                <Typography variant="caption" color="textSecondary">
                  Send email notifications to all assigned staff members
                </Typography>
              </Box>
            }
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Save />}
            onClick={handleSaveDraft}
            size="large"
          >
            Save as Draft
          </Button>
        </Grid>
        <Grid item xs={12} md={4}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GetApp />}
            onClick={() => handleExport('pdf')}
            size="large"
          >
            Export PDF
          </Button>
        </Grid>
        <Grid item xs={12} md={4}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Publish />}
            onClick={() => setPublishDialog(true)}
            size="large"
            color="primary"
          >
            Publish Schedule
          </Button>
        </Grid>
      </Grid>

      {/* Publish Confirmation Dialog */}
      <Dialog open={publishDialog} onClose={() => !publishing && setPublishDialog(false)}>
        <DialogTitle>Publish Schedule?</DialogTitle>
        <DialogContent>
          {publishing ? (
            <Box textAlign="center" py={3}>
              <CircularProgress size={60} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Publishing schedule...
              </Typography>
            </Box>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Once published, the schedule will be visible to all assigned employees.
              </Alert>
              <Typography variant="body2" gutterBottom>
                This will:
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Make the schedule visible to employees" />
                </ListItem>
                {data.publishOptions?.notifyEmployees && (
                  <ListItem>
                    <ListItemIcon>
                      <Email color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={`Send notifications to ${statistics.uniqueStaff} employees`} />
                  </ListItem>
                )}
                <ListItem>
                  <ListItemIcon>
                    <Schedule color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Add shifts to employee calendars" />
                </ListItem>
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPublishDialog(false)}
            disabled={publishing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            variant="contained"
            disabled={publishing}
          >
            Confirm Publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublishStep;
