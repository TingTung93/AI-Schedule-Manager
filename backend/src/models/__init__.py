"""
SQLAlchemy models for AI Schedule Manager
"""

from .base import Base
from .department import Department
from .department_history import DepartmentAssignmentHistory
from .department_schedule import DepartmentSchedule, DepartmentScheduleTemplate
from .employee import Employee
from .notification import Notification
from .rule import Rule
from .schedule import Schedule
from .schedule_assignment import ScheduleAssignment
from .schedule_template import ScheduleTemplate
from .shift import Shift
from .shift_definition import ShiftDefinition
from .user_settings import UserSettings
from .role_history import RoleChangeHistory
from .account_status_history import AccountStatusHistory

# User model is in auth.models, not in models package
# Import it directly from auth.models where needed

__all__ = [
    "Base",
    "Department",
    "DepartmentAssignmentHistory",
    "DepartmentSchedule",
    "DepartmentScheduleTemplate",
    "Employee",
    "Shift",
    "ShiftDefinition",
    "Schedule",
    "ScheduleAssignment",
    "ScheduleTemplate",
    "Rule",
    "Notification",
    "UserSettings",
    "RoleChangeHistory",
    "AccountStatusHistory"
]
