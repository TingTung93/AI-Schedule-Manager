"""
SQLAlchemy models for AI Schedule Manager
"""

from ..auth.models import User
from .base import Base
from .department import Department
from .department_history import DepartmentAssignmentHistory
from .employee import Employee
from .notification import Notification
from .rule import Rule
from .schedule import Schedule
from .schedule_assignment import ScheduleAssignment
from .schedule_template import ScheduleTemplate
from .shift import Shift
from .shift_definition import ShiftDefinition
from .user_settings import UserSettings

__all__ = [
    "Base",
    "User",
    "Department",
    "DepartmentAssignmentHistory",
    "Employee",
    "Shift",
    "ShiftDefinition",
    "Schedule",
    "ScheduleAssignment",
    "ScheduleTemplate",
    "Rule",
    "Notification",
    "UserSettings"
]
