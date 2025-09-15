"""
Authentication and Authorization Middleware

Provides decorators and middleware for protecting routes with JWT authentication
and role-based access control.
"""

from functools import wraps
from flask import request, jsonify, g, current_app
from .auth import auth_service, AuthenticationError, AuthorizationError
import logging

logger = logging.getLogger(__name__)

def extract_token_from_request() -> str:
    """
    Extract JWT token from request headers or cookies

    Returns:
        JWT token string

    Raises:
        AuthenticationError: If no token found
    """
    # Try Authorization header first
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ')[1]

    # Try cookies as fallback
    token = request.cookies.get('access_token')
    if token:
        return token

    raise AuthenticationError("No authentication token provided")

def token_required(f):
    """
    Decorator to require valid JWT token for route access

    Usage:
        @app.route('/protected')
        @token_required
        def protected_route():
            return {'user_id': g.current_user['user_id']}
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Extract token from request
            token = extract_token_from_request()

            # Verify token
            payload = auth_service.verify_access_token(token)

            # Store user info in Flask's g object
            g.current_user = payload
            g.user_id = payload['user_id']
            g.user_email = payload['email']
            g.user_role = payload.get('role', 'user')
            g.user_permissions = payload.get('permissions', [])

            return f(*args, **kwargs)

        except AuthenticationError as e:
            return jsonify({
                'error': 'Authentication failed',
                'message': str(e)
            }), 401
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return jsonify({
                'error': 'Authentication failed',
                'message': 'Invalid token'
            }), 401

    return decorated

def require_role(*allowed_roles):
    """
    Decorator to require specific roles for route access

    Args:
        allowed_roles: Variable number of role strings

    Usage:
        @app.route('/admin')
        @token_required
        @require_role('admin', 'moderator')
        def admin_route():
            return {'message': 'Admin access granted'}
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            try:
                # Check if user is authenticated (should be called after @token_required)
                if not hasattr(g, 'current_user'):
                    return jsonify({
                        'error': 'Authorization failed',
                        'message': 'User not authenticated'
                    }), 401

                user_role = g.user_role

                # Check if user has required role
                if user_role not in allowed_roles:
                    return jsonify({
                        'error': 'Authorization failed',
                        'message': f'Required role: {" or ".join(allowed_roles)}'
                    }), 403

                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Role validation error: {e}")
                return jsonify({
                    'error': 'Authorization failed',
                    'message': 'Access denied'
                }), 403

        return decorated
    return decorator

def require_permission(*required_permissions):
    """
    Decorator to require specific permissions for route access

    Args:
        required_permissions: Variable number of permission strings

    Usage:
        @app.route('/delete-user')
        @token_required
        @require_permission('user.delete', 'user.manage')
        def delete_user_route():
            return {'message': 'User deleted'}
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            try:
                # Check if user is authenticated
                if not hasattr(g, 'current_user'):
                    return jsonify({
                        'error': 'Authorization failed',
                        'message': 'User not authenticated'
                    }), 401

                user_permissions = set(g.user_permissions)
                required_perms = set(required_permissions)

                # Check if user has any of the required permissions
                if not required_perms.intersection(user_permissions):
                    return jsonify({
                        'error': 'Authorization failed',
                        'message': f'Required permission: {" or ".join(required_permissions)}'
                    }), 403

                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Permission validation error: {e}")
                return jsonify({
                    'error': 'Authorization failed',
                    'message': 'Access denied'
                }), 403

        return decorated
    return decorator

def optional_auth(f):
    """
    Decorator for routes that work with or without authentication

    If token is provided and valid, user info is set in g object.
    If no token or invalid token, continues without authentication.

    Usage:
        @app.route('/public-but-enhanced')
        @optional_auth
        def public_route():
            if hasattr(g, 'current_user'):
                return {'message': f'Hello {g.user_email}'}
            return {'message': 'Hello anonymous user'}
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            # Try to extract and verify token
            token = extract_token_from_request()
            payload = auth_service.verify_access_token(token)

            # Set user info if token is valid
            g.current_user = payload
            g.user_id = payload['user_id']
            g.user_email = payload['email']
            g.user_role = payload.get('role', 'user')
            g.user_permissions = payload.get('permissions', [])

        except (AuthenticationError, Exception):
            # Continue without authentication if token is missing or invalid
            pass

        return f(*args, **kwargs)

    return decorated

class RateLimiter:
    """
    Rate limiter for authentication endpoints
    """

    def __init__(self, redis_client=None):
        self.redis_client = redis_client or auth_service.redis_client

    def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        """
        Check if request is rate limited

        Args:
            key: Unique identifier for rate limiting (e.g., IP address, email)
            limit: Maximum number of requests allowed
            window: Time window in seconds

        Returns:
            True if rate limited, False otherwise
        """
        try:
            current_count = self.redis_client.get(f"rate_limit:{key}")

            if current_count is None:
                # First request, set count to 1
                self.redis_client.setex(f"rate_limit:{key}", window, 1)
                return False

            current_count = int(current_count)

            if current_count >= limit:
                return True

            # Increment counter
            self.redis_client.incr(f"rate_limit:{key}")
            return False

        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            return False  # Fail open

    def get_remaining_attempts(self, key: str, limit: int) -> int:
        """
        Get remaining attempts for rate limited key

        Args:
            key: Rate limit key
            limit: Maximum allowed attempts

        Returns:
            Number of remaining attempts
        """
        try:
            current_count = self.redis_client.get(f"rate_limit:{key}")
            if current_count is None:
                return limit

            remaining = limit - int(current_count)
            return max(0, remaining)

        except Exception as e:
            logger.error(f"Error getting remaining attempts: {e}")
            return limit

def rate_limit(limit: int = 5, window: int = 300, key_func=None):
    """
    Rate limiting decorator

    Args:
        limit: Maximum number of requests
        window: Time window in seconds
        key_func: Function to generate rate limit key (default: use IP)

    Usage:
        @app.route('/login', methods=['POST'])
        @rate_limit(limit=5, window=300)  # 5 attempts per 5 minutes
        def login():
            return login_logic()
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Generate rate limit key
            if key_func:
                key = key_func()
            else:
                # Use IP address as default key
                key = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)

            rate_limiter = RateLimiter()

            if rate_limiter.is_rate_limited(key, limit, window):
                remaining = rate_limiter.get_remaining_attempts(key, limit)
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Try again later.',
                    'remaining_attempts': remaining
                }), 429

            return f(*args, **kwargs)

        return decorated
    return decorator

class CSRFProtection:
    """
    CSRF protection middleware
    """

    def __init__(self, redis_client=None):
        self.redis_client = redis_client or auth_service.redis_client

    def generate_csrf_token(self, session_id: str) -> str:
        """Generate CSRF token for session"""
        import secrets
        token = secrets.token_urlsafe(32)

        # Store token with 1 hour expiration
        self.redis_client.setex(f"csrf:{session_id}", 3600, token)
        return token

    def validate_csrf_token(self, session_id: str, token: str) -> bool:
        """Validate CSRF token"""
        try:
            stored_token = self.redis_client.get(f"csrf:{session_id}")
            if not stored_token:
                return False

            return stored_token.decode('utf-8') == token
        except Exception as e:
            logger.error(f"CSRF validation error: {e}")
            return False

def csrf_protect(f):
    """
    CSRF protection decorator

    Usage:
        @app.route('/api/sensitive', methods=['POST'])
        @token_required
        @csrf_protect
        def sensitive_endpoint():
            return {'message': 'Success'}
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            # Get CSRF token from header
            csrf_token = request.headers.get('X-CSRF-Token')
            if not csrf_token:
                return jsonify({
                    'error': 'CSRF token missing',
                    'message': 'CSRF token required for this request'
                }), 400

            # Get session ID (could be from user ID or session)
            session_id = getattr(g, 'user_id', request.session.get('id'))
            if not session_id:
                return jsonify({
                    'error': 'Invalid session',
                    'message': 'Valid session required'
                }), 400

            csrf_protection = CSRFProtection()
            if not csrf_protection.validate_csrf_token(str(session_id), csrf_token):
                return jsonify({
                    'error': 'Invalid CSRF token',
                    'message': 'CSRF token validation failed'
                }), 403

        return f(*args, **kwargs)

    return decorated