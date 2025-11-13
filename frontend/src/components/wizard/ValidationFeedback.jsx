import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Collapse
} from '@mui/material';
import { Error as ErrorIcon, Warning as WarningIcon } from '@mui/icons-material';

/**
 * ValidationFeedback Component
 *
 * Displays inline validation messages explaining why the "Next" button is disabled.
 * Shows actionable error messages that update in real-time as the user fixes issues.
 *
 * @param {Array} validations - Array of validation rule objects
 * @param {Object} currentData - Current form data to validate against
 */
const ValidationFeedback = ({ validations, currentData }) => {
  // Run all validations and collect errors and warnings
  const errors = [];
  const warnings = [];

  validations.forEach(validation => {
    const result = validation.validator(currentData);
    if (result) {
      if (validation.severity === 'warning') {
        warnings.push({
          field: validation.field,
          message: result
        });
      } else {
        errors.push({
          field: validation.field,
          message: result
        });
      }
    }
  });

  // Don't render anything if no errors or warnings
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* Error Messages */}
      <Collapse in={errors.length > 0}>
        <Alert
          severity="error"
          sx={{ mb: warnings.length > 0 ? 2 : 0 }}
          variant="outlined"
        >
          <AlertTitle sx={{ fontWeight: 'bold' }}>
            Please fix the following {errors.length === 1 ? 'issue' : 'issues'} to continue:
          </AlertTitle>
          <List dense sx={{ pt: 0, pb: 0 }}>
            {errors.map((error, index) => (
              <ListItem key={`error-${error.field}-${index}`} sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={error.message}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      </Collapse>

      {/* Warning Messages */}
      <Collapse in={warnings.length > 0}>
        <Alert
          severity="warning"
          variant="outlined"
        >
          <AlertTitle sx={{ fontWeight: 'bold' }}>
            Recommendations:
          </AlertTitle>
          <List dense sx={{ pt: 0, pb: 0 }}>
            {warnings.map((warning, index) => (
              <ListItem key={`warning-${warning.field}-${index}`} sx={{ py: 0.5, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <WarningIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={warning.message}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      </Collapse>
    </Box>
  );
};

ValidationFeedback.propTypes = {
  validations: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      validator: PropTypes.func.isRequired,
      severity: PropTypes.oneOf(['error', 'warning'])
    })
  ).isRequired,
  currentData: PropTypes.object.isRequired
};

export default ValidationFeedback;
