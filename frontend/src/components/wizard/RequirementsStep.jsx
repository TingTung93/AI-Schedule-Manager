import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  Alert,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Edit,
  Save,
  Cancel
} from '@mui/icons-material';

const RequirementsStep = ({ data, onChange, setNotification }) => {
  const [editingRow, setEditingRow] = useState(null);
  const [editValue, setEditValue] = useState(null);

  const requirements = data.adjustedRequirements || data.requirements || [];

  const handleEdit = (index, requirement) => {
    setEditingRow(index);
    setEditValue({ ...requirement });
  };

  const handleSave = (index) => {
    const updatedRequirements = [...requirements];
    updatedRequirements[index] = editValue;
    onChange('adjustedRequirements', updatedRequirements);
    setEditingRow(null);
    setEditValue(null);
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditValue(null);
  };

  const getGapStatus = (requirement) => {
    const available = requirement.availableStaff || 0;
    const required = requirement.requiredStaff || 0;

    if (available >= required) {
      return { status: 'ok', color: 'success', icon: <CheckCircle /> };
    } else if (available >= required * 0.7) {
      return { status: 'warning', color: 'warning', icon: <Warning /> };
    } else {
      return { status: 'critical', color: 'error', icon: <Warning /> };
    }
  };

  const getTotalGaps = () => {
    return requirements.filter(req => {
      const available = req.availableStaff || 0;
      const required = req.requiredStaff || 0;
      return available < required;
    }).length;
  };

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayName}, ${dateFormatted} ${timeStr || ''}`;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Review Shift Requirements
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Review staffing requirements for the selected period and make adjustments if needed
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Shifts
              </Typography>
              <Typography variant="h4">
                {requirements.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Staffing Gaps
              </Typography>
              <Typography variant="h4" color={getTotalGaps() > 0 ? 'error' : 'success'}>
                {getTotalGaps()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Selected Staff
              </Typography>
              <Typography variant="h4">
                {data.selectedStaff?.length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gap Warning */}
      {getTotalGaps() > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          There are {getTotalGaps()} shift(s) with insufficient qualified staff.
          You can adjust requirements or add more staff to the schedule.
        </Alert>
      )}

      {/* Requirements Table */}
      {requirements.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date & Time</TableCell>
                <TableCell>Shift Type</TableCell>
                <TableCell>Required Staff</TableCell>
                <TableCell>Available Qualified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requirements.map((req, index) => {
                const gap = getGapStatus(req);
                const isEditing = editingRow === index;

                return (
                  <TableRow key={index}>
                    <TableCell>
                      {formatDateTime(req.date, req.startTime + ' - ' + req.endTime)}
                    </TableCell>
                    <TableCell>
                      <Chip label={req.shiftType || 'Standard'} size="small" />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editValue.requiredStaff}
                          onChange={(e) => setEditValue({
                            ...editValue,
                            requiredStaff: parseInt(e.target.value) || 0
                          })}
                          inputProps={{ min: 0 }}
                          sx={{ width: 80 }}
                        />
                      ) : (
                        req.requiredStaff || 0
                      )}
                    </TableCell>
                    <TableCell>
                      {req.availableStaff || 0}
                      {req.qualifiedStaff && (
                        <Typography variant="caption" display="block" color="textSecondary">
                          {req.qualifiedStaff.join(', ')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={gap.icon}
                        label={
                          gap.status === 'ok' ? 'Adequate' :
                          gap.status === 'warning' ? 'Low' : 'Insufficient'
                        }
                        color={gap.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSave(index)}
                          >
                            <Save />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={handleCancel}
                          >
                            <Cancel />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(index, req)}
                        >
                          <Edit />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          No shift requirements found for the selected period.
          Please check your date range and department configuration.
        </Alert>
      )}
    </Box>
  );
};

export default RequirementsStep;
