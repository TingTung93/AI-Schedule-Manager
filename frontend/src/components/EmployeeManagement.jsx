import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  Toolbar,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  TablePagination,
  FormControlLabel,
  Switch,
  Grid,
  Autocomplete,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';
import { useApi, useApiMutation } from '../hooks/useApi';

const EmployeeManagement = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notification, setNotification] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    department: null,
    hourlyRate: '',
    qualifications: [],
    availability: {
      monday: { available: true, start: '09:00', end: '17:00' },
      tuesday: { available: true, start: '09:00', end: '17:00' },
      wednesday: { available: true, start: '09:00', end: '17:00' },
      thursday: { available: true, start: '09:00', end: '17:00' },
      friday: { available: true, start: '09:00', end: '17:00' },
      saturday: { available: false, start: '09:00', end: '17:00' },
      sunday: { available: false, start: '09:00', end: '17:00' },
    },
    maxHoursPerWeek: 40,
    isActive: true,
  });

  // API hooks
  const { data: employeesData, loading: loadingEmployees, refetch: refetchEmployees } = useApi(
    () => api.get('/api/employees'),
    [],
    {
      onSuccess: (data) => {
        // Employees loaded successfully
      },
      onError: (error) => {
        setNotification({ type: 'error', message: getErrorMessage(error) });
      }
    }
  );

  // Fetch departments
  const { data: departmentsData, loading: loadingDepartments } = useApi(
    () => api.get('/api/departments'),
    [],
    {
      onError: (error) => {
        console.error('Error loading departments:', error);
      }
    }
  );

  const { mutate: createEmployee, loading: creating } = useApiMutation(
    (data) => api.post('/api/employees', data),
    {
      onSuccess: () => {
        refetchEmployees();
        setOpenDialog(false);
        resetForm();
        setNotification({ type: 'success', message: 'Employee added successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: getErrorMessage(error) });
      }
    }
  );

  const { mutate: updateEmployee, loading: updating } = useApiMutation(
    ({ id, data }) => api.patch(`/api/employees/${id}`, data),
    {
      onSuccess: () => {
        refetchEmployees();
        setOpenDialog(false);
        resetForm();
        setNotification({ type: 'success', message: 'Employee updated successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: getErrorMessage(error) });
      }
    }
  );

  const { mutate: deleteEmployee, loading: deleting } = useApiMutation(
    (id) => api.delete(`/api/employees/${id}`),
    {
      onSuccess: () => {
        refetchEmployees();
        setDeleteConfirmOpen(false);
        setEmployeeToDelete(null);
        setNotification({ type: 'success', message: 'Employee deleted successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: getErrorMessage(error) });
      }
    }
  );

  // Data processing
  const employees = employeesData?.items || [];
  const departments = useMemo(() => departmentsData?.items || [], [departmentsData]);
  const roles = ['manager', 'supervisor', 'cashier', 'cook', 'server', 'cleaner'];
  const qualifications = ['First Aid', 'Food Safety', 'Manager Training', 'Customer Service', 'Cash Handling'];

  // Filtered and paginated data
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch =
        employee.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && employee.isActive) ||
        (statusFilter === 'inactive' && !employee.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, roleFilter, statusFilter]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredEmployees, page, rowsPerPage]);

  // Event handlers
  const handleOpenDialog = useCallback((mode, employee = null) => {
    setDialogMode(mode);
    setSelectedEmployee(employee);
    if (employee) {
      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || '',
        department: employee.departmentId || null,
        hourlyRate: employee.hourlyRate || '',
        qualifications: employee.qualifications || [],
        availability: employee.availability || formData.availability,
        maxHoursPerWeek: employee.maxHoursPerWeek || 40,
        isActive: employee.isActive !== undefined ? employee.isActive : true,
      });
    }
    setOpenDialog(true);
  }, [formData.availability]);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedEmployee(null);
    resetForm();
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: '',
      department: null,
      hourlyRate: '',
      qualifications: [],
      availability: {
        monday: { available: true, start: '09:00', end: '17:00' },
        tuesday: { available: true, start: '09:00', end: '17:00' },
        wednesday: { available: true, start: '09:00', end: '17:00' },
        thursday: { available: true, start: '09:00', end: '17:00' },
        friday: { available: true, start: '09:00', end: '17:00' },
        saturday: { available: false, start: '09:00', end: '17:00' },
        sunday: { available: false, start: '09:00', end: '17:00' },
      },
      maxHoursPerWeek: 40,
      isActive: true,
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate email uniqueness before submission (only for new employees with email)
    if (dialogMode === 'add' && formData.email && formData.email.trim()) {
      const emailExists = employees.some(
        emp => emp.email?.toLowerCase() === formData.email.toLowerCase()
      );

      if (emailExists) {
        setNotification({
          type: 'error',
          message: `Email ${formData.email} is already in use. Please use a different email or leave it empty to auto-generate.`
        });
        return;
      }
    }

    const employeeData = {
      ...formData,
      hourlyRate: parseFloat(formData.hourlyRate) || 0,
      maxHoursPerWeek: parseInt(formData.maxHoursPerWeek) || 40,
      // Only include email if it's not empty
      email: formData.email.trim() || undefined,
      // Send department as departmentId to backend
      departmentId: formData.department || undefined,
    };

    // Remove the local 'department' field as we're sending 'departmentId'
    delete employeeData.department;

    if (dialogMode === 'add') {
      createEmployee(employeeData);
    } else {
      updateEmployee({ id: selectedEmployee.id, data: employeeData });
    }
  }, [dialogMode, formData, selectedEmployee, employees, createEmployee, updateEmployee, setNotification]);

  const handleDeleteClick = useCallback((employee) => {
    setEmployeeToDelete(employee);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (employeeToDelete) {
      deleteEmployee(employeeToDelete.id);
    }
  }, [employeeToDelete, deleteEmployee]);

  const handleAvailabilityChange = useCallback((day, field, value) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value,
        },
      },
    }));
  }, []);

  const getRoleColor = (role) => {
    const colors = {
      manager: 'primary',
      supervisor: 'secondary',
      cashier: 'info',
      cook: 'warning',
      server: 'success',
      cleaner: 'default',
    };
    return colors[role] || 'default';
  };

  const isFormValid = () => {
    return formData.firstName && formData.lastName && formData.email && formData.role;
  };

  if (loadingEmployees) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Employee Management
      </Typography>

      {/* Header Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Toolbar sx={{ px: 0 }}>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300, mr: 2 }}
              aria-label="Search employees"
            />

            <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roles.map(role => (
                  <MenuItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('add')}
              aria-label="Add new employee"
            >
              Add Employee
            </Button>
          </Toolbar>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Qualifications</TableCell>
                <TableCell>Rate</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedEmployees.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: getRoleColor(employee.role) }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {employee.firstName} {employee.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {employee.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <EmailIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2">{employee.email}</Typography>
                      </Box>
                      {employee.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">{employee.phone}</Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.role}
                      color={getRoleColor(employee.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {employee.department?.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {employee.qualifications?.slice(0, 2).map((qual, idx) => (
                        <Chip
                          key={idx}
                          label={qual}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {employee.qualifications?.length > 2 && (
                        <Tooltip title={employee.qualifications.slice(2).join(', ')}>
                          <Chip
                            label={`+${employee.qualifications.length - 2}`}
                            size="small"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    ${employee.hourlyRate?.toFixed(2) || '0.00'}/hr
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.isActive ? 'Active' : 'Inactive'}
                      color={employee.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit employee">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog('edit', employee)}
                        aria-label={`Edit ${employee.firstName} ${employee.lastName}`}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete employee">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(employee)}
                        aria-label={`Delete ${employee.firstName} ${employee.lastName}`}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredEmployees.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Add New Employee' : 'Edit Employee'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                aria-label="First name"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                aria-label="Last name"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                helperText={dialogMode === 'add' ? "Leave empty to auto-generate a unique email address" : ""}
                aria-label="Email address"
                placeholder="Leave empty to auto-generate"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                aria-label="Phone number"
              />
            </Grid>

            {/* Role and Department */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  aria-label="Employee role"
                >
                  {roles.map(role => (
                    <MenuItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={formData.department || ''}
                  label="Department"
                  onChange={(e) => setFormData({ ...formData, department: e.target.value || null })}
                  aria-label="Department"
                  disabled={loadingDepartments}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Rate */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Hourly Rate"
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                aria-label="Hourly rate"
              />
            </Grid>

            {/* Qualifications */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={qualifications}
                value={formData.qualifications}
                onChange={(event, newValue) => setFormData({ ...formData, qualifications: newValue })}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Qualifications"
                    placeholder="Select qualifications"
                    aria-label="Employee qualifications"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Hours Per Week"
                type="number"
                value={formData.maxHoursPerWeek}
                onChange={(e) => setFormData({ ...formData, maxHoursPerWeek: e.target.value })}
                aria-label="Maximum hours per week"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    aria-label="Employee active status"
                  />
                }
                label="Active Employee"
              />
            </Grid>

            {/* Availability */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Weekly Availability
              </Typography>
              {Object.entries(formData.availability).map(([day, dayData]) => (
                <Grid container spacing={2} key={day} sx={{ mb: 2 }}>
                  <Grid item xs={3}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={dayData.available}
                          onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                          aria-label={`Available on ${day}`}
                        />
                      }
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      type="time"
                      label="Start Time"
                      value={dayData.start}
                      onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                      disabled={!dayData.available}
                      fullWidth
                      size="small"
                      aria-label={`Start time for ${day}`}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      type="time"
                      label="End Time"
                      value={dayData.end}
                      onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                      disabled={!dayData.available}
                      fullWidth
                      size="small"
                      aria-label={`End time for ${day}`}
                    />
                  </Grid>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid() || creating || updating}
            startIcon={creating || updating ? <CircularProgress size={16} /> : null}
          >
            {dialogMode === 'add' ? 'Add Employee' : 'Update Employee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Employee</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {employeeToDelete?.firstName} {employeeToDelete?.lastName}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : null}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
      >
        {notification && (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.type}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default EmployeeManagement;