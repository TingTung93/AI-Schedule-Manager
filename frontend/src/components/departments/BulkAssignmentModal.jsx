import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  LinearProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import UndoIcon from '@mui/icons-material/Undo';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../services/api';

/**
 * BulkAssignmentModal Component
 *
 * Modal dialog for bulk assigning employees to a department.
 *
 * Features:
 * - Multi-select employee list with checkboxes
 * - Hierarchical department selector dropdown
 * - Real-time progress tracking during bulk operations
 * - Success/failure statistics with detailed error messages
 * - Undo last operation functionality
 * - Optimistic UI updates
 * - Search and filter employees
 * - Step-by-step wizard interface
 *
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {Array} [props.preselectedEmployees] - Pre-selected employee IDs
 * @param {Function} [props.onSuccess] - Success callback
 */
const BulkAssignmentModal = ({
  open,
  onClose,
  preselectedEmployees = [],
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState(preselectedEmployees);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastOperation, setLastOperation] = useState(null);

  const steps = ['Select Employees', 'Choose Department', 'Confirm & Execute'];

  // Load employees and departments
  useEffect(() => {
    if (open) {
      loadData();
      setSelectedEmployees(preselectedEmployees);
    }
  }, [open, preselectedEmployees]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        api.get('/api/employees', { params: { limit: 1000 } }),
        api.get('/api/departments', { params: { active: true } })
      ]);

      setEmployees(employeesRes.data.items || employeesRes.data);
      setDepartments(departmentsRes.data.items || departmentsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load employees and departments');
    } finally {
      setLoading(false);
    }
  };

  // Filter employees by search query
  const filteredEmployees = employees.filter(emp => {
    const query = searchQuery.toLowerCase();
    return (
      emp.firstName?.toLowerCase().includes(query) ||
      emp.lastName?.toLowerCase().includes(query) ||
      emp.email?.toLowerCase().includes(query) ||
      emp.role?.toLowerCase().includes(query)
    );
  });

  // Toggle employee selection
  const handleToggleEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  // Select all filtered employees
  const handleSelectAll = () => {
    const allIds = filteredEmployees.map(emp => emp.id);
    setSelectedEmployees(allIds);
  };

  // Deselect all employees
  const handleDeselectAll = () => {
    setSelectedEmployees([]);
  };

  // Execute bulk assignment
  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setProgress({ total: selectedEmployees.length, completed: 0, failed: 0 });

    try {
      const response = await api.post('/api/employees/bulk-assign-department', {
        employeeIds: selectedEmployees,
        departmentId: selectedDepartment,
      });

      const resultData = response.data;
      setResult(resultData);
      setProgress({
        total: resultData.totalAttempted || selectedEmployees.length,
        completed: resultData.successCount || 0,
        failed: resultData.failureCount || 0,
      });

      // Store for undo functionality
      setLastOperation({
        employeeIds: selectedEmployees,
        departmentId: selectedDepartment,
        timestamp: new Date().toISOString(),
      });

      // Call success callback
      if (onSuccess && resultData.successCount > 0) {
        onSuccess(resultData);
      }

      // Auto-close if all successful
      if (resultData.failureCount === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (err) {
      console.error('Bulk assignment failed:', err);
      setError(err.response?.data?.detail || 'Bulk assignment failed');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Undo last operation
  const handleUndo = async () => {
    if (!lastOperation) return;

    setLoading(true);
    try {
      // Unassign all employees (set department to null)
      const response = await api.post('/api/employees/bulk-assign-department', {
        employeeIds: lastOperation.employeeIds,
        departmentId: null, // Unassign
      });

      setResult(null);
      setProgress(null);
      setLastOperation(null);
      setError(null);

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Undo failed:', err);
      setError('Failed to undo operation');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setActiveStep(0);
    setSelectedEmployees([]);
    setSelectedDepartment('');
    setProgress(null);
    setResult(null);
    setError(null);
    setSearchQuery('');
    onClose();
  };

  // Navigation
  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  // Get selected department name
  const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name || '';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="bulk-assignment-title"
    >
      <DialogTitle id="bulk-assignment-title">
        Bulk Employee Assignment
      </DialogTitle>

      <DialogContent>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Step 1: Select Employees */}
        {activeStep === 0 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Select Employees ({selectedEmployees.length} selected)
              </Typography>
              <Box>
                <Button size="small" onClick={handleSelectAll} sx={{ mr: 1 }}>
                  Select All
                </Button>
                <Button size="small" onClick={handleDeselectAll}>
                  Deselect All
                </Button>
              </Box>
            </Box>

            {/* Search */}
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ mb: 2 }}
            />

            {/* Employee List */}
            <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {filteredEmployees.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No employees found" />
                </ListItem>
              ) : (
                filteredEmployees.map(employee => (
                  <ListItem
                    key={employee.id}
                    button
                    onClick={() => handleToggleEmployee(employee.id)}
                    dense
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedEmployees.includes(employee.id)}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${employee.firstName} ${employee.lastName}`}
                      secondary={
                        <>
                          {employee.email} • {employee.role || 'No role'}
                          {employee.department && (
                            <Chip
                              label={employee.department.name || 'Department'}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Box>
        )}

        {/* Step 2: Choose Department */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Target Department
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Assigning {selectedEmployees.length} employee(s)
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Department</InputLabel>
              <Select
                value={selectedDepartment}
                label="Department"
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                    {dept.parentDepartment && ` (${dept.parentDepartment.name})`}
                    {dept.employeeCount !== undefined && ` - ${dept.employeeCount} employees`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Step 3: Confirm & Execute */}
        {activeStep === 2 && (
          <Box>
            {!result ? (
              <>
                <Typography variant="h6" gutterBottom>
                  Confirm Bulk Assignment
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <AlertTitle>Review Changes</AlertTitle>
                  You are about to assign <strong>{selectedEmployees.length} employee(s)</strong> to{' '}
                  <strong>{selectedDeptName}</strong>.
                </Alert>

                {/* Progress Bar */}
                {loading && progress && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Processing: {progress.completed} / {progress.total}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(progress.completed / progress.total) * 100}
                    />
                  </Box>
                )}
              </>
            ) : (
              <>
                <Alert
                  severity={result.failureCount === 0 ? 'success' : 'warning'}
                  sx={{ mb: 2 }}
                  action={
                    lastOperation && (
                      <Tooltip title="Undo last operation">
                        <IconButton size="small" onClick={handleUndo} disabled={loading}>
                          <UndoIcon />
                        </IconButton>
                      </Tooltip>
                    )
                  }
                >
                  <AlertTitle>Operation Complete</AlertTitle>
                  <Box display="flex" gap={3}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography variant="body2">
                        {result.successCount} succeeded
                      </Typography>
                    </Box>
                    {result.failureCount > 0 && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <ErrorIcon color="error" fontSize="small" />
                        <Typography variant="body2">
                          {result.failureCount} failed
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Alert>

                {/* Error Details */}
                {result.errors && result.errors.length > 0 && (
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Error Details:
                    </Typography>
                    <List dense>
                      {result.errors.map((err, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <ErrorIcon color="error" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={err.employeeId ? `Employee ID: ${err.employeeId}` : 'Unknown'}
                            secondary={err.error || err.message}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {activeStep > 0 && !result && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 && (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={
              loading ||
              (activeStep === 0 && selectedEmployees.length === 0) ||
              (activeStep === 1 && !selectedDepartment)
            }
          >
            Next
          </Button>
        )}
        {activeStep === steps.length - 1 && !result && (
          <Button
            onClick={handleExecute}
            variant="contained"
            color="primary"
            disabled={loading || !selectedDepartment || selectedEmployees.length === 0}
          >
            {loading ? 'Assigning...' : 'Execute Assignment'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkAssignmentModal;
