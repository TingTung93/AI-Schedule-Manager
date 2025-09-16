/**
 * FormErrorSummary component to display form validation errors in a summary format
 */

import React from 'react';
import {
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  Typography,
  Button,
  Paper
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { formatValidationErrors } from '../../utils/validation';

const FormErrorSummary = ({
  errors,
  title = 'Please fix the following errors:',
  severity = 'error',
  variant = 'outlined',
  collapsible = false,
  defaultExpanded = true,
  onErrorClick,
  showFieldPath = false,
  maxHeight = 300,
  sx = {},
  ...props
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // Format errors into a flat array of error messages
  const errorMessages = React.useMemo(() => {
    if (!errors || typeof errors !== 'object') return [];

    const formatError = (error, path = '') => {
      const messages = [];

      if (typeof error === 'string') {
        messages.push({
          message: error,
          path: path,
          field: path.split('.').pop() || ''
        });
      } else if (error && typeof error === 'object') {
        if (error.message) {
          messages.push({
            message: error.message,
            path: path,
            field: path.split('.').pop() || ''
          });
        } else {
          Object.keys(error).forEach(key => {
            const newPath = path ? `${path}.${key}` : key;
            messages.push(...formatError(error[key], newPath));
          });
        }
      }

      return messages;
    };

    const formattedErrors = [];
    Object.keys(errors).forEach(key => {
      formattedErrors.push(...formatError(errors[key], key));
    });

    return formattedErrors;
  }, [errors]);

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleErrorClick = (errorItem) => {
    if (onErrorClick) {
      onErrorClick(errorItem);
    }
  };

  const getFieldDisplayName = (fieldPath) => {
    if (!fieldPath) return '';

    // Convert field path to human-readable format
    return fieldPath
      .split('.')
      .map(part => {
        // Convert camelCase to Title Case
        return part
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
      })
      .join(' → ');
  };

  if (!errorMessages.length) {
    return null;
  }

  const alertIcon = severity === 'error' ? <ErrorIcon /> : <WarningIcon />;

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        ...sx
      }}
      {...props}
    >
      <Alert
        severity={severity}
        variant={variant}
        icon={alertIcon}
        sx={{
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <AlertTitle sx={{ mb: collapsible ? 0 : 1 }}>
            {title}
          </AlertTitle>

          {collapsible && (
            <Button
              size="small"
              onClick={handleToggleExpanded}
              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              sx={{ minWidth: 'auto', p: 0.5 }}
            >
              {expanded ? 'Hide' : `Show ${errorMessages.length} error${errorMessages.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </Box>

        <Collapse in={!collapsible || expanded}>
          <Box
            sx={{
              maxHeight: maxHeight,
              overflow: 'auto',
              mt: collapsible ? 1 : 0
            }}
          >
            <List dense sx={{ py: 0 }}>
              {errorMessages.map((errorItem, index) => (
                <ListItem
                  key={index}
                  sx={{
                    py: 0.5,
                    px: 0,
                    cursor: onErrorClick ? 'pointer' : 'default',
                    '&:hover': onErrorClick ? {
                      backgroundColor: 'action.hover',
                      borderRadius: 1
                    } : {}
                  }}
                  onClick={() => handleErrorClick(errorItem)}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <ErrorIcon
                      color={severity}
                      sx={{ fontSize: 16 }}
                    />
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box>
                        {showFieldPath && errorItem.path && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ fontWeight: 500 }}
                          >
                            {getFieldDisplayName(errorItem.path)}:
                          </Typography>
                        )}
                        <Typography
                          variant="body2"
                          component="span"
                        >
                          {errorItem.message}
                        </Typography>
                      </Box>
                    }
                    sx={{ my: 0 }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Collapse>
      </Alert>
    </Paper>
  );
};

export default FormErrorSummary;