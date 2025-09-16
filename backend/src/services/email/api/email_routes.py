"""
Email API routes for sending and managing emails.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.orm import Session

from ..email_service import EmailService
from ..queue.email_queue import EmailPriority
from ..models import EmailLog, EmailStatus
from ....core.dependencies import get_db, get_current_user, verify_api_key
from ....core.security import require_permissions

logger = logging.getLogger(__name__)

email_router = APIRouter(prefix="/api/v1/email", tags=["email"])


# Request models
class SendEmailRequest(BaseModel):
    """Send email request model."""
    to_email: EmailStr
    subject: str
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    priority: Optional[str] = "normal"
    send_immediately: bool = True
    scheduled_at: Optional[datetime] = None

    @validator('priority')
    def validate_priority(cls, v):
        valid_priorities = ['low', 'normal', 'high', 'urgent']
        if v.lower() not in valid_priorities:
            raise ValueError(f'Priority must be one of: {valid_priorities}')
        return v.lower()


class SendTemplatedEmailRequest(BaseModel):
    """Send templated email request model."""
    to_email: EmailStr
    template_name: str
    template_variables: Dict[str, Any]
    language: str = "en"
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    priority: Optional[str] = "normal"
    send_immediately: bool = True
    scheduled_at: Optional[datetime] = None


class BatchEmailRequest(BaseModel):
    """Batch email request model."""
    emails: List[Dict[str, Any]]
    batch_name: Optional[str] = None

    @validator('emails')
    def validate_emails(cls, v):
        if not v:
            raise ValueError('At least one email is required')
        if len(v) > 1000:
            raise ValueError('Maximum 1000 emails per batch')
        return v


class NotificationRequest(BaseModel):
    """Notification email request model."""
    user_id: int
    notification_type: str
    template_variables: Dict[str, Any]
    priority: Optional[str] = "normal"


# Response models
class EmailResponse(BaseModel):
    """Email response model."""
    success: bool
    task_id: Optional[str] = None
    message: str
    error_message: Optional[str] = None


class EmailStatusResponse(BaseModel):
    """Email status response model."""
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    tracking_info: Optional[Dict[str, Any]] = None


@email_router.post("/send", response_model=EmailResponse)
async def send_email(
    request: SendEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send individual email."""
    try:
        email_service = EmailService(db)

        # Convert priority string to enum
        priority_map = {
            'low': EmailPriority.LOW,
            'normal': EmailPriority.NORMAL,
            'high': EmailPriority.HIGH,
            'urgent': EmailPriority.URGENT
        }

        result = await email_service.send_email(
            to_email=request.to_email,
            subject=request.subject,
            html_content=request.html_content,
            text_content=request.text_content,
            from_email=request.from_email,
            from_name=request.from_name,
            cc=request.cc,
            bcc=request.bcc,
            priority=priority_map.get(request.priority, EmailPriority.NORMAL),
            send_immediately=request.send_immediately,
            scheduled_at=request.scheduled_at,
            user_id=current_user.id
        )

        if result['success']:
            return EmailResponse(
                success=True,
                task_id=result.get('task_id'),
                message=result.get('message', 'Email queued successfully')
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send email",
                error_message=result.get('error_message')
            )

    except Exception as e:
        logger.error(f"Send email API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/send-templated", response_model=EmailResponse)
async def send_templated_email(
    request: SendTemplatedEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send templated email."""
    try:
        email_service = EmailService(db)

        priority_map = {
            'low': EmailPriority.LOW,
            'normal': EmailPriority.NORMAL,
            'high': EmailPriority.HIGH,
            'urgent': EmailPriority.URGENT
        }

        result = await email_service.send_templated_email(
            to_email=request.to_email,
            template_name=request.template_name,
            template_variables=request.template_variables,
            language=request.language,
            from_email=request.from_email,
            from_name=request.from_name,
            cc=request.cc,
            bcc=request.bcc,
            priority=priority_map.get(request.priority, EmailPriority.NORMAL),
            send_immediately=request.send_immediately,
            scheduled_at=request.scheduled_at,
            user_id=current_user.id
        )

        if result['success']:
            return EmailResponse(
                success=True,
                task_id=result.get('task_id'),
                message=result.get('message', 'Templated email queued successfully')
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send templated email",
                error_message=result.get('error_message')
            )

    except Exception as e:
        logger.error(f"Send templated email API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/send-batch", response_model=EmailResponse)
@require_permissions(['email:send_batch'])
async def send_batch_emails(
    request: BatchEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send batch of emails."""
    try:
        email_service = EmailService(db)

        result = await email_service.send_batch_emails(
            emails=request.emails,
            batch_name=request.batch_name
        )

        if result['success']:
            return EmailResponse(
                success=True,
                task_id=result.get('task_id'),
                message=f"Batch of {result.get('batch_size')} emails queued successfully"
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send batch emails",
                error_message=result.get('error_message')
            )

    except Exception as e:
        logger.error(f"Send batch emails API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/send-notification", response_model=EmailResponse)
async def send_notification(
    request: NotificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send notification email."""
    try:
        email_service = EmailService(db)

        priority_map = {
            'low': EmailPriority.LOW,
            'normal': EmailPriority.NORMAL,
            'high': EmailPriority.HIGH,
            'urgent': EmailPriority.URGENT
        }

        result = await email_service.send_notification(
            user_id=request.user_id,
            notification_type=request.notification_type,
            template_variables=request.template_variables,
            priority=priority_map.get(request.priority, EmailPriority.NORMAL)
        )

        if result['success']:
            return EmailResponse(
                success=True,
                task_id=result.get('task_id'),
                message=result.get('message', 'Notification queued successfully')
            )
        else:
            return EmailResponse(
                success=False,
                message="Failed to send notification",
                error_message=result.get('error_message')
            )

    except Exception as e:
        logger.error(f"Send notification API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.get("/status/{task_id}", response_model=EmailStatusResponse)
async def get_email_status(
    task_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get email delivery status."""
    try:
        email_service = EmailService(db)

        status_info = await email_service.get_email_status(task_id)

        return EmailStatusResponse(
            task_id=task_id,
            status=status_info.get('task_status', {}).get('status', 'unknown'),
            result=status_info.get('task_status', {}).get('result'),
            tracking_info=status_info.get('tracking_info')
        )

    except Exception as e:
        logger.error(f"Get email status API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.get("/logs")
async def get_email_logs(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get email logs."""
    try:
        query = db.query(EmailLog)

        # Apply filters
        if status:
            query = query.filter(EmailLog.status == status)

        if user_id:
            query = query.filter(EmailLog.user_id == user_id)

        # For non-admin users, only show their own emails
        if not getattr(current_user, 'is_admin', False):
            query = query.filter(EmailLog.user_id == current_user.id)

        # Pagination
        total = query.count()
        logs = query.order_by(EmailLog.created_at.desc()).offset(offset).limit(limit).all()

        return {
            'logs': [log.to_dict() for log in logs],
            'total': total,
            'limit': limit,
            'offset': offset
        }

    except Exception as e:
        logger.error(f"Get email logs API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/test")
async def send_test_email(
    to_email: EmailStr,
    test_type: str = "basic",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send test email."""
    try:
        email_service = EmailService(db)

        result = await email_service.send_test_email(to_email, test_type)

        if result['success']:
            return {
                'success': True,
                'task_id': result.get('task_id'),
                'message': result.get('message')
            }
        else:
            return {
                'success': False,
                'message': "Failed to send test email",
                'error': result.get('error_message')
            }

    except Exception as e:
        logger.error(f"Send test email API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/verify")
async def verify_email(
    email: EmailStr,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Verify email address."""
    try:
        email_service = EmailService(db)

        is_valid = await email_service.verify_email(email)

        return {
            'email': email,
            'valid': is_valid,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Verify email API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.post("/webhook/{provider}")
async def handle_webhook(
    provider: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle email provider webhooks."""
    try:
        # Verify webhook authenticity (implement provider-specific verification)
        payload = await request.json()

        email_service = EmailService(db)

        # Process webhook in background
        background_tasks.add_task(
            email_service.process_webhook,
            payload,
            provider
        )

        return JSONResponse(
            status_code=200,
            content={'status': 'webhook received'}
        )

    except Exception as e:
        logger.error(f"Webhook handling error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.get("/bounce-list")
@require_permissions(['email:admin'])
async def get_bounce_list(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get email bounce list."""
    try:
        email_service = EmailService(db)

        bounce_list = await email_service.get_bounce_list()

        return {
            'bounces': bounce_list,
            'count': len(bounce_list),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Get bounce list API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@email_router.delete("/bounce-list/{email}")
@require_permissions(['email:admin'])
async def remove_from_bounce_list(
    email: EmailStr,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Remove email from bounce list."""
    try:
        email_service = EmailService(db)

        success = await email_service.remove_from_bounce_list(email)

        if success:
            return {
                'success': True,
                'message': f'Removed {email} from bounce list'
            }
        else:
            return {
                'success': False,
                'message': f'Failed to remove {email} from bounce list'
            }

    except Exception as e:
        logger.error(f"Remove from bounce list API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))