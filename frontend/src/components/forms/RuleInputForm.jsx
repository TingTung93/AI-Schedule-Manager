/**
 * Validated Rule Input Form component with NLP parsing and validation
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
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import { ruleSchema } from '../../schemas/validationSchemas';
import {
  ValidatedTextField,
  ValidatedSelect,
  ValidatedAutoComplete,
  FormErrorSummary
} from './index';
import { ruleService, employeeService } from '../../services/api';
import { useApi, useApiMutation } from '../../hooks/useApi';

const RuleInputForm = ({
  open,
  onClose,
  onSubmit,
  mode = 'add', // 'add' or 'edit'
  initialData = null,
  loading = false
}) => {
  const [parsedRule, setParsedRule] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParsedError] = useState(null);
  const [naturalLanguageText, setNaturalLanguageText] = useState('');

  // Form setup
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
    trigger
  } = useForm({
    resolver: yupResolver(ruleSchema),
    defaultValues: {
      ruleType: 'preference',
      originalText: '',
      priority: 3,
      employeeId: null,
      constraints: {},
      active: true
    },
    mode: 'onChange'
  });

  // Watch form values
  const watchedRuleType = watch('ruleType');
  const watchedOriginalText = watch('originalText');
  const watchedEmployeeId = watch('employeeId');

  // Fetch employees
  const { data: employeesData, loading: loadingEmployees } = useApi(
    () => employeeService.getEmployees(),
    []
  );

  const employees = employeesData?.employees || [];

  // Rule type options
  const ruleTypeOptions = [
    { value: 'availability', label: 'Availability', description: 'When employee is available to work' },
    { value: 'preference', label: 'Preference', description: 'Employee work preferences' },
    { value: 'requirement', label: 'Requirement', description: 'Mandatory scheduling rules' },
    { value: 'restriction', label: 'Restriction', description: 'Limitations or constraints' }
  ];

  // Priority options
  const priorityOptions = [
    { value: 1, label: '1 - Low Priority' },
    { value: 2, label: '2 - Below Normal' },
    { value: 3, label: '3 - Normal' },
    { value: 4, label: '4 - High Priority' },
    { value: 5, label: '5 - Critical' }
  ];

  // Employee options
  const employeeOptions = [
    { value: null, label: 'All Employees (Global Rule)' },
    ...employees.map(emp => ({
      value: emp.id,
      label: `${emp.firstName} ${emp.lastName} (${emp.role})`
    }))
  ];

  // Load initial data when editing
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        ruleType: initialData.ruleType,
        originalText: initialData.originalText,
        priority: initialData.priority,
        employeeId: initialData.employeeId,
        constraints: initialData.constraints || {},
        active: initialData.active !== undefined ? initialData.active : true
      });
      setNaturalLanguageText(initialData.originalText);
    } else if (mode === 'add') {
      reset({
        ruleType: 'preference',
        originalText: '',
        priority: 3,
        employeeId: null,
        constraints: {},
        active: true
      });
      setNaturalLanguageText('');
    }
  }, [mode, initialData, reset]);

  // Parse rule with NLP when text changes
  const { mutate: parseRule } = useApiMutation(
    ruleService.parseRule,
    {
      onSuccess: (data) => {
        setParsedRule(data);
        setParsedError(null);

        // Auto-fill form fields from parsed rule
        if (data.ruleType) {
          setValue('ruleType', data.ruleType, { shouldValidate: true });
        }
        if (data.constraints) {
          setValue('constraints', data.constraints, { shouldValidate: true });
        }
        if (data.priority) {
          setValue('priority', data.priority, { shouldValidate: true });
        }
      },
      onError: (error) => {
        setParsedError(error.message || 'Failed to parse rule');
        setParsedRule(null);
      },
      onSettled: () => {
        setParseLoading(false);
      }
    }
  );

  // Debounced rule parsing
  useEffect(() => {
    if (watchedOriginalText && watchedOriginalText.trim().length > 10) {
      const timeoutId = setTimeout(() => {
        setParseLoading(true);
        parseRule({ rule_text: watchedOriginalText });
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      setParsedRule(null);
      setParsedError(null);
    }
  }, [watchedOriginalText, parseRule]);

  // Manual parse trigger
  const handleManualParse = useCallback(() => {
    if (watchedOriginalText && watchedOriginalText.trim()) {
      setParseLoading(true);
      parseRule({ rule_text: watchedOriginalText });
    }
  }, [watchedOriginalText, parseRule]);

  // Rule examples for different types
  const getRuleExamples = (ruleType) => {
    const examples = {
      availability: [
        "I am available Monday to Friday from 9 AM to 5 PM",
        "I cannot work on weekends",
        "I'm available for morning shifts only"
      ],
      preference: [
        "I prefer to work closing shifts",
        "I would like to have at least 2 days off per week",
        "I prefer not to work more than 6 hours in a day"
      ],
      requirement: [
        "I must have Sundays off for religious reasons",
        "I require at least 12 hours between shifts",
        "I need to leave by 3 PM on Tuesdays for class"
      ],
      restriction: [
        "I cannot work more than 30 hours per week",
        "I cannot lift more than 25 pounds",
        "I cannot work alone during night shifts"
      ]
    };
    return examples[ruleType] || [];
  };

  // Form submission
  const handleFormSubmit = useCallback(async (data) => {
    try {
      const ruleData = {
        ...data,
        constraints: parsedRule?.constraints || data.constraints || {}
      };
      await onSubmit(ruleData);
    } catch (error) {
      console.error('Rule form submission error:', error);
    }
  }, [parsedRule, onSubmit]);

  const handleClose = useCallback(() => {
    reset();
    setParsedRule(null);
    setParsedError(null);
    setNaturalLanguageText('');
    onClose();
  }, [reset, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyIcon />
            {mode === 'add' ? 'Create New Rule' : 'Edit Rule'}
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Form Error Summary */}
          <FormErrorSummary
            errors={errors}
            title="Please fix the following errors:"
            collapsible={Object.keys(errors).length > 2}
          />

          <Grid container spacing={3}>
            {/* Left Column - Rule Input */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Rule Details
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <ValidatedSelect
                    name="ruleType"
                    control={control}
                    label="Rule Type"
                    options={ruleTypeOptions}
                    required
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        <Box>
                          <Typography variant="body1">{option.label}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Describe the rule in natural language:
                    </Typography>
                    <Tooltip title="Parse rule automatically">
                      <IconButton
                        size="small"
                        onClick={handleManualParse}
                        disabled={!watchedOriginalText || parseLoading}
                      >
                        {parseLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          <RefreshIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <ValidatedTextField
                    name="originalText"
                    control={control}
                    label="Rule Description"
                    multiline
                    rows={4}
                    required
                    placeholder="Example: I am available Monday to Friday from 9 AM to 5 PM, but I prefer morning shifts..."
                    helperText="Describe the rule as you would naturally speak it. Our AI will help parse it into structured constraints."
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <ValidatedSelect
                    name="priority"
                    control={control}
                    label="Priority"
                    options={priorityOptions}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <ValidatedSelect
                    name="employeeId"
                    control={control}
                    label="Apply To"
                    options={employeeOptions}
                    loading={loadingEmployees}
                    placeholder="Select employee or all"
                  />
                </Grid>
              </Grid>

              {/* Rule Examples */}
              {watchedRuleType && (
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Example {watchedRuleType} rules:
                    </Typography>
                    {getRuleExamples(watchedRuleType).map((example, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 0.5,
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => {
                          setValue('originalText', example, { shouldValidate: true });
                          setNaturalLanguageText(example);
                        }}
                      >
                        • {example}
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* Right Column - Parsed Rule Preview */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                AI Rule Analysis
              </Typography>

              {parseLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Analyzing rule with AI...
                  </Typography>
                </Box>
              )}

              {parseError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    {parseError}
                  </Typography>
                </Alert>
              )}

              {parsedRule && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CheckIcon color="success" />
                    <Typography variant="subtitle2" color="success.main">
                      Rule Successfully Parsed
                    </Typography>
                  </Box>

                  <Grid container spacing={2}>
                    {parsedRule.ruleType && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Detected Type:
                        </Typography>
                        <Chip
                          label={parsedRule.ruleType}
                          color="primary"
                          size="small"
                        />
                      </Grid>
                    )}

                    {parsedRule.priority && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Suggested Priority:
                        </Typography>
                        <Chip
                          label={`Priority ${parsedRule.priority}`}
                          color="secondary"
                          size="small"
                        />
                      </Grid>
                    )}

                    {parsedRule.constraints && Object.keys(parsedRule.constraints).length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Extracted Constraints:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {Object.entries(parsedRule.constraints).map(([key, value]) => (
                            <Box key={key} sx={{ display: 'flex', gap: 1 }}>
                              <Chip
                                label={key}
                                size="small"
                                variant="outlined"
                              />
                              <Typography variant="body2">
                                {typeof value === 'object' ? JSON.stringify(value) : value.toString()}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Grid>
                    )}

                    {parsedRule.confidence && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Confidence: {Math.round(parsedRule.confidence * 100)}%
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              )}

              {!parseLoading && !parsedRule && !parseError && watchedOriginalText && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Enter a rule description to see AI analysis and auto-completion.
                  </Typography>
                </Alert>
              )}

              {/* Manual Constraints Editor */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Advanced Constraints (JSON)
                  </Typography>
                  <ValidatedTextField
                    name="constraints"
                    control={control}
                    label="Constraints"
                    multiline
                    rows={6}
                    placeholder='{"days": ["monday", "tuesday"], "startTime": "09:00", "endTime": "17:00"}'
                    helperText="Advanced users can manually edit constraints in JSON format"
                    value={JSON.stringify(watch('constraints') || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setValue('constraints', parsed, { shouldValidate: true });
                      } catch (error) {
                        // Invalid JSON, don't update
                      }
                    }}
                  />
                </CardContent>
              </Card>
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
            disabled={!isValid || loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {mode === 'add' ? 'Create Rule' : 'Update Rule'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RuleInputForm;