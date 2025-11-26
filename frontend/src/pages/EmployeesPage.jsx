import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// import VirtualList from '../components/performance/VirtualList'; // For 1000+ employee lists
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Person,
  Email,
  Phone,
  Badge,
  Lock,
  Warning,
  Info,
  ManageAccounts,
  LockReset,
  VpnKey,
  School,
  AccessTime,
  AttachMoney,
  Schedule,
  History,
  Timeline,
  Assessment
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utils/routeConfig';
import api, { getErrorMessage } from '../services/api';
import SearchBar from '../components/search/SearchBar';
import { filterEmployees } from '../utils/filterUtils';
import DepartmentSelector from '../components/common/DepartmentSelector';
import AccountStatusDialog from '../components/AccountStatusDialog';
import AccountStatusHistoryDialog from '../components/AccountStatusHistoryDialog';
import PasswordResetDialog from '../components/PasswordResetDialog';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
import DepartmentHistoryDialog from '../components/departments/DepartmentHistoryDialog';
import RoleHistoryDialog from '../components/RoleHistoryDialog';

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [statusHistoryDialogOpen, setStatusHistoryDialogOpen] = useState(false);
  const [departmentHistoryDialogOpen, setDepartmentHistoryDialogOpen] = useState(false);
  const [roleHistoryDialogOpen, setRoleHistoryDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newQualification, setNewQualification] = useState('');
  const [employeeForm, setEmployeeForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: ROLES.EMPLOYEE,
    department_id: null,
    hireDate: '',
    qualifications: [],
    availability: {
      monday: { available: false },
      tuesday: { available: false },
      wednesday: { available: false },
      thursday: { available: false },
      friday: { available: false },
      saturday: { available: false },
      sunday: { available: false }
    },
    hourly_rate: '',
    max_hours_per_week: ''
  });

  // Load employees from API
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/employees');
      console.log('[EmployeesPage] API Response:', response.data);
      // Backend now returns array directly (List[EmployeeResponse])
      const employeesData = Array.isArray(response.data) ? response.data : [];
      setEmployees(employeesData);
    } catch (error) {
      console.error('[EmployeesPage] Error loading employees:', error);
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedEmployee here - dialogs need it
  };

  const handleResetPassword = () => {
    setPasswordResetDialogOpen(true);
    handleMenuClose();
  };

  const handleChangePassword = () => {
    setChangePasswordDialogOpen(true);
    handleMenuClose();
  };

  const handlePasswordSuccess = (message) => {
    setNotification({ type: 'success', message });
    setSelectedEmployee(null);
  };

  const handleViewStatusHistory = (employee) => {
    setSelectedEmployee(employee);
    setStatusHistoryDialogOpen(true);
    handleMenuClose();
  };

  const handleViewDepartmentHistory = (employee) => {
    setSelectedEmployee(employee);
    setDepartmentHistoryDialogOpen(true);
    handleMenuClose();
  };

  const handleViewRoleHistory = (employee) => {
    setSelectedEmployee(employee);
    setRoleHistoryDialogOpen(true);
    handleMenuClose();
  };

  const handleAddEmployee = () => {
    setEmployeeForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: ROLES.EMPLOYEE,
      department: '',
      hireDate: '',
      qualifications: [],
      availability: {
        monday: { available: false },
        tuesday: { available: false },
        wednesday: { available: false },
        thursday: { available: false },
        friday: { available: false },
        saturday: { available: false },
        sunday: { available: false }
      },
      hourly_rate: '',
      max_hours_per_week: ''
    });
    setDialogOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setEmployeeForm({
      id: employee.id,
      firstName: employee.firstName || employee.first_name,
      lastName: employee.lastName || employee.last_name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      department: employee.department,
      hireDate: employee.hireDate || employee.hire_date,
      qualifications: employee.qualifications || [],
      availability: employee.availability || {
        monday: { available: false },
        tuesday: { available: false },
        wednesday: { available: false },
        thursday: { available: false },
        friday: { available: false },
        saturday: { available: false },
        sunday: { available: false }
      },
      hourly_rate: employee.hourly_rate || '',
      max_hours_per_week: employee.max_hours_per_week || ''
    });
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteEmployee = async (employeeId) => {
    try {
      await api.delete(`/api/employees/${employeeId}`);
      setNotification({ type: 'success', message: 'Employee deleted successfully' });
      loadEmployees();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
    handleMenuClose();
  };

  const validateExtendedFields = () => {
    const errors = [];

    // Validate qualifications (max 20 items)
    if (employeeForm.qualifications.length > 20) {
      errors.push('Maximum 20 qualifications allowed');
    }

    // Validate hourly_rate (0-1000)
    if (employeeForm.hourly_rate && (parseFloat(employeeForm.hourly_rate) < 0 || parseFloat(employeeForm.hourly_rate) > 1000)) {
      errors.push('Hourly rate must be between 0 and 1000');
    }

    // Validate max_hours_per_week (1-168)
    if (employeeForm.max_hours_per_week && (parseInt(employeeForm.max_hours_per_week) < 1 || parseInt(employeeForm.max_hours_per_week) > 168)) {
      errors.push('Max hours per week must be between 1 and 168');
    }

    return errors;
  };

  const handleFormSubmit = async () => {
    try {
      console.log('[EmployeesPage] Submitting employee:', employeeForm);

      // Validate extended fields
      const validationErrors = validateExtendedFields();
      if (validationErrors.length > 0) {
        setNotification({ type: 'error', message: validationErrors.join(', ') });
        return;
      }

      // Prepare payload with extended fields
      const payload = {
        ...employeeForm,
        hourly_rate: employeeForm.hourly_rate ? parseFloat(employeeForm.hourly_rate) : null,
        max_hours_per_week: employeeForm.max_hours_per_week ? parseInt(employeeForm.max_hours_per_week) : null
      };

      if (employeeForm.id) {
        // Update existing employee
        await api.patch(`/api/employees/${employeeForm.id}`, payload);
        setNotification({ type: 'success', message: 'Employee updated successfully' });
      } else {
        // Add new employee
        await api.post('/api/employees', payload);
        setNotification({ type: 'success', message: 'Employee created successfully' });
      }
      setDialogOpen(false);
      loadEmployees();
    } catch (error) {
      console.error('[EmployeesPage] Error submitting employee:', error);
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleManageStatus = (employee) => {
    setSelectedEmployee(employee);
    setStatusDialogOpen(true);
    handleMenuClose();
  };

  const handleStatusUpdateSuccess = () => {
    setNotification({ type: 'success', message: 'Account status updated successfully' });
    loadEmployees();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      default: return 'primary';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'locked': return 'error';
      case 'inactive': return 'default';
      case 'verified': return 'primary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'locked': return <Lock fontSize="small" />;
      case 'inactive': return <Warning fontSize="small" />;
      case 'verified': return <Info fontSize="small" />;
      default: return null;
    }
  };

  const formatAvailabilitySummary = (availability) => {
    if (!availability) return 'Not set';

    const availableDays = Object.entries(availability)
      .filter(([_, dayData]) => dayData.available)
      .map(([day, dayData]) => {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1, 3);
        if (dayData.start && dayData.end) {
          return `${dayName} ${dayData.start}-${dayData.end}`;
        }
        return dayName;
      });

    if (availableDays.length === 0) return 'Not available';
    if (availableDays.length <= 2) return availableDays.join(', ');
    return `${availableDays.length} days`;
  };

  const handleQualificationAdd = (qualification) => {
    if (!qualification.trim()) return;
    if (employeeForm.qualifications.length >= 20) {
      setNotification({ type: 'warning', message: 'Maximum 20 qualifications allowed' });
      return;
    }
    setEmployeeForm(prev => ({
      ...prev,
      qualifications: [...prev.qualifications, qualification.trim()]
    }));
  };

  const handleQualificationRemove = (index) => {
    setEmployeeForm(prev => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, i) => i !== index)
    }));
  };

  const handleAvailabilityChange = (day, field, value) => {
    setEmployeeForm(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value
        }
      }
    }));
  };

  // Get unique departments and roles for filters
  const departments = [...new Set(employees.map(emp => emp.department?.name || emp.department).filter(Boolean))];
  const roles = [...new Set(employees.map(emp => emp.role).filter(Boolean))];

  // Apply filters to employees
  let filteredEmployees = filterEmployees(employees, searchTerm, selectedDepartments, selectedRoles);

  // Apply status filter
  if (statusFilter !== 'all') {
    filteredEmployees = filteredEmployees.filter(emp => {
      const empStatus = emp.status || (emp.isActive !== false && emp.is_active !== false ? 'active' : 'inactive');
      return empStatus === statusFilter;
    });
  }

  const activeEmployees = filteredEmployees.filter(emp => emp.status === 'active' || emp.isActive !== false || emp.is_active !== false);
  const inactiveEmployees = filteredEmployees.filter(emp => emp.status === 'inactive' || emp.isActive === false || emp.is_active === false);

  // Handlers for filters
  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleDepartmentChange = (event) => {
    const {
      target: { value }
    } = event;
    setSelectedDepartments(typeof value === 'string' ? value.split(',') : value);
  };

  const handleRoleChange = (event) => {
    const {
      target: { value }
    } = event;
    setSelectedRoles(typeof value === 'string' ? value.split(',') : value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Employee Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage your team members and their information
            </Typography>
          </Box>
          {user?.role !== 'employee' && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddEmployee}
              size="large"
            >
              Add Employee
            </Button>
          )}
        </Box>
      </motion.div>

      {/* Search and Filters */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name or email..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="locked">Locked</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="verified">Verified</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="department-filter-label">Departments</InputLabel>
              <Select
                labelId="department-filter-label"
                multiple
                value={selectedDepartments}
                onChange={handleDepartmentChange}
                input={<OutlinedInput label="Departments" />}
                renderValue={(selected) =>
                  selected.length === 0
                    ? 'All Departments'
                    : `${selected.length} selected`
                }
              >
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    <Checkbox checked={selectedDepartments.indexOf(dept) > -1} />
                    <ListItemText primary={dept} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="role-filter-label">Roles</InputLabel>
              <Select
                labelId="role-filter-label"
                multiple
                value={selectedRoles}
                onChange={handleRoleChange}
                input={<OutlinedInput label="Roles" />}
                renderValue={(selected) =>
                  selected.length === 0
                    ? 'All Roles'
                    : `${selected.length} selected`
                }
              >
                {roles.map((role) => (
                  <MenuItem key={role} value={role}>
                    <Checkbox checked={selectedRoles.indexOf(role) > -1} />
                    <ListItemText primary={role.charAt(0).toUpperCase() + role.slice(1)} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`Active (${activeEmployees.length})`} />
          <Tab label={`Inactive (${inactiveEmployees.length})`} />
        </Tabs>
      </Box>

      {/* Employee Cards with Virtual Scrolling */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {(tabValue === 0 ? activeEmployees : inactiveEmployees).length === 0 ? (
          <Alert severity="info">
            No {tabValue === 0 ? 'active' : 'inactive'} employees found.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {/* Note: VirtualList component ready for large datasets (1000+ employees) */}
            {/* Current implementation uses Grid for consistent layout */}
            {/* To enable virtual scrolling for very large lists (1000+), wrap in VirtualList */}
            {(tabValue === 0 ? activeEmployees : inactiveEmployees).map((employee, index) => {
              const firstName = employee.firstName || employee.first_name || '';
              const lastName = employee.lastName || employee.last_name || '';
              const hireDate = employee.hireDate || employee.hire_date;

              return (
                <Grid item xs={12} sm={6} lg={4} key={employee.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        }
                      }}
                    >
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                              {firstName?.[0]}{lastName?.[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {firstName} {lastName}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {employee.department?.name || employee.department || 'No Department'}
                              </Typography>
                            </Box>
                          </Box>
                          {user?.role !== 'employee' && (
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, employee)}
                            >
                              <MoreVert />
                            </IconButton>
                          )}
                        </Box>

                        <Box mb={2}>
                          <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                            <Chip
                              label={employee.role}
                              color={getRoleColor(employee.role)}
                              size="small"
                            />
                            <Chip
                              label={employee.status || (employee.isActive !== false && employee.is_active !== false ? 'active' : 'inactive')}
                              color={getStatusColor(employee.status || (employee.isActive !== false && employee.is_active !== false ? 'active' : 'inactive'))}
                              size="small"
                              icon={getStatusIcon(employee.status)}
                            />
                          </Box>
                        </Box>

                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Email fontSize="small" color="action" />
                            <Typography variant="body2">{employee.email}</Typography>
                          </Box>
                          {employee.phone && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Phone fontSize="small" color="action" />
                              <Typography variant="body2">{employee.phone}</Typography>
                            </Box>
                          )}
                          {hireDate && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Badge fontSize="small" color="action" />
                              <Typography variant="body2">
                                Hired: {new Date(hireDate).toLocaleDateString()}
                              </Typography>
                            </Box>
                          )}
                          {employee.hourly_rate && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <AttachMoney fontSize="small" color="action" />
                              <Typography variant="body2">
                                ${parseFloat(employee.hourly_rate).toFixed(2)}/hr
                              </Typography>
                            </Box>
                          )}
                          {employee.max_hours_per_week && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Schedule fontSize="small" color="action" />
                              <Typography variant="body2">
                                Max {employee.max_hours_per_week} hrs/week
                              </Typography>
                            </Box>
                          )}
                          {employee.availability && (
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <AccessTime fontSize="small" color="action" />
                              <Typography variant="body2">
                                {formatAvailabilitySummary(employee.availability)}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Qualifications */}
                        {employee.qualifications && employee.qualifications.length > 0 && (
                          <Box mt={2}>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <School fontSize="small" color="action" />
                              <Typography variant="caption" color="textSecondary">
                                Qualifications:
                              </Typography>
                            </Box>
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {employee.qualifications.slice(0, 3).map((qual, idx) => (
                                <Chip
                                  key={idx}
                                  label={qual}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              ))}
                              {employee.qualifications.length > 3 && (
                                <Chip
                                  label={`+${employee.qualifications.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              );
            })}
          </Grid>
        )}
      </motion.div>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {/* Basic Actions */}
        <MenuItem onClick={() => handleEditEmployee(selectedEmployee)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit Employee
        </MenuItem>

        {/* Admin-Only Actions */}
        {user?.role === 'admin' && (
          <>
            <MenuItem onClick={() => handleManageStatus(selectedEmployee)}>
              <ManageAccounts fontSize="small" sx={{ mr: 1 }} />
              Manage Status
            </MenuItem>
            <MenuItem onClick={() => handleResetPassword(selectedEmployee)}>
              <LockReset fontSize="small" sx={{ mr: 1 }} />
              Reset Password
            </MenuItem>
          </>
        )}

        {/* Self or Admin */}
        {(user?.role === 'admin' || selectedEmployee?.id === user?.id) && (
          <MenuItem onClick={() => handleChangePassword(selectedEmployee)}>
            <VpnKey fontSize="small" sx={{ mr: 1 }} />
            Change Password
          </MenuItem>
        )}

        <Divider />

        {/* History Views */}
        <MenuItem onClick={() => handleViewRoleHistory(selectedEmployee)}>
          <History fontSize="small" sx={{ mr: 1 }} />
          Role History
        </MenuItem>
        <MenuItem onClick={() => handleViewStatusHistory(selectedEmployee)}>
          <Timeline fontSize="small" sx={{ mr: 1 }} />
          Status History
        </MenuItem>
        <MenuItem onClick={() => handleViewDepartmentHistory(selectedEmployee)}>
          <Assessment fontSize="small" sx={{ mr: 1 }} />
          Department History
        </MenuItem>

        <Divider />

        {/* Destructive Action */}
        {user?.role === 'admin' && (
          <MenuItem onClick={() => handleDeleteEmployee(selectedEmployee?.id)} sx={{ color: 'error.main' }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete Employee
          </MenuItem>
        )}
      </Menu>

      {/* Add/Edit Employee Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {employeeForm.id ? 'Edit Employee' : 'Add New Employee'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={employeeForm.firstName}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    firstName: e.target.value
                  }))}
                  required
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={employeeForm.lastName}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    lastName: e.target.value
                  }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  required
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    phone: e.target.value
                  }))}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={employeeForm.role}
                    label="Role"
                    onChange={(e) => setEmployeeForm(prev => ({
                      ...prev,
                      role: e.target.value
                    }))}
                  >
                    <MenuItem value={ROLES.EMPLOYEE}>Employee</MenuItem>
                    <MenuItem value={ROLES.MANAGER}>Manager</MenuItem>
                    <MenuItem value={ROLES.ADMIN}>Administrator</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <DepartmentSelector
                  value={employeeForm.department_id}
                  onChange={(value) => setEmployeeForm(prev => ({
                    ...prev,
                    department_id: value
                  }))}
                  label="Department"
                  placeholder="Select department (optional)"
                  required={false}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Hire Date"
                  type="date"
                  value={employeeForm.hireDate}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    hireDate: e.target.value
                  }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Extended Fields Section */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                  Extended Information
                </Typography>
              </Grid>

              {/* Hourly Rate */}
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Hourly Rate ($)"
                  type="number"
                  value={employeeForm.hourly_rate}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    hourly_rate: e.target.value
                  }))}
                  inputProps={{ min: 0, max: 1000, step: 0.01 }}
                  helperText="0-1000"
                />
              </Grid>

              {/* Max Hours Per Week */}
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Max Hours Per Week"
                  type="number"
                  value={employeeForm.max_hours_per_week}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    max_hours_per_week: e.target.value
                  }))}
                  inputProps={{ min: 1, max: 168 }}
                  helperText="1-168"
                />
              </Grid>

              {/* Qualifications */}
              <Grid item xs={12}>
                <Box>
                  <Box display="flex" gap={1} mb={1}>
                    <TextField
                      fullWidth
                      label="Add Qualification"
                      value={newQualification}
                      onChange={(e) => setNewQualification(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQualificationAdd(newQualification);
                          setNewQualification('');
                        }
                      }}
                      helperText={`${employeeForm.qualifications.length}/20 qualifications`}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        handleQualificationAdd(newQualification);
                        setNewQualification('');
                      }}
                      disabled={!newQualification.trim() || employeeForm.qualifications.length >= 20}
                      sx={{ minWidth: 100 }}
                    >
                      Add
                    </Button>
                  </Box>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {employeeForm.qualifications.map((qual, idx) => (
                      <Chip
                        key={idx}
                        label={qual}
                        onDelete={() => handleQualificationRemove(idx)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>

              {/* Availability */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Weekly Availability
                </Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <Box key={day} display="flex" alignItems="center" gap={1} mb={1}>
                      <Checkbox
                        checked={employeeForm.availability[day]?.available || false}
                        onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        size="small"
                      />
                      <Typography variant="body2" sx={{ width: 80 }}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Typography>
                      {employeeForm.availability[day]?.available && (
                        <>
                          <TextField
                            type="time"
                            label="Start"
                            size="small"
                            value={employeeForm.availability[day]?.start || ''}
                            onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 120 }}
                          />
                          <TextField
                            type="time"
                            label="End"
                            size="small"
                            value={employeeForm.availability[day]?.end || ''}
                            onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 120 }}
                          />
                        </>
                      )}
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            {employeeForm.id ? 'Update' : 'Add'} Employee
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Status Dialog */}
      <AccountStatusDialog
        open={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onSuccess={handleStatusUpdateSuccess}
      />

      {/* Password Reset Dialog */}
      <PasswordResetDialog
        open={passwordResetDialogOpen}
        onClose={() => {
          setPasswordResetDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onSuccess={handlePasswordSuccess}
      />

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordDialogOpen}
        onClose={() => {
          setChangePasswordDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        isSelf={selectedEmployee?.id === user?.id}
        onSuccess={handlePasswordSuccess}
      />

      {/* Account Status History Dialog */}
      <AccountStatusHistoryDialog
        open={statusHistoryDialogOpen}
        onClose={() => {
          setStatusHistoryDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employeeId={selectedEmployee?.id}
        employeeName={selectedEmployee ? `${selectedEmployee.firstName || selectedEmployee.first_name} ${selectedEmployee.lastName || selectedEmployee.last_name}` : ''}
      />

      {/* Department History Dialog */}
      <DepartmentHistoryDialog
        open={departmentHistoryDialogOpen}
        onClose={() => {
          setDepartmentHistoryDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employeeId={selectedEmployee?.id}
        employeeName={selectedEmployee ? `${selectedEmployee.firstName || selectedEmployee.first_name} ${selectedEmployee.lastName || selectedEmployee.last_name}` : ''}
      />

      {/* Role History Dialog */}
      <RoleHistoryDialog
        open={roleHistoryDialogOpen}
        onClose={() => {
          setRoleHistoryDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employeeId={selectedEmployee?.id}
        employeeName={selectedEmployee ? `${selectedEmployee.firstName || selectedEmployee.first_name} ${selectedEmployee.lastName || selectedEmployee.last_name}` : ''}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
      >
        {notification && (
          <Alert onClose={() => setNotification(null)} severity={notification.type}>
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default EmployeesPage;
