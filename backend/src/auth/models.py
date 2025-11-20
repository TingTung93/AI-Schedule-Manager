"""
Authentication Database Models

Defines database models for user authentication, roles, permissions,
and security features like account lockouts and password resets.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()

# Association table for many-to-many relationship between users and roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
)

# Association table for many-to-many relationship between roles and permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class User(Base):
    """
    User model with authentication and security features
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    # Department relationship
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)

    # Security tracking
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_login_attempt = Column(DateTime(timezone=True))
    last_successful_login = Column(DateTime(timezone=True))
    account_locked_until = Column(DateTime(timezone=True))

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Email verification
    email_verification_token = Column(String(255))
    email_verification_sent_at = Column(DateTime(timezone=True))

    # Password reset
    password_reset_token = Column(String(255))
    password_reset_sent_at = Column(DateTime(timezone=True))

    # Relationships
    department = relationship("Department", foreign_keys=[department_id])
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    login_attempts = relationship("LoginAttempt", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.email}>"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def permissions(self):
        """Get all permissions for this user through their roles"""
        perms = set()
        for role in self.roles:
            for permission in role.permissions:
                perms.add(permission.name)
        return list(perms)

    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role"""
        return any(role.name == role_name for role in self.roles)

    def has_permission(self, permission_name: str) -> bool:
        """Check if user has a specific permission"""
        return permission_name in self.permissions

    def is_account_locked(self) -> bool:
        """Check if account is currently locked"""
        if not self.is_locked:
            return False

        if self.account_locked_until and datetime.now(timezone.utc) > self.account_locked_until:
            # Lock has expired, unlock account
            self.is_locked = False
            self.account_locked_until = None
            self.failed_login_attempts = 0
            return False

        return True

    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary"""
        data = {
            "id": self.id,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "department_id": self.department_id,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_successful_login": self.last_successful_login.isoformat() if self.last_successful_login else None,
            "roles": [role.name for role in self.roles],
            "permissions": self.permissions,
        }

        if include_sensitive:
            data.update(
                {
                    "is_locked": self.is_locked,
                    "failed_login_attempts": self.failed_login_attempts,
                    "last_login_attempt": self.last_login_attempt.isoformat() if self.last_login_attempt else None,
                    "account_locked_until": self.account_locked_until.isoformat() if self.account_locked_until else None,
                }
            )

        return data


class Role(Base):
    """
    Role model for RBAC
    """

    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")

    def __repr__(self):
        return f"<Role {self.name}>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "permissions": [permission.name for permission in self.permissions],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Permission(Base):
    """
    Permission model for fine-grained access control
    """

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    resource = Column(String(100), nullable=False)  # e.g., 'user', 'schedule', 'report'
    action = Column(String(50), nullable=False)  # e.g., 'read', 'write', 'delete'

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

    def __repr__(self):
        return f"<Permission {self.name}>"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "resource": self.resource,
            "action": self.action,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoginAttempt(Base):
    """
    Model to track login attempts for security monitoring
    """

    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for failed attempts with invalid email
    email = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False)  # IPv6 compatible
    user_agent = Column(Text)

    # Attempt details
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255))  # e.g., 'invalid_password', 'account_locked', 'invalid_email'

    # Timestamps
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="login_attempts")

    def __repr__(self):
        return f"<LoginAttempt {self.email} at {self.attempted_at}>"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "email": self.email,
            "ip_address": self.ip_address,
            "success": self.success,
            "failure_reason": self.failure_reason,
            "attempted_at": self.attempted_at.isoformat() if self.attempted_at else None,
        }


class RefreshToken(Base):
    """
    Model to track active refresh tokens
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_jti = Column(String(255), unique=True, nullable=False, index=True)  # JWT ID

    # Token details
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime(timezone=True))

    # Client information
    ip_address = Column(String(45))
    user_agent = Column(Text)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")

    def __repr__(self):
        return f"<RefreshToken {self.token_jti}>"

    def is_expired(self) -> bool:
        """Check if token is expired"""
        return datetime.now(timezone.utc) > self.expires_at

    def is_valid(self) -> bool:
        """Check if token is valid (not expired and not revoked)"""
        return not self.revoked and not self.is_expired()

    def to_dict(self):
        return {
            "id": self.id,
            "token_jti": self.token_jti,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "revoked": self.revoked,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "ip_address": self.ip_address,
            "is_valid": self.is_valid(),
        }


class AuditLog(Base):
    """
    Model for security audit logging
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Event details
    event_type = Column(String(100), nullable=False)  # e.g., 'login', 'logout', 'password_change'
    resource = Column(String(100))  # What was accessed/modified
    action = Column(String(100))  # What action was performed

    # Context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    details = Column(Text)  # JSON string with additional details

    # Outcome
    success = Column(Boolean, nullable=False)
    failure_reason = Column(String(255))

    # Timestamp
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<AuditLog {self.event_type} at {self.created_at}>"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "event_type": self.event_type,
            "resource": self.resource,
            "action": self.action,
            "ip_address": self.ip_address,
            "success": self.success,
            "failure_reason": self.failure_reason,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Database utility functions
def create_default_roles_and_permissions(session):
    """
    Create default roles and permissions for the application
    """

    # Define default permissions
    default_permissions = [
        # User management
        {"name": "user.read", "description": "Read user information", "resource": "user", "action": "read"},
        {"name": "user.write", "description": "Create and update users", "resource": "user", "action": "write"},
        {"name": "user.delete", "description": "Delete users", "resource": "user", "action": "delete"},
        {"name": "user.manage", "description": "Full user management", "resource": "user", "action": "manage"},
        # Schedule management
        {"name": "schedule.read", "description": "View schedules", "resource": "schedule", "action": "read"},
        {"name": "schedule.write", "description": "Create and update schedules", "resource": "schedule", "action": "write"},
        {"name": "schedule.delete", "description": "Delete schedules", "resource": "schedule", "action": "delete"},
        {"name": "schedule.manage", "description": "Full schedule management", "resource": "schedule", "action": "manage"},
        # System administration
        {"name": "system.admin", "description": "System administration", "resource": "system", "action": "admin"},
        {"name": "system.audit", "description": "View audit logs", "resource": "system", "action": "audit"},
        {"name": "system.config", "description": "System configuration", "resource": "system", "action": "config"},
    ]

    # Create permissions
    permissions = {}
    for perm_data in default_permissions:
        perm = session.query(Permission).filter_by(name=perm_data["name"]).first()
        if not perm:
            perm = Permission(**perm_data)
            session.add(perm)
            session.flush()
        permissions[perm_data["name"]] = perm

    # Define default roles
    default_roles = [
        {
            "name": "admin",
            "description": "System administrator with full access",
            "permissions": ["user.manage", "schedule.manage", "system.admin", "system.audit", "system.config"],
        },
        {
            "name": "manager",
            "description": "Manager with schedule and user management",
            "permissions": ["user.read", "user.write", "schedule.manage"],
        },
        {
            "name": "user",
            "description": "Regular user with basic access",
            "permissions": ["user.read", "schedule.read", "schedule.write"],
        },
        {"name": "guest", "description": "Guest user with read-only access", "permissions": ["schedule.read"]},
    ]

    # Create roles
    for role_data in default_roles:
        role = session.query(Role).filter_by(name=role_data["name"]).first()
        if not role:
            role = Role(name=role_data["name"], description=role_data["description"])
            session.add(role)
            session.flush()

            # Assign permissions to role
            for perm_name in role_data["permissions"]:
                if perm_name in permissions:
                    role.permissions.append(permissions[perm_name])

    session.commit()


def get_or_create_user_role(session):
    """Get or create the default 'user' role"""
    role = session.query(Role).filter_by(name="user").first()
    if not role:
        create_default_roles_and_permissions(session)
        role = session.query(Role).filter_by(name="user").first()
    return role
