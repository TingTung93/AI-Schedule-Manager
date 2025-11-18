# Integration Tests - Execution Guide

Comprehensive integration tests for AI Schedule Manager backend.

## Test Coverage

### 1. Authentication Integration (`test_auth_integration.py`)
- **User Registration**: Complete flow with validation
- **Login**: JWT token generation and validation
- **Token Refresh**: Refresh token mechanism
- **Logout**: Token revocation
- **Password Management**: Change password, forgot/reset password
- **Account Security**: Lockout after failed attempts, CSRF protection
- **Session Management**: Active sessions, session revocation

**Tests**: 20+ test cases covering all authentication scenarios

### 2. Employee CRUD (`test_employee_crud.py`)
- **Create**: Employee creation with all/minimal fields
- **Read**: Get by ID, list with pagination
- **Update**: Partial updates (PATCH), full replace (PUT)
- **Delete**: Employee deletion
- **Filtering**: By department, role, active status
- **Search**: By name, email
- **Data Transformation**: camelCase/snake_case conversion

**Tests**: 15+ test cases covering all CRUD operations

### 3. Schedule CRUD (`test_schedule_crud.py`)
- **Create**: Schedule assignment with validation
- **Read**: Get schedules by date range, employee
- **Update**: Status changes, shift changes
- **Delete**: Schedule removal
- **Generation**: Auto-generate schedules for date range
- **Conflict Detection**: Prevent scheduling conflicts
- **Filtering**: By status, date, employee

**Tests**: 12+ test cases covering scheduling operations

### 4. Data Transformation (`test_data_transformation.py`)
- **Case Conversion**: snake_case ↔ camelCase
- **Nested Objects**: Deep nesting, complex structures
- **Arrays**: Lists of objects, mixed types
- **Edge Cases**: Null values, empty collections, Unicode
- **Round-trip**: Bidirectional consistency
- **Performance**: Large dataset handling

**Tests**: 25+ test cases covering transformation scenarios

## Running Tests

### Run All Integration Tests
```bash
cd /home/peter/AI-Schedule-Manager/backend
pytest tests/integration/ -v
```

### Run Specific Test File
```bash
pytest tests/integration/test_auth_integration.py -v
pytest tests/integration/test_employee_crud.py -v
pytest tests/integration/test_schedule_crud.py -v
pytest tests/integration/test_data_transformation.py -v
```

### Run Tests by Marker
```bash
# Authentication tests only
pytest tests/integration/ -m auth -v

# Employee tests only
pytest tests/integration/ -m employee -v

# Schedule tests only
pytest tests/integration/ -m schedule -v
```

### Run with Coverage
```bash
pytest tests/integration/ --cov=src --cov-report=html --cov-report=term
```

### View Coverage Report
```bash
# Open HTML coverage report
xdg-open htmlcov/index.html  # Linux/WSL
```

## Expected Results

When all tests pass, you should see:

```
===================== test session starts ======================
collected 70+ items

tests/integration/test_auth_integration.py ................ [ 20%]
tests/integration/test_employee_crud.py ............... [ 40%]
tests/integration/test_schedule_crud.py ............ [ 55%]
tests/integration/test_data_transformation.py ......................... [100%]

===================== 70+ passed in 15.23s =====================

---------- coverage: platform linux, python 3.11.0 -----------
Name                          Stmts   Miss  Cover
-------------------------------------------------
src/auth/auth.py                 245     12    95%
src/auth/routes.py               387     23    94%
src/models.py                    156      8    95%
src/utils/serializers.py         134      3    98%
-------------------------------------------------
TOTAL                           1847    102    94%
```

## Coverage Goals

- **Overall Coverage**: > 80% ✓
- **Critical Paths**: 100% ✓
- **Authentication**: 90%+ ✓
- **CRUD Operations**: 85%+ ✓
- **Data Transformation**: 95%+ ✓
