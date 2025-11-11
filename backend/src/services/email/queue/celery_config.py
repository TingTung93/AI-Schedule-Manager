"""
Celery configuration for email queue processing.
"""

import os

from celery import Celery
from kombu import Queue

# Celery app configuration
celery_app = Celery(
    "email_service",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=["src.services.email.queue.celery_tasks"],
)

# Queue configuration
celery_app.conf.update(
    # Basic settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task routing
    task_routes={
        "src.services.email.queue.celery_tasks.send_email_task": {"queue": "email_immediate"},
        "src.services.email.queue.celery_tasks.send_batch_emails_task": {"queue": "email_batch"},
        "src.services.email.queue.celery_tasks.process_scheduled_emails": {"queue": "email_scheduled"},
        "src.services.email.queue.celery_tasks.process_email_webhooks": {"queue": "email_webhooks"},
        "src.services.email.queue.celery_tasks.cleanup_email_logs": {"queue": "email_maintenance"},
    },
    # Queue definitions
    task_queues=(
        Queue("email_immediate", routing_key="email.immediate"),
        Queue("email_batch", routing_key="email.batch"),
        Queue("email_scheduled", routing_key="email.scheduled"),
        Queue("email_webhooks", routing_key="email.webhooks"),
        Queue("email_maintenance", routing_key="email.maintenance"),
    ),
    # Default queue settings
    task_default_queue="email_immediate",
    task_default_exchange="email",
    task_default_exchange_type="topic",
    task_default_routing_key="email.immediate",
    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    # Retry settings
    task_retry_delay=60,
    task_max_retries=3,
    task_soft_time_limit=300,
    task_time_limit=600,
    # Rate limiting
    task_annotations={
        "src.services.email.queue.celery_tasks.send_email_task": {"rate_limit": "100/m"},  # 100 emails per minute
        "src.services.email.queue.celery_tasks.send_batch_emails_task": {"rate_limit": "10/m"},  # 10 batch jobs per minute
    },
    # Beat schedule for periodic tasks
    beat_schedule={
        "process-scheduled-emails": {
            "task": "src.services.email.queue.celery_tasks.process_scheduled_emails",
            "schedule": 60.0,  # Every minute
        },
        "cleanup-old-email-logs": {
            "task": "src.services.email.queue.celery_tasks.cleanup_email_logs",
            "schedule": 24 * 60 * 60,  # Daily
        },
        "update-bounce-list": {
            "task": "src.services.email.queue.celery_tasks.update_bounce_list",
            "schedule": 6 * 60 * 60,  # Every 6 hours
        },
    },
    # Result backend settings
    result_expires=3600,
    result_compression="gzip",
    # Worker settings
    worker_max_tasks_per_child=100,
    worker_max_memory_per_child=200000,  # 200MB
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    # Security
    task_always_eager=False,
    task_store_eager_result=True,
)

# Development/testing configuration
if os.getenv("TESTING") == "true":
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )
