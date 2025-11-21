import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { persistState, restoreState } from '../utils/persistence';
import apiClient, { getErrorMessage, tokenManager } from '../services/api';

const AuthContext = createContext();

// Auth action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Initial auth state
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  lastLoginAttempt: null,
};

// Auth reducer
function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
        loginAttempts: state.loginAttempts + 1,
        lastLoginAttempt: new Date().toISOString(),
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        loginAttempts: 0,
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        loginAttempts: state.loginAttempts,
        lastLoginAttempt: state.lastLoginAttempt,
      };

    case AUTH_ACTIONS.REFRESH_TOKEN:
      return {
        ...state,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
      };

    case AUTH_ACTIONS.UPDATE_PROFILE:
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload.updates,
        },
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Auth Provider Component
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore auth state on mount
  useEffect(() => {
    const savedState = restoreState('auth');
    if (savedState && savedState.token) {
      // Validate token expiry
      const tokenPayload = parseJwt(savedState.token);
      if (tokenPayload && tokenPayload.exp * 1000 > Date.now()) {
        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: savedState,
        });
      } else {
        // Token expired, attempt refresh
        if (savedState.refreshToken) {
          refreshToken(savedState.refreshToken);
        }
      }
    }
  }, []);

  // Persist auth state changes
  useEffect(() => {
    if (state.isAuthenticated) {
      persistState('auth', {
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      });
    } else {
      persistState('auth', null);
    }
  }, [state.user, state.token, state.refreshToken, state.isAuthenticated]);

  // Login function
  const login = async (userData, accessToken) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      // Support both direct login (with user data and token) and credential-based login
      if (typeof userData === 'object' && userData.email && userData.password && !accessToken) {
        // Credentials provided - make API call
        const credentials = userData;
        const response = await apiClient.post('/api/auth/login', credentials);

        // Set token in API client
        const token = response.data.token || response.data.accessToken;
        tokenManager.setAccessToken(token);

        // Get CSRF token for future requests
        await tokenManager.getCsrfToken();

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: response.data.user,
            token: token,
            refreshToken: response.data.refreshToken || response.data.refresh_token,
          },
        });

        return { success: true, user: response.data.user };
      } else {
        // User data and token provided directly - update state
        tokenManager.setAccessToken(accessToken);

        dispatch({
          type: AUTH_ACTIONS.LOGIN_SUCCESS,
          payload: {
            user: userData,
            token: accessToken,
            refreshToken: null,
          },
        });

        return { success: true, user: userData };
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: { error: errorMessage },
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (state.token) {
        await apiClient.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens
      tokenManager.clearAccessToken();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Refresh token function
  const refreshToken = async (refreshTokenValue) => {
    try {
      const response = await apiClient.post('/api/auth/refresh', {
        refreshToken: refreshTokenValue
      });

      const token = response.data.token || response.data.accessToken;
      tokenManager.setAccessToken(token);

      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN,
        payload: {
          token: token,
          refreshToken: response.data.refreshToken || response.data.refresh_token,
        },
      });

      return true;
    } catch (error) {
      tokenManager.clearAccessToken();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      return false;
    }
  };

  // Update profile function
  const updateProfile = async (updates) => {
    try {
      const response = await apiClient.put('/api/auth/profile', updates);

      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE,
        payload: { updates: response.data.user },
      });

      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return state.user?.permissions?.includes(permission) || false;
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Auto token refresh setup
  useEffect(() => {
    if (!state.token) return;

    const tokenPayload = parseJwt(state.token);
    if (!tokenPayload) return;

    const expiryTime = tokenPayload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expiryTime - currentTime;

    // Refresh token 5 minutes before expiry
    const refreshTime = timeUntilExpiry - (5 * 60 * 1000);

    if (refreshTime > 0) {
      const timeoutId = setTimeout(() => {
        if (state.refreshToken) {
          refreshToken(state.refreshToken);
        }
      }, refreshTime);

      return () => clearTimeout(timeoutId);
    }
  }, [state.token, state.refreshToken]);

  const value = {
    ...state,
    login,
    logout,
    refreshToken,
    updateProfile,
    clearError,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Utility function to parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export default AuthContext;