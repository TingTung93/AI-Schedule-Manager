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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import api from '../../services/api';

/**
 * DepartmentTransferDialog Component
 *
 * Modal dialog for transferring employees between departments.
 *
 * Features:
 * - Source department selector
 * - Target department selector
 * - Option: "Transfer all" or "Select specific employees"
 * - Employee selection grid (if specific)
 * - Confirmation dialog with impact summary
 * - Rollback option after transfer
 * - Material-UI Stepper for workflow
 * - Form validation
 *
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {number} [props.sourceDepartmentId] - Pre-selected source department
 * @param {Function} [props.onSuccess] - Success callback
 */
const DepartmentTransferDialog = ({
  open,
  onClose,
  sourceDepartmentId = null,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Department data
  const [departments, setDepartments] = useState([]);
  const [sourceDepartment, setSourceDepartment] = useState(sourceDepartmentId || '');
  const [targetDepartment, setTargetDepartment] = useState('');

  // Transfer options
  const [transferType, setTransferType] = useState('all'); // 'all' or 'selected'
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  // Transfer result
  const [transferResult, setTransferResult] = useState(null);

  const steps = ['Select Departments', 'Choose Employees', 'Confirm Transfer', 'Complete'];

  // Load departments and employees
  useEffect(() => {
    if (open) {
      loadDepartments();
      setSourceDepartment(sourceDepartmentId || '');
      setActiveStep(0);
      setTransferResult(null);
    }
  }, [open, sourceDepartmentId]);

  useEffect(() => {
    if (sourceDepartment && transferType === 'selected') {
      loadDepartmentEmployees(sourceDepartment);
    }
  }, [sourceDepartment, transferType]);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/api/departments', { params: { active: true } });
      setDepartments(response.data.items || response.data);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setError('Failed to load departments');
    }
  };

  const loadDepartmentEmployees = async (departmentId) => {
    setLoading(true);
    try {
      const response = await api.get('/api/employees', {
        params: { departmentId, limit: 1000 }
      });
      setEmployees(response.data.items || response.data);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Execute transfer
  const handleExecuteTransfer = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        fromDepartmentId: sourceDepartment,
        toDepartmentId: targetDepartment,
      };

      // If specific employees selected, include their IDs
      if (transferType === 'selected') {
        payload.employeeIds = selectedEmployees;
      }

      const response = await api.post('/api/employees/transfer-department', payload);

      setTransferResult(response.data);
      setActiveStep(3); // Move to completion step

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Transfer failed:', err);
      setError(err.response?.data?.detail || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setActiveStep(0);
    setSourceDepartment(sourceDepartmentId || '');
    setTargetDepartment('');
    setTransferType('all');
    setSelectedEmployees([]);
    setEmployees([]);
    setTransferResult(null);
    setError(null);
    onClose();
  };

  // Navigation
  const handleNext = () => {
    // Skip employee selection step if transferring all
    if (activeStep === 0 && transferType === 'all') {
      setActiveStep(2); // Jump to confirmation
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    // Skip back to department selection if we jumped forward
    if (activeStep === 2 && transferType === 'all') {
      setActiveStep(0);
    } else {
      setActiveStep(prev => prev - 1);
    }
  };

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

  // Get department names
  const sourceDeptName = departments.find(d => d.id === sourceDepartment)?.name || '';
  const targetDeptName = departments.find(d => d.id === targetDepartment)?.name || '';

  // Calculate transfer count
  const transferCount = transferType === 'all'
    ? departments.find(d => d.id === sourceDepartment)?.employeeCount || 0
    : selectedEmployees.length;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="transfer-dialog-title"
    >
      <DialogTitle id="transfer-dialog-title">
        Department Transfer Workflow
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

        {/* Step 0: Select Departments */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Source and Target Departments
            </Typography>

            <Box display="flex" gap={2} alignItems="center" mb={3}>
              <FormControl fullWidth>
                <InputLabel>Source Department</InputLabel>
                <Select
                  value={sourceDepartment}
                  label="Source Department"
                  onChange={(e) => setSourceDepartment(e.target.value)}
                  disabled={sourceDepartmentId !== null}
                >
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                      {dept.employeeCount !== undefined && ` (${dept.employeeCount} employees)`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <SwapHorizIcon fontSize="large" color="action" />

              <FormControl fullWidth>
                <InputLabel>Target Department</InputLabel>
                <Select
                  value={targetDepartment}
                  label="Target Department"
                  onChange={(e) => setTargetDepartment(e.target.value)}
                >
                  {departments
                    .filter(dept => dept.id !== sourceDepartment)
                    .map(dept => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                        {dept.employeeCount !== undefined && ` (${dept.employeeCount} employees)`}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>

            <FormControl component="fieldset">
              <FormLabel component="legend">Transfer Options</FormLabel>
              <RadioGroup
                value={transferType}
                onChange={(e) => setTransferType(e.target.value)}
              >
                <FormControlLabel
                  value="all"
                  control={<Radio />}
                  label="Transfer all employees"
                />
                <FormControlLabel
                  value="selected"
                  control={<Radio />}
                  label="Select specific employees"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        )}

        {/* Step 1: Select Employees */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Employees to Transfer
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {selectedEmployees.length} of {employees.length} selected
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <LinearProgress />
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                {employees.map(employee => (
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
                      secondary={`${employee.email} • ${employee.role || 'No role'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Step 2: Confirmation */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Transfer
            </Typography>

            <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
              <AlertTitle>Review Transfer Impact</AlertTitle>
              This action will transfer {transferCount} employee(s) from{' '}
              <strong>{sourceDeptName}</strong> to <strong>{targetDeptName}</strong>.
            </Alert>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Transfer Summary
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Source Department:
                  </Typography>
                  <Chip label={sourceDeptName} color="default" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Target Department:
                  </Typography>
                  <Chip label={targetDeptName} color="primary" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Employees to Transfer:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {transferCount}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <Alert severity="info" icon={<InfoIcon />}>
              You can undo this operation after completion if needed.
            </Alert>
          </Box>
        )}

        {/* Step 3: Complete */}
        {activeStep === 3 && transferResult && (
          <Box>
            <Alert
              severity={transferResult.failureCount === 0 ? 'success' : 'warning'}
              sx={{ mb: 2 }}
            >
              <AlertTitle>Transfer Complete</AlertTitle>
              <Box>
                <Typography variant="body2">
                  ✓ {transferResult.successCount} employee(s) transferred successfully
                </Typography>
                {transferResult.failureCount > 0 && (
                  <Typography variant="body2" color="error.main">
                    ✗ {transferResult.failureCount} employee(s) failed
                  </Typography>
                )}
              </Box>
            </Alert>

            {transferResult.errors && transferResult.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Error Details:
                </Typography>
                <List dense>
                  {transferResult.errors.map((err, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={err.employeeId ? `Employee ID: ${err.employeeId}` : 'Unknown'}
                        secondary={err.error || err.message}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {activeStep === 3 ? 'Close' : 'Cancel'}
        </Button>
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < 2 && (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={
              loading ||
              !sourceDepartment ||
              !targetDepartment ||
              (activeStep === 1 && selectedEmployees.length === 0)
            }
          >
            Next
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            onClick={handleExecuteTransfer}
            variant="contained"
            color="primary"
            disabled={loading || !sourceDepartment || !targetDepartment}
          >
            {loading ? 'Transferring...' : 'Execute Transfer'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DepartmentTransferDialog;
