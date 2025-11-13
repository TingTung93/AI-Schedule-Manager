import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * ProgressIndicator Component
 *
 * Displays a progress bar with percentage and status message
 * Used during file uploads and downloads
 */
const ProgressIndicator = ({ progress, message }) => {
  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                transition: 'transform 0.2s ease-in-out'
              }
            }}
          />
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ minWidth: 45, textAlign: 'right', fontWeight: 'medium' }}
        >
          {Math.round(progress)}%
        </Typography>
      </Box>
      {message && (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

ProgressIndicator.propTypes = {
  progress: PropTypes.number.isRequired,
  message: PropTypes.string
};

ProgressIndicator.defaultProps = {
  message: ''
};

export default ProgressIndicator;
