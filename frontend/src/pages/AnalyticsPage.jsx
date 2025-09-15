import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp,
  Schedule,
  People,
  AccessTime
} from '@mui/icons-material';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AnalyticsPage = () => {
  const [timeRange, setTimeRange] = useState('7days');
  const [analytics, setAnalytics] = useState({
    totalHours: 0,
    averageHours: 0,
    efficiency: 0,
    overtimeHours: 0
  });

  useEffect(() => {
    // Simulate loading analytics data
    setAnalytics({
      totalHours: 320,
      averageHours: 40,
      efficiency: 85,
      overtimeHours: 24
    });
  }, [timeRange]);

  const hoursWorkedData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Hours Worked',
        data: [8, 7.5, 8, 8.5, 9, 6, 4],
        backgroundColor: 'rgba(25, 118, 210, 0.8)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        label: 'Scheduled Hours',
        data: [8, 8, 8, 8, 8, 8, 8],
        backgroundColor: 'rgba(46, 125, 50, 0.8)',
        borderColor: 'rgba(46, 125, 50, 1)',
        borderWidth: 2,
        borderRadius: 4
      }
    ]
  };

  const efficiencyTrendData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Efficiency %',
        data: [82, 85, 88, 85],
        borderColor: 'rgba(237, 108, 2, 1)',
        backgroundColor: 'rgba(237, 108, 2, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const departmentDistributionData = {
    labels: ['Operations', 'Customer Service', 'Sales', 'Management'],
    datasets: [
      {
        data: [45, 30, 20, 5],
        backgroundColor: [
          'rgba(25, 118, 210, 0.8)',
          'rgba(46, 125, 50, 0.8)',
          'rgba(237, 108, 2, 0.8)',
          'rgba(211, 47, 47, 0.8)'
        ],
        borderColor: [
          'rgba(25, 118, 210, 1)',
          'rgba(46, 125, 50, 1)',
          'rgba(237, 108, 2, 1)',
          'rgba(211, 47, 47, 1)'
        ],
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const stats = [
    {
      title: 'Total Hours',
      value: `${analytics.totalHours}h`,
      icon: <AccessTime />,
      color: 'primary',
      change: '+12% vs last period'
    },
    {
      title: 'Average Hours/Week',
      value: `${analytics.averageHours}h`,
      icon: <Schedule />,
      color: 'success',
      change: 'On target'
    },
    {
      title: 'Team Efficiency',
      value: `${analytics.efficiency}%`,
      icon: <TrendingUp />,
      color: 'warning',
      change: '+3% improvement'
    },
    {
      title: 'Overtime Hours',
      value: `${analytics.overtimeHours}h`,
      icon: <People />,
      color: 'error',
      change: '-5% reduction'
    }
  ];

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
              Analytics Dashboard
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Monitor team performance and scheduling efficiency
            </Typography>
          </Box>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
              <MenuItem value="90days">Last 90 Days</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
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
                  background: `linear-gradient(135deg, ${
                    stat.color === 'primary' ? '#1976d2' :
                    stat.color === 'success' ? '#2e7d32' :
                    stat.color === 'warning' ? '#ed6c02' : '#d32f2f'
                  } 0%, ${
                    stat.color === 'primary' ? '#42a5f5' :
                    stat.color === 'success' ? '#66bb6a' :
                    stat.color === 'warning' ? '#ffb74d' : '#ef5350'
                  } 100%)`,
                  color: 'white'
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Box sx={{ opacity: 0.8 }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="h4" fontWeight="bold">
                      {stat.value}
                    </Typography>
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {stat.title}
                  </Typography>
                  <Chip
                    label={stat.change}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Hours Worked Chart */}
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Hours Worked vs Scheduled
              </Typography>
              <Box sx={{ height: 400 }}>
                <Bar data={hoursWorkedData} options={chartOptions} />
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Department Distribution */}
        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Department Distribution
              </Typography>
              <Box sx={{ height: 400 }}>
                <Doughnut data={departmentDistributionData} options={doughnutOptions} />
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        {/* Efficiency Trend */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Efficiency Trend
              </Typography>
              <Box sx={{ height: 300 }}>
                <Line data={efficiencyTrendData} options={lineChartOptions} />
              </Box>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;