/**
 * Protected Route Component
 *
 * Wrapper component for protecting routes that require authentication.
 * Redirects unauthenticated users to login page while preserving
 * the intended destination.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null, requiredPermission = null }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="protected-route-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role requirement
  if (requiredRole && !user.roles?.includes(requiredRole)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <i className="icon-shield-off"></i>
          <h2>Access Denied</h2>
          <p>You don't have the required role ({requiredRole}) to access this page.</p>
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check permission requirement
  if (requiredPermission && !user.permissions?.includes(requiredPermission)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <i className="icon-shield-off"></i>
          <h2>Access Denied</h2>
          <p>You don't have the required permission ({requiredPermission}) to access this page.</p>
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render the protected content
  return children;
};

export default ProtectedRoute;

// CSS for ProtectedRoute components
const protectedRouteStyles = `
.protected-route-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f9fafb;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.loading-spinner .spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.access-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f9fafb;
  padding: 2rem;
}

.access-denied-content {
  text-align: center;
  background: white;
  padding: 3rem 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;
}

.access-denied-content i {
  font-size: 3rem;
  color: #ef4444;
  margin-bottom: 1rem;
  display: block;
}

.access-denied-content h2 {
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.access-denied-content p {
  color: #6b7280;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-secondary {
  background-color: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
  transform: translateY(-1px);
}

.icon-shield-off::before {
  content: '🛡';
  filter: grayscale(1);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .access-denied-content {
    padding: 2rem 1.5rem;
    margin: 1rem;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = protectedRouteStyles;
  document.head.appendChild(styleElement);
}