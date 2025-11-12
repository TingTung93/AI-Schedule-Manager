import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import { Search, FilterList } from '@mui/icons-material';
import api, { getErrorMessage } from '../../services/api';

const ConfigurationStep = ({ data, onChange, setNotification }) => {
  const [departments, setDepartments] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (data.department) {
      loadStaff(data.department);
    }
  }, [data.department]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = allStaff.filter(staff =>
        `${staff.firstName} ${staff.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStaff(filtered);
    } else {
      setFilteredStaff(allStaff);
    }
  }, [searchTerm, allStaff]);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/api/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to load departments: ' + getErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async (departmentId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/departments/${departmentId}/staff`);
      setAllStaff(response.data.staff || []);
      setFilteredStaff(response.data.staff || []);
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to load staff: ' + getErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStaffToggle = (staffId) => {
    const currentSelected = data.selectedStaff || [];
    const newSelected = currentSelected.includes(staffId)
      ? currentSelected.filter(id => id !== staffId)
      : [...currentSelected, staffId];

    onChange('selectedStaff', newSelected);
  };

  const handleSelectAll = () => {
    if (data.selectedStaff.length === filteredStaff.length) {
      onChange('selectedStaff', []);
    } else {
      onChange('selectedStaff', filteredStaff.map(s => s.id));
    }
  };

  const getDefaultDateRange = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    };
  };

  // Set default date range on mount
  useEffect(() => {
    if (!data.dateRange.start && !data.dateRange.end) {
      onChange('dateRange', getDefaultDateRange());
    }
  }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Schedule Configuration
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Configure the basic parameters for your schedule
      </Typography>

      <Grid container spacing={3}>
        {/* Schedule Name and Description */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Schedule Name"
            value={data.scheduleName || ''}
            onChange={(e) => onChange('scheduleName', e.target.value)}
            required
            placeholder="e.g., Week of Jan 15-21, 2024"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description (Optional)"
            value={data.scheduleDescription || ''}
            onChange={(e) => onChange('scheduleDescription', e.target.value)}
            multiline
            rows={2}
            placeholder="Add any notes or special instructions for this schedule"
          />
        </Grid>

        {/* Department Selection */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Department</InputLabel>
            <Select
              value={data.department || ''}
              label="Department"
              onChange={(e) => onChange('department', e.target.value)}
            >
              {departments.map(dept => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Date Range */}
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="date"
            label="Start Date"
            value={data.dateRange?.start || ''}
            onChange={(e) => onChange('dateRange', {
              ...data.dateRange,
              start: e.target.value
            })}
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            type="date"
            label="End Date"
            value={data.dateRange?.end || ''}
            onChange={(e) => onChange('dateRange', {
              ...data.dateRange,
              end: e.target.value
            })}
            InputLabelProps={{ shrink: true }}
            required
          />
        </Grid>

        {/* Staff Selection */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Select Staff Members
            </Typography>
            <Chip
              label={`${data.selectedStaff?.length || 0} / ${filteredStaff.length} selected`}
              color={data.selectedStaff?.length > 0 ? 'primary' : 'default'}
            />
          </Box>

          <TextField
            fullWidth
            placeholder="Search staff by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />

          {data.department ? (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={data.selectedStaff?.length === filteredStaff.length && filteredStaff.length > 0}
                    indeterminate={
                      data.selectedStaff?.length > 0 &&
                      data.selectedStaff?.length < filteredStaff.length
                    }
                    onChange={handleSelectAll}
                  />
                }
                label="Select All"
                sx={{ mb: 1 }}
              />

              <Card variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <CardContent>
                  <FormGroup>
                    {filteredStaff.map(staff => (
                      <FormControlLabel
                        key={staff.id}
                        control={
                          <Checkbox
                            checked={data.selectedStaff?.includes(staff.id) || false}
                            onChange={() => handleStaffToggle(staff.id)}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">
                              {staff.firstName} {staff.lastName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {staff.email} • {staff.role || 'Staff'}
                              {staff.qualifications?.length > 0 && (
                                <> • {staff.qualifications.join(', ')}</>
                              )}
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </FormGroup>

                  {filteredStaff.length === 0 && (
                    <Typography color="textSecondary" textAlign="center" py={4}>
                      {searchTerm
                        ? 'No staff members match your search'
                        : 'No staff members available in this department'
                      }
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography color="textSecondary" textAlign="center" py={4}>
                  Please select a department first
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ConfigurationStep;
