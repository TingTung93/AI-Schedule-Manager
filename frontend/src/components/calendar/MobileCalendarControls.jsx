import React, { useState } from 'react';
import { SpeedDial, SpeedDialAction, useMediaQuery, useTheme } from '@mui/material';
import { Add, Today, ViewWeek, FilterList, Menu } from '@mui/icons-material';

/**
 * MobileCalendarControls - SpeedDial component for mobile calendar actions
 *
 * Provides touch-friendly floating action button menu for mobile devices
 * Features:
 * - Fixed position bottom-right
 * - Touch-friendly 56x56px FAB with 44x44px minimum touch targets
 * - Actions: Add Shift, Today, Change View, Filter
 * - Only displays on mobile devices
 * - Auto-closes after action selection
 *
 * @param {Object} props
 * @param {Function} props.onAddShift - Handler for adding new shift
 * @param {Function} props.onChangeView - Handler for cycling through views
 * @param {Function} props.onToday - Handler for navigating to today
 * @param {Function} props.onFilter - Handler for opening filter dialog
 * @param {boolean} props.isMobile - Whether to show mobile controls
 */
const MobileCalendarControls = ({
  onAddShift,
  onChangeView,
  onToday,
  onFilter,
  isMobile
}) => {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  // Use theme breakpoint if isMobile not provided
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const shouldShow = isMobile !== undefined ? isMobile : isSmallScreen;

  // Don't render on desktop
  if (!shouldShow) return null;

  const actions = [
    {
      icon: <Add />,
      name: 'Add Shift',
      onClick: onAddShift,
      color: 'primary'
    },
    {
      icon: <Today />,
      name: 'Today',
      onClick: onToday,
      color: 'default'
    },
    {
      icon: <ViewWeek />,
      name: 'Change View',
      onClick: onChangeView,
      color: 'default'
    },
    {
      icon: <FilterList />,
      name: 'Filter',
      onClick: onFilter,
      color: 'default'
    },
  ];

  const handleActionClick = (action) => {
    if (action.onClick) {
      action.onClick();
    }
    setOpen(false);
  };

  return (
    <SpeedDial
      ariaLabel="Calendar actions"
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1300, // Above most MUI components
        '& .MuiFab-primary': {
          width: 56,
          height: 56,
          boxShadow: theme.shadows[6],
          '&:hover': {
            transform: 'scale(1.05)',
            transition: 'transform 0.2s'
          }
        },
        // Ensure touch-friendly spacing between actions
        '& .MuiSpeedDialAction-fab': {
          minWidth: 44,
          minHeight: 44,
          margin: '4px 0'
        }
      }}
      icon={<Menu />}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      open={open}
      direction="up"
      FabProps={{
        color: 'primary',
        'aria-label': 'Calendar actions menu'
      }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          onClick={() => handleActionClick(action)}
          tooltipOpen
          FabProps={{
            'aria-label': action.name,
            sx: {
              minWidth: 44,
              minHeight: 44
            }
          }}
          sx={{
            '& .MuiSpeedDialAction-staticTooltip': {
              minWidth: 120,
              whiteSpace: 'nowrap',
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              boxShadow: theme.shadows[2],
              padding: '6px 12px',
              borderRadius: '4px'
            }
          }}
        />
      ))}
    </SpeedDial>
  );
};

export default MobileCalendarControls;
