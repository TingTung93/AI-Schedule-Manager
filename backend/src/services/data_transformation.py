"""
Data transformation utilities for import/export operations.
Handles field mapping, data cleaning, and format conversions.
"""

import logging
import re
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Dict, List, Optional, Union

import pandas as pd

logger = logging.getLogger(__name__)


class DataTransformer:
    """Service for data transformation and mapping."""

    def __init__(self):
        # Common field mappings
        self.common_field_mappings = {
            "employees": {
                "full_name": "name",
                "firstname": "name",
                "lastname": "name",
                "email_address": "email",
                "e_mail": "email",
                "position": "role",
                "job_title": "role",
                "phone_number": "phone",
                "telephone": "phone",
                "mobile": "phone",
                "pay_rate": "hourly_rate",
                "wage": "hourly_rate",
                "salary": "hourly_rate",
                "max_weekly_hours": "max_hours_per_week",
                "weekly_limit": "max_hours_per_week",
                "skills": "qualifications",
                "certifications": "qualifications",
                "status": "active",
                "enabled": "active",
                "is_active": "active",
            },
            "schedules": {
                "employee_name": "employee_email",
                "worker": "employee_email",
                "staff_member": "employee_email",
                "shift_name": "shift_id",
                "shift_type": "shift_id",
                "work_date": "date",
                "scheduled_date": "date",
                "shift_date": "date",
                "start_time": "shift_start",
                "end_time": "shift_end",
                "overtime": "overtime_approved",
                "ot_approved": "overtime_approved",
                "comments": "notes",
                "remarks": "notes",
            },
            "rules": {
                "type": "rule_type",
                "category": "rule_type",
                "description": "original_text",
                "rule_text": "original_text",
                "text": "original_text",
                "weight": "priority",
                "importance": "priority",
                "employee_name": "employee_email",
                "worker": "employee_email",
                "enabled": "active",
                "is_active": "active",
            },
        }

        # Data cleaning patterns
        self.phone_pattern = re.compile(r"[^\d+\-\(\)\s]")
        self.email_pattern = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

        # Value transformations
        self.boolean_true_values = {"true", "1", "yes", "y", "active", "enabled", "on"}
        self.boolean_false_values = {"false", "0", "no", "n", "inactive", "disabled", "off"}

    def auto_map_columns(self, df_columns: List[str], target_type: str) -> Dict[str, str]:
        """Automatically map DataFrame columns to target schema fields."""
        try:
            if target_type not in self.common_field_mappings:
                return {}

            mapping = {}
            source_mappings = self.common_field_mappings[target_type]

            # Normalize column names for comparison
            normalized_columns = {self._normalize_field_name(col): col for col in df_columns}

            # Try to find matches
            for source_pattern, target_field in source_mappings.items():
                normalized_pattern = self._normalize_field_name(source_pattern)

                # Exact match
                if normalized_pattern in normalized_columns:
                    mapping[normalized_columns[normalized_pattern]] = target_field
                    continue

                # Partial match
                for norm_col, orig_col in normalized_columns.items():
                    if normalized_pattern in norm_col or norm_col in normalized_pattern:
                        mapping[orig_col] = target_field
                        break

            return mapping

        except Exception as e:
            logger.error(f"Error in auto column mapping: {e}")
            return {}

    def _normalize_field_name(self, field_name: str) -> str:
        """Normalize field name for comparison."""
        return re.sub(r"[^a-z0-9]", "", field_name.lower().strip())

    def transform_employee_data(self, df: pd.DataFrame, column_mapping: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        """Transform employee data with cleaning and validation."""
        try:
            transformed_df = df.copy()

            # Apply column mapping if provided
            if column_mapping:
                transformed_df = transformed_df.rename(columns=column_mapping)

            # Clean and transform specific fields
            if "name" in transformed_df.columns:
                transformed_df["name"] = transformed_df["name"].apply(self._clean_name)

            if "email" in transformed_df.columns:
                transformed_df["email"] = transformed_df["email"].apply(self._clean_email)

            if "phone" in transformed_df.columns:
                transformed_df["phone"] = transformed_df["phone"].apply(self._clean_phone)

            if "role" in transformed_df.columns:
                transformed_df["role"] = transformed_df["role"].apply(self._normalize_role)

            if "hourly_rate" in transformed_df.columns:
                transformed_df["hourly_rate"] = transformed_df["hourly_rate"].apply(self._clean_numeric_value)

            if "max_hours_per_week" in transformed_df.columns:
                transformed_df["max_hours_per_week"] = transformed_df["max_hours_per_week"].apply(
                    lambda x: self._clean_numeric_value(x, int_type=True)
                )

            if "qualifications" in transformed_df.columns:
                transformed_df["qualifications"] = transformed_df["qualifications"].apply(self._parse_list_field)

            if "active" in transformed_df.columns:
                transformed_df["active"] = transformed_df["active"].apply(self._parse_boolean)

            return transformed_df

        except Exception as e:
            logger.error(f"Error transforming employee data: {e}")
            raise

    def transform_schedule_data(self, df: pd.DataFrame, column_mapping: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        """Transform schedule data with cleaning and validation."""
        try:
            transformed_df = df.copy()

            # Apply column mapping if provided
            if column_mapping:
                transformed_df = transformed_df.rename(columns=column_mapping)

            # Clean and transform specific fields
            if "employee_email" in transformed_df.columns:
                transformed_df["employee_email"] = transformed_df["employee_email"].apply(self._clean_email)

            if "date" in transformed_df.columns:
                transformed_df["date"] = transformed_df["date"].apply(self._parse_date)

            if "status" in transformed_df.columns:
                transformed_df["status"] = transformed_df["status"].apply(self._normalize_schedule_status)

            if "overtime_approved" in transformed_df.columns:
                transformed_df["overtime_approved"] = transformed_df["overtime_approved"].apply(self._parse_boolean)

            return transformed_df

        except Exception as e:
            logger.error(f"Error transforming schedule data: {e}")
            raise

    def transform_rule_data(self, df: pd.DataFrame, column_mapping: Optional[Dict[str, str]] = None) -> pd.DataFrame:
        """Transform rule data with cleaning and validation."""
        try:
            transformed_df = df.copy()

            # Apply column mapping if provided
            if column_mapping:
                transformed_df = transformed_df.rename(columns=column_mapping)

            # Clean and transform specific fields
            if "rule_type" in transformed_df.columns:
                transformed_df["rule_type"] = transformed_df["rule_type"].apply(self._normalize_rule_type)

            if "original_text" in transformed_df.columns:
                transformed_df["original_text"] = transformed_df["original_text"].apply(self._clean_text)

            if "priority" in transformed_df.columns:
                transformed_df["priority"] = transformed_df["priority"].apply(
                    lambda x: self._clean_numeric_value(x, int_type=True, min_val=1, max_val=5)
                )

            if "employee_email" in transformed_df.columns:
                transformed_df["employee_email"] = transformed_df["employee_email"].apply(self._clean_email)

            if "active" in transformed_df.columns:
                transformed_df["active"] = transformed_df["active"].apply(self._parse_boolean)

            if "constraints" in transformed_df.columns:
                transformed_df["constraints"] = transformed_df["constraints"].apply(self._parse_json_field)

            return transformed_df

        except Exception as e:
            logger.error(f"Error transforming rule data: {e}")
            raise

    def _clean_name(self, value: Any) -> Optional[str]:
        """Clean and validate name field."""
        if pd.isna(value):
            return None

        name = str(value).strip()
        if not name:
            return None

        # Remove extra whitespace
        name = re.sub(r"\s+", " ", name)

        # Basic validation
        if len(name) < 2 or len(name) > 100:
            return None

        return name

    def _clean_email(self, value: Any) -> Optional[str]:
        """Clean and validate email field."""
        if pd.isna(value):
            return None

        email = str(value).strip().lower()
        if not email:
            return None

        # Basic email validation
        if self.email_pattern.match(email):
            return email

        return None

    def _clean_phone(self, value: Any) -> Optional[str]:
        """Clean and validate phone field."""
        if pd.isna(value):
            return None

        phone = str(value).strip()
        if not phone:
            return None

        # Remove non-phone characters but keep formatting
        phone = self.phone_pattern.sub("", phone)

        # Basic validation - should have at least 10 digits
        digits = re.sub(r"[^\d]", "", phone)
        if len(digits) < 10:
            return None

        return phone

    def _normalize_role(self, value: Any) -> Optional[str]:
        """Normalize role field to standard values."""
        if pd.isna(value):
            return None

        role = str(value).strip().lower()
        if not role:
            return None

        # Map common role variations to standard roles
        role_mappings = {
            "mgr": "manager",
            "supervisor": "supervisor",
            "sup": "supervisor",
            "waiter": "server",
            "waitress": "server",
            "waitstaff": "server",
            "chef": "cook",
            "kitchen": "cook",
            "prep": "cook",
            "cashier": "cashier",
            "register": "cashier",
            "front": "cashier",
            "janitor": "cleaner",
            "cleaning": "cleaner",
            "maintenance": "cleaner",
            "security": "security",
            "guard": "security",
        }

        for pattern, standard_role in role_mappings.items():
            if pattern in role:
                return standard_role

        # If no mapping found, return cleaned version
        return role

    def _normalize_schedule_status(self, value: Any) -> str:
        """Normalize schedule status to standard values."""
        if pd.isna(value):
            return "scheduled"

        status = str(value).strip().lower()
        if not status:
            return "scheduled"

        # Map status variations
        status_mappings = {
            "complete": "completed",
            "done": "completed",
            "finished": "completed",
            "cancel": "cancelled",
            "canceled": "cancelled",
            "absent": "no_show",
            "noshow": "no_show",
            "no-show": "no_show",
            "pending": "scheduled",
            "assigned": "scheduled",
        }

        for pattern, standard_status in status_mappings.items():
            if pattern in status:
                return standard_status

        # Valid statuses
        valid_statuses = ["scheduled", "completed", "cancelled", "no_show"]
        if status in valid_statuses:
            return status

        return "scheduled"

    def _normalize_rule_type(self, value: Any) -> Optional[str]:
        """Normalize rule type to standard values."""
        if pd.isna(value):
            return None

        rule_type = str(value).strip().lower()
        if not rule_type:
            return None

        # Map rule type variations
        type_mappings = {
            "avail": "availability",
            "available": "availability",
            "pref": "preference",
            "prefer": "preference",
            "req": "requirement",
            "required": "requirement",
            "restrict": "restriction",
            "restricted": "restriction",
            "constraint": "restriction",
        }

        for pattern, standard_type in type_mappings.items():
            if pattern in rule_type:
                return standard_type

        # Valid types
        valid_types = ["availability", "preference", "requirement", "restriction"]
        if rule_type in valid_types:
            return rule_type

        return "preference"  # Default

    def _clean_numeric_value(
        self, value: Any, int_type: bool = False, min_val: Optional[float] = None, max_val: Optional[float] = None
    ) -> Optional[Union[int, float]]:
        """Clean and validate numeric values."""
        if pd.isna(value):
            return None

        try:
            # Handle string values with currency symbols
            if isinstance(value, str):
                # Remove currency symbols and whitespace
                cleaned = re.sub(r"[$£€¥,\s]", "", value.strip())
                if not cleaned:
                    return None
                value = cleaned

            # Convert to appropriate numeric type
            if int_type:
                num_value = int(float(value))
            else:
                num_value = float(value)

            # Apply bounds if specified
            if min_val is not None and num_value < min_val:
                return min_val if int_type else float(min_val)
            if max_val is not None and num_value > max_val:
                return max_val if int_type else float(max_val)

            return num_value

        except (ValueError, TypeError, InvalidOperation):
            return None

    def _parse_boolean(self, value: Any) -> bool:
        """Parse boolean values from various formats."""
        if pd.isna(value):
            return False

        if isinstance(value, bool):
            return value

        str_value = str(value).strip().lower()

        if str_value in self.boolean_true_values:
            return True
        elif str_value in self.boolean_false_values:
            return False

        # Try numeric conversion
        try:
            num_value = float(str_value)
            return num_value > 0
        except (ValueError, TypeError):
            return False

    def _parse_date(self, value: Any) -> Optional[str]:
        """Parse and validate date values."""
        if pd.isna(value):
            return None

        try:
            # Try pandas date parsing
            parsed_date = pd.to_datetime(value)
            return parsed_date.strftime("%Y-%m-%d")
        except:
            return None

    def _parse_time(self, value: Any) -> Optional[str]:
        """Parse and validate time values."""
        if pd.isna(value):
            return None

        try:
            # Handle various time formats
            time_str = str(value).strip()

            # Convert 24-hour to standard format if needed
            if ":" in time_str:
                parts = time_str.split(":")
                if len(parts) >= 2:
                    hour = int(parts[0])
                    minute = int(parts[1])
                    if 0 <= hour <= 23 and 0 <= minute <= 59:
                        return f"{hour:02d}:{minute:02d}"

            return None
        except (ValueError, TypeError):
            return None

    def _parse_list_field(self, value: Any) -> List[str]:
        """Parse list fields from various formats."""
        if pd.isna(value):
            return []

        str_value = str(value).strip()
        if not str_value:
            return []

        # Split by common delimiters
        delimiters = [",", ";", "|", "\n"]
        items = [str_value]

        for delimiter in delimiters:
            if delimiter in str_value:
                items = str_value.split(delimiter)
                break

        # Clean and filter items
        cleaned_items = []
        for item in items:
            cleaned = item.strip()
            if cleaned:
                cleaned_items.append(cleaned)

        return cleaned_items

    def _parse_json_field(self, value: Any) -> Dict[str, Any]:
        """Parse JSON fields from string format."""
        if pd.isna(value):
            return {}

        try:
            import json

            if isinstance(value, dict):
                return value
            return json.loads(str(value))
        except (json.JSONDecodeError, TypeError):
            # If not valid JSON, return as raw string
            return {"raw": str(value)}

    def _clean_text(self, value: Any) -> Optional[str]:
        """Clean text fields."""
        if pd.isna(value):
            return None

        text = str(value).strip()
        if not text:
            return None

        # Remove extra whitespace
        text = re.sub(r"\s+", " ", text)

        # Basic length validation
        if len(text) > 1000:  # Truncate very long text
            text = text[:1000] + "..."

        return text

    def detect_data_types(self, df: pd.DataFrame) -> Dict[str, str]:
        """Detect data types for DataFrame columns."""
        type_mapping = {}

        for column in df.columns:
            sample_values = df[column].dropna().head(10)

            if sample_values.empty:
                type_mapping[column] = "unknown"
                continue

            # Check for email
            if any("@" in str(val) for val in sample_values):
                type_mapping[column] = "email"
                continue

            # Check for phone numbers
            if any(re.search(r"[\d\-\(\)\s+]{10,}", str(val)) for val in sample_values):
                type_mapping[column] = "phone"
                continue

            # Check for dates
            try:
                pd.to_datetime(sample_values)
                type_mapping[column] = "date"
                continue
            except:
                pass

            # Check for boolean
            if all(str(val).lower() in self.boolean_true_values | self.boolean_false_values for val in sample_values):
                type_mapping[column] = "boolean"
                continue

            # Check for numeric
            try:
                pd.to_numeric(sample_values)
                type_mapping[column] = "numeric"
                continue
            except:
                pass

            # Default to text
            type_mapping[column] = "text"

        return type_mapping

    def validate_transformation(self, original_df: pd.DataFrame, transformed_df: pd.DataFrame) -> Dict[str, Any]:
        """Validate data transformation results."""
        validation_result = {
            "row_count_match": len(original_df) == len(transformed_df),
            "original_rows": len(original_df),
            "transformed_rows": len(transformed_df),
            "column_changes": {},
            "data_quality_issues": [],
        }

        # Check column changes
        original_columns = set(original_df.columns)
        transformed_columns = set(transformed_df.columns)

        validation_result["column_changes"] = {
            "added": list(transformed_columns - original_columns),
            "removed": list(original_columns - transformed_columns),
            "renamed": list(transformed_columns & original_columns),
        }

        # Check for data quality issues
        for column in transformed_df.columns:
            null_count = transformed_df[column].isnull().sum()
            if null_count > 0:
                validation_result["data_quality_issues"].append(
                    {"column": column, "issue": "null_values", "count": int(null_count)}
                )

        return validation_result


# Global data transformer instance
data_transformer = DataTransformer()
