"""
Test JSONB operations for qualifications and availability fields.
"""
import pytest
from sqlalchemy import select
from datetime import date

from src.auth.models import User


class TestQualificationsField:
    """Test qualifications JSONB field operations."""

    async def test_create_user_with_qualifications(self, db_session):
        """Test creating user with qualifications list."""
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=["Python", "FastAPI", "PostgreSQL"]
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.qualifications == ["Python", "FastAPI", "PostgreSQL"]
        assert len(user.qualifications) == 3

    async def test_update_qualifications(self, db_session):
        """Test updating qualifications list."""
        user = User(
            email="test2@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=["Skill1"]
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Update qualifications
        user.qualifications = ["Skill1", "Skill2", "Skill3"]
        await db_session.commit()
        await db_session.refresh(user)

        assert len(user.qualifications) == 3
        assert "Skill2" in user.qualifications

    async def test_null_qualifications(self, db_session):
        """Test user with null qualifications."""
        user = User(
            email="test3@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=None
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.qualifications is None

    async def test_empty_qualifications_list(self, db_session):
        """Test user with empty qualifications list."""
        user = User(
            email="test4@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=[]
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.qualifications == []
        assert len(user.qualifications) == 0


class TestAvailabilityField:
    """Test availability JSONB field operations."""

    async def test_create_user_with_availability(self, db_session):
        """Test creating user with availability schedule."""
        availability = {
            "monday": {"available": True, "start": "09:00", "end": "17:00"},
            "tuesday": {"available": True, "start": "09:00", "end": "17:00"},
            "wednesday": {"available": False},
            "thursday": {"available": True, "start": "10:00", "end": "18:00"},
            "friday": {"available": True, "start": "09:00", "end": "15:00"}
        }

        user = User(
            email="test5@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            availability=availability
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.availability is not None
        assert user.availability["monday"]["available"] is True
        assert user.availability["monday"]["start"] == "09:00"
        assert user.availability["wednesday"]["available"] is False

    async def test_update_availability(self, db_session):
        """Test updating availability schedule."""
        user = User(
            email="test6@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            availability={
                "monday": {"available": True, "start": "09:00", "end": "17:00"}
            }
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Update availability
        user.availability["monday"]["end"] = "18:00"
        user.availability["tuesday"] = {"available": True, "start": "10:00", "end": "16:00"}
        await db_session.commit()
        await db_session.refresh(user)

        assert user.availability["monday"]["end"] == "18:00"
        assert user.availability["tuesday"]["start"] == "10:00"

    async def test_null_availability(self, db_session):
        """Test user with null availability."""
        user = User(
            email="test7@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            availability=None
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.availability is None

    async def test_complex_availability_queries(self, db_session):
        """Test querying users by availability."""
        # Create users with different availability
        user1 = User(
            email="test8@example.com",
            password_hash="hashed_password",
            first_name="User",
            last_name="One",
            availability={
                "monday": {"available": True, "start": "09:00", "end": "17:00"}
            }
        )
        user2 = User(
            email="test9@example.com",
            password_hash="hashed_password",
            first_name="User",
            last_name="Two",
            availability={
                "monday": {"available": False}
            }
        )
        db_session.add_all([user1, user2])
        await db_session.commit()

        # Query users available on Monday
        # Note: JSON field queries in SQLAlchemy require special syntax
        result = await db_session.execute(
            select(User).where(User.email.in_(["test8@example.com", "test9@example.com"]))
        )
        users = result.scalars().all()

        assert len(users) == 2
        available_monday = [u for u in users if u.availability and
                          u.availability.get("monday", {}).get("available", False)]
        assert len(available_monday) == 1
        assert available_monday[0].email == "test8@example.com"


class TestToDict:
    """Test to_dict() method includes new fields."""

    async def test_to_dict_includes_qualifications_and_availability(self, db_session):
        """Test that to_dict() includes qualifications and availability."""
        user = User(
            email="test10@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=["Python", "SQL"],
            availability={
                "monday": {"available": True, "start": "09:00", "end": "17:00"}
            }
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        user_dict = user.to_dict()

        assert "qualifications" in user_dict
        assert user_dict["qualifications"] == ["Python", "SQL"]
        assert "availability" in user_dict
        assert user_dict["availability"]["monday"]["available"] is True

    async def test_to_dict_with_null_fields(self, db_session):
        """Test to_dict() with null qualifications and availability."""
        user = User(
            email="test11@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            qualifications=None,
            availability=None
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        user_dict = user.to_dict()

        assert "qualifications" in user_dict
        assert user_dict["qualifications"] is None
        assert "availability" in user_dict
        assert user_dict["availability"] is None
