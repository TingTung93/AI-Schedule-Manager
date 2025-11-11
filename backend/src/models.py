"""
SQLAlchemy models for AI Schedule Manager.
"""

import uuid
from datetime import date, datetime, time
from typing import List, Optional

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column, relationship

Base = declarative_base()


class Employee(Base):
    """Employee model."""

    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    hourly_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_hours_per_week: Mapped[Optional[int]] = mapped_column(Integer, default=40)
    qualifications: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=[])
    availability_pattern: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules: Mapped[List["Schedule"]] = relationship("Schedule", back_populates="employee")
    rules: Mapped[List["Rule"]] = relationship("Rule", back_populates="employee")


class Rule(Base):
    """Scheduling rule model."""

    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rule_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # availability, preference, requirement, restriction
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    constraints: Mapped[dict] = mapped_column(JSON, nullable=False, default={})
    priority: Mapped[int] = mapped_column(Integer, default=1)  # 1=low, 5=high
    employee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee: Mapped[Optional["Employee"]] = relationship("Employee", back_populates="rules")


class Shift(Base):
    """Shift template model."""

    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    shift_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # morning, afternoon, evening
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    required_staff: Mapped[int] = mapped_column(Integer, default=1)
    required_qualifications: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), default=[])
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    hourly_rate_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules: Mapped[List["Schedule"]] = relationship("Schedule", back_populates="shift")


class Schedule(Base):
    """Schedule assignment model."""

    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    shift_id: Mapped[int] = mapped_column(Integer, ForeignKey("shifts.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(50), default="scheduled", index=True
    )  # scheduled, completed, cancelled, no_show
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    overtime_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee: Mapped["Employee"] = relationship("Employee", back_populates="schedules")
    shift: Mapped["Shift"] = relationship("Shift", back_populates="schedules")


class Notification(Base):
    """Notification model."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    notification_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # schedule, request, reminder, alert
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low, normal, high, urgent
    metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee: Mapped[Optional["Employee"]] = relationship("Employee")


class ScheduleTemplate(Base):
    """Schedule template for recurring schedules."""

    __tablename__ = "schedule_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
