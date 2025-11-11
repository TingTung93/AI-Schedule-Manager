"""
Email queue module for asynchronous email processing.
"""

from .celery_tasks import process_scheduled_emails, send_batch_emails_task, send_email_task
from .email_queue import EmailQueue
from .queue_manager import QueueManager

__all__ = ["EmailQueue", "send_email_task", "send_batch_emails_task", "process_scheduled_emails", "QueueManager"]
