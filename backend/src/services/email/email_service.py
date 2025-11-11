"""
Main email service orchestrating all email functionality.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from sqlalchemy.orm import Session

from .config import EmailProvider, email_config
from .models import EmailLog, EmailStatus, EmailTemplate, NotificationPreference
from .providers import AWSProvider, SendGridProvider, SMTPProvider
from .queue.email_queue import EmailPriority, EmailQueue, QueuedEmail
from .templates.template_manager import EmailTemplateManager
from .tracking.email_tracker import EmailTracker
from .utils.rate_limiter import RateLimiter
from .utils.validator import EmailValidator

logger = logging.getLogger(__name__)


class EmailService:
    """Main email service class."""

    def __init__(self, db_session: Session, config: Optional[Dict[str, Any]] = None):
        """Initialize email service."""
        self.db_session = db_session
        self.config = config or email_config

        # Initialize components
        self._init_provider()
        self._init_template_manager()
        self._init_queue()
        self._init_tracker()
        self._init_validator()
        self._init_rate_limiter()

    def _init_provider(self) -> None:
        """Initialize email provider."""
        provider_config = {
            "api_key": self.config.sendgrid_api_key,
            "aws_access_key_id": self.config.aws_access_key_id,
            "aws_secret_access_key": self.config.aws_secret_access_key,
            "aws_region": self.config.aws_region,
            "host": self.config.smtp_host,
            "port": self.config.smtp_port,
            "username": self.config.smtp_username,
            "password": self.config.smtp_password,
            "use_tls": self.config.smtp_use_tls,
            "default_from_email": self.config.default_from_email,
            "default_from_name": self.config.default_from_name,
        }

        if self.config.provider == EmailProvider.SENDGRID:
            self.provider = SendGridProvider(provider_config)
        elif self.config.provider == EmailProvider.AWS_SES:
            self.provider = AWSProvider(provider_config)
        elif self.config.provider == EmailProvider.SMTP:
            self.provider = SMTPProvider(provider_config)
        else:
            raise ValueError(f"Unsupported email provider: {self.config.provider}")

    def _init_template_manager(self) -> None:
        """Initialize template manager."""
        self.template_manager = EmailTemplateManager(
            template_dir=self.config.template_directory, db_session=self.db_session, cache_ttl=self.config.template_cache_ttl
        )

    def _init_queue(self) -> None:
        """Initialize email queue."""
        self.queue = EmailQueue()

    def _init_tracker(self) -> None:
        """Initialize email tracker."""
        self.tracker = EmailTracker(db_session=self.db_session, enable_tracking=self.config.enable_tracking)

    def _init_validator(self) -> None:
        """Initialize email validator."""
        self.validator = EmailValidator()

    def _init_rate_limiter(self) -> None:
        """Initialize rate limiter."""
        self.rate_limiter = RateLimiter(
            rate_per_hour=self.config.rate_limit_per_hour, rate_per_minute=self.config.rate_limit_per_minute
        )

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        priority: EmailPriority = EmailPriority.NORMAL,
        send_immediately: bool = True,
        scheduled_at: Optional[datetime] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send an email."""
        try:
            # Validate inputs
            if not await self._validate_email_request(to_email, user_id):
                return {"success": False, "error_message": "Email validation failed"}

            # Check rate limits
            if not await self.rate_limiter.check_rate_limit(to_email):
                return {"success": False, "error_message": "Rate limit exceeded"}

            # Create queued email
            queued_email = QueuedEmail(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                from_name=from_name,
                cc=cc,
                bcc=bcc,
                attachments=attachments,
                priority=priority,
                user_id=user_id,
            )

            # Send or schedule
            if send_immediately and not scheduled_at:
                task_id = self.queue.send_immediate(queued_email)
            elif scheduled_at:
                task_id = self.queue.send_scheduled(queued_email, scheduled_at)
            else:
                # Queue for later processing
                task_id = self.queue.send_immediate(queued_email)

            logger.info(f"Email queued for {to_email} with task ID {task_id}")

            return {"success": True, "task_id": task_id, "message": "Email queued successfully"}

        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def send_templated_email(
        self,
        to_email: str,
        template_name: str,
        template_variables: Dict[str, Any],
        language: str = "en",
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        priority: EmailPriority = EmailPriority.NORMAL,
        send_immediately: bool = True,
        scheduled_at: Optional[datetime] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Send templated email."""
        try:
            # Get template
            template = await self.template_manager.get_template_by_type(template_name, language)
            if not template:
                return {"success": False, "error_message": f"Template not found: {template_name}"}

            # Render template
            html_content = await self.template_manager.render_template(template_name, template_variables, language, "html")
            text_content = await self.template_manager.render_template(template_name, template_variables, language, "text")

            # Render subject
            from jinja2 import Template

            subject_template = Template(template.subject)
            subject = subject_template.render(**template_variables)

            # Send email
            return await self.send_email(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                from_name=from_name,
                cc=cc,
                bcc=bcc,
                attachments=attachments,
                priority=priority,
                send_immediately=send_immediately,
                scheduled_at=scheduled_at,
                user_id=user_id,
            )

        except Exception as e:
            logger.error(f"Templated email send failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def send_batch_emails(self, emails: List[Dict[str, Any]], batch_name: Optional[str] = None) -> Dict[str, Any]:
        """Send batch of emails."""
        try:
            # Convert to QueuedEmail objects
            queued_emails = []
            for email_data in emails:
                queued_email = QueuedEmail(**email_data)
                queued_emails.append(queued_email)

            # Send batch
            task_id = self.queue.send_batch(queued_emails, batch_name)

            logger.info(f"Email batch queued with {len(emails)} emails, task ID {task_id}")

            return {
                "success": True,
                "task_id": task_id,
                "batch_size": len(emails),
                "message": "Email batch queued successfully",
            }

        except Exception as e:
            logger.error(f"Batch email send failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def send_notification(
        self,
        user_id: int,
        notification_type: str,
        template_variables: Dict[str, Any],
        priority: EmailPriority = EmailPriority.NORMAL,
    ) -> Dict[str, Any]:
        """Send notification email based on user preferences."""
        try:
            # Get user preferences
            preferences = await self._get_user_preferences(user_id)
            if not preferences or not preferences.email_enabled:
                return {"success": False, "error_message": "Email notifications disabled for user"}

            # Check if this notification type is enabled
            if not self._is_notification_enabled(preferences, notification_type):
                return {"success": False, "error_message": f"Notification type {notification_type} disabled for user"}

            # Get user email
            # This would typically query the user model
            user_email = template_variables.get("user", {}).get("email")
            if not user_email:
                return {"success": False, "error_message": "User email not found"}

            # Send templated email
            return await self.send_templated_email(
                to_email=user_email,
                template_name=notification_type,
                template_variables=template_variables,
                language=preferences.language,
                priority=priority,
                user_id=user_id,
            )

        except Exception as e:
            logger.error(f"Notification send failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def get_email_status(self, task_id: str) -> Dict[str, Any]:
        """Get email delivery status."""
        try:
            # Get task status from queue
            task_status = self.queue.get_task_status(task_id)

            # Get tracking info if available
            tracking_info = await self.tracker.get_email_tracking(task_id)

            return {"task_id": task_id, "task_status": task_status, "tracking_info": tracking_info}

        except Exception as e:
            logger.error(f"Status check failed: {e}")
            return {"task_id": task_id, "error": str(e)}

    async def process_webhook(self, webhook_data: Dict[str, Any], provider: str) -> Dict[str, Any]:
        """Process email provider webhook."""
        try:
            # Process webhook through provider
            if provider.lower() == "sendgrid":
                processed_events = await self.provider.handle_webhook(webhook_data)
            elif provider.lower() == "aws":
                processed_events = await self.provider.handle_webhook(webhook_data)
            else:
                return {"success": False, "error_message": f"Unsupported webhook provider: {provider}"}

            # Update tracking information
            for event in processed_events.get("events", []):
                await self.tracker.update_email_tracking(event)

            return processed_events

        except Exception as e:
            logger.error(f"Webhook processing failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def get_bounce_list(self) -> List[Dict[str, Any]]:
        """Get email bounce list."""
        try:
            return await self.provider.get_bounce_list()
        except Exception as e:
            logger.error(f"Bounce list retrieval failed: {e}")
            return []

    async def remove_from_bounce_list(self, email: str) -> bool:
        """Remove email from bounce list."""
        try:
            return await self.provider.remove_from_bounce_list(email)
        except Exception as e:
            logger.error(f"Bounce removal failed: {e}")
            return False

    async def verify_email(self, email: str) -> bool:
        """Verify email address."""
        try:
            # Basic validation first
            if not self.validator.validate_email(email):
                return False

            # Provider verification
            return await self.provider.verify_email(email)

        except Exception as e:
            logger.error(f"Email verification failed: {e}")
            return False

    async def send_test_email(self, to_email: str, test_type: str = "basic") -> Dict[str, Any]:
        """Send test email."""
        try:
            task_id = self.queue.send_test_email(to_email, test_type)

            return {"success": True, "task_id": task_id, "message": f"Test email queued for {to_email}"}

        except Exception as e:
            logger.error(f"Test email failed: {e}")
            return {"success": False, "error_message": str(e)}

    async def get_email_analytics(
        self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get email analytics."""
        try:
            return await self.tracker.get_analytics(start_date, end_date, user_id)
        except Exception as e:
            logger.error(f"Analytics retrieval failed: {e}")
            return {"error": str(e)}

    async def _validate_email_request(self, to_email: str, user_id: Optional[int]) -> bool:
        """Validate email request."""
        # Basic email validation
        if not self.validator.validate_email(to_email):
            return False

        # Check if email is bounced
        if await self.tracker.is_email_bounced(to_email):
            logger.warning(f"Email {to_email} is in bounce list")
            return False

        # Check user preferences if user_id provided
        if user_id:
            preferences = await self._get_user_preferences(user_id)
            if preferences and not preferences.email_enabled:
                return False

        return True

    async def _get_user_preferences(self, user_id: int) -> Optional[NotificationPreference]:
        """Get user notification preferences."""
        return self.db_session.query(NotificationPreference).filter_by(user_id=user_id).first()

    def _is_notification_enabled(self, preferences: NotificationPreference, notification_type: str) -> bool:
        """Check if notification type is enabled for user."""
        notification_map = {
            "welcome": preferences.welcome_emails,
            "password_reset": preferences.password_reset_emails,
            "schedule_notification": preferences.schedule_notifications,
            "shift_reminder": preferences.shift_reminders,
            "schedule_change": preferences.schedule_changes,
            "weekly_summary": preferences.weekly_summaries,
            "system_alert": preferences.system_alerts,
        }

        return notification_map.get(notification_type, True)
