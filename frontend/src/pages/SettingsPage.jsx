import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert
} from '@mui/material';
import {
  Notifications,
  Security,
  Palette,
  Language,
  Schedule,
  Save
} from '@mui/icons-material';

const SettingsPage = () => {
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

  const [saved, setSaved] = useState(false);

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSave = () => {
    // Simulate saving settings
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const settingSections = [
    {
      title: 'Notifications',
      icon: <Notifications />,
      settings: [
        {
          key: 'email',
          label: 'Email Notifications',
          description: 'Receive notifications via email',
          type: 'switch',
          value: settings.notifications.email
        },
        {
          key: 'push',
          label: 'Push Notifications',
          description: 'Receive browser push notifications',
          type: 'switch',
          value: settings.notifications.push
        },
        {
          key: 'scheduleReminders',
          label: 'Schedule Reminders',
          description: 'Get reminders before shifts start',
          type: 'switch',
          value: settings.notifications.scheduleReminders
        },
        {
          key: 'overtimeAlerts',
          label: 'Overtime Alerts',
          description: 'Alert when approaching overtime limits',
          type: 'switch',
          value: settings.notifications.overtimeAlerts
        }
      ]
    },
    {
      title: 'Appearance',
      icon: <Palette />,
      settings: [
        {
          key: 'theme',
          label: 'Theme',
          description: 'Choose your preferred theme',
          type: 'select',
          value: settings.appearance.theme,
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' }
          ]
        },
        {
          key: 'language',
          label: 'Language',
          description: 'Select your preferred language',
          type: 'select',
          value: settings.appearance.language,
          options: [
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' }
          ]
        },
        {
          key: 'timezone',
          label: 'Timezone',
          description: 'Your local timezone',
          type: 'select',
          value: settings.appearance.timezone,
          options: [
            { value: 'America/New_York', label: 'Eastern Time' },
            { value: 'America/Chicago', label: 'Central Time' },
            { value: 'America/Denver', label: 'Mountain Time' },
            { value: 'America/Los_Angeles', label: 'Pacific Time' }
          ]
        }
      ]
    },
    {
      title: 'Scheduling',
      icon: <Schedule />,
      settings: [
        {
          key: 'defaultShiftLength',
          label: 'Default Shift Length (hours)',
          description: 'Default duration for new shifts',
          type: 'number',
          value: settings.scheduling.defaultShiftLength
        },
        {
          key: 'maxOvertimeHours',
          label: 'Max Overtime Hours',
          description: 'Maximum overtime hours per week',
          type: 'number',
          value: settings.scheduling.maxOvertimeHours
        },
        {
          key: 'breakDuration',
          label: 'Break Duration (minutes)',
          description: 'Default break duration',
          type: 'number',
          value: settings.scheduling.breakDuration
        },
        {
          key: 'autoApproveRequests',
          label: 'Auto-approve Requests',
          description: 'Automatically approve time-off requests',
          type: 'switch',
          value: settings.scheduling.autoApproveRequests
        }
      ]
    },
    {
      title: 'Security',
      icon: <Security />,
      settings: [
        {
          key: 'twoFactorAuth',
          label: 'Two-Factor Authentication',
          description: 'Add an extra layer of security',
          type: 'switch',
          value: settings.security.twoFactorAuth
        },
        {
          key: 'sessionTimeout',
          label: 'Session Timeout (minutes)',
          description: 'Automatically log out after inactivity',
          type: 'number',
          value: settings.security.sessionTimeout
        }
      ]
    }
  ];

  const renderSetting = (section, setting) => {
    const handleChange = (value) => {
      handleSettingChange(section.title.toLowerCase(), setting.key, value);
    };

    switch (setting.type) {
      case 'switch':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={setting.value}
                onChange={(e) => handleChange(e.target.checked)}
              />
            }
            label=""
          />
        );

      case 'select':
        return (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={setting.value}
              onChange={(e) => handleChange(e.target.value)}
            >
              {setting.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'number':
        return (
          <TextField
            type="number"
            size="small"
            value={setting.value}
            onChange={(e) => handleChange(Number(e.target.value))}
            sx={{ width: 100 }}
          />
        );

      default:
        return null;
    }
  };

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

      {/* Success Alert */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings saved successfully!
          </Alert>
        </motion.div>
      )}

      {/* Settings Sections */}
      <Grid container spacing={3}>
        {settingSections.map((section, sectionIndex) => (
          <Grid item xs={12} key={section.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: sectionIndex * 0.1 }}
            >
              <Paper sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: 3,
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    color: 'white'
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    {section.icon}
                    <Typography variant="h6" fontWeight="bold">
                      {section.title}
                    </Typography>
                  </Box>
                </Box>

                <List>
                  {section.settings.map((setting, settingIndex) => (
                    <Box key={setting.key}>
                      <ListItem sx={{ py: 2 }}>
                        <ListItemText
                          primary={setting.label}
                          secondary={setting.description}
                          primaryTypographyProps={{ fontWeight: 500 }}
                        />
                        <ListItemSecondaryAction>
                          {renderSetting(section, setting)}
                        </ListItemSecondaryAction>
                      </ListItem>
                      {settingIndex < section.settings.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </Paper>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Additional Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Advanced Settings
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            These settings are for advanced users only. Changing these may affect application performance.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="API Endpoint"
                defaultValue="https://api.scheduleai.com"
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Cache Duration (minutes)"
                type="number"
                defaultValue="30"
                size="small"
              />
            </Grid>
          </Grid>

          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Data & Privacy
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip label="GDPR Compliant" color="success" size="small" />
              <Chip label="Data Encrypted" color="primary" size="small" />
              <Chip label="Regular Backups" color="info" size="small" />
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
};

export default SettingsPage;