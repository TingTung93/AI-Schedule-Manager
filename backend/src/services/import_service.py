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
from ..models import Employee, Rule, Schedule, Shift
from ..schemas import EmployeeCreate, RuleCreate, ScheduleCreate, ShiftCreate
from ..services.crud import crud_employee, crud_rule, crud_schedule

logger = logging.getLogger(__name__)


class ImportService:
    """Service for handling data imports."""

    def __init__(self):
        self.supported_formats = ["csv", "excel", "xlsx", "xls"]
        self.max_file_size = 50 * 1024 * 1024  # 50MB
        self.max_rows = 10000

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
        """Process schedule import data."""
        results = {"total_rows": len(df), "processed": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}

        # Column mapping
        column_mapping = options.get("column_mapping", {})
        required_columns = ["employee_email", "shift_name", "date"]

        # Validate required columns
        mapped_columns = {column_mapping.get(col, col): col for col in required_columns}
        missing_columns = [col for col in mapped_columns.keys() if col not in df.columns]

        if missing_columns:
            raise ImportValidationError(f"Missing required columns: {missing_columns}")

        # Cache employees and shifts for lookup
        employees_cache = {}
        shifts_cache = {}

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

                # Parse date
                schedule_date = pd.to_datetime(row[mapped_columns["date"]]).date()

                # Check for existing schedule
                existing_query = select(Schedule).where(
                    and_(Schedule.employee_id == employee.id, Schedule.shift_id == shift.id, Schedule.date == schedule_date)
                )
                existing_result = await db.execute(existing_query)
                existing_schedule = existing_result.scalar_one_or_none()

                schedule_data = {"employee_id": employee.id, "shift_id": shift.id, "date": schedule_date}

                # Handle optional columns
                if "status" in df.columns:
                    schedule_data["status"] = row.get("status", "scheduled")
                if "notes" in df.columns and pd.notna(row.get("notes")):
                    schedule_data["notes"] = str(row["notes"])
                if "overtime_approved" in df.columns:
                    schedule_data["overtime_approved"] = str(row.get("overtime_approved", "")).lower() in ["true", "1", "yes"]

                if existing_schedule:
                    if options.get("update_existing", False):
                        # Update existing schedule
                        update_data = {k: v for k, v in schedule_data.items() if k not in ["employee_id", "shift_id", "date"]}
                        await crud_schedule.update(db, existing_schedule, update_data)
                        results["updated"] += 1
                    else:
                        results["skipped"] += 1
                        results["errors"].append(
                            {"row": index + 1, "error": f"Schedule already exists for {email} on {schedule_date}"}
                        )
                        continue
                else:
                    # Create new schedule
                    schedule_create = ScheduleCreate(**schedule_data)
                    await crud_schedule.create(db, schedule_create)
                    results["created"] += 1

                results["processed"] += 1

            except Exception as e:
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
            # Check for schedule conflicts
            for index, row in df.iterrows():
                employee = await crud_employee.get_by_email(db, row["employee_email"])
                if employee:
                    # Check existing schedules
                    schedule_date = pd.to_datetime(row["date"]).date()
                    existing_query = select(Schedule).where(
                        and_(Schedule.employee_id == employee.id, Schedule.date == schedule_date)
                    )
                    result = await db.execute(existing_query)
                    existing_schedules = result.scalars().all()

                    if existing_schedules:
                        duplicates["database_duplicates"].append(
                            {
                                "field": "employee_date",
                                "value": f"{row['employee_email']} on {schedule_date}",
                                "existing_schedules": [s.id for s in existing_schedules],
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
