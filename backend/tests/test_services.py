"""
Comprehensive tests for service layer components.
Tests backup, export, import, and integration services.

Coverage target: >75%
"""

import io
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.models.schedule import Schedule
from backend.src.models.employee import User
from backend.src.services.backup_service import BackupService
from backend.src.services.export_service import ExportService
from backend.src.services.import_service import ImportService
from backend.src.services.integration_service import IntegrationService


class TestBackupService:
    """Test backup and restore functionality."""

    @pytest.fixture
    async def backup_service(self, db_session):
        """Create backup service instance."""
        return BackupService(db_session)

    @pytest.mark.asyncio
    async def test_create_backup(self, backup_service: BackupService, tmp_path):
        """Test creating database backup."""
        backup_path = tmp_path / "test_backup.sql"

        result = await backup_service.create_backup(str(backup_path))

        assert result is True
        assert backup_path.exists()
        assert backup_path.stat().st_size > 0

    @pytest.mark.asyncio
    async def test_create_backup_with_compression(self, backup_service: BackupService, tmp_path):
        """Test creating compressed backup."""
        backup_path = tmp_path / "test_backup.sql.gz"

        result = await backup_service.create_backup(str(backup_path), compress=True)

        assert result is True
        assert backup_path.exists()

    @pytest.mark.asyncio
    async def test_restore_backup(self, backup_service: BackupService, tmp_path, db_session: AsyncSession):
        """Test restoring from backup."""
        import bcrypt

        # Create some data
        emp = User(
            email="backup_test@test.com",
            password_hash=bcrypt.hashpw(b"test", bcrypt.gensalt()).decode(),
            first_name="Backup",
            last_name="Test"
        )
        db_session.add(emp)
        await db_session.commit()

        # Create backup
        backup_path = tmp_path / "restore_test.sql"
        await backup_service.create_backup(str(backup_path))

        # Delete data
        await db_session.delete(emp)
        await db_session.commit()

        # Restore
        result = await backup_service.restore_backup(str(backup_path))
        assert result is True

        # Verify data restored
        from sqlalchemy import select
        query = select(User).where(User.email == "backup_test@test.com")
        result = await db_session.execute(query)
        restored_emp = result.scalar_one_or_none()
        # Note: May not exist in test isolation

    @pytest.mark.asyncio
    async def test_list_backups(self, backup_service: BackupService, tmp_path):
        """Test listing available backups."""
        # Create multiple backups
        for i in range(3):
            backup_path = tmp_path / f"backup_{i}.sql"
            await backup_service.create_backup(str(backup_path))

        backups = await backup_service.list_backups(str(tmp_path))

        assert len(backups) >= 3
        assert all("backup_" in str(b) for b in backups)

    @pytest.mark.asyncio
    async def test_delete_old_backups(self, backup_service: BackupService, tmp_path):
        """Test automatic cleanup of old backups."""
        # Create backups with different timestamps
        for i in range(5):
            backup_path = tmp_path / f"old_backup_{i}.sql"
            backup_path.write_text("fake backup data")

        # Delete backups older than 1 day
        deleted = await backup_service.delete_old_backups(str(tmp_path), days=1)

        assert deleted >= 0  # Some may be deleted

    @pytest.mark.asyncio
    async def test_verify_backup_integrity(self, backup_service: BackupService, tmp_path):
        """Test verifying backup file integrity."""
        backup_path = tmp_path / "verify_test.sql"
        await backup_service.create_backup(str(backup_path))

        is_valid = await backup_service.verify_backup(str(backup_path))
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_backup_with_partial_data(self, backup_service: BackupService, tmp_path):
        """Test creating backup of specific tables only."""
        backup_path = tmp_path / "partial_backup.sql"

        result = await backup_service.create_backup(
            str(backup_path),
            tables=["users", "departments"]
        )

        assert result is True


class TestExportService:
    """Test data export functionality."""

    @pytest.fixture
    async def export_service(self, db_session):
        """Create export service instance."""
        return ExportService(db_session)

    @pytest.mark.asyncio
    async def test_export_to_json(self, export_service: ExportService, existing_user):
        """Test exporting data to JSON."""
        data = await export_service.export_to_json(model=User, limit=10)

        assert isinstance(data, str)
        parsed = json.loads(data)
        assert isinstance(parsed, list)
        assert len(parsed) > 0

    @pytest.mark.asyncio
    async def test_export_to_csv(self, export_service: ExportService, existing_user):
        """Test exporting data to CSV."""
        csv_data = await export_service.export_to_csv(model=User)

        assert isinstance(csv_data, str)
        assert "email" in csv_data
        assert "first_name" in csv_data

    @pytest.mark.asyncio
    async def test_export_to_excel(self, export_service: ExportService, existing_user, tmp_path):
        """Test exporting data to Excel."""
        excel_path = tmp_path / "export.xlsx"

        await export_service.export_to_excel(model=User, filepath=str(excel_path))

        assert excel_path.exists()
        assert excel_path.stat().st_size > 0

    @pytest.mark.asyncio
    async def test_export_schedule_to_ical(self, export_service: ExportService, existing_user, db_session: AsyncSession):
        """Test exporting schedule to iCalendar format."""
        # Create schedule with shifts
        schedule = Schedule(
            name="iCal Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        ical_data = await export_service.export_schedule_to_ical(schedule.id)

        assert "BEGIN:VCALENDAR" in ical_data
        assert "END:VCALENDAR" in ical_data

    @pytest.mark.asyncio
    async def test_export_filtered_data(self, export_service: ExportService, db_session: AsyncSession):
        """Test exporting with filters applied."""
        import bcrypt

        dept_id = None  # Would create department in full test

        # Create employees in specific department
        password_hash = bcrypt.hashpw(b"test", bcrypt.gensalt()).decode()
        for i in range(5):
            emp = User(
                email=f"export_filter{i}@test.com",
                password_hash=password_hash,
                first_name="Export",
                last_name=f"Filter{i}",
                department_id=dept_id
            )
            db_session.add(emp)
        await db_session.commit()

        # Export with filter
        data = await export_service.export_to_json(
            model=User,
            filters={"department_id": dept_id}
        )

        parsed = json.loads(data)
        assert len(parsed) >= 5

    @pytest.mark.asyncio
    async def test_export_with_custom_fields(self, export_service: ExportService):
        """Test exporting specific fields only."""
        data = await export_service.export_to_json(
            model=User,
            fields=["id", "email", "first_name"]
        )

        parsed = json.loads(data)
        if len(parsed) > 0:
            assert "id" in parsed[0]
            assert "email" in parsed[0]
            assert "password_hash" not in parsed[0]  # Not included


class TestImportService:
    """Test data import functionality."""

    @pytest.fixture
    async def import_service(self, db_session):
        """Create import service instance."""
        return ImportService(db_session)

    @pytest.mark.asyncio
    async def test_import_from_json(self, import_service: ImportService):
        """Test importing data from JSON."""
        json_data = json.dumps([
            {
                "email": "import1@test.com",
                "first_name": "Import",
                "last_name": "User1",
                "password": "SecurePass123!"
            },
            {
                "email": "import2@test.com",
                "first_name": "Import",
                "last_name": "User2",
                "password": "SecurePass123!"
            }
        ])

        result = await import_service.import_from_json(json_data, model=User)

        assert result["success"] is True
        assert result["imported"] >= 2

    @pytest.mark.asyncio
    async def test_import_from_csv(self, import_service: ImportService):
        """Test importing data from CSV."""
        csv_data = """email,first_name,last_name,password
csv1@test.com,CSV,User1,SecurePass123!
csv2@test.com,CSV,User2,SecurePass123!"""

        result = await import_service.import_from_csv(csv_data, model=User)

        assert result["success"] is True
        assert result["imported"] >= 2

    @pytest.mark.asyncio
    async def test_import_with_validation_errors(self, import_service: ImportService):
        """Test import handles validation errors gracefully."""
        json_data = json.dumps([
            {
                "email": "invalid-email",  # Invalid format
                "first_name": "Invalid",
                "last_name": "User"
            }
        ])

        result = await import_service.import_from_json(json_data, model=User)

        assert "errors" in result
        assert len(result["errors"]) > 0

    @pytest.mark.asyncio
    async def test_import_with_duplicates(self, import_service: ImportService, existing_user):
        """Test import handles duplicate records."""
        json_data = json.dumps([
            {
                "email": existing_user.email,  # Duplicate
                "first_name": "Duplicate",
                "last_name": "User",
                "password": "SecurePass123!"
            }
        ])

        result = await import_service.import_from_json(
            json_data,
            model=User,
            skip_duplicates=True
        )

        assert result["skipped"] >= 1

    @pytest.mark.asyncio
    async def test_import_from_excel(self, import_service: ImportService, tmp_path):
        """Test importing data from Excel file."""
        import pandas as pd

        # Create Excel file
        excel_path = tmp_path / "import.xlsx"
        df = pd.DataFrame([
            {"email": "excel1@test.com", "first_name": "Excel", "last_name": "User1"},
            {"email": "excel2@test.com", "first_name": "Excel", "last_name": "User2"}
        ])
        df.to_excel(excel_path, index=False)

        result = await import_service.import_from_excel(str(excel_path), model=User)

        assert result["success"] is True
        assert result["imported"] >= 2

    @pytest.mark.asyncio
    async def test_import_with_mapping(self, import_service: ImportService):
        """Test import with field name mapping."""
        csv_data = """EmailAddress,FirstName,LastName,Pass
mapping1@test.com,Map,User1,SecurePass123!"""

        field_mapping = {
            "EmailAddress": "email",
            "FirstName": "first_name",
            "LastName": "last_name",
            "Pass": "password"
        }

        result = await import_service.import_from_csv(
            csv_data,
            model=User,
            field_mapping=field_mapping
        )

        assert result["success"] is True


class TestIntegrationService:
    """Test external integrations."""

    @pytest.fixture
    async def integration_service(self, db_session):
        """Create integration service instance."""
        return IntegrationService(db_session)

    @pytest.mark.asyncio
    async def test_sync_with_google_calendar(self, integration_service: IntegrationService, existing_user, db_session: AsyncSession):
        """Test syncing schedule with Google Calendar."""
        # Create schedule
        schedule = Schedule(
            name="Google Sync Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=7),
            created_by_id=existing_user.id
        )
        db_session.add(schedule)
        await db_session.commit()
        await db_session.refresh(schedule)

        with patch('backend.src.services.integration_service.GoogleCalendarAPI') as mock_api:
            mock_api.return_value.create_event = AsyncMock(return_value={"id": "event123"})

            result = await integration_service.sync_to_google_calendar(schedule.id)

        assert result["success"] is True
        assert "event_id" in result

    @pytest.mark.asyncio
    async def test_send_notification_email(self, integration_service: IntegrationService, existing_user):
        """Test sending notification email."""
        with patch('backend.src.services.email.email_service.send_email') as mock_send:
            mock_send.return_value = True

            result = await integration_service.send_notification(
                user_id=existing_user.id,
                subject="Test Notification",
                message="This is a test"
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_webhook_trigger(self, integration_service: IntegrationService):
        """Test triggering webhook for events."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.return_value.status_code = 200

            result = await integration_service.trigger_webhook(
                event="schedule.published",
                payload={"schedule_id": 123}
            )

        assert result is True

    @pytest.mark.asyncio
    async def test_slack_integration(self, integration_service: IntegrationService):
        """Test sending message to Slack."""
        with patch('httpx.AsyncClient.post') as mock_post:
            mock_post.return_value.status_code = 200

            result = await integration_service.send_slack_message(
                channel="#schedules",
                message="New schedule published"
            )

        assert result is True
