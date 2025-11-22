/**
 * DepartmentEmployeeAssignment Component
 *
 * Provides drag-and-drop interface for assigning employees to departments.
 *
 * Features:
 * - Two-column layout: Unassigned employees | Department employees
 * - Native HTML5 drag-and-drop support
 * - Bulk selection with checkboxes
 * - Bulk assign/unassign operations
 * - Transfer dialog for moving employees between departments
 * - Real-time updates after operations
 * - Loading states and comprehensive error handling
 *
 * @module components/departments/DepartmentEmployeeAssignment
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Checkbox,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  SwapHoriz as SwapHorizIcon,
  DragIndicator as DragIndicatorIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  getUnassignedEmployees,
  bulkAssignDepartment,
  transferDepartment,
  getDepartment,
} from '../../services/departmentService';
import { getEmployees } from '../../services/employeeService';

/**
 * Main component for department employee assignment
 */
const DepartmentEmployeeAssignment = ({ departmentId, onAssignmentChange }) => {
  // State management
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [selectedUnassigned, setSelectedUnassigned] = useState([]);
  const [selectedAssigned, setSelectedAssigned] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [draggedEmployee, setDraggedEmployee] = useState(null);

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState('');
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [transferReason, setTransferReason] = useState('');

  // Current department info
  const [departmentInfo, setDepartmentInfo] = useState(null);

  /**
   * Load data on component mount and when departmentId changes
   */
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  /**
   * Load all necessary data
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load unassigned employees
      const unassignedData = await getUnassignedEmployees();
      setUnassignedEmployees(unassignedData);

      // Load department info and assigned employees
      if (departmentId) {
        const deptData = await getDepartment(departmentId);
        setDepartmentInfo(deptData);

        // Get employees for this department
        const allEmployees = await getEmployees({ departmentId });
        setAssignedEmployees(allEmployees.items || []);
      } else {
        setAssignedEmployees([]);
        setDepartmentInfo(null);
      }

      // Clear selections
      setSelectedUnassigned([]);
      setSelectedAssigned([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employee data');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  /**
   * Handle drag start
   */
  const handleDragStart = (e, employee, fromAssigned) => {
    setDraggedEmployee({ ...employee, fromAssigned });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);

    // Visual feedback
    e.currentTarget.style.opacity = '0.4';
  };

  /**
   * Handle drag end
   */
  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedEmployee(null);
  };

  /**
   * Handle drag over
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  /**
   * Handle drop on unassigned list (remove from department)
   */
  const handleDropUnassigned = async (e) => {
    e.preventDefault();

    if (!draggedEmployee || !draggedEmployee.fromAssigned) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Unassign employee (set departmentId to null)
      await bulkAssignDepartment([draggedEmployee.id], null);

      setSuccess(`${draggedEmployee.firstName} ${draggedEmployee.lastName} unassigned successfully`);
      await loadData();

      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unassign employee');
      console.error('Unassign error:', err);
    } finally {
      setLoading(false);
      setDraggedEmployee(null);
    }
  };

  /**
   * Handle drop on assigned list (assign to department)
   */
  const handleDropAssigned = async (e) => {
    e.preventDefault();

    if (!draggedEmployee || draggedEmployee.fromAssigned || !departmentId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Assign employee to department
      await bulkAssignDepartment([draggedEmployee.id], departmentId);

      setSuccess(`${draggedEmployee.firstName} ${draggedEmployee.lastName} assigned successfully`);
      await loadData();

      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign employee');
      console.error('Assign error:', err);
    } finally {
      setLoading(false);
      setDraggedEmployee(null);
    }
  };

  /**
   * Handle bulk assign selected unassigned employees
   */
  const handleBulkAssign = async () => {
    if (selectedUnassigned.length === 0 || !departmentId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await bulkAssignDepartment(selectedUnassigned, departmentId);

      setSuccess(`Successfully assigned ${result.successCount} of ${result.totalAttempted} employees`);
      await loadData();

      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign employees');
      console.error('Bulk assign error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle bulk unassign selected assigned employees
   */
  const handleBulkUnassign = async () => {
    if (selectedAssigned.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await bulkAssignDepartment(selectedAssigned, null);

      setSuccess(`Successfully unassigned ${result.successCount} of ${result.totalAttempted} employees`);
      await loadData();

      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unassign employees');
      console.error('Bulk unassign error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle transfer dialog open
   */
  const handleOpenTransferDialog = async () => {
    if (selectedAssigned.length === 0) {
      return;
    }

    try {
      setLoading(true);
      // Load available departments for transfer
      const { items } = await import('../../services/departmentService').then(mod =>
        mod.getDepartments({ active: true })
      );

      // Filter out current department
      setAvailableDepartments(items.filter(dept => dept.id !== departmentId));
      setTransferDialogOpen(true);
    } catch (err) {
      setError('Failed to load departments for transfer');
      console.error('Load departments error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle transfer confirmation
   */
  const handleTransferConfirm = async () => {
    if (!targetDepartmentId || selectedAssigned.length === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await transferDepartment(
        departmentId,
        targetDepartmentId,
        selectedAssigned
      );

      setSuccess(`Successfully transferred ${result.successCount} employees`);
      setTransferDialogOpen(false);
      setTargetDepartmentId('');
      setTransferReason('');
      await loadData();

      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer employees');
      console.error('Transfer error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle selection of unassigned employee
   */
  const toggleUnassignedSelection = (employeeId) => {
    setSelectedUnassigned(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  /**
   * Toggle selection of assigned employee
   */
  const toggleAssignedSelection = (employeeId) => {
    setSelectedAssigned(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  /**
   * Select all unassigned employees
   */
  const selectAllUnassigned = () => {
    if (selectedUnassigned.length === unassignedEmployees.length) {
      setSelectedUnassigned([]);
    } else {
      setSelectedUnassigned(unassignedEmployees.map(emp => emp.id));
    }
  };

  /**
   * Select all assigned employees
   */
  const selectAllAssigned = () => {
    if (selectedAssigned.length === assignedEmployees.length) {
      setSelectedAssigned([]);
    } else {
      setSelectedAssigned(assignedEmployees.map(emp => emp.id));
    }
  };

  /**
   * Render employee card
   */
  const renderEmployeeCard = (employee, isAssigned) => {
    const isSelected = isAssigned
      ? selectedAssigned.includes(employee.id)
      : selectedUnassigned.includes(employee.id);

    const toggleSelection = isAssigned
      ? toggleAssignedSelection
      : toggleUnassignedSelection;

    return (
      <Card
        key={employee.id}
        draggable
        onDragStart={(e) => handleDragStart(e, employee, isAssigned)}
        onDragEnd={handleDragEnd}
        sx={{
          mb: 1,
          cursor: 'move',
          border: isSelected ? 2 : 1,
          borderColor: isSelected ? 'primary.main' : 'divider',
          bgcolor: isSelected ? 'action.selected' : 'background.paper',
          '&:hover': {
            bgcolor: 'action.hover',
          },
          transition: 'all 0.2s',
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Checkbox
              checked={isSelected}
              onChange={() => toggleSelection(employee.id)}
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
            <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Box flex={1}>
              <Typography variant="body2" fontWeight="medium">
                {employee.firstName} {employee.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {employee.email}
              </Typography>
            </Box>
            {employee.role && (
              <Chip label={employee.role} size="small" variant="outlined" />
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Employee Assignment
          {departmentInfo && ` - ${departmentInfo.name}`}
        </Typography>
        <Tooltip title="Refresh data">
          <IconButton onClick={loadData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={2}>
        {/* Unassigned Employees Column */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={2}
            onDragOver={handleDragOver}
            onDrop={handleDropUnassigned}
            sx={{
              p: 2,
              minHeight: 500,
              bgcolor: draggedEmployee?.fromAssigned ? 'action.hover' : 'background.paper',
              transition: 'background-color 0.2s',
            }}
          >
            {/* Column Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox
                  checked={selectedUnassigned.length === unassignedEmployees.length && unassignedEmployees.length > 0}
                  indeterminate={selectedUnassigned.length > 0 && selectedUnassigned.length < unassignedEmployees.length}
                  onChange={selectAllUnassigned}
                  disabled={unassignedEmployees.length === 0}
                />
                <Typography variant="subtitle1" fontWeight="medium">
                  Unassigned Employees
                </Typography>
                <Badge badgeContent={unassignedEmployees.length} color="primary" />
              </Box>
            </Box>

            {/* Action Buttons */}
            {selectedUnassigned.length > 0 && departmentId && (
              <Box mb={2}>
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={handleBulkAssign}
                  disabled={loading}
                  size="small"
                  fullWidth
                >
                  Assign {selectedUnassigned.length} Selected
                </Button>
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Employee List */}
            {loading && unassignedEmployees.length === 0 ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : unassignedEmployees.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No unassigned employees
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {unassignedEmployees.map(emp => renderEmployeeCard(emp, false))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Assigned Employees Column */}
        <Grid item xs={12} md={6}>
          <Paper
            elevation={2}
            onDragOver={handleDragOver}
            onDrop={handleDropAssigned}
            sx={{
              p: 2,
              minHeight: 500,
              bgcolor: draggedEmployee && !draggedEmployee.fromAssigned ? 'action.hover' : 'background.paper',
              transition: 'background-color 0.2s',
            }}
          >
            {/* Column Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox
                  checked={selectedAssigned.length === assignedEmployees.length && assignedEmployees.length > 0}
                  indeterminate={selectedAssigned.length > 0 && selectedAssigned.length < assignedEmployees.length}
                  onChange={selectAllAssigned}
                  disabled={assignedEmployees.length === 0}
                />
                <Typography variant="subtitle1" fontWeight="medium">
                  Department Employees
                </Typography>
                <Badge badgeContent={assignedEmployees.length} color="secondary" />
              </Box>
            </Box>

            {/* Action Buttons */}
            {selectedAssigned.length > 0 && (
              <Box mb={2} display="flex" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<PersonRemoveIcon />}
                  onClick={handleBulkUnassign}
                  disabled={loading}
                  size="small"
                  flex={1}
                >
                  Unassign {selectedAssigned.length}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SwapHorizIcon />}
                  onClick={handleOpenTransferDialog}
                  disabled={loading}
                  size="small"
                  flex={1}
                >
                  Transfer
                </Button>
              </Box>
            )}

            <Divider sx={{ mb: 2 }} />

            {/* Employee List */}
            {!departmentId ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  Select a department to view assigned employees
                </Typography>
              </Box>
            ) : loading && assignedEmployees.length === 0 ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : assignedEmployees.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No employees assigned to this department
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {assignedEmployees.map(emp => renderEmployeeCard(emp, true))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => !loading && setTransferDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Transfer Employees to Another Department
        </DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Transfer {selectedAssigned.length} selected employee(s) to a different department
            </Typography>

            <FormControl fullWidth margin="normal">
              <InputLabel id="target-department-label">Target Department</InputLabel>
              <Select
                labelId="target-department-label"
                value={targetDepartmentId}
                onChange={(e) => setTargetDepartmentId(e.target.value)}
                label="Target Department"
                disabled={loading}
              >
                {availableDepartments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              margin="normal"
              label="Transfer Reason (Optional)"
              multiline
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              disabled={loading}
              placeholder="e.g., Reorganization, skills match, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTransferDialogOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransferConfirm}
            variant="contained"
            disabled={loading || !targetDepartmentId}
            startIcon={loading ? <CircularProgress size={20} /> : <SwapHorizIcon />}
          >
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentEmployeeAssignment;
