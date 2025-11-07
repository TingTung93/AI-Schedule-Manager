import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  Notifications,
  Palette,
  Security,
  Schedule as ScheduleIcon,
  Save
} from '@mui/icons-material';
import { settingsService } from '../services/api';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      scheduleReminders: true,
      overtimeAlerts: true
    },
    appearance: {
      theme: 'light',
      language: 'en',
      timezone: 'America/New_York'
    },
    scheduling: {
      defaultShiftLength: 8,
      maxOvertimeHours: 10,
      breakDuration: 30,
      autoApproveRequests: false
    },
    security: {
      twoFactorAuth: false,
      sessionTimeout: 60
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getSettings();
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setNotification({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await settingsService.updateSettings(settings);
      setNotification({ type: 'success', message: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setNotification({ type: 'error', message: 'Failed to save settings' });
    }
  };

  const handleNotificationChange = (key) => (event) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: event.target.checked
      }
    }));
  };

  const handleAppearanceChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [key]: value
      }
    }));
  };

  const handleSchedulingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        [key]: value
      }
    }));
  };

  const handleSecurityChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [key]: value
      }
    }));
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
              Settings
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Customize your application preferences
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            size="large"
          >
            Save Changes
          </Button>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Notifications */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Notifications sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">Notifications</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.email}
                    onChange={handleNotificationChange('email')}
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.push}
                    onChange={handleNotificationChange('push')}
                  />
                }
                label="Push Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.scheduleReminders}
                    onChange={handleNotificationChange('scheduleReminders')}
                  />
                }
                label="Schedule Reminders"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.notifications.overtimeAlerts}
                    onChange={handleNotificationChange('overtimeAlerts')}
                  />
                }
                label="Overtime Alerts"
              />
            </Paper>
          </motion.div>
        </Grid>

        {/* Appearance */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Palette sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">Appearance</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={settings.appearance.theme}
                  label="Theme"
                  onChange={(e) => handleAppearanceChange('theme', e.target.value)}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Language</InputLabel>
                <Select
                  value={settings.appearance.language}
                  label="Language"
                  onChange={(e) => handleAppearanceChange('language', e.target.value)}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={settings.appearance.timezone}
                  label="Timezone"
                  onChange={(e) => handleAppearanceChange('timezone', e.target.value)}
                >
                  <MenuItem value="America/New_York">Eastern Time</MenuItem>
                  <MenuItem value="America/Chicago">Central Time</MenuItem>
                  <MenuItem value="America/Denver">Mountain Time</MenuItem>
                  <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </motion.div>
        </Grid>

        {/* Scheduling */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <ScheduleIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">Scheduling</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />
              <TextField
                fullWidth
                type="number"
                label="Default Shift Length (hours)"
                value={settings.scheduling.defaultShiftLength}
                onChange={(e) => handleSchedulingChange('defaultShiftLength', parseInt(e.target.value))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type="number"
                label="Max Overtime Hours"
                value={settings.scheduling.maxOvertimeHours}
                onChange={(e) => handleSchedulingChange('maxOvertimeHours', parseInt(e.target.value))}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                type="number"
                label="Break Duration (minutes)"
                value={settings.scheduling.breakDuration}
                onChange={(e) => handleSchedulingChange('breakDuration', parseInt(e.target.value))}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.scheduling.autoApproveRequests}
                    onChange={(e) => handleSchedulingChange('autoApproveRequests', e.target.checked)}
                  />
                }
                label="Auto-approve Time-off Requests"
              />
            </Paper>
          </motion.div>
        </Grid>

        {/* Security */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">Security</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.security.twoFactorAuth}
                        onChange={(e) => handleSecurityChange('twoFactorAuth', e.target.checked)}
                      />
                    }
                    label="Two-Factor Authentication"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Session Timeout (minutes)"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                  />
                </Grid>
              </Grid>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

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

export default SettingsPage;
