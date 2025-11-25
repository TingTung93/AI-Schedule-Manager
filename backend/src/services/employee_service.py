"""
Employee service layer for business logic separation.

This module encapsulates all employee-related business logic,
providing a clean separation between API routes and data operations.
"""

import html
import logging
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import bcrypt
from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth.models import Role, User
from ..models.account_status_history import AccountStatusHistory
from ..models.department_history import DepartmentAssignmentHistory
from ..models.password_history import PasswordHistory
from ..models.role_history import RoleChangeHistory
from ..schemas import AccountStatusUpdate, EmployeeCreate, EmployeeUpdate

logger = logging.getLogger(__name__)


class EmployeeService:
    """Service layer for employee management operations."""

    @staticmethod
    def generate_secure_password(length: int = 12) -> str:
        """
        Generate a cryptographically secure random password.

        Creates a password that meets complexity requirements:
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character

        Args:
            length: Password length (minimum 12)

        Returns:
            Secure random password string
        """
        if length < 12:
            length = 12

        uppercase = string.ascii_uppercase
        lowercase = string.ascii_lowercase
        digits = string.digits
        special = "!@#$%^&*()_+-=[]{}|;:,.<>?"

        password_chars = [
            secrets.choice(uppercase),
            secrets.choice(lowercase),
            secrets.choice(digits),
            secrets.choice(special),
        ]

        all_chars = uppercase + lowercase + digits + special
        password_chars.extend(secrets.choice(all_chars) for _ in range(length - 4))

        shuffled = password_chars.copy()
        for i in range(len(shuffled) - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            shuffled[i], shuffled[j] = shuffled[j], shuffled[i]

        return "".join(shuffled)

    @staticmethod
    def sanitize_text(text: Optional[str]) -> Optional[str]:
        """
        Sanitize text input to prevent XSS attacks.

        Escapes HTML special characters and trims whitespace.

        Args:
            text: Input text to sanitize

        Returns:
            Sanitized text or None if input was None
        """
        if text:
            return html.escape(text.strip())
        return text

    @staticmethod
    def validate_extended_fields(data: EmployeeCreate | EmployeeUpdate) -> List[str]:
        """
        Validate extended employee fields.

        Args:
            data: Employee data to validate

        Returns:
            List of validation error messages
        """
        errors = []

        if hasattr(data, "qualifications") and data.qualifications:
            if len(data.qualifications) > 20:
                errors.append("Maximum 20 qualifications allowed")

        if hasattr(data, "hourly_rate") and data.hourly_rate is not None:
            if data.hourly_rate < 0 or data.hourly_rate > 1000:
                errors.append("Hourly rate must be between 0 and 1000")

        if hasattr(data, "max_hours_per_week") and data.max_hours_per_week is not None:
            if data.max_hours_per_week < 1 or data.max_hours_per_week > 168:
                errors.append("Max hours per week must be between 1 and 168")

        return errors

    async def create_employee(
        self,
        data: EmployeeCreate,
        db: AsyncSession,
        current_user_id: int,
    ) -> User:
        """
        Create a new employee.

        Args:
            data: Employee creation data
            db: Database session
            current_user_id: ID of user creating the employee

        Returns:
            Created employee user object

        Raises:
            HTTPException: If validation fails or email exists
        """
        try:
            # Validate extended fields
            validation_errors = self.validate_extended_fields(data)
            if validation_errors:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=", ".join(validation_errors),
                )

            # Validate department if provided
            if data.department_id is not None:
                from ..models.department import Department

                dept_result = await db.execute(select(Department).where(Department.id == data.department_id))
                department = dept_result.scalar_one_or_none()

                if not department:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Department with ID {data.department_id} not found",
                    )

                if not department.active:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot assign employee to inactive department '{department.name}'",
                    )

            # Sanitize inputs
            first_name = self.sanitize_text(data.first_name)
            last_name = self.sanitize_text(data.last_name)

            # Generate email if not provided
            if not data.email:
                email_base = f"{first_name.lower()}.{last_name.lower()}"
                email = f"{email_base}.{uuid.uuid4().hex[:8]}@temp.example.com"
            else:
                email = self.sanitize_text(data.email)

            # Check email uniqueness
            result = await db.execute(select(User).where(User.email == email))
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Employee with email {email} already exists",
                )

            # Hash password
            default_password = "Employee123!"
            password_hash = bcrypt.hashpw(default_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

            # Create user
            new_user = User(
                email=email,
                password_hash=password_hash,
                first_name=first_name,
                last_name=last_name,
                department_id=data.department_id,
                is_active=True,
            )

            db.add(new_user)
            await db.flush()

            # Log department assignment if assigned
            if data.department_id is not None:
                await self.log_department_change(
                    db=db,
                    employee_id=new_user.id,
                    from_dept=None,
                    to_dept=data.department_id,
                    changed_by=current_user_id,
                    reason="Initial department assignment on employee creation",
                    metadata={"action": "create", "initial_assignment": True},
                )

            await db.commit()
            await db.refresh(new_user)

            # Load department relationship
            if new_user.department_id:
                from ..models.department import Department

                dept_result = await db.execute(
                    select(Department)
                    .where(Department.id == new_user.department_id)
                    .options(selectinload(Department.children))
                )
                new_user.department = dept_result.scalar_one_or_none()
            else:
                new_user.department = None

            logger.info(f"Employee created: {new_user.id} by user {current_user_id}")
            return new_user

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating employee: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create employee: {str(e)}",
            )

    async def update_employee(
        self,
        employee_id: int,
        data: EmployeeUpdate,
        db: AsyncSession,
        current_user_id: int,
        is_admin: bool = False,
    ) -> User:
        """
        Update an existing employee.

        Args:
            employee_id: ID of employee to update
            data: Employee update data
            db: Database session
            current_user_id: ID of user making the update
            is_admin: Whether the current user is an admin

        Returns:
            Updated employee user object

        Raises:
            HTTPException: If employee not found or validation fails
        """
        try:
            # Validate extended fields
            validation_errors = self.validate_extended_fields(data)
            if validation_errors:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=", ".join(validation_errors),
                )

            # Find user
            result = await db.execute(select(User).where(User.id == employee_id))
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID {employee_id} not found",
                )

            # Get update data
            update_data = data.model_dump(exclude_unset=True)

            # Sanitize text fields
            if "first_name" in update_data:
                update_data["first_name"] = self.sanitize_text(update_data["first_name"])
            if "last_name" in update_data:
                update_data["last_name"] = self.sanitize_text(update_data["last_name"])
            if "email" in update_data:
                update_data["email"] = self.sanitize_text(update_data["email"])

            # Track department changes
            old_department_id = user.department_id

            # Validate department if being updated
            if "department_id" in update_data:
                new_department_id = update_data["department_id"]

                if new_department_id is not None:
                    from ..models.department import Department

                    dept_result = await db.execute(select(Department).where(Department.id == new_department_id))
                    department = dept_result.scalar_one_or_none()

                    if not department:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"Department with ID {new_department_id} not found",
                        )

                    if not department.active:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot assign employee to inactive department '{department.name}'",
                        )

            # Check email uniqueness if being updated
            if "email" in update_data and update_data["email"] != user.email:
                email_check = await db.execute(select(User).where(User.email == update_data["email"]))
                if email_check.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Employee with email {update_data['email']} already exists",
                    )

            # Map fields to User model
            field_mapping = {
                "first_name": "first_name",
                "last_name": "last_name",
                "email": "email",
                "active": "is_active",
                "department_id": "department_id",
            }

            for schema_field, model_field in field_mapping.items():
                if schema_field in update_data:
                    setattr(user, model_field, update_data[schema_field])

            # Log department change
            if "department_id" in update_data:
                new_department_id = update_data["department_id"]
                if old_department_id != new_department_id:
                    await self.log_department_change(
                        db=db,
                        employee_id=employee_id,
                        from_dept=old_department_id,
                        to_dept=new_department_id,
                        changed_by=current_user_id,
                        reason="Department assignment updated via employee update API",
                        metadata={
                            "action": "update",
                            "updated_fields": list(update_data.keys()),
                        },
                    )

            # Handle role change if role was updated and user is admin
            if "role" in update_data and update_data["role"] and is_admin:
                role_name = update_data["role"]
                if hasattr(role_name, "value"):
                    role_name = role_name.value

                await self.update_user_role(
                    db=db,
                    user_id=employee_id,
                    new_role=role_name,
                    changed_by_id=current_user_id,
                    reason="Role updated via employee update API",
                )

            await db.commit()
            await db.refresh(user)

            # Load department relationship
            if user.department_id:
                from ..models.department import Department

                dept_result = await db.execute(
                    select(Department).where(Department.id == user.department_id).options(selectinload(Department.children))
                )
                user.department = dept_result.scalar_one_or_none()
            else:
                user.department = None

            logger.info(f"Employee {employee_id} updated by user {current_user_id}")
            return user

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update employee: {str(e)}",
            )

    async def delete_employee(self, employee_id: int, db: AsyncSession, current_user_id: int) -> None:
        """
        Delete an employee.

        Args:
            employee_id: ID of employee to delete
            db: Database session
            current_user_id: ID of user performing deletion

        Raises:
            HTTPException: If employee not found
        """
        try:
            result = await db.execute(select(User).where(User.id == employee_id))
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID {employee_id} not found",
                )

            await db.delete(user)
            await db.commit()
            logger.info(f"Employee {employee_id} deleted by user {current_user_id}")

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete employee: {str(e)}",
            )

    async def get_employee(self, employee_id: int, db: AsyncSession) -> User:
        """
        Get a single employee by ID.

        Args:
            employee_id: ID of employee to retrieve
            db: Database session

        Returns:
            Employee user object

        Raises:
            HTTPException: If employee not found
        """
        try:
            query = select(User).where(User.id == employee_id).options(selectinload(User.roles))

            result = await db.execute(query)
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID {employee_id} not found",
                )

            # Load department if present
            if user.department_id:
                from ..models.department import Department

                dept_query = (
                    select(Department).where(Department.id == user.department_id).options(selectinload(Department.children))
                )
                dept_result = await db.execute(dept_query)
                user.department = dept_result.scalar_one_or_none()
            else:
                user.department = None

            return user

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching employee {employee_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch employee: {str(e)}",
            )

    async def search_employees(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        department_id: Optional[int] = None,
        sort_by: str = "first_name",
        sort_order: str = "asc",
        skip: int = 0,
        limit: int = 100,
        user_id_filter: Optional[int] = None,
    ) -> Tuple[List[User], int]:
        """
        Search employees with filters and pagination.

        Args:
            db: Database session
            search: Search term for name/email
            role: Filter by role
            is_active: Filter by active status
            department_id: Filter by department
            sort_by: Field to sort by
            sort_order: Sort order (asc/desc)
            skip: Pagination offset
            limit: Max results
            user_id_filter: Optional user ID filter for RBAC

        Returns:
            Tuple of (list of employees, total count)
        """
        try:
            from ..models.department import Department

            query = select(User).options(selectinload(User.roles))

            # Apply user ID filter for RBAC
            if user_id_filter is not None:
                query = query.where(User.id == user_id_filter)

            # Apply search filter
            if search:
                search_pattern = f"%{search}%"
                search_filter = or_(
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    User.email.ilike(search_pattern),
                )
                query = query.where(search_filter)

            # Apply status filter
            if is_active is not None:
                query = query.where(User.is_active == is_active)

            # Apply department filter
            if department_id is not None:
                query = query.where(User.department_id == department_id)

            # Apply role filter
            if role:
                query = query.join(User.roles).where(Role.name == role)

            # Get total count
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await db.execute(count_query)
            total = total_result.scalar()

            # Apply sorting
            allowed_sort_fields = [
                "first_name",
                "last_name",
                "email",
                "is_active",
                "department_id",
            ]
            if sort_by not in allowed_sort_fields:
                sort_by = "first_name"

            sort_column = getattr(User, sort_by)
            if sort_order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)

            # Apply pagination
            query = query.offset(skip).limit(limit)

            # Execute query
            result = await db.execute(query)
            users = result.scalars().all()

            # Bulk load departments
            dept_ids = [user.department_id for user in users if user.department_id]
            if dept_ids:
                dept_query = select(Department).where(Department.id.in_(dept_ids)).options(selectinload(Department.children))
                dept_result = await db.execute(dept_query)
                departments = {dept.id: dept for dept in dept_result.scalars().all()}

                for user in users:
                    if user.department_id:
                        user.department = departments.get(user.department_id)
                    else:
                        user.department = None
            else:
                for user in users:
                    user.department = None

            return users, total

        except Exception as e:
            logger.error(f"Error searching employees: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to search employees: {str(e)}",
            )

    async def log_department_change(
        self,
        db: AsyncSession,
        employee_id: int,
        from_dept: Optional[int],
        to_dept: Optional[int],
        changed_by: int,
        reason: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> DepartmentAssignmentHistory:
        """
        Log department assignment change to audit trail.

        Args:
            db: Database session
            employee_id: ID of employee whose department is changing
            from_dept: Previous department ID (None if unassigned)
            to_dept: New department ID (None if being unassigned)
            changed_by: ID of user making the change
            reason: Optional explanation for the change
            metadata: Optional additional context (JSON format)

        Returns:
            Created history record

        Raises:
            HTTPException: If database operation fails
        """
        try:
            history_record = DepartmentAssignmentHistory(
                employee_id=employee_id,
                from_department_id=from_dept,
                to_department_id=to_dept,
                changed_by_user_id=changed_by,
                changed_at=datetime.utcnow(),
                change_reason=reason,
                metadata=metadata or {},
            )

            db.add(history_record)
            await db.flush()

            return history_record
        except Exception as e:
            logger.error(f"Error logging department change: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to log department change: {str(e)}",
            )

    async def update_user_role(
        self,
        db: AsyncSession,
        user_id: int,
        new_role: str,
        changed_by_id: int,
        reason: Optional[str] = None,
    ) -> bool:
        """
        Update user role and create audit trail.

        Args:
            db: Database session
            user_id: ID of user whose role is changing
            new_role: Name of the new role to assign
            changed_by_id: ID of user making the change
            reason: Optional explanation for the change

        Returns:
            True if successful

        Raises:
            HTTPException: If role doesn't exist or database operation fails
        """
        try:
            user_query = select(User).where(User.id == user_id).options(selectinload(User.roles))
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {user_id} not found",
                )

            old_role = user.roles[0].name if user.roles else None

            if old_role == new_role:
                return True

            role_query = select(Role).where(Role.name == new_role)
            role_result = await db.execute(role_query)
            new_role_obj = role_result.scalar_one_or_none()

            if not new_role_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Role '{new_role}' not found",
                )

            if user.roles:
                user.roles.clear()

            user.roles.append(new_role_obj)

            history_record = RoleChangeHistory(
                user_id=user_id,
                old_role=old_role,
                new_role=new_role,
                changed_by_id=changed_by_id,
                changed_at=datetime.utcnow(),
                reason=reason or "Role updated via API",
                metadata_json={"action": "role_change", "api_endpoint": "/api/employees"},
            )

            db.add(history_record)
            await db.flush()

            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating user role: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update role: {str(e)}",
            )

    async def check_password_history(
        self,
        db: AsyncSession,
        user_id: int,
        new_password: str,
        history_limit: int = 5,
    ) -> bool:
        """
        Check if password was used in recent history.

        Args:
            db: Database session
            user_id: User ID to check
            new_password: New password to validate
            history_limit: Number of previous passwords to check

        Returns:
            True if password is reused, False if password is unique
        """
        history_query = (
            select(PasswordHistory)
            .where(PasswordHistory.user_id == user_id)
            .order_by(desc(PasswordHistory.changed_at))
            .limit(history_limit)
        )

        result = await db.execute(history_query)
        history_records = result.scalars().all()

        new_password_bytes = new_password.encode("utf-8")
        for record in history_records:
            if bcrypt.checkpw(new_password_bytes, record.password_hash.encode("utf-8")):
                return True

        return False

    async def save_password_to_history(
        self,
        db: AsyncSession,
        user_id: int,
        password_hash: str,
        change_method: str = "self_change",
        changed_by_user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> PasswordHistory:
        """
        Save password to history for tracking.

        Args:
            db: Database session
            user_id: User ID
            password_hash: Hashed password
            change_method: How password was changed
            changed_by_user_id: ID of user who initiated change
            ip_address: IP address of change request

        Returns:
            Created password history record
        """
        history_record = PasswordHistory(
            user_id=user_id,
            password_hash=password_hash,
            changed_at=datetime.now(timezone.utc),
            change_method=change_method,
            changed_by_user_id=changed_by_user_id,
            ip_address=ip_address,
        )

        db.add(history_record)
        await db.flush()

        return history_record
