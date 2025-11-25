import React, { useState, useEffect } from 'react';
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
  Chip,
  CircularProgress,
  Alert,
  Box,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';

/**
 * AccountStatusHistoryDialog Component
 *
 * Displays audit trail of all account status changes for an employee
 * with date range filtering and CSV export functionality.
 *
 * Features:
 * - Status change history table (Date, Old Status, New Status, Changed By, Reason)
 * - Date range filtering
 * - Loading and error states
 * - CSV export functionality
 * - Color-coded status chips
 */
const AccountStatusHistoryDialog = ({ open, onClose, employeeId, employeeName }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load history when dialog opens or employeeId changes
  useEffect(() => {
    if (open && employeeId) {
      loadHistory();
    }
  }, [open, employeeId]);

  /**
   * Load status change history from API
   */
  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query params for date filtering
      const params = {};
      if (dateRange.startDate) {
        params.startDate = dateRange.startDate;
      }
      if (dateRange.endDate) {
        params.endDate = dateRange.endDate;
      }

      const response = await api.get(`/api/employees/${employeeId}/status-history`, { params });
      setHistory(response.data || []);
    } catch (err) {
      console.error('[AccountStatusHistoryDialog] Error loading history:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get color-coded chip for status display
   * @param {string} status - Status value (active, inactive, locked, verified)
   * @returns {JSX.Element} Chip component with appropriate color
   */
  const getStatusChip = (status) => {
    if (!status) {
      return <Chip label="Unknown" size="small" />;
    }

    const statusConfig = {
      active: { color: 'success', label: 'Active' },
      inactive: { color: 'default', label: 'Inactive' },
      locked: { color: 'error', label: 'Locked' },
      verified: { color: 'info', label: 'Verified' },
      pending: { color: 'warning', label: 'Pending' },
      suspended: { color: 'error', label: 'Suspended' }
    };

    const config = statusConfig[status.toLowerCase()] || {
      color: 'default',
      label: status.charAt(0).toUpperCase() + status.slice(1)
    };

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
      />
    );
  };

  /**
   * Format date for display
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date and time
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Export history to CSV file
   */
  const exportToCSV = () => {
    if (!history || history.length === 0) {
      return;
    }

    // Define CSV headers
    const headers = ['Date', 'Old Status', 'New Status', 'Changed By', 'Reason', 'IP Address'];

    // Convert history data to CSV rows
    const rows = history.map(record => [
      formatDate(record.changedAt || record.changed_at),
      record.oldStatus || record.old_status || 'N/A',
      record.newStatus || record.new_status || 'N/A',
      record.changedBy || record.changed_by || 'System',
      record.reason || 'No reason provided',
      record.ipAddress || record.ip_address || 'N/A'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `status-history-${employeeName || employeeId}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Apply date range filters
   */
  const handleApplyFilters = () => {
    loadHistory();
  };

  /**
   * Clear date range filters
   */
  const handleClearFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setTimeout(() => loadHistory(), 100);
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    setDateRange({ startDate: '', endDate: '' });
    setShowFilters(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Account Status History {employeeName && `- ${employeeName}`}
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Toggle Filters">
              <IconButton
                size="small"
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? 'primary' : 'default'}
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export to CSV">
              <IconButton
                size="small"
                onClick={exportToCSV}
                disabled={!history || history.length === 0}
                color="primary"
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Date Range Filters */}
        {showFilters && (
          <Box mb={3} p={2} bgcolor="grey.50" borderRadius={1}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  size="small"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
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
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box display="flex" gap={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleApplyFilters}
                    fullWidth
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleClearFilters}
                    fullWidth
                  >
                    Clear
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Loading State */}
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Empty State */}
        {!loading && !error && history.length === 0 && (
          <Alert severity="info">
            No status change history found for this employee.
          </Alert>
        )}

        {/* History Table */}
        {!loading && !error && history.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><strong>Date & Time</strong></TableCell>
                  <TableCell><strong>Old Status</strong></TableCell>
                  <TableCell><strong>New Status</strong></TableCell>
                  <TableCell><strong>Changed By</strong></TableCell>
                  <TableCell><strong>Reason</strong></TableCell>
                  <TableCell><strong>IP Address</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((record, index) => (
                  <TableRow
                    key={record.id || index}
                    sx={{
                      '&:hover': { bgcolor: 'grey.50' },
                      '&:nth-of-type(even)': { bgcolor: 'grey.25' }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(record.changedAt || record.changed_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(record.oldStatus || record.old_status)}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(record.newStatus || record.new_status)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {record.changedBy || record.changed_by || 'System'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300 }}>
                        {record.reason || 'No reason provided'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {record.ipAddress || record.ip_address || 'N/A'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Record Count */}
        {!loading && history.length > 0 && (
          <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Showing {history.length} record{history.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccountStatusHistoryDialog;
