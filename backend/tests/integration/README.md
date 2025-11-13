# Integration Tests Documentation

## Overview

Comprehensive integration tests for the AI Schedule Manager application, covering API endpoints, workflows, and end-to-end scenarios.

## Test Structure

### Backend Integration Tests

#### `test_assignment_api.py` - Schedule Assignment API Tests
Tests for assignment CRUD operations, bulk creation, conflict detection, and lifecycle management.

**Test Coverage:**
- ✅ Create individual assignment
- ✅ Get assignments for schedule
- ✅ Bulk create assignments
- ✅ Bulk create with conflict validation
- ✅ Conflict detection (overlapping shifts)
- ✅ Assignment confirmation workflow
- ✅ Assignment decline workflow
- ✅ Update assignment
- ✅ Delete assignment
- ✅ Get employee assignments
- ✅ Filter assignments by status

**Key Features Tested:**
- Assignment CRUD via API
- Bulk operations with validation
- Conflict detection for overlapping shifts
- Employee confirmation/decline workflows
- Status transitions (assigned → confirmed → declined)
- Assignment filtering and querying

#### `test_generation_api.py` - AI Schedule Generation API Tests
Tests for AI-powered schedule generation, validation, approval, and publishing workflows.

**Test Coverage:**
- ✅ AI schedule generation with constraints
- ✅ Generation with custom employee constraints
- ✅ Schedule validation endpoint
- ✅ Validation with conflict detection
- ✅ Publish schedule workflow
- ✅ Publish unapproved schedule (failure case)
- ✅ Schedule approval workflow
- ✅ Schedule rejection workflow
- ✅ Generation with optimization objectives
- ✅ Schedule coverage report
- ✅ Schedule conflicts report

**Key Features Tested:**
- AI-powered schedule generation
- Constraint and rule enforcement
- Validation workflows
- Conflict detection and reporting
- Approval/rejection workflows
- Publishing mechanics
- Coverage analysis
- Optimization objectives

#### `test_schedule_workflow.py` - End-to-End Workflow Tests
Existing tests for complete schedule creation and management workflows.

**Test Coverage:**
- Schedule creation with assignments
- Qualification-based assignment
- Conflict detection in workflows
- Double-booking prevention
- Schedule optimization
- Constraint enforcement
- Status transitions
- Multi-week generation

### Frontend Integration Tests

#### `WizardFlow.test.jsx` - Schedule Builder Wizard Tests
Tests for the complete schedule creation wizard interface.

**Test Coverage:**
- ✅ Complete wizard flow (configuration → publish)
- ✅ API error handling
- ✅ Employee selection validation
- ✅ Step navigation (forward/backward)
- ✅ Generation progress display
- ✅ Conflict handling during validation
- ✅ Draft save and resume
- ✅ Coverage summary display
- ✅ Publish confirmation
- ✅ Accessibility (ARIA labels)
- ✅ Keyboard navigation support

**Key Features Tested:**
- Multi-step wizard navigation
- Form validation
- API integration
- Error handling
- Progress indicators
- Conflict visualization
- Accessibility compliance

## Test Fixtures

### Database Fixtures (conftest.py)

**Employee Fixtures:**
- `test_employees`: Creates employees with different roles, qualifications, and availability
- Employee roles: manager, server, cashier, part-time
- Varying max hours: 20-40 hours per week
- Different availability patterns

**Shift Fixtures:**
- `test_shifts`: Creates shift templates for different times
- Shift types: morning, afternoon, evening
- Various time ranges and staff requirements
- Qualification requirements

**Department Fixtures:**
- `test_department`: Creates test department for organization

**Schedule Fixtures:**
- `test_schedule`: Creates empty schedule container for testing

**HTTP Client:**
- `client`: AsyncClient with database override for API testing
- Proper dependency injection
- Clean teardown

## Running Tests

### Backend Tests

```bash
# Run all integration tests
pytest backend/tests/integration/

# Run specific test file
pytest backend/tests/integration/test_assignment_api.py

# Run with coverage
pytest backend/tests/integration/ --cov=backend/src/api --cov-report=html

# Run specific test
pytest backend/tests/integration/test_assignment_api.py::test_create_assignment -v
```

### Frontend Tests

```bash
# Run all frontend tests
npm test -- --testPathPattern=integration

# Run wizard flow tests
npm test -- WizardFlow.test.jsx

# Run with coverage
npm test -- --coverage --testPathPattern=integration
```

## Test Data

### Sample Employee Data
```python
{
    "name": "Test Employee",
    "email": "emp@test.com",
    "role": "employee",
    "qualifications": ["customer_service"],
    "max_hours_per_week": 40,
    "availability_pattern": {
        "monday": [{"start": "09:00", "end": "17:00"}],
        # ...
    }
}
```

### Sample Assignment Data
```python
{
    "employee_id": 1,
    "shift_id": 1,
    "status": "assigned",
    "priority": 1
}
```

### Sample Generation Request
```json
{
    "department_id": 1,
    "date_from": "2025-11-17",
    "date_to": "2025-11-23",
    "employee_ids": [1, 2, 3],
    "constraints": {
        "max_hours_per_week": 40,
        "min_rest_hours": 12
    }
}
```

## Coverage Goals

### Backend API Tests
- **Target Coverage:** >90%
- **Critical Paths:** 100%
- **Error Cases:** >80%

### Frontend Integration Tests
- **Target Coverage:** >80%
- **User Workflows:** 100%
- **Error Handling:** >70%

## Test Categories

### 1. CRUD Operations
- Create, Read, Update, Delete for all entities
- Proper error handling
- Validation

### 2. Workflow Tests
- Multi-step processes
- State transitions
- Approval workflows

### 3. Conflict Detection
- Overlapping shifts
- Double-booking prevention
- Constraint violations

### 4. AI Generation
- Schedule generation
- Optimization
- Constraint enforcement

### 5. Validation
- Data validation
- Business rule enforcement
- Conflict reporting

### 6. Error Handling
- API errors
- Network failures
- Invalid data

## Best Practices

### Test Structure
1. **Arrange:** Set up test data and fixtures
2. **Act:** Execute the operation
3. **Assert:** Verify results and side effects

### Naming Conventions
- Test files: `test_<feature>_<type>.py`
- Test functions: `test_<action>_<expected_result>`
- Fixtures: Descriptive names indicating what they provide

### Async Testing
```python
@pytest.mark.asyncio
async def test_async_operation(client: AsyncClient, db: AsyncSession):
    response = await client.post("/api/endpoint", json={...})
    assert response.status_code == 201
```

### API Testing
```python
# Use AsyncClient fixture
response = await client.post("/api/schedules", json=data, headers=auth_headers)
assert response.status_code == 201

# Verify database state
query = select(Schedule).where(Schedule.id == data["id"])
result = await db.execute(query)
schedule = result.scalar_one_or_none()
assert schedule is not None
```

## Continuous Integration

### Pre-commit Hooks
```bash
# Run tests before commit
pytest backend/tests/integration/ -v
```

### CI Pipeline
1. Install dependencies
2. Set up test database
3. Run all integration tests
4. Generate coverage report
5. Fail if coverage < threshold

## Troubleshooting

### Common Issues

**Database Connection Errors:**
- Ensure in-memory SQLite is configured
- Check async engine setup
- Verify table creation in fixtures

**Async Test Failures:**
- Use `@pytest.mark.asyncio` decorator
- Properly await async operations
- Check event loop configuration

**API Client Issues:**
- Verify dependency overrides
- Check base URL configuration
- Ensure proper cleanup

## Contributing

When adding new integration tests:

1. Follow existing test structure
2. Add fixtures to `conftest.py` if reusable
3. Document test coverage in this README
4. Ensure tests are isolated and idempotent
5. Include both success and failure cases
6. Test error handling and edge cases
7. Update coverage goals if needed

## Test Metrics

### Current Coverage (as of 2025-11-13)

**Assignment API Tests:** 15 test cases
- CRUD operations: 5 tests
- Bulk operations: 2 tests
- Workflow tests: 4 tests
- Query/filter tests: 4 tests

**Generation API Tests:** 13 test cases
- AI generation: 3 tests
- Validation: 3 tests
- Workflow tests: 5 tests
- Reporting: 2 tests

**Frontend Wizard Tests:** 11 test cases
- Complete workflows: 2 tests
- Navigation: 2 tests
- Validation: 2 tests
- Error handling: 2 tests
- Accessibility: 2 tests
- Display/UI: 1 test

**Total Integration Tests:** 39+ test cases

## Future Enhancements

- [ ] Performance testing for large datasets
- [ ] Load testing for concurrent operations
- [ ] Integration with external calendar APIs
- [ ] Real-time notification testing
- [ ] Multi-tenant isolation testing
- [ ] Backup/restore workflow testing
