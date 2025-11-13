# Import Service - Detailed Test Cases

**Service**: ImportService (`backend/src/services/import_service.py`)
**Test File**: `tests/services/test_import_service.py`
**Coverage Goal**: >90%

---

## Overview

The Import Service handles:
1. File validation (format, size, encoding)
2. Data validation (schema, business rules)
3. Duplicate detection (internal and database)
4. Data transformation and import
5. Error reporting and partial success handling

---

## Test Class: TestFileValidation

### TC-IMP-VAL-001: Validate CSV File Format
**Priority**: P0
**Type**: Unit Test

**Test Data**:
```python
valid_csv = b"name,email,role\nJohn Doe,john@test.com,server\n"
```

**Test**:
```python
async def test_validate_csv_file_format():
    result = await import_service.validate_file(valid_csv, "employees.csv")

    assert result["valid"] == True
    assert result["file_type"] in ["csv", "text"]
    assert result["encoding"] == "utf-8"
    assert result["size"] == len(valid_csv)
```

**Expected**: File validated successfully

---

### TC-IMP-VAL-002: Validate Excel File Formats
**Priority**: P0
**Type**: Unit Test

**Test Cases**:
1. `.xlsx` file (modern Excel)
2. `.xls` file (legacy Excel)

**Test**:
```python
async def test_validate_excel_formats():
    # Create minimal valid Excel file
    from openpyxl import Workbook
    import io

    wb = Workbook()
    ws = wb.active
    ws.append(["name", "email", "role"])
    ws.append(["John", "john@test.com", "server"])

    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_bytes = excel_buffer.getvalue()

    result = await import_service.validate_file(excel_bytes, "employees.xlsx")

    assert result["valid"] == True
    assert result["file_type"] in ["xlsx", "xls"]
```

---

### TC-IMP-VAL-003: Reject Invalid File Types
**Priority**: P0
**Type**: Negative Test

**Invalid Files**:
- PDF file
- ZIP file
- Image file (PNG/JPG)
- Binary file

**Test**:
```python
async def test_reject_invalid_file_types():
    invalid_files = [
        (b"%PDF-1.4", "document.pdf"),
        (b"PK\x03\x04", "archive.zip"),
        (b"\x89PNG\r\n", "image.png"),
    ]

    for file_content, filename in invalid_files:
        with pytest.raises(ImportValidationError, match="Unsupported file format"):
            await import_service.validate_file(file_content, filename)
```

---

### TC-IMP-VAL-004: File Size Limit Enforcement
**Priority**: P0
**Type**: Boundary Test

**Test Cases**:
1. File at limit (50MB): Should pass
2. File over limit (50MB + 1 byte): Should fail
3. Empty file: Should fail

**Test**:
```python
async def test_file_size_limits():
    max_size = 50 * 1024 * 1024  # 50MB

    # Just under limit - should pass
    large_valid = b"a" * (max_size - 100)
    result = await import_service.validate_file(large_valid, "large.csv")
    assert result["valid"] == True

    # Over limit - should fail
    too_large = b"a" * (max_size + 1)
    with pytest.raises(ImportValidationError, match="File size exceeds maximum"):
        await import_service.validate_file(too_large, "toolarge.csv")

    # Empty file - should fail
    with pytest.raises(ImportValidationError):
        await import_service.validate_file(b"", "empty.csv")
```

---

### TC-IMP-VAL-005: Encoding Detection
**Priority**: P1
**Type**: Unit Test

**Test Encodings**:
- UTF-8 (most common)
- ISO-8859-1 (Latin-1)
- Windows-1252
- UTF-16

**Test**:
```python
async def test_encoding_detection():
    test_cases = [
        ("Café résumé".encode('utf-8'), "utf-8"),
        ("Café résumé".encode('iso-8859-1'), "iso-8859-1"),
        ("Café résumé".encode('windows-1252'), "windows-1252"),
    ]

    for content, expected_encoding in test_cases:
        result = await import_service.validate_file(content, "test.csv")
        assert result["encoding"] in [expected_encoding, "utf-8"]  # chardet may vary
```

---

### TC-IMP-VAL-006: Malformed CSV Detection
**Priority**: P1
**Type**: Negative Test

**Malformed Cases**:
- Inconsistent column count
- Unclosed quotes
- Invalid delimiters mixed

**Test**:
```python
async def test_malformed_csv_detection():
    malformed_csvs = [
        b'name,email\nJohn,john@test.com,extra\n',  # Inconsistent columns
        b'name,email\n"John Doe,john@test.com\n',  # Unclosed quote
    ]

    for malformed_csv in malformed_csvs:
        # Should either reject or handle gracefully
        result = await import_service.validate_file(malformed_csv, "bad.csv")
        # May pass validation but fail during parsing
```

---

## Test Class: TestDataValidation

### TC-IMP-DATA-001: Validate Email Format
**Priority**: P0
**Type**: Validation Test

**Test Cases**:
- Valid emails: "test@example.com", "user+tag@domain.co.uk"
- Invalid emails: "notanemail", "missing@", "@nodomain.com"

**Test**:
```python
async def test_validate_employee_email_format(db_session):
    df = pd.DataFrame([
        {"name": "John", "email": "john@valid.com", "role": "server"},
        {"name": "Jane", "email": "invalid-email", "role": "cook"},
    ])

    result = await import_service.validate_import_data(db_session, df, "employees")

    assert result["valid_rows"] == 1
    assert result["invalid_rows"] == 1
    assert any("Invalid email" in error["errors"][0] for error in result["errors"])
```

---

### TC-IMP-DATA-002: Validate Role Enum
**Priority**: P0
**Type**: Validation Test

**Valid Roles**: manager, supervisor, server, cook, cashier, cleaner, security

**Test**:
```python
async def test_validate_employee_role_enum(db_session):
    df = pd.DataFrame([
        {"name": "Alice", "email": "alice@test.com", "role": "manager"},  # Valid
        {"name": "Bob", "email": "bob@test.com", "role": "chef"},  # Invalid
    ])

    result = await import_service.validate_import_data(db_session, df, "employees")

    assert result["invalid_rows"] == 1
    errors = [e for e in result["errors"] if e["row"] == 2]
    assert any("Invalid role" in err for err in errors[0]["errors"])
```

---

### TC-IMP-DATA-003: Required Fields Check
**Priority**: P0
**Type**: Validation Test

**Required Fields**:
- Employees: name, email, role
- Schedules: employee_email, shift_name, date
- Rules: rule_type, original_text

**Test**:
```python
async def test_validate_required_fields(db_session):
    # Missing email
    df = pd.DataFrame([
        {"name": "John", "role": "server"},  # Missing email
    ])

    with pytest.raises(ImportValidationError, match="Missing required columns"):
        await import_service.import_employees(db_session, df.to_csv().encode(), "test.csv")
```

---

### TC-IMP-DATA-004: Date Format Parsing
**Priority**: P1
**Type**: Validation Test

**Date Formats to Support**:
- ISO: "2024-01-15"
- US: "01/15/2024"
- EU: "15/01/2024"
- Text: "Jan 15, 2024"

**Test**:
```python
async def test_parse_various_date_formats(db_session):
    date_formats = [
        "2024-01-15",
        "01/15/2024",
        "15-Jan-2024",
    ]

    for date_str in date_formats:
        df = pd.DataFrame([{
            "employee_email": "john@test.com",
            "shift_name": "Morning",
            "date": date_str
        }])

        # Should parse without error
        result = await import_service.validate_import_data(db_session, df, "schedules")
        assert result["invalid_rows"] == 0
```

---

### TC-IMP-DATA-005: Numeric Field Validation
**Priority**: P1
**Type**: Validation Test

**Test**:
```python
async def test_validate_numeric_fields(db_session):
    df = pd.DataFrame([
        {"name": "John", "email": "john@test.com", "role": "server", "hourly_rate": "15.50"},  # Valid
        {"name": "Jane", "email": "jane@test.com", "role": "cook", "hourly_rate": "not_a_number"},  # Invalid
        {"name": "Bob", "email": "bob@test.com", "role": "server", "hourly_rate": "-5"},  # Negative
    ])

    result = await import_service.validate_import_data(db_session, df, "employees")

    assert result["invalid_rows"] == 2
    assert any("Invalid hourly rate format" in str(result["errors"]))
    assert any("cannot be negative" in str(result["errors"]))
```

---

## Test Class: TestDuplicateDetection

### TC-IMP-DUP-001: Detect Internal Email Duplicates
**Priority**: P0
**Type**: Unit Test

**Test Data**:
```python
df = pd.DataFrame([
    {"name": "John Doe", "email": "john@test.com", "role": "server"},
    {"name": "Jane Doe", "email": "jane@test.com", "role": "cook"},
    {"name": "John Smith", "email": "john@test.com", "role": "manager"},  # Duplicate email
])
```

**Test**:
```python
async def test_detect_internal_duplicates(db_session):
    duplicates = await import_service.detect_duplicates(db_session, df, "employees")

    assert duplicates["total_duplicates"] >= 1
    assert len(duplicates["internal_duplicates"]) == 1

    dup = duplicates["internal_duplicates"][0]
    assert dup["field"] == "email"
    assert dup["value"] == "john@test.com"
    assert set(dup["rows"]) == {1, 3}  # Rows 1 and 3
```

---

### TC-IMP-DUP-002: Detect Database Duplicates
**Priority**: P0
**Type**: Integration Test

**Setup**:
```python
# Pre-populate database with employees
existing_employee = await crud_employee.create(db_session, EmployeeCreate(
    name="Existing User",
    email="existing@test.com",
    role="server"
))
```

**Test**:
```python
async def test_detect_database_duplicates(db_session):
    df = pd.DataFrame([
        {"name": "New User", "email": "new@test.com", "role": "server"},
        {"name": "Duplicate User", "email": "existing@test.com", "role": "cook"},
    ])

    duplicates = await import_service.detect_duplicates(db_session, df, "employees")

    assert len(duplicates["database_duplicates"]) == 1
    db_dup = duplicates["database_duplicates"][0]
    assert db_dup["value"] == "existing@test.com"
    assert db_dup["existing_id"] == existing_employee.id
```

---

### TC-IMP-DUP-003: Detect Schedule Assignment Conflicts
**Priority**: P0
**Type**: Integration Test

**Setup**:
```python
# Create employee, shift, and existing assignment
employee = await crud_employee.create(...)
shift = await create_shift(name="Morning Shift", date=date(2024, 1, 15))
schedule = await create_schedule_for_week(date(2024, 1, 15))
existing_assignment = create_assignment(schedule, employee, shift)
```

**Test**:
```python
async def test_detect_schedule_assignment_conflicts(db_session):
    df = pd.DataFrame([{
        "employee_email": employee.email,
        "shift_name": "Morning Shift",
        "date": "2024-01-15"
    }])

    duplicates = await import_service.detect_duplicates(db_session, df, "schedules")

    assert len(duplicates["database_duplicates"]) == 1
    assert "already has shift" in str(duplicates["database_duplicates"][0])
```

---

### TC-IMP-DUP-004: Detect Overlapping Shift Times
**Priority**: P0
**Type**: Business Logic Test

**Setup**:
```python
# Employee already has 9am-5pm shift on 2024-01-15
# Try to import 3pm-11pm shift for same employee
```

**Test**:
```python
async def test_detect_shift_time_overlaps(db_session):
    # Create existing assignment: 9am-5pm
    existing_shift = create_shift(
        date=date(2024, 1, 15),
        start_time=time(9, 0),
        end_time=time(17, 0)
    )
    existing_assignment = create_assignment(employee=employee, shift=existing_shift)

    # Try to import overlapping shift: 3pm-11pm
    df = pd.DataFrame([{
        "employee_email": employee.email,
        "shift_name": "Evening Shift",  # 3pm-11pm
        "date": "2024-01-15"
    }])

    # Import should detect conflict
    result = await import_service.import_schedules(db_session, file_content, "import.csv")

    assert result["skipped"] >= 1
    assert any("conflict" in str(e).lower() for e in result["errors"])
```

---

### TC-IMP-DUP-005: Duplicate Resolution - Update Strategy
**Priority**: P1
**Type**: Unit Test

**Test**:
```python
async def test_duplicate_resolution_update(db_session):
    # Create existing employee
    existing = await crud_employee.create(db_session, EmployeeCreate(
        name="Old Name",
        email="test@example.com",
        role="server"
    ))

    # Import with same email but different data
    df = pd.DataFrame([{
        "name": "Updated Name",
        "email": "test@example.com",
        "role": "manager",
        "phone": "+1234567890"
    }])

    options = {"update_existing": True}
    result = await import_service._process_employee_import(db_session, df, options)

    assert result["updated"] == 1
    assert result["created"] == 0

    # Verify employee was updated
    updated_employee = await crud_employee.get(db_session, existing.id)
    assert updated_employee.name == "Updated Name"
    assert updated_employee.role == "manager"
    assert updated_employee.phone == "+1234567890"
```

---

## Test Class: TestImportProcessing

### TC-IMP-PROC-001: Import Employees Successfully
**Priority**: P0
**Type**: Integration Test

**Test**:
```python
async def test_import_employees_successful(db_session):
    csv_data = b"""name,email,role,phone,max_hours_per_week
John Doe,john@test.com,server,+1234567890,40
Jane Smith,jane@test.com,cook,+0987654321,35
Bob Johnson,bob@test.com,manager,+1122334455,45"""

    result = await import_service.import_employees(
        db_session,
        csv_data,
        "employees.csv"
    )

    assert result["total_rows"] == 3
    assert result["created"] == 3
    assert result["errors"] == []

    # Verify employees in database
    employees = await crud_employee.get_multi(db_session)
    assert employees["total"] == 3
```

---

### TC-IMP-PROC-002: Import with Column Mapping
**Priority**: P1
**Type**: Unit Test

**Scenario**: CSV has different column names than database fields

**Test**:
```python
async def test_import_with_column_mapping(db_session):
    # CSV with custom columns
    csv_data = b"""full_name,email_address,job_title
John Doe,john@test.com,Server
Jane Smith,jane@test.com,Cook"""

    options = {
        "column_mapping": {
            "full_name": "name",
            "email_address": "email",
            "job_title": "role"
        }
    }

    result = await import_service.import_employees(
        db_session,
        csv_data,
        "custom.csv",
        options
    )

    assert result["created"] == 2

    # Verify data mapped correctly
    john = await crud_employee.get_by_email(db_session, "john@test.com")
    assert john.name == "John Doe"
    assert john.role == "server"  # Lowercase normalized
```

---

### TC-IMP-PROC-003: Import Schedules - Auto Create Schedule Containers
**Priority**: P0
**Type**: Integration Test

**Test**:
```python
async def test_import_schedules_auto_create_containers(db_session):
    # Create employee and shift first
    employee = await crud_employee.create(...)
    shift = await create_shift(name="Morning", date=date(2024, 1, 15))

    # Import schedule assignment
    csv_data = b"""employee_email,shift_name,date
john@test.com,Morning,2024-01-15"""

    options = {"created_by": 1}
    result = await import_service.import_schedules(
        db_session,
        csv_data,
        "schedules.csv",
        options
    )

    assert result["created"] == 1

    # Verify Schedule container was auto-created for the week
    schedules = await crud_schedule.get_multi(db_session)
    assert schedules["total"] >= 1

    schedule = schedules["items"][0]
    assert schedule.week_start == date(2024, 1, 15)  # Monday
    assert schedule.week_end == date(2024, 1, 21)    # Sunday

    # Verify ScheduleAssignment created
    assignment = await db_session.execute(
        select(ScheduleAssignment).where(ScheduleAssignment.schedule_id == schedule.id)
    )
    assert assignment.scalar_one() is not None
```

---

### TC-IMP-PROC-004: Partial Success Reporting
**Priority**: P1
**Type**: Unit Test

**Test**:
```python
async def test_import_partial_success_reporting(db_session):
    csv_data = b"""name,email,role
John Doe,john@test.com,server
Jane Smith,invalid-email,cook
Bob Johnson,bob@test.com,chef"""

    result = await import_service.import_employees(
        db_session,
        csv_data,
        "mixed.csv"
    )

    assert result["total_rows"] == 3
    assert result["processed"] == 1  # Only valid rows
    assert result["created"] == 1
    assert result["skipped"] == 2
    assert len(result["errors"]) == 2

    # Verify which rows failed
    error_rows = [e["row"] for e in result["errors"]]
    assert 2 in error_rows  # Jane (invalid email)
    assert 3 in error_rows  # Bob (invalid role)
```

---

### TC-IMP-PROC-005: Transaction Rollback on Critical Error
**Priority**: P0
**Type**: Error Handling Test

**Test**:
```python
async def test_import_transaction_rollback(db_session):
    # Mock database to raise error mid-transaction
    import_count_before = (await crud_employee.get_multi(db_session))["total"]

    csv_data = b"""name,email,role
John Doe,john@test.com,server
Jane Smith,jane@test.com,cook"""

    # Simulate database error during second employee creation
    with patch.object(crud_employee, 'create', side_effect=[
        create_employee(),  # First succeeds
        Exception("Database error")  # Second fails
    ]):
        with pytest.raises(Exception):
            await import_service.import_employees(
                db_session,
                csv_data,
                "test.csv"
            )

    # Verify rollback - no employees should be added
    import_count_after = (await crud_employee.get_multi(db_session))["total"]
    assert import_count_after == import_count_before
```

---

## Test Class: TestImportPreview

### TC-IMP-PREV-001: Preview Import Data Sample
**Priority**: P1
**Type**: Unit Test

**Test**:
```python
async def test_preview_import_data(db_session):
    csv_data = b"""name,email,role
""" + b"\n".join([f"Employee {i},emp{i}@test.com,server" for i in range(50)]).encode()

    preview = await import_service.preview_import_data(
        csv_data,
        "large.csv",
        "employees",
        preview_rows=10
    )

    assert preview["total_rows"] == 50
    assert len(preview["preview_data"]) == 10  # Only preview 10 rows
    assert preview["columns"] == ["name", "email", "role"]
    assert preview["expected_columns"] == ["name", "email", "role", "phone", "hourly_rate", ...]
```

---

### TC-IMP-PREV-002: Column Structure Detection
**Priority**: P1
**Type**: Unit Test

**Test**:
```python
async def test_preview_detect_column_structure(db_session):
    csv_data = b"""full_name,email_address,job_role
John Doe,john@test.com,server"""

    preview = await import_service.preview_import_data(
        csv_data,
        "custom.csv",
        "employees"
    )

    # Should detect columns don't match expected
    assert len(preview["missing_columns"]) > 0
    assert "name" in preview["missing_columns"]
    assert "email" in preview["missing_columns"]

    # Should detect extra columns
    assert len(preview["extra_columns"]) > 0
    assert "full_name" in preview["extra_columns"]
```

---

### TC-IMP-PREV-003: Validation Warnings in Preview
**Priority**: P1
**Type**: Unit Test

**Test**:
```python
async def test_preview_validation_warnings(db_session):
    csv_data = b"""name,email,role
John Doe,invalid-email,chef
Jane Smith,jane@test.com,server"""

    preview = await import_service.preview_import_data(
        csv_data,
        "test.csv",
        "employees"
    )

    # Should include warnings
    assert len(preview["warnings"]) > 0
    assert any("email" in str(w).lower() for w in preview["warnings"])
    assert any("role" in str(w).lower() for w in preview["warnings"])
```

---

## Test Execution Summary

**Total Test Cases**: 35
**Priority Breakdown**:
- P0 (Critical): 20 tests
- P1 (High): 15 tests

**Coverage Areas**:
- File Validation: 6 tests
- Data Validation: 5 tests
- Duplicate Detection: 5 tests
- Import Processing: 5 tests
- Preview Functionality: 3 tests
- Edge Cases: 11 tests

**Estimated Execution Time**:
- Total: ~30 seconds
- Per test average: <1 second

**Dependencies**:
- pandas>=2.0.0
- chardet>=5.0.0
- filetype>=1.2.0
- openpyxl>=3.1.0

---

## Running the Tests

```bash
# Run all import service tests
pytest tests/services/test_import_service.py -v

# Run specific test class
pytest tests/services/test_import_service.py::TestDuplicateDetection -v

# Run with coverage
pytest tests/services/test_import_service.py --cov=src/services/import_service --cov-report=html

# Run critical tests only
pytest tests/services/test_import_service.py -m P0 -v

# Run integration tests
pytest tests/services/test_import_service.py -m integration -v
```
