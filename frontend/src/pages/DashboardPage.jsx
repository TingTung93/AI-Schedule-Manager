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
  Divider
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

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    todaySchedules: 3,
    weeklyHours: 32,
    upcomingShifts: 5,
    teamSize: 12,
    pendingRequests: 2,
    recentActivities: []
  });

  useEffect(() => {
    // Simulate loading dashboard data
    const loadDashboardData = () => {
      setDashboardData(prev => ({
        ...prev,
        recentActivities: [
          {
            id: 1,
            type: 'schedule',
            message: 'Your shift for tomorrow has been confirmed',
            time: '2 hours ago',
            status: 'info'
          },
          {
            id: 2,
            type: 'request',
            message: 'Time-off request approved for next week',
            time: '4 hours ago',
            status: 'success'
          },
          {
            id: 3,
            type: 'alert',
            message: 'Overtime threshold approaching this week',
            time: '1 day ago',
            status: 'warning'
          }
        ]
      }));
    };

    loadDashboardData();
  }, []);

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
      value: dashboardData.todaySchedules,
      icon: <CalendarToday />,
      color: 'primary',
      change: '+2 from yesterday'
    },
    {
      title: 'Weekly Hours',
      value: `${dashboardData.weeklyHours}h`,
      icon: <AccessTime />,
      color: 'success',
      change: '8h remaining'
    },
    {
      title: 'Upcoming Shifts',
      value: dashboardData.upcomingShifts,
      icon: <Schedule />,
      color: 'warning',
      change: 'Next: Tomorrow 9 AM'
    },
    {
      title: 'Pending Requests',
      value: dashboardData.pendingRequests,
      icon: <Assignment />,
      color: 'error',
      change: '1 awaiting approval'
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box mb={4}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Welcome back, {user?.firstName || 'User'}!
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
        <Grid container spacing={3} mb={4}>
          {stats.map((stat, index) => (
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
          ))}
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
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Weekly Progress
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Hours Worked</Typography>
                  <Typography variant="body2">{dashboardData.weeklyHours}/40 hours</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(dashboardData.weeklyHours / 40) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                You're on track to meet your weekly goals!
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
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                Recent Activities
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                {dashboardData.recentActivities.map((activity, index) => (
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
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;