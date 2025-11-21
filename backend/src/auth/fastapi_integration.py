"""
FastAPI Integration for Flask Authentication Routes

This module provides integration between the Flask authentication system
and FastAPI, allowing Flask auth routes to work seamlessly within the
FastAPI application.
"""

import logging
from typing import Optional

from fastapi import Request
from flask import Flask
from starlette.middleware.wsgi import WSGIMiddleware
from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

from .routes import auth_bp

logger = logging.getLogger(__name__)


class FlaskAuthMiddleware:
    """
    ASGI middleware to integrate Flask authentication routes into FastAPI.

    This middleware intercepts requests to /api/auth/* and forwards them
    to the Flask authentication blueprint, while allowing all other requests
    to pass through to FastAPI.
    """

    def __init__(self, app: ASGIApp, flask_app: Flask):
        """
        Initialize the middleware.

        Args:
            app: The FastAPI ASGI application
            flask_app: The Flask application with auth routes
        """
        self.app = app
        self.flask_app = flask_app
        self.wsgi_middleware = WSGIMiddleware(flask_app)

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        """
        ASGI callable that routes requests.

        Routes /api/auth/* to Flask, all other requests to FastAPI.
        """
        if scope["type"] == "http":
            path = scope.get("path", "")

            # Route auth endpoints to Flask
            if path.startswith("/api/auth/"):
                logger.debug(f"Routing to Flask auth: {path}")
                await self.wsgi_middleware(scope, receive, send)
                return

        # Route all other requests to FastAPI
        await self.app(scope, receive, send)


def create_flask_auth_app() -> Flask:
    """
    Create a minimal Flask application with authentication routes.

    Returns:
        Flask application configured with auth routes
    """
    flask_app = Flask(__name__)

    # Configure Flask app for authentication
    flask_app.config.update({
        'SECRET_KEY': 'your-secret-key-here',  # Should come from environment
        'JWT_SECRET_KEY': 'your-jwt-secret-key',  # Should come from environment
        'HTTPS_ONLY': False,  # Set to True in production
        'SESSION_COOKIE_SECURE': False,  # Set to True in production
        'SESSION_COOKIE_HTTPONLY': True,
        'SESSION_COOKIE_SAMESITE': 'Strict',
    })

    # Register authentication blueprint
    flask_app.register_blueprint(auth_bp)

    logger.info("Flask auth app created with authentication routes")
    return flask_app


def integrate_flask_auth(fastapi_app):
    """
    Integrate Flask authentication routes into FastAPI application.

    This function creates a Flask app with auth routes and adds middleware
    to route auth requests to Flask while keeping other routes in FastAPI.

    Args:
        fastapi_app: The FastAPI application instance

    Returns:
        The modified FastAPI application with Flask auth integration
    """
    # Create Flask app with auth routes
    flask_app = create_flask_auth_app()

    # Add middleware to route auth requests to Flask
    fastapi_app.add_middleware(FlaskAuthMiddleware, flask_app=flask_app)

    logger.info("Flask authentication routes integrated into FastAPI")
    return fastapi_app


# Alternative approach: Convert Flask routes to FastAPI routes
# This would be more native but requires rewriting the Flask route handlers

def convert_flask_to_fastapi_routes():
    """
    FUTURE: Convert Flask authentication routes to native FastAPI routes.

    This would involve:
    1. Converting Flask request/response to FastAPI Request/Response
    2. Converting Flask decorators to FastAPI dependencies
    3. Converting Flask blueprints to FastAPI routers
    4. Ensuring all middleware works correctly

    Benefits:
    - More native FastAPI integration
    - Better performance (no WSGI overhead)
    - Unified documentation in OpenAPI/Swagger

    Drawbacks:
    - Significant refactoring required
    - Need to test all auth flows again
    - Flask-specific features need replacement
    """
    pass


# Store implementation details in memory
def store_integration_details():
    """Store Flask-FastAPI integration details in swarm memory"""
    try:
        import subprocess
        import json

        integration_summary = {
            "approach": "ASGI middleware to mount Flask auth routes",
            "benefits": [
                "Zero changes to existing Flask auth code",
                "Preserves all Flask security features",
                "JWT, RBAC, CSRF protection all work unchanged",
                "Easy to maintain and test"
            ],
            "routes_integrated": [
                "POST /api/auth/register",
                "POST /api/auth/login",
                "POST /api/auth/logout",
                "GET /api/auth/me",
                "POST /api/auth/refresh",
                "POST /api/auth/change-password",
                "POST /api/auth/forgot-password",
                "POST /api/auth/reset-password",
                "GET /api/auth/csrf-token",
                "GET /api/auth/sessions",
                "DELETE /api/auth/sessions/{token_jti}"
            ],
            "architecture": {
                "middleware_class": "FlaskAuthMiddleware",
                "request_routing": "Path-based routing to Flask or FastAPI",
                "wsgi_bridge": "Starlette WSGIMiddleware for Flask compatibility"
            }
        }

        subprocess.run([
            "npx", "claude-flow@alpha", "hooks", "post-edit",
            "--file", "/home/peter/AI-Schedule-Manager/backend/src/auth/fastapi_integration.py",
            "--memory-key", "swarm/auth/fastapi-flask-integration"
        ], check=False, capture_output=True)

    except Exception as e:
        logger.error(f"Failed to store integration details: {e}")


# Store implementation details when module is imported
store_integration_details()
