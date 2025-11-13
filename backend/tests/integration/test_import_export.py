"""
Integration tests for import/export workflows.

Tests CSV import, export to various formats, and round-trip operations.
"""

import pytest
import io
import csv
from datetime import date, time, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.src.models import Employee, Schedule, ScheduleAssignment, Shift, Department
from backend.src.services.import_service import ImportService
from backend.src.services.export_service import ExportService


@pytest.fixture
def import_service() -> ImportService:
    """Create import service instance."""
    return ImportService()


@pytest.fixture
def export_service() -> ExportService:
    """Create export service instance."""
    return ExportService()


@pytest.fixture
async def test_department(db: AsyncSession) -> Department:
    """Create test department."""
    department = Department(name="Test Department", description="Test")
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


@pytest.fixture
def employee_csv_data() -> bytes:
    """Create sample employee CSV data."""
    csv_content = io.StringIO()
    writer = csv.DictWriter(
        csv_content,
        fieldnames=["name", "email", "role", "phone", "max_hours_per_week", "qualifications", "active"],
    )
    writer.writeheader()
    writer.writerows([
        {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "manager",
            "phone": "555-0001",
            "max_hours_per_week": "40",
            "qualifications": "management,customer_service",
            "active": "true",
        },
        {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "role": "server",
            "phone": "555-0002",
            "max_hours_per_week": "35",
            "qualifications": "customer_service",
            "active": "true",
        },
        {
            "name": "Bob Wilson",
            "email": "bob@example.com",
            "role": "cook",
            "phone": "555-0003",
            "max_hours_per_week": "40",
            "qualifications": "cooking,food_safety",
            "active": "true",
        },
    ])

    return csv_content.getvalue().encode("utf-8")


@pytest.mark.asyncio
async def test_import_employees_csv(
    db: AsyncSession, import_service: ImportService, employee_csv_data: bytes, test_department: Department
):
    """Test importing employees from CSV file."""
    result = await import_service.import_employees(
        db,
        employee_csv_data,
        "employees.csv",
        options={"update_existing": False},
    )

    # Verify import results
    assert result["total_rows"] == 3
    assert result["created"] == 3
    assert result["processed"] == 3
    assert len(result["errors"]) == 0

    # Verify employees were created in database
    query = select(Employee)
    result_db = await db.execute(query)
    employees = result_db.scalars().all()

    assert len(employees) == 3

    # Verify employee data
    john = next(emp for emp in employees if emp.email == "john@example.com")
    assert john.name == "John Doe"
    assert john.role == "manager"
    assert john.max_hours_per_week == 40.0
    assert "management" in john.qualifications
    assert "customer_service" in john.qualifications


@pytest.mark.asyncio
async def test_import_schedules_csv(
    db: AsyncSession, import_service: ImportService, test_department: Department
):
    """Test importing schedule assignments from CSV."""
    # First, create employees and shifts
    employees = [
        Employee(
            name="Alice",
            email="alice@example.com",
            role="server",
            is_active=True,
            department_id=test_department.id,
        ),
        Employee(
            name="Bob",
            email="bob@example.com",
            role="cook",
            is_active=True,
            department_id=test_department.id,
        ),
    ]
    for emp in employees:
        db.add(emp)

    shifts = [
        Shift(
            name="Morning",
            shift_type="morning",
            start_time=time(6, 0),
            end_time=time(14, 0),
            required_staff=1,
            active=True,
            department_id=test_department.id,
        ),
        Shift(
            name="Afternoon",
            shift_type="afternoon",
            start_time=time(14, 0),
            end_time=time(22, 0),
            required_staff=1,
            active=True,
            department_id=test_department.id,
        ),
    ]
    for shift in shifts:
        db.add(shift)

    await db.commit()

    # Create schedule CSV data
    csv_content = io.StringIO()
    writer = csv.DictWriter(
        csv_content,
        fieldnames=["employee_email", "shift_name", "date", "status", "notes"],
    )
    writer.writeheader()

    today = date.today()
    writer.writerows([
        {
            "employee_email": "alice@example.com",
            "shift_name": "Morning",
            "date": today.isoformat(),
            "status": "assigned",
            "notes": "Regular shift",
        },
        {
            "employee_email": "bob@example.com",
            "shift_name": "Afternoon",
            "date": today.isoformat(),
            "status": "assigned",
            "notes": "Evening coverage",
        },
    ])

    csv_data = csv_content.getvalue().encode("utf-8")

    # Import schedules
    result = await import_service.import_schedules(
        db,
        csv_data,
        "schedules.csv",
        options={"update_existing": False, "created_by": 1},
    )

    # Verify import results
    assert result["total_rows"] == 2
    assert result["created"] == 2
    assert result["processed"] == 2

    # Verify assignments were created
    query = select(ScheduleAssignment)
    result_db = await db.execute(query)
    assignments = result_db.scalars().all()

    assert len(assignments) == 2
    assert all(a.status == "assigned" for a in assignments)


@pytest.mark.asyncio
async def test_export_employees_csv(
    db: AsyncSession, export_service: ExportService, test_department: Department
):
    """Test exporting employees to CSV format."""
    # Create test employees
    employees = [
        Employee(
            name="Export Test 1",
            email="export1@example.com",
            role="manager",
            is_active=True,
            qualifications=["management"],
            department_id=test_department.id,
        ),
        Employee(
            name="Export Test 2",
            email="export2@example.com",
            role="server",
            is_active=True,
            qualifications=["customer_service"],
            department_id=test_department.id,
        ),
    ]
    for emp in employees:
        db.add(emp)
    await db.commit()

    # Export to CSV
    csv_bytes = await export_service.export_employees(db, "csv", include_inactive=False)

    # Verify CSV content
    assert csv_bytes is not None
    assert len(csv_bytes) > 0

    # Parse CSV
    csv_content = csv_bytes.decode("utf-8")
    assert "Export Test 1" in csv_content
    assert "Export Test 2" in csv_content
    assert "export1@example.com" in csv_content
    assert "export2@example.com" in csv_content


@pytest.mark.asyncio
async def test_export_schedules_excel(
    db: AsyncSession, export_service: ExportService, test_department: Department
):
    """Test exporting schedules to Excel format."""
    # Create test data
    employee = Employee(
        name="Schedule Export",
        email="sched@example.com",
        role="server",
        is_active=True,
        department_id=test_department.id,
    )
    db.add(employee)

    shift = Shift(
        name="Test Shift",
        shift_type="morning",
        start_time=time(9, 0),
        end_time=time(17, 0),
        required_staff=1,
        active=True,
        department_id=test_department.id,
    )
    db.add(shift)

    await db.commit()
    await db.refresh(employee)
    await db.refresh(shift)

    # Create schedule and assignment
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="published",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    assignment = ScheduleAssignment(
        schedule_id=schedule.id,
        employee_id=employee.id,
        shift_id=shift.id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()

    # Export to Excel
    excel_bytes = await export_service.export_schedules(
        db,
        "excel",
        date_from=week_start,
        date_to=week_end,
    )

    # Verify Excel was generated
    assert excel_bytes is not None
    assert len(excel_bytes) > 0
    # Excel files start with PK signature
    assert excel_bytes[:2] == b'PK' or excel_bytes[:4] == b'PK\x03\x04'


@pytest.mark.asyncio
async def test_export_schedules_ical(
    db: AsyncSession, export_service: ExportService, test_department: Department
):
    """Test exporting schedules to iCal format."""
    # Create test data
    employee = Employee(
        name="iCal Export",
        email="ical@example.com",
        role="server",
        is_active=True,
        department_id=test_department.id,
    )
    db.add(employee)

    shift = Shift(
        name="iCal Shift",
        shift_type="afternoon",
        start_time=time(14, 0),
        end_time=time(22, 0),
        required_staff=1,
        active=True,
        date=date.today(),
        department_id=test_department.id,
    )
    db.add(shift)

    await db.commit()
    await db.refresh(employee)
    await db.refresh(shift)

    # Create schedule and assignment
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="published",
        created_by=1,
        version=1,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    assignment = ScheduleAssignment(
        schedule_id=schedule.id,
        employee_id=employee.id,
        shift_id=shift.id,
        status="assigned",
        priority=1,
    )
    db.add(assignment)
    await db.commit()

    # Export to iCal
    ical_bytes = await export_service.export_schedules(
        db,
        "ical",
        date_from=today,
        date_to=today,
    )

    # Verify iCal content
    assert ical_bytes is not None
    ical_content = ical_bytes.decode("utf-8")

    # Check for iCal markers
    assert "BEGIN:VCALENDAR" in ical_content
    assert "BEGIN:VEVENT" in ical_content
    assert "END:VEVENT" in ical_content
    assert "END:VCALENDAR" in ical_content
    assert "iCal Shift" in ical_content


@pytest.mark.asyncio
async def test_round_trip_import_export(
    db: AsyncSession,
    import_service: ImportService,
    export_service: ExportService,
    test_department: Department,
):
    """Test round-trip: export then import the same data."""
    # Create initial employees
    initial_employees = [
        Employee(
            name="Round Trip 1",
            email="rt1@example.com",
            role="manager",
            is_active=True,
            qualifications=["management"],
            max_hours_per_week=40,
            department_id=test_department.id,
        ),
        Employee(
            name="Round Trip 2",
            email="rt2@example.com",
            role="server",
            is_active=True,
            qualifications=["customer_service"],
            max_hours_per_week=35,
            department_id=test_department.id,
        ),
    ]
    for emp in initial_employees:
        db.add(emp)
    await db.commit()

    # Export to CSV
    csv_bytes = await export_service.export_employees(db, "csv", include_inactive=False)

    # Clear employees
    for emp in initial_employees:
        await db.delete(emp)
    await db.commit()

    # Verify employees are gone
    query = select(Employee)
    result = await db.execute(query)
    assert len(result.scalars().all()) == 0

    # Re-import from CSV
    import_result = await import_service.import_employees(
        db,
        csv_bytes,
        "export.csv",
        options={"update_existing": False},
    )

    # Verify import succeeded
    assert import_result["created"] == 2

    # Verify employees were recreated
    query = select(Employee)
    result = await db.execute(query)
    reimported_employees = result.scalars().all()

    assert len(reimported_employees) == 2

    # Verify data integrity
    rt1 = next(emp for emp in reimported_employees if emp.email == "rt1@example.com")
    assert rt1.name == "Round Trip 1"
    assert rt1.role == "manager"


@pytest.mark.asyncio
async def test_import_with_duplicates(
    db: AsyncSession, import_service: ImportService, test_department: Department
):
    """Test import behavior with duplicate data."""
    # Create existing employee
    existing = Employee(
        name="Existing User",
        email="existing@example.com",
        role="server",
        is_active=True,
        department_id=test_department.id,
    )
    db.add(existing)
    await db.commit()

    # Create CSV with duplicate email
    csv_content = io.StringIO()
    writer = csv.DictWriter(csv_content, fieldnames=["name", "email", "role", "active"])
    writer.writeheader()
    writer.writerows([
        {
            "name": "Duplicate User",
            "email": "existing@example.com",  # Duplicate!
            "role": "manager",
            "active": "true",
        },
        {
            "name": "New User",
            "email": "new@example.com",
            "role": "cook",
            "active": "true",
        },
    ])

    csv_data = csv_content.getvalue().encode("utf-8")

    # Import without update_existing
    result = await import_service.import_employees(
        db,
        csv_data,
        "duplicates.csv",
        options={"update_existing": False},
    )

    # Should skip duplicate, create new
    assert result["created"] == 1  # Only new user
    assert result["skipped"] == 1  # Duplicate skipped
    assert len(result["errors"]) >= 1


@pytest.mark.asyncio
async def test_import_validation_errors(
    db: AsyncSession, import_service: ImportService
):
    """Test import with validation errors."""
    # Create CSV with invalid data
    csv_content = io.StringIO()
    writer = csv.DictWriter(csv_content, fieldnames=["name", "email", "role", "active"])
    writer.writeheader()
    writer.writerows([
        {
            "name": "Invalid Email",
            "email": "not-an-email",  # Invalid email
            "role": "server",
            "active": "true",
        },
        {
            "name": "Valid User",
            "email": "valid@example.com",
            "role": "server",
            "active": "true",
        },
    ])

    csv_data = csv_content.getvalue().encode("utf-8")

    # Import should handle validation errors
    result = await import_service.import_employees(
        db,
        csv_data,
        "invalid.csv",
        options={"update_existing": False},
    )

    # Some rows should fail validation
    assert len(result["errors"]) > 0 or result["skipped"] > 0
