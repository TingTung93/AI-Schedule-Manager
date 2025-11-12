import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Warning,
  Error,
  ExpandMore,
  Schedule,
  People,
  Rule,
  AccessTime
} from '@mui/icons-material';

const ValidationStep = ({ data, onChange, onValidate, setNotification }) => {
  const [validating, setValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);

  useEffect(() => {
    if (data.validationPassed !== null) {
      setValidationComplete(true);
    }
  }, [data.validationPassed]);

  const handleValidation = async () => {
    setValidating(true);
    try {
      await onValidate();
      setValidationComplete(true);
      setNotification({
        type: data.validationPassed ? 'success' : 'warning',
        message: data.validationPassed
          ? 'Validation passed! No conflicts found.'
          : 'Validation complete. Please review and fix the issues.'
      });
    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Validation failed: ' + error.message
      });
    } finally {
      setValidating(false);
    }
  };

  const conflicts = data.conflicts || [];
  const violations = data.violations || [];

  const groupConflictsByType = () => {
    const groups = {
      double_booking: [],
      missing_qualification: [],
      work_hours: [],
      rest_period: [],
      other: []
    };

    conflicts.forEach(conflict => {
      const type = conflict.type || 'other';
      if (groups[type]) {
        groups[type].push(conflict);
      } else {
        groups.other.push(conflict);
      }
    });

    return groups;
  };

  const groupViolationsByType = () => {
    const groups = {
      max_hours: [],
      min_rest: [],
      consecutive_days: [],
      qualification: [],
      other: []
    };

    violations.forEach(violation => {
      const type = violation.type || 'other';
      if (groups[type]) {
        groups[type].push(violation);
      } else {
        groups.other.push(violation);
      }
    });

    return groups;
  };

  const conflictGroups = groupConflictsByType();
  const violationGroups = groupViolationsByType();

  const getTotalIssues = () => {
    return conflicts.length + violations.length;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const renderConflictGroup = (title, icon, items) => {
    if (items.length === 0) return null;

    return (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box display="flex" alignItems="center" gap={2} width="100%">
            {icon}
            <Typography flex={1}>{title}</Typography>
            <Chip
              label={items.length}
              color="error"
              size="small"
            />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <List>
            {items.map((item, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Error color={getSeverityColor(item.severity)} />
                </ListItemIcon>
                <ListItemText
                  primary={item.message || item.description}
                  secondary={item.details}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>
    );
  };

  if (!validationComplete && !validating) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Validation
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
          Validate the schedule to check for conflicts and rule violations
        </Typography>

        <Card sx={{ mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Ready to Validate
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The validation will check for:
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <Schedule sx={{ color: 'info.contrastText' }} />
                </ListItemIcon>
                <ListItemText primary="Double bookings and scheduling conflicts" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <People sx={{ color: 'info.contrastText' }} />
                </ListItemIcon>
                <ListItemText primary="Missing qualifications for assigned shifts" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AccessTime sx={{ color: 'info.contrastText' }} />
                </ListItemIcon>
                <ListItemText primary="Working hour limits and violations" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Rule sx={{ color: 'info.contrastText' }} />
                </ListItemIcon>
                <ListItemText primary="Rest period requirements" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Rule sx={{ color: 'info.contrastText' }} />
                </ListItemIcon>
                <ListItemText primary="Department-specific rules" />
              </ListItem>
            </List>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleValidation}
              fullWidth
              sx={{
                mt: 2,
                bgcolor: 'info.dark',
                '&:hover': { bgcolor: 'info.darker' }
              }}
            >
              Run Validation
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (validating) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Validation
        </Typography>
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Typography variant="h6" gutterBottom>
                Validating Schedule...
              </Typography>
              <LinearProgress sx={{ my: 2 }} />
              <Typography variant="body2" color="textSecondary">
                Checking for conflicts and violations
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Validation Results
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Review validation results and fix any issues before publishing
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                {data.validationPassed ? (
                  <CheckCircle color="success" sx={{ fontSize: 40 }} />
                ) : (
                  <Warning color="error" sx={{ fontSize: 40 }} />
                )}
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Overall Status
                  </Typography>
                  <Typography variant="h6">
                    {data.validationPassed ? 'Passed' : 'Failed'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Error color="error" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Conflicts
                  </Typography>
                  <Typography variant="h6">
                    {conflicts.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Warning color="warning" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography color="textSecondary" variant="caption">
                    Rule Violations
                  </Typography>
                  <Typography variant="h6">
                    {violations.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Success Message */}
      {data.validationPassed && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            Validation Successful!
          </Typography>
          <Typography variant="body2">
            No conflicts or violations found. The schedule is ready to be published.
          </Typography>
        </Alert>
      )}

      {/* Issues Found */}
      {!data.validationPassed && (
        <>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2">
              {getTotalIssues()} Issue(s) Found
            </Typography>
            <Typography variant="body2">
              Please review and fix the issues below before proceeding.
              You can go back to the adjustment step to make changes.
            </Typography>
          </Alert>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Conflicts
              </Typography>
              {renderConflictGroup(
                'Double Bookings',
                <Schedule color="error" />,
                conflictGroups.double_booking
              )}
              {renderConflictGroup(
                'Missing Qualifications',
                <People color="error" />,
                conflictGroups.missing_qualification
              )}
              {renderConflictGroup(
                'Working Hour Conflicts',
                <AccessTime color="error" />,
                conflictGroups.work_hours
              )}
              {renderConflictGroup(
                'Rest Period Conflicts',
                <Rule color="error" />,
                conflictGroups.rest_period
              )}
              {renderConflictGroup(
                'Other Conflicts',
                <Error color="error" />,
                conflictGroups.other
              )}
            </Box>
          )}

          {/* Violations */}
          {violations.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Rule Violations
              </Typography>
              {renderConflictGroup(
                'Maximum Hours Exceeded',
                <AccessTime color="warning" />,
                violationGroups.max_hours
              )}
              {renderConflictGroup(
                'Minimum Rest Not Met',
                <Rule color="warning" />,
                violationGroups.min_rest
              )}
              {renderConflictGroup(
                'Consecutive Days Limit',
                <Schedule color="warning" />,
                violationGroups.consecutive_days
              )}
              {renderConflictGroup(
                'Qualification Issues',
                <People color="warning" />,
                violationGroups.qualification
              )}
              {renderConflictGroup(
                'Other Violations',
                <Warning color="warning" />,
                violationGroups.other
              )}
            </Box>
          )}
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Re-run Validation */}
      <Box textAlign="center">
        <Button
          variant="outlined"
          startIcon={<PlayArrow />}
          onClick={handleValidation}
        >
          Re-run Validation
        </Button>
      </Box>
    </Box>
  );
};

export default ValidationStep;
