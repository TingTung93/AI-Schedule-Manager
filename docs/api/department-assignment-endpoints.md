# Department Assignment API Endpoints

## Overview

The Department Assignment API provides endpoints for managing employee assignments to departments, including bulk assignment and transfer operations with complete audit trail.

## Features

- Bulk assign multiple employees to a department in a single transaction
- Transfer employees between departments with optional approval workflow
- Complete audit trail via DepartmentAssignmentHistory records
- Automatic cache invalidation
- Transactional integrity with rollback on errors
- Manager/admin permission required

## Endpoints

### POST /api/departments/{department_id}/employees/bulk-assign

Bulk assign multiple employees to a department.

**Path Parameters:**
- `department_id` (integer, required): Target department ID

**Request Body:**
```json
{
  "employee_ids": [1, 2, 3, 4, 5],
  "reason": "Team reorganization",
  "effective_date": "2025-12-01"
}
```

**Request Schema (BulkAssignRequest):**
- `employee_ids` (array[integer], required): List of employee IDs to assign (minimum 1)
- `reason` (string, optional): Reason for bulk assignment (max 500 characters)
- `effective_date` (date, optional): Effective date of assignment (informational)

**Response (201 Created):**
```json
{
  "success": true,
  "assigned_count": 5,
  "assignments": [
    {
      "employee_id": 1,
      "employee_name": "John Doe",
      "previous_department_id": null,
      "previous_department_name": null,
      "new_department_id": 10,
      "new_department_name": "Sales",
      "assigned_at": "2025-11-21T10:30:00Z",
      "history_id": 123
    },
    {
      "employee_id": 2,
      "employee_name": "Jane Smith",
      "previous_department_id": 5,
      "previous_department_name": "Marketing",
      "new_department_id": 10,
      "new_department_name": "Sales",
      "assigned_at": "2025-11-21T10:30:00Z",
      "history_id": 124
    }
  ],
  "errors": []
}
```

**Response Schema (AssignmentResponse):**
- `success` (boolean): Whether all assignments succeeded
- `assigned_count` (integer): Number of successful assignments
- `assignments` (array): List of assignment details
  - `employee_id` (integer): Employee ID
  - `employee_name` (string): Employee full name
  - `previous_department_id` (integer, nullable): Previous department ID
  - `previous_department_name` (string, nullable): Previous department name
  - `new_department_id` (integer): New department ID
  - `new_department_name` (string): New department name
  - `assigned_at` (datetime): Assignment timestamp
  - `history_id` (integer): Assignment history record ID
- `errors` (array[string]): List of errors for failed assignments

**Error Responses:**
- `404 Not Found`: Department not found
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions (manager/admin required)

**Notes:**
- All assignments are processed in a transaction
- If any assignment fails, partial success is reported
- DepartmentAssignmentHistory records are created for each assignment
- Caches are invalidated for the target department

---

### POST /api/departments/{department_id}/employees/{employee_id}/transfer

Transfer employee from current department to another department.

**Path Parameters:**
- `department_id` (integer, required): Source department ID
- `employee_id` (integer, required): Employee ID to transfer

**Request Body:**
```json
{
  "to_department_id": 15,
  "reason": "Skills better suited for new department",
  "requires_approval": false
}
```

**Request Schema (TransferRequest):**
- `to_department_id` (integer, required): Target department ID
- `reason` (string, optional): Reason for transfer (max 500 characters)
- `requires_approval` (boolean, optional): Whether transfer requires approval (default: false)

**Response (201 Created):**
```json
{
  "success": true,
  "employee_id": 25,
  "employee_name": "Alice Johnson",
  "from_department_id": 10,
  "from_department_name": "Sales",
  "to_department_id": 15,
  "to_department_name": "Customer Success",
  "transferred_at": "2025-11-21T14:45:00Z",
  "requires_approval": false,
  "history_id": 125
}
```

**Response Schema (TransferResponse):**
- `success` (boolean): Whether transfer succeeded
- `employee_id` (integer): Employee ID
- `employee_name` (string): Employee full name
- `from_department_id` (integer, nullable): Source department ID
- `from_department_name` (string, nullable): Source department name
- `to_department_id` (integer): Target department ID
- `to_department_name` (string): Target department name
- `transferred_at` (datetime): Transfer timestamp
- `requires_approval` (boolean): Approval requirement flag
- `history_id` (integer): Assignment history record ID

**Error Responses:**
- `404 Not Found`: Source department or employee not found
- `400 Bad Request`:
  - Target department not found
  - Employee is not in source department
  - Validation errors
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions (manager/admin required)

**Notes:**
- Transfer is atomic - rolls back on any error
- DepartmentAssignmentHistory record is created
- Caches are invalidated for both source and target departments
- Employee cache is invalidated

---

## Implementation Details

### Database Schema

**DepartmentAssignmentHistory Table:**
```sql
CREATE TABLE department_assignment_history (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    to_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    changed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT,
    change_metadata JSONB,
    CONSTRAINT assignment_history_check CHECK (
        from_department_id IS NOT NULL OR to_department_id IS NOT NULL
    )
);

CREATE INDEX idx_assignment_history_employee ON department_assignment_history(employee_id);
CREATE INDEX idx_assignment_history_changed_by ON department_assignment_history(changed_by_user_id);
CREATE INDEX idx_assignment_history_changed_at ON department_assignment_history(changed_at);
```

### CRUD Operations

**bulk_assign_employees()**
- Located in: `backend/src/services/crud_department_assignment.py`
- Transaction support: Yes
- Rollback on error: Partial success allowed
- Cache invalidation: Department cache
- Audit trail: DepartmentAssignmentHistory records

**transfer_employee()**
- Located in: `backend/src/services/crud_department_assignment.py`
- Transaction support: Yes
- Rollback on error: Full rollback
- Cache invalidation: Both departments + employee cache
- Audit trail: DepartmentAssignmentHistory record

### Schemas

**Location:** `backend/src/schemas_department_assignment.py`

All schemas use Pydantic v2 with:
- Field validation
- Type hints
- Comprehensive descriptions
- ConfigDict for ORM compatibility

### Security

**Authentication:**
- JWT token required in Authorization header
- Format: `Bearer <token>`

**Authorization:**
- Both endpoints require manager or admin role
- Enforced via `get_current_manager` dependency

**Audit Trail:**
- All assignment changes recorded in DepartmentAssignmentHistory
- Includes: who made the change, when, why, and metadata
- Cannot be deleted (audit log is permanent)

### Performance

**Caching:**
- Redis-backed caching via cache_manager
- Automatic invalidation after assignments
- Cache keys: `department:{id}`, `employee:{id}`, `email:{email}`

**Database:**
- Efficient queries with proper indexing
- Transaction batching for bulk operations
- Optimized joins for department name lookups

**Concurrency:**
- Database-level row locking
- Transaction isolation prevents race conditions
- Safe for concurrent assignment operations

## Usage Examples

### Example 1: Bulk Assign New Hires

```bash
curl -X POST "http://localhost:8000/api/departments/10/employees/bulk-assign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_ids": [101, 102, 103, 104, 105],
    "reason": "New hire onboarding - Week 1 cohort",
    "effective_date": "2025-12-01"
  }'
```

### Example 2: Transfer Employee for Promotion

```bash
curl -X POST "http://localhost:8000/api/departments/5/employees/25/transfer" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "to_department_id": 15,
    "reason": "Promotion to Senior Sales Manager",
    "requires_approval": true
  }'
```

### Example 3: Reassign Team During Reorganization

```bash
curl -X POST "http://localhost:8000/api/departments/20/employees/bulk-assign" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_ids": [30, 31, 32, 33, 34, 35],
    "reason": "Q4 2025 department reorganization - consolidating teams",
    "effective_date": "2025-10-01"
  }'
```

## Error Handling

### Partial Success in Bulk Assignment

If some employees in a bulk assignment fail, the operation continues:

```json
{
  "success": false,
  "assigned_count": 3,
  "assignments": [
    {"employee_id": 1, ...},
    {"employee_id": 2, ...},
    {"employee_id": 3, ...}
  ],
  "errors": [
    "Employee 4 not found",
    "Employee 5: Validation error"
  ]
}
```

### Transfer Validation Errors

```json
{
  "detail": "Employee 25 is not in department 10"
}
```

## Testing

### Unit Tests

Located in: `backend/tests/test_department_assignment.py`

Tests include:
- Bulk assignment success
- Bulk assignment partial failure
- Transfer between departments
- Transfer validation errors
- Audit trail creation
- Cache invalidation
- Permission checks

### Integration Tests

Located in: `backend/tests/test_department_assignment_integration.py`

Tests include:
- End-to-end bulk assignment flow
- End-to-end transfer flow
- Database transaction integrity
- Concurrent assignment operations
- Cache consistency

## Related Documentation

- [Department Schedule Management](../features/department-schedule-management.md)
- [Department Analytics API](./department-analytics-api.md)
- [Department History API](./department-history-api.md)
- [Authentication API](../../docs/auth-api.md)
