# Export Service - Detailed Test Cases

**Service**: ExportService (`backend/src/services/export_service.py`)
**Test File**: `tests/services/test_export_service.py`
**Coverage Goal**: >90%

---

## Test Class: TestCSVExport

### TC-EXP-CSV-001: Export Employees to CSV - Basic
**Priority**: P0 (Critical)
**Type**: Unit Test

**Setup**:
```python
# Create 10 test employees with various roles
employees = [
    create_employee(name="John Doe", email="john@test.com", role="manager"),
    create_employee(name="Jane Smith", email="jane@test.com", role="server"),
    # ... 8 more
]
```

**Test Steps**:
1. Call `export_service.export_employees(db, format_type="csv")`
2. Parse returned CSV bytes
3. Verify headers match expected columns
4. Verify row count equals employee count
5. Verify data integrity (no truncation, proper encoding)

**Expected Result**:
- CSV has headers: ID, Name, Email, Role, Qualifications, Active, Admin, Department, Created
- 10 data rows
- All fields properly formatted
- UTF-8 encoding

**Edge Cases**:
- Empty employee list
- Employee with special characters in name
- Employee with comma in department name
- Employee with newline in notes field

---

### TC-EXP-CSV-002: Export Employees - Apply Filters
**Priority**: P0
**Type**: Unit Test

**Test Data**:
```python
employees = [
    create_employee(role="manager", is_active=True),
    create_employee(role="server", is_active=True),
    create_employee(role="server", is_active=False),  # Should be filtered
    create_employee(role="cook", is_active=True),
]
```

**Test Cases**:
1. Filter by role="server", include_inactive=False
   - Expected: 1 employee
2. Filter by role="manager", include_inactive=True
   - Expected: 1 employee
3. No filters, include_inactive=False
   - Expected: 3 employees
4. Search filter="John"
   - Expected: Employees with "John" in name or email

**Assertions**:
- Correct employee count
- Only matching employees in result
- Filters applied via SQL WHERE clause (not in-memory)

---

### TC-EXP-CSV-003: Export Schedules - Date Range Filter
**Priority**: P0
**Type**: Unit Test

**Setup**:
```python
# Create schedules across multiple weeks
schedule_week1 = create_schedule(week_start="2024-01-01", week_end="2024-01-07")
schedule_week2 = create_schedule(week_start="2024-01-08", week_end="2024-01-14")
schedule_week3 = create_schedule(week_start="2024-01-15", week_end="2024-01-21")

# Create shifts for each week
shifts = [
    create_shift(date="2024-01-03", schedule=schedule_week1),
    create_shift(date="2024-01-10", schedule=schedule_week2),
    create_shift(date="2024-01-17", schedule=schedule_week3),
]
```

**Test Steps**:
1. Export schedules with date_from="2024-01-08", date_to="2024-01-14"
2. Verify only week2 shifts in CSV
3. Export with no date filters
4. Verify all shifts in CSV

**Expected Results**:
- Filtering by Shift.date, not Schedule.week_start
- Correct assignments returned
- Date format: YYYY-MM-DD

---

### TC-EXP-CSV-004: CSV Special Character Escaping
**Priority**: P1 (High)
**Type**: Unit Test

**Test Data**:
```python
employees = [
    create_employee(name='O\'Brien, Patrick', email="test@example.com"),
    create_employee(name='Smith, "The Boss"', email="boss@example.com"),
    create_employee(notes="Line1\nLine2\nLine3"),
]
```

**Verification**:
- Commas in values are quoted: `"O'Brien, Patrick"`
- Quotes are escaped: `"Smith, ""The Boss"""`
- Newlines are properly escaped or quoted
- CSV is parsable by standard CSV parsers

**Parser Compatibility Test**:
```python
import csv
import io

csv_data = export_service.export_employees(...)
reader = csv.DictReader(io.StringIO(csv_data.decode('utf-8')))
rows = list(reader)
# Should parse without errors
assert len(rows) == 3
```

---

## Test Class: TestExcelExport

### TC-EXP-XLS-001: Export Employees to Excel - Formatting
**Priority**: P0
**Type**: Unit Test

**Test Steps**:
1. Create 20 employees with diverse data
2. Export to Excel format
3. Load Excel file with openpyxl/xlrd
4. Verify worksheet structure

**Verification Points**:
- Sheet name is "Employees" (capitalized)
- Header row has bold formatting and colored background
- Column widths auto-adjusted (10-50 chars)
- Cell borders applied
- No data truncation

**Code Example**:
```python
from openpyxl import load_workbook
import io

excel_bytes = await export_service.export_employees(db, format_type="excel")
workbook = load_workbook(io.BytesIO(excel_bytes))
worksheet = workbook.active

# Verify header formatting
header_cell = worksheet['A1']
assert header_cell.font.bold == True
assert header_cell.fill.start_color.index != 0  # Has background color

# Verify data
assert worksheet.max_row == 21  # 20 employees + header
assert worksheet.max_column == 9  # All columns present
```

---

### TC-EXP-XLS-002: Excel Date and Number Formatting
**Priority**: P1
**Type**: Unit Test

**Test Data**:
```python
employees = [
    create_employee(
        hourly_rate=15.75,
        max_hours_per_week=37.5,
        created_at=datetime(2024, 1, 15, 10, 30, 0)
    )
]
```

**Verification**:
- `hourly_rate` stored as number, not text
- Excel number format applied (2 decimal places)
- `created_at` stored as Excel datetime type
- Date format: YYYY-MM-DD HH:MM:SS
- Column data types correctly set

---

### TC-EXP-XLS-003: Large Dataset Performance
**Priority**: P1
**Type**: Performance Test

**Setup**:
```python
# Create 10,000 employees
employees = [create_employee(id=i) for i in range(10000)]
```

**Performance Criteria**:
- Export completes in <5 seconds
- Memory usage <500MB
- File size reasonable (<10MB)

**Monitoring**:
```python
import time
import tracemalloc

tracemalloc.start()
start_time = time.time()

excel_bytes = await export_service.export_employees(db, format_type="excel")

end_time = time.time()
current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()

assert end_time - start_time < 5.0
assert peak < 500 * 1024 * 1024  # 500MB
```

---

## Test Class: TestPDFExport

### TC-EXP-PDF-001: Export Schedule to PDF - Layout
**Priority**: P0
**Type**: Unit Test

**Test Steps**:
1. Create schedule with 50 assignments
2. Export to PDF
3. Verify PDF structure

**PDF Validation**:
```python
from PyPDF2 import PdfReader
import io

pdf_bytes = await export_service.export_schedules(db, format_type="pdf")
pdf_reader = PdfReader(io.BytesIO(pdf_bytes))

# Verify PDF properties
assert len(pdf_reader.pages) >= 1
assert pdf_reader.metadata['/Producer'] == 'ReportLab'

# Extract text and verify content
page_text = pdf_reader.pages[0].extract_text()
assert "Schedules Report" in page_text
assert "Generated on:" in page_text
```

**Visual Verification** (manual):
- Title centered and large
- Table with proper borders
- Page numbers in footer
- No text overflow

---

### TC-EXP-PDF-002: PDF Table Pagination
**Priority**: P1
**Type**: Unit Test

**Scenario**: Export 200 schedule assignments to PDF

**Expected Behavior**:
- Table automatically splits across pages
- Headers repeated on each page
- Page numbers sequential
- No orphaned rows (minimum 3 rows per page)

**Verification**:
```python
# Create 200 assignments
assignments = [create_assignment() for _ in range(200)]

pdf_bytes = await export_service.export_schedules(db, format_type="pdf")
pdf_reader = PdfReader(io.BytesIO(pdf_bytes))

# Should create multiple pages
assert len(pdf_reader.pages) > 1

# Each page should have content
for page in pdf_reader.pages:
    text = page.extract_text()
    assert len(text) > 100  # Not empty
```

---

### TC-EXP-PDF-003: Analytics Report PDF Formatting
**Priority**: P1
**Type**: Unit Test

**Setup**:
```python
# Create schedule data spanning 30 days
# 10 employees, 5 shifts per employee
```

**Test Steps**:
1. Generate analytics report PDF
2. Verify report sections present

**Required Sections**:
- Report title and generation date
- Summary metrics table
- Employee statistics
- Cost analysis
- Proper formatting with styles

**Analytics Data Validation**:
```python
pdf_bytes = await export_service.export_analytics_report(
    db, format_type="pdf",
    date_from=date(2024,1,1),
    date_to=date(2024,1,31)
)

pdf_reader = PdfReader(io.BytesIO(pdf_bytes))
text = pdf_reader.pages[0].extract_text()

# Verify key metrics present
assert "Total Assignments" in text
assert "Total Hours" in text
assert "Average Hours per Assignment" in text
```

---

## Test Class: TestICalExport

### TC-EXP-ICAL-001: Export Schedule to iCal Format
**Priority**: P0
**Type**: Unit Test

**Test Steps**:
1. Create schedule with assignments
2. Export to iCal format
3. Parse iCal with icalendar library
4. Verify event properties

**iCal Validation**:
```python
from icalendar import Calendar

ical_bytes = await export_service.export_schedules(db, format_type="ical")
calendar = Calendar.from_ical(ical_bytes)

# Verify calendar properties
assert calendar.get('prodid') == '-//AI Schedule Manager//Schedule Export//EN'
assert calendar.get('version') == '2.0'

# Verify events
events = [component for component in calendar.walk() if component.name == "VEVENT"]
assert len(events) == expected_assignment_count

# Verify first event
event = events[0]
assert event.get('summary')  # Has title
assert event.get('dtstart')  # Has start time
assert event.get('dtend')    # Has end time
assert event.get('description')  # Has description
assert event.get('location')  # Has location
```

---

### TC-EXP-ICAL-002: iCal Event Properties Complete
**Priority**: P0
**Type**: Unit Test

**Test Data**:
```python
assignment = create_assignment(
    employee=create_employee(name="John Doe", email="john@test.com", role="Server"),
    shift=create_shift(
        name="Morning Shift",
        date=date(2024, 1, 15),
        start_time=time(9, 0),
        end_time=time(17, 0),
        department=create_department(name="Restaurant")
    ),
    status="confirmed",
    notes="Bring uniform"
)
```

**Expected iCal Event**:
```
BEGIN:VEVENT
SUMMARY:Morning Shift - John Doe
DTSTART:20240115T090000
DTEND:20240115T170000
DESCRIPTION:Employee: John Doe (john@test.com)\nRole: Server\n
 Department: Restaurant\nShift Type: morning\nStatus: confirmed\n
 Notes: Bring uniform
LOCATION:Restaurant
UID:assignment-123@ai-schedule-manager.com
PRIORITY:1
END:VEVENT
```

**Validation**:
- All properties present
- Proper date/time format (RFC 5545)
- UID is unique per assignment
- Summary is descriptive

---

### TC-EXP-ICAL-003: iCal Calendar Import Compatibility
**Priority**: P1
**Type**: Integration Test

**Compatibility Testing**:
Test iCal file can be imported to:
1. Google Calendar (via API or manual test)
2. Outlook Calendar
3. Apple Calendar
4. Thunderbird

**Automated Validation**:
```python
# Validate against iCalendar spec
from icalendar import Calendar
import re

ical_bytes = await export_service.export_schedules(db, format_type="ical")

# Should parse without errors
try:
    calendar = Calendar.from_ical(ical_bytes)
    assert True
except Exception as e:
    pytest.fail(f"iCal parsing failed: {e}")

# Verify RFC 5545 compliance
ical_text = ical_bytes.decode('utf-8')
assert re.search(r'BEGIN:VCALENDAR', ical_text)
assert re.search(r'END:VCALENDAR', ical_text)
assert re.search(r'PRODID:', ical_text)
assert re.search(r'VERSION:2\.0', ical_text)
```

**Manual Test Checklist**:
- [ ] Import to Google Calendar succeeds
- [ ] Events appear with correct times
- [ ] Descriptions are readable
- [ ] Location shows correctly

---

## Test Class: TestExportServiceEdgeCases

### TC-EXP-EDGE-001: Invalid Format Type
**Priority**: P0
**Type**: Negative Test

**Test**:
```python
async def test_export_invalid_format():
    with pytest.raises(ValueError, match="Unsupported format"):
        await export_service.export_employees(db, format_type="json")
```

**Expected**:
- ValueError raised
- Error message indicates supported formats

---

### TC-EXP-EDGE-002: Empty Dataset Handling
**Priority**: P1
**Type**: Edge Case

**Scenario**: No employees in database

**Test Steps**:
1. Clear all employees
2. Export to CSV
3. Export to Excel
4. Export to PDF

**Expected Results**:
- CSV: Returns "No data available\n"
- Excel: Empty workbook with message cell
- PDF: Document with "No data available" text
- No exceptions thrown

---

### TC-EXP-EDGE-003: Database Connection Lost During Export
**Priority**: P1
**Type**: Error Handling

**Simulation**:
```python
async def test_export_database_error():
    # Mock database to raise connection error mid-query
    with patch.object(db, 'execute', side_effect=ConnectionError()):
        with pytest.raises(Exception):
            await export_service.export_employees(db, format_type="csv")
```

**Expected**:
- Exception propagates
- No partial file created
- Error logged

---

### TC-EXP-EDGE-004: Concurrent Export Requests
**Priority**: P2
**Type**: Concurrency Test

**Test**:
```python
async def test_concurrent_exports():
    # Spawn 10 concurrent export tasks
    tasks = [
        export_service.export_employees(db, format_type="csv")
        for _ in range(10)
    ]

    results = await asyncio.gather(*tasks)

    # All should succeed
    assert len(results) == 10
    for result in results:
        assert len(result) > 0
```

**Performance**:
- All requests complete successfully
- No database connection pool exhaustion
- Response time acceptable

---

### TC-EXP-EDGE-005: Large Text Fields
**Priority**: P2
**Type**: Edge Case

**Test Data**:
```python
employee = create_employee(
    name="A" * 1000,  # 1000 character name
    notes="B" * 5000,  # 5000 character notes
)
```

**Verification**:
- CSV: Text properly quoted
- Excel: Text fits in cell (may wrap)
- PDF: Text wraps properly, doesn't overflow page
- No truncation or data loss

---

## Test Class: TestExportDataIntegrity

### TC-EXP-INT-001: Roundtrip Data Integrity
**Priority**: P0
**Type**: Integration Test

**Scenario**: Export then import should preserve data

**Test Steps**:
1. Create employee with all fields populated
2. Export to CSV
3. Import CSV
4. Compare original vs imported data

**Verification**:
```python
original_employee = create_employee(
    name="John Doe",
    email="john@test.com",
    role="manager",
    qualifications=["leadership", "conflict_resolution"],
    is_active=True,
    max_hours_per_week=40
)

# Export
csv_data = await export_service.export_employees(db, format_type="csv")

# Import
import_result = await import_service.import_employees(db, csv_data, "export.csv")

# Retrieve imported employee
imported_employee = await crud_employee.get_by_email(db, "john@test.com")

# Verify data integrity
assert imported_employee.name == original_employee.name
assert imported_employee.role == original_employee.role
assert set(imported_employee.qualifications) == set(original_employee.qualifications)
assert imported_employee.is_active == original_employee.is_active
```

---

### TC-EXP-INT-002: Export Query Optimization
**Priority**: P1
**Type**: Performance Test

**Test**: Verify export uses efficient queries

**Steps**:
1. Enable SQL query logging
2. Export 1000 employees
3. Analyze query execution plan

**Criteria**:
- Uses single query with joins (no N+1 problem)
- Uses indexes for filters
- Query execution time <100ms
- Result set streaming (not loading all in memory)

**Implementation**:
```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

query_count = 0

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
    global query_count
    query_count += 1

query_count = 0
await export_service.export_employees(db, format_type="csv")

# Should use minimal queries
assert query_count <= 3  # Main query + maybe department join + count
```

---

## Test Execution Summary

**Total Test Cases**: 25
**Priority Breakdown**:
- P0 (Critical): 12 tests
- P1 (High): 10 tests
- P2 (Medium): 3 tests

**Estimated Execution Time**:
- Fast tests (<100ms): 15 tests
- Medium tests (100ms-1s): 8 tests
- Slow tests (>1s): 2 tests

**Coverage Target**: >90% for export_service.py

**Dependencies**:
- pytest>=7.4.0
- pytest-asyncio>=0.21.0
- openpyxl>=3.1.0 (Excel testing)
- PyPDF2>=3.0.0 (PDF testing)
- icalendar>=5.0.0 (iCal testing)

---

## Running the Tests

```bash
# Run all export service tests
pytest tests/services/test_export_service.py -v

# Run specific test class
pytest tests/services/test_export_service.py::TestCSVExport -v

# Run with coverage
pytest tests/services/test_export_service.py --cov=src/services/export_service --cov-report=html

# Run performance tests only
pytest tests/services/test_export_service.py -m performance -v

# Run critical tests only
pytest tests/services/test_export_service.py -m P0 -v
```
