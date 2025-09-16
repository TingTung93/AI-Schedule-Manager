"""
Email queue module for asynchronous email processing.
"""

from .email_queue import EmailQueue
from .celery_tasks import send_email_task, send_batch_emails_task, process_scheduled_emails
from .queue_manager import QueueManager

__all__ = [
    'EmailQueue',
    'send_email_task',
    'send_batch_emails_task',
    'process_scheduled_emails',
    'QueueManager'
]