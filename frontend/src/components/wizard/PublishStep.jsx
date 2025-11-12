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
      const response = await api.post('/api/schedules', {
        name: data.scheduleName,
        description: data.scheduleDescription,
        department_id: data.department,
        start_date: data.dateRange.start,
        end_date: data.dateRange.end,
        assignments: data.currentSchedule.assignments,
        status: 'published',
        notify_employees: data.publishOptions.notifyEmployees
      });

      setNotification({
        type: 'success',
        message: 'Schedule published successfully!'
      });

      // Clear saved progress
      localStorage.removeItem('scheduleBuilderProgress');

      // Redirect to schedule view
      setTimeout(() => {
        navigate('/schedules');
      }, 2000);

    } catch (error) {
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
      await api.post('/api/schedules', {
        name: data.scheduleName,
        description: data.scheduleDescription,
        department_id: data.department,
        start_date: data.dateRange.start,
        end_date: data.dateRange.end,
        assignments: data.currentSchedule.assignments,
        status: 'draft'
      });

      setNotification({
        type: 'success',
        message: 'Schedule saved as draft'
      });

      localStorage.removeItem('scheduleBuilderProgress');

      setTimeout(() => {
        navigate('/schedules');
      }, 1500);

    } catch (error) {
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
