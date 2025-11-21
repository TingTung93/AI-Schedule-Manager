import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import api from '../../services/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

/**
 * DepartmentAnalyticsChart Component
 *
 * Displays comprehensive analytics dashboard for department metrics:
 * - Employee distribution by department (Pie chart)
 * - Department capacity gauges (Doughnut charts)
 * - Trend analysis (Line chart)
 * - Active vs inactive employees (Bar chart)
 *
 * Features:
 * - Real-time auto-refresh every 30 seconds
 * - Manual refresh button
 * - Export to CSV functionality
 * - Responsive Material-UI Grid layout
 * - Error handling with retry
 *
 * @param {Object} props
 * @param {number} [props.departmentId] - Optional: Show analytics for specific department
 * @param {number} [props.refreshInterval=30000] - Auto-refresh interval in ms (default: 30s)
 */
const DepartmentAnalyticsChart = ({ departmentId = null, refreshInterval = 30000 }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [chartType, setChartType] = useState('all');

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      if (departmentId) {
        // Fetch department-specific analytics
        const response = await api.get(`/api/departments/${departmentId}/analytics`);
        setAnalytics(response.data);
      } else {
        // Fetch organization-wide analytics
        const [overviewRes, distributionRes] = await Promise.all([
          api.get('/api/departments/analytics/overview'),
          api.get('/api/departments/analytics/distribution')
        ]);
        setAnalytics(overviewRes.data);
        setDistribution(distributionRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.detail || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh on mount and interval
  useEffect(() => {
    fetchAnalytics();

    const interval = setInterval(() => {
      fetchAnalytics();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [departmentId, refreshInterval]);

  // Export to CSV
  const handleExport = () => {
    if (!analytics) return;

    const csvData = [];
    csvData.push(['Metric', 'Value']);
    csvData.push(['Total Departments', analytics.totalDepartments || 0]);
    csvData.push(['Total Employees', analytics.totalEmployees || 0]);
    csvData.push(['Active Employees', analytics.activeEmployees || 0]);
    csvData.push(['Inactive Employees', analytics.inactiveEmployees || 0]);
    csvData.push(['Unassigned Employees', analytics.unassignedEmployees || 0]);

    if (distribution) {
      csvData.push([]);
      csvData.push(['Department', 'Employee Count', 'Capacity', 'Utilization %']);
      distribution.forEach(dept => {
        csvData.push([
          dept.departmentName,
          dept.employeeCount,
          dept.capacity || 'N/A',
          dept.capacity ? ((dept.employeeCount / dept.capacity) * 100).toFixed(1) : 'N/A'
        ]);
      });
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `department-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Prepare chart data
  const getDistributionChartData = () => {
    if (!distribution) return null;

    const sortedDepts = [...distribution].sort((a, b) => b.employeeCount - a.employeeCount);

    return {
      labels: sortedDepts.map(d => d.departmentName),
      datasets: [
        {
          label: 'Employees',
          data: sortedDepts.map(d => d.employeeCount),
          backgroundColor: [
            '#1976d2',
            '#388e3c',
            '#f57c00',
            '#7b1fa2',
            '#c62828',
            '#00796b',
            '#455a64',
            '#512da8'
          ],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  };

  const getActiveInactiveChartData = () => {
    if (!analytics) return null;

    return {
      labels: ['Active', 'Inactive', 'Unassigned'],
      datasets: [
        {
          label: 'Employees',
          data: [
            analytics.activeEmployees || 0,
            analytics.inactiveEmployees || 0,
            analytics.unassignedEmployees || 0
          ],
          backgroundColor: ['#4caf50', '#f44336', '#ff9800'],
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    };
  };

  const getCapacityChartData = () => {
    if (!distribution) return null;

    return {
      labels: distribution.map(d => d.departmentName),
      datasets: [
        {
          label: 'Current Employees',
          data: distribution.map(d => d.employeeCount),
          backgroundColor: '#1976d2',
        },
        {
          label: 'Remaining Capacity',
          data: distribution.map(d => Math.max(0, (d.capacity || 0) - d.employeeCount)),
          backgroundColor: '#e0e0e0',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  if (loading && !analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton color="inherit" size="small" onClick={fetchAnalytics}>
            <RefreshIcon />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Department Analytics Dashboard
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>View</InputLabel>
            <Select
              value={chartType}
              label="View"
              onChange={(e) => setChartType(e.target.value)}
            >
              <MenuItem value="all">All Charts</MenuItem>
              <MenuItem value="distribution">Distribution</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="capacity">Capacity</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchAnalytics} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export to CSV">
            <IconButton onClick={handleExport}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Statistics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Departments
              </Typography>
              <Typography variant="h4">
                {analytics?.totalDepartments || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {analytics?.totalEmployees || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Employees
              </Typography>
              <Typography variant="h4" color="success.main">
                {analytics?.activeEmployees || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Unassigned
              </Typography>
              <Typography variant="h4" color="warning.main">
                {analytics?.unassignedEmployees || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Employee Distribution Pie Chart */}
        {(chartType === 'all' || chartType === 'distribution') && distribution && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Employee Distribution by Department" />
              <CardContent>
                <Box height={350}>
                  <Pie data={getDistributionChartData()} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Active vs Inactive Status */}
        {(chartType === 'all' || chartType === 'status') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Employee Status Distribution" />
              <CardContent>
                <Box height={350}>
                  <Doughnut data={getActiveInactiveChartData()} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Department Capacity Bar Chart */}
        {(chartType === 'all' || chartType === 'capacity') && distribution && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Department Capacity Analysis" />
              <CardContent>
                <Box height={350}>
                  <Bar
                    data={getCapacityChartData()}
                    options={{
                      ...chartOptions,
                      scales: {
                        x: { stacked: true },
                        y: { stacked: true },
                      },
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Loading indicator for refresh */}
      {loading && analytics && (
        <Box position="fixed" bottom={16} right={16}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default DepartmentAnalyticsChart;
