import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Chip,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Rule as RuleIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Notifications as NotificationsIcon,
  ChevronLeft as ChevronLeftIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService, notificationService } from '../services/api';
import { useApi } from '../hooks/useApi';

const DRAWER_WIDTH = 280;

const Navigation = ({ children, onThemeToggle, darkMode = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState(null);
  const [user, setUser] = useState(null);

  // Get current user
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  // Navigation items
  const navigationItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      description: 'Overview and metrics',
    },
    {
      text: 'Employees',
      icon: <PeopleIcon />,
      path: '/employees',
      description: 'Manage staff members',
    },
    {
      text: 'Schedules',
      icon: <ScheduleIcon />,
      path: '/schedules',
      description: 'View and edit schedules',
    },
    {
      text: 'Rules',
      icon: <RuleIcon />,
      path: '/rules',
      description: 'Scheduling rules and constraints',
    },
    {
      text: 'Analytics',
      icon: <AnalyticsIcon />,
      path: '/analytics',
      description: 'Reports and insights',
    },
    {
      text: 'Settings',
      icon: <SettingsIcon />,
      path: '/settings',
      description: 'System configuration',
    },
  ];

  // Get notifications
  const { data: notificationsData } = useApi(
    () => notificationService.getNotifications(),
    [],
    {
      onError: (error) => {
        console.error('Failed to load notifications:', error);
      }
    }
  );

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  // Event handlers
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleNotificationMenuOpen = (event) => {
    setNotificationMenuAnchor(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationMenuAnchor(null);
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    handleProfileMenuClose();
  };

  const handleProfile = () => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const handleNotificationClick = (notification) => {
    // Mark as read and navigate if needed
    if (!notification.read) {
      notificationService.markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }

    handleNotificationMenuClose();
  };

  const isCurrentPath = (path) => {
    return location.pathname === path ||
           (path === '/dashboard' && location.pathname === '/');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.firstName || user.email?.charAt(0) || '';
    const lastName = user.lastName || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (!user) return 'Unknown User';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || 'Unknown User';
  };

  // Drawer content
  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Header */}
      <Box sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        minHeight: 64,
      }}>
        <ScheduleIcon sx={{ mr: 1 }} />
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          AI Schedule Manager
        </Typography>
        {!isMobile && (
          <IconButton
            color="inherit"
            onClick={handleDrawerToggle}
            edge="end"
            aria-label="Close navigation drawer"
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flexGrow: 1, px: 1 }}>
        {navigationItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <Tooltip title={item.description} placement="right" arrow>
              <ListItemButton
                onClick={() => handleNavigate(item.path)}
                selected={isCurrentPath(item.path)}
                sx={{
                  borderRadius: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  },
                }}
                role="button"
                aria-label={`Navigate to ${item.text}`}
              >
                <ListItemIcon
                  sx={{
                    color: isCurrentPath(item.path) ? 'inherit' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  secondary={!isCurrentPath(item.path) ? item.description : null}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* User Info in Drawer */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}>
            {getUserInitials()}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {getUserDisplayName()}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'User'}
            </Typography>
          </Box>
        </Box>

        {user?.role && (
          <Chip
            label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)` },
          ml: { md: drawerOpen ? `${DRAWER_WIDTH}px` : 0 },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          {/* Menu button for mobile */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="Open navigation drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Title */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {navigationItems.find(item => isCurrentPath(item.path))?.text || 'AI Schedule Manager'}
          </Typography>

          {/* Theme toggle */}
          {onThemeToggle && (
            <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton color="inherit" onClick={onThemeToggle} aria-label="Toggle theme">
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              onClick={handleNotificationMenuOpen}
              aria-label={`${unreadCount} unread notifications`}
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Profile Menu */}
          <Tooltip title="Account menu">
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              sx={{ ml: 1 }}
              aria-label="Account menu"
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {getUserInitials()}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerOpen ? DRAWER_WIDTH : 0 }, flexShrink: { md: 0 } }}
        aria-label="Navigation menu"
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : 0}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 200,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{getUserDisplayName()}</Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          Profile Settings
        </MenuItem>
        <MenuItem onClick={() => navigate('/settings')}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          App Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationMenuAnchor}
        open={Boolean(notificationMenuAnchor)}
        onClose={handleNotificationMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            maxWidth: 360,
            maxHeight: 400,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">
            Notifications ({unreadCount} unread)
          </Typography>
        </Box>

        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          notifications.slice(0, 5).map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              sx={{
                py: 1,
                px: 2,
                borderLeft: notification.read ? 'none' : '3px solid',
                borderColor: 'primary.main',
                bgcolor: notification.read ? 'inherit' : 'action.hover',
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" fontWeight={notification.read ? 'normal' : 'medium'}>
                  {notification.title || notification.message}
                </Typography>
                {notification.description && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {notification.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {new Date(notification.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}

        {notifications.length > 5 && (
          <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <Button size="small" onClick={() => navigate('/notifications')}>
              View All Notifications
            </Button>
          </Box>
        )}
      </Menu>
    </Box>
  );
};

export default Navigation;