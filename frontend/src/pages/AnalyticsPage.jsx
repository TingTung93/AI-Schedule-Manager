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
  Chip,
  CircularProgress,
  Alert
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
import api, { getErrorMessage } from '../services/api';

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
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState({
    totalHours: 0,
    averageHours: 0,
    efficiency: 0,
    overtimeHours: 0
  });
  const [laborCosts, setLaborCosts] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, costsRes] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/labor-costs', { params: { timeRange } })
      ]);

      setOverview(overviewRes.data);
      setLaborCosts(costsRes.data.data || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Hours',
      value: overview.totalHours || 0,
      icon: <Schedule fontSize="large" />,
      color: 'primary',
      trend: '+12%'
    },
    {
      title: 'Active Employees',
      value: overview.totalEmployees || 0,
      icon: <People fontSize="large" />,
      color: 'success',
      trend: '+5%'
    },
    {
      title: 'Efficiency Rate',
      value: `${(overview.efficiency || 0).toFixed(1)}%`,
      icon: <TrendingUp fontSize="large" />,
      color: 'info',
      trend: '+8%'
    },
    {
      title: 'Overtime Hours',
      value: overview.overtimeHours || 0,
      icon: <AccessTime fontSize="large" />,
      color: 'warning',
      trend: '-3%'
    }
  ];

  // Generate chart data from API response
  const hoursWorkedData = {
    labels: laborCosts.slice(0, 7).map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }),
    datasets: [
      {
        label: 'Labor Costs',
        data: laborCosts.slice(0, 7).map(d => d.cost / 100),
        backgroundColor: 'rgba(25, 118, 210, 0.8)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 2,
        borderRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
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
              Analytics & Insights
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Track performance metrics and trends
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </motion.div>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={3} mb={4}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} lg={3} key={stat.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
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
                  height: '100%'
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {stat.title}
                    </Typography>
                    <Box sx={{ opacity: 0.9 }}>
                      {stat.icon}
                    </Box>
                  </Box>
                  <Typography variant="h3" fontWeight="bold" gutterBottom>
                    {stat.value}
                  </Typography>
                  <Chip
                    label={stat.trend}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                Labor Costs Trend
              </Typography>
              <Box sx={{ height: 320 }}>
                <Bar data={hoursWorkedData} options={chartOptions} />
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} lg={4}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                Efficiency Distribution
              </Typography>
              <Box sx={{ height: 320, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Doughnut
                  data={{
                    labels: ['Productive', 'Idle', 'Overtime'],
                    datasets: [{
                      data: [overview.efficiency || 70, 15, 15],
                      backgroundColor: [
                        'rgba(46, 125, 50, 0.8)',
                        'rgba(237, 108, 2, 0.8)',
                        'rgba(211, 47, 47, 0.8)'
                      ],
                      borderWidth: 2
                    }]
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </Box>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
