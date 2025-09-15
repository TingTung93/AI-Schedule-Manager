import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Person,
  Email,
  Phone,
  Badge
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utils/routeConfig';

const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: ROLES.EMPLOYEE,
    department: '',
    hireDate: ''
  });

  useEffect(() => {
    // Simulate loading employees
    setEmployees([
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        phone: '+1-555-0123',
        role: 'manager',
        department: 'Operations',
        hireDate: '2023-01-15',
        status: 'active',
        avatar: null
      },
      {
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        phone: '+1-555-0124',
        role: 'employee',
        department: 'Customer Service',
        hireDate: '2023-03-20',
        status: 'active',
        avatar: null
      },
      {
        id: 3,
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@company.com',
        phone: '+1-555-0125',
        role: 'employee',
        department: 'Operations',
        hireDate: '2023-02-10',
        status: 'inactive',
        avatar: null
      }
    ]);
  }, []);

  const handleMenuOpen = (event, employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmployee(null);
  };

  const handleAddEmployee = () => {
    setEmployeeForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: ROLES.EMPLOYEE,
      department: '',
      hireDate: ''
    });
    setDialogOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setEmployeeForm(employee);
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteEmployee = (employeeId) => {
    setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    handleMenuClose();
  };

  const handleFormSubmit = () => {
    if (employeeForm.id) {
      // Update existing employee
      setEmployees(prev => prev.map(emp =>
        emp.id === employeeForm.id ? employeeForm : emp
      ));
    } else {
      // Add new employee
      const newEmployee = {
        ...employeeForm,
        id: Math.max(...employees.map(e => e.id), 0) + 1,
        status: 'active'
      };
      setEmployees(prev => [...prev, newEmployee]);
    }
    setDialogOpen(false);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      default: return 'primary';
    }
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'default';
  };

  const activeEmployees = employees.filter(emp => emp.status === 'active');
  const inactiveEmployees = employees.filter(emp => emp.status === 'inactive');

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

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`Active (${activeEmployees.length})`} />
          <Tab label={`Inactive (${inactiveEmployees.length})`} />
        </Tabs>
      </Box>

      {/* Employee Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Grid container spacing={3}>
          {(tabValue === 0 ? activeEmployees : inactiveEmployees).map((employee, index) => (
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
                          {employee.firstName[0]}{employee.lastName[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight="bold">
                            {employee.firstName} {employee.lastName}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {employee.department}
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
                      <Box display="flex" gap={1} mb={1}>
                        <Chip
                          label={employee.role}
                          color={getRoleColor(employee.role)}
                          size="small"
                        />
                        <Chip
                          label={employee.status}
                          color={getStatusColor(employee.status)}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Email fontSize="small" color="action" />
                        <Typography variant="body2">{employee.email}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Phone fontSize="small" color="action" />
                        <Typography variant="body2">{employee.phone}</Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Badge fontSize="small" color="action" />
                        <Typography variant="body2">
                          Hired: {new Date(employee.hireDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditEmployee(selectedEmployee)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleDeleteEmployee(selectedEmployee?.id)}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
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
                <TextField
                  fullWidth
                  label="Department"
                  value={employeeForm.department}
                  onChange={(e) => setEmployeeForm(prev => ({
                    ...prev,
                    department: e.target.value
                  }))}
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
    </Box>
  );
};

export default EmployeesPage;