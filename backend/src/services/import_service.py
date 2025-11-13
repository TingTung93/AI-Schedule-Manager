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
        """
        Process employee import data using bulk operations.

        Optimizations:
        - Bulk validation before any inserts
        - Batch loading of existing employees
        - db.add_all() for bulk inserts
        - Single transaction with rollback capability
        - Progress callback support
        """
        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["name", "email", "role"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Get configuration options
        update_existing = options.get("update_existing", False)
        allow_partial = options.get("allow_partial", True)
        progress_callback = options.get("progress_callback", None)

        # Collections for bulk operations
        employees_to_create = []
        employees_to_update = []
        validation_errors = []

        # Batch load existing employees
        try:
            unique_emails = df[mapped_columns["email"]].dropna().unique().tolist()
            existing_query = select(Employee).where(Employee.email.in_(unique_emails))
            existing_result = await db.execute(existing_query)
            existing_employees = existing_result.scalars().all()
            existing_lookup = {emp.email: emp for emp in existing_employees}
        except Exception as e:
            logger.error(f"Error bulk loading employees: {e}")
            raise ImportValidationError(f"Failed to load existing employees: {str(e)}")

        # PHASE 1: Validate all rows and prepare employee data
        logger.info(f"Phase 1: Validating {len(df)} employee rows...")

        for index, row in df.iterrows():
            try:
                # Progress callback
                if progress_callback and index % 100 == 0:
                    progress_callback({"phase": "validation", "current": index, "total": len(df)})

                # Map required columns
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

                # Store row index for error reporting
                employee_data["_row_index"] = index + 1

                # Validate with Pydantic schema
                try:
                    EmployeeCreate(**{k: v for k, v in employee_data.items() if k != "_row_index"})
                except ValidationError as e:
                    validation_errors.append({"row": index + 1, "error": f"Validation error: {str(e)}"})
                    continue

                # Check if employee exists
                email = employee_data["email"]
                if email in existing_lookup:
                    if update_existing:
                        employee_data["_existing"] = existing_lookup[email]
                        employees_to_update.append(employee_data)
                    else:
                        results["skipped"] += 1
                        validation_errors.append({"row": index + 1, "error": f"Employee with email {email} already exists"})
                else:
                    employees_to_create.append(employee_data)

            except Exception as e:
                logger.error(f"Error validating row {index + 1}: {e}")
                validation_errors.append({"row": index + 1, "error": f"Processing error: {str(e)}"})

        # Check if we should proceed with partial results or fail completely
        if validation_errors:
            results["errors"].extend(validation_errors)
            if not allow_partial:
                raise ImportValidationError(f"Validation failed for {len(validation_errors)} rows. Set allow_partial=True to import valid rows.")

        # PHASE 2: Bulk insert new employees
        logger.info(f"Phase 2: Bulk inserting {len(employees_to_create)} employees...")

        try:
            if employees_to_create:
                new_employees = []
                for emp_data in employees_to_create:
                    row_index = emp_data.pop("_row_index")
                    try:
                        employee = Employee(**emp_data)
                        new_employees.append(employee)
                    except Exception as e:
                        logger.error(f"Error creating employee object for row {row_index}: {e}")
                        results["errors"].append({"row": row_index, "error": f"Creation error: {str(e)}"})

                if new_employees:
                    db.add_all(new_employees)
                    await db.flush()  # Flush to get IDs but don't commit yet
                    results["created"] = len(new_employees)

            # PHASE 3: Bulk update existing employees
            if employees_to_update:
                logger.info(f"Phase 3: Updating {len(employees_to_update)} employees...")

                for emp_data in employees_to_update:
                    row_index = emp_data.pop("_row_index")
                    existing = emp_data.pop("_existing")

                    try:
                        # Update fields
                        for key, value in emp_data.items():
                            if key != "email":  # Don't update email
                                setattr(existing, key, value)
                        results["updated"] += 1
                    except Exception as e:
                        logger.error(f"Error updating employee for row {row_index}: {e}")
                        results["errors"].append({"row": row_index, "error": f"Update error: {str(e)}"})

            results["processed"] = results["created"] + results["updated"] + results["skipped"]

            # Progress callback
            if progress_callback:
                progress_callback({"phase": "complete", "created": results["created"], "updated": results["updated"]})

            logger.info(f"Employee import complete: {results['created']} created, {results['updated']} updated, {results['skipped']} skipped, {len(results['errors'])} errors")

        except Exception as e:
            logger.error(f"Error during bulk operations: {e}")
            await db.rollback()
            raise ImportValidationError(f"Bulk operations failed: {str(e)}")

        return results

    async def _process_schedule_import(self, db: AsyncSession, df: pd.DataFrame, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process schedule import data using bulk operations.

        Creates Schedule containers for weeks and ScheduleAssignment records linking
        employees to shifts within those schedules.

        Optimizations:
        - Bulk validation before any inserts
        - Batch loading of employees and shifts
        - db.add_all() for bulk inserts
        - Single transaction with rollback capability
        - Progress callback support
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

        # Get configuration options
        created_by = options.get("created_by", 1)
        update_existing = options.get("update_existing", False)
        allow_partial = options.get("allow_partial", True)
        progress_callback = options.get("progress_callback", None)

        # Collections for bulk operations
        assignments_to_create = []
        assignments_to_update = []
        validation_errors = []

        # Batch load all employees and shifts upfront
        try:
            # Get all unique emails and shift names from the import file
            unique_emails = df[mapped_columns["employee_email"]].dropna().unique().tolist()
            unique_shift_names = df[mapped_columns["shift_name"]].dropna().unique().tolist()

            # Bulk load employees
            employees_query = select(Employee).where(Employee.email.in_(unique_emails))
            employees_result = await db.execute(employees_query)
            employees = employees_result.scalars().all()
            employees_cache = {emp.email: emp for emp in employees}

            # Bulk load shifts
            shifts_query = select(Shift).where(Shift.name.in_(unique_shift_names))
            shifts_result = await db.execute(shifts_query)
            shifts = shifts_result.scalars().all()
            shifts_cache = {shift.name: shift for shift in shifts}

            # Cache for schedules (will be populated as needed)
            schedules_cache = {}

        except Exception as e:
            logger.error(f"Error bulk loading data: {e}")
            raise ImportValidationError(f"Failed to load reference data: {str(e)}")

        # PHASE 1: Validate all rows and prepare assignment data
        logger.info(f"Phase 1: Validating {len(df)} rows...")

        for index, row in df.iterrows():
            try:
                # Progress callback
                if progress_callback and index % 100 == 0:
                    progress_callback({"phase": "validation", "current": index, "total": len(df)})

                # Get employee from cache
                email = row[mapped_columns["employee_email"]]
                if email not in employees_cache:
                    validation_errors.append({"row": index + 1, "error": f"Employee with email {email} not found"})
                    continue
                employee = employees_cache[email]

                # Get shift from cache
                shift_name = row[mapped_columns["shift_name"]]
                if shift_name not in shifts_cache:
                    validation_errors.append({"row": index + 1, "error": f"Shift with name {shift_name} not found"})
                    continue
                shift = shifts_cache[shift_name]

                # Parse date
                shift_date = pd.to_datetime(row[mapped_columns["date"]]).date()

                # Get or create Schedule for the week
                from datetime import timedelta

                week_start = shift_date - timedelta(days=shift_date.weekday())
                week_key = week_start.isoformat()

                if week_key not in schedules_cache:
                    schedule = await self._get_or_create_schedule_for_week(db, shift_date, created_by)
                    schedules_cache[week_key] = schedule
                schedule = schedules_cache[week_key]

                # Prepare assignment data
                assignment_data = {
                    "schedule_id": schedule.id,
                    "employee_id": employee.id,
                    "shift_id": shift.id,
                    "status": "assigned",
                    "priority": 1,
                    "auto_assigned": False,
                    "row_index": index + 1,  # For tracking
                    "shift_date": shift_date,  # For validation
                    "email": email,  # For error messages
                    "shift_name": shift_name,  # For error messages
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
                        pass

                assignments_to_create.append(assignment_data)

            except Exception as e:
                logger.error(f"Error validating row {index + 1}: {e}")
                validation_errors.append({"row": index + 1, "error": f"Validation error: {str(e)}"})

        # Check if we should proceed with partial results or fail completely
        if validation_errors:
            results["errors"].extend(validation_errors)
            if not allow_partial:
                raise ImportValidationError(f"Validation failed for {len(validation_errors)} rows. Set allow_partial=True to import valid rows.")

        # PHASE 2: Check for existing assignments and conflicts (bulk queries)
        logger.info(f"Phase 2: Checking for duplicates and conflicts in {len(assignments_to_create)} validated rows...")

        if assignments_to_create:
            # Build bulk query for existing assignments
            schedule_ids = list(set(a["schedule_id"] for a in assignments_to_create))
            employee_ids = list(set(a["employee_id"] for a in assignments_to_create))
            shift_ids = list(set(a["shift_id"] for a in assignments_to_create))

            # Query all potentially conflicting assignments at once
            existing_query = (
                select(ScheduleAssignment)
                .where(
                    and_(
                        ScheduleAssignment.schedule_id.in_(schedule_ids),
                        ScheduleAssignment.employee_id.in_(employee_ids),
                        ScheduleAssignment.shift_id.in_(shift_ids),
                    )
                )
                .options(
                    selectinload(ScheduleAssignment.schedule),
                    selectinload(ScheduleAssignment.employee),
                    selectinload(ScheduleAssignment.shift),
                )
            )
            existing_result = await db.execute(existing_query)
            existing_assignments = existing_result.scalars().all()

            # Build lookup dictionary for existing assignments
            existing_lookup = {}
            for ea in existing_assignments:
                key = (ea.schedule_id, ea.employee_id, ea.shift_id)
                existing_lookup[key] = ea

            # Query for shift conflicts (same employee, same date, different shift)
            unique_dates = list(set(a["shift_date"] for a in assignments_to_create))
            conflict_query = (
                select(ScheduleAssignment)
                .join(Shift, ScheduleAssignment.shift_id == Shift.id)
                .where(
                    and_(
                        ScheduleAssignment.employee_id.in_(employee_ids),
                        ScheduleAssignment.status.in_(["assigned", "confirmed"]),
                        Shift.date.in_(unique_dates),
                    )
                )
                .options(selectinload(ScheduleAssignment.shift))
            )
            conflict_result = await db.execute(conflict_query)
            potential_conflicts = conflict_result.scalars().all()

            # Build conflict lookup: employee_id -> date -> list of shifts
            conflicts_lookup = {}
            for pc in potential_conflicts:
                key = (pc.employee_id, pc.shift.date)
                if key not in conflicts_lookup:
                    conflicts_lookup[key] = []
                conflicts_lookup[key].append(pc)

            # Process each validated assignment
            final_assignments_to_create = []

            for assignment_data in assignments_to_create:
                row_index = assignment_data.pop("row_index")
                shift_date = assignment_data.pop("shift_date")
                email = assignment_data.pop("email")
                shift_name = assignment_data.pop("shift_name")

                key = (assignment_data["schedule_id"], assignment_data["employee_id"], assignment_data["shift_id"])

                # Check for existing assignment
                if key in existing_lookup:
                    if update_existing:
                        # Update existing assignment
                        existing = existing_lookup[key]
                        for field, value in assignment_data.items():
                            if field not in ["schedule_id", "employee_id", "shift_id"]:
                                setattr(existing, field, value)
                        assignments_to_update.append(existing)
                        results["updated"] += 1
                    else:
                        results["skipped"] += 1
                        results["errors"].append(
                            {"row": row_index, "error": f"Assignment already exists for {email} on {shift_date} for shift {shift_name}"}
                        )
                    continue

                # Check for time conflicts
                conflict_key = (assignment_data["employee_id"], shift_date)
                if conflict_key in conflicts_lookup:
                    shift = shifts_cache[shift_name]
                    has_conflict = False

                    for existing in conflicts_lookup[conflict_key]:
                        # Check if shifts overlap
                        if shift.start_time < existing.shift.end_time and shift.end_time > existing.shift.start_time:
                            has_conflict = True
                            results["errors"].append(
                                {
                                    "row": row_index,
                                    "error": f"Shift conflict: {email} already has shift from {existing.shift.start_time} to {existing.shift.end_time} on {shift_date}",
                                }
                            )
                            break

                    if has_conflict:
                        results["skipped"] += 1
                        continue

                # No conflicts, add to creation list
                final_assignments_to_create.append(assignment_data)

        # PHASE 3: Bulk insert
        logger.info(f"Phase 3: Bulk inserting {len(final_assignments_to_create)} assignments...")

        try:
            if final_assignments_to_create:
                # Create ScheduleAssignment objects
                new_assignments = [ScheduleAssignment(**data) for data in final_assignments_to_create]

                # Bulk insert
                db.add_all(new_assignments)
                await db.flush()  # Flush to get IDs but don't commit yet

                results["created"] = len(new_assignments)

                # Progress callback
                if progress_callback:
                    progress_callback({"phase": "complete", "created": results["created"], "updated": results["updated"]})

            results["processed"] = results["created"] + results["updated"] + results["skipped"]

            logger.info(f"Import complete: {results['created']} created, {results['updated']} updated, {results['skipped']} skipped, {len(results['errors'])} errors")

        except Exception as e:
            logger.error(f"Error during bulk insert: {e}")
            await db.rollback()
            raise ImportValidationError(f"Bulk insert failed: {str(e)}")

        return results

    async def _process_rule_import(self, db: AsyncSession, df: pd.DataFrame, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process rule import data using bulk operations.

        Optimizations:
        - Bulk validation before any inserts
        - Batch loading of employees
        - db.add_all() for bulk inserts
        - Single transaction with rollback capability
        - Progress callback support
        """
        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["rule_type", "original_text"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Get configuration options
        allow_partial = options.get("allow_partial", True)
        progress_callback = options.get("progress_callback", None)

        # Collections for bulk operations
        rules_to_create = []
        validation_errors = []

        # Batch load employees if needed
        employees_cache = {}
        if "employee_email" in df.columns:
            try:
                unique_emails = df["employee_email"].dropna().unique().tolist()
                if unique_emails:
                    employees_query = select(Employee).where(Employee.email.in_(unique_emails))
                    employees_result = await db.execute(employees_query)
                    employees = employees_result.scalars().all()
                    employees_cache = {emp.email: emp for emp in employees}
            except Exception as e:
                logger.error(f"Error bulk loading employees: {e}")
                raise ImportValidationError(f"Failed to load employees: {str(e)}")

        # PHASE 1: Validate all rows and prepare rule data
        logger.info(f"Phase 1: Validating {len(df)} rule rows...")

        for index, row in df.iterrows():
            try:
                # Progress callback
                if progress_callback and index % 100 == 0:
                    progress_callback({"phase": "validation", "current": index, "total": len(df)})

                rule_data = {
                    "rule_type": row[mapped_columns["rule_type"]],
                    "original_text": row[mapped_columns["original_text"]],
                }

                # Handle optional columns
                if "constraints" in df.columns and pd.notna(row.get("constraints")):
                    try:
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
                    email = row["employee_email"]
                    if email in employees_cache:
                        rule_data["employee_id"] = employees_cache[email].id
                    else:
                        validation_errors.append({"row": index + 1, "error": f"Employee with email {email} not found"})
                        continue

                if "active" in df.columns:
                    rule_data["active"] = str(row.get("active", "true")).lower() in ["true", "1", "yes"]

                # Store row index for error reporting
                rule_data["_row_index"] = index + 1

                # Validate with Pydantic schema
                try:
                    RuleCreate(**{k: v for k, v in rule_data.items() if k != "_row_index"})
                except ValidationError as e:
                    validation_errors.append({"row": index + 1, "error": f"Validation error: {str(e)}"})
                    continue

                rules_to_create.append(rule_data)

            except Exception as e:
                logger.error(f"Error validating row {index + 1}: {e}")
                validation_errors.append({"row": index + 1, "error": f"Processing error: {str(e)}"})

        # Check if we should proceed with partial results or fail completely
        if validation_errors:
            results["errors"].extend(validation_errors)
            if not allow_partial:
                raise ImportValidationError(f"Validation failed for {len(validation_errors)} rows. Set allow_partial=True to import valid rows.")

        # PHASE 2: Bulk insert rules
        logger.info(f"Phase 2: Bulk inserting {len(rules_to_create)} rules...")

        try:
            if rules_to_create:
                new_rules = []
                for rule_data in rules_to_create:
                    row_index = rule_data.pop("_row_index")
                    try:
                        rule = Rule(**rule_data)
                        new_rules.append(rule)
                    except Exception as e:
                        logger.error(f"Error creating rule object for row {row_index}: {e}")
                        results["errors"].append({"row": row_index, "error": f"Creation error: {str(e)}"})

                if new_rules:
                    db.add_all(new_rules)
                    await db.flush()  # Flush to get IDs but don't commit yet
                    results["created"] = len(new_rules)

            results["processed"] = results["created"]

            # Progress callback
            if progress_callback:
                progress_callback({"phase": "complete", "created": results["created"]})

            logger.info(f"Rule import complete: {results['created']} created, {len(results['errors'])} errors")

        except Exception as e:
            logger.error(f"Error during bulk operations: {e}")
            await db.rollback()
            raise ImportValidationError(f"Bulk operations failed: {str(e)}")

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
