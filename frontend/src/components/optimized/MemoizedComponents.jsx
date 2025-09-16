import React, { memo, useMemo, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  List, 
  ListItem, 
  ListItemText,
  Button,
  Grid
} from '@mui/material';

// Memoized Employee Card
export const EmployeeCard = memo(({ employee, onEdit, onDelete }) => {
  const handleEdit = useCallback(() => {
    onEdit(employee.id);
  }, [employee.id, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(employee.id);
  }, [employee.id, onDelete]);

  const fullName = useMemo(() => {
    return `${employee.firstName} ${employee.lastName}`;
  }, [employee.firstName, employee.lastName]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{fullName}</Typography>
        <Typography color="textSecondary">{employee.position}</Typography>
        <Typography variant="body2">{employee.email}</Typography>
        <Button onClick={handleEdit} size="small">Edit</Button>
        <Button onClick={handleDelete} size="small" color="error">Delete</Button>
      </CardContent>
    </Card>
  );
});

// Memoized Schedule Item
export const ScheduleItem = memo(({ schedule, onUpdate }) => {
  const formattedDate = useMemo(() => {
    return new Date(schedule.date).toLocaleDateString();
  }, [schedule.date]);

  const handleUpdate = useCallback((updates) => {
    onUpdate(schedule.id, updates);
  }, [schedule.id, onUpdate]);

  return (
    <ListItem>
      <ListItemText
        primary={`${schedule.employeeName} - ${schedule.shift}`}
        secondary={`${formattedDate} (${schedule.startTime} - ${schedule.endTime})`}
      />
    </ListItem>
  );
});

// Memoized Rule Display
export const RuleDisplay = memo(({ rule, onToggle, onEdit }) => {
  const handleToggle = useCallback(() => {
    onToggle(rule.id, !rule.active);
  }, [rule.id, rule.active, onToggle]);

  const handleEdit = useCallback(() => {
    onEdit(rule.id);
  }, [rule.id, onEdit]);

  const ruleDescription = useMemo(() => {
    return `${rule.name}: ${rule.description}`;
  }, [rule.name, rule.description]);

  return (
    <Card variant={rule.active ? 'elevation' : 'outlined'}>
      <CardContent>
        <Typography variant="h6">{ruleDescription}</Typography>
        <Button onClick={handleToggle}>
          {rule.active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button onClick={handleEdit}>Edit</Button>
      </CardContent>
    </Card>
  );
});

// Memoized Dashboard Stats
export const DashboardStats = memo(({ stats }) => {
  const formattedStats = useMemo(() => {
    return {
      totalEmployees: stats.totalEmployees?.toLocaleString() || '0',
      totalShifts: stats.totalShifts?.toLocaleString() || '0',
      completionRate: `${(stats.completionRate * 100).toFixed(1)}%`,
      avgHoursPerEmployee: stats.avgHoursPerEmployee?.toFixed(1) || '0'
    };
  }, [stats]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Total Employees</Typography>
            <Typography variant="h4">{formattedStats.totalEmployees}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Total Shifts</Typography>
            <Typography variant="h4">{formattedStats.totalShifts}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Completion Rate</Typography>
            <Typography variant="h4">{formattedStats.completionRate}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} md={3}>
        <Card>
          <CardContent>
            <Typography color="textSecondary">Avg Hours/Employee</Typography>
            <Typography variant="h4">{formattedStats.avgHoursPerEmployee}</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
});

// Set display names for better debugging
EmployeeCard.displayName = 'EmployeeCard';
ScheduleItem.displayName = 'ScheduleItem';
RuleDisplay.displayName = 'RuleDisplay';
DashboardStats.displayName = 'DashboardStats';
