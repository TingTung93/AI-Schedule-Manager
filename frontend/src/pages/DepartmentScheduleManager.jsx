import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Grid,
  Card,
  CardContent,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../services/api';

/**
 * DepartmentScheduleManager Component
 *
 * Manages department-specific schedules with features:
 * - List department schedules with pagination
 * - Create new schedules
 * - Apply schedule templates
 * - Edit/delete schedules
 * - View schedule details
 */
const DepartmentScheduleManager = () => {
  const { id: departmentId } = useParams();
  const navigate = useNavigate();

  // State management
  const [department, setDepartment] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalSchedules, setTotalSchedules] = useState(0);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuSchedule, setMenuSchedule] = useState(null);

  /**
   * Load department data
   */
  const loadDepartment = async () => {
    try {
      const response = await api.get(`/api/departments/${departmentId}`);
      setDepartment(response.data);
    } catch (err) {
      console.error('Error loading department:', err);
      setError('Failed to load department information');
    }
  };

  /**
   * Load department schedules with pagination
   */
  const loadSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/departments/${departmentId}/schedules`, {
        params: {
          page: page + 1, // Backend uses 1-indexed pages
          size: rowsPerPage,
        },
      });

      const data = response.data;
      setSchedules(data.items || []);
      setTotalSchedules(data.total || 0);
    } catch (err) {
      console.error('Error loading schedules:', err);
      setError(err.response?.data?.error || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load schedule templates
   */
  const loadTemplates = async () => {
    try {
      const response = await api.get(`/api/departments/${departmentId}/templates`);
      setTemplates(response.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      // Non-critical error, don't show to user
    }
  };

  /**
   * Initialize component
   */
  useEffect(() => {
    loadDepartment();
    loadSchedules();
    loadTemplates();
  }, [departmentId, page, rowsPerPage]);

  /**
   * Handle page change
   */
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  /**
   * Handle form input changes
   */
  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Reset form data
   */
  const resetForm = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      notes: '',
    });
  };

  /**
   * Handle create schedule
   */
  const handleCreateSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      await api.post(`/api/departments/${departmentId}/schedules`, formData);

      setSuccess('Schedule created successfully');
      setCreateDialogOpen(false);
      resetForm();
      loadSchedules();
    } catch (err) {
      console.error('Error creating schedule:', err);
      setError(err.response?.data?.error || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle apply template
   */
  const handleApplyTemplate = async (templateId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(
        `/api/departments/${departmentId}/templates/${templateId}/apply`,
        {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          notes: formData.notes,
        }
      );

      setSuccess('Template applied successfully');
      setTemplateDialogOpen(false);
      resetForm();
      loadSchedules();
    } catch (err) {
      console.error('Error applying template:', err);
      setError(err.response?.data?.error || 'Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle delete schedule
   */
  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/api/schedules/${selectedSchedule.id}`);

      setSuccess('Schedule deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedSchedule(null);
      loadSchedules();
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError(err.response?.data?.error || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle edit schedule
   */
  const handleEditSchedule = (schedule) => {
    navigate(`/schedules/${schedule.id}/edit`);
  };

  /**
   * Handle view schedule
   */
  const handleViewSchedule = (schedule) => {
    navigate(`/schedules/${schedule.id}`);
  };

  /**
   * Handle menu open
   */
  const handleMenuOpen = (event, schedule) => {
    setAnchorEl(event.currentTarget);
    setMenuSchedule(schedule);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuSchedule(null);
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  /**
   * Get status color
   */
  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      published: 'success',
      archived: 'warning',
    };
    return colors[status] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/departments')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" gutterBottom>
            {department?.name} - Schedule Management
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage schedules for {department?.name} department
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Schedule
        </Button>
        <Button
          variant="outlined"
          startIcon={<AssignmentIcon />}
          onClick={() => setTemplateDialogOpen(true)}
          disabled={templates.length === 0}
        >
          Apply Template
        </Button>
      </Box>

      {/* Alert Messages */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Schedules Table */}
      <Paper sx={{ mb: 3 }}>
        {loading && schedules.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : schedules.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No Schedules Found
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Create your first schedule or apply a template to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Schedule
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Schedule Name</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell align="center">Employees</TableCell>
                    <TableCell align="center">Shifts</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow
                      key={schedule.id}
                      component={motion.tr}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      hover
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {schedule.name}
                        </Typography>
                        {schedule.notes && (
                          <Typography variant="caption" color="textSecondary">
                            {schedule.notes}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(schedule.startDate)}</TableCell>
                      <TableCell>{formatDate(schedule.endDate)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={schedule.employeeCount || 0}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={schedule.shiftCount || 0}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={schedule.status || 'draft'}
                          size="small"
                          color={getStatusColor(schedule.status)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => handleViewSchedule(schedule)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditSchedule(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, schedule)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalSchedules}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleViewSchedule(menuSchedule);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleEditSchedule(menuSchedule);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Schedule</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSelectedSchedule(menuSchedule);
            setDeleteDialogOpen(true);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Schedule</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Schedule Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Schedule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Schedule Name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              fullWidth
              required
            />
            <TextField
              label="Start Date"
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleFormChange}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleFormChange}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSchedule}
            variant="contained"
            disabled={loading || !formData.name || !formData.startDate || !formData.endDate}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Apply Schedule Template</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Schedule Name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleFormChange}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="End Date"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleFormChange}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              fullWidth
              multiline
              rows={2}
            />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Available Templates
            </Typography>
            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 4 },
                    }}
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      {template.description && (
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          {template.description}
                        </Typography>
                      )}
                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        <Chip
                          label={template.patternType || 'custom'}
                          size="small"
                          variant="outlined"
                        />
                        {template.rotationDays && (
                          <Chip
                            label={`${template.rotationDays} days rotation`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the schedule "{selectedSchedule?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteSchedule}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentScheduleManager;
