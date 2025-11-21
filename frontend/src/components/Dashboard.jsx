import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Alert,
  Badge,
  Divider,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Notifications as NotificationsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  AttachMoney as MoneyIcon,
  AccessTime as TimeIcon,
  Assignment as AssignmentIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
} from 'chart.js';
import { format, startOfWeek, addDays, parseISO, isToday, isFuture } from 'date-fns';
import apiClient from '../services/api';
import { useApi, useRealTimeApi } from '../hooks/useApi';
import { useNavigate } from 'react-router-dom';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7d');
  const [notification, setNotification] = useState(null);

  // API hooks for dashboard data
  const { data: analyticsData, loading: loadingAnalytics, refetch: refetchAnalytics } = useApi(
    () => apiClient.get('/api/analytics/overview'),
    [],
    {
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load analytics data' });
      }
    }
  );

  const { data: schedulesData, loading: loadingSchedules } = useApi(
    () => apiClient.get('/api/schedules'),
    [],
    {
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load schedules' });
      }
    }
  );

  const { data: employeesData, loading: loadingEmployees } = useApi(
    () => apiClient.get('/api/employees'),
    [],
    {
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load employees' });
      }
    }
  );

  const { data: notificationsData, loading: loadingNotifications } = useRealTimeApi(
    () => apiClient.get('/api/notifications'),
    30000, // Poll every 30 seconds
    {
      onError: (error) => {
        console.error('Failed to load notifications:', error);
      }
    }
  );

  const { data: laborCostData } = useApi(
    () => analyticsService.getLaborCosts(timeRange),
    [timeRange],
    {
      onError: (error) => {
        console.error('Failed to load labor costs:', error);
      }
    }
  );

  // Process data
  const analytics = analyticsData || {};
  const schedules = schedulesData?.schedules || [];
  const employees = employeesData?.employees || [];
  const notifications = notificationsData?.notifications || [];

  // Recent schedules (last 5)
  const recentSchedules = useMemo(() => {
    return schedules
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [schedules]);

  // Unread notifications
  const unreadNotifications = useMemo(() => {
    return notifications.filter(notif => !notif.read);
  }, [notifications]);

  // Today's shifts
  const todaysShifts = useMemo(() => {
    const today = new Date();
    const todaySchedules = schedules.filter(schedule => {
      const scheduleStart = parseISO(schedule.startDate);
      const scheduleEnd = parseISO(schedule.endDate);
      return today >= scheduleStart && today <= scheduleEnd;
    });

    const shifts = [];
    todaySchedules.forEach(schedule => {
      if (schedule.shifts) {
        const dayShifts = schedule.shifts.filter(shift =>
          isToday(parseISO(shift.startTime))
        );
        shifts.push(...dayShifts);
      }
    });

    return shifts.sort((a, b) => parseISO(a.startTime) - parseISO(b.startTime));
  }, [schedules]);

  // Upcoming shifts (next 7 days)
  const upcomingShifts = useMemo(() => {
    const upcoming = [];
    schedules.forEach(schedule => {
      if (schedule.shifts) {
        const futureShifts = schedule.shifts.filter(shift =>
          isFuture(parseISO(shift.startTime))
        );
        upcoming.push(...futureShifts);
      }
    });

    return upcoming
      .sort((a, b) => parseISO(a.startTime) - parseISO(b.startTime))
      .slice(0, 10);
  }, [schedules]);

  // Employee metrics
  const employeeMetrics = useMemo(() => {
    const active = employees.filter(emp => emp.isActive).length;
    const inactive = employees.length - active;

    const roleDistribution = employees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {});

    return {
      total: employees.length,
      active,
      inactive,
      roleDistribution,
    };
  }, [employees]);

  // Chart data for role distribution
  const roleChartData = {
    labels: Object.keys(employeeMetrics.roleDistribution),
    datasets: [{
      data: Object.values(employeeMetrics.roleDistribution),
      backgroundColor: [
        '#1976d2',
        '#7b1fa2',
        '#388e3c',
        '#f57c00',
        '#00796b',
        '#5d4037',
      ],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  // Labor cost chart data
  const costChartData = useMemo(() => {
    if (!laborCostData?.data) return null;

    return {
      labels: laborCostData.data.map(item => format(parseISO(item.date), 'MMM d')),
      datasets: [{
        label: 'Daily Labor Cost',
        data: laborCostData.data.map(item => item.cost),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        fill: true,
        tension: 0.4,
      }],
    };
  }, [laborCostData]);

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString();
          },
        },
      },
    },
  };

  // Event handlers
  const handleQuickAction = (action) => {
    switch (action) {
      case 'add-employee':
        navigate('/employees?action=add');
        break;
      case 'generate-schedule':
        navigate('/schedules?action=generate');
        break;
      case 'view-employees':
        navigate('/employees');
        break;
      case 'view-schedules':
        navigate('/schedules');
        break;
      default:
        break;
    }
  };

  const refreshDashboard = () => {
    refetchAnalytics();
  };

  const getShiftStatusColor = (shift) => {
    const now = new Date();
    const startTime = parseISO(shift.startTime);
    const endTime = parseISO(shift.endTime);

    if (now < startTime) return 'info'; // Upcoming
    if (now >= startTime && now <= endTime) return 'success'; // In progress
    return 'default'; // Completed
  };

  const getShiftStatusText = (shift) => {
    const now = new Date();
    const startTime = parseISO(shift.startTime);
    const endTime = parseISO(shift.endTime);

    if (now < startTime) return 'Upcoming';
    if (now >= startTime && now <= endTime) return 'In Progress';
    return 'Completed';
  };

  const loading = loadingAnalytics || loadingSchedules || loadingEmployees;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={refreshDashboard}
          disabled={loading}
          aria-label="Refresh dashboard data"
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Metrics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" color="primary">
                    {loading ? '...' : employeeMetrics.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Employees
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {employeeMetrics.active} active
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                  <ScheduleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" color="secondary">
                    {loading ? '...' : schedules.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Schedules Created
                  </Typography>
                  <Typography variant="caption" color="info.main">
                    {recentSchedules.length} recent
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <TimeIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4" color="success.main">
                    {loading ? '...' : todaysShifts.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Today's Shifts
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    {upcomingShifts.length} upcoming
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Badge badgeContent={unreadNotifications.length} color="error">
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <NotificationsIcon />
                  </Avatar>
                </Badge>
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {loading ? '...' : notifications.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notifications
                  </Typography>
                  <Typography variant="caption" color="error.main">
                    {unreadNotifications.length} unread
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleQuickAction('add-employee')}
                    sx={{ height: 56 }}
                    aria-label="Add new employee"
                  >
                    Add Employee
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ScheduleIcon />}
                    onClick={() => handleQuickAction('generate-schedule')}
                    sx={{ height: 56 }}
                    aria-label="Generate new schedule"
                  >
                    Generate Schedule
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleQuickAction('view-employees')}
                    sx={{ height: 56 }}
                    aria-label="View all employees"
                  >
                    View Employees
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AssignmentIcon />}
                    onClick={() => handleQuickAction('view-schedules')}
                    sx={{ height: 56 }}
                    aria-label="View all schedules"
                  >
                    View Schedules
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Charts Row */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Employee Distribution by Role
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box height={300}>
                  <Doughnut data={roleChartData} options={chartOptions} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Labor Costs (Last 7 Days)
              </Typography>
              {loading || !costChartData ? (
                <Box display="flex" justifyContent="center" alignItems="center" height={300}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box height={300}>
                  <Line data={costChartData} options={lineChartOptions} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Schedules */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Schedules
              </Typography>
              <List>
                {loading ? (
                  <ListItem>
                    <CircularProgress size={24} />
                  </ListItem>
                ) : recentSchedules.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No schedules found" />
                  </ListItem>
                ) : (
                  recentSchedules.map((schedule) => (
                    <ListItem key={schedule.id} divider>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <ScheduleIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={schedule.name || `Week of ${format(parseISO(schedule.startDate), 'MMM d')}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {format(parseISO(schedule.startDate), 'MMM d')} - {format(parseISO(schedule.endDate), 'MMM d, yyyy')}
                            </Typography>
                            <Typography variant="caption">
                              {schedule.shifts?.length || 0} shifts
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={schedule.status || 'Active'}
                        color={schedule.status === 'published' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Notifications
              </Typography>
              <List>
                {loadingNotifications ? (
                  <ListItem>
                    <CircularProgress size={24} />
                  </ListItem>
                ) : notifications.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No notifications" />
                  </ListItem>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <ListItem key={notification.id} divider>
                      <ListItemAvatar>
                        <Avatar sx={{
                          bgcolor: notification.type === 'warning' ? 'warning.main' :
                                   notification.type === 'error' ? 'error.main' : 'info.main'
                        }}>
                          {notification.type === 'warning' ? <WarningIcon /> :
                           notification.type === 'error' ? <WarningIcon /> : <NotificationsIcon />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={notification.title || notification.message}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {notification.description}
                            </Typography>
                            <Typography variant="caption">
                              {format(parseISO(notification.createdAt), 'MMM d, h:mm a')}
                            </Typography>
                          </Box>
                        }
                      />
                      {!notification.read && (
                        <Badge color="error" variant="dot" />
                      )}
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Today's Shifts */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today's Schedule
              </Typography>
              {loading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress />
                </Box>
              ) : todaysShifts.length === 0 ? (
                <Alert severity="info">
                  No shifts scheduled for today
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {todaysShifts.map((shift) => {
                    const employee = employees.find(emp => emp.id === shift.employeeId);
                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={shift.id}>
                        <Paper sx={{ p: 2, height: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar sx={{ mr: 1, width: 32, height: 32 }}>
                              {employee?.firstName?.charAt(0) || '?'}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">
                                {employee?.firstName} {employee?.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employee?.role}
                              </Typography>
                            </Box>
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {format(parseISO(shift.startTime), 'h:mm a')} -
                            {format(parseISO(shift.endTime), 'h:mm a')}
                          </Typography>
                          <Chip
                            label={getShiftStatusText(shift)}
                            color={getShiftStatusColor(shift)}
                            size="small"
                          />
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;