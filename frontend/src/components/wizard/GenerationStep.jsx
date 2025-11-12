import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Divider
} from '@mui/material';
import {
  AutoFixHigh,
  CheckCircle,
  Warning,
  Error,
  Schedule,
  People,
  TrendingUp
} from '@mui/icons-material';
import api, { getErrorMessage } from '../../services/api';

const GenerationStep = ({ data, onChange, setNotification }) => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessages, setStatusMessages] = useState([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setStatusMessages([]);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Add status messages
      setStatusMessages(['Analyzing shift requirements...']);

      setTimeout(() => {
        setStatusMessages(prev => [...prev, 'Loading staff availability...']);
      }, 1000);

      setTimeout(() => {
        setStatusMessages(prev => [...prev, 'Running constraint solver...']);
      }, 2000);

      setTimeout(() => {
        setStatusMessages(prev => [...prev, 'Optimizing assignments...']);
      }, 3000);

      // Call generation API
      const response = await api.post('/api/schedule/generate', {
        department: data.department,
        date_range: data.dateRange,
        staff_ids: data.selectedStaff,
        requirements: data.adjustedRequirements || data.requirements,
        schedule_name: data.scheduleName,
        description: data.scheduleDescription
      });

      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        setStatusMessages(prev => [...prev, 'Schedule generated successfully!']);
      }, 3500);

      // Update wizard data with generated schedule
      onChange('generatedSchedule', response.data.schedule);
      onChange('generationStatus', response.data.status);
      onChange('generationErrors', response.data.conflicts || []);

      setNotification({
        type: response.data.status === 'complete' ? 'success' : 'warning',
        message: response.data.message || 'Schedule generation completed'
      });

    } catch (error) {
      setStatusMessages(prev => [...prev, 'Generation failed: ' + getErrorMessage(error)]);
      setNotification({
        type: 'error',
        message: 'Failed to generate schedule: ' + getErrorMessage(error)
      });
      onChange('generationStatus', 'failed');
      onChange('generationErrors', [error.message]);
    } finally {
      setGenerating(false);
    }
  };

  const getStatusIcon = () => {
    if (!data.generationStatus) return null;

    switch (data.generationStatus) {
      case 'complete':
        return <CheckCircle color="success" sx={{ fontSize: 60 }} />;
      case 'partial':
        return <Warning color="warning" sx={{ fontSize: 60 }} />;
      case 'failed':
        return <Error color="error" sx={{ fontSize: 60 }} />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (!data.generationStatus) return null;

    switch (data.generationStatus) {
      case 'complete':
        return 'Schedule generated successfully with all shifts filled!';
      case 'partial':
        return 'Schedule partially generated. Some shifts could not be filled due to constraints.';
      case 'failed':
        return 'Schedule generation failed. Please review the requirements and try again.';
      default:
        return null;
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Auto-Generate Schedule
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Use AI-powered constraint solving to automatically generate an optimized schedule
      </Typography>

      {/* Generation Status */}
      {!data.generatedSchedule && !generating && (
        <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <AutoFixHigh sx={{ fontSize: 40 }} />
              <Box flex={1}>
                <Typography variant="h6" gutterBottom>
                  Ready to Generate Schedule
                </Typography>
                <Typography variant="body2">
                  The constraint solver will automatically assign staff to shifts based on:
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="• Staff availability and qualifications" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Work hour limits and rest periods" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Fair distribution of shifts" />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="• Department rules and preferences" />
                  </ListItem>
                </List>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<AutoFixHigh />}
              onClick={handleGenerate}
              fullWidth
              sx={{
                mt: 2,
                bgcolor: 'primary.dark',
                '&:hover': { bgcolor: 'primary.darker' }
              }}
            >
              Generate Schedule Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {generating && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <CircularProgress size={40} />
              <Typography variant="h6">
                Generating Schedule...
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {statusMessages.map((msg, index) => (
                <Typography
                  key={index}
                  variant="body2"
                  color="textSecondary"
                  sx={{ py: 0.5 }}
                >
                  {msg}
                </Typography>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Generation Results */}
      {data.generatedSchedule && !generating && (
        <>
          <Card sx={{ mb: 3, textAlign: 'center' }}>
            <CardContent>
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                {getStatusIcon()}
                <Typography variant="h6">
                  {getStatusMessage()}
                </Typography>
                {data.generationStatus === 'complete' && (
                  <Chip
                    icon={<CheckCircle />}
                    label="100% Coverage"
                    color="success"
                    size="large"
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Schedule Summary */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Schedule color="primary" sx={{ fontSize: 40 }} />
                    <Box>
                      <Typography color="textSecondary" variant="caption">
                        Shifts Filled
                      </Typography>
                      <Typography variant="h5">
                        {data.generatedSchedule.filledShifts || 0} / {data.requirements?.length || 0}
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
                        {data.generatedSchedule.staffAssigned || 0}
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
                        Efficiency Score
                      </Typography>
                      <Typography variant="h5">
                        {data.generatedSchedule.efficiencyScore || 'N/A'}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Conflicts/Issues */}
          {data.generationErrors && data.generationErrors.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Issues Found:
              </Typography>
              <List dense>
                {data.generationErrors.map((error, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Warning fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={error} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {/* Regenerate Option */}
          <Divider sx={{ my: 2 }} />
          <Box textAlign="center">
            <Button
              variant="outlined"
              startIcon={<AutoFixHigh />}
              onClick={handleGenerate}
            >
              Regenerate Schedule
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default GenerationStep;
