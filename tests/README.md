# AI Schedule Manager - Test Suite

**Version**: 1.0
**Status**: ✅ READY FOR IMPLEMENTATION
**Test Coverage Goal**: >85%
**Total Test Cases**: 500+

---

## 📋 Quick Start

### Prerequisites

```bash
# Install test dependencies
pip install -r requirements-test.txt

# Setup test database
createdb ai_schedule_test

# Run migrations
alembic upgrade head
```

### Run Tests

```bash
# All tests
pytest tests/ -v

# Specific service
pytest tests/services/test_export_service.py -v

# With coverage
pytest tests/ --cov=src --cov-report=html

# Fast tests only
pytest tests/ -m "not slow" -v

# Performance tests
pytest tests/performance/ -v --benchmark
```

---

## 📁 Directory Structure

```
tests/
├── README.md                           # This file
├── INTEGRATION_TEST_PLAN.md            # Master test plan
├── TESTING_SUMMARY.md                  # Comprehensive summary
├── API_TEST_SPECIFICATIONS.md          # API test specs
│
├── conftest.py                         # Shared fixtures
├── pytest.ini                          # Pytest configuration
│
├── fixtures/                           # Test data & factories
│   ├── database.py                     # DB fixtures
│   ├── test_data.py                    # Data factories
│   └── mock_services.py                # Service mocks
│
├── services/                           # Service unit tests
│   ├── TEST_CASES_EXPORT_SERVICE.md    # Export test cases (25)
│   ├── TEST_CASES_IMPORT_SERVICE.md    # Import test cases (35)
│   ├── test_export_service.py          # Export tests
│   ├── test_import_service.py          # Import tests
│   ├── test_schedule_service.py        # Schedule tests
│   ├── test_crud_service.py            # CRUD tests
│   └── test_integration_service.py     # Integration tests
│
├── integration/                        # Integration tests
│   ├── test_import_to_schedule_workflow.py
│   ├── test_schedule_conflict_resolution.py
│   └── test_external_systems_integration.py
│
├── api/                                # API endpoint tests
│   ├── test_api_contracts.py           # Contract validation
│   ├── test_export_api.py              # Export endpoints
│   ├── test_import_api.py              # Import endpoints
│   └── test_schedule_api.py            # Schedule endpoints
│
├── e2e/                                # End-to-end tests
│   └── test_user_workflows.py          # User scenarios
│
└── performance/                        # Performance tests
    ├── test_performance.py             # Load tests
    └── test_query_optimization.py      # DB performance
```

---

## 📊 Test Coverage Overview

### By Component

| Component | Test File | Unit | Integration | API | Coverage |
|-----------|-----------|------|-------------|-----|----------|
| Export Service | `test_export_service.py` | 25 | 5 | 8 | >90% |
| Import Service | `test_import_service.py` | 35 | 10 | 10 | >90% |
| Schedule Service | `test_schedule_service.py` | 70 | 20 | 12 | >85% |
| CRUD Service | `test_crud_service.py` | 80 | 10 | 20 | >90% |
| Integration Service | `test_integration_service.py` | 40 | 25 | 10 | >80% |

### Test Pyramid

```
        /\
       /15\       E2E Tests (Critical workflows)
      /----\
     / 60  \      API Tests (All endpoints)
    /--------\
   /   70    \    Integration Tests
  /------------\
 /     250     \  Unit Tests
/----------------\

Total: ~395 automated tests
```

---

## 🎯 Test Categories

### Unit Tests (250 tests)
Location: `tests/services/`

**Purpose**: Test individual functions and methods
**Coverage**: >85% of service layer code
**Speed**: <100ms per test

**Example**:
```python
async def test_export_employees_csv_basic(db_session, sample_employees):
    """Should export employees to valid CSV format"""
    result = await export_service.export_employees(db_session, "csv")
    assert b"Name,Email,Role" in result
```

### Integration Tests (70 tests)
Location: `tests/integration/`

**Purpose**: Test service interactions and workflows
**Coverage**: All critical integration points
**Speed**: <1s per test

**Example**:
```python
async def test_import_employees_and_generate_schedule(db_session):
    """Complete workflow: Import → Generate → Export"""
    # Import employees
    import_result = await import_service.import_employees(...)
    # Generate schedule
    schedule_result = await schedule_service.generate_schedule(...)
    # Export
    export_result = await export_service.export_schedules(...)
```

### API Tests (60 tests)
Location: `tests/api/`

**Purpose**: Validate API endpoints and contracts
**Coverage**: 100% of endpoints
**Speed**: <500ms per test

**Example**:
```python
async def test_post_export_employees_csv(client, auth_headers):
    response = await client.post(
        "/api/export/employees",
        params={"format": "csv"},
        headers=auth_headers
    )
    assert response.status_code == 200
```

### E2E Tests (15 tests)
Location: `tests/e2e/`

**Purpose**: Validate complete user workflows
**Coverage**: Top 10 critical user journeys
**Speed**: <10s per test

**Example**:
```python
async def test_admin_imports_employees(browser):
    """Admin uploads CSV and imports successfully"""
    # Login, navigate, upload, verify
```

### Performance Tests (20 tests)
Location: `tests/performance/`

**Purpose**: Validate performance and scalability
**Coverage**: Load, stress, and optimization
**Speed**: Variable (5s - 60s)

**Example**:
```python
async def test_export_large_dataset_performance(db_session):
    """Should export 10,000 employees in <5 seconds"""
    # Create 10K employees
    # Measure export time
    assert duration < 5.0
```

---

## 🔧 Test Fixtures

### Database Fixtures

```python
@pytest.fixture(scope="session")
async def test_database():
    """Create test database for session"""
    # Returns database connection

@pytest.fixture
async def db_session(test_database):
    """Fresh transaction for each test"""
    # Auto-rollback after test
```

### Data Factories

```python
from tests.fixtures.test_data import TestDataFactory

# Create test employee
employee = TestDataFactory.create_employee(
    name="John Doe",
    email="john@test.com",
    role="server"
)

# Create test shift
shift = TestDataFactory.create_shift(
    date=date(2024, 1, 15),
    start_time=time(9, 0),
    end_time=time(17, 0)
)
```

### Mock Services

```python
@pytest.fixture
def mock_google_calendar():
    """Mock Google Calendar API"""
    with responses.RequestsMock() as rsps:
        rsps.add(
            responses.POST,
            "https://www.googleapis.com/calendar/v3/...",
            json={"id": "event123"},
            status=200
        )
        yield rsps
```

---

## 📝 Test Documentation

### Detailed Test Case Documents

1. **Export Service Tests**
   - Location: `/tests/services/TEST_CASES_EXPORT_SERVICE.md`
   - Test Cases: 25
   - Covers: CSV, Excel, PDF, iCal exports

2. **Import Service Tests**
   - Location: `/tests/services/TEST_CASES_IMPORT_SERVICE.md`
   - Test Cases: 35
   - Covers: Validation, duplicates, processing

3. **API Test Specifications**
   - Location: `/tests/API_TEST_SPECIFICATIONS.md`
   - Test Cases: 50+
   - Covers: All API endpoints

4. **Integration Test Plan**
   - Location: `/tests/INTEGRATION_TEST_PLAN.md`
   - Master plan with all test strategies

5. **Testing Summary**
   - Location: `/tests/TESTING_SUMMARY.md`
   - Complete overview and metrics

---

## ⚙️ Configuration

### pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Markers
markers =
    P0: Critical priority tests
    P1: High priority tests
    P2: Medium priority tests
    slow: Slow tests (>1s)
    integration: Integration tests
    performance: Performance tests
    e2e: End-to-end tests

# Async support
asyncio_mode = auto

# Coverage
addopts =
    --strict-markers
    --verbose
    --tb=short
    --cov-report=term-missing
    --cov-report=html

# Warnings
filterwarnings =
    error
    ignore::UserWarning
    ignore::DeprecationWarning
```

### requirements-test.txt

```txt
# Core testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0

# HTTP testing
httpx>=0.24.0

# Test data
faker>=19.0.0
factory-boy>=3.3.0

# Mocking
responses>=0.23.0
freezegun>=1.2.0

# Performance
pytest-benchmark>=4.0.0

# Format-specific
pandas>=2.0.0
openpyxl>=3.1.0
PyPDF2>=3.0.0
icalendar>=5.0.0
chardet>=5.0.0
filetype>=1.2.0
```

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          pip install -r requirements-test.txt

      - name: Run tests
        run: |
          pytest tests/ -v --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📈 Test Metrics

### Coverage Reports

After running tests with coverage:

```bash
pytest tests/ --cov=src --cov-report=html
```

Open `htmlcov/index.html` to view detailed coverage report.

### Test Execution Time

Monitor test performance:

```bash
pytest tests/ --durations=10  # Show 10 slowest tests
```

### Coverage Thresholds

```bash
# Fail if coverage below 85%
pytest tests/ --cov=src --cov-fail-under=85
```

---

## 🐛 Debugging Tests

### Run Specific Test

```bash
# Single test function
pytest tests/services/test_export_service.py::test_export_csv -v

# Single test class
pytest tests/services/test_export_service.py::TestCSVExport -v

# With print statements
pytest tests/services/test_export_service.py -v -s
```

### Debug Failed Tests

```bash
# Show detailed failure info
pytest tests/ -v --tb=long

# Drop into debugger on failure
pytest tests/ --pdb

# Show local variables on failure
pytest tests/ -l
```

### Test Isolation

```bash
# Run tests in random order
pytest tests/ --random-order

# Run failed tests first
pytest tests/ --failed-first
```

---

## 🔍 Test Best Practices

### 1. Test Naming

```python
# Good
async def test_export_employees_csv_with_special_characters():
    """Should properly escape special characters in CSV"""

# Bad
async def test_1():
    """Test export"""
```

### 2. Arrange-Act-Assert

```python
async def test_create_employee():
    # Arrange
    employee_data = EmployeeCreate(name="John", email="john@test.com")

    # Act
    employee = await crud_employee.create(db, employee_data)

    # Assert
    assert employee.name == "John"
    assert employee.email == "john@test.com"
```

### 3. Use Fixtures

```python
# Good - use fixtures
async def test_export_employees(db_session, sample_employees):
    result = await export_service.export_employees(db_session, "csv")

# Bad - create data in test
async def test_export_employees(db_session):
    # Creating employees manually...
```

### 4. Test One Thing

```python
# Good - focused test
async def test_employee_email_validation():
    with pytest.raises(ValidationError, match="Invalid email"):
        EmployeeCreate(name="John", email="invalid")

# Bad - testing too much
async def test_employee_crud():
    # Creating, updating, deleting all in one test
```

---

## 📚 Additional Resources

### Documentation
- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [httpx Testing](https://www.python-httpx.org/advanced/#testing)

### Internal Docs
- Master Test Plan: `INTEGRATION_TEST_PLAN.md`
- Testing Summary: `TESTING_SUMMARY.md`
- API Specs: `API_TEST_SPECIFICATIONS.md`

### Getting Help
- Review test case documentation in `/tests/services/`
- Check existing tests for examples
- Refer to master test plan for strategy

---

## ✅ Pre-Merge Checklist

Before merging code:

- [ ] All tests pass locally
- [ ] New features have tests
- [ ] Coverage hasn't decreased
- [ ] No new flaky tests introduced
- [ ] Test execution time reasonable
- [ ] Tests are well-documented
- [ ] CI/CD pipeline passes

---

## 📞 Support

For questions about:
- **Test Strategy**: Review `INTEGRATION_TEST_PLAN.md`
- **Specific Services**: Check test case documents
- **API Testing**: See `API_TEST_SPECIFICATIONS.md`
- **Implementation**: Refer to `TESTING_SUMMARY.md`

---

**Test Suite Version**: 1.0
**Last Updated**: 2025-11-12
**Status**: ✅ READY FOR IMPLEMENTATION

Happy Testing! 🧪
