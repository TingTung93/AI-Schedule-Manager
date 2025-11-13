import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Box,
  IconButton,
  Chip,
  TextField,
  Autocomplete
} from '@mui/material';
import { Download, Close, Description, TableChart, PictureAsPdf, Event } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PropTypes from 'prop-types';
import api from '../../services/api';
import ProgressIndicator from './ProgressIndicator';

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV (Comma-Separated Values)', icon: <TableChart /> },
  { value: 'excel', label: 'Excel Spreadsheet (.xlsx)', icon: <Description /> },
  { value: 'pdf', label: 'PDF Document', icon: <PictureAsPdf /> },
  { value: 'ical', label: 'iCalendar (.ics)', icon: <Event /> }
];

/**
 * ExportDialog Component
 *
 * Handles schedule data export in multiple formats (CSV, Excel, PDF, iCal)
 * Features: format selection, date range filtering, employee/department filters
 */
const ExportDialog = ({ open, onClose, onExport }) => {
  const [format, setFormat] = useState('csv');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateeTo] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Load employees and departments on mount
  useEffect(() => {
    if (open) {
      loadFilterData();
      // Set default date range to current month
      const now = new Date();
      setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1));
      setDateeTo(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
  }, [open]);

  const loadFilterData = async () => {
    setLoadingData(true);
    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        api.get('/api/employees'),
        api.get('/api/departments')
      ]);

      setEmployees(employeesRes.data || []);
      setDepartments(departmentsRes.data || []);
    } catch (err) {
      console.error('Error loading filter data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleReset = () => {
    setFormat('csv');
    setDateFrom(null);
    setDateeTo(null);
    setSelectedEmployees([]);
    setSelectedDepartments([]);
    setError(null);
    setProgress(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const getFileExtension = (formatValue) => {
    const extensions = {
      csv: 'csv',
      excel: 'xlsx',
      pdf: 'pdf',
      ical: 'ics'
    };
    return extensions[formatValue] || 'csv';
  };

  const formatDate = (date) => {
    if (!date) return null;
    return date.toISOString().split('T')[0];
  };

  const handleExport = async () => {
    // Validation
    if (!dateFrom || !dateTo) {
      setError('Please select both start and end dates');
      return;
    }

    if (dateFrom > dateTo) {
      setError('Start date must be before end date');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const requestBody = {
        format,
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        employee_ids: selectedEmployees.map(emp => emp.id),
        department_ids: selectedDepartments.map(dept => dept.id)
      };

      const response = await api.post('/api/data-io/export', requestBody, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      // Trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `schedule-${timestamp}.${getFileExtension(format)}`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Call onExport callback
      if (onExport) {
        onExport({ format, filename });
      }

      // Success - close dialog after brief delay
      setTimeout(() => {
        handleClose();
      }, 500);

    } catch (err) {
      console.error('Export error:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to export data. Please try again.'
      );
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const getFormatIcon = (formatValue) => {
    const option = FORMAT_OPTIONS.find(opt => opt.value === formatValue);
    return option ? option.icon : <Description />;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Download />
              <Typography variant="h6">Export Schedule Data</Typography>
            </Box>
            <IconButton onClick={handleClose} size="small" disabled={loading}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Format Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              label="Export Format"
              disabled={loading}
            >
              {FORMAT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {option.icon}
                    {option.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date Range */}
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1 }}>
            Date Range *
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <DatePicker
              label="Start Date"
              value={dateFrom}
              onChange={setDateFrom}
              disabled={loading}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
            <DatePicker
              label="End Date"
              value={dateTo}
              onChange={setDateeTo}
              disabled={loading}
              minDate={dateFrom}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
          </Box>

          {/* Employee Filter */}
          <Autocomplete
            multiple
            options={employees}
            getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
            value={selectedEmployees}
            onChange={(event, newValue) => setSelectedEmployees(newValue)}
            disabled={loading || loadingData}
            loading={loadingData}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by Employees (Optional)"
                placeholder={selectedEmployees.length === 0 ? "All employees" : ""}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={`${option.first_name} ${option.last_name}`}
                  {...getTagProps({ index })}
                  size="small"
                />
              ))
            }
            sx={{ mb: 3 }}
          />

          {/* Department Filter */}
          <Autocomplete
            multiple
            options={departments}
            getOptionLabel={(option) => option.name}
            value={selectedDepartments}
            onChange={(event, newValue) => setSelectedDepartments(newValue)}
            disabled={loading || loadingData}
            loading={loadingData}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by Departments (Optional)"
                placeholder={selectedDepartments.length === 0 ? "All departments" : ""}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.name}
                  {...getTagProps({ index })}
                  size="small"
                />
              ))
            }
            sx={{ mb: 2 }}
          />

          {/* Progress Indicator */}
          {loading && (
            <ProgressIndicator
              progress={progress}
              message={progress < 100 ? 'Generating export file...' : 'Download starting...'}
            />
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Export Info */}
          {!loading && !error && (
            <Alert severity="info" icon={getFormatIcon(format)} sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Export will include:</strong>
              </Typography>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>Date range: {dateFrom && dateTo ? `${formatDate(dateFrom)} to ${formatDate(dateTo)}` : 'Not set'}</li>
                <li>Employees: {selectedEmployees.length > 0 ? `${selectedEmployees.length} selected` : 'All'}</li>
                <li>Departments: {selectedDepartments.length > 0 ? `${selectedDepartments.length} selected` : 'All'}</li>
                <li>Format: {FORMAT_OPTIONS.find(opt => opt.value === format)?.label}</li>
              </ul>
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={loading || !dateFrom || !dateTo}
            startIcon={<Download />}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

ExportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func
};

export default ExportDialog;
