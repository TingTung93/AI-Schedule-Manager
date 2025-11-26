/**
 * RoleHistoryDialog Component
 *
 * Displays audit trail of all role changes for an employee with:
 * - Chronological table of all role modifications
 * - Date range filtering
 * - Statistics (total changes, roles held, average duration)
 * - Export to CSV functionality
 *
 * @module components/RoleHistoryDialog
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
  CalendarToday as CalendarIcon,
  AdminPanelSettings as AdminIcon,
  ManageAccounts as ManagerIcon,
  Person as EmployeeIcon,
  Schedule as SchedulerIcon,
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

/**
 * Get role icon based on role type
 */
const getRoleIcon = (role) => {
  const roleIcons = {
    admin: <AdminIcon fontSize="small" />,
    manager: <ManagerIcon fontSize="small" />,
    employee: <EmployeeIcon fontSize="small" />,
    scheduler: <SchedulerIcon fontSize="small" />,
  };
  return roleIcons[role?.toLowerCase()] || <EmployeeIcon fontSize="small" />;
};

/**
 * Get role color based on role type
 */
const getRoleColor = (role) => {
  const roleColors = {
    admin: 'error',
    manager: 'warning',
    employee: 'default',
    scheduler: 'info',
  };
  return roleColors[role?.toLowerCase()] || 'default';
};

/**
 * Calculate statistics from role history
 */
const calculateStatistics = (history) => {
  if (!history || history.length === 0) {
    return {
      totalChanges: 0,
      uniqueRoles: 0,
      averageDuration: 0,
      earliestDate: null,
      latestDate: null,
    };
  }

  // Total changes
  const totalChanges = history.length;

  // Unique roles
  const roleSet = new Set();
  history.forEach(record => {
    if (record.old_role) roleSet.add(record.old_role);
    if (record.new_role) roleSet.add(record.new_role);
  });
  const uniqueRoles = roleSet.size;

  // Calculate average duration between role changes
  let totalDuration = 0;
  let durationCount = 0;

  for (let i = 0; i < history.length - 1; i++) {
    const currentDate = new Date(history[i].changed_at);
    const nextDate = new Date(history[i + 1].changed_at);
    const durationDays = Math.abs((nextDate - currentDate) / (1000 * 60 * 60 * 24));
    totalDuration += durationDays;
    durationCount++;
  }

  // If only one record, calculate from that date to now
  if (history.length === 1) {
    const firstDate = new Date(history[0].changed_at);
    const now = new Date();
    totalDuration = Math.abs((now - firstDate) / (1000 * 60 * 60 * 24));
    durationCount = 1;
  }

  const averageDuration = durationCount > 0
    ? Math.round(totalDuration / durationCount)
    : 0;

  // Date range
  const dates = history.map(r => new Date(r.changed_at));
  const earliestDate = new Date(Math.min(...dates));
  const latestDate = new Date(Math.max(...dates));

  return {
    totalChanges,
    uniqueRoles,
    averageDuration,
    earliestDate,
    latestDate,
  };
};

/**
 * Export history to CSV
 */
const exportToCSV = (history, employeeName) => {
  if (!history || history.length === 0) return;

  // CSV headers
  const headers = ['Date', 'Old Role', 'New Role', 'Changed By', 'Reason'];

  // CSV rows
  const rows = history.map(record => [
    new Date(record.changed_at).toLocaleString(),
    record.old_role || 'None',
    record.new_role || 'None',
    record.changed_by_name || 'System',
    record.reason || 'N/A',
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${employeeName}_role_history_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Main RoleHistoryDialog component
 */
const RoleHistoryDialog = ({ open, onClose, employeeId, employeeName }) => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  /**
   * Load role history when dialog opens
   */
  useEffect(() => {
    if (open && employeeId) {
      loadHistory();
    } else {
      // Reset state when closing
      setHistory([]);
      setFilteredHistory([]);
      setError(null);
      setDateRange({ startDate: '', endDate: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId]);

  /**
   * Apply date range filter
   */
  useEffect(() => {
    if (!history.length) {
      setFilteredHistory([]);
      return;
    }

    let filtered = [...history];

    // Apply start date filter
    if (dateRange.startDate) {
      const startDate = new Date(dateRange.startDate);
      filtered = filtered.filter(record =>
        new Date(record.changed_at) >= startDate
      );
    }

    // Apply end date filter
    if (dateRange.endDate) {
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(record =>
        new Date(record.changed_at) <= endDate
      );
    }

    setFilteredHistory(filtered);
  }, [history, dateRange]);

  /**
   * Load role history from API
   */
  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/employees/${employeeId}/role-history`);

      // Sort by date descending (newest first)
      const sortedHistory = (response.data || []).sort((a, b) =>
        new Date(b.changed_at) - new Date(a.changed_at)
      );

      setHistory(sortedHistory);
      setFilteredHistory(sortedHistory);
    } catch (err) {
      console.error('[RoleHistoryDialog] Error loading role history:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Calculate statistics from filtered history
   */
  const statistics = useMemo(() =>
    calculateStatistics(filteredHistory),
    [filteredHistory]
  );

  /**
   * Handle date range change
   */
  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Clear date filters
   */
  const clearFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
  };

  /**
   * Handle export to CSV
   */
  const handleExport = () => {
    exportToCSV(filteredHistory, employeeName || `Employee_${employeeId}`);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <AssessmentIcon color="primary" />
            <Typography variant="h6">
              Role History - {employeeName}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box>
            {/* Statistics Section */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <AssessmentIcon fontSize="small" />
                Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Changes
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {statistics.totalChanges}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Roles Held
                      </Typography>
                      <Typography variant="h4" color="secondary">
                        {statistics.uniqueRoles}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Avg Duration (days)
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {statistics.averageDuration}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Date Range
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {statistics.earliestDate
                          ? `${statistics.earliestDate.toLocaleDateString()} - ${statistics.latestDate.toLocaleDateString()}`
                          : 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Date Range Filter */}
            <Box mb={3}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                <CalendarIcon fontSize="small" />
                Date Range Filter
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    size="small"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    size="small"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    onClick={clearFilters}
                    disabled={!dateRange.startDate && !dateRange.endDate}
                    variant="outlined"
                    size="small"
                    fullWidth
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {/* History Table */}
            {filteredHistory.length === 0 ? (
              <Alert severity="info">
                {history.length === 0
                  ? 'No role change history found for this employee.'
                  : 'No records found in the selected date range.'}
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell><strong>Date & Time</strong></TableCell>
                      <TableCell><strong>Old Role</strong></TableCell>
                      <TableCell><strong>New Role</strong></TableCell>
                      <TableCell><strong>Changed By</strong></TableCell>
                      <TableCell><strong>Reason</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredHistory.map((record, index) => (
                      <TableRow
                        key={record.id || index}
                        hover
                        sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(record.changed_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {record.old_role ? (
                            <Chip
                              label={record.old_role.charAt(0).toUpperCase() + record.old_role.slice(1)}
                              size="small"
                              icon={getRoleIcon(record.old_role)}
                              color={getRoleColor(record.old_role)}
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              None
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.new_role ? (
                            <Chip
                              label={record.new_role.charAt(0).toUpperCase() + record.new_role.slice(1)}
                              size="small"
                              icon={getRoleIcon(record.new_role)}
                              color={getRoleColor(record.new_role)}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              None
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {record.changed_by_name || 'System'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                            {record.reason || 'No reason provided'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Box display="flex" justifyContent="space-between" width="100%" px={2}>
          <Tooltip title="Export filtered history to CSV">
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={loading || filteredHistory.length === 0}
              variant="outlined"
            >
              Export CSV
            </Button>
          </Tooltip>
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default RoleHistoryDialog;
