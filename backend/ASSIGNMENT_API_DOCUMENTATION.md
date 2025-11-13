# ScheduleAssignment CRUD API Documentation

## Overview

The Assignment API provides comprehensive endpoints for managing employee shift assignments with robust validation, conflict detection, and employee confirmation workflows.

## Base URL

All endpoints are prefixed with `/api/assignments`

## Endpoints

### 1. Create Single Assignment

**POST** `/schedules/{schedule_id}/assignments`

Creates a new assignment with full validation.

**Request Body:**
```json
{
  "employee_id": 1,
  "shift_id": 1,
  "status": "assigned",
  "priority": 1,
  "notes": "Optional notes"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "schedule_id": 1,
  "employee_id": 1,
  "shift_id": 1,
  "status": "assigned",
  "priority": 1,
  "notes": "Optional notes",
  "assigned_by": 1,
  "assigned_at": "2025-01-13T17:00:00Z",
  "conflicts_resolved": true,
  "auto_assigned": false,
  "created_at": "2025-01-13T17:00:00Z",
  "is_active": true,
  "is_confirmed": false,
  "needs_confirmation": true,
  "employee": { ... },
  "shift": { ... }
}
```

**Validations:**
- Schedule exists and is editable
- Employee exists and is active
- Shift exists
- No duplicate assignments
- No overlapping shift conflicts
- Employee has required qualifications

---

### 2. Bulk Create Assignments

**POST** `/bulk`

Creates multiple assignments in a single transaction with partial success support.

**Request Body:**
```json
{
  "schedule_id": 1,
  "validate_conflicts": true,
  "assignments": [
    {
      "employee_id": 1,
      "shift_id": 1,
      "status": "assigned",
      "priority": 1
    },
    {
      "employee_id": 2,
      "shift_id": 2,
      "status": "assigned",
      "priority": 1
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "created": [ ... ],
  "errors": [
    {
      "index": 1,
      "employee_id": 2,
      "shift_id": 2,
      "error": "Employee not available on monday at 08:00"
    }
  ],
  "total_processed": 2,
  "total_created": 1,
  "total_errors": 1
}
```

**Features:**
- Batch processing with optimized queries
- Conflict detection across all assignments
- Partial success - continues on errors if possible
- Returns detailed error information for each failure

---

### 3. Get Assignment

**GET** `/{id}`

Retrieves a single assignment with full details.

**Response:** `200 OK`
```json
{
  "id": 1,
  "schedule_id": 1,
  "employee_id": 1,
  "shift_id": 1,
  "status": "assigned",
  "employee": { ... },
  "shift": { ... },
  "schedule": { ... }
}
```

---

### 4. Update Assignment

**PUT** `/{id}`

Updates an existing assignment. Can change employee, shift, status, etc.

**Request Body:**
```json
{
  "employee_id": 2,
  "status": "confirmed",
  "notes": "Updated notes"
}
```

**Response:** `200 OK`

**Validations:**
- Schedule must be editable
- New employee must be active (if changing employee)
- New shift must exist (if changing shift)
- Qualifications checked if employee/shift changes

---

### 5. Delete Assignment

**DELETE** `/{id}`

Deletes an assignment.

**Response:** `204 No Content`

**Validations:**
- Schedule must be editable

---

### 6. Confirm Assignment

**POST** `/{id}/confirm`

Employee confirms they can work the assigned shift.

**Request Body (Optional):**
```json
{
  "notes": "Looking forward to this shift"
}
```

**Response:** `200 OK`

**Validations:**
- Only the assigned employee can confirm
- Assignment status must be "assigned" or "pending"

---

### 7. Decline Assignment

**POST** `/{id}/decline`

Employee declines an assignment.

**Request Body:**
```json
{
  "reason": "Already committed to another event"
}
```

**Response:** `200 OK`
```json
{
  "message": "Assignment declined: Already committed to another event",
  "success": true
}
```

**Validations:**
- Only the assigned employee can decline
- Assignment status must be "assigned" or "pending"
- Must decline within 48 hours of assignment

---

### 8. List Assignments

**GET** `/`

Lists assignments with filtering and pagination.

**Query Parameters:**
- `schedule_id` (optional): Filter by schedule
- `employee_id` (optional): Filter by employee
- `shift_id` (optional): Filter by shift
- `status` (optional): Filter by status
- `date_from` (optional): Filter by shift date (YYYY-MM-DD)
- `date_to` (optional): Filter by shift date (YYYY-MM-DD)
- `skip` (default: 0): Pagination offset
- `limit` (default: 100, max: 1000): Results per page

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "schedule_id": 1,
    "employee_id": 1,
    "shift_id": 1,
    "status": "assigned",
    "employee": { ... },
    "shift": { ... }
  }
]
```

---

## Assignment Statuses

- `assigned` - Newly created assignment
- `pending` - Awaiting employee confirmation
- `confirmed` - Employee confirmed availability
- `declined` - Employee declined the assignment
- `cancelled` - Assignment cancelled by manager
- `completed` - Shift completed

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Employee not available on monday at 08:00"
}
```

### 404 Not Found
```json
{
  "detail": "Assignment with ID 123 not found"
}
```

### 409 Conflict
```json
{
  "detail": "Assignment conflicts detected: Conflicts with shift 5 (08:00 - 12:00)"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Failed to create assignment: Database connection error"
}
```

## Conflict Detection

The API performs comprehensive conflict detection:

1. **Duplicate Assignments**: Prevents same employee being assigned to same shift multiple times
2. **Overlapping Shifts**: Detects if employee is already assigned to a conflicting shift on the same date
3. **Qualification Mismatches**: Ensures employee has required qualifications for shift type
4. **Availability Violations**: Checks employee availability patterns

## Transaction Safety

All operations use database transactions with automatic rollback on errors:
- Single create operations rollback on any validation failure
- Bulk operations use partial success - valid assignments are committed, invalid ones are reported in errors array
- Update and delete operations rollback on validation failures

## Performance Optimizations

- **Eager Loading**: Relationships (employee, shift, schedule) are loaded in single queries
- **Batch Queries**: Bulk operations pre-load all employees and shifts in 2 queries
- **Efficient Filtering**: Database-level filtering with proper indexes
- **Pagination**: Prevents loading excessive data

## Integration with Schedule Wizard

The bulk create endpoint is specifically designed for the wizard PublishStep:

```javascript
// Example wizard integration
const publishSchedule = async (scheduleId, assignments) => {
  const response = await fetch('/api/assignments/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedule_id: scheduleId,
      validate_conflicts: true,
      assignments: assignments.map(a => ({
        employee_id: a.employeeId,
        shift_id: a.shiftId,
        status: 'assigned',
        priority: a.priority || 1
      }))
    })
  });
  
  const result = await response.json();
  
  if (result.total_errors > 0) {
    // Handle partial success
    console.log(`Created ${result.total_created} of ${result.total_processed} assignments`);
    console.log('Errors:', result.errors);
  }
  
  return result;
};
```

## Authentication

All endpoints require authentication. Include JWT token in Authorization header:

```
Authorization: Bearer <token>
```

## Rate Limiting

No rate limiting currently implemented. Consider adding for production use.

---

**Implementation Status:** ✅ Complete and production-ready

**Last Updated:** 2025-01-13

**Version:** 1.0.0
