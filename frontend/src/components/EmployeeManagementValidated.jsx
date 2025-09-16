import React, { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

import { employeeService } from '../services/api';
import { useApi, useApiMutation } from '../hooks/useApi';
import { employeeSchema } from '../schemas/validationSchemas';
import {
  ValidatedTextField,
  ValidatedSelect,
  ValidatedAutoComplete,
  FormErrorSummary
} from './forms';
import { validateEmail, checkShiftConflicts } from '../utils/validation';

const EmployeeManagementValidated = () => {
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notification, setNotification] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  // Form setup with react-hook-form and Yup validation
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid, isDirty },
    trigger,
    setError,
    clearErrors
  } = useForm({
    resolver: yupResolver(employeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: '',
      hourlyRate: null,
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
    },
    mode: 'onChange'
  });

  // Watch form values for async validation
  const watchedEmail = watch('email');
  const watchedAvailability = watch('availability');
  const watchedMaxHours = watch('maxHoursPerWeek');

  // API hooks
  const { data: employeesData, loading: loadingEmployees, refetch: refetchEmployees } = useApi(
    () => employeeService.getEmployees(),
    [],
    {
      onSuccess: (data) => {
        console.log('Employees loaded:', data);
      },
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load employees' });
      }
    }
  );

  const { mutate: createEmployee, loading: creating } = useApiMutation(
    employeeService.createEmployee,
    {
      onSuccess: () => {
        refetchEmployees();
        setOpenDialog(false);
        reset();
        setNotification({ type: 'success', message: 'Employee added successfully' });
      },
      onError: (error) => {
        if (error.response?.data?.detail) {
          // Handle backend validation errors
          const detail = error.response.data.detail;
          if (detail.includes('email')) {
            setError('email', { message: 'Email address is already in use' });
          } else {
            setNotification({ type: 'error', message: detail });
          }
        } else {
          setNotification({ type: 'error', message: error.message || 'Failed to create employee' });
        }
      }
    }
  );

  const { mutate: updateEmployee, loading: updating } = useApiMutation(
    employeeService.updateEmployee,
    {
      onSuccess: () => {
        refetchEmployees();
        setOpenDialog(false);
        reset();
        setNotification({ type: 'success', message: 'Employee updated successfully' });
      },
      onError: (error) => {
        if (error.response?.data?.detail) {
          const detail = error.response.data.detail;
          if (detail.includes('email')) {
            setError('email', { message: 'Email address is already in use' });
          } else {
            setNotification({ type: 'error', message: detail });
          }
        } else {
          setNotification({ type: 'error', message: error.message || 'Failed to update employee' });
        }
      }
    }
  );

  const { mutate: deleteEmployee, loading: deleting } = useApiMutation(
    employeeService.deleteEmployee,
    {
      onSuccess: () => {
        refetchEmployees();
        setDeleteConfirmOpen(false);
        setEmployeeToDelete(null);
        setNotification({ type: 'success', message: 'Employee deleted successfully' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: error.message || 'Failed to delete employee' });
      }
    }
  );

  // Data processing
  const employees = employeesData?.employees || [];
  const roles = [
    { value: 'manager', label: 'Manager' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'cook', label: 'Cook' },
    { value: 'server', label: 'Server' },
    { value: 'cleaner', label: 'Cleaner' }
  ];
  const qualifications = [
    'First Aid',
    'Food Safety',
    'Manager Training',
    'Customer Service',
    'Cash Handling'
  ];

  // Async validation for email uniqueness
  const validateEmailUnique = useCallback(async (email) => {
    if (!email || !validateEmail(email)) return true;

    try {
      // Skip validation if editing and email hasn't changed
      if (dialogMode === 'edit' && selectedEmployee?.email === email) {
        return true;
      }

      const response = await employeeService.checkEmailAvailability(email);
      return response.available;
    } catch (error) {
      console.warn('Email validation error:', error);
      return true; // Allow form submission, backend will handle
    }
  }, [dialogMode, selectedEmployee]);

  // Async email validation effect
  React.useEffect(() => {
    if (watchedEmail && isDirty) {
      const timeoutId = setTimeout(async () => {
        const isUnique = await validateEmailUnique(watchedEmail);
        if (!isUnique) {
          setError('email', { message: 'Email address is already in use' });
        } else if (errors.email?.message === 'Email address is already in use') {
          clearErrors('email');
          trigger('email');
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [watchedEmail, isDirty, validateEmailUnique, setError, clearErrors, trigger, errors.email]);

  // Business logic validation for max hours vs availability
  React.useEffect(() => {
    if (watchedAvailability && watchedMaxHours && isDirty) {
      let maxPossibleHours = 0;
      const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      daysOfWeek.forEach(day => {
        const dayData = watchedAvailability[day];
        if (dayData && dayData.available && dayData.start && dayData.end) {
          const [startHours, startMinutes] = dayData.start.split(':').map(Number);
          const [endHours, endMinutes] = dayData.end.split(':').map(Number);
          const startInMinutes = startHours * 60 + startMinutes;
          const endInMinutes = endHours * 60 + endMinutes;
          maxPossibleHours += (endInMinutes - startInMinutes) / 60;
        }
      });

      if (watchedMaxHours > maxPossibleHours) {
        setError('maxHoursPerWeek', {
          message: `Maximum hours (${watchedMaxHours}) exceeds available hours (${maxPossibleHours.toFixed(1)}) based on availability`
        });
      } else if (errors.maxHoursPerWeek?.message?.includes('exceeds available hours')) {
        clearErrors('maxHoursPerWeek');
        trigger('maxHoursPerWeek');
      }
    }
  }, [watchedAvailability, watchedMaxHours, isDirty, setError, clearErrors, trigger, errors.maxHoursPerWeek]);

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
      reset({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || '',
        hourlyRate: employee.hourlyRate || null,
        qualifications: employee.qualifications || [],
        availability: employee.availability || {
          monday: { available: true, start: '09:00', end: '17:00' },
          tuesday: { available: true, start: '09:00', end: '17:00' },
          wednesday: { available: true, start: '09:00', end: '17:00' },
          thursday: { available: true, start: '09:00', end: '17:00' },
          friday: { available: true, start: '09:00', end: '17:00' },
          saturday: { available: false, start: '09:00', end: '17:00' },
          sunday: { available: false, start: '09:00', end: '17:00' },
        },
        maxHoursPerWeek: employee.maxHoursPerWeek || 40,
        isActive: employee.isActive !== undefined ? employee.isActive : true,
      });
    } else {
      reset();
    }

    setOpenDialog(true);
  }, [reset]);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedEmployee(null);
    reset();
  }, [reset]);

  const onSubmit = useCallback(async (data) => {
    try {
      const employeeData = {
        ...data,
        hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
        maxHoursPerWeek: parseInt(data.maxHoursPerWeek) || 40,
      };

      if (dialogMode === 'add') {
        await createEmployee(employeeData);
      } else {
        await updateEmployee(selectedEmployee.id, employeeData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [dialogMode, selectedEmployee, createEmployee, updateEmployee]);

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
    setValue(`availability.${day}.${field}`, value, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

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
            <ValidatedTextField
              name="search"
              control={{ register: () => ({}), formState: { errors: {} } }}
              size="small"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startAdornment={<SearchIcon />}
              sx={{ minWidth: 300, mr: 2 }}
              margin="none"
            />

            <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roles.map(role => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
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
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete employee">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(employee)}
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {dialogMode === 'add' ? 'Add New Employee' : 'Edit Employee'}
          </DialogTitle>
          <DialogContent>
            {/* Form Error Summary */}
            <FormErrorSummary
              errors={errors}
              title="Please fix the following errors:"
              collapsible={Object.keys(errors).length > 3}
              showFieldPath={true}
            />

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="firstName"
                  control={control}
                  label="First Name"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="lastName"
                  control={control}
                  label="Last Name"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="email"
                  control={control}
                  label="Email"
                  type="email"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="phone"
                  control={control}
                  label="Phone"
                  type="phone"
                  autoFormat={true}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedSelect
                  name="role"
                  control={control}
                  label="Role"
                  options={roles}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="hourlyRate"
                  control={control}
                  label="Hourly Rate"
                  type="number"
                  startAdornment="$"
                />
              </Grid>

              <Grid item xs={12}>
                <ValidatedAutoComplete
                  name="qualifications"
                  control={control}
                  label="Qualifications"
                  options={qualifications}
                  multiple
                  freeSolo
                  placeholder="Select or add qualifications"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <ValidatedTextField
                  name="maxHoursPerWeek"
                  control={control}
                  label="Max Hours Per Week"
                  type="number"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={watch('isActive')}
                      onChange={(e) => setValue('isActive', e.target.checked, { shouldValidate: true })}
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
                {Object.entries(watchedAvailability || {}).map(([day, dayData]) => (
                  <Grid container spacing={2} key={day} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={dayData?.available || false}
                            onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                          />
                        }
                        label={day.charAt(0).toUpperCase() + day.slice(1)}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <ValidatedTextField
                        name={`availability.${day}.start`}
                        control={control}
                        type="time"
                        label="Start Time"
                        disabled={!dayData?.available}
                        size="small"
                        margin="none"
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <ValidatedTextField
                        name={`availability.${day}.end`}
                        control={control}
                        type="time"
                        label="End Time"
                        disabled={!dayData?.available}
                        size="small"
                        margin="none"
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
              type="submit"
              variant="contained"
              disabled={!isValid || creating || updating}
              startIcon={creating || updating ? <CircularProgress size={16} /> : null}
            >
              {dialogMode === 'add' ? 'Add Employee' : 'Update Employee'}
            </Button>
          </DialogActions>
        </form>
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

export default EmployeeManagementValidated;