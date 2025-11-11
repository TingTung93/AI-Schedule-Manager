import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Paper,
  Grid,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useApi, useApiMutation } from '../hooks/useApi';

const RuleInput = () => {
  const [ruleText, setRuleText] = useState('');
  const [rules, setRules] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch existing rules on mount
  const { data: rulesData, loading: loadingRules, refetch: refetchRules } = useApi(
    () => api.get('/api/rules'),
    [],
    {
      onSuccess: (data) => {
        setRules(data.rules || []);
      },
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to load rules' });
      }
    }
  );

  // Setup mutations for API calls
  const { mutate: parseRuleMutation, loading: parsingApi } = useApiMutation(
    (ruleText) => api.post('/api/rules/parse', { rule_text: ruleText }),
    {
      onSuccess: (result) => {
        setParsedResult(result);
        setShowPreview(true);
      },
      onError: (error) => {
        setNotification({ type: 'error', message: error.message || 'Failed to parse rule' });
      }
    }
  );

  const { mutate: deleteRuleMutation } = useApiMutation(
    (id) => api.delete(`/api/rules/${id}`),
    {
      onSuccess: () => {
        refetchRules();
        setNotification({ type: 'info', message: 'Rule removed' });
      },
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to delete rule' });
      }
    }
  );

  const { mutate: updateRuleMutation } = useApiMutation(
    ({ id, data }) => api.put(`/api/rules/${id}`, data),
    {
      onSuccess: () => {
        refetchRules();
      },
      onError: (error) => {
        setNotification({ type: 'error', message: 'Failed to update rule' });
      }
    }
  );

  // Example rules for demonstration
  const exampleRules = [
    "Sarah can't work past 5pm on weekdays due to childcare",
    "John prefers morning shifts on weekends",
    "We need at least 3 people during lunch hours (11am-2pm)",
    "Mike needs Mondays off for college classes",
    "No one should work more than 40 hours per week",
    "Maria can only work afternoons after 2pm",
  ];

  const parseRule = async () => {
    setParsing(true);
    try {
      await parseRuleMutation(ruleText);
    } finally {
      setParsing(false);
    }
  };

  const confirmRule = () => {
    if (parsedResult) {
      const newRule = {
        id: parsedResult.id || Date.now(),
        text: ruleText,
        ...parsedResult,
        active: true,
        createdAt: parsedResult.created_at || new Date().toISOString(),
      };
      
      setRules([...rules, newRule]);
      setRuleText('');
      setParsedResult(null);
      setShowPreview(false);
      setNotification({ type: 'success', message: 'Rule added successfully' });
      
      // Refresh rules from backend to ensure sync
      refetchRules();
    }
  };

  const deleteRule = async (ruleId) => {
    await deleteRuleMutation(ruleId);
  };

  const toggleRuleActive = async (ruleId) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      await updateRuleMutation(ruleId, { active: !rule.active });
    }
  };

  const getRuleTypeColor = (type) => {
    const colors = {
      availability: 'error',
      preference: 'info',
      requirement: 'warning',
      restriction: 'secondary',
    };
    return colors[type] || 'default';
  };

  const getRuleIcon = (type) => {
    if (type === 'availability') return <ScheduleIcon />;
    if (type === 'preference') return <PersonIcon />;
    return <InfoIcon />;
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        AI Schedule Manager - Rule Creator
      </Typography>

      <Grid container spacing={3}>
        {/* Rule Input Section */}
        <Grid item xs={12} md={8}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Create Scheduling Rule
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Type your scheduling rule in plain English. Our AI will understand and apply it.
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder="Example: Sarah can't work past 5pm on weekdays due to childcare"
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={parseRule}
                  disabled={!ruleText.trim() || parsing || parsingApi}
                >
                  Parse Rule
                </Button>
                
                {(parsing || parsingApi) && (
                  <Box sx={{ flexGrow: 1 }}>
                    <LinearProgress />
                  </Box>
                )}
              </Box>

              {/* Example Rules */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Quick Examples:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {exampleRules.map((example, idx) => (
                    <Chip
                      key={idx}
                      label={example}
                      size="small"
                      onClick={() => setRuleText(example)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Active Rules List */}
          <Card elevation={3} sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Rules ({loadingRules ? '...' : rules.length})
              </Typography>

              {loadingRules ? (
                <LinearProgress />
              ) : rules.length === 0 ? (
                <Alert severity="info">
                  No rules created yet. Add your first rule above!
                </Alert>
              ) : (
                <List>
                  {rules.map((rule) => (
                    <React.Fragment key={rule.id}>
                      <ListItem>
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                          {getRuleIcon(rule.rule_type)}
                        </Box>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">
                                {rule.text}
                              </Typography>
                              <Chip
                                label={rule.rule_type}
                                size="small"
                                color={getRuleTypeColor(rule.rule_type)}
                              />
                              {!rule.active && (
                                <Chip label="Inactive" size="small" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {rule.employee && `Employee: ${rule.employee} • `}
                              Added: {new Date(rule.createdAt).toLocaleString()}
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => toggleRuleActive(rule.id)}
                            sx={{ mr: 1 }}
                          >
                            {rule.active ? <CheckIcon /> : <CloseIcon />}
                          </IconButton>
                          <IconButton
                            edge="end"
                            onClick={() => deleteRule(rule.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Info Panel */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom>
              How It Works
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemText
                  primary="1. Natural Language Input"
                  secondary="Type rules exactly as you would say them"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. AI Understanding"
                  secondary="Our AI parses and understands your intent"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3. Automatic Application"
                  secondary="Rules are automatically applied to scheduling"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="4. Conflict Resolution"
                  secondary="The system handles conflicts intelligently"
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Supported Rule Types:
            </Typography>
            
            <Box sx={{ mb: 1 }}>
              <Chip 
                label="Availability" 
                color="error" 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Typography variant="caption">
                When employees can/cannot work
              </Typography>
            </Box>
            
            <Box sx={{ mb: 1 }}>
              <Chip 
                label="Preference" 
                color="info" 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Typography variant="caption">
                Employee scheduling preferences
              </Typography>
            </Box>
            
            <Box sx={{ mb: 1 }}>
              <Chip 
                label="Requirement" 
                color="warning" 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Typography variant="caption">
                Minimum staffing levels
              </Typography>
            </Box>
            
            <Box sx={{ mb: 1 }}>
              <Chip 
                label="Restriction" 
                color="secondary" 
                size="small" 
                sx={{ mr: 1 }}
              />
              <Typography variant="caption">
                Maximum hours/shift limits
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Parse Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rule Preview</DialogTitle>
        <DialogContent>
          {parsedResult && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Rule parsed successfully!
              </Alert>
              
              <Typography variant="subtitle2" gutterBottom>
                Interpreted as:
              </Typography>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="body2">
                  <strong>Type:</strong> {parsedResult.rule_type}
                </Typography>
                {parsedResult.employee && (
                  <Typography variant="body2">
                    <strong>Employee:</strong> {parsedResult.employee}
                  </Typography>
                )}
                {parsedResult.constraints && parsedResult.constraints.length > 0 && (
                  <Typography variant="body2">
                    <strong>Constraints:</strong> {parsedResult.constraints.length} found
                  </Typography>
                )}
              </Paper>
              
              <Typography variant="caption" color="text.secondary">
                This rule will be applied to all future schedule generations.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Cancel
          </Button>
          <Button onClick={confirmRule} variant="contained" color="primary">
            Confirm & Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
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

export default RuleInput;