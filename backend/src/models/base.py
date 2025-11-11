"""
Base model class with common fields and methods
"""

from datetime import datetime
from typing import Any
from sqlalchemy import DateTime, MetaData
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# Naming convention for constraints and indexes
convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    """Base class for all database models"""

    metadata = metadata
    type_annotation_map = {datetime: DateTime(timezone=True)}

    @declared_attr
    def __tablename__(cls) -> str:
        """Generate table name from class name"""
        return cls.__name__.lower()

    def to_dict(self) -> dict[str, Any]:
        """Convert model instance to dictionary"""
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}

    def __repr__(self) -> str:
        """String representation of model"""
        return f"<{self.__class__.__name__}({self.to_dict()})>"
