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

from .email_service import EmailService
from .providers import SendGridProvider, AWSProvider, SMTPProvider
from .templates import EmailTemplateManager
from .queue import EmailQueue
from .tracking import EmailTracker
from .builder import EmailBuilder
from .models import EmailTemplate, EmailLog, NotificationPreference

__all__ = [
    'EmailService',
    'SendGridProvider',
    'AWSProvider',
    'SMTPProvider',
    'EmailTemplateManager',
    'EmailQueue',
    'EmailTracker',
    'EmailBuilder',
    'EmailTemplate',
    'EmailLog',
    'NotificationPreference'
]

__version__ = '1.0.0'