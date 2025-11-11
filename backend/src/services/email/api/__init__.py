"""
Email service API endpoints.
"""

from .admin_routes import admin_router
from .analytics_routes import analytics_router
from .email_routes import email_router
from .template_routes import template_router

__all__ = ["email_router", "template_router", "analytics_router", "admin_router"]
