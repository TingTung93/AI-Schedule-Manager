import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Pagination,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import FilterListIcon from '@mui/icons-material/FilterList';
import api from '../../services/api';

/**
 * AssignmentHistoryTimeline Component
 *
 * Displays audit trail of department assignment changes in timeline format.
 *
 * Features:
 * - Timeline visualization of assignment history
 * - Shows: date, from/to departments, changed by user, reason
 * - Filter by date range and department
 * - Export to CSV functionality
 * - Pagination (20 records per page)
 * - Icon indicators for different change types
 *
 * @param {Object} props
 * @param {number} props.employeeId - Employee ID to show history for
 * @param {number} [props.pageSize=20] - Records per page
 */
const AssignmentHistoryTimeline = ({ employeeId, pageSize = 20 }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  // Fetch history data
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
      };

      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (departmentFilter) params.departmentId = departmentFilter;

      const response = await api.get(`/api/employees/${employeeId}/department-history`, { params });

      const historyData = response.data.items || response.data;
      setHistory(historyData);

      // Calculate total pages
      const total = response.data.total || historyData.length;
      setTotalPages(Math.ceil(total / pageSize));
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setError(err.response?.data?.detail || 'Failed to load assignment history');
    } finally {
      setLoading(false);
    }
  };

  // Load departments for filter
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.items || response.data);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchHistory();
      fetchDepartments();
    }
  }, [employeeId, page, dateFrom, dateTo, departmentFilter]);

  // Export to CSV
  const handleExport = () => {
    if (!history || history.length === 0) return;

    const csvData = [
      ['Date', 'From Department', 'To Department', 'Changed By', 'Reason']
    ];

    history.forEach(entry => {
      csvData.push([
        new Date(entry.changeDate || entry.createdAt).toLocaleString(),
        entry.fromDepartment?.name || 'Unassigned',
        entry.toDepartment?.name || 'Unassigned',
        entry.changedByUser || entry.changedBy || 'System',
        entry.reason || 'N/A'
      ]);
    });

    const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignment-history-${employeeId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Clear filters
  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDepartmentFilter('');
    setPage(1);
  };

  // Get icon for change type
  const getChangeIcon = (entry) => {
    if (!entry.fromDepartment && entry.toDepartment) {
      return <PersonAddIcon />;
    } else if (entry.fromDepartment && !entry.toDepartment) {
      return <PersonRemoveIcon />;
    } else {
      return <SwapHorizIcon />;
    }
  };

  // Get color for change type
  const getChangeColor = (entry) => {
    if (!entry.fromDepartment && entry.toDepartment) {
      return 'success';
    } else if (entry.fromDepartment && !entry.toDepartment) {
      return 'error';
    } else {
      return 'primary';
    }
  };

  if (loading && history.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton color="inherit" size="small" onClick={fetchHistory}>
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
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" component="h2">
          Department Assignment History
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterListIcon color={showFilters ? 'primary' : 'inherit'} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchHistory} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export to CSV">
            <IconButton onClick={handleExport} disabled={history.length === 0}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
              <TextField
                label="To Date"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Department</InputLabel>
                <Select
                  value={departmentFilter}
                  label="Department"
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                onClick={handleClearFilters}
                size="small"
                disabled={!dateFrom && !dateTo && !departmentFilter}
              >
                Clear Filters
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {history.length === 0 ? (
        <Alert severity="info">
          No assignment history found for this employee.
        </Alert>
      ) : (
        <>
          <Timeline position="alternate">
            {history.map((entry, index) => (
              <TimelineItem key={entry.id || index}>
                <TimelineOppositeContent color="text.secondary">
                  <Typography variant="body2">
                    {new Date(entry.changeDate || entry.createdAt).toLocaleDateString()}
                  </Typography>
                  <Typography variant="caption">
                    {new Date(entry.changeDate || entry.createdAt).toLocaleTimeString()}
                  </Typography>
                </TimelineOppositeContent>

                <TimelineSeparator>
                  <TimelineDot color={getChangeColor(entry)}>
                    {getChangeIcon(entry)}
                  </TimelineDot>
                  {index < history.length - 1 && <TimelineConnector />}
                </TimelineSeparator>

                <TimelineContent>
                  <Card>
                    <CardContent>
                      <Box display="flex" gap={1} alignItems="center" mb={1}>
                        {entry.fromDepartment ? (
                          <Chip
                            label={entry.fromDepartment.name}
                            size="small"
                            color="default"
                          />
                        ) : (
                          <Chip label="Unassigned" size="small" variant="outlined" />
                        )}
                        <SwapHorizIcon fontSize="small" color="action" />
                        {entry.toDepartment ? (
                          <Chip
                            label={entry.toDepartment.name}
                            size="small"
                            color="primary"
                          />
                        ) : (
                          <Chip label="Unassigned" size="small" variant="outlined" />
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Changed by: {entry.changedByUser || entry.changedBy || 'System'}
                      </Typography>

                      {entry.reason && (
                        <Typography variant="body2" color="text.secondary">
                          Reason: {entry.reason}
                        </Typography>
                      )}

                      {entry.metadata && (
                        <Box mt={1}>
                          <Typography variant="caption" color="text.secondary">
                            Additional Info: {JSON.stringify(entry.metadata)}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}

      {/* Loading indicator */}
      {loading && history.length > 0 && (
        <Box position="fixed" bottom={16} right={16}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default AssignmentHistoryTimeline;
