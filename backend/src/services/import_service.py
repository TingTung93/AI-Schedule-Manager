"""
Import service for data import functionality.
Supports CSV, Excel import with validation and duplicate detection.
"""

import asyncio
import io
import logging
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional, Tuple, Union

import chardet
import filetype
import pandas as pd
from pydantic import ValidationError
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions.import_exceptions import DuplicateDataError, ImportValidationError
from ..models import Employee, Rule, Schedule, ScheduleAssignment, Shift
from ..schemas import EmployeeCreate, RuleCreate, ScheduleCreate, ShiftCreate
from ..services.crud import crud_employee, crud_rule, crud_schedule

logger = logging.getLogger(__name__)


class ImportService:
    """Service for handling data imports."""

    def __init__(self):
        self.supported_formats = ["csv", "excel", "xlsx", "xls"]
        self.max_file_size = 50 * 1024 * 1024  # 50MB
        self.max_rows = 10000

    async def _get_or_create_schedule_for_week(
        self, db: AsyncSession, shift_date: date, created_by: int
    ) -> Schedule:
        """
        Find or create Schedule container for the week containing shift_date.

        Args:
            db: Database session
            shift_date: Date of the shift (used to determine week range)
            created_by: User ID creating the schedule

        Returns:
            Schedule object for the week
        """
        from datetime import timedelta

        # Calculate week start (Monday) and end (Sunday) from shift_date
        week_start = shift_date - timedelta(days=shift_date.weekday())
        week_end = week_start + timedelta(days=6)

        # Try to find existing schedule for this week
        query = select(Schedule).where(Schedule.week_start == week_start, Schedule.week_end == week_end)
        result = await db.execute(query)
        schedule = result.scalar_one_or_none()

        if not schedule:
            # Create new schedule for this week
            schedule = Schedule(
                week_start=week_start,
                week_end=week_end,
                status="draft",
                created_by=created_by,
                version=1,
            )
            db.add(schedule)
            await db.flush()  # Get ID without committing transaction

        return schedule

    async def validate_file(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Validate uploaded file format and content."""
        try:
            # Check file size
            if len(file_content) > self.max_file_size:
                raise ImportValidationError(f"File size exceeds maximum limit of {self.max_file_size / 1024 / 1024}MB")

            # Detect file type
            file_type = filetype.guess(file_content)
            file_extension = filename.split(".")[-1].lower()

            # Validate file format
            if file_extension not in self.supported_formats:
                raise ImportValidationError(f"Unsupported file format: {file_extension}")

            # Detect encoding for text files
            encoding = "utf-8"
            if file_extension == "csv":
                detected = chardet.detect(file_content)
                encoding = detected.get("encoding", "utf-8")

            return {
                "file_type": file_type.extension if file_type else file_extension,
                "encoding": encoding,
                "size": len(file_content),
                "valid": True,
            }

        except Exception as e:
            logger.error(f"File validation error: {e}")
            raise ImportValidationError(f"File validation failed: {str(e)}")

    async def preview_import_data(
        self, file_content: bytes, filename: str, import_type: str, preview_rows: int = 10
    ) -> Dict[str, Any]:
        """Preview import data before actual import."""
        try:
            validation_result = await self.validate_file(file_content, filename)
            df = await self._read_file_to_dataframe(file_content, filename, validation_result["encoding"])

            # Validate column structure based on import type
            expected_columns = self._get_expected_columns(import_type)
            missing_columns = set(expected_columns) - set(df.columns)
            extra_columns = set(df.columns) - set(expected_columns)

            # Get preview data
            preview_data = df.head(preview_rows).to_dict("records")

            return {
                "total_rows": len(df),
                "columns": list(df.columns),
                "expected_columns": expected_columns,
                "missing_columns": list(missing_columns),
                "extra_columns": list(extra_columns),
                "preview_data": preview_data,
                "validation_errors": [],
                "warnings": [],
            }

        except Exception as e:
            logger.error(f"Preview import error: {e}")
            raise ImportValidationError(f"Failed to preview import data: {str(e)}")

    async def import_employees(
        self, db: AsyncSession, file_content: bytes, filename: str, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Import employees from file."""
        try:
            validation_result = await self.validate_file(file_content, filename)
            df = await self._read_file_to_dataframe(file_content, filename, validation_result["encoding"])

            # Validate and process data
            result = await self._process_employee_import(db, df, options or {})
            return result

        except Exception as e:
            logger.error(f"Employee import error: {e}")
            raise

    async def import_schedules(
        self, db: AsyncSession, file_content: bytes, filename: str, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Import schedules from file."""
        try:
            validation_result = await self.validate_file(file_content, filename)
            df = await self._read_file_to_dataframe(file_content, filename, validation_result["encoding"])

            # Validate and process data
            result = await self._process_schedule_import(db, df, options or {})
            return result

        except Exception as e:
            logger.error(f"Schedule import error: {e}")
            raise

    async def import_rules(
        self, db: AsyncSession, file_content: bytes, filename: str, options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Import rules from file."""
        try:
            validation_result = await self.validate_file(file_content, filename)
            df = await self._read_file_to_dataframe(file_content, filename, validation_result["encoding"])

            # Validate and process data
            result = await self._process_rule_import(db, df, options or {})
            return result

        except Exception as e:
            logger.error(f"Rule import error: {e}")
            raise

    async def _read_file_to_dataframe(self, file_content: bytes, filename: str, encoding: str) -> pd.DataFrame:
        """Read file content to pandas DataFrame."""
        file_extension = filename.split(".")[-1].lower()

        if file_extension == "csv":
            # Try to detect delimiter
            sample = file_content[:1024].decode(encoding, errors="ignore")
            delimiter = "," if "," in sample else ";" if ";" in sample else "\t"

            df = pd.read_csv(
                io.BytesIO(file_content), encoding=encoding, delimiter=delimiter, na_values=["", "NULL", "null", "None", "N/A"]
            )
        elif file_extension in ["xlsx", "xls"]:
            df = pd.read_excel(io.BytesIO(file_content), na_values=["", "NULL", "null", "None", "N/A"])
        else:
            raise ImportValidationError(f"Unsupported file format: {file_extension}")

        # Check row limit
        if len(df) > self.max_rows:
            raise ImportValidationError(f"File contains too many rows. Maximum allowed: {self.max_rows}")

        return df

    async def _process_employee_import(self, db: AsyncSession, df: pd.DataFrame, options: Dict[str, Any]) -> Dict[str, Any]:
        """Process employee import data."""
        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["name", "email", "role"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Process each row
        for index, row in df.iterrows():
            try:
                # Map columns
                employee_data = {}
                for target_col, source_col in mapped_columns.items():
                    if target_col in df.columns:
                        employee_data[source_col] = row[target_col]

                # Handle optional columns
                optional_mapping = {
                    "phone": "phone",
                    "hourly_rate": "hourly_rate",
                    "max_hours_per_week": "max_hours_per_week",
                    "qualifications": "qualifications",
                    "active": "active",
                }

                for source_col, target_col in optional_mapping.items():
                    mapped_col = column_mapping.get(source_col, source_col)
                    if mapped_col in df.columns and pd.notna(row[mapped_col]):
                        if source_col == "qualifications":
                            # Handle qualifications as list
                            quals = str(row[mapped_col]).split(",")
                            employee_data[target_col] = [q.strip() for q in quals if q.strip()]
                        elif source_col == "active":
                            # Handle boolean conversion
                            employee_data[target_col] = str(row[mapped_col]).lower() in ["true", "1", "yes", "y"]
                        elif source_col in ["hourly_rate", "max_hours_per_week"]:
                            # Handle numeric conversion
                            try:
                                employee_data[target_col] = float(row[mapped_col])
                            except (ValueError, TypeError):
                                employee_data[target_col] = None
                        else:
                            employee_data[target_col] = str(row[mapped_col])

                # Check for duplicates
                existing_employee = await crud_employee.get_by_email(db, employee_data["email"])

                if existing_employee:
                    if options.get("update_existing", False):
                        # Update existing employee
                        update_data = {k: v for k, v in employee_data.items() if k != "email"}
                        await crud_employee.update(db, existing_employee, update_data)
                        results["updated"] += 1
                    else:
                        results["skipped"] += 1
                        results["errors"].append(
                            {"row": index + 1, "error": f"Employee with email {employee_data['email']} already exists"}
                        )
                        continue
                else:
                    # Create new employee
                    employee_create = EmployeeCreate(**employee_data)
                    await crud_employee.create(db, employee_create)
                    results["created"] += 1

                results["processed"] += 1

            except ValidationError as e:
                results["errors"].append({"row": index + 1, "error": f"Validation error: {e}"})
            except Exception as e:
                results["errors"].append({"row": index + 1, "error": f"Processing error: {str(e)}"})

        return results

    async def _process_schedule_import(self, db: AsyncSession, df: pd.DataFrame, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process schedule import data.

        Creates Schedule containers for weeks and ScheduleAssignment records linking
        employees to shifts within those schedules.
        """
        from sqlalchemy.orm import selectinload

        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["employee_email", "shift_name", "date"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Cache employees, shifts, and schedules for lookup
        employees_cache = {}
        shifts_cache = {}
        schedules_cache = {}  # Cache schedules by week_start date

        # Get created_by from options (default to admin user ID 1 if not provided)
        created_by = options.get("created_by", 1)

        # Process each row
        for index, row in df.iterrows():
            try:
                # Get employee by email
                email = row[mapped_columns["employee_email"]]
                if email not in employees_cache:
                    employee = await crud_employee.get_by_email(db, email)
                    if not employee:
                        results["errors"].append({"row": index + 1, "error": f"Employee with email {email} not found"})
                        continue
                    employees_cache[email] = employee
                employee = employees_cache[email]

                # Get shift by name
                shift_name = row[mapped_columns["shift_name"]]
                if shift_name not in shifts_cache:
                    shift_query = select(Shift).where(Shift.name == shift_name)
                    shift_result = await db.execute(shift_query)
                    shift = shift_result.scalar_one_or_none()
                    if not shift:
                        results["errors"].append({"row": index + 1, "error": f"Shift with name {shift_name} not found"})
                        continue
                    shifts_cache[shift_name] = shift
                shift = shifts_cache[shift_name]

                # Parse date from the row
                shift_date = pd.to_datetime(row[mapped_columns["date"]]).date()

                # Get or create Schedule for the week containing this shift date
                from datetime import timedelta

                week_start = shift_date - timedelta(days=shift_date.weekday())
                week_key = week_start.isoformat()

                if week_key not in schedules_cache:
                    schedule = await self._get_or_create_schedule_for_week(db, shift_date, created_by)
                    schedules_cache[week_key] = schedule
                schedule = schedules_cache[week_key]

                # Check for existing assignment
                existing_query = (
                    select(ScheduleAssignment)
                    .where(
                        and_(
                            ScheduleAssignment.schedule_id == schedule.id,
                            ScheduleAssignment.employee_id == employee.id,
                            ScheduleAssignment.shift_id == shift.id,
                        )
                    )
                    .options(
                        selectinload(ScheduleAssignment.schedule),
                        selectinload(ScheduleAssignment.employee),
                        selectinload(ScheduleAssignment.shift),
                    )
                )
                existing_result = await db.execute(existing_query)
                existing_assignment = existing_result.scalar_one_or_none()

                # Prepare assignment data
                assignment_data = {
                    "schedule_id": schedule.id,
                    "employee_id": employee.id,
                    "shift_id": shift.id,
                    "status": "assigned",  # Default status
                    "priority": 1,  # Default priority
                    "auto_assigned": False,  # Manually imported
                }

                # Handle optional columns
                if "status" in df.columns and pd.notna(row.get("status")):
                    status = str(row["status"]).lower()
                    if status in ["assigned", "pending", "confirmed", "declined", "cancelled", "completed"]:
                        assignment_data["status"] = status

                if "notes" in df.columns and pd.notna(row.get("notes")):
                    assignment_data["notes"] = str(row["notes"])

                if "priority" in df.columns and pd.notna(row.get("priority")):
                    try:
                        priority = int(row["priority"])
                        if 1 <= priority <= 10:
                            assignment_data["priority"] = priority
                    except (ValueError, TypeError):
                        pass  # Keep default priority

                if existing_assignment:
                    if options.get("update_existing", False):
                        # Update existing assignment
                        for key, value in assignment_data.items():
                            if key not in ["schedule_id", "employee_id", "shift_id"]:
                                setattr(existing_assignment, key, value)
                        results["updated"] += 1
                    else:
                        results["skipped"] += 1
                        results["errors"].append(
                            {
                                "row": index + 1,
                                "error": f"Assignment already exists for {email} on {shift_date} for shift {shift_name}",
                            }
                        )
                        continue
                else:
                    # Check for shift conflicts before creating
                    # Query other assignments for this employee on the same date
                    conflict_query = (
                        select(ScheduleAssignment)
                        .join(Shift, ScheduleAssignment.shift_id == Shift.id)
                        .where(
                            and_(
                                ScheduleAssignment.employee_id == employee.id,
                                ScheduleAssignment.status.in_(["assigned", "confirmed"]),
                                Shift.date == shift_date,
                            )
                        )
                        .options(selectinload(ScheduleAssignment.shift))
                    )
                    conflict_result = await db.execute(conflict_query)
                    existing_assignments = conflict_result.scalars().all()

                    # Check for time conflicts
                    has_conflict = False
                    for existing in existing_assignments:
                        # Check if shifts overlap
                        if (
                            shift.start_time < existing.shift.end_time
                            and shift.end_time > existing.shift.start_time
                        ):
                            has_conflict = True
                            results["errors"].append(
                                {
                                    "row": index + 1,
                                    "error": f"Shift conflict: {email} already has shift from {existing.shift.start_time} to {existing.shift.end_time} on {shift_date}",
                                }
                            )
                            break

                    if has_conflict:
                        results["skipped"] += 1
                        continue

                    # Create new assignment
                    new_assignment = ScheduleAssignment(**assignment_data)
                    db.add(new_assignment)
                    results["created"] += 1

                results["processed"] += 1

            except Exception as e:
                logger.error(f"Error processing row {index + 1}: {e}")
                results["errors"].append({"row": index + 1, "error": f"Processing error: {str(e)}"})

        return results

    async def _process_rule_import(self, db: AsyncSession, df: pd.DataFrame, options: Dict[str, Any]) -> Dict[str, Any]:
        """Process rule import data."""
        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["rule_type", "original_text"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Process each row
        for index, row in df.iterrows():
            try:
                rule_data = {
                    "rule_type": row[mapped_columns["rule_type"]],
                    "original_text": row[mapped_columns["original_text"]],
                }

                # Handle optional columns
                if "constraints" in df.columns and pd.notna(row.get("constraints")):
                    try:
                        # Try to parse as JSON, fallback to string
                        import json

                        rule_data["constraints"] = json.loads(row["constraints"])
                    except:
                        rule_data["constraints"] = {"raw": str(row["constraints"])}

                if "priority" in df.columns and pd.notna(row.get("priority")):
                    try:
                        rule_data["priority"] = int(row["priority"])
                    except (ValueError, TypeError):
                        rule_data["priority"] = 1

                if "employee_email" in df.columns and pd.notna(row.get("employee_email")):
                    employee = await crud_employee.get_by_email(db, row["employee_email"])
                    if employee:
                        rule_data["employee_id"] = employee.id

                if "active" in df.columns:
                    rule_data["active"] = str(row.get("active", "true")).lower() in ["true", "1", "yes"]

                # Create rule
                rule_create = RuleCreate(**rule_data)
                await crud_rule.create(db, rule_create)
                results["created"] += 1
                results["processed"] += 1

            except ValidationError as e:
                results["errors"].append({"row": index + 1, "error": f"Validation error: {e}"})
            except Exception as e:
                results["errors"].append({"row": index + 1, "error": f"Processing error: {str(e)}"})

        return results

    def _get_expected_columns(self, import_type: str) -> List[str]:
        """Get expected columns for import type."""
        if import_type == "employees":
            return ["name", "email", "role", "phone", "hourly_rate", "max_hours_per_week", "qualifications", "active"]
        elif import_type == "schedules":
            return ["employee_email", "shift_name", "date", "status", "notes", "overtime_approved"]
        elif import_type == "rules":
            return ["rule_type", "original_text", "constraints", "priority", "employee_email", "active"]
        else:
            return []

    async def detect_duplicates(self, db: AsyncSession, df: pd.DataFrame, import_type: str) -> Dict[str, Any]:
        """Detect duplicate records in import data."""
        duplicates = {"internal_duplicates": [], "database_duplicates": [], "total_duplicates": 0}

        if import_type == "employees":
            # Check internal duplicates
            email_counts = df["email"].value_counts()
            internal_dups = email_counts[email_counts > 1].index.tolist()

            for email in internal_dups:
                dup_rows = df[df["email"] == email].index.tolist()
                duplicates["internal_duplicates"].append(
                    {"field": "email", "value": email, "rows": [r + 1 for r in dup_rows]}  # 1-based indexing
                )

            # Check database duplicates
            for _, row in df.iterrows():
                existing = await crud_employee.get_by_email(db, row["email"])
                if existing:
                    duplicates["database_duplicates"].append(
                        {"field": "email", "value": row["email"], "existing_id": existing.id}
                    )

        elif import_type == "schedules":
            # Check for schedule assignment conflicts
            for index, row in df.iterrows():
                employee = await crud_employee.get_by_email(db, row["employee_email"])
                if employee:
                    # Get shift by name
                    shift_query = select(Shift).where(Shift.name == row["shift_name"])
                    shift_result = await db.execute(shift_query)
                    shift = shift_result.scalar_one_or_none()

                    if shift:
                        # Check existing assignments for this employee/shift combination
                        shift_date = pd.to_datetime(row["date"]).date()

                        # Calculate week for this shift
                        from datetime import timedelta

                        week_start = shift_date - timedelta(days=shift_date.weekday())
                        week_end = week_start + timedelta(days=6)

                        # Find schedule for this week
                        schedule_query = select(Schedule).where(
                            Schedule.week_start == week_start, Schedule.week_end == week_end
                        )
                        schedule_result = await db.execute(schedule_query)
                        schedule = schedule_result.scalar_one_or_none()

                        if schedule:
                            # Check for existing assignment
                            existing_query = select(ScheduleAssignment).where(
                                and_(
                                    ScheduleAssignment.schedule_id == schedule.id,
                                    ScheduleAssignment.employee_id == employee.id,
                                    ScheduleAssignment.shift_id == shift.id,
                                )
                            )
                            result = await db.execute(existing_query)
                            existing_assignment = result.scalar_one_or_none()

                            if existing_assignment:
                                duplicates["database_duplicates"].append(
                                    {
                                        "field": "employee_shift_date",
                                        "value": f"{row['employee_email']} - {row['shift_name']} on {shift_date}",
                                        "existing_assignment_id": existing_assignment.id,
                                    }
                                )

        duplicates["total_duplicates"] = len(duplicates["internal_duplicates"]) + len(duplicates["database_duplicates"])
        return duplicates

    async def validate_import_data(self, db: AsyncSession, df: pd.DataFrame, import_type: str) -> Dict[str, Any]:
        """Validate import data for integrity and business rules."""
        validation_result = {"valid_rows": 0, "invalid_rows": 0, "errors": [], "warnings": []}

        for index, row in df.iterrows():
            row_valid = True
            row_errors = []

            try:
                if import_type == "employees":
                    # Validate email format
                    if not pd.notna(row.get("email")) or "@" not in str(row["email"]):
                        row_errors.append("Invalid email format")
                        row_valid = False

                    # Validate role
                    valid_roles = ["manager", "supervisor", "server", "cook", "cashier", "cleaner", "security"]
                    if row.get("role") not in valid_roles:
                        row_errors.append(f"Invalid role: {row.get('role')}")
                        row_valid = False

                    # Validate hourly rate
                    if pd.notna(row.get("hourly_rate")):
                        try:
                            rate = float(row["hourly_rate"])
                            if rate < 0:
                                row_errors.append("Hourly rate cannot be negative")
                                row_valid = False
                        except (ValueError, TypeError):
                            row_errors.append("Invalid hourly rate format")
                            row_valid = False

                elif import_type == "schedules":
                    # Validate date format
                    try:
                        pd.to_datetime(row["date"])
                    except:
                        row_errors.append("Invalid date format")
                        row_valid = False

                    # Validate employee exists
                    if pd.notna(row.get("employee_email")):
                        employee = await crud_employee.get_by_email(db, row["employee_email"])
                        if not employee:
                            row_errors.append(f"Employee not found: {row['employee_email']}")
                            row_valid = False

                elif import_type == "rules":
                    # Validate rule type
                    valid_types = ["availability", "preference", "requirement", "restriction"]
                    if row.get("rule_type") not in valid_types:
                        row_errors.append(f"Invalid rule type: {row.get('rule_type')}")
                        row_valid = False

                    # Validate priority
                    if pd.notna(row.get("priority")):
                        try:
                            priority = int(row["priority"])
                            if not 1 <= priority <= 5:
                                row_errors.append("Priority must be between 1 and 5")
                                row_valid = False
                        except (ValueError, TypeError):
                            row_errors.append("Invalid priority format")
                            row_valid = False

                if row_valid:
                    validation_result["valid_rows"] += 1
                else:
                    validation_result["invalid_rows"] += 1
                    validation_result["errors"].append({"row": index + 1, "errors": row_errors})

            except Exception as e:
                validation_result["invalid_rows"] += 1
                validation_result["errors"].append({"row": index + 1, "errors": [f"Validation error: {str(e)}"]})

        return validation_result
