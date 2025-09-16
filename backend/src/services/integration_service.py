"""
Integration service for third-party systems and webhooks.
Supports calendar integration, payroll systems, and webhook notifications.
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin
import hashlib
import hmac
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models import Employee, Schedule, Rule
from ..exceptions.import_exceptions import IntegrationError

logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing webhooks and external integrations."""

    def __init__(self):
        self.webhook_endpoints = {}
        self.webhook_secrets = {}
        self.max_retries = 3
        self.timeout_seconds = 30

    def register_webhook(
        self,
        event_type: str,
        url: str,
        secret: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ):
        """Register a webhook endpoint for specific events."""
        self.webhook_endpoints[event_type] = {
            'url': url,
            'headers': headers or {},
            'secret': secret,
            'created_at': datetime.utcnow()
        }

        if secret:
            self.webhook_secrets[event_type] = secret

        logger.info(f"Registered webhook for {event_type}: {url}")

    async def send_webhook(
        self,
        event_type: str,
        payload: Dict[str, Any],
        retry_count: int = 0
    ) -> bool:
        """Send webhook notification to registered endpoint."""
        if event_type not in self.webhook_endpoints:
            logger.debug(f"No webhook registered for event type: {event_type}")
            return True

        endpoint = self.webhook_endpoints[event_type]

        try:
            # Prepare payload
            webhook_payload = {
                'event_type': event_type,
                'timestamp': datetime.utcnow().isoformat(),
                'data': payload
            }

            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'AI-Schedule-Manager-Webhook/1.0',
                **endpoint.get('headers', {})
            }

            # Add signature if secret is configured
            if endpoint.get('secret'):
                signature = self._generate_signature(
                    json.dumps(webhook_payload, default=str),
                    endpoint['secret']
                )
                headers['X-Webhook-Signature'] = signature

            # Send webhook
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout_seconds)) as session:
                async with session.post(
                    endpoint['url'],
                    json=webhook_payload,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        logger.info(f"Webhook sent successfully for {event_type}")
                        return True
                    else:
                        logger.warning(f"Webhook failed with status {response.status} for {event_type}")
                        response_text = await response.text()
                        logger.debug(f"Response: {response_text}")

        except Exception as e:
            logger.error(f"Error sending webhook for {event_type}: {e}")

        # Retry if not exceeded max retries
        if retry_count < self.max_retries:
            await asyncio.sleep(2 ** retry_count)  # Exponential backoff
            return await self.send_webhook(event_type, payload, retry_count + 1)

        return False

    def _generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload."""
        signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"


class CalendarIntegrationService:
    """Service for calendar system integration (Google Calendar, Outlook)."""

    def __init__(self):
        self.google_credentials = None
        self.outlook_credentials = None

    async def sync_to_google_calendar(
        self,
        db: AsyncSession,
        employee_id: int,
        calendar_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sync schedules to Google Calendar."""
        try:
            # Get employee schedules
            schedules = await self._get_employee_schedules(
                db, employee_id, date_from, date_to
            )

            events_created = 0
            events_updated = 0
            errors = []

            for schedule in schedules:
                try:
                    event_data = self._convert_schedule_to_google_event(schedule)

                    # This would integrate with Google Calendar API
                    # For now, we'll simulate the process
                    result = await self._create_google_calendar_event(
                        calendar_id, event_data
                    )

                    if result.get('success'):
                        events_created += 1
                    else:
                        errors.append(f"Failed to create event for schedule {schedule.id}")

                except Exception as e:
                    errors.append(f"Error processing schedule {schedule.id}: {str(e)}")

            return {
                'success': True,
                'events_created': events_created,
                'events_updated': events_updated,
                'errors': errors,
                'total_schedules': len(schedules)
            }

        except Exception as e:
            logger.error(f"Google Calendar sync error: {e}")
            raise IntegrationError(f"Google Calendar sync failed: {str(e)}")

    async def sync_to_outlook_calendar(
        self,
        db: AsyncSession,
        employee_id: int,
        calendar_id: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> Dict[str, Any]:
        """Sync schedules to Outlook Calendar."""
        try:
            # Similar to Google Calendar but for Outlook/Exchange
            schedules = await self._get_employee_schedules(
                db, employee_id, date_from, date_to
            )

            events_created = 0
            errors = []

            for schedule in schedules:
                try:
                    event_data = self._convert_schedule_to_outlook_event(schedule)

                    # This would integrate with Microsoft Graph API
                    result = await self._create_outlook_calendar_event(
                        calendar_id, event_data
                    )

                    if result.get('success'):
                        events_created += 1
                    else:
                        errors.append(f"Failed to create event for schedule {schedule.id}")

                except Exception as e:
                    errors.append(f"Error processing schedule {schedule.id}: {str(e)}")

            return {
                'success': True,
                'events_created': events_created,
                'errors': errors,
                'total_schedules': len(schedules)
            }

        except Exception as e:
            logger.error(f"Outlook Calendar sync error: {e}")
            raise IntegrationError(f"Outlook Calendar sync failed: {str(e)}")

    async def _get_employee_schedules(
        self,
        db: AsyncSession,
        employee_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None
    ) -> List[Any]:
        """Get employee schedules for calendar sync."""
        query = select(Schedule).where(Schedule.employee_id == employee_id)

        if date_from:
            query = query.where(Schedule.date >= date_from)
        if date_to:
            query = query.where(Schedule.date <= date_to)

        result = await db.execute(query)
        return result.scalars().all()

    def _convert_schedule_to_google_event(self, schedule) -> Dict[str, Any]:
        """Convert schedule to Google Calendar event format."""
        start_datetime = datetime.combine(schedule.date, schedule.shift.start_time)
        end_datetime = datetime.combine(schedule.date, schedule.shift.end_time)

        return {
            'summary': f"{schedule.shift.name} - {schedule.employee.name}",
            'description': f"Shift: {schedule.shift.name}\n"
                          f"Department: {schedule.shift.department or 'N/A'}\n"
                          f"Notes: {schedule.notes or 'N/A'}",
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'UTC'
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'UTC'
            },
            'location': schedule.shift.department or 'Workplace'
        }

    def _convert_schedule_to_outlook_event(self, schedule) -> Dict[str, Any]:
        """Convert schedule to Outlook Calendar event format."""
        start_datetime = datetime.combine(schedule.date, schedule.shift.start_time)
        end_datetime = datetime.combine(schedule.date, schedule.shift.end_time)

        return {
            'subject': f"{schedule.shift.name} - {schedule.employee.name}",
            'body': {
                'contentType': 'text',
                'content': f"Shift: {schedule.shift.name}\n"
                          f"Department: {schedule.shift.department or 'N/A'}\n"
                          f"Notes: {schedule.notes or 'N/A'}"
            },
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'UTC'
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'UTC'
            },
            'location': {
                'displayName': schedule.shift.department or 'Workplace'
            }
        }

    async def _create_google_calendar_event(
        self,
        calendar_id: str,
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create event in Google Calendar (mock implementation)."""
        # This would use the Google Calendar API
        # For now, return a mock success response
        return {
            'success': True,
            'event_id': f"google_event_{datetime.utcnow().timestamp()}",
            'calendar_id': calendar_id
        }

    async def _create_outlook_calendar_event(
        self,
        calendar_id: str,
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create event in Outlook Calendar (mock implementation)."""
        # This would use the Microsoft Graph API
        # For now, return a mock success response
        return {
            'success': True,
            'event_id': f"outlook_event_{datetime.utcnow().timestamp()}",
            'calendar_id': calendar_id
        }


class PayrollIntegrationService:
    """Service for payroll system integration."""

    def __init__(self):
        self.payroll_systems = {}

    def register_payroll_system(
        self,
        system_name: str,
        api_url: str,
        credentials: Dict[str, str],
        system_type: str = "generic"
    ):
        """Register a payroll system for integration."""
        self.payroll_systems[system_name] = {
            'api_url': api_url,
            'credentials': credentials,
            'system_type': system_type,
            'registered_at': datetime.utcnow()
        }

        logger.info(f"Registered payroll system: {system_name}")

    async def export_timesheet_data(
        self,
        db: AsyncSession,
        system_name: str,
        date_from: date,
        date_to: date,
        employee_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """Export timesheet data to payroll system."""
        try:
            if system_name not in self.payroll_systems:
                raise IntegrationError(f"Payroll system {system_name} not registered")

            # Get schedule data for timesheet
            timesheet_data = await self._prepare_timesheet_data(
                db, date_from, date_to, employee_ids
            )

            # Send to payroll system
            result = await self._send_to_payroll_system(
                system_name, timesheet_data
            )

            return {
                'success': True,
                'system': system_name,
                'period': f"{date_from} to {date_to}",
                'employees_exported': len(timesheet_data),
                'payroll_response': result
            }

        except Exception as e:
            logger.error(f"Payroll export error: {e}")
            raise IntegrationError(f"Payroll export failed: {str(e)}")

    async def _prepare_timesheet_data(
        self,
        db: AsyncSession,
        date_from: date,
        date_to: date,
        employee_ids: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """Prepare timesheet data for payroll export."""
        query = select(Schedule).join(Employee).join(Shift).where(
            Schedule.date.between(date_from, date_to),
            Schedule.status == 'completed'
        )

        if employee_ids:
            query = query.where(Schedule.employee_id.in_(employee_ids))

        result = await db.execute(query)
        schedules = result.scalars().all()

        # Group by employee
        employee_timesheets = {}
        for schedule in schedules:
            emp_id = schedule.employee_id
            if emp_id not in employee_timesheets:
                employee_timesheets[emp_id] = {
                    'employee_id': emp_id,
                    'employee_name': schedule.employee.name,
                    'employee_email': schedule.employee.email,
                    'hourly_rate': schedule.employee.hourly_rate or 0,
                    'shifts': [],
                    'total_hours': 0,
                    'total_pay': 0
                }

            # Calculate shift hours
            shift_hours = (
                datetime.combine(date.today(), schedule.shift.end_time) -
                datetime.combine(date.today(), schedule.shift.start_time)
            ).total_seconds() / 3600

            # Apply rate multiplier
            effective_rate = (schedule.employee.hourly_rate or 0) * schedule.shift.hourly_rate_multiplier
            shift_pay = shift_hours * effective_rate

            shift_data = {
                'date': schedule.date.isoformat(),
                'shift_name': schedule.shift.name,
                'start_time': schedule.shift.start_time.strftime('%H:%M'),
                'end_time': schedule.shift.end_time.strftime('%H:%M'),
                'hours': shift_hours,
                'hourly_rate': effective_rate,
                'pay': shift_pay,
                'overtime': schedule.overtime_approved,
                'department': schedule.shift.department
            }

            employee_timesheets[emp_id]['shifts'].append(shift_data)
            employee_timesheets[emp_id]['total_hours'] += shift_hours
            employee_timesheets[emp_id]['total_pay'] += shift_pay

        return list(employee_timesheets.values())

    async def _send_to_payroll_system(
        self,
        system_name: str,
        timesheet_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Send timesheet data to payroll system (mock implementation)."""
        # This would integrate with actual payroll systems like ADP, Paychex, etc.
        # For now, return a mock response
        return {
            'status': 'success',
            'records_processed': len(timesheet_data),
            'payroll_batch_id': f"batch_{datetime.utcnow().timestamp()}",
            'processing_time': datetime.utcnow().isoformat()
        }


class HRSystemIntegrationService:
    """Service for HR system integration."""

    def __init__(self):
        self.hr_systems = {}

    def register_hr_system(
        self,
        system_name: str,
        api_url: str,
        credentials: Dict[str, str]
    ):
        """Register HR system for integration."""
        self.hr_systems[system_name] = {
            'api_url': api_url,
            'credentials': credentials,
            'registered_at': datetime.utcnow()
        }

    async def sync_employee_data(
        self,
        db: AsyncSession,
        system_name: str,
        sync_direction: str = "both"  # "import", "export", "both"
    ) -> Dict[str, Any]:
        """Sync employee data with HR system."""
        try:
            if system_name not in self.hr_systems:
                raise IntegrationError(f"HR system {system_name} not registered")

            result = {
                'imported': 0,
                'exported': 0,
                'updated': 0,
                'errors': []
            }

            if sync_direction in ["import", "both"]:
                # Import from HR system
                hr_employees = await self._fetch_hr_employees(system_name)
                import_result = await self._import_hr_employees(db, hr_employees)
                result.update(import_result)

            if sync_direction in ["export", "both"]:
                # Export to HR system
                local_employees = await self._get_local_employees(db)
                export_result = await self._export_to_hr_system(system_name, local_employees)
                result['exported'] = export_result.get('exported', 0)

            return result

        except Exception as e:
            logger.error(f"HR system sync error: {e}")
            raise IntegrationError(f"HR system sync failed: {str(e)}")

    async def _fetch_hr_employees(self, system_name: str) -> List[Dict[str, Any]]:
        """Fetch employee data from HR system (mock implementation)."""
        # This would integrate with actual HR systems
        return []

    async def _import_hr_employees(
        self,
        db: AsyncSession,
        hr_employees: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Import employee data from HR system."""
        # Implementation would sync HR employee data
        return {'imported': 0, 'updated': 0, 'errors': []}

    async def _get_local_employees(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Get local employee data for export."""
        query = select(Employee).where(Employee.active == True)
        result = await db.execute(query)
        employees = result.scalars().all()

        return [
            {
                'id': emp.id,
                'name': emp.name,
                'email': emp.email,
                'role': emp.role,
                'phone': emp.phone,
                'hourly_rate': emp.hourly_rate,
                'active': emp.active
            }
            for emp in employees
        ]

    async def _export_to_hr_system(
        self,
        system_name: str,
        employees: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Export employee data to HR system (mock implementation)."""
        # This would integrate with actual HR systems
        return {'exported': len(employees)}


class TimeTrackingIntegrationService:
    """Service for time tracking system integration."""

    def __init__(self):
        self.time_tracking_systems = {}

    async def sync_with_time_tracker(
        self,
        db: AsyncSession,
        system_name: str,
        date_from: date,
        date_to: date
    ) -> Dict[str, Any]:
        """Sync actual time tracking data with scheduled shifts."""
        try:
            # Get scheduled shifts
            scheduled_shifts = await self._get_scheduled_shifts(db, date_from, date_to)

            # Get actual time tracking data
            tracked_time = await self._fetch_tracked_time(
                system_name, date_from, date_to
            )

            # Compare and update
            comparison_result = await self._compare_scheduled_vs_actual(
                scheduled_shifts, tracked_time
            )

            return comparison_result

        except Exception as e:
            logger.error(f"Time tracking sync error: {e}")
            raise IntegrationError(f"Time tracking sync failed: {str(e)}")

    async def _get_scheduled_shifts(
        self,
        db: AsyncSession,
        date_from: date,
        date_to: date
    ) -> List[Dict[str, Any]]:
        """Get scheduled shifts for comparison."""
        query = select(Schedule).join(Employee).join(Shift).where(
            Schedule.date.between(date_from, date_to)
        )

        result = await db.execute(query)
        schedules = result.scalars().all()

        return [
            {
                'employee_id': s.employee_id,
                'employee_name': s.employee.name,
                'date': s.date,
                'scheduled_start': s.shift.start_time,
                'scheduled_end': s.shift.end_time,
                'shift_name': s.shift.name
            }
            for s in schedules
        ]

    async def _fetch_tracked_time(
        self,
        system_name: str,
        date_from: date,
        date_to: date
    ) -> List[Dict[str, Any]]:
        """Fetch actual tracked time data (mock implementation)."""
        # This would integrate with time tracking systems like Toggl, Harvest, etc.
        return []

    async def _compare_scheduled_vs_actual(
        self,
        scheduled: List[Dict[str, Any]],
        actual: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compare scheduled vs actual time."""
        # Implementation would compare and identify discrepancies
        return {
            'matches': 0,
            'discrepancies': 0,
            'missing_clockins': 0,
            'overtime_instances': 0
        }


# Global service instances
webhook_service = WebhookService()
calendar_service = CalendarIntegrationService()
payroll_service = PayrollIntegrationService()
hr_service = HRSystemIntegrationService()
time_tracking_service = TimeTrackingIntegrationService()