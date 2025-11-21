"""
Notification service for sending emails and in-app notifications.

This service integrates the email service with the notification system
to provide a unified interface for sending notifications to users.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import Employee, Notification
from ..schemas import NotificationCreate
from .email.email_service import EmailService
from .email.queue.email_queue import EmailPriority
from .email.templates.password_reset_template import get_password_reset_template, get_welcome_template
from .email.templates.schedule_notification_template import (
    get_schedule_published_template,
    get_schedule_changed_template,
    get_shift_reminder_template
)

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Unified notification service for email and in-app notifications.
    """

    def __init__(self, db_session: AsyncSession, email_config: Optional[Dict[str, Any]] = None):
        """
        Initialize notification service.

        Args:
            db_session: Database session for creating in-app notifications
            email_config: Optional email service configuration
        """
        self.db_session = db_session
        self.email_service = EmailService(db_session, email_config) if email_config else None

    async def send_password_reset_email(
        self,
        email: str,
        reset_token: str,
        user_id: int,
        base_url: str = "http://localhost:3000"
    ) -> Dict[str, Any]:
        """
        Send password reset email.

        Args:
            email: Recipient email address
            reset_token: Password reset token
            user_id: User ID
            base_url: Base URL for reset link

        Returns:
            Dict with success status and details
        """
        if not self.email_service:
            logger.warning("Email service not configured, skipping password reset email")
            return {"success": False, "error": "Email service not configured"}

        try:
            # Generate reset URL
            reset_url = f"{base_url}/reset-password?token={reset_token}"

            # Template variables
            template_vars = {
                "reset_url": reset_url,
                "expiry_hours": 24
            }

            # Send email
            result = await self.email_service.send_templated_email(
                to_email=email,
                template_name="password_reset",
                template_variables=template_vars,
                priority=EmailPriority.HIGH,
                user_id=user_id
            )

            if result.get("success"):
                logger.info(f"Password reset email sent to {email}")
            else:
                logger.error(f"Failed to send password reset email: {result.get('error_message')}")

            return result

        except Exception as e:
            logger.error(f"Error sending password reset email: {e}")
            return {"success": False, "error": str(e)}

    async def send_welcome_email(
        self,
        email: str,
        user_name: str,
        user_id: int,
        app_url: str = "http://localhost:3000"
    ) -> Dict[str, Any]:
        """
        Send welcome email to new user.

        Args:
            email: Recipient email address
            user_name: User's full name
            user_id: User ID
            app_url: Application URL

        Returns:
            Dict with success status and details
        """
        if not self.email_service:
            logger.warning("Email service not configured, skipping welcome email")
            return {"success": False, "error": "Email service not configured"}

        try:
            template_vars = {
                "user_name": user_name,
                "app_url": app_url
            }

            result = await self.email_service.send_templated_email(
                to_email=email,
                template_name="welcome",
                template_variables=template_vars,
                priority=EmailPriority.NORMAL,
                user_id=user_id
            )

            if result.get("success"):
                logger.info(f"Welcome email sent to {email}")

            return result

        except Exception as e:
            logger.error(f"Error sending welcome email: {e}")
            return {"success": False, "error": str(e)}

    async def send_schedule_published_notification(
        self,
        employee_ids: List[int],
        schedule_id: int,
        week_start: str,
        week_end: str,
        schedule_url: str = None
    ) -> Dict[str, Any]:
        """
        Send schedule published notifications to employees.

        Args:
            employee_ids: List of employee IDs to notify
            schedule_id: Schedule ID
            week_start: Week start date (YYYY-MM-DD)
            week_end: Week end date (YYYY-MM-DD)
            schedule_url: Optional URL to view schedule

        Returns:
            Dict with success status and notification stats
        """
        try:
            emails_sent = 0
            notifications_created = 0
            errors = []

            for employee_id in employee_ids:
                try:
                    # Get employee details
                    result = await self.db_session.execute(
                        select(Employee).where(Employee.id == employee_id)
                    )
                    employee = result.scalar_one_or_none()

                    if not employee:
                        errors.append(f"Employee {employee_id} not found")
                        continue

                    # Create in-app notification
                    notification = Notification(
                        employee_id=employee_id,
                        notification_type="schedule_published",
                        title=f"Schedule Published for Week of {week_start}",
                        message=f"Your schedule for {week_start} to {week_end} is now available.",
                        priority="medium",
                        read=False,
                        metadata={
                            "schedule_id": schedule_id,
                            "week_start": week_start,
                            "week_end": week_end,
                            "schedule_url": schedule_url
                        }
                    )
                    self.db_session.add(notification)
                    notifications_created += 1

                    # Send email if email service is configured
                    if self.email_service and employee.email:
                        # Note: In a full implementation, we would fetch shift details
                        # For now, provide a simplified notification
                        template_vars = {
                            "employee_name": employee.name,
                            "week_start": week_start,
                            "week_end": week_end,
                            "shifts": [],  # TODO: Fetch actual shifts
                            "total_hours": 0,  # TODO: Calculate total hours
                            "schedule_url": schedule_url or f"http://localhost:3000/schedules/{schedule_id}",
                            "manager_name": "Your Manager",
                            "department_name": employee.department.name if employee.department else "Your Department"
                        }

                        email_result = await self.email_service.send_templated_email(
                            to_email=employee.email,
                            template_name="schedule_published",
                            template_variables=template_vars,
                            priority=EmailPriority.NORMAL,
                            user_id=employee_id
                        )

                        if email_result.get("success"):
                            emails_sent += 1
                        else:
                            errors.append(f"Failed to send email to {employee.email}: {email_result.get('error_message')}")

                except Exception as e:
                    errors.append(f"Error notifying employee {employee_id}: {str(e)}")
                    logger.error(f"Error notifying employee {employee_id}: {e}")

            # Commit all notifications
            await self.db_session.commit()

            logger.info(f"Schedule published notifications: {notifications_created} created, {emails_sent} emails sent")

            return {
                "success": True,
                "notifications_created": notifications_created,
                "emails_sent": emails_sent,
                "errors": errors,
                "total_employees": len(employee_ids)
            }

        except Exception as e:
            logger.error(f"Error sending schedule published notifications: {e}")
            await self.db_session.rollback()
            return {
                "success": False,
                "error": str(e),
                "notifications_created": 0,
                "emails_sent": 0
            }

    async def send_schedule_changed_notification(
        self,
        employee_ids: List[int],
        schedule_id: int,
        week_start: str,
        changes: List[Dict[str, str]],
        schedule_url: str = None
    ) -> Dict[str, Any]:
        """
        Send schedule changed notifications to employees.

        Args:
            employee_ids: List of employee IDs to notify
            schedule_id: Schedule ID
            week_start: Week start date
            changes: List of change descriptions
            schedule_url: Optional URL to view schedule

        Returns:
            Dict with success status and notification stats
        """
        try:
            emails_sent = 0
            notifications_created = 0
            errors = []

            for employee_id in employee_ids:
                try:
                    result = await self.db_session.execute(
                        select(Employee).where(Employee.id == employee_id)
                    )
                    employee = result.scalar_one_or_none()

                    if not employee:
                        errors.append(f"Employee {employee_id} not found")
                        continue

                    # Create in-app notification
                    changes_text = "; ".join([f"{c.get('type')}: {c.get('description')}" for c in changes])
                    notification = Notification(
                        employee_id=employee_id,
                        notification_type="schedule_changed",
                        title="Schedule Updated",
                        message=f"Your schedule for week of {week_start} has been updated. {changes_text}",
                        priority="high",
                        read=False,
                        metadata={
                            "schedule_id": schedule_id,
                            "week_start": week_start,
                            "changes": changes,
                            "schedule_url": schedule_url
                        }
                    )
                    self.db_session.add(notification)
                    notifications_created += 1

                    # Send email
                    if self.email_service and employee.email:
                        template_vars = {
                            "employee_name": employee.name,
                            "week_start": week_start,
                            "changes": changes,
                            "schedule_url": schedule_url or f"http://localhost:3000/schedules/{schedule_id}",
                            "manager_name": "Your Manager"
                        }

                        email_result = await self.email_service.send_templated_email(
                            to_email=employee.email,
                            template_name="schedule_changed",
                            template_variables=template_vars,
                            priority=EmailPriority.HIGH,
                            user_id=employee_id
                        )

                        if email_result.get("success"):
                            emails_sent += 1

                except Exception as e:
                    errors.append(f"Error notifying employee {employee_id}: {str(e)}")

            await self.db_session.commit()

            return {
                "success": True,
                "notifications_created": notifications_created,
                "emails_sent": emails_sent,
                "errors": errors,
                "total_employees": len(employee_ids)
            }

        except Exception as e:
            logger.error(f"Error sending schedule changed notifications: {e}")
            await self.db_session.rollback()
            return {
                "success": False,
                "error": str(e),
                "notifications_created": 0,
                "emails_sent": 0
            }

    async def send_shift_reminder(
        self,
        employee_id: int,
        shift_date: str,
        start_time: str,
        end_time: str,
        department_name: str,
        shift_name: str,
        notes: str = None
    ) -> Dict[str, Any]:
        """
        Send shift reminder notification.

        Args:
            employee_id: Employee ID
            shift_date: Shift date
            start_time: Shift start time
            end_time: Shift end time
            department_name: Department name
            shift_name: Shift name
            notes: Optional shift notes

        Returns:
            Dict with success status
        """
        try:
            result = await self.db_session.execute(
                select(Employee).where(Employee.id == employee_id)
            )
            employee = result.scalar_one_or_none()

            if not employee:
                return {"success": False, "error": "Employee not found"}

            # Create in-app notification
            notification = Notification(
                employee_id=employee_id,
                notification_type="shift_reminder",
                title=f"Shift Reminder: {shift_date}",
                message=f"Reminder: You have a shift tomorrow at {start_time} in {department_name}.",
                priority="medium",
                read=False,
                metadata={
                    "shift_date": shift_date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "department_name": department_name,
                    "shift_name": shift_name,
                    "notes": notes
                }
            )
            self.db_session.add(notification)

            # Send email
            email_sent = False
            if self.email_service and employee.email:
                template_vars = {
                    "employee_name": employee.name,
                    "shift_date": shift_date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "department_name": department_name,
                    "shift_name": shift_name,
                    "notes": notes,
                    "manager_name": "Your Manager"
                }

                email_result = await self.email_service.send_templated_email(
                    to_email=employee.email,
                    template_name="shift_reminder",
                    template_variables=template_vars,
                    priority=EmailPriority.NORMAL,
                    user_id=employee_id
                )

                email_sent = email_result.get("success", False)

            await self.db_session.commit()

            return {
                "success": True,
                "notification_created": True,
                "email_sent": email_sent
            }

        except Exception as e:
            logger.error(f"Error sending shift reminder: {e}")
            await self.db_session.rollback()
            return {"success": False, "error": str(e)}


# Singleton instance - will be initialized with db_session when needed
def get_notification_service(db_session: AsyncSession, email_config: Optional[Dict[str, Any]] = None) -> NotificationService:
    """
    Get notification service instance.

    Args:
        db_session: Database session
        email_config: Optional email configuration

    Returns:
        NotificationService instance
    """
    return NotificationService(db_session, email_config)
