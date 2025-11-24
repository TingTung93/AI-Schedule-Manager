/**
 * Validated Schedule Form component with business logic validation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Chip,
  FormControlLabel,
  Switch
} from '@mui/material';

import { scheduleSchema } from '../../schemas/validationSchemas';
import {
  ValidatedTextField,
  ValidatedSelect,
  ValidatedDatePicker,
  FormErrorSummary
} from './index';
import { checkShiftConflicts, validateEmployeeQualifications } from '../../utils/validation';
import api, { scheduleService } from '../../services/api';
import { useApi } from '../../hooks/useApi';

const ScheduleForm = ({
  open,
  onClose,
  onSubmit,
  mode = 'add', // 'add' or 'edit'
  initialData = null,
  loading = false
}) => {
  const [employeeShifts, setEmployeeShifts] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [businessValidation, setBusinessValidation] = useState({
    conflicts: [],
    qualificationIssues: [],
    availabilityIssues: []
  });

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
    setError,
    clearErrors
  } = useForm({
    resolver: yupResolver(scheduleSchema),
    defaultValues: {
      employeeId: null,
      shiftId: null,
      date: null,
      status: 'scheduled',
      notes: '',
      overtimeApproved: false
    },
    mode: 'onChange'
  });

  // Watch form values for business validation
  const watchedEmployeeId = watch('employeeId');
  const watchedShiftId = watch('shiftId');
  const watchedDate = watch('date');

  // Fetch employees
  const { data: employeesData, loading: loadingEmployees } = useApi(
    () => api.get('/api/employees'),
    []
  );

  // Fetch shifts
  const { data: shiftsData, loading: loadingShifts } = useApi(
    () => api.get('/api/shifts'),
    []
  );

  const employees = employeesData?.items || [];
  const shifts = shiftsData?.shifts || [];

  // Employee options with status indication
  const employeeOptions = employees
    .filter(emp => emp.isActive)
    .map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName} (${emp.role})`,
      employee: emp
    }));

  // Shift options with details
  const shiftOptions = shifts
    .filter(shift => shift.active)
    .map(shift => ({
      value: shift.id,
      label: `${shift.name} (${shift.startTime} - ${shift.endTime})`,
      shift: shift
    }));

  // Status options
  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show' }
  ];

  // Load initial data when editing
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        employeeId: initialData.employeeId,
        shiftId: initialData.shiftId,
        date: initialData.date,
        status: initialData.status || 'scheduled',
        notes: initialData.notes || '',
        overtimeApproved: initialData.overtimeApproved || false
      });
    } else if (mode === 'add') {
      reset({
        employeeId: null,
        shiftId: null,
        date: null,
        status: 'scheduled',
        notes: '',
        overtimeApproved: false
      });
    }
  }, [mode, initialData, reset]);

  // Load employee's existing shifts for conflict checking
  useEffect(() => {
    if (watchedEmployeeId && watchedDate) {
      const fetchEmployeeShifts = async () => {
        try {
          const response = await scheduleService.getEmployeeSchedule(
            watchedEmployeeId,
            watchedDate,
            watchedDate
          );
          setEmployeeShifts(response.schedules || []);
        } catch (error) {
          // Silently handle - not critical if employee shifts can't be loaded
          setEmployeeShifts([]);
        }
      };

      fetchEmployeeShifts();
    }
  }, [watchedEmployeeId, watchedDate]);

  // Business logic validation
  useEffect(() => {
    if (watchedEmployeeId && watchedShiftId && watchedDate) {
      const employee = employees.find(emp => emp.id === parseInt(watchedEmployeeId));
      const shift = shifts.find(s => s.id === parseInt(watchedShiftId));

      if (employee && shift) {
        const validation = {
          conflicts: [],
          qualificationIssues: [],
          availabilityIssues: []
        };

        // Check shift conflicts
        const newShift = {
          date: watchedDate,
          startTime: shift.startTime,
          endTime: shift.endTime
        };

        const existingShifts = employeeShifts
          .filter(schedule => {
            // Exclude current schedule when editing
            if (mode === 'edit' && initialData && schedule.id === initialData.id) {
              return false;
            }
            return schedule.status !== 'cancelled';
          })
          .map(schedule => ({
            id: schedule.id,
            date: schedule.date,
            startTime: schedule.shift.startTime,
            endTime: schedule.shift.endTime
          }));

        const conflictCheck = checkShiftConflicts(newShift, existingShifts);
        if (conflictCheck.hasConflict) {
          validation.conflicts = conflictCheck.conflicts;
        }

        // Check qualifications
        const qualificationCheck = validateEmployeeQualifications(
          employee.qualifications || [],
          shift.requiredQualifications || []
        );
        if (!qualificationCheck.isQualified) {
          validation.qualificationIssues = qualificationCheck.missingQualifications;
        }

        // Check availability
        const shiftDate = new Date(watchedDate);
        const dayOfWeek = shiftDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
        const employeeAvailability = employee.availability?.[dayOfWeek];

        if (employeeAvailability && !employeeAvailability.available) {
          validation.availabilityIssues.push(`Employee is not available on ${dayOfWeek}s`);
        } else if (employeeAvailability) {
          const shiftStart = shift.startTime;
          const shiftEnd = shift.endTime;
          const availStart = employeeAvailability.start;
          const availEnd = employeeAvailability.end;

          if (shiftStart < availStart || shiftEnd > availEnd) {
            validation.availabilityIssues.push(
              `Shift time (${shiftStart}-${shiftEnd}) is outside employee availability (${availStart}-${availEnd})`
            );
          }
        }

        setBusinessValidation(validation);

        // Set form errors for conflicts
        if (validation.conflicts.length > 0) {
          setError('shiftId', {
            message: `Shift conflicts with existing schedule(s)`
          });
        } else if (errors.shiftId?.message?.includes('conflicts')) {
          clearErrors('shiftId');
        }
      }
    } else {
      setBusinessValidation({
        conflicts: [],
        qualificationIssues: [],
        availabilityIssues: []
      });
    }
  }, [
    watchedEmployeeId,
    watchedShiftId,
    watchedDate,
    employees,
    shifts,
    employeeShifts,
    mode,
    initialData,
    setError,
    clearErrors,
    errors.shiftId
  ]);

  // Form submission
  const handleFormSubmit = useCallback(async (data) => {
    const hasConflicts = businessValidation.conflicts.length > 0;
    const hasQualificationIssues = businessValidation.qualificationIssues.length > 0;
    const hasAvailabilityIssues = businessValidation.availabilityIssues.length > 0;

    // Show warnings but allow submission for non-conflict issues
    const warnings = [];
    if (hasQualificationIssues) {
      warnings.push('Employee is missing required qualifications');
    }
    if (hasAvailabilityIssues) {
      warnings.push('Shift is outside employee\'s normal availability');
    }

    setValidationWarnings(warnings);

    // Block submission only for conflicts
    if (hasConflicts) {
      return;
    }

    try {
      await onSubmit(data);
    } catch (error) {
      // Error already handled by onSubmit callback
    }
  }, [businessValidation, onSubmit]);

  const handleClose = useCallback(() => {
    reset();
    setValidationWarnings([]);
    setBusinessValidation({
      conflicts: [],
      qualificationIssues: [],
      availabilityIssues: []
    });
    onClose();
  }, [reset, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>
          {mode === 'add' ? 'Create Schedule' : 'Edit Schedule'}
        </DialogTitle>

        <DialogContent>
          {/* Form Error Summary */}
          <FormErrorSummary
            errors={errors}
            title="Please fix the following errors:"
            collapsible={Object.keys(errors).length > 2}
          />

          {/* Business Validation Warnings */}
          {(businessValidation.conflicts.length > 0 ||
            businessValidation.qualificationIssues.length > 0 ||
            businessValidation.availabilityIssues.length > 0) && (
            <Box sx={{ mb: 2 }}>
              {businessValidation.conflicts.length > 0 && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Schedule Conflicts Detected:
                  </Typography>
                  {businessValidation.conflicts.map((conflict, index) => (
                    <Typography key={index} variant="body2">
                      • Conflicts with shift on {conflict.date} from {conflict.conflictTime}
                    </Typography>
                  ))}
                </Alert>
              )}

              {businessValidation.qualificationIssues.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Missing Qualifications:
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    {businessValidation.qualificationIssues.map((qual, index) => (
                      <Chip
                        key={index}
                        label={qual}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Box>
                </Alert>
              )}

              {businessValidation.availabilityIssues.length > 0 && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Availability Issues:
                  </Typography>
                  {businessValidation.availabilityIssues.map((issue, index) => (
                    <Typography key={index} variant="body2">
                      • {issue}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                name="employeeId"
                control={control}
                label="Employee"
                options={employeeOptions}
                loading={loadingEmployees}
                required
                placeholder="Select an employee"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                name="shiftId"
                control={control}
                label="Shift"
                options={shiftOptions}
                loading={loadingShifts}
                required
                placeholder="Select a shift"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <ValidatedDatePicker
                name="date"
                control={control}
                label="Date"
                type="date"
                required
                disablePast={mode === 'add'}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <ValidatedSelect
                name="status"
                control={control}
                label="Status"
                options={statusOptions}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <ValidatedTextField
                name="notes"
                control={control}
                label="Notes"
                multiline
                rows={3}
                placeholder="Optional notes about this schedule..."
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={watch('overtimeApproved')}
                    onChange={(e) => setValue('overtimeApproved', e.target.checked)}
                  />
                }
                label="Overtime Approved"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              !isValid ||
              loading ||
              businessValidation.conflicts.length > 0
            }
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {mode === 'add' ? 'Create Schedule' : 'Update Schedule'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ScheduleForm;