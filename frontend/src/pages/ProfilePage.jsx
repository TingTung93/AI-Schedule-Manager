import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Button,
  TextField,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Email,
  Phone,
  Badge,
  CalendarToday,
  Schedule,
  TrendingUp,
  PhotoCamera,
  Security,
  Notifications
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

const ProfilePage = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || 'John',
    lastName: user?.lastName || 'Doe',
    email: user?.email || 'john.doe@company.com',
    phone: '+1-555-0123',
    department: 'Operations',
    role: user?.role || 'employee',
    hireDate: '2023-01-15',
    address: '123 Main St, City, State 12345',
    emergencyContact: 'Jane Doe (+1-555-0124)'
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saved, setSaved] = useState(false);

  const stats = [
    {
      title: 'Total Hours This Month',
      value: '164h',
      icon: <Schedule />,
      color: 'primary'
    },
    {
      title: 'Attendance Rate',
      value: '98%',
      icon: <TrendingUp />,
      color: 'success'
    },
    {
      title: 'Shifts Completed',
      value: '23',
      icon: <CalendarToday />,
      color: 'info'
    },
    {
      title: 'Performance Score',
      value: '4.8/5',
      icon: <Badge />,
      color: 'warning'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      action: 'Completed shift',
      date: '2024-01-15',
      details: 'Morning shift (9:00 AM - 5:00 PM)'
    },
    {
      id: 2,
      action: 'Requested time off',
      date: '2024-01-14',
      details: 'Vacation request for next week'
    },
    {
      id: 3,
      action: 'Updated availability',
      date: '2024-01-13',
      details: 'Modified weekend availability'
    }
  ];

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    setEditing(false);
    // Reset form data to original values
    setProfileData({
      firstName: user?.firstName || 'John',
      lastName: user?.lastName || 'Doe',
      email: user?.email || 'john.doe@company.com',
      phone: '+1-555-0123',
      department: 'Operations',
      role: user?.role || 'employee',
      hireDate: '2023-01-15',
      address: '123 Main St, City, State 12345',
      emergencyContact: 'Jane Doe (+1-555-0124)'
    });
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordSubmit = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // Simulate password change
    setPasswordDialogOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      default: return 'primary';
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
              My Profile
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage your personal information and account settings
            </Typography>
          </Box>
          {!editing ? (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={handleEdit}
              size="large"
            >
              Edit Profile
            </Button>
          ) : (
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </Box>
          )}
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
            Profile updated successfully!
          </Alert>
        </motion.div>
      )}

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Paper sx={{ p: 4 }}>
              {/* Header with Avatar */}
              <Box display="flex" alignItems="center" mb={4}>
                <Box position="relative">
                  <Avatar
                    sx={{
                      width: 120,
                      height: 120,
                      bgcolor: 'primary.main',
                      fontSize: '3rem'
                    }}
                  >
                    {profileData.firstName[0]}{profileData.lastName[0]}
                  </Avatar>
                  {editing && (
                    <IconButton
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                      size="small"
                    >
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Box ml={3} flex={1}>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {profileData.firstName} {profileData.lastName}
                  </Typography>
                  <Box display="flex" gap={1} mb={2}>
                    <Chip
                      label={profileData.role}
                      color={getRoleColor(profileData.role)}
                      size="medium"
                    />
                    <Chip
                      label={profileData.department}
                      variant="outlined"
                      size="medium"
                    />
                  </Box>
                  <Typography variant="body1" color="textSecondary">
                    Member since {new Date(profileData.hireDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 4 }} />

              {/* Personal Information */}
              <Typography variant="h6" gutterBottom mb={3}>
                Personal Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={profileData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Emergency Contact"
                    value={profileData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    disabled={!editing}
                    variant={editing ? 'outlined' : 'standard'}
                  />
                </Grid>
              </Grid>

              {/* Security Settings */}
              <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                  Security
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Security />}
                  onClick={() => setPasswordDialogOpen(true)}
                  sx={{ mr: 2 }}
                >
                  Change Password
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Notifications />}
                >
                  Notification Settings
                </Button>
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Stats and Activity */}
        <Grid item xs={12} lg={4}>
          {/* Performance Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance Overview
              </Typography>
              <Grid container spacing={2}>
                {stats.map((stat, index) => (
                  <Grid item xs={12} key={stat.title}>
                    <Card
                      sx={{
                        background: `linear-gradient(135deg, ${
                          stat.color === 'primary' ? '#1976d2' :
                          stat.color === 'success' ? '#2e7d32' :
                          stat.color === 'info' ? '#0288d1' : '#ed6c02'
                        } 0%, ${
                          stat.color === 'primary' ? '#42a5f5' :
                          stat.color === 'success' ? '#66bb6a' :
                          stat.color === 'info' ? '#29b6f6' : '#ffb74d'
                        } 100%)`,
                        color: 'white',
                        mb: 1
                      }}
                    >
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {stat.value}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                              {stat.title}
                            </Typography>
                          </Box>
                          <Box sx={{ opacity: 0.8 }}>
                            {stat.icon}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {recentActivity.map((activity, index) => (
                  <Box key={activity.id}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CalendarToday color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.action}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {activity.details}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {new Date(activity.date).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm(prev => ({
                ...prev,
                currentPassword: e.target.value
              }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm(prev => ({
                ...prev,
                newPassword: e.target.value
              }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(prev => ({
                ...prev,
                confirmPassword: e.target.value
              }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordSubmit} variant="contained">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;