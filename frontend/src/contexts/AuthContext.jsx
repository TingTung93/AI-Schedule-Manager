/**
 * Authentication Context
 *
 * Provides authentication state management and user session handling
 * across the React application with JWT token integration.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../services/api';

// Initial authentication state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  csrfToken: null
};

// Authentication actions
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REFRESH_TOKEN_SUCCESS: 'REFRESH_TOKEN_SUCCESS',
  REFRESH_TOKEN_FAILURE: 'REFRESH_TOKEN_FAILURE',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_CSRF_TOKEN: 'SET_CSRF_TOKEN'
};

// Authentication reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        csrfToken: null
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_SUCCESS:
      return {
        ...state,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.REFRESH_TOKEN_FAILURE:
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload.userData }
      };

    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading
      };

    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload.error,
        isLoading: false
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    case AUTH_ACTIONS.SET_CSRF_TOKEN:
      return {
        ...state,
        csrfToken: action.payload.token
      };

    default:
      return state;
  }
};

// Create authentication context
const AuthContext = createContext(null);

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const initializingRef = React.useRef(false);

  // Initialize authentication state on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    // Prevent multiple simultaneous initializations
    if (initializingRef.current) {
      return;
    }

    // Don't initialize auth on login/register pages - user is trying to authenticate
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      return;
    }

    try {
      initializingRef.current = true;
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: { isLoading: true } });

      // Try to get current user (this will use existing cookies)
      const response = await authService.getCurrentUser();

      if (response.data.user) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: { user: response.data.user }
        });

        // Set access token if provided
        if (response.data.access_token) {
          authService.setAccessToken(response.data.access_token);
        }

        // Get CSRF token (but don't fail if it doesn't work)
        try {
          await getCsrfToken();
        } catch (csrfError) {
          console.warn('CSRF token fetch failed:', csrfError);
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
      }
    } catch (error) {
      // Handle network errors gracefully - don't spam console
      if (error.code === 'ECONNABORTED' || error.message?.includes('Network error')) {
        console.debug('Auth initialization skipped - network not ready');
      } else {
        console.warn('Authentication initialization failed:', error.message);
      }
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    } finally {
      initializingRef.current = false;
    }
  };

  const login = async (userData, accessToken) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      // Set the access token in the service
      if (accessToken) {
        authService.setAccessToken(accessToken);
      }

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user: userData }
      });

      // Get CSRF token for future requests
      await getCsrfToken();

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';

      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: errorMessage }
      });

      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.LOGIN_START });

      // Call the registration API
      const response = await authService.register({
        email: userData.email,
        password: userData.password,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
        department: userData.department
      });

      // Set the access token if provided
      if (response.data.access_token) {
        authService.setAccessToken(response.data.access_token);
      }

      // Update auth state with user data
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user: response.data.user }
      });

      // Get CSRF token for future requests
      await getCsrfToken();

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Registration failed';

      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: errorMessage }
      });

      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      // Call logout API to clear server-side session
      await authService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken();

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN_SUCCESS
      });

      return { success: true, accessToken: response.data.access_token };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Token refresh failed';

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN_FAILURE,
        payload: { error: errorMessage }
      });

      return { success: false, error: errorMessage };
    }
  };

  const updateUser = (userData) => {
    dispatch({
      type: AUTH_ACTIONS.UPDATE_USER,
      payload: { userData }
    });
  };

  const getCsrfToken = async () => {
    try {
      const token = await authService.getCsrfToken();
      if (token) {
        dispatch({
          type: AUTH_ACTIONS.SET_CSRF_TOKEN,
          payload: { token }
        });
      }
      return token;
    } catch (error) {
      console.warn('Failed to get CSRF token:', error);
      return null;
    }
  };

  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const setError = (error) => {
    dispatch({
      type: AUTH_ACTIONS.SET_ERROR,
      payload: { error }
    });
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.roles?.includes(role) || false;
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return state.user?.permissions?.includes(permission) || false;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    if (!Array.isArray(roles)) return false;
    return roles.some(role => hasRole(role));
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissions) => {
    if (!Array.isArray(permissions)) return false;
    return permissions.some(permission => hasPermission(permission));
  };

  // Get user's full name
  const getUserDisplayName = () => {
    if (!state.user) return '';
    return state.user.full_name || `${state.user.first_name} ${state.user.last_name}` || state.user.email;
  };

  // Context value
  const contextValue = {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    csrfToken: state.csrfToken,

    // Actions
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    getCsrfToken,
    clearError,
    setError,

    // Utility functions
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAnyPermission,
    getUserDisplayName
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use authentication context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

// Higher-order component for authentication
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const auth = useAuth();

    if (auth.isLoading) {
      return (
        <div className="auth-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      );
    }

    if (!auth.isAuthenticated) {
      return (
        <div className="auth-required">
          <p>Authentication required</p>
        </div>
      );
    }

    return <Component {...props} auth={auth} />;
  };
};

// Role-based component wrapper
export const RoleGuard = ({ children, roles, fallback = null }) => {
  const { hasAnyRole } = useAuth();

  if (!hasAnyRole(roles)) {
    return fallback;
  }

  return children;
};

// Permission-based component wrapper
export const PermissionGuard = ({ children, permissions, fallback = null }) => {
  const { hasAnyPermission } = useAuth();

  if (!hasAnyPermission(permissions)) {
    return fallback;
  }

  return children;
};

// Export action types for external use
export { AUTH_ACTIONS };

// Memory storage for development tracking
const storeAuthContextImplementation = () => {
  try {
    if (typeof window !== 'undefined' && window.memory_store) {
      const implementation = {
        auth_context: {
          state_management: 'useReducer with comprehensive auth state',
          features: [
            'JWT token integration',
            'Role-based access control',
            'Permission-based access control',
            'CSRF token management',
            'Automatic token refresh',
            'Error handling',
            'Loading states'
          ],
          components: [
            'AuthProvider - Main context provider',
            'useAuth - Custom hook for auth state',
            'withAuth - HOC for authentication',
            'RoleGuard - Role-based component wrapper',
            'PermissionGuard - Permission-based component wrapper'
          ],
          utilities: [
            'hasRole - Check user role',
            'hasPermission - Check user permission',
            'hasAnyRole - Check multiple roles',
            'hasAnyPermission - Check multiple permissions',
            'getUserDisplayName - Get formatted user name'
          ]
        }
      };

      window.memory_store.store('development/auth/context', implementation);
    }
  } catch (error) {
    console.warn('Failed to store auth context implementation:', error);
  }
};

// Store implementation details
storeAuthContextImplementation();

export default AuthContext;