import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  Collapse
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon
} from '@mui/material';

/**
 * StepProgress Component
 *
 * Shows a checklist of step requirements with visual indicators for completion.
 * Helps users understand what is needed to proceed to the next step.
 *
 * @param {Array} requirements - Array of requirement objects
 * @param {Array} completedItems - Array of completed requirement IDs
 * @param {Boolean} showProgress - Whether to show the progress indicator
 */
const StepProgress = ({ requirements, completedItems = [], showProgress = true }) => {
  const completedCount = completedItems.length;
  const totalCount = requirements.length;
  const allComplete = completedCount === totalCount;

  if (!showProgress || requirements.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: allComplete ? 'success.light' : 'background.paper',
          borderColor: allComplete ? 'success.main' : 'divider',
          transition: 'all 0.3s ease'
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" fontWeight="bold">
            Step Requirements
          </Typography>
          <Typography
            variant="caption"
            color={allComplete ? 'success.main' : 'text.secondary'}
            fontWeight="bold"
          >
            {completedCount} of {totalCount} complete
          </Typography>
        </Box>

        <List dense sx={{ pt: 0, pb: 0 }}>
          {requirements.map((requirement) => {
            const isCompleted = completedItems.includes(requirement.id);

            return (
              <ListItem
                key={requirement.id}
                sx={{
                  py: 0.5,
                  px: 0,
                  transition: 'opacity 0.3s ease',
                  opacity: isCompleted ? 0.7 : 1
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {isCompleted ? (
                    <CheckCircleIcon
                      color="success"
                      fontSize="small"
                    />
                  ) : (
                    <UncheckedIcon
                      color="disabled"
                      fontSize="small"
                    />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'text.disabled' : 'text.primary'
                      }}
                    >
                      {requirement.label}
                    </Typography>
                  }
                  secondary={
                    requirement.hint && !isCompleted ? (
                      <Typography variant="caption" color="text.secondary">
                        {requirement.hint}
                      </Typography>
                    ) : null
                  }
                />
              </ListItem>
            );
          })}
        </List>

        <Collapse in={allComplete}>
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'success.main',
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" color="success.main" fontWeight="bold">
              ✓ All requirements complete! Click "Next" to continue.
            </Typography>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

StepProgress.propTypes = {
  requirements: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      hint: PropTypes.string
    })
  ).isRequired,
  completedItems: PropTypes.arrayOf(PropTypes.string),
  showProgress: PropTypes.bool
};

export default StepProgress;
