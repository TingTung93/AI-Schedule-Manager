"""
Email service API endpoints.
"""

from .email_routes import email_router
from .template_routes import template_router
from .analytics_routes import analytics_router
from .admin_routes import admin_router

__all__ = [
    'email_router',
    'template_router',
    'analytics_router',
    'admin_router'
]