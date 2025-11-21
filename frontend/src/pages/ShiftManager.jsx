import React, { useState, useEffect } from 'react';
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
  Switch,
  FormControlLabel,
  InputAdornment,
  Tooltip,
  Tabs,
  Tab,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  ContentCopy,
  AccessTime,
  People,
  Business,
  Search,
  FilterList,
  Schedule,
  Brightness3,
  WbSunny,
  Nightlight,
  CheckCircle,
  Cancel,
  SaveAlt,
  PlaylistAdd
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import api, { getErrorMessage } from '../services/api';

// Shift type definitions with icons and colors
const SHIFT_TYPES = {
  morning: { label: 'Morning', icon: <WbSunny />, color: '#FFA726' },
  evening: { label: 'Evening', icon: <Brightness3 />, color: '#42A5F5' },
  night: { label: 'Night', icon: <Nightlight />, color: '#5C6BC0' },
  custom: { label: 'Custom', icon: <Schedule />, color: '#66BB6A' }
};

const ShiftManager = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: Active, 2: Inactive

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state
  const [shiftForm, setShiftForm] = useState({
    name: '',
    shiftType: 'morning',
    startTime: '09:00',
    endTime: '17:00',
    color: '#1976d2',
    abbreviation: '',
    requiredStaff: 1,
    departmentId: '',
    isActive: true
  });

  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    shifts: []
  });

  // Load data on mount
  useEffect(() => {
    loadShifts();
    loadDepartments();
    loadTemplates();
  }, []);

  const loadShifts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/shift-definitions', {
        params: {
          page: 1,
          size: 100,
          sort_by: 'name',
          sort_order: 'asc'
        }
      });
      setShifts(response.data.items || []);
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get('/api/shifts/templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  // Menu handlers
  const handleMenuOpen = (event, shift) => {
    setAnchorEl(event.currentTarget);
    setSelectedShift(shift);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedShift(null);
  };

  // CRUD operations
  const handleAddShift = () => {
    setShiftForm({
      name: '',
      shiftType: 'morning',
      startTime: '09:00',
      endTime: '17:00',
      color: SHIFT_TYPES.morning.color,
      abbreviation: '',
      requiredStaff: 1,
      departmentId: departments[0]?.id || '',
      isActive: true
    });
    setDialogOpen(true);
  };

  const handleEditShift = (shift) => {
    setShiftForm({
      id: shift.id,
      name: shift.name,
      shiftType: shift.shift_type || shift.shiftType,
      startTime: shift.start_time || shift.startTime,
      endTime: shift.end_time || shift.endTime,
      color: shift.color || SHIFT_TYPES[shift.shift_type || shift.shiftType]?.color,
      abbreviation: shift.abbreviation,
      requiredStaff: shift.required_staff || shift.requiredStaff || 1,
      departmentId: shift.department_id || shift.departmentId || '',
      isActive: shift.is_active !== undefined ? shift.is_active : shift.isActive !== false
    });
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDuplicateShift = (shift) => {
    setShiftForm({
      name: `${shift.name} (Copy)`,
      shiftType: shift.shift_type || shift.shiftType,
      startTime: shift.start_time || shift.startTime,
      endTime: shift.end_time || shift.endTime,
      color: shift.color,
      abbreviation: shift.abbreviation + '2',
      requiredStaff: shift.required_staff || shift.requiredStaff || 1,
      departmentId: shift.department_id || shift.departmentId || '',
      isActive: true
    });
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete this shift definition?')) return;

    try {
      await api.delete(`/api/shift-definitions/${shiftId}`);
      setNotification({ type: 'success', message: 'Shift definition deleted successfully' });
      loadShifts();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
    handleMenuClose();
  };

  const handleFormSubmit = async () => {
    // Validation
    if (!shiftForm.name.trim()) {
      setNotification({ type: 'error', message: 'Shift name is required' });
      return;
    }

    if (!shiftForm.abbreviation.trim() || shiftForm.abbreviation.length > 3) {
      setNotification({ type: 'error', message: 'Abbreviation must be 1-3 characters' });
      return;
    }

    if (shiftForm.startTime >= shiftForm.endTime) {
      setNotification({ type: 'error', message: 'Start time must be before end time' });
      return;
    }

    if (shiftForm.requiredStaff < 1) {
      setNotification({ type: 'error', message: 'Required staff must be at least 1' });
      return;
    }

    try {
      const payload = {
        name: shiftForm.name,
        shift_type: shiftForm.shiftType,
        start_time: shiftForm.startTime,
        end_time: shiftForm.endTime,
        color: shiftForm.color,
        abbreviation: shiftForm.abbreviation.toUpperCase(),
        required_staff: parseInt(shiftForm.requiredStaff),
        department_id: shiftForm.departmentId || null,
        is_active: shiftForm.isActive,
        hourly_rate_multiplier: 1.0,
        description: ''
      };

      if (shiftForm.id) {
        await api.patch(`/api/shift-definitions/${shiftForm.id}`, payload);
        setNotification({ type: 'success', message: 'Shift definition updated successfully' });
      } else {
        await api.post('/api/shift-definitions', payload);
        setNotification({ type: 'success', message: 'Shift definition created successfully' });
      }

      setDialogOpen(false);
      loadShifts();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // Template operations
  const handleSaveAsTemplate = () => {
    setTemplateForm({
      name: '',
      description: '',
      shifts: [selectedShift]
    });
    setTemplateDialogOpen(true);
    handleMenuClose();
  };

  const handleSaveTemplate = async () => {
    try {
      await api.post('/api/shifts/templates', {
        name: templateForm.name,
        description: templateForm.description,
        shifts: templateForm.shifts.map(s => s.id)
      });
      setNotification({ type: 'success', message: 'Template saved successfully' });
      setTemplateDialogOpen(false);
      loadTemplates();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleApplyTemplate = async (template) => {
    try {
      await api.post('/api/shifts/bulk', {
        template_id: template.id
      });
      setNotification({ type: 'success', message: 'Template applied successfully' });
      loadShifts();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // Bulk operations
  const handleBulkActivate = async (activate) => {
    const selectedShifts = shifts.filter(s => s.selected);
    if (selectedShifts.length === 0) {
      setNotification({ type: 'warning', message: 'No shifts selected' });
      return;
    }

    try {
      await Promise.all(
        selectedShifts.map(shift =>
          api.patch(`/api/shifts/${shift.id}`, { is_active: activate })
        )
      );
      setNotification({
        type: 'success',
        message: `${selectedShifts.length} shift(s) ${activate ? 'activated' : 'deactivated'}`
      });
      loadShifts();
    } catch (error) {
      setNotification({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // Filter logic
  const getFilteredShifts = () => {
    let filtered = shifts;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(shift =>
        shift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Department filter
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(shift =>
        (shift.department_id || shift.departmentId) === parseInt(filterDepartment)
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(shift =>
        (shift.shift_type || shift.shiftType) === filterType
      );
    }

    // Status filter (tabs)
    if (tabValue === 1) { // Active only
      filtered = filtered.filter(shift => shift.is_active !== false && shift.isActive !== false);
    } else if (tabValue === 2) { // Inactive only
      filtered = filtered.filter(shift => shift.is_active === false || shift.isActive === false);
    }

    return filtered;
  };

  // Calculate shift duration in hours
  const calculateDuration = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const duration = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
    return duration > 0 ? duration : duration + 24; // Handle overnight shifts
  };

  // Format time for display
  const formatTime = (time) => {
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${ampm}`;
  };

  const filteredShifts = getFilteredShifts();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Shift Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Define and manage shift types for scheduling
            </Typography>
          </Box>
          {user?.role !== 'employee' && (
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                startIcon={<SaveAlt />}
                onClick={() => setTemplateDialogOpen(true)}
              >
                Templates
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddShift}
                size="large"
              >
                Add Shift
              </Button>
            </Box>
          )}
        </Box>
      </motion.div>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search shifts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={filterDepartment}
                label="Department"
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <MenuItem value="all">All Departments</MenuItem>
                {departments.map(dept => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Shift Type</InputLabel>
              <Select
                value={filterType}
                label="Shift Type"
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                {Object.entries(SHIFT_TYPES).map(([key, value]) => (
                  <MenuItem key={key} value={key}>{value.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
              fullWidth
            >
              <ToggleButton value="grid">
                Grid View
              </ToggleButton>
              <ToggleButton value="table">
                Table View
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label={`All Shifts (${shifts.length})`} />
          <Tab label={`Active (${shifts.filter(s => s.is_active !== false && s.isActive !== false).length})`} />
          <Tab label={`Inactive (${shifts.filter(s => s.is_active === false || s.isActive === false).length})`} />
        </Tabs>
      </Box>

      {/* Content */}
      {filteredShifts.length === 0 ? (
        <Alert severity="info">
          No shifts found. {searchTerm && 'Try adjusting your search criteria.'}
        </Alert>
      ) : viewMode === 'grid' ? (
        // Grid View
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Grid container spacing={3}>
            {filteredShifts.map((shift, index) => {
              const shiftType = SHIFT_TYPES[shift.shift_type || shift.shiftType] || SHIFT_TYPES.custom;
              const duration = calculateDuration(
                shift.start_time || shift.startTime,
                shift.end_time || shift.endTime
              );
              const department = departments.find(d => d.id === (shift.department_id || shift.departmentId));

              return (
                <Grid item xs={12} sm={6} lg={4} key={shift.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      sx={{
                        height: '100%',
                        borderLeft: `4px solid ${shift.color || shiftType.color}`,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4
                        }
                      }}
                    >
                      <CardContent>
                        {/* Header */}
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ color: shift.color || shiftType.color }}>
                              {shiftType.icon}
                            </Box>
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {shift.name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {shift.abbreviation}
                              </Typography>
                            </Box>
                          </Box>
                          {user?.role !== 'employee' && (
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuOpen(e, shift)}
                            >
                              <MoreVert />
                            </IconButton>
                          )}
                        </Box>

                        {/* Chips */}
                        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                          <Chip
                            label={shiftType.label}
                            size="small"
                            sx={{ bgcolor: shift.color || shiftType.color, color: 'white' }}
                          />
                          <Chip
                            label={shift.is_active !== false && shift.isActive !== false ? 'Active' : 'Inactive'}
                            size="small"
                            color={shift.is_active !== false && shift.isActive !== false ? 'success' : 'default'}
                            icon={shift.is_active !== false && shift.isActive !== false ? <CheckCircle /> : <Cancel />}
                          />
                        </Box>

                        {/* Timeline */}
                        <Box mb={2}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight="medium">
                              {formatTime(shift.start_time || shift.startTime)} - {formatTime(shift.end_time || shift.endTime)}
                            </Typography>
                            <Chip label={`${duration}h`} size="small" variant="outlined" />
                          </Box>
                          {/* Visual timeline */}
                          <Box
                            sx={{
                              height: 8,
                              bgcolor: 'grey.200',
                              borderRadius: 1,
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${(parseInt((shift.start_time || shift.startTime).split(':')[0]) / 24) * 100}%`,
                                width: `${(duration / 24) * 100}%`,
                                height: '100%',
                                bgcolor: shift.color || shiftType.color,
                                borderRadius: 1
                              }}
                            />
                          </Box>
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        {/* Details */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <People fontSize="small" color="action" />
                            <Typography variant="body2">
                              Required Staff: {shift.required_staff || shift.requiredStaff || 1}
                            </Typography>
                          </Box>
                          {department && (
                            <Box display="flex" alignItems="center" gap={1}>
                              <Business fontSize="small" color="action" />
                              <Typography variant="body2">{department.name}</Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              );
            })}
          </Grid>
        </motion.div>
      ) : (
        // Table View
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredShifts.map((shift) => {
                const shiftType = SHIFT_TYPES[shift.shift_type || shift.shiftType] || SHIFT_TYPES.custom;
                const duration = calculateDuration(
                  shift.start_time || shift.startTime,
                  shift.end_time || shift.endTime
                );
                const department = departments.find(d => d.id === (shift.department_id || shift.departmentId));

                return (
                  <TableRow key={shift.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 4,
                            height: 24,
                            bgcolor: shift.color || shiftType.color,
                            borderRadius: 1
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {shift.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {shift.abbreviation}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={shiftType.label}
                        size="small"
                        sx={{ bgcolor: shift.color || shiftType.color, color: 'white' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTime(shift.start_time || shift.startTime)} - {formatTime(shift.end_time || shift.endTime)}
                      </Typography>
                    </TableCell>
                    <TableCell>{duration.toFixed(1)}h</TableCell>
                    <TableCell>{shift.required_staff || shift.requiredStaff || 1}</TableCell>
                    <TableCell>{department?.name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={shift.is_active !== false && shift.isActive !== false ? 'Active' : 'Inactive'}
                        size="small"
                        color={shift.is_active !== false && shift.isActive !== false ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {user?.role !== 'employee' && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, shift)}
                        >
                          <MoreVert />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditShift(selectedShift)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => handleDuplicateShift(selectedShift)}>
          <ContentCopy fontSize="small" sx={{ mr: 1 }} />
          Duplicate
        </MenuItem>
        <MenuItem onClick={handleSaveAsTemplate}>
          <SaveAlt fontSize="small" sx={{ mr: 1 }} />
          Save as Template
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteShift(selectedShift?.id)}>
          <Delete fontSize="small" sx={{ mr: 1 }} color="error" />
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* Add/Edit Shift Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {shiftForm.id ? 'Edit Shift' : 'Add New Shift'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Shift Name"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., Morning Shift"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Abbreviation"
                  value={shiftForm.abbreviation}
                  onChange={(e) => setShiftForm(prev => ({
                    ...prev,
                    abbreviation: e.target.value.toUpperCase().substring(0, 3)
                  }))}
                  required
                  placeholder="e.g., MOR"
                  inputProps={{ maxLength: 3 }}
                  helperText="Max 3 characters"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Shift Type</InputLabel>
                  <Select
                    value={shiftForm.shiftType}
                    label="Shift Type"
                    onChange={(e) => setShiftForm(prev => ({
                      ...prev,
                      shiftType: e.target.value,
                      color: SHIFT_TYPES[e.target.value].color
                    }))}
                  >
                    {Object.entries(SHIFT_TYPES).map(([key, value]) => (
                      <MenuItem key={key} value={key}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {value.icon}
                          {value.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Color"
                  type="color"
                  value={shiftForm.color}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, color: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Required Staff"
                  type="number"
                  value={shiftForm.requiredStaff}
                  onChange={(e) => setShiftForm(prev => ({
                    ...prev,
                    requiredStaff: Math.max(1, parseInt(e.target.value) || 1)
                  }))}
                  inputProps={{ min: 1 }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={shiftForm.departmentId}
                    label="Department"
                    onChange={(e) => setShiftForm(prev => ({ ...prev, departmentId: e.target.value }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    {departments.map(dept => (
                      <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={shiftForm.isActive}
                      onChange={(e) => setShiftForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                  }
                  label="Active"
                />
              </Grid>
              {/* Duration Preview */}
              <Grid item xs={12}>
                <Alert severity="info">
                  Duration: {calculateDuration(shiftForm.startTime, shiftForm.endTime).toFixed(1)} hours
                </Alert>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained">
            {shiftForm.id ? 'Update' : 'Create'} Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Shift Templates</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {templates.length === 0 ? (
              <Alert severity="info">No templates available. Save your first template!</Alert>
            ) : (
              <Grid container spacing={2}>
                {templates.map(template => (
                  <Grid item xs={12} key={template.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {template.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {template.description}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PlaylistAdd />}
                            onClick={() => handleApplyTemplate(template)}
                          >
                            Apply
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Close</Button>
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

export default ShiftManager;
