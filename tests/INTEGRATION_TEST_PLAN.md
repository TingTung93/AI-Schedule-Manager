# AI Schedule Manager - Comprehensive Integration Testing Plan

**Version:** 1.0
**Created:** 2025-11-12
**Status:** READY FOR IMPLEMENTATION
**Test Framework:** pytest, pytest-asyncio, httpx

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Test Strategy](#test-strategy)
3. [Service Test Plans](#service-test-plans)
4. [Integration Test Scenarios](#integration-test-scenarios)
5. [API Contract Tests](#api-contract-tests)
6. [E2E Test Scenarios](#e2e-test-scenarios)
7. [Performance Testing](#performance-testing)
8. [Frontend Integration Tests](#frontend-integration-tests)
9. [Test Data Management](#test-data-management)
10. [CI/CD Integration](#cicd-integration)

---

## Executive Summary

This comprehensive test plan covers all critical services in the AI Schedule Manager system:

- **Export Service**: CSV, Excel, PDF, iCal format exports
- **Import Service**: CSV/Excel import with validation and duplicate detection
- **Schedule Service**: AI-powered schedule generation and optimization
- **CRUD Service**: Database helper methods for all entities
- **Integration Service**: Calendar, payroll, HR, and webhook integrations

**Test Coverage Goals:**
- Unit Tests: >85% coverage
- Integration Tests: All critical paths
- API Tests: 100% endpoint coverage
- E2E Tests: Top 10 user workflows
- Performance Tests: Load, stress, and optimization scenarios

---

## Test Strategy

### Test Pyramid

```
        /\
       /E2E\       (15 scenarios - Critical user journeys)
      /------\
     /  API  \     (50+ tests - All endpoints)
    /----------\
   /Integration\ (100+ tests - Service interactions)
  /--------------\
 /  Unit Tests   \ (300+ tests - Individual functions)
/------------------\
```

### Testing Principles

1. **Isolation**: Each test is independent and can run in any order
2. **Repeatability**: Tests produce consistent results
3. **Speed**: Unit tests <100ms, Integration <1s, E2E <10s
4. **Clarity**: Test names describe what they test and expected behavior
5. **Coverage**: Focus on critical paths and edge cases

### Test Environments

- **Local**: Developer machines with Docker containers
- **CI**: GitHub Actions with PostgreSQL service
- **Staging**: Pre-production environment
- **Production**: Smoke tests only

---

## Service Test Plans

### 1. Export Service Tests

**File Location**: `/tests/services/test_export_service.py`

#### 1.1 Unit Tests - CSV Export

```python
class TestCSVExport:
    """Test CSV export functionality"""

    async def test_export_employees_csv_basic(self, db_session, sample_employees):
        """Should export employees to valid CSV format"""
        # Test basic CSV generation

    async def test_export_employees_csv_with_filters(self, db_session):
        """Should apply role and active filters correctly"""

    async def test_export_employees_csv_empty_dataset(self, db_session):
        """Should handle empty results gracefully"""

    async def test_export_schedules_csv_date_range(self, db_session):
        """Should filter schedules by date range"""

    async def test_csv_special_characters_escape(self, db_session):
        """Should properly escape commas, quotes, newlines"""

    async def test_csv_unicode_support(self, db_session):
        """Should handle UTF-8 characters correctly"""
```

#### 1.2 Unit Tests - Excel Export

```python
class TestExcelExport:
    """Test Excel export functionality"""

    async def test_export_employees_excel_formatting(self, db_session):
        """Should create properly formatted Excel with headers"""

    async def test_excel_multiple_sheets(self, db_session):
        """Should create multiple sheets for complex exports"""

    async def test_excel_column_width_auto_adjust(self, db_session):
        """Should auto-adjust column widths based on content"""

    async def test_excel_date_formatting(self, db_session):
        """Should format dates as Excel date type"""

    async def test_excel_number_formatting(self, db_session):
        """Should format numbers with proper precision"""

    async def test_excel_large_dataset_performance(self, db_session):
        """Should handle 10000+ rows efficiently"""
```

#### 1.3 Unit Tests - PDF Export

```python
class TestPDFExport:
    """Test PDF export functionality"""

    async def test_export_schedules_pdf_layout(self, db_session):
        """Should create readable PDF with proper layout"""

    async def test_pdf_table_pagination(self, db_session):
        """Should handle multi-page tables correctly"""

    async def test_pdf_analytics_report_formatting(self, db_session):
        """Should format analytics report with charts"""

    async def test_pdf_header_footer_metadata(self, db_session):
        """Should include generation date and page numbers"""

    async def test_pdf_large_dataset_splitting(self, db_session):
        """Should split large datasets across multiple pages"""
```

#### 1.4 Unit Tests - iCal Export

```python
class TestICalExport:
    """Test iCal calendar export functionality"""

    async def test_export_schedules_ical_format(self, db_session):
        """Should generate valid iCal format"""

    async def test_ical_event_properties(self, db_session):
        """Should include all required event properties"""

    async def test_ical_timezone_handling(self, db_session):
        """Should correctly handle timezone conversions"""

    async def test_ical_recurring_events(self, db_session):
        """Should support recurring shift patterns"""

    async def test_ical_import_compatibility(self, db_session):
        """Should be compatible with Google/Outlook/Apple Calendar"""
```

#### 1.5 Edge Cases & Error Handling

```python
class TestExportServiceEdgeCases:
    """Test export service edge cases"""

    async def test_export_invalid_format_type(self, db_session):
        """Should raise error for unsupported format"""

    async def test_export_database_connection_lost(self, db_session):
        """Should handle database disconnection gracefully"""

    async def test_export_memory_limit_exceeded(self, db_session):
        """Should stream large exports to avoid memory issues"""

    async def test_export_concurrent_requests(self, db_session):
        """Should handle multiple concurrent export requests"""
```

---

### 2. Import Service Tests

**File Location**: `/tests/services/test_import_service.py`

#### 2.1 File Validation Tests

```python
class TestFileValidation:
    """Test file upload validation"""

    async def test_validate_csv_file_format(self):
        """Should accept valid CSV files"""

    async def test_validate_excel_file_format(self):
        """Should accept .xlsx and .xls files"""

    async def test_reject_invalid_file_type(self):
        """Should reject non-CSV/Excel files"""

    async def test_validate_file_size_limit(self):
        """Should reject files over 50MB"""

    async def test_validate_encoding_detection(self):
        """Should detect UTF-8, ISO-8859-1, Windows-1252"""

    async def test_validate_malformed_csv(self):
        """Should detect and report malformed CSV"""
```

#### 2.2 Data Validation Tests

```python
class TestDataValidation:
    """Test import data validation"""

    async def test_validate_employee_email_format(self, db_session):
        """Should validate email addresses"""

    async def test_validate_employee_role_enum(self, db_session):
        """Should validate role against allowed values"""

    async def test_validate_required_fields_present(self, db_session):
        """Should check all required fields exist"""

    async def test_validate_date_format_parsing(self, db_session):
        """Should parse various date formats correctly"""

    async def test_validate_time_format_parsing(self, db_session):
        """Should parse HH:MM time format"""

    async def test_validate_numeric_fields(self, db_session):
        """Should validate hourly_rate, max_hours as numbers"""
```

#### 2.3 Duplicate Detection Tests

```python
class TestDuplicateDetection:
    """Test duplicate data detection"""

    async def test_detect_internal_duplicates_email(self, db_session):
        """Should find duplicate emails within import file"""

    async def test_detect_database_duplicates_email(self, db_session):
        """Should find existing employees with same email"""

    async def test_detect_schedule_assignment_conflicts(self, db_session):
        """Should detect employee already assigned to shift"""

    async def test_detect_shift_time_overlaps(self, db_session):
        """Should detect overlapping shift times for same employee"""

    async def test_duplicate_resolution_strategy_update(self, db_session):
        """Should update existing records when specified"""

    async def test_duplicate_resolution_strategy_skip(self, db_session):
        """Should skip duplicates and report them"""
```

#### 2.4 Import Processing Tests

```python
class TestImportProcessing:
    """Test data import processing"""

    async def test_import_employees_successful(self, db_session):
        """Should import valid employee data"""

    async def test_import_employees_with_column_mapping(self, db_session):
        """Should map custom column names to fields"""

    async def test_import_schedules_create_assignments(self, db_session):
        """Should create ScheduleAssignment records"""

    async def test_import_schedules_auto_create_schedule_containers(self, db_session):
        """Should auto-create Schedule containers for weeks"""

    async def test_import_rules_parse_constraints(self, db_session):
        """Should parse and validate rule constraints"""

    async def test_import_partial_success_reporting(self, db_session):
        """Should report which rows succeeded/failed"""

    async def test_import_transaction_rollback_on_error(self, db_session):
        """Should rollback all changes if critical error occurs"""
```

#### 2.5 Preview & Validation Tests

```python
class TestImportPreview:
    """Test import preview functionality"""

    async def test_preview_import_data_sample(self, db_session):
        """Should show first 10 rows of import"""

    async def test_preview_detect_column_structure(self, db_session):
        """Should detect and suggest column mappings"""

    async def test_preview_validation_warnings(self, db_session):
        """Should show warnings for potential issues"""

    async def test_preview_row_count_summary(self, db_session):
        """Should display total, valid, invalid row counts"""
```

---

### 3. Schedule Generation Service Tests

**File Location**: `/tests/services/test_schedule_service.py`

#### 3.1 Schedule Generation Tests

```python
class TestScheduleGeneration:
    """Test AI schedule generation"""

    async def test_generate_schedule_basic(self, db_session):
        """Should generate valid schedule for date range"""

    async def test_generate_schedule_with_employee_availability(self, db_session):
        """Should respect employee availability patterns"""

    async def test_generate_schedule_with_qualifications(self, db_session):
        """Should only assign qualified employees to shifts"""

    async def test_generate_schedule_with_max_hours_constraint(self, db_session):
        """Should respect max_hours_per_week limits"""

    async def test_generate_schedule_with_rules(self, db_session):
        """Should apply scheduling rules/constraints"""

    async def test_generate_schedule_optimal_coverage(self, db_session):
        """Should maximize shift coverage"""

    async def test_generate_schedule_fairness_distribution(self, db_session):
        """Should distribute shifts fairly among employees"""
```

#### 3.2 Schedule Optimization Tests

```python
class TestScheduleOptimization:
    """Test schedule optimization"""

    async def test_optimize_existing_schedule(self, db_session):
        """Should improve existing schedule"""

    async def test_optimize_minimize_overtime(self, db_session):
        """Should reduce overtime hours"""

    async def test_optimize_balance_workload(self, db_session):
        """Should balance hours across employees"""

    async def test_optimize_reduce_conflicts(self, db_session):
        """Should resolve scheduling conflicts"""

    async def test_optimize_solver_timeout(self, db_session):
        """Should return best solution within time limit"""

    async def test_optimize_performance_metrics(self, db_session):
        """Should track optimization improvements"""
```

#### 3.3 Conflict Detection Tests

```python
class TestConflictDetection:
    """Test schedule conflict detection"""

    async def test_detect_double_booking(self, db_session):
        """Should detect employee assigned to overlapping shifts"""

    async def test_detect_qualification_mismatch(self, db_session):
        """Should detect unqualified employee assignments"""

    async def test_detect_availability_violation(self, db_session):
        """Should detect shifts outside availability"""

    async def test_detect_max_hours_exceeded(self, db_session):
        """Should detect when max weekly hours exceeded"""

    async def test_detect_minimum_rest_period_violation(self, db_session):
        """Should detect insufficient rest between shifts"""
```

#### 3.4 Constraint Solver Tests

```python
class TestConstraintSolver:
    """Test constraint solver engine"""

    async def test_solver_feasible_solution(self, db_session):
        """Should find feasible solution when possible"""

    async def test_solver_infeasible_problem(self, db_session):
        """Should report when no solution exists"""

    async def test_solver_hard_vs_soft_constraints(self, db_session):
        """Should prioritize hard constraints over soft"""

    async def test_solver_custom_constraints(self, db_session):
        """Should apply custom scheduling rules"""

    async def test_solver_performance_large_problem(self, db_session):
        """Should solve 100+ employee, 1000+ shift problems"""
```

---

### 4. CRUD Service Tests

**File Location**: `/tests/services/test_crud_service.py`

#### 4.1 Employee CRUD Tests

```python
class TestEmployeeCRUD:
    """Test employee CRUD operations"""

    async def test_create_employee(self, db_session):
        """Should create new employee record"""

    async def test_get_employee_by_id(self, db_session):
        """Should retrieve employee by ID"""

    async def test_get_employee_by_email(self, db_session):
        """Should retrieve employee by email"""

    async def test_update_employee(self, db_session):
        """Should update employee fields"""

    async def test_delete_employee(self, db_session):
        """Should delete employee record"""

    async def test_get_employees_with_pagination(self, db_session):
        """Should return paginated results"""

    async def test_get_employees_with_search(self, db_session):
        """Should search by name or email"""

    async def test_get_employees_with_filters(self, db_session):
        """Should filter by role, active status"""

    async def test_get_employee_schedule(self, db_session):
        """Should return employee's schedule assignments"""
```

#### 4.2 Schedule CRUD Tests

```python
class TestScheduleCRUD:
    """Test schedule CRUD operations"""

    async def test_create_schedule(self, db_session):
        """Should create new schedule container"""

    async def test_get_schedule_with_assignments(self, db_session):
        """Should load schedule with all assignments"""

    async def test_update_schedule_status(self, db_session):
        """Should update schedule lifecycle status"""

    async def test_get_schedules_by_date_range(self, db_session):
        """Should filter schedules by week_start/week_end"""

    async def test_delete_schedule_cascade(self, db_session):
        """Should cascade delete all assignments"""
```

#### 4.3 Common CRUD Pattern Tests

```python
class TestCRUDBasePatterns:
    """Test common CRUD patterns"""

    async def test_pagination_consistency(self, db_session):
        """Should return consistent pagination across all models"""

    async def test_sorting_multiple_fields(self, db_session):
        """Should support multi-field sorting"""

    async def test_transaction_rollback(self, db_session):
        """Should rollback on error"""

    async def test_concurrent_updates(self, db_session):
        """Should handle concurrent modifications"""

    async def test_soft_delete_support(self, db_session):
        """Should support soft deletes where applicable"""
```

---

### 5. Integration Service Tests

**File Location**: `/tests/services/test_integration_service.py`

#### 5.1 Webhook Tests

```python
class TestWebhookIntegration:
    """Test webhook notification system"""

    async def test_register_webhook_endpoint(self):
        """Should register webhook for event type"""

    async def test_send_webhook_successful(self, http_mock):
        """Should send webhook POST request"""

    async def test_webhook_signature_generation(self):
        """Should generate valid HMAC signature"""

    async def test_webhook_retry_on_failure(self, http_mock):
        """Should retry failed webhooks with backoff"""

    async def test_webhook_timeout_handling(self, http_mock):
        """Should handle webhook endpoint timeouts"""
```

#### 5.2 Calendar Integration Tests

```python
class TestCalendarIntegration:
    """Test calendar system integration"""

    async def test_sync_to_google_calendar(self, db_session, google_mock):
        """Should create events in Google Calendar"""

    async def test_sync_to_outlook_calendar(self, db_session, outlook_mock):
        """Should create events in Outlook Calendar"""

    async def test_calendar_event_format_conversion(self, db_session):
        """Should convert schedule to calendar event format"""

    async def test_calendar_timezone_conversion(self, db_session):
        """Should handle timezone conversions"""

    async def test_calendar_sync_error_handling(self, db_session):
        """Should handle API errors gracefully"""
```

#### 5.3 Payroll Integration Tests

```python
class TestPayrollIntegration:
    """Test payroll system integration"""

    async def test_export_timesheet_data(self, db_session):
        """Should prepare timesheet data for payroll"""

    async def test_calculate_employee_hours(self, db_session):
        """Should accurately calculate worked hours"""

    async def test_calculate_overtime_hours(self, db_session):
        """Should identify overtime hours"""

    async def test_group_timesheet_by_employee(self, db_session):
        """Should group shifts by employee"""

    async def test_payroll_date_range_filtering(self, db_session):
        """Should filter by pay period dates"""
```

#### 5.4 HR System Integration Tests

```python
class TestHRSystemIntegration:
    """Test HR system integration"""

    async def test_sync_employee_data_import(self, db_session):
        """Should import employees from HR system"""

    async def test_sync_employee_data_export(self, db_session):
        """Should export employees to HR system"""

    async def test_sync_bidirectional(self, db_session):
        """Should sync data both ways"""

    async def test_sync_conflict_resolution(self, db_session):
        """Should handle data conflicts"""
```

---

## Integration Test Scenarios

### Scenario 1: Complete Import-to-Schedule Workflow

**File Location**: `/tests/integration/test_import_to_schedule_workflow.py`

```python
async def test_import_employees_and_generate_schedule(db_session):
    """
    Test complete workflow:
    1. Import employees from CSV
    2. Import scheduling rules
    3. Generate optimized schedule
    4. Export schedule to Excel
    5. Verify all data integrity
    """
    # Step 1: Import employees
    employee_csv = create_test_csv(...)
    import_result = await import_service.import_employees(...)
    assert import_result["created"] == 10

    # Step 2: Import rules
    rules_csv = create_test_csv(...)
    rules_result = await import_service.import_rules(...)

    # Step 3: Generate schedule
    schedule_result = await schedule_service.generate_schedule(...)
    assert schedule_result["status"] == "optimal"

    # Step 4: Export to Excel
    excel_data = await export_service.export_schedules(...)
    assert len(excel_data) > 0

    # Step 5: Verify data integrity
    employees = await crud_employee.get_multi(db_session)
    schedules = await crud_schedule.get_multi(db_session)
    assert len(schedules["items"]) > 0
```

### Scenario 2: Schedule Optimization with Conflicts

**File Location**: `/tests/integration/test_schedule_conflict_resolution.py`

```python
async def test_detect_and_resolve_scheduling_conflicts(db_session):
    """
    Test conflict detection and resolution:
    1. Create employees with overlapping availability
    2. Generate initial schedule
    3. Detect conflicts
    4. Optimize to resolve conflicts
    5. Verify conflict-free schedule
    """
```

### Scenario 3: External System Integration Flow

**File Location**: `/tests/integration/test_external_systems_integration.py`

```python
async def test_complete_external_integration_flow(db_session):
    """
    Test integration with external systems:
    1. Generate schedule
    2. Sync to Google Calendar
    3. Export timesheet to payroll
    4. Send webhook notifications
    5. Verify all integrations successful
    """
```

---

## API Contract Tests

**File Location**: `/tests/api/test_api_contracts.py`

### REST API Endpoints

```python
class TestExportAPIEndpoints:
    """Test export API endpoints"""

    async def test_post_export_employees_csv(self, client, auth_headers):
        """POST /api/export/employees?format=csv"""
        response = await client.post(
            "/api/export/employees",
            params={"format": "csv"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"

    async def test_post_export_schedules_excel(self, client, auth_headers):
        """POST /api/export/schedules?format=excel"""

    async def test_post_export_analytics_pdf(self, client, auth_headers):
        """POST /api/export/analytics?format=pdf"""

class TestImportAPIEndpoints:
    """Test import API endpoints"""

    async def test_post_import_employees_preview(self, client, auth_headers):
        """POST /api/import/employees/preview"""

    async def test_post_import_employees_execute(self, client, auth_headers):
        """POST /api/import/employees"""

    async def test_post_import_schedules(self, client, auth_headers):
        """POST /api/import/schedules"""

class TestScheduleAPIEndpoints:
    """Test schedule generation API"""

    async def test_post_generate_schedule(self, client, auth_headers):
        """POST /api/schedules/generate"""

    async def test_post_optimize_schedule(self, client, auth_headers):
        """POST /api/schedules/{id}/optimize"""

    async def test_get_schedule_conflicts(self, client, auth_headers):
        """GET /api/schedules/conflicts"""
```

### API Contract Validation

```python
class TestAPIContractValidation:
    """Validate API request/response contracts"""

    async def test_request_schema_validation(self, client):
        """Should reject invalid request schemas"""

    async def test_response_schema_consistency(self, client):
        """Should return consistent response schemas"""

    async def test_error_response_format(self, client):
        """Should return standardized error format"""

    async def test_pagination_format(self, client):
        """Should use consistent pagination structure"""
```

---

## E2E Test Scenarios

**File Location**: `/tests/e2e/test_user_workflows.py`

### Top 10 Critical User Workflows

```python
class TestE2EUserWorkflows:
    """End-to-end user workflow tests"""

    async def test_workflow_1_admin_imports_employees(self, browser):
        """
        Admin uploads employee CSV and imports successfully
        1. Login as admin
        2. Navigate to import page
        3. Upload CSV file
        4. Preview import
        5. Execute import
        6. Verify employees created
        """

    async def test_workflow_2_manager_generates_schedule(self, browser):
        """
        Manager generates weekly schedule
        1. Login as manager
        2. Navigate to schedules
        3. Click "Generate Schedule"
        4. Select date range and options
        5. Generate schedule
        6. Review and approve
        """

    async def test_workflow_3_employee_views_schedule(self, browser):
        """
        Employee views their assigned shifts
        1. Login as employee
        2. View dashboard
        3. See upcoming shifts
        4. Export to personal calendar
        """

    async def test_workflow_4_manager_exports_timesheet(self, browser):
        """
        Manager exports timesheet for payroll
        1. Login as manager
        2. Navigate to reports
        3. Select pay period
        4. Export to Excel
        5. Verify file downloads
        """

    async def test_workflow_5_admin_resolves_conflict(self, browser):
        """
        Admin identifies and resolves scheduling conflict
        1. Login as admin
        2. View conflict alerts
        3. Analyze conflict details
        4. Reassign employee
        5. Verify conflict resolved
        """
```

---

## Performance Testing

**File Location**: `/tests/performance/test_performance.py`

### Load Testing

```python
class TestPerformanceLoad:
    """Load testing for services"""

    async def test_export_large_dataset_performance(self, db_session):
        """
        Should export 10,000 employees in <5 seconds
        """
        # Create 10,000 test employees
        # Measure export time
        # Assert execution time < 5 seconds

    async def test_import_large_file_performance(self, db_session):
        """
        Should import 5,000 row CSV in <10 seconds
        """

    async def test_schedule_generation_performance(self, db_session):
        """
        Should generate schedule for 100 employees, 500 shifts in <60 seconds
        """

    async def test_concurrent_api_requests(self, client):
        """
        Should handle 100 concurrent requests without errors
        """
```

### Stress Testing

```python
class TestPerformanceStress:
    """Stress testing for system limits"""

    async def test_maximum_concurrent_exports(self, db_session):
        """Find maximum concurrent export operations"""

    async def test_maximum_schedule_complexity(self, db_session):
        """Find maximum employees/shifts for generation"""

    async def test_memory_usage_large_dataset(self, db_session):
        """Monitor memory usage with large datasets"""
```

### Database Query Optimization

```python
class TestQueryPerformance:
    """Test database query performance"""

    async def test_employee_schedule_query_performance(self, db_session):
        """Should retrieve employee schedule with <100ms"""

    async def test_schedule_assignment_query_n_plus_1(self, db_session):
        """Should avoid N+1 query problems"""

    async def test_index_usage_verification(self, db_session):
        """Should use database indexes for common queries"""
```

---

## Frontend Integration Tests

**File Location**: `/tests/frontend/frontend_integration_tests.md`

### Component Integration Tests

```typescript
// Import Component Tests
describe('Import Component Integration', () => {
  it('should upload CSV and display preview', async () => {
    // Test file upload
    // Verify preview appears
    // Check column mapping UI
  });

  it('should show validation errors', async () => {
    // Upload invalid file
    // Verify error messages
  });

  it('should execute import and show results', async () => {
    // Execute import
    // Verify success message
    // Check employees list updates
  });
});

// Schedule Generation Component Tests
describe('Schedule Generation Integration', () => {
  it('should generate schedule and display results', async () => {
    // Click generate button
    // Wait for processing
    // Verify schedule grid appears
  });

  it('should highlight conflicts in schedule view', async () => {
    // Generate schedule with conflicts
    // Verify conflict indicators
  });
});

// Export Component Tests
describe('Export Component Integration', () => {
  it('should export and download file', async () => {
    // Select export format
    // Click export button
    // Verify file download
  });
});
```

### API Integration Tests

```typescript
// Frontend API Integration
describe('Frontend-Backend API Integration', () => {
  it('should handle authentication flow', async () => {
    // Login request
    // Store token
    // Verify protected routes accessible
  });

  it('should handle API errors gracefully', async () => {
    // Trigger API error
    // Verify error toast appears
  });

  it('should refresh data on updates', async () => {
    // Update employee
    // Verify list refreshes
  });
});
```

---

## Test Data Management

### Test Data Strategy

```python
# File: /tests/fixtures/test_data.py

class TestDataFactory:
    """Factory for creating test data"""

    @staticmethod
    def create_employee(override: dict = None) -> Employee:
        """Create test employee with sensible defaults"""

    @staticmethod
    def create_shift(override: dict = None) -> Shift:
        """Create test shift"""

    @staticmethod
    def create_schedule(override: dict = None) -> Schedule:
        """Create test schedule container"""

    @staticmethod
    def create_schedule_assignment(override: dict = None) -> ScheduleAssignment:
        """Create test assignment"""

# Fixtures for common scenarios
@pytest.fixture
async def populated_database(db_session):
    """Database with 50 employees, 100 shifts, 10 schedules"""

@pytest.fixture
async def conflict_scenario_data(db_session):
    """Data setup that creates scheduling conflicts"""

@pytest.fixture
async def large_dataset(db_session):
    """Large dataset for performance testing"""
```

### Test Database Management

```python
# File: /tests/fixtures/database.py

@pytest.fixture(scope="session")
async def test_database():
    """Create test database for session"""
    # Create database
    # Run migrations
    # Yield connection
    # Cleanup database

@pytest.fixture
async def db_session(test_database):
    """Create fresh transaction for each test"""
    # Begin transaction
    # Yield session
    # Rollback transaction (auto-cleanup)
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# File: .github/workflows/test.yml

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
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov httpx

      - name: Run unit tests
        run: pytest tests/services/ -v --cov=src/services

      - name: Run integration tests
        run: pytest tests/integration/ -v

      - name: Run API tests
        run: pytest tests/api/ -v

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Execution Strategy

```bash
# Local development
pytest tests/services/          # Unit tests only
pytest tests/integration/       # Integration tests
pytest tests/e2e/              # E2E tests (slow)

# CI Pipeline
pytest tests/ -v --cov=src --cov-report=html

# Performance tests (manual)
pytest tests/performance/ -v --benchmark
```

---

## Test Coverage Metrics

### Coverage Goals by Component

| Component | Unit Tests | Integration | E2E | Target Coverage |
|-----------|------------|-------------|-----|-----------------|
| Export Service | 50+ tests | 10 tests | 2 workflows | >90% |
| Import Service | 60+ tests | 15 tests | 3 workflows | >90% |
| Schedule Service | 70+ tests | 20 tests | 4 workflows | >85% |
| CRUD Service | 80+ tests | 10 tests | - | >90% |
| Integration Service | 40+ tests | 25 tests | 3 workflows | >80% |

### Critical Path Coverage

Must have 100% test coverage for:
- Data validation logic
- Duplicate detection
- Schedule conflict detection
- File format parsing
- API authentication/authorization
- Data export accuracy
- Schedule generation correctness

---

## Test Execution Checklist

### Before Merging PR

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] API contract tests pass
- [ ] No regression in test coverage
- [ ] Performance tests show no degradation
- [ ] E2E tests for affected workflows pass

### Before Release

- [ ] Full test suite passes (800+ tests)
- [ ] Coverage >85% overall
- [ ] E2E tests cover all critical workflows
- [ ] Performance benchmarks meet SLAs
- [ ] Load tests pass with expected traffic
- [ ] Manual smoke tests on staging

---

## Appendix A: Test File Structure

```
tests/
├── __init__.py
├── conftest.py                     # Shared fixtures
├── fixtures/
│   ├── database.py                 # Database fixtures
│   ├── test_data.py                # Test data factory
│   └── mock_services.py            # Service mocks
├── services/
│   ├── test_export_service.py      # Export unit tests
│   ├── test_import_service.py      # Import unit tests
│   ├── test_schedule_service.py    # Schedule unit tests
│   ├── test_crud_service.py        # CRUD unit tests
│   └── test_integration_service.py # Integration unit tests
├── integration/
│   ├── test_import_to_schedule_workflow.py
│   ├── test_schedule_conflict_resolution.py
│   └── test_external_systems_integration.py
├── api/
│   ├── test_api_contracts.py       # API endpoint tests
│   └── test_api_validation.py      # Request/response validation
├── e2e/
│   └── test_user_workflows.py      # End-to-end scenarios
├── performance/
│   ├── test_performance.py         # Load/stress tests
│   └── test_query_optimization.py  # DB performance
└── frontend/
    └── frontend_integration_tests.md # Frontend test specs
```

---

## Appendix B: Key Testing Libraries

```python
# requirements-test.txt
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
httpx>=0.24.0                    # Async HTTP client
faker>=19.0.0                    # Test data generation
factory-boy>=3.3.0               # Model factories
freezegun>=1.2.0                 # Time mocking
responses>=0.23.0                # HTTP mocking
pytest-benchmark>=4.0.0          # Performance testing
```

---

## Summary

This comprehensive test plan provides:

1. **300+ Unit Tests** covering all service methods
2. **100+ Integration Tests** for service interactions
3. **50+ API Tests** for complete endpoint coverage
4. **15 E2E Scenarios** for critical user workflows
5. **Performance Tests** for load, stress, and optimization
6. **Frontend Integration Specs** for UI testing

**Total Test Count**: ~500 tests
**Estimated Implementation Time**: 2-3 weeks
**Expected Coverage**: >85% overall, >90% critical paths

This plan ensures robust, reliable, and maintainable code for the AI Schedule Manager system.
