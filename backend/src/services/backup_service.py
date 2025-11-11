"""
Backup and restore service for the AI Schedule Manager.
Provides full database backup, incremental backups, and point-in-time recovery.
"""

import asyncio
import json
import logging
import os
import shutil
import tarfile
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
from cryptography.fernet import Fernet
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_database_session
from ..exceptions.import_exceptions import BackupError
from ..models import Employee, Notification, Rule, Schedule, Shift

logger = logging.getLogger(__name__)


class BackupService:
    """Service for database backup and restore operations."""

    def __init__(self):
        self.backup_dir = Path(tempfile.gettempdir()) / "ai_scheduler_backups"
        self.backup_dir.mkdir(exist_ok=True)

        # Encryption settings
        self.encryption_key = self._get_or_create_encryption_key()
        self.cipher_suite = Fernet(self.encryption_key)

        # Retention settings
        self.retention_days = 30
        self.max_backups = 50

        # Backup metadata storage
        self.metadata_file = self.backup_dir / "backup_metadata.json"
        self.backup_metadata = self._load_metadata()

    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for backups."""
        key_file = self.backup_dir / "encryption.key"

        if key_file.exists():
            with open(key_file, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            return key

    def _load_metadata(self) -> Dict[str, Any]:
        """Load backup metadata from file."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading backup metadata: {e}")

        return {"backups": {}, "last_cleanup": None}

    def _save_metadata(self):
        """Save backup metadata to file."""
        try:
            with open(self.metadata_file, "w") as f:
                json.dump(self.backup_metadata, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving backup metadata: {e}")

    async def create_backup(
        self, db: AsyncSession, backup_type: str = "full", include_files: bool = True, user_id: str = "system"
    ) -> str:
        """Create a new backup."""
        try:
            backup_id = str(uuid.uuid4())
            backup_timestamp = datetime.utcnow()

            logger.info(f"Starting {backup_type} backup {backup_id}")

            # Create backup directory
            backup_path = self.backup_dir / backup_id
            backup_path.mkdir(exist_ok=True)

            # Initialize backup metadata
            backup_info = {
                "backup_id": backup_id,
                "backup_type": backup_type,
                "created_at": backup_timestamp,
                "created_by": user_id,
                "status": "in_progress",
                "include_files": include_files,
                "size": 0,
                "tables": [],
                "file_count": 0,
            }

            self.backup_metadata["backups"][backup_id] = backup_info
            self._save_metadata()

            # Perform backup based on type
            if backup_type == "full":
                await self._create_full_backup(db, backup_id, backup_path, include_files)
            elif backup_type == "incremental":
                await self._create_incremental_backup(db, backup_id, backup_path, include_files)
            else:
                raise BackupError(f"Unsupported backup type: {backup_type}")

            # Calculate backup size
            backup_size = sum(f.stat().st_size for f in backup_path.rglob("*") if f.is_file())

            # Update metadata
            backup_info.update({"status": "completed", "completed_at": datetime.utcnow(), "size": backup_size})

            self.backup_metadata["backups"][backup_id] = backup_info
            self._save_metadata()

            logger.info(f"Backup {backup_id} completed successfully. Size: {backup_size} bytes")
            return backup_id

        except Exception as e:
            logger.error(f"Backup creation failed: {e}")
            # Update metadata with error status
            if backup_id in self.backup_metadata["backups"]:
                self.backup_metadata["backups"][backup_id].update(
                    {"status": "failed", "error": str(e), "failed_at": datetime.utcnow()}
                )
                self._save_metadata()
            raise BackupError(f"Backup failed: {str(e)}")

    async def _create_full_backup(self, db: AsyncSession, backup_id: str, backup_path: Path, include_files: bool):
        """Create a full database backup."""
        tables_to_backup = [Employee, Schedule, Rule, Shift, Notification]

        backed_up_tables = []

        for model in tables_to_backup:
            table_name = model.__tablename__
            logger.info(f"Backing up table: {table_name}")

            try:
                # Get all records from table
                query = select(model)
                result = await db.execute(query)
                records = result.scalars().all()

                # Convert to serializable format
                table_data = []
                for record in records:
                    record_dict = {}
                    for column in model.__table__.columns:
                        value = getattr(record, column.name)
                        # Handle datetime and other non-serializable types
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        elif hasattr(value, "__dict__"):
                            value = str(value)
                        record_dict[column.name] = value
                    table_data.append(record_dict)

                # Save table data to encrypted file
                table_file = backup_path / f"{table_name}.json"
                encrypted_data = self._encrypt_data(json.dumps(table_data, default=str))

                async with aiofiles.open(table_file, "wb") as f:
                    await f.write(encrypted_data)

                backed_up_tables.append({"table": table_name, "record_count": len(table_data), "file": str(table_file)})

                logger.info(f"Backed up {len(table_data)} records from {table_name}")

            except Exception as e:
                logger.error(f"Error backing up table {table_name}: {e}")
                raise

        # Save database schema
        await self._backup_schema(db, backup_path)

        # Include uploaded files if requested
        if include_files:
            await self._backup_files(backup_path)

        # Update backup metadata
        self.backup_metadata["backups"][backup_id]["tables"] = backed_up_tables

    async def _create_incremental_backup(self, db: AsyncSession, backup_id: str, backup_path: Path, include_files: bool):
        """Create an incremental backup (changes since last backup)."""
        # Find the last successful backup
        last_backup = None
        for bid, info in self.backup_metadata["backups"].items():
            if info["status"] == "completed":
                if last_backup is None or info["created_at"] > last_backup["created_at"]:
                    last_backup = info

        if not last_backup:
            logger.warning("No previous backup found, creating full backup instead")
            await self._create_full_backup(db, backup_id, backup_path, include_files)
            return

        last_backup_time = datetime.fromisoformat(last_backup["created_at"])
        logger.info(f"Creating incremental backup since {last_backup_time}")

        tables_to_backup = [Employee, Schedule, Rule, Shift, Notification]

        backed_up_tables = []

        for model in tables_to_backup:
            table_name = model.__tablename__

            try:
                # Get records modified since last backup
                if hasattr(model, "updated_at"):
                    query = select(model).where(model.updated_at >= last_backup_time)
                elif hasattr(model, "created_at"):
                    query = select(model).where(model.created_at >= last_backup_time)
                else:
                    # If no timestamp column, skip incremental for this table
                    logger.warning(f"Table {table_name} has no timestamp column, skipping")
                    continue

                result = await db.execute(query)
                records = result.scalars().all()

                if not records:
                    logger.info(f"No changes in table {table_name}")
                    continue

                # Convert to serializable format
                table_data = []
                for record in records:
                    record_dict = {}
                    for column in model.__table__.columns:
                        value = getattr(record, column.name)
                        if isinstance(value, datetime):
                            value = value.isoformat()
                        elif hasattr(value, "__dict__"):
                            value = str(value)
                        record_dict[column.name] = value
                    table_data.append(record_dict)

                # Save incremental data
                table_file = backup_path / f"{table_name}_incremental.json"
                encrypted_data = self._encrypt_data(json.dumps(table_data, default=str))

                async with aiofiles.open(table_file, "wb") as f:
                    await f.write(encrypted_data)

                backed_up_tables.append(
                    {
                        "table": table_name,
                        "record_count": len(table_data),
                        "file": str(table_file),
                        "incremental": True,
                        "since": last_backup_time.isoformat(),
                    }
                )

                logger.info(f"Backed up {len(table_data)} changed records from {table_name}")

            except Exception as e:
                logger.error(f"Error creating incremental backup for {table_name}: {e}")
                raise

        # Update backup metadata
        self.backup_metadata["backups"][backup_id]["tables"] = backed_up_tables

    async def _backup_schema(self, db: AsyncSession, backup_path: Path):
        """Backup database schema."""
        try:
            # Get table creation statements (PostgreSQL specific)
            schema_info = []

            # Get all table names
            result = await db.execute(
                text(
                    """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            """
                )
            )

            tables = result.fetchall()

            for table in tables:
                table_name = table[0]

                # Get table structure
                result = await db.execute(
                    text(
                        f"""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = '{table_name}'
                    ORDER BY ordinal_position
                """
                    )
                )

                columns = result.fetchall()
                schema_info.append(
                    {
                        "table_name": table_name,
                        "columns": [
                            {"name": col[0], "type": col[1], "nullable": col[2] == "YES", "default": col[3]} for col in columns
                        ],
                    }
                )

            # Save schema
            schema_file = backup_path / "schema.json"
            encrypted_schema = self._encrypt_data(json.dumps(schema_info, default=str))

            async with aiofiles.open(schema_file, "wb") as f:
                await f.write(encrypted_schema)

            logger.info("Database schema backed up successfully")

        except Exception as e:
            logger.error(f"Error backing up schema: {e}")
            raise

    async def _backup_files(self, backup_path: Path):
        """Backup uploaded files and temporary files."""
        try:
            files_dir = backup_path / "files"
            files_dir.mkdir(exist_ok=True)

            # Backup upload directory if it exists
            upload_dir = Path(tempfile.gettempdir()) / "ai_scheduler_uploads"
            if upload_dir.exists():
                shutil.copytree(upload_dir, files_dir / "uploads", dirs_exist_ok=True)

            logger.info("Files backed up successfully")

        except Exception as e:
            logger.error(f"Error backing up files: {e}")
            # Don't fail the entire backup for file backup errors
            logger.warning("Continuing backup without files")

    def _encrypt_data(self, data: str) -> bytes:
        """Encrypt data for secure backup storage."""
        return self.cipher_suite.encrypt(data.encode())

    def _decrypt_data(self, encrypted_data: bytes) -> str:
        """Decrypt backup data."""
        return self.cipher_suite.decrypt(encrypted_data).decode()

    async def restore_backup(
        self, backup_id: str, db: AsyncSession, verify_before_restore: bool = True, user_id: str = "system"
    ) -> str:
        """Restore from backup."""
        try:
            if backup_id not in self.backup_metadata["backups"]:
                raise BackupError(f"Backup {backup_id} not found")

            backup_info = self.backup_metadata["backups"][backup_id]

            if backup_info["status"] != "completed":
                raise BackupError(f"Backup {backup_id} is not in completed state")

            restore_id = str(uuid.uuid4())
            logger.info(f"Starting restore {restore_id} from backup {backup_id}")

            backup_path = self.backup_dir / backup_id

            if not backup_path.exists():
                raise BackupError(f"Backup files not found for {backup_id}")

            # Verify backup integrity if requested
            if verify_before_restore:
                await self._verify_backup_integrity(backup_path, backup_info)

            # Create restore point (backup current state)
            restore_point_id = await self.create_backup(db, "full", False, f"restore_point_{user_id}")

            try:
                # Perform restore
                await self._restore_from_backup(db, backup_path, backup_info)

                logger.info(f"Restore {restore_id} completed successfully")
                return restore_id

            except Exception as e:
                logger.error(f"Restore failed, attempting rollback to restore point")
                # Attempt to rollback to restore point
                try:
                    await self._restore_from_backup(
                        db, self.backup_dir / restore_point_id, self.backup_metadata["backups"][restore_point_id]
                    )
                    logger.info("Rollback to restore point successful")
                except Exception as rollback_error:
                    logger.error(f"Rollback failed: {rollback_error}")

                raise BackupError(f"Restore failed and rollback attempted: {str(e)}")

        except Exception as e:
            logger.error(f"Restore operation failed: {e}")
            raise BackupError(f"Restore failed: {str(e)}")

    async def _verify_backup_integrity(self, backup_path: Path, backup_info: Dict[str, Any]):
        """Verify backup file integrity."""
        try:
            logger.info("Verifying backup integrity...")

            # Check that all expected files exist
            for table_info in backup_info.get("tables", []):
                table_file = Path(table_info["file"])
                if not table_file.exists():
                    raise BackupError(f"Backup file missing: {table_file}")

                # Try to decrypt and parse the file
                async with aiofiles.open(table_file, "rb") as f:
                    encrypted_data = await f.read()

                try:
                    decrypted_data = self._decrypt_data(encrypted_data)
                    json.loads(decrypted_data)
                except Exception as e:
                    raise BackupError(f"Backup file corrupted: {table_file} - {e}")

            logger.info("Backup integrity verification passed")

        except Exception as e:
            logger.error(f"Backup integrity verification failed: {e}")
            raise

    async def _restore_from_backup(self, db: AsyncSession, backup_path: Path, backup_info: Dict[str, Any]):
        """Restore database from backup files."""
        try:
            # If it's an incremental backup, we need to be more careful
            if backup_info.get("backup_type") == "incremental":
                await self._restore_incremental_backup(db, backup_path, backup_info)
            else:
                await self._restore_full_backup(db, backup_path, backup_info)

        except Exception as e:
            logger.error(f"Database restore failed: {e}")
            raise

    async def _restore_full_backup(self, db: AsyncSession, backup_path: Path, backup_info: Dict[str, Any]):
        """Restore from a full backup."""
        # Clear existing data (be very careful here!)
        logger.warning("Clearing existing database data for full restore")

        # Delete in reverse dependency order to avoid foreign key issues
        models_to_clear = [Notification, Schedule, Rule, Shift, Employee]

        for model in models_to_clear:
            await db.execute(text(f"DELETE FROM {model.__tablename__}"))

        await db.commit()

        # Restore data from backup
        for table_info in backup_info.get("tables", []):
            await self._restore_table_data(db, table_info)

        await db.commit()
        logger.info("Full database restore completed")

    async def _restore_incremental_backup(self, db: AsyncSession, backup_path: Path, backup_info: Dict[str, Any]):
        """Restore from an incremental backup."""
        logger.info("Restoring incremental backup")

        for table_info in backup_info.get("tables", []):
            await self._restore_table_data(db, table_info, incremental=True)

        await db.commit()
        logger.info("Incremental database restore completed")

    async def _restore_table_data(self, db: AsyncSession, table_info: Dict[str, Any], incremental: bool = False):
        """Restore data for a specific table."""
        table_name = table_info["table"]
        table_file = Path(table_info["file"])

        logger.info(f"Restoring table: {table_name}")

        try:
            # Read and decrypt table data
            async with aiofiles.open(table_file, "rb") as f:
                encrypted_data = await f.read()

            decrypted_data = self._decrypt_data(encrypted_data)
            table_data = json.loads(decrypted_data)

            if not table_data:
                logger.info(f"No data to restore for table {table_name}")
                return

            # Get model class
            model_map = {
                "employees": Employee,
                "schedules": Schedule,
                "rules": Rule,
                "shifts": Shift,
                "notifications": Notification,
            }

            model = model_map.get(table_name)
            if not model:
                logger.warning(f"Unknown table: {table_name}")
                return

            # Restore records
            for record_data in table_data:
                # Convert string dates back to datetime objects
                for column in model.__table__.columns:
                    if column.name in record_data:
                        value = record_data[column.name]
                        if isinstance(value, str) and "T" in value:  # ISO datetime
                            try:
                                record_data[column.name] = datetime.fromisoformat(value)
                            except ValueError:
                                pass  # Keep as string if not a valid datetime

                if incremental:
                    # For incremental restore, use upsert (insert or update)
                    # This is a simplified approach - in production, you'd want more sophisticated conflict resolution
                    existing_query = select(model).where(model.id == record_data["id"])
                    result = await db.execute(existing_query)
                    existing = result.scalar_one_or_none()

                    if existing:
                        # Update existing record
                        for key, value in record_data.items():
                            if key != "id":
                                setattr(existing, key, value)
                    else:
                        # Insert new record
                        new_record = model(**record_data)
                        db.add(new_record)
                else:
                    # For full restore, just insert
                    new_record = model(**record_data)
                    db.add(new_record)

            logger.info(f"Restored {len(table_data)} records for table {table_name}")

        except Exception as e:
            logger.error(f"Error restoring table {table_name}: {e}")
            raise

    async def list_backups(self, skip: int = 0, limit: int = 10) -> Dict[str, Any]:
        """List available backups with pagination."""
        backups = list(self.backup_metadata["backups"].values())

        # Sort by creation date (newest first)
        backups.sort(key=lambda x: x["created_at"], reverse=True)

        total = len(backups)
        paginated_backups = backups[skip : skip + limit]

        return {"items": paginated_backups, "total": total}

    async def get_backup_status(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Get backup status and details."""
        return self.backup_metadata["backups"].get(backup_id)

    async def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup and its files."""
        try:
            if backup_id not in self.backup_metadata["backups"]:
                return False

            backup_path = self.backup_dir / backup_id

            # Delete backup files
            if backup_path.exists():
                shutil.rmtree(backup_path)

            # Remove from metadata
            del self.backup_metadata["backups"][backup_id]
            self._save_metadata()

            logger.info(f"Backup {backup_id} deleted successfully")
            return True

        except Exception as e:
            logger.error(f"Error deleting backup {backup_id}: {e}")
            return False

    async def cleanup_old_backups(self):
        """Clean up old backups based on retention policy."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
            backups_to_delete = []

            # Find backups older than retention period
            for backup_id, backup_info in self.backup_metadata["backups"].items():
                created_at = datetime.fromisoformat(backup_info["created_at"])
                if created_at < cutoff_date:
                    backups_to_delete.append(backup_id)

            # Keep at least a few recent backups even if they're old
            if len(self.backup_metadata["backups"]) - len(backups_to_delete) < 3:
                # Sort by date and keep the 3 most recent
                all_backups = list(self.backup_metadata["backups"].items())
                all_backups.sort(key=lambda x: x[1]["created_at"], reverse=True)
                keep_backups = set(backup_id for backup_id, _ in all_backups[:3])
                backups_to_delete = [bid for bid in backups_to_delete if bid not in keep_backups]

            # Delete old backups
            for backup_id in backups_to_delete:
                await self.delete_backup(backup_id)

            logger.info(f"Cleaned up {len(backups_to_delete)} old backups")

            # Update last cleanup time
            self.backup_metadata["last_cleanup"] = datetime.utcnow()
            self._save_metadata()

        except Exception as e:
            logger.error(f"Error during backup cleanup: {e}")


# Global backup service instance
backup_service = BackupService()
