import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Collapse
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Security,
  People,
  ExpandMore,
  ExpandLess,
  Lock,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import api, { getErrorMessage } from '../services/api';

// Permission categories based on backend models
const PERMISSION_CATEGORIES = {
  user: {
    name: 'User Management',
    color: 'primary',
    permissions: [
      { name: 'user.read', label: 'View Users', description: 'Read user information' },
      { name: 'user.write', label: 'Edit Users', description: 'Create and update users' },
      { name: 'user.delete', label: 'Delete Users', description: 'Delete users' },
      { name: 'user.manage', label: 'Manage Users', description: 'Full user management' }
    ]
  },
  schedule: {
    name: 'Schedule Management',
    color: 'success',
    permissions: [
      { name: 'schedule.read', label: 'View Schedules', description: 'View schedules' },
      { name: 'schedule.write', label: 'Edit Schedules', description: 'Create and update schedules' },
      { name: 'schedule.delete', label: 'Delete Schedules', description: 'Delete schedules' },
      { name: 'schedule.manage', label: 'Manage Schedules', description: 'Full schedule management' }
    ]
  },
  system: {
    name: 'System Administration',
    color: 'error',
    permissions: [
      { name: 'system.admin', label: 'System Admin', description: 'System administration' },
      { name: 'system.audit', label: 'View Audit Logs', description: 'View audit logs' },
      { name: 'system.config', label: 'System Config', description: 'System configuration' }
    ]
  }
};

// Built-in roles that cannot be deleted
const BUILT_IN_ROLES = ['admin', 'manager', 'user', 'guest'];

const RoleManager = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['user', 'schedule', 'system']);

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: []
  });

  // Load roles and users
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Try to load roles from backend API
      // Note: These endpoints may need to be created
      try {
        const rolesResponse = await api.get('/api/roles');
        setRoles(rolesResponse.data.roles || []);
      } catch (error) {
        // Fallback to mock data if API not available
        console.warn('Roles API not available, using mock data');
        setRoles([
          {
            id: 1,
            name: 'admin',
            description: 'System administrator with full access',
            permissions: ['user.manage', 'schedule.manage', 'system.admin', 'system.audit', 'system.config'],
            userCount: 2,
            isBuiltIn: true
          },
          {
            id: 2,
            name: 'manager',
            description: 'Manager with schedule and user management',
            permissions: ['user.read', 'user.write', 'schedule.manage'],
            userCount: 5,
            isBuiltIn: true
          },
          {
            id: 3,
            name: 'user',
            description: 'Regular user with basic access',
            permissions: ['user.read', 'schedule.read', 'schedule.write'],
            userCount: 15,
            isBuiltIn: true
          }
        ]);
      }

      // Load users for role assignment
      try {
        const usersResponse = await api.get('/api/employees');
        setUsers(usersResponse.data.employees || []);
      } catch (error) {
        console.warn('Users API error:', error);
      }

    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event, role) => {
    setAnchorEl(event.currentTarget);
    setSelectedRole(role);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRole(null);
  };

  const handleAddRole = () => {
    setRoleForm({
      name: '',
      description: '',
      permissions: []
    });
    setRoleDialogOpen(true);
  };

  const handleEditRole = (role) => {
    setRoleForm({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions || []
    });
    setRoleDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (BUILT_IN_ROLES.includes(roleName)) {
      setNotification({
        type: 'error',
        message: 'Cannot delete built-in system roles'
      });
      handleMenuClose();
      return;
    }

    if (!window.confirm('Are you sure you want to delete this role?')) {
      handleMenuClose();
      return;
    }

    try {
      await api.delete(`/api/roles/${roleId}`);
      setNotification({ type: 'success', message: 'Role deleted successfully' });
      loadData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
    handleMenuClose();
  };

  const handlePermissionToggle = (permissionName) => {
    setRoleForm(prev => {
      const permissions = prev.permissions.includes(permissionName)
        ? prev.permissions.filter(p => p !== permissionName)
        : [...prev.permissions, permissionName];
      return { ...prev, permissions };
    });
  };

  const handleCategoryToggle = (category) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleFormSubmit = async () => {
    try {
      if (!roleForm.name || !roleForm.description) {
        setNotification({
          type: 'error',
          message: 'Role name and description are required'
        });
        return;
      }

      if (roleForm.id) {
        // Update existing role
        await api.patch(`/api/roles/${roleForm.id}`, roleForm);
        setNotification({ type: 'success', message: 'Role updated successfully' });
      } else {
        // Create new role
        await api.post('/api/roles', roleForm);
        setNotification({ type: 'success', message: 'Role created successfully' });
      }

      setRoleDialogOpen(false);
      loadData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleAssignRole = (role) => {
    setSelectedRole(role);
    setAssignDialogOpen(true);
    handleMenuClose();
  };

  const handleUserRoleToggle = async (userId, roleId, currentlyAssigned) => {
    try {
      if (currentlyAssigned) {
        await api.delete(`/api/roles/${roleId}/users/${userId}`);
        setNotification({ type: 'success', message: 'Role unassigned successfully' });
      } else {
        await api.post(`/api/roles/${roleId}/assign`, { userId });
        setNotification({ type: 'success', message: 'Role assigned successfully' });
      }
      loadData();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const getRoleColor = (roleName) => {
    switch (roleName) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      case 'user': return 'primary';
      case 'guest': return 'default';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  const builtInRoles = roles.filter(r => BUILT_IN_ROLES.includes(r.name));
  const customRoles = roles.filter(r => !BUILT_IN_ROLES.includes(r.name));

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
              Role Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage roles and permissions for your team
            </Typography>
          </Box>
          {user?.role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddRole}
              size="large"
            >
              Create Role
            </Button>
          )}
        </Box>
      </motion.div>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Lock fontSize="small" />
                Built-in Roles ({builtInRoles.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <Security fontSize="small" />
                Custom Roles ({customRoles.length})
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Role Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {(tabValue === 0 ? builtInRoles : customRoles).length === 0 ? (
          <Alert severity="info">
            No {tabValue === 0 ? 'built-in' : 'custom'} roles found.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {(tabValue === 0 ? builtInRoles : customRoles).map((role, index) => (
              <Grid item xs={12} md={6} lg={4} key={role.id}>
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
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="h6" fontWeight="bold">
                              {role.name}
                            </Typography>
                            {BUILT_IN_ROLES.includes(role.name) && (
                              <Tooltip title="System Role">
                                <Lock fontSize="small" color="action" />
                              </Tooltip>
                            )}
                          </Box>
                          <Typography variant="body2" color="textSecondary" mb={2}>
                            {role.description}
                          </Typography>
                        </Box>
                        {user?.role === 'admin' && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, role)}
                          >
                            <MoreVert />
                          </IconButton>
                        )}
                      </Box>

                      <Box mb={2}>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          <Chip
                            label={role.name}
                            color={getRoleColor(role.name)}
                            size="small"
                          />
                          <Chip
                            icon={<CheckCircle fontSize="small" />}
                            label={`${role.permissions?.length || 0} Permissions`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={<People fontSize="small" />}
                            label={`${role.userCount || 0} Users`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Box>
                        <Typography variant="caption" color="textSecondary" display="block" mb={1}>
                          Permissions:
                        </Typography>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {role.permissions?.slice(0, 4).map(perm => (
                            <Chip
                              key={perm}
                              label={perm}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          ))}
                          {role.permissions?.length > 4 && (
                            <Chip
                              label={`+${role.permissions.length - 4} more`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}
      </motion.div>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditRole(selectedRole)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit Permissions
        </MenuItem>
        <MenuItem onClick={() => handleAssignRole(selectedRole)}>
          <People fontSize="small" sx={{ mr: 1 }} />
          Assign to Users
        </MenuItem>
        {!BUILT_IN_ROLES.includes(selectedRole?.name) && (
          <MenuItem onClick={() => handleDeleteRole(selectedRole?.id, selectedRole?.name)}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete Role
          </MenuItem>
        )}
      </Menu>

      {/* Create/Edit Role Dialog */}
      <Dialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {roleForm.id ? `Edit Role: ${roleForm.name}` : 'Create New Role'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role Name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={roleForm.id && BUILT_IN_ROLES.includes(roleForm.name)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  multiline
                  rows={2}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Permissions
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  Select permissions for this role
                </Typography>

                {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                  <Card key={categoryKey} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleCategoryToggle(categoryKey)}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={category.name}
                            color={category.color}
                            size="small"
                          />
                          <Typography variant="body2" color="textSecondary">
                            {roleForm.permissions.filter(p =>
                              category.permissions.some(cp => cp.name === p)
                            ).length} / {category.permissions.length} selected
                          </Typography>
                        </Box>
                        <IconButton size="small">
                          {expandedCategories.includes(categoryKey) ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Box>

                      <Collapse in={expandedCategories.includes(categoryKey)}>
                        <Divider sx={{ my: 2 }} />
                        <FormGroup>
                          {category.permissions.map(permission => (
                            <FormControlLabel
                              key={permission.name}
                              control={
                                <Checkbox
                                  checked={roleForm.permissions.includes(permission.name)}
                                  onChange={() => handlePermissionToggle(permission.name)}
                                />
                              }
                              label={
                                <Box>
                                  <Typography variant="body2" fontWeight={500}>
                                    {permission.label}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {permission.description}
                                  </Typography>
                                </Box>
                              }
                            />
                          ))}
                        </FormGroup>
                      </Collapse>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            {roleForm.id ? 'Update' : 'Create'} Role
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Role: {selectedRole?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {users.length === 0 ? (
              <Alert severity="info">No users available</Alert>
            ) : (
              <FormGroup>
                {users.map(user => {
                  const userRoles = user.roles || [user.role];
                  const hasRole = userRoles.includes(selectedRole?.name);

                  return (
                    <FormControlLabel
                      key={user.id}
                      control={
                        <Checkbox
                          checked={hasRole}
                          onChange={() => handleUserRoleToggle(user.id, selectedRole?.id, hasRole)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {user.firstName || user.first_name} {user.lastName || user.last_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {user.email}
                          </Typography>
                        </Box>
                      }
                    />
                  );
                })}
              </FormGroup>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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

export default RoleManager;
