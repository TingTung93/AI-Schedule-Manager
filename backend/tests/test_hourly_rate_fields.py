"""
Test hourly_rate and max_hours_per_week fields
"""
import pytest
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from src.auth.models import User
from src.schemas import EmployeeCreate, EmployeeUpdate


@pytest.mark.asyncio
async def test_user_model_hourly_rate_field(db):
    """Test that User model can store and retrieve hourly_rate"""
    # Create user with hourly_rate
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        first_name="Test",
        last_name="User",
        hourly_rate=Decimal("25.50"),
        max_hours_per_week=40
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Verify fields were saved
    assert user.hourly_rate == Decimal("25.50")
    assert user.max_hours_per_week == 40

    # Test to_dict includes the fields
    user_dict = user.to_dict()
    assert user_dict["hourly_rate"] == 25.50
    assert user_dict["max_hours_per_week"] == 40


@pytest.mark.asyncio
async def test_user_model_nullable_fields(db):
    """Test that hourly_rate and max_hours_per_week can be null"""
    user = User(
        email="test2@example.com",
        password_hash="hashed_password",
        first_name="Test",
        last_name="User2"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Verify null values
    assert user.hourly_rate is None
    assert user.max_hours_per_week is None

    user_dict = user.to_dict()
    assert user_dict["hourly_rate"] is None
    assert user_dict["max_hours_per_week"] is None


def test_employee_create_schema_validation():
    """Test EmployeeCreate schema validates hourly_rate and max_hours_per_week"""
    # Valid data
    data = {
        "firstName": "John",
        "lastName": "Doe",
        "hourly_rate": 30.5,
        "max_hours_per_week": 40
    }
    schema = EmployeeCreate(**data)
    assert schema.hourly_rate == 30.5
    assert schema.max_hours_per_week == 40

    # Test upper bound validation
    with pytest.raises(ValueError) as exc:
        EmployeeCreate(
            firstName="John",
            lastName="Doe",
            hourly_rate=1001  # exceeds max
        )
    assert "less than or equal to 1000" in str(exc.value)

    # Test lower bound validation
    with pytest.raises(ValueError) as exc:
        EmployeeCreate(
            firstName="John",
            lastName="Doe",
            hourly_rate=-1  # negative not allowed
        )
    assert "greater than or equal to 0" in str(exc.value)

    # Test max_hours validation
    with pytest.raises(ValueError) as exc:
        EmployeeCreate(
            firstName="John",
            lastName="Doe",
            max_hours_per_week=169  # exceeds 168 hours/week
        )
    assert "less than or equal to 168" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        EmployeeCreate(
            firstName="John",
            lastName="Doe",
            max_hours_per_week=0  # must be at least 1
        )
    assert "greater than or equal to 1" in str(exc.value)


def test_employee_update_schema_validation():
    """Test EmployeeUpdate schema validates fields"""
    # Valid update
    schema = EmployeeUpdate(
        hourly_rate=35.75,
        max_hours_per_week=45
    )
    assert schema.hourly_rate == 35.75
    assert schema.max_hours_per_week == 45

    # Test empty string conversion to None
    schema = EmployeeUpdate(
        hourly_rate="",
        max_hours_per_week=""
    )
    assert schema.hourly_rate is None
    assert schema.max_hours_per_week is None


def test_numeric_precision():
    """Test that hourly_rate maintains precision"""
    schema = EmployeeCreate(
        firstName="John",
        lastName="Doe",
        hourly_rate=25.99
    )
    assert schema.hourly_rate == 25.99

    # Test two decimal places
    schema2 = EmployeeCreate(
        firstName="Jane",
        lastName="Smith",
        hourly_rate=100.50
    )
    assert schema2.hourly_rate == 100.50


@pytest.mark.asyncio
async def test_update_existing_user_fields(db):
    """Test updating hourly_rate and max_hours_per_week on existing user"""
    # Create user without rates
    user = User(
        email="update_test@example.com",
        password_hash="hashed_password",
        first_name="Update",
        last_name="Test"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Update with rates
    user.hourly_rate = Decimal("28.75")
    user.max_hours_per_week = 35
    await db.commit()
    await db.refresh(user)

    assert user.hourly_rate == Decimal("28.75")
    assert user.max_hours_per_week == 35

    # Update to different values
    user.hourly_rate = Decimal("32.00")
    user.max_hours_per_week = 40
    await db.commit()
    await db.refresh(user)

    assert user.hourly_rate == Decimal("32.00")
    assert user.max_hours_per_week == 40
