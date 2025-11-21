import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  IconButton,
  Paper,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Schedule,
  People,
  Analytics,
  TrendingUp,
  CalendarToday,
  Assignment,
  Notifications,
  ArrowForward,
  Warning,
  CheckCircle,
  AccessTime
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import api from '../services/api';

const DashboardPage = () => {
  console.log('🎯 DashboardPage: Component mounting');
  const { user } = useAuth();
  const navigate = useNavigate();

  console.log('🎯 DashboardPage: User from auth:', user);

  // Fetch analytics overview
  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError
  } = useApi(() => api.get('/api/analytics/overview'), []);

  // Fetch employees (for team size)
  const {
    data: employeesData,
    loading: employeesLoading
  } = useApi(() => api.get('/api/employees', { params: { page: 1, size: 10 } }), []);

  // Fetch notifications (for recent activities)
  const {
    data: notificationsData,
    loading: notificationsLoading
  } = useApi(() => api.get('/api/notifications', { params: { page: 1, size: 5, read: false } }), []);

  // Fetch schedules
  const {
    data: schedulesData,
    loading: schedulesLoading
  } = useApi(() => api.get('/api/schedules', { params: { page: 1, size: 10 } }), []);

  // Combine loading states
  const loading = analyticsLoading || employeesLoading || notificationsLoading || schedulesLoading;

  // Process analytics data with fallbacks
  const processedAnalytics = analyticsData?.data || {};
  const todaySchedules = processedAnalytics.todaySchedules || 0;
  const weeklyHours = processedAnalytics.weeklyHours || 0;
  const upcomingShifts = processedAnalytics.upcomingShifts || schedulesData?.data?.items?.length || 0;
  const teamSize = employeesData?.data?.total || 0;
  const pendingRequests = processedAnalytics.pendingRequests || 0;

  // Process notifications for recent activities
  const recentActivities = notificationsData?.data?.items?.map(notification => ({
    id: notification.id,
    type: notification.type || 'notification',
    message: notification.message || notification.title,
    time: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Recently',
    status: notification.priority === 'high' ? 'warning' : notification.priority === 'urgent' ? 'error' : 'info'
  })) || [];

  const quickActions = [
    {
      title: 'View Schedule',
      description: 'Check your upcoming shifts',
      icon: <Schedule />,
      path: '/schedule',
      color: 'primary'
    },
    {
      title: 'Team Overview',
      description: 'Manage your team',
      icon: <People />,
      path: '/employees',
      color: 'secondary',
      requiresRole: ['admin', 'manager']
    },
    {
      title: 'Analytics',
      description: 'View performance metrics',
      icon: <Analytics />,
      path: '/analytics',
      color: 'success',
      requiresRole: ['admin', 'manager']
    },
    {
      title: 'Settings',
      description: 'Configure preferences',
      icon: <Assignment />,
      path: '/settings',
      color: 'info'
    }
  ];

  const stats = [
    {
      title: 'Today\'s Schedules',
      value: todaySchedules,
      icon: <CalendarToday />,
      color: 'primary',
      change: processedAnalytics.todaySchedulesChange || 'No change'
    },
    {
      title: 'Weekly Hours',
      value: `${weeklyHours}h`,
      icon: <AccessTime />,
      color: 'success',
      change: `${Math.max(0, 40 - weeklyHours)}h remaining`
    },
    {
      title: 'Upcoming Shifts',
      value: upcomingShifts,
      icon: <Schedule />,
      color: 'warning',
      change: processedAnalytics.nextShift || 'No upcoming shifts'
    },
    {
      title: 'Pending Requests',
      value: pendingRequests,
      icon: <Assignment />,
      color: 'error',
      change: pendingRequests > 0 ? `${pendingRequests} awaiting approval` : 'All clear'
    }
  ];

  const getActivityIcon = (type, status) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <Notifications color="primary" />;
    }
  };

  const filteredQuickActions = quickActions.filter(action => {
    if (!action.requiresRole) return true;
    return action.requiresRole.includes(user?.role);
  });

  console.log('🎯 DashboardPage: About to render, user firstName:', user?.firstName);
  console.log('🎯 DashboardPage: Stats count:', stats.length);
  console.log('🎯 DashboardPage: Filtered quick actions count:', filteredQuickActions.length);

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {console.log('🎯 DashboardPage: Rendering main Box')}

      {/* Show error alert if analytics failed */}
      {analyticsError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Unable to load some dashboard data. Showing available information.
        </Alert>
      )}

      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {console.log('🎯 DashboardPage: Rendering welcome header')}
        <Box mb={4}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Welcome back, {user?.firstName || user?.first_name || 'User'}!
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Here's what's happening with your schedule today
          </Typography>
        </Box>
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {console.log('🎯 DashboardPage: Rendering stats grid')}
        <Grid container spacing={3} mb={4}>
          {stats.map((stat, index) => {
            console.log('🎯 DashboardPage: Rendering stat card:', stat.title);
            return (
              <Grid item xs={12} sm={6} lg={3} key={stat.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: `linear-gradient(135deg, ${stat.color === 'primary' ? '#1976d2' :
                      stat.color === 'success' ? '#2e7d32' :
                      stat.color === 'warning' ? '#ed6c02' : '#d32f2f'} 0%, ${
                      stat.color === 'primary' ? '#42a5f5' :
                      stat.color === 'success' ? '#66bb6a' :
                      stat.color === 'warning' ? '#ffb74d' : '#ef5350'} 100%)`,
                    color: 'white'
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                        {stat.icon}
                      </Avatar>
                      <Typography variant="h4" fontWeight="bold">
                        {stat.value}
                      </Typography>
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {stat.change}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </motion.div>

      <Grid container spacing={3}>
        {/* Quick Actions */}
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {console.log('🎯 DashboardPage: Rendering quick actions')}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                {filteredQuickActions.map((action, index) => (
                  <Grid item xs={12} sm={6} key={action.title}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4
                        }
                      }}
                      onClick={() => navigate(action.path)}
                    >
                      <CardContent>
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar sx={{ bgcolor: `${action.color}.main` }}>
                              {action.icon}
                            </Avatar>
                            <Box>
                              <Typography variant="h6">
                                {action.title}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {action.description}
                              </Typography>
                            </Box>
                          </Box>
                          <IconButton>
                            <ArrowForward />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </motion.div>

          {/* Weekly Progress */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {console.log('🎯 DashboardPage: Rendering weekly progress')}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Weekly Progress
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Hours Worked</Typography>
                  <Typography variant="body2">{weeklyHours}/40 hours</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(weeklyHours / 40) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                {weeklyHours >= 40
                  ? 'Weekly goal completed!'
                  : weeklyHours >= 30
                  ? 'You\'re on track to meet your weekly goals!'
                  : 'Keep going to reach your weekly target!'}
              </Typography>
            </Paper>
          </motion.div>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {console.log('🎯 DashboardPage: Rendering recent activities')}
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                Recent Activities
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {recentActivities.length > 0 ? (
                <>
                  <List>
                    {recentActivities.map((activity) => (
                      <ListItem key={activity.id} sx={{ px: 0 }}>
                        <ListItemIcon>
                          {getActivityIcon(activity.type, activity.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={activity.message}
                          secondary={activity.time}
                          primaryTypographyProps={{ fontSize: '0.9rem' }}
                          secondaryTypographyProps={{ fontSize: '0.8rem' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/notifications')}
                    sx={{ mt: 2 }}
                  >
                    View All Activities
                  </Button>
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="textSecondary">
                    No recent activities
                  </Typography>
                </Box>
              )}
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
      {console.log('🎯 DashboardPage: Render complete')}
    </Box>
  );
};

export default DashboardPage;
