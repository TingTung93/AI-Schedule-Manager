import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  NavigateNext,
  NavigateBefore,
  Close,
  Save,
  Publish,
  AutoFixHigh
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';
import ConfigurationStep from '../components/wizard/ConfigurationStep';
import RequirementsStep from '../components/wizard/RequirementsStep';
import GenerationStep from '../components/wizard/GenerationStep';
import AdjustmentStep from '../components/wizard/AdjustmentStep';
import ValidationStep from '../components/wizard/ValidationStep';
import PublishStep from '../components/wizard/PublishStep';

const steps = [
  'Configuration',
  'Review Requirements',
  'Auto-Generate',
  'Manual Adjustments',
  'Validation',
  'Preview & Publish'
];

const ScheduleBuilder = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Configuration
    department: '',
    dateRange: {
      start: '',
      end: ''
    },
    selectedStaff: [],
    scheduleName: '',
    scheduleDescription: '',

    // Step 2: Requirements (loaded from backend)
    requirements: [],
    adjustedRequirements: [],

    // Step 3: Generation
    generatedSchedule: null,
    generationStatus: null,
    generationErrors: [],

    // Step 4: Manual adjustments
    manualModifications: [],
    currentSchedule: null,

    // Step 5: Validation
    conflicts: [],
    violations: [],
    validationPassed: false,

    // Step 6: Preview
    statistics: null,
    publishOptions: {
      saveAsDraft: false,
      notifyEmployees: true,
      exportPdf: false
    }
  });

  // Auto-save to localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('scheduleBuilderProgress');
    if (savedData) {
      try {
        setWizardData(JSON.parse(savedData));
      } catch (error) {
        console.error('Failed to restore wizard progress:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scheduleBuilderProgress', JSON.stringify(wizardData));
  }, [wizardData]);

  const updateWizardData = (field, value) => {
    setWizardData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: // Configuration
        return wizardData.department &&
               wizardData.dateRange.start &&
               wizardData.dateRange.end &&
               wizardData.selectedStaff.length > 0 &&
               wizardData.scheduleName;
      case 1: // Requirements
        return wizardData.requirements.length > 0;
      case 2: // Generation
        return wizardData.generatedSchedule !== null;
      case 3: // Adjustments
        return wizardData.currentSchedule !== null;
      case 4: // Validation
        return wizardData.validationPassed;
      case 5: // Preview
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      setNotification({
        type: 'warning',
        message: 'Please complete all required fields before proceeding'
      });
      return;
    }

    // Perform step-specific actions before moving to next step
    try {
      setLoading(true);

      switch (activeStep) {
        case 0: // After configuration, load requirements
          await loadRequirements();
          break;
        case 2: // After generation, prepare for adjustments
          if (wizardData.generatedSchedule) {
            updateWizardData('currentSchedule', wizardData.generatedSchedule);
          }
          break;
        case 3: // After adjustments, run validation
          await validateSchedule();
          break;
        default:
          break;
      }

      setActiveStep(prev => prev + 1);
    } catch (error) {
      setNotification({
        type: 'error',
        message: getErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleStepClick = (stepIndex) => {
    // Allow navigating to any previous step
    if (stepIndex < activeStep) {
      setActiveStep(stepIndex);
    }
  };

  const loadRequirements = async () => {
    try {
      const response = await api.get(`/api/departments/${wizardData.department}/shifts`, {
        params: {
          start_date: wizardData.dateRange.start,
          end_date: wizardData.dateRange.end
        }
      });

      updateWizardData('requirements', response.data.requirements || []);
      updateWizardData('adjustedRequirements', response.data.requirements || []);
    } catch (error) {
      throw new Error('Failed to load shift requirements: ' + getErrorMessage(error));
    }
  };

  const validateSchedule = async () => {
    try {
      const response = await api.post('/api/schedule/validate', {
        schedule: wizardData.currentSchedule,
        department: wizardData.department,
        date_range: wizardData.dateRange
      });

      updateWizardData('conflicts', response.data.conflicts || []);
      updateWizardData('violations', response.data.violations || []);
      updateWizardData('validationPassed',
        (response.data.conflicts?.length || 0) === 0 &&
        (response.data.violations?.length || 0) === 0
      );
    } catch (error) {
      throw new Error('Validation failed: ' + getErrorMessage(error));
    }
  };

  const handleCancel = () => {
    setConfirmExit(true);
  };

  const confirmCancelWizard = () => {
    localStorage.removeItem('scheduleBuilderProgress');
    window.history.back();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <ConfigurationStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
          />
        );
      case 1:
        return (
          <RequirementsStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
          />
        );
      case 2:
        return (
          <GenerationStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
          />
        );
      case 3:
        return (
          <AdjustmentStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
          />
        );
      case 4:
        return (
          <ValidationStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
            onValidate={validateSchedule}
          />
        );
      case 5:
        return (
          <PublishStep
            data={wizardData}
            onChange={updateWizardData}
            setNotification={setNotification}
          />
        );
      default:
        return <Typography>Unknown step</Typography>;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Schedule Builder
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Create and optimize schedules with AI-powered constraint solving
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<Close />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </Box>
      </motion.div>

      {/* Step Progress Indicator */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label, index) => (
            <Step
              key={label}
              onClick={() => handleStepClick(index)}
              sx={{
                cursor: index < activeStep ? 'pointer' : 'default',
                '&:hover': index < activeStep ? { opacity: 0.8 } : {}
              }}
            >
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Loading Indicator */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Paper sx={{ p: 4, minHeight: 500 }}>
            {renderStepContent()}
          </Paper>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          startIcon={<NavigateBefore />}
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeStep === steps.length - 1 ? (
            <>
              <Button
                variant="outlined"
                startIcon={<Save />}
                disabled={loading}
                onClick={() => {
                  updateWizardData('publishOptions', {
                    ...wizardData.publishOptions,
                    saveAsDraft: true
                  });
                }}
              >
                Save as Draft
              </Button>
              <Button
                variant="contained"
                startIcon={<Publish />}
                disabled={loading || !canProceed()}
                onClick={() => {
                  // Publishing is handled in PublishStep component
                }}
              >
                Publish Schedule
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              endIcon={<NavigateNext />}
              onClick={handleNext}
              disabled={loading || !canProceed()}
            >
              {activeStep === 2 ? 'Generate Schedule' : 'Next'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmExit} onClose={() => setConfirmExit(false)}>
        <DialogTitle>Cancel Schedule Creation?</DialogTitle>
        <DialogContent>
          <Typography>
            Your progress has been saved and you can return to this wizard later.
            Are you sure you want to exit?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmExit(false)}>
            Continue Editing
          </Button>
          <Button onClick={confirmCancelWizard} color="error" variant="contained">
            Exit Wizard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={5000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notification && (
          <Alert
            onClose={() => setNotification(null)}
            severity={notification.type}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default ScheduleBuilder;
