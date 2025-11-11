"""
Email service module for AI Schedule Manager.

This module provides comprehensive email functionality including:
- Multiple email provider support (SendGrid, AWS SES, SMTP)
- Templating with Jinja2
- Asynchronous email queue with Celery
- Email tracking and analytics
- Notification preferences management
- Responsive email templates
- Delivery monitoring and retry logic
"""

from .builder import EmailBuilder
from .email_service import EmailService
from .models import EmailLog, EmailTemplate, NotificationPreference
from .providers import AWSProvider, SendGridProvider, SMTPProvider
from .queue import EmailQueue
from .templates import EmailTemplateManager
from .tracking import EmailTracker

__all__ = [
    "EmailService",
    "SendGridProvider",
    "AWSProvider",
    "SMTPProvider",
    "EmailTemplateManager",
    "EmailQueue",
    "EmailTracker",
    "EmailBuilder",
    "EmailTemplate",
    "EmailLog",
    "NotificationPreference",
]

__version__ = "1.0.0"
