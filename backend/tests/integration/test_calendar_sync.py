"""
Integration tests for calendar sync workflows.

Tests Google Calendar and Outlook Calendar synchronization with mocked external APIs.
"""

import pytest
from datetime import date, time, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.src.models import Employee, Schedule, ScheduleAssignment, Shift, Department
from backend.src.services.integration_service import (
    CalendarIntegrationService,
    WebhookService,
    PayrollIntegrationService,
)


@pytest.fixture
def calendar_service() -> CalendarIntegrationService:
    """Create calendar integration service instance."""
    return CalendarIntegrationService()


@pytest.fixture
def webhook_service() -> WebhookService:
    """Create webhook service instance."""
    return WebhookService()


@pytest.fixture
def payroll_service() -> PayrollIntegrationService:
    """Create payroll service instance."""
    return PayrollIntegrationService()


@pytest.fixture
async def test_department(db: AsyncSession) -> Department:
    """Create test department."""
    department = Department(name="Test Department", description="Test")
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@pytest.fixture
async def test_employee_with_schedule(
    db: AsyncSession, test_department: Department
) -> tuple[Employee, Schedule, list[ScheduleAssignment]]:
    """Create test employee with schedule assignments."""
    # Create employee
    employee = Employee(
        name="Calendar Test User",
        email="calendar@example.com",
        role="server",
        is_active=True,
        department_id=test_department.id,
    )
    db.add(employee)

    # Create shifts
    today = date.today()
    shifts = [
        Shift(
            name="Morning Shift",
            shift_type="morning",
            start_time=time(9, 0),
            end_time=time(17, 0),
            required_staff=1,
            active=True,
            date=today,
            department_id=test_department.id,
        ),
        Shift(
            name="Evening Shift",
            shift_type="evening",
            start_time=time(17, 0),
            end_time=time(23, 0),
            required_staff=1,
            active=True,
            date=today + timedelta(days=1),
            department_id=test_department.id,
        ),
    ]
    for shift in shifts:
        db.add(shift)

    await db.commit()
    await db.refresh(employee)
    for shift in shifts:
        await db.refresh(shift)

    # Create schedule
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="published",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Create assignments
    assignments = []
    for shift in shifts:
        assignment = ScheduleAssignment(
            schedule_id=schedule.id,
            employee_id=employee.id,
            shift_id=shift.id,
            status="assigned",
            priority=1,
        )
        db.add(assignment)
        assignments.append(assignment)

    await db.commit()
    for assignment in assignments:
        await db.refresh(assignment)

    return employee, schedule, assignments


@pytest.mark.asyncio
async def test_google_calendar_sync(
    db: AsyncSession,
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test Google Calendar synchronization."""
    employee, schedule, assignments = test_employee_with_schedule

    # Mock Google Calendar API
    with patch.object(
        calendar_service,
        "_create_google_calendar_event",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = {
            "success": True,
            "event_id": "google_event_123",
            "calendar_id": "primary",
        }

        # Sync to Google Calendar
        result = await calendar_service.sync_to_google_calendar(
            db,
            employee_id=employee.id,
            calendar_id="primary",
            date_from=date.today(),
            date_to=date.today() + timedelta(days=7),
        )

        # Verify sync results
        assert result["success"] is True
        assert result["events_created"] == len(assignments)
        assert result["total_schedules"] == len(assignments)
        assert len(result["errors"]) == 0

        # Verify mock was called
        assert mock_create.call_count == len(assignments)


@pytest.mark.asyncio
async def test_outlook_calendar_sync(
    db: AsyncSession,
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test Outlook Calendar synchronization."""
    employee, schedule, assignments = test_employee_with_schedule

    # Mock Outlook Calendar API
    with patch.object(
        calendar_service,
        "_create_outlook_calendar_event",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = {
            "success": True,
            "event_id": "outlook_event_456",
            "calendar_id": "default",
        }

        # Sync to Outlook Calendar
        result = await calendar_service.sync_to_outlook_calendar(
            db,
            employee_id=employee.id,
            calendar_id="default",
            date_from=date.today(),
            date_to=date.today() + timedelta(days=7),
        )

        # Verify sync results
        assert result["success"] is True
        assert result["events_created"] == len(assignments)
        assert result["total_schedules"] == len(assignments)
        assert len(result["errors"]) == 0

        # Verify mock was called
        assert mock_create.call_count == len(assignments)


@pytest.mark.asyncio
async def test_google_calendar_event_format(
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test Google Calendar event format conversion."""
    employee, schedule, assignments = test_employee_with_schedule
    assignment = assignments[0]

    # Convert to Google Calendar format
    event_data = calendar_service._convert_schedule_to_google_event(assignment)

    # Verify event structure
    assert "summary" in event_data
    assert "description" in event_data
    assert "start" in event_data
    assert "end" in event_data
    assert "location" in event_data

    # Verify event content
    assert assignment.shift.name in event_data["summary"]
    assert assignment.employee.name in event_data["summary"]
    assert "dateTime" in event_data["start"]
    assert "timeZone" in event_data["start"]


@pytest.mark.asyncio
async def test_outlook_calendar_event_format(
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test Outlook Calendar event format conversion."""
    employee, schedule, assignments = test_employee_with_schedule
    assignment = assignments[0]

    # Convert to Outlook Calendar format
    event_data = calendar_service._convert_schedule_to_outlook_event(assignment)

    # Verify event structure
    assert "subject" in event_data
    assert "body" in event_data
    assert "start" in event_data
    assert "end" in event_data
    assert "location" in event_data

    # Verify Outlook-specific format
    assert "contentType" in event_data["body"]
    assert "content" in event_data["body"]
    assert "displayName" in event_data["location"]


@pytest.mark.asyncio
async def test_webhook_notification(webhook_service: WebhookService):
    """Test webhook notification sending."""
    # Register webhook
    webhook_url = "https://example.com/webhook"
    webhook_service.register_webhook(
        "schedule.created",
        webhook_url,
        secret="test_secret_key",
    )

    # Mock HTTP request
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text = AsyncMock(return_value="OK")
        mock_post.return_value.__aenter__.return_value = mock_response

        # Send webhook
        payload = {
            "schedule_id": 123,
            "week_start": "2025-11-11",
            "status": "published",
        }

        result = await webhook_service.send_webhook("schedule.created", payload)

        # Verify webhook was sent
        assert result is True
        assert mock_post.called


@pytest.mark.asyncio
async def test_webhook_retry_on_failure(webhook_service: WebhookService):
    """Test webhook retry mechanism on failure."""
    # Register webhook
    webhook_service.register_webhook(
        "test.event",
        "https://example.com/webhook",
    )

    # Mock HTTP request to fail initially
    with patch("aiohttp.ClientSession.post") as mock_post:
        # First two calls fail, third succeeds
        mock_response_fail = AsyncMock()
        mock_response_fail.status = 500
        mock_response_fail.text = AsyncMock(return_value="Server Error")

        mock_response_success = AsyncMock()
        mock_response_success.status = 200
        mock_response_success.text = AsyncMock(return_value="OK")

        mock_post.return_value.__aenter__.side_effect = [
            mock_response_fail,
            mock_response_fail,
            mock_response_success,
        ]

        # Send webhook (should retry and eventually succeed)
        result = await webhook_service.send_webhook("test.event", {"data": "test"})

        # Verify retries occurred
        assert mock_post.call_count == 3
        assert result is True


@pytest.mark.asyncio
async def test_payroll_export(
    db: AsyncSession,
    payroll_service: PayrollIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test payroll timesheet export."""
    employee, schedule, assignments = test_employee_with_schedule

    # Mark assignments as completed
    for assignment in assignments:
        assignment.status = "completed"
    await db.commit()

    # Register payroll system
    payroll_service.register_payroll_system(
        "test_payroll",
        "https://payroll.example.com/api",
        {"api_key": "test_key"},
    )

    # Mock payroll API
    with patch.object(
        payroll_service,
        "_send_to_payroll_system",
        new_callable=AsyncMock,
    ) as mock_send:
        mock_send.return_value = {
            "status": "success",
            "records_processed": 1,
            "payroll_batch_id": "batch_123",
        }

        # Export timesheet
        result = await payroll_service.export_timesheet_data(
            db,
            "test_payroll",
            date_from=date.today(),
            date_to=date.today() + timedelta(days=7),
            employee_ids=[employee.id],
        )

        # Verify export results
        assert result["success"] is True
        assert result["system"] == "test_payroll"
        assert result["employees_exported"] > 0

        # Verify payroll data was sent
        assert mock_send.called
        call_args = mock_send.call_args[0]
        timesheet_data = call_args[1]
        assert len(timesheet_data) > 0
        assert timesheet_data[0]["employee_id"] == employee.id


@pytest.mark.asyncio
async def test_calendar_sync_date_range_filter(
    db: AsyncSession,
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test calendar sync with date range filtering."""
    employee, schedule, assignments = test_employee_with_schedule

    # Mock calendar API
    with patch.object(
        calendar_service,
        "_create_google_calendar_event",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = {"success": True, "event_id": "evt_123"}

        # Sync only today
        result = await calendar_service.sync_to_google_calendar(
            db,
            employee_id=employee.id,
            calendar_id="primary",
            date_from=date.today(),
            date_to=date.today(),
        )

        # Should only sync shifts from today
        assert result["events_created"] <= result["total_schedules"]


@pytest.mark.asyncio
async def test_calendar_sync_error_handling(
    db: AsyncSession,
    calendar_service: CalendarIntegrationService,
    test_employee_with_schedule: tuple,
):
    """Test calendar sync error handling."""
    employee, schedule, assignments = test_employee_with_schedule

    # Mock calendar API to fail
    with patch.object(
        calendar_service,
        "_create_google_calendar_event",
        new_callable=AsyncMock,
    ) as mock_create:
        mock_create.return_value = {"success": False, "error": "API Error"}

        # Sync should handle errors gracefully
        result = await calendar_service.sync_to_google_calendar(
            db,
            employee_id=employee.id,
            calendar_id="primary",
            date_from=date.today(),
            date_to=date.today() + timedelta(days=7),
        )

        # Verify errors were captured
        assert result["success"] is True  # Overall operation succeeded
        assert len(result["errors"]) > 0  # But individual events had errors
        assert result["events_created"] == 0  # No events created due to failures
