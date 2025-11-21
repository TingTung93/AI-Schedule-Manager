import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  AutoFixHigh,
  DraftsOutlined
} from '@mui/icons-material';
import api, { getErrorMessage } from '../services/api';
import ConfigurationStep from '../components/wizard/ConfigurationStep';
import RequirementsStep from '../components/wizard/RequirementsStep';
import GenerationStep from '../components/wizard/GenerationStep';
import AdjustmentStep from '../components/wizard/AdjustmentStep';
import ValidationStep from '../components/wizard/ValidationStep';
import PublishStep from '../components/wizard/PublishStep';
import { saveDraft, loadDraft, clearDraft, hasDraft, getDraftMetadata } from '../utils/wizardDraft';
import { SkipNavigation } from '../components/accessibility';
import { announceToScreenReader } from '../utils/accessibility';

const steps = [
  'Configuration',
  'Review Requirements',
  'Auto-Generate',
  'Manual Adjustments',
  'Validation',
  'Preview & Publish'
];

const ScheduleBuilder = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [showResumeDraftDialog, setShowResumeDraftDialog] = useState(false);
  const [draftData, setDraftData] = useState(null);

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

  // Check for existing draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      const metadata = getDraftMetadata();
      console.log('Found existing draft:', metadata);
      setDraftData(draft);
      setShowResumeDraftDialog(true);
    }
  }, []);

  // Auto-save wizard data as draft (with debouncing)
  useEffect(() => {
    if (!showResumeDraftDialog && wizardData.department) {
      // Only auto-save if user has started filling the form
      const timeoutId = setTimeout(() => {
        saveDraft({ ...wizardData, activeStep });
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [wizardData, activeStep, showResumeDraftDialog]);

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
      const message = 'Please complete all required fields before proceeding';
      setNotification({
        type: 'warning',
        message
      });
      announceToScreenReader(message, 'assertive');
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

      const nextStep = activeStep + 1;
      setActiveStep(nextStep);
      announceToScreenReader(`Moving to step ${nextStep + 1}: ${steps[nextStep]}`);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setNotification({
        type: 'error',
        message: errorMessage
      });
      announceToScreenReader(`Error: ${errorMessage}`, 'assertive');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    const prevStep = activeStep - 1;
    setActiveStep(prevStep);
    announceToScreenReader(`Going back to step ${prevStep + 1}: ${steps[prevStep]}`);
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
    clearDraft();
    navigate('/schedules');
  };

  const handleSaveDraft = () => {
    const success = saveDraft({ ...wizardData, activeStep });
    if (success) {
      setNotification({
        type: 'success',
        message: 'Draft saved successfully. You can resume later from the schedules page.'
      });
      setTimeout(() => {
        navigate('/schedules');
      }, 1500);
    } else {
      setNotification({
        type: 'error',
        message: 'Failed to save draft. Please try again.'
      });
    }
  };

  const handleResumeDraft = () => {
    if (draftData) {
      setWizardData(draftData);
      if (draftData.activeStep !== undefined) {
        setActiveStep(draftData.activeStep);
      }
      setShowResumeDraftDialog(false);
      setNotification({
        type: 'success',
        message: 'Draft resumed successfully'
      });
    }
  };

  const handleStartFresh = () => {
    clearDraft();
    setShowResumeDraftDialog(false);
    setDraftData(null);
    setNotification({
      type: 'info',
      message: 'Starting new schedule'
    });
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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Enter to submit/next
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (activeStep === steps.length - 1) {
          // Publish (handled by PublishStep)
        } else {
          handleNext();
        }
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeStep]);

  return (
    <>
      <SkipNavigation />
      <Box
        id="main-content"
        tabIndex={-1}
        sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}
        role="main"
        aria-label="Schedule Builder Wizard"
      >
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
              <Typography variant="body1" color="textSecondary" id="wizard-description">
                Create and optimize schedules with AI-powered constraint solving
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Close />}
              onClick={handleCancel}
              aria-label="Cancel schedule creation and return to schedules page"
            >
              Cancel
            </Button>
          </Box>
        </motion.div>

      {/* Step Progress Indicator */}
      <Paper
        sx={{ p: 3, mb: 3 }}
        role="navigation"
        aria-label="Wizard progress"
      >
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
              <StepLabel
                aria-label={`Step ${index + 1} of ${steps.length}: ${label}${index === activeStep ? ' (current)' : ''}${index < activeStep ? ' (completed)' : ''}`}
                aria-current={index === activeStep ? 'step' : undefined}
              >
                {label}
              </StepLabel>
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
          <Paper
            sx={{ p: 4, minHeight: 500 }}
            role="tabpanel"
            aria-labelledby={`step-${activeStep}-label`}
            aria-describedby="wizard-description"
          >
            {renderStepContent()}
          </Paper>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}
        role="navigation"
        aria-label="Wizard navigation controls"
      >
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<NavigateBefore />}
            onClick={handleBack}
            disabled={activeStep === 0 || loading}
            aria-label={`Go back to step ${activeStep}: ${steps[activeStep - 1] || ''}`}
          >
            Back
          </Button>

          {activeStep !== steps.length - 1 && (
            <Button
              variant="outlined"
              startIcon={<DraftsOutlined />}
              onClick={handleSaveDraft}
              disabled={loading || !wizardData.department}
              color="secondary"
              aria-label="Save current progress as draft and exit wizard"
            >
              Save Draft & Exit
            </Button>
          )}
        </Box>

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
                aria-label="Save schedule as draft without publishing"
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
                aria-label="Publish and finalize schedule"
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
              aria-label={`Proceed to step ${activeStep + 2}: ${steps[activeStep + 1]}`}
              title="Keyboard shortcut: Ctrl+Enter"
            >
              {activeStep === 2 ? 'Generate Schedule' : 'Next'}
            </Button>
          )}
        </Box>
      </Box>
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{ display: 'block', mt: 2, textAlign: 'center' }}
          aria-live="polite"
        >
          Keyboard shortcuts: Ctrl+Enter to proceed, Escape to cancel
        </Typography>

      {/* Resume Draft Dialog */}
      <Dialog
        open={showResumeDraftDialog}
        onClose={() => setShowResumeDraftDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <DraftsOutlined color="primary" />
            Resume Draft?
          </Box>
        </DialogTitle>
        <DialogContent>
          {draftData && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                You have an unsaved draft from {new Date(draftData.savedAt).toLocaleString()}
              </Alert>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    Draft Details:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {draftData.scheduleName || 'Untitled Schedule'}
                  </Typography>
                  {draftData.department && (
                    <Typography variant="body2" color="textSecondary">
                      Department: {draftData.department}
                    </Typography>
                  )}
                  {draftData.dateRange?.start && (
                    <Typography variant="body2" color="textSecondary">
                      Period: {new Date(draftData.dateRange.start).toLocaleDateString()} -
                      {new Date(draftData.dateRange.end).toLocaleDateString()}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary">
                    Step: {steps[draftData.activeStep || 0]}
                  </Typography>
                </CardContent>
              </Card>
              <Typography variant="body2">
                Would you like to continue where you left off, or start a new schedule?
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStartFresh} color="error">
            Start Fresh
          </Button>
          <Button onClick={handleResumeDraft} variant="contained" autoFocus>
            Resume Draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmExit} onClose={() => setConfirmExit(false)}>
        <DialogTitle>Cancel Schedule Creation?</DialogTitle>
        <DialogContent>
          <Typography>
            Your progress will be saved as a draft and you can return to this wizard later.
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
    </>
  );
};

export default ScheduleBuilder;
