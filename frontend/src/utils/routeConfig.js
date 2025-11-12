// Route configuration with role-based access control
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

export const ROUTES = {
  // Public routes
  LOGIN: '/login',
  REGISTER: '/register',

  // Protected routes
  DASHBOARD: '/dashboard',
  EMPLOYEES: '/employees',
  DEPARTMENTS: '/departments',
  SHIFTS: '/shifts',
  SCHEDULE: '/schedule',
  RULES: '/rules',
  ANALYTICS: '/analytics',
  ROLES: '/roles',
  SETTINGS: '/settings',
  PROFILE: '/profile',

  // Error routes
  NOT_FOUND: '/404'
};

export const ROUTE_CONFIG = [
  {
    path: ROUTES.LOGIN,
    component: 'LoginPage',
    isPublic: true,
    title: 'Login'
  },
  {
    path: ROUTES.REGISTER,
    component: 'RegisterPage',
    isPublic: true,
    title: 'Register'
  },
  {
    path: ROUTES.DASHBOARD,
    component: 'DashboardPage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE],
    title: 'Dashboard',
    icon: 'Dashboard'
  },
  {
    path: ROUTES.EMPLOYEES,
    component: 'EmployeesPage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER],
    title: 'Employee Management',
    icon: 'People'
  },
  {
    path: ROUTES.DEPARTMENTS,
    component: 'DepartmentManager',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER],
    title: 'Departments',
    icon: 'Business'
  },
  {
    path: ROUTES.SHIFTS,
    component: 'ShiftManager',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER],
    title: 'Shift Management',
    icon: 'AccessTime'
  },
  {
    path: ROUTES.SCHEDULE,
    component: 'SchedulePage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE],
    title: 'Schedule',
    icon: 'Schedule'
  },
  {
    path: ROUTES.RULES,
    component: 'RulesPage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER],
    title: 'Business Rules',
    icon: 'Rule'
  },
  {
    path: ROUTES.ANALYTICS,
    component: 'AnalyticsPage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER],
    title: 'Analytics',
    icon: 'Analytics'
  },
  {
    path: ROUTES.ROLES,
    component: 'RoleManager',
    requiredRoles: [ROLES.ADMIN],
    title: 'Role Management',
    icon: 'Security'
  },
  {
    path: ROUTES.SETTINGS,
    component: 'SettingsPage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE],
    title: 'Settings',
    icon: 'Settings'
  },
  {
    path: ROUTES.PROFILE,
    component: 'ProfilePage',
    requiredRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE],
    title: 'Profile',
    icon: 'Person'
  }
];

// Navigation groups for sidebar
export const NAV_GROUPS = [
  {
    title: 'Main',
    routes: [ROUTES.DASHBOARD, ROUTES.SCHEDULE]
  },
  {
    title: 'Management',
    routes: [ROUTES.EMPLOYEES, ROUTES.DEPARTMENTS, ROUTES.SHIFTS, ROUTES.RULES, ROUTES.ANALYTICS, ROUTES.ROLES]
  },
  {
    title: 'Account',
    routes: [ROUTES.PROFILE, ROUTES.SETTINGS]
  }
];
