import React, { useState, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Breadcrumbs,
  Link,
  Divider,
  Tooltip,
  useTheme,
  useMediaQuery,
  Collapse,
  ListSubheader
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Schedule,
  Rule,
  Analytics,
  Settings,
  Person,
  Logout,
  Home,
  ExpandLess,
  ExpandMore,
  ChevronRight,
  ViewModule,
  Business,
  AccessTime,
  Security
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { ROUTE_CONFIG, NAV_GROUPS, ROUTES } from '../../utils/routeConfig';

const DRAWER_WIDTH = 280;

const iconMap = {
  Dashboard,
  People,
  Schedule,
  Rule,
  Analytics,
  Settings,
  Person,
  ViewModule,
  Business,
  AccessTime,
  Security
};

const Layout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get current route config for breadcrumbs
  const currentRoute = useMemo(() => {
    return ROUTE_CONFIG.find(route => route.path === location.pathname);
  }, [location.pathname]);

  // Filter routes based on user role
  const accessibleRoutes = useMemo(() => {
    return ROUTE_CONFIG.filter(route => {
      if (route.isPublic) return false;
      if (!route.requiredRoles) return true;
      return hasRole(route.requiredRoles);
    });
  }, [hasRole]);

  // Generate breadcrumbs
  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs = [{ title: 'Home', path: '/' }];

    let currentPath = '';
    pathSegments.forEach(segment => {
      currentPath += `/${segment}`;
      const route = ROUTE_CONFIG.find(r => r.path === currentPath);
      if (route) {
        crumbs.push({ title: route.title, path: currentPath });
      }
    });

    return crumbs;
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    // Always close mobile drawer when navigating
    setMobileOpen(false);
  };

  const toggleGroupExpansion = (groupIndex) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupIndex]: !prev[groupIndex]
    }));
  };

  const renderNavItem = (route) => {
    const IconComponent = iconMap[route.icon];
    const isActive = location.pathname === route.path;

    return (
      <ListItem
        key={route.path}
        button
        onClick={() => handleNavigation(route.path)}
        sx={{
          mx: 1,
          borderRadius: 2,
          mb: 0.5,
          backgroundColor: isActive ? 'primary.main' : 'transparent',
          color: isActive ? 'primary.contrastText' : 'text.primary',
          '&:hover': {
            backgroundColor: isActive ? 'primary.dark' : 'action.hover',
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
          {IconComponent ? <IconComponent /> : <Schedule />}
        </ListItemIcon>
        <ListItemText
          primary={route.title}
          primaryTypographyProps={{
            fontSize: '0.9rem',
            fontWeight: isActive ? 600 : 400
          }}
        />
      </ListItem>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          ScheduleAI
        </Typography>
        <Typography variant="caption" color="textSecondary">
          Smart Scheduling Manager
        </Typography>
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <List>
          {NAV_GROUPS.map((group, groupIndex) => {
            const groupRoutes = group.routes
              .map(routePath => accessibleRoutes.find(r => r.path === routePath))
              .filter(Boolean);

            if (groupRoutes.length === 0) return null;

            const isExpanded = expandedGroups[groupIndex] !== false;

            return (
              <Box key={group.title}>
                <ListSubheader
                  component="div"
                  sx={{
                    bgcolor: 'transparent',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    py: 1,
                    px: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => toggleGroupExpansion(groupIndex)}
                >
                  {group.title}
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </ListSubheader>

                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  {groupRoutes.map(renderNavItem)}
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Typography variant="caption" color="textSecondary" textAlign="center" display="block">
          © 2024 AI Schedule Manager
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { lg: `${DRAWER_WIDTH}px` },
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Breadcrumbs */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <Breadcrumbs
              separator={<ChevronRight fontSize="small" />}
              sx={{ flex: 1 }}
            >
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return isLast ? (
                  <Typography key={crumb.path} color="primary" fontWeight={600}>
                    {crumb.title}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.path}
                    color="inherit"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation(crumb.path);
                    }}
                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {crumb.title}
                  </Link>
                );
              })}
            </Breadcrumbs>
          </Box>

          {/* User Menu */}
          <Tooltip title="Account settings">
            <IconButton onClick={handleUserMenuOpen} sx={{ ml: 2 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleUserMenuClose(); handleNavigation('/profile'); }}>
          <ListItemIcon><Person /></ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleUserMenuClose(); handleNavigation('/settings'); }}>
          <ListItemIcon><Settings /></ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><Logout /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider'
            },
          }}
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              position: 'relative',
              borderRight: '1px solid',
              borderColor: 'divider'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}

        {/* Page Content with Animation */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;