"""
Email queue management for asynchronous email processing.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum

from .celery_tasks import (
    send_email_task,
    send_batch_emails_task,
    process_scheduled_emails,
    send_test_email
)

logger = logging.getLogger(__name__)


class EmailPriority(Enum):
    """Email priority levels."""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    URGENT = 3


@dataclass
class QueuedEmail:
    """Queued email data structure."""
    to_email: str
    subject: str
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    template_name: Optional[str] = None
    template_variables: Optional[Dict[str, Any]] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    priority: EmailPriority = EmailPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    user_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class EmailQueue:
    """Email queue management class."""

    def __init__(self):
        """Initialize email queue."""
        self.logger = logging.getLogger(__name__)

    def send_immediate(self, email: QueuedEmail) -> str:
        """Queue email for immediate sending."""
        try:
            task_data = self._prepare_task_data(email)

            # Queue the task
            task_result = send_email_task.delay(**task_data)

            self.logger.info(f"Queued immediate email to {email.to_email} with task ID {task_result.id}")
            return task_result.id

        except Exception as e:
            self.logger.error(f"Failed to queue immediate email: {e}")
            raise

    def send_scheduled(self, email: QueuedEmail, send_at: datetime) -> str:
        """Schedule email for future sending."""
        try:
            task_data = self._prepare_task_data(email)

            # Calculate delay in seconds
            now = datetime.now(timezone.utc)
            if send_at.tzinfo is None:
                send_at = send_at.replace(tzinfo=timezone.utc)

            delay_seconds = (send_at - now).total_seconds()

            if delay_seconds <= 0:
                # Send immediately if scheduled time has passed
                task_result = send_email_task.delay(**task_data)
            else:
                # Schedule for future
                task_result = send_email_task.apply_async(
                    kwargs=task_data,
                    countdown=delay_seconds
                )

            self.logger.info(f"Scheduled email to {email.to_email} for {send_at} with task ID {task_result.id}")
            return task_result.id

        except Exception as e:
            self.logger.error(f"Failed to schedule email: {e}")
            raise

    def send_batch(self, emails: List[QueuedEmail], batch_name: Optional[str] = None) -> str:
        """Queue batch of emails for sending."""
        try:
            # Prepare batch data
            email_batch = []
            for email in emails:
                task_data = self._prepare_task_data(email)
                email_batch.append(task_data)

            # Queue batch task
            task_result = send_batch_emails_task.delay(
                email_batch=email_batch,
                batch_name=batch_name
            )

            self.logger.info(f"Queued batch of {len(emails)} emails with task ID {task_result.id}")
            return task_result.id

        except Exception as e:
            self.logger.error(f"Failed to queue email batch: {e}")
            raise

    def send_recurring(
        self,
        email: QueuedEmail,
        schedule: Dict[str, Any]
    ) -> str:
        """Set up recurring email sending."""
        try:
            # This would typically integrate with Celery Beat for periodic tasks
            # For now, we'll create a simple scheduling mechanism

            task_data = self._prepare_task_data(email)
            task_data['schedule'] = schedule

            # You could implement this with Celery Beat dynamic scheduling
            # or use a custom scheduling system

            self.logger.info(f"Set up recurring email to {email.to_email}")
            return "recurring_task_id"  # Placeholder

        except Exception as e:
            self.logger.error(f"Failed to set up recurring email: {e}")
            raise

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of queued task."""
        try:
            from celery.result import AsyncResult
            result = AsyncResult(task_id, app=send_email_task.app)

            return {
                'task_id': task_id,
                'status': result.status,
                'result': result.result if result.ready() else None,
                'info': result.info,
                'successful': result.successful() if result.ready() else None,
                'failed': result.failed() if result.ready() else None
            }

        except Exception as e:
            self.logger.error(f"Failed to get task status: {e}")
            return {
                'task_id': task_id,
                'status': 'UNKNOWN',
                'error': str(e)
            }

    def cancel_task(self, task_id: str) -> bool:
        """Cancel queued task."""
        try:
            from celery.result import AsyncResult
            result = AsyncResult(task_id, app=send_email_task.app)

            if not result.ready():
                result.revoke(terminate=True)
                self.logger.info(f"Cancelled task {task_id}")
                return True
            else:
                self.logger.warning(f"Task {task_id} already completed, cannot cancel")
                return False

        except Exception as e:
            self.logger.error(f"Failed to cancel task: {e}")
            return False

    def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        try:
            from celery import current_app
            inspect = current_app.control.inspect()

            # Get active tasks
            active_tasks = inspect.active()
            scheduled_tasks = inspect.scheduled()
            reserved_tasks = inspect.reserved()

            stats = {
                'active_tasks': len(active_tasks) if active_tasks else 0,
                'scheduled_tasks': len(scheduled_tasks) if scheduled_tasks else 0,
                'reserved_tasks': len(reserved_tasks) if reserved_tasks else 0,
                'workers': list(active_tasks.keys()) if active_tasks else [],
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

            return stats

        except Exception as e:
            self.logger.error(f"Failed to get queue stats: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

    def send_test_email(self, to_email: str, test_type: str = 'basic') -> str:
        """Send test email."""
        try:
            task_result = send_test_email.delay(
                to_email=to_email,
                test_type=test_type
            )

            self.logger.info(f"Queued test email to {to_email} with task ID {task_result.id}")
            return task_result.id

        except Exception as e:
            self.logger.error(f"Failed to queue test email: {e}")
            raise

    def process_scheduled_emails_now(self) -> str:
        """Manually trigger processing of scheduled emails."""
        try:
            task_result = process_scheduled_emails.delay()
            self.logger.info(f"Triggered scheduled email processing with task ID {task_result.id}")
            return task_result.id

        except Exception as e:
            self.logger.error(f"Failed to trigger scheduled email processing: {e}")
            raise

    def _prepare_task_data(self, email: QueuedEmail) -> Dict[str, Any]:
        """Prepare email data for task queue."""
        task_data = {
            'to_email': email.to_email,
            'subject': email.subject,
            'priority': email.priority.value,
            'user_id': email.user_id
        }

        # Add content
        if email.html_content:
            task_data['html_content'] = email.html_content
        if email.text_content:
            task_data['text_content'] = email.text_content

        # Add template info
        if email.template_name:
            task_data['template_name'] = email.template_name
            task_data['template_variables'] = email.template_variables or {}

        # Add sender info
        if email.from_email:
            task_data['from_email'] = email.from_email
        if email.from_name:
            task_data['from_name'] = email.from_name

        # Add recipients
        if email.cc:
            task_data['cc'] = email.cc
        if email.bcc:
            task_data['bcc'] = email.bcc

        # Add attachments
        if email.attachments:
            task_data['attachments'] = email.attachments

        return task_data

    def purge_queue(self, queue_name: Optional[str] = None) -> Dict[str, Any]:
        """Purge messages from queue."""
        try:
            from celery import current_app

            if queue_name:
                # Purge specific queue
                current_app.control.purge()
                message = f"Purged queue: {queue_name}"
            else:
                # Purge all queues
                current_app.control.purge()
                message = "Purged all queues"

            self.logger.warning(message)
            return {
                'success': True,
                'message': message,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            self.logger.error(f"Failed to purge queue: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

    def get_failed_tasks(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get information about failed tasks."""
        try:
            # This would typically query a failed task store
            # For now, return empty list as placeholder
            return []

        except Exception as e:
            self.logger.error(f"Failed to get failed tasks: {e}")
            return []

    def retry_failed_task(self, task_id: str) -> str:
        """Retry a failed task."""
        try:
            from celery.result import AsyncResult
            result = AsyncResult(task_id, app=send_email_task.app)

            if result.failed():
                # Get original task data and retry
                # This is a simplified implementation
                new_task = send_email_task.delay(**result.info)
                self.logger.info(f"Retried failed task {task_id} as new task {new_task.id}")
                return new_task.id
            else:
                raise ValueError(f"Task {task_id} is not in failed state")

        except Exception as e:
            self.logger.error(f"Failed to retry task: {e}")
            raise