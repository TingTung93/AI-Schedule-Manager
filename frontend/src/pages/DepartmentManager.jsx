import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
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
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Paper,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  ExpandMore,
  ChevronRight,
  Business,
  People,
  Schedule,
  Warning,
  Search,
  AccountTree,
  ViewList,
  Settings as SettingsIcon,
  CalendarToday
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import api, { getErrorMessage } from '../services/api';

const DepartmentManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(0); // 0: Tree, 1: List
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterParent, setFilterParent] = useState('');
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
    parent_id: null,
    settings: {},
    active: true
  });
  const [departmentStats, setDepartmentStats] = useState(null);
  const [dependencies, setDependencies] = useState(null);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/departments', {
        params: { page: 1, size: 100 }
      });
      console.log('[DepartmentManager] API Response:', response.data);
      console.log('[DepartmentManager] Departments loaded:', response.data.items?.length || 0);
      setDepartments(response.data.items || []);
      // Auto-expand root nodes
      const rootNodes = (response.data.items || [])
        .filter(dept => !dept.parentId)
        .map(dept => dept.id);
      setExpandedNodes(new Set(rootNodes));
    } catch (error) {
      console.error('[DepartmentManager] Error loading departments:', error);
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentStats = async (departmentId) => {
    try {
      const [staffResponse, shiftsResponse] = await Promise.all([
        api.get(`/api/departments/${departmentId}/staff`, { params: { page: 1, size: 100 } }),
        api.get(`/api/departments/${departmentId}/shifts`, { params: { page: 1, size: 100 } })
      ]);

      setDepartmentStats({
        staff: staffResponse.data.items || [],
        staffCount: staffResponse.data.total || 0,
        shifts: shiftsResponse.data.items || [],
        shiftsCount: shiftsResponse.data.total || 0
      });
    } catch (error) {
      console.error('Error loading department stats:', error);
    }
  };

  const buildDepartmentTree = () => {
    const deptMap = {};
    const rootDepts = [];

    // Filter by search query
    let filteredDepts = departments;
    if (searchQuery) {
      filteredDepts = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Create department map
    filteredDepts.forEach(dept => {
      deptMap[dept.id] = { ...dept, children: [] };
    });

    // Build tree structure
    filteredDepts.forEach(dept => {
      if (dept.parentId && deptMap[dept.parentId]) {
        deptMap[dept.parentId].children.push(deptMap[dept.id]);
      } else if (!dept.parentId) {
        rootDepts.push(deptMap[dept.id]);
      }
    });

    return rootDepts;
  };

  const toggleExpand = (departmentId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const handleMenuOpen = (event, department) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedDepartment(department);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAddDepartment = (parentDept = null) => {
    setDepartmentForm({
      name: '',
      description: '',
      parent_id: parentDept?.id || null,
      settings: {},
      active: true
    });
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleEditDepartment = (department) => {
    setDepartmentForm({
      id: department.id,
      name: department.name,
      description: department.description || '',
      parent_id: department.parent_id,
      settings: department.settings || {},
      active: department.active !== false
    });
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleViewDetails = async (department) => {
    setSelectedDepartment(department);
    setDetailsOpen(true);
    await loadDepartmentStats(department.id);
    handleMenuClose();
  };

  const handleDeleteClick = (department) => {
    setSelectedDepartment(department);
    setDeleteDialogOpen(true);
    setDependencies(null);
    handleMenuClose();
  };

  const handleDeleteDepartment = async (force = false) => {
    try {
      await api.delete(`/api/departments/${selectedDepartment.id}`, {
        params: { force }
      });
      setNotification({ type: 'success', message: 'Department deleted successfully' });
      setDeleteDialogOpen(false);
      setDependencies(null);
      loadDepartments();
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.detail?.dependencies) {
        setDependencies(errorData.detail.dependencies);
      } else {
        setNotification({ type: 'error', message: getErrorMessage(error) });
        setDeleteDialogOpen(false);
      }
    }
  };

  const handleFormSubmit = async () => {
    try {
      if (departmentForm.id) {
        await api.patch(`/api/departments/${departmentForm.id}`, departmentForm);
        setNotification({ type: 'success', message: 'Department updated successfully' });
      } else {
        await api.post('/api/departments', departmentForm);
        setNotification({ type: 'success', message: 'Department created successfully' });
      }
      setDialogOpen(false);
      loadDepartments();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const renderDepartmentNode = (dept, level = 0) => {
    const isExpanded = expandedNodes.has(dept.id);
    const hasChildren = dept.children && dept.children.length > 0;
    const indentation = level * 32;

    return (
      <Box key={dept.id}>
        <Paper
          elevation={1}
          sx={{
            mb: 1,
            ml: `${indentation}px`,
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: 3,
              bgcolor: 'action.hover'
            }
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            p={1.5}
            sx={{ cursor: 'pointer' }}
            onClick={() => hasChildren && toggleExpand(dept.id)}
          >
            <Box mr={1}>
              {hasChildren ? (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleExpand(dept.id); }}>
                  {isExpanded ? <ExpandMore /> : <ChevronRight />}
                </IconButton>
              ) : (
                <Box width={40} />
              )}
            </Box>

            <Business color="primary" sx={{ mr: 2 }} />

            <Box flexGrow={1}>
              <Typography variant="h6" fontWeight="bold">
                {dept.name}
              </Typography>
              {dept.description && (
                <Typography variant="body2" color="textSecondary">
                  {dept.description}
                </Typography>
              )}
            </Box>

            <Box display="flex" gap={1} mr={2}>
              <Chip
                size="small"
                label={dept.active !== false ? 'Active' : 'Inactive'}
                color={dept.active !== false ? 'success' : 'default'}
              />
              {level > 0 && (
                <Chip
                  size="small"
                  label={`Level ${level + 1}`}
                  variant="outlined"
                />
              )}
            </Box>

            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, dept)}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </Paper>

        {hasChildren && isExpanded && (
          <Collapse in={isExpanded}>
            <Box>
              {dept.children.map(child => renderDepartmentNode(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  const renderListView = () => {
    let filteredDepts = departments;
    if (searchQuery) {
      filteredDepts = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filterParent) {
      if (filterParent === 'root') {
        filteredDepts = filteredDepts.filter(dept => !dept.parent_id);
      } else {
        filteredDepts = filteredDepts.filter(dept => dept.parent_id === parseInt(filterParent));
      }
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Parent</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDepts.map(dept => {
              const parent = departments.find(d => d.id === dept.parent_id);
              return (
                <TableRow
                  key={dept.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewDetails(dept)}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Business color="primary" />
                      <Typography fontWeight="medium">{dept.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{dept.description || '-'}</TableCell>
                  <TableCell>
                    {parent ? (
                      <Chip label={parent.name} size="small" variant="outlined" />
                    ) : (
                      <Chip label="Root" size="small" color="primary" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={dept.active !== false ? 'Active' : 'Inactive'}
                      color={dept.active !== false ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, dept); }}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  const departmentTree = buildDepartmentTree();

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
              Department Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Organize your teams with hierarchical department structure
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleAddDepartment()}
            size="large"
          >
            Add Department
          </Button>
        </Box>
      </motion.div>

      {/* View Controls */}
      <Paper sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          {viewMode === 1 && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Parent</InputLabel>
                <Select
                  value={filterParent}
                  label="Filter by Parent"
                  onChange={(e) => setFilterParent(e.target.value)}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  <MenuItem value="root">Root Only</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tabs value={viewMode} onChange={(e, val) => setViewMode(val)}>
              <Tab icon={<AccountTree />} label="Tree View" />
              <Tab icon={<ViewList />} label="List View" />
            </Tabs>
          </Grid>
        </Grid>
      </Paper>

      {/* Department Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {departments.length === 0 ? (
          <Alert severity="info">
            No departments found. Create your first department to get started.
          </Alert>
        ) : viewMode === 0 ? (
          <Box>
            {departmentTree.map(dept => renderDepartmentNode(dept))}
          </Box>
        ) : (
          renderListView()
        )}
      </motion.div>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleViewDetails(selectedDepartment)}>
          <Business fontSize="small" sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => {
          handleMenuClose();
          navigate(`/departments/${selectedDepartment.id}/schedules`);
        }}>
          <CalendarToday fontSize="small" sx={{ mr: 1 }} />
          Manage Schedules
        </MenuItem>
        <MenuItem onClick={() => handleAddDepartment(selectedDepartment)}>
          <Add fontSize="small" sx={{ mr: 1 }} />
          Add Sub-department
        </MenuItem>
        <MenuItem onClick={() => handleEditDepartment(selectedDepartment)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteClick(selectedDepartment)} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {departmentForm.id ? 'Edit Department' : 'Add New Department'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Department Name"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={departmentForm.description}
                  onChange={(e) => setDepartmentForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Parent Department</InputLabel>
                  <Select
                    value={departmentForm.parent_id || ''}
                    label="Parent Department"
                    onChange={(e) => setDepartmentForm(prev => ({
                      ...prev,
                      parent_id: e.target.value || null
                    }))}
                  >
                    <MenuItem value="">
                      <em>None (Root Department)</em>
                    </MenuItem>
                    {departments
                      .filter(dept => dept.id !== departmentForm.id)
                      .map(dept => (
                        <MenuItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={departmentForm.active}
                      onChange={(e) => setDepartmentForm(prev => ({
                        ...prev,
                        active: e.target.checked
                      }))}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            {departmentForm.id ? 'Update' : 'Create'} Department
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Warning color="error" />
            Delete Department
          </Box>
        </DialogTitle>
        <DialogContent>
          {dependencies ? (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This department has dependencies that will be affected:
              </Alert>
              <List dense>
                {dependencies.employees > 0 && (
                  <ListItem>
                    <ListItemIcon><People /></ListItemIcon>
                    <ListItemText primary={`${dependencies.employees} employee(s)`} />
                  </ListItem>
                )}
                {dependencies.shifts > 0 && (
                  <ListItem>
                    <ListItemIcon><Schedule /></ListItemIcon>
                    <ListItemText primary={`${dependencies.shifts} shift(s)`} />
                  </ListItem>
                )}
                {dependencies.children > 0 && (
                  <ListItem>
                    <ListItemIcon><Business /></ListItemIcon>
                    <ListItemText primary={`${dependencies.children} sub-department(s)`} />
                  </ListItem>
                )}
              </List>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                Force delete will remove the department and set all references to null. Continue?
              </Typography>
            </Box>
          ) : (
            <Typography>
              Are you sure you want to delete <strong>{selectedDepartment?.name}</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setDependencies(null); }}>
            Cancel
          </Button>
          <Button
            onClick={() => handleDeleteDepartment(!!dependencies)}
            variant="contained"
            color="error"
          >
            {dependencies ? 'Force Delete' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Business color="primary" />
            <Box>
              <Typography variant="h6">{selectedDepartment?.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedDepartment?.description || 'No description'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Statistics</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <People color="primary" />
                        <Box>
                          <Typography variant="h4">{departmentStats?.staffCount || 0}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Staff Members
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Schedule color="primary" />
                        <Box>
                          <Typography variant="h4">{departmentStats?.shiftsCount || 0}</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Active Shifts
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {departmentStats?.staff && departmentStats.staff.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>Staff Members</Typography>
                <List dense>
                  {departmentStats.staff.slice(0, 5).map(emp => (
                    <ListItem key={emp.id}>
                      <ListItemIcon><People /></ListItemIcon>
                      <ListItemText
                        primary={`${emp.first_name || emp.firstName} ${emp.last_name || emp.lastName}`}
                        secondary={emp.role}
                      />
                    </ListItem>
                  ))}
                  {departmentStats.staffCount > 5 && (
                    <ListItem>
                      <ListItemText
                        primary={`... and ${departmentStats.staffCount - 5} more`}
                        sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          <Button onClick={() => { setDetailsOpen(false); handleEditDepartment(selectedDepartment); }} variant="contained">
            Edit Department
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
          <Alert onClose={() => setNotification(null)} severity={notification.type}>
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default DepartmentManager;
