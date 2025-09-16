"""
Celery tasks for email processing.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from celery import current_task
from sqlalchemy.orm import sessionmaker

from .celery_config import celery_app
from ..email_service import EmailService
from ..models import EmailLog, EmailStatus, EmailBounce
from ..config import email_config
from ...database import get_database_session

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3)
def send_email_task(
    self,
    to_email: str,
    subject: str,
    template_name: Optional[str] = None,
    template_variables: Optional[Dict[str, Any]] = None,
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
    priority: int = 0,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """Send individual email task."""
    try:
        # Create database session
        db_session = get_database_session()

        # Initialize email service
        email_service = EmailService(db_session)

        # Create email log entry
        email_log = EmailLog(
            message_id=f"task_{self.request.id}",
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            template_variables=template_variables,
            status=EmailStatus.QUEUED.value,
            priority=priority,
            user_id=user_id,
            created_at=datetime.now(timezone.utc)
        )

        db_session.add(email_log)
        db_session.commit()

        try:
            # Update status to sending
            email_log.status = EmailStatus.SENDING.value
            db_session.commit()

            # Send email
            if template_name:
                result = await email_service.send_templated_email(
                    to_email=to_email,
                    template_name=template_name,
                    template_variables=template_variables or {},
                    from_email=from_email,
                    from_name=from_name,
                    cc=cc,
                    bcc=bcc,
                    attachments=attachments
                )
            else:
                result = await email_service.send_email(
                    to_email=to_email,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    from_email=from_email,
                    from_name=from_name,
                    cc=cc,
                    bcc=bcc,
                    attachments=attachments
                )

            # Update email log with result
            if result['success']:
                email_log.status = EmailStatus.SENT.value
                email_log.message_id = result.get('message_id', email_log.message_id)
                email_log.sent_at = datetime.now(timezone.utc)
                email_log.provider_response = result.get('provider_response')
            else:
                email_log.status = EmailStatus.FAILED.value
                email_log.error_message = result.get('error_message')

            db_session.commit()

            logger.info(f"Email sent successfully to {to_email}")
            return {
                'success': result['success'],
                'message_id': result.get('message_id'),
                'email_log_id': email_log.id
            }

        except Exception as e:
            # Handle send failure
            email_log.status = EmailStatus.FAILED.value
            email_log.error_message = str(e)
            email_log.retry_count = getattr(self.request, 'retries', 0)
            db_session.commit()

            logger.error(f"Email send failed for {to_email}: {e}")

            # Retry if not max retries
            if self.request.retries < self.max_retries:
                # Exponential backoff
                countdown = (2 ** self.request.retries) * 60
                logger.info(f"Retrying email send in {countdown} seconds")
                raise self.retry(countdown=countdown, exc=e)

            raise e

    except Exception as e:
        logger.error(f"Email task failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task(bind=True)
def send_batch_emails_task(
    self,
    email_batch: List[Dict[str, Any]],
    batch_name: Optional[str] = None
) -> Dict[str, Any]:
    """Send batch of emails task."""
    try:
        db_session = get_database_session()
        email_service = EmailService(db_session)

        batch_id = f"batch_{self.request.id}"
        results = []
        success_count = 0
        failed_count = 0

        logger.info(f"Processing email batch {batch_id} with {len(email_batch)} emails")

        for email_data in email_batch:
            try:
                # Queue individual email task
                task_result = send_email_task.delay(**email_data)
                results.append({
                    'email': email_data.get('to_email'),
                    'task_id': task_result.id,
                    'status': 'queued'
                })
                success_count += 1

            except Exception as e:
                logger.error(f"Failed to queue email for {email_data.get('to_email')}: {e}")
                results.append({
                    'email': email_data.get('to_email'),
                    'status': 'failed',
                    'error': str(e)
                })
                failed_count += 1

        logger.info(f"Batch {batch_id} processed: {success_count} queued, {failed_count} failed")

        return {
            'batch_id': batch_id,
            'total_emails': len(email_batch),
            'queued_count': success_count,
            'failed_count': failed_count,
            'results': results
        }

    except Exception as e:
        logger.error(f"Batch email task failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task
def process_scheduled_emails() -> Dict[str, Any]:
    """Process scheduled emails that are due to be sent."""
    try:
        db_session = get_database_session()

        # Find emails scheduled for now or earlier
        now = datetime.now(timezone.utc)
        scheduled_emails = db_session.query(EmailLog).filter(
            EmailLog.scheduled_at <= now,
            EmailLog.status == EmailStatus.PENDING.value
        ).order_by(EmailLog.scheduled_at, EmailLog.priority.desc()).limit(100).all()

        if not scheduled_emails:
            return {'processed': 0, 'message': 'No scheduled emails found'}

        processed_count = 0

        for email_log in scheduled_emails:
            try:
                # Queue the email for sending
                task_data = {
                    'to_email': email_log.to_email,
                    'subject': email_log.subject,
                    'html_content': email_log.html_content,
                    'text_content': email_log.text_content,
                    'template_variables': email_log.template_variables,
                    'priority': email_log.priority,
                    'user_id': email_log.user_id
                }

                # Add template info if available
                if email_log.template_id:
                    template = db_session.query(EmailTemplate).get(email_log.template_id)
                    if template:
                        task_data['template_name'] = template.name

                send_email_task.delay(**task_data)

                # Update status
                email_log.status = EmailStatus.QUEUED.value
                processed_count += 1

            except Exception as e:
                logger.error(f"Failed to process scheduled email {email_log.id}: {e}")
                email_log.status = EmailStatus.FAILED.value
                email_log.error_message = str(e)

        db_session.commit()

        logger.info(f"Processed {processed_count} scheduled emails")
        return {
            'processed': processed_count,
            'message': f'Processed {processed_count} scheduled emails'
        }

    except Exception as e:
        logger.error(f"Scheduled email processing failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task
def process_email_webhooks(webhook_data: Dict[str, Any], provider: str) -> Dict[str, Any]:
    """Process email webhook events."""
    try:
        db_session = get_database_session()
        email_service = EmailService(db_session)

        # Process webhook based on provider
        processed_events = await email_service.process_webhook(webhook_data, provider)

        logger.info(f"Processed {len(processed_events.get('events', []))} webhook events from {provider}")

        return {
            'success': True,
            'processed_events': len(processed_events.get('events', [])),
            'provider': provider
        }

    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task
def cleanup_email_logs(days_to_keep: int = 90) -> Dict[str, Any]:
    """Clean up old email logs."""
    try:
        db_session = get_database_session()

        # Calculate cutoff date
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)

        # Delete old email logs
        deleted_count = db_session.query(EmailLog).filter(
            EmailLog.created_at < cutoff_date,
            EmailLog.status.in_([EmailStatus.SENT.value, EmailStatus.DELIVERED.value, EmailStatus.FAILED.value])
        ).delete(synchronize_session=False)

        db_session.commit()

        logger.info(f"Cleaned up {deleted_count} old email logs")

        return {
            'success': True,
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date.isoformat()
        }

    except Exception as e:
        logger.error(f"Email log cleanup failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task
def update_bounce_list() -> Dict[str, Any]:
    """Update bounce list from email provider."""
    try:
        db_session = get_database_session()
        email_service = EmailService(db_session)

        # Get bounce list from provider
        bounce_list = await email_service.get_bounce_list()

        updated_count = 0
        new_count = 0

        for bounce_data in bounce_list:
            email = bounce_data.get('email')
            if not email:
                continue

            # Check if bounce already exists
            existing_bounce = db_session.query(EmailBounce).filter_by(email=email).first()

            if existing_bounce:
                # Update existing bounce
                existing_bounce.bounce_count += 1
                existing_bounce.last_bounce_at = datetime.now(timezone.utc)
                existing_bounce.bounce_reason = bounce_data.get('reason', existing_bounce.bounce_reason)
                updated_count += 1
            else:
                # Create new bounce record
                new_bounce = EmailBounce(
                    email=email,
                    bounce_type=bounce_data.get('type', 'unknown'),
                    bounce_reason=bounce_data.get('reason'),
                    bounce_count=1,
                    last_bounce_at=datetime.now(timezone.utc),
                    created_at=datetime.now(timezone.utc)
                )
                db_session.add(new_bounce)
                new_count += 1

        db_session.commit()

        logger.info(f"Updated bounce list: {new_count} new, {updated_count} updated")

        return {
            'success': True,
            'new_bounces': new_count,
            'updated_bounces': updated_count
        }

    except Exception as e:
        logger.error(f"Bounce list update failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if 'db_session' in locals():
            db_session.close()


@celery_app.task
def send_test_email(to_email: str, test_type: str = 'basic') -> Dict[str, Any]:
    """Send test email for verification."""
    try:
        if test_type == 'basic':
            return send_email_task.delay(
                to_email=to_email,
                subject="Test Email from AI Schedule Manager",
                html_content="<h1>Test Email</h1><p>This is a test email to verify email functionality.</p>",
                text_content="Test Email\n\nThis is a test email to verify email functionality."
            ).get()

        elif test_type == 'template':
            return send_email_task.delay(
                to_email=to_email,
                template_name='welcome',
                template_variables={
                    'user': {'first_name': 'Test User', 'email': to_email},
                    'dashboard_url': 'https://app.aischedulemanager.com/dashboard'
                }
            ).get()

        else:
            return {
                'success': False,
                'error': f'Unknown test type: {test_type}'
            }

    except Exception as e:
        logger.error(f"Test email failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }