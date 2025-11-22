# Department Employee Assignment API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-21
**Base URL:** `http://localhost:8000` (Development) | `https://api.example.com` (Production)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [Bulk Employee Assignment](#bulk-employee-assignment)
   - [Employee Transfer Between Departments](#employee-transfer-between-departments)
4. [Request/Response Schemas](#requestresponse-schemas)
5. [Error Codes](#error-codes)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)

---

## Overview

The Department Assignment API provides endpoints for managing employee assignments to departments, including bulk operations and inter-department transfers. These endpoints are designed for efficient employee organization management with comprehensive audit trails.

### Key Features

- **Bulk Assignment**: Assign multiple employees to a department in a single operation
- **Transfer Management**: Transfer employees between departments with optional approval workflows
- **Audit Trail**: Complete history tracking of all assignment changes
- **Validation**: Automatic validation of department capacity and constraints
- **Rollback Support**: Automatic rollback on errors during bulk operations

---

## Authentication

All endpoints require authentication using JWT tokens. Include the token in the request header:

```http
Authorization: Bearer <your_jwt_token>
```

**Required Roles:**
- `manager` - Can manage assignments within their departments
- `admin` - Can manage assignments across all departments

---

## Endpoints

### Bulk Employee Assignment

Assign multiple employees to a department in a single atomic operation.

#### Endpoint

```http
POST /api/departments/{department_id}/employees/bulk-assign
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Target department ID |

#### Request Body

```json
{
  "employee_ids": [1, 2, 3, 4, 5],
  "reason": "Team reorganization Q4 2025",
  "effective_date": "2025-12-01"
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `employee_ids` | array[integer] | Yes | List of employee IDs to assign (1-100 per request) |
| `reason` | string | No | Reason for bulk assignment (max 500 chars) |
| `effective_date` | string (date) | No | When assignment becomes effective (ISO 8601 format) |

#### Response

**Success (200 OK):**

```json
{
  "success": true,
  "assigned_count": 5,
  "assignments": [
    {
      "employee_id": 1,
      "employee_name": "John Doe",
      "employee_email": "john.doe@example.com",
      "previous_department_id": 3,
      "previous_department_name": "Marketing",
      "new_department_id": 10,
      "new_department_name": "Sales",
      "assigned_at": "2025-11-21T10:30:00Z",
      "assigned_by_user_id": 5,
      "assigned_by_name": "Jane Manager"
    },
    {
      "employee_id": 2,
      "employee_name": "Alice Smith",
      "employee_email": "alice.smith@example.com",
      "previous_department_id": null,
      "previous_department_name": null,
      "new_department_id": 10,
      "new_department_name": "Sales",
      "assigned_at": "2025-11-21T10:30:00Z",
      "assigned_by_user_id": 5,
      "assigned_by_name": "Jane Manager"
    }
  ],
  "audit_log_ids": [101, 102, 103, 104, 105]
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Operation success status |
| `assigned_count` | integer | Number of successfully assigned employees |
| `assignments` | array | Detailed assignment information for each employee |
| `audit_log_ids` | array[integer] | IDs of created audit log entries |

#### Error Responses

**400 Bad Request - Invalid Department:**
```json
{
  "detail": "Department not found"
}
```

**400 Bad Request - Invalid Employee IDs:**
```json
{
  "detail": {
    "message": "Some employees not found",
    "invalid_employee_ids": [99, 100]
  }
}
```

**409 Conflict - Capacity Exceeded:**
```json
{
  "detail": {
    "message": "Department capacity exceeded",
    "current_employee_count": 45,
    "max_capacity": 50,
    "requested_assignments": 8,
    "available_slots": 5
  }
}
```

**403 Forbidden - Insufficient Permissions:**
```json
{
  "detail": "Insufficient permissions to assign employees to this department"
}
```

---

### Employee Transfer Between Departments

Transfer a single employee from one department to another with optional approval workflow.

#### Endpoint

```http
POST /api/departments/{department_id}/employees/{employee_id}/transfer
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Source department ID (current) |
| `employee_id` | integer | Yes | Employee ID to transfer |

#### Request Body

```json
{
  "to_department_id": 15,
  "reason": "Skills better suited for new department - expertise in product development",
  "requires_approval": false,
  "transfer_date": "2025-12-01",
  "notify_employee": true
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to_department_id` | integer | Yes | Target department ID |
| `reason` | string | Yes | Transfer reason (max 500 chars) |
| `requires_approval` | boolean | No | Whether transfer requires approval (default: false) |
| `transfer_date` | string (date) | No | Effective transfer date (ISO 8601) |
| `notify_employee` | boolean | No | Send notification to employee (default: true) |

#### Response

**Success (200 OK) - Immediate Transfer:**

```json
{
  "success": true,
  "transfer_id": 42,
  "employee": {
    "id": 25,
    "name": "Bob Johnson",
    "email": "bob.johnson@example.com"
  },
  "from_department": {
    "id": 10,
    "name": "Sales"
  },
  "to_department": {
    "id": 15,
    "name": "Product Development"
  },
  "status": "completed",
  "transfer_date": "2025-12-01",
  "reason": "Skills better suited for new department - expertise in product development",
  "transferred_at": "2025-11-21T10:45:00Z",
  "transferred_by_user_id": 5,
  "transferred_by_name": "Jane Manager",
  "audit_log_id": 106,
  "notification_sent": true
}
```

**Success (202 Accepted) - Pending Approval:**

```json
{
  "success": true,
  "transfer_id": 43,
  "employee": {
    "id": 26,
    "name": "Carol White",
    "email": "carol.white@example.com"
  },
  "from_department": {
    "id": 10,
    "name": "Sales"
  },
  "to_department": {
    "id": 15,
    "name": "Product Development"
  },
  "status": "pending_approval",
  "transfer_date": "2025-12-01",
  "reason": "Promotion to senior product manager role",
  "requested_at": "2025-11-21T10:45:00Z",
  "requested_by_user_id": 5,
  "requested_by_name": "Jane Manager",
  "approver_user_ids": [8, 9],
  "approval_deadline": "2025-11-28T23:59:59Z"
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Operation success status |
| `transfer_id` | integer | Unique transfer request ID |
| `employee` | object | Employee details |
| `from_department` | object | Source department details |
| `to_department` | object | Target department details |
| `status` | string | Transfer status: `completed`, `pending_approval`, `failed` |
| `transfer_date` | string | Effective transfer date |
| `reason` | string | Transfer reason |
| `audit_log_id` | integer | Audit log entry ID (if completed) |
| `notification_sent` | boolean | Whether employee was notified |

#### Error Responses

**404 Not Found - Employee:**
```json
{
  "detail": "Employee not found"
}
```

**404 Not Found - Department:**
```json
{
  "detail": "Target department not found"
}
```

**400 Bad Request - Already in Department:**
```json
{
  "detail": "Employee is already assigned to the target department"
}
```

**409 Conflict - Active Transfer Pending:**
```json
{
  "detail": {
    "message": "Employee has a pending transfer request",
    "pending_transfer_id": 38,
    "requested_at": "2025-11-20T14:30:00Z"
  }
}
```

**403 Forbidden - Insufficient Permissions:**
```json
{
  "detail": "Insufficient permissions to transfer employees between these departments"
}
```

---

## Request/Response Schemas

### Assignment Result Object

```typescript
interface AssignmentResult {
  employee_id: number;
  employee_name: string;
  employee_email: string;
  previous_department_id: number | null;
  previous_department_name: string | null;
  new_department_id: number;
  new_department_name: string;
  assigned_at: string;  // ISO 8601 datetime
  assigned_by_user_id: number;
  assigned_by_name: string;
}
```

### Transfer Object

```typescript
interface Transfer {
  transfer_id: number;
  employee: {
    id: number;
    name: string;
    email: string;
  };
  from_department: {
    id: number;
    name: string;
  };
  to_department: {
    id: number;
    name: string;
  };
  status: 'completed' | 'pending_approval' | 'failed';
  transfer_date: string;  // ISO 8601 date
  reason: string;
  transferred_at?: string;  // ISO 8601 datetime
  transferred_by_user_id?: number;
  transferred_by_name?: string;
  audit_log_id?: number;
  notification_sent?: boolean;
}
```

---

## Error Codes

| HTTP Code | Error Type | Description |
|-----------|------------|-------------|
| 400 | Bad Request | Invalid request data, missing required fields, or validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the requested operation |
| 404 | Not Found | Department or employee not found |
| 409 | Conflict | Resource conflict (capacity exceeded, pending transfer, etc.) |
| 422 | Unprocessable Entity | Request validation failed |
| 500 | Internal Server Error | Unexpected server error |

### Detailed Error Response Format

All error responses follow this structure:

```json
{
  "detail": "Error message or error details object"
}
```

For validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "employee_ids"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Usage Examples

### Example 1: Bulk Assign Employees (cURL)

```bash
# Bulk assign 5 employees to Sales department (ID: 10)
curl -X POST "http://localhost:8000/api/departments/10/employees/bulk-assign" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "employee_ids": [1, 2, 3, 4, 5],
    "reason": "Q4 2025 Sales team expansion",
    "effective_date": "2025-12-01"
  }'
```

### Example 2: Bulk Assign Employees (Python)

```python
import requests

# Configuration
BASE_URL = "http://localhost:8000"
token = "your_jwt_token_here"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Bulk assignment request
department_id = 10
data = {
    "employee_ids": [1, 2, 3, 4, 5],
    "reason": "Q4 2025 Sales team expansion",
    "effective_date": "2025-12-01"
}

response = requests.post(
    f"{BASE_URL}/api/departments/{department_id}/employees/bulk-assign",
    headers=headers,
    json=data
)

if response.status_code == 200:
    result = response.json()
    print(f"✓ Successfully assigned {result['assigned_count']} employees")
    for assignment in result['assignments']:
        print(f"  - {assignment['employee_name']} → {assignment['new_department_name']}")
else:
    print(f"✗ Error: {response.status_code}")
    print(response.json())
```

### Example 3: Bulk Assign Employees (JavaScript/TypeScript)

```typescript
// Using fetch API
const BASE_URL = "http://localhost:8000";
const token = "your_jwt_token_here";

async function bulkAssignEmployees(
  departmentId: number,
  employeeIds: number[],
  reason?: string
) {
  const response = await fetch(
    `${BASE_URL}/api/departments/${departmentId}/employees/bulk-assign`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        employee_ids: employeeIds,
        reason: reason || "Organizational restructuring",
        effective_date: "2025-12-01",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Bulk assignment failed: ${error.detail}`);
  }

  return await response.json();
}

// Usage
try {
  const result = await bulkAssignEmployees(10, [1, 2, 3, 4, 5], "Team expansion");
  console.log(`✓ Assigned ${result.assigned_count} employees`);
  result.assignments.forEach((a) => {
    console.log(`  - ${a.employee_name} → ${a.new_department_name}`);
  });
} catch (error) {
  console.error("✗ Error:", error.message);
}
```

### Example 4: Transfer Employee (cURL)

```bash
# Transfer employee from Sales (ID: 10) to Product Development (ID: 15)
curl -X POST "http://localhost:8000/api/departments/10/employees/25/transfer" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "to_department_id": 15,
    "reason": "Promotion to Product Manager role",
    "requires_approval": true,
    "transfer_date": "2025-12-15",
    "notify_employee": true
  }'
```

### Example 5: Transfer Employee (Python)

```python
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
token = "your_jwt_token_here"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Transfer employee
from_department_id = 10
employee_id = 25
transfer_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

data = {
    "to_department_id": 15,
    "reason": "Promotion to Product Manager role",
    "requires_approval": True,
    "transfer_date": transfer_date,
    "notify_employee": True
}

response = requests.post(
    f"{BASE_URL}/api/departments/{from_department_id}/employees/{employee_id}/transfer",
    headers=headers,
    json=data
)

if response.status_code in [200, 202]:
    result = response.json()
    status = "✓ Completed" if result['status'] == 'completed' else "⏳ Pending Approval"
    print(f"{status}: {result['employee']['name']} → {result['to_department']['name']}")
    print(f"Transfer Date: {result['transfer_date']}")
    print(f"Transfer ID: {result['transfer_id']}")
else:
    print(f"✗ Error: {response.status_code}")
    print(response.json())
```

### Example 6: Transfer Employee (JavaScript/TypeScript)

```typescript
interface TransferRequest {
  to_department_id: number;
  reason: string;
  requires_approval?: boolean;
  transfer_date?: string;
  notify_employee?: boolean;
}

async function transferEmployee(
  fromDepartmentId: number,
  employeeId: number,
  request: TransferRequest
) {
  const response = await fetch(
    `${BASE_URL}/api/departments/${fromDepartmentId}/employees/${employeeId}/transfer`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Transfer failed: ${error.detail}`);
  }

  return await response.json();
}

// Usage
try {
  const result = await transferEmployee(10, 25, {
    to_department_id: 15,
    reason: "Promotion to Product Manager role",
    requires_approval: true,
    transfer_date: "2025-12-15",
    notify_employee: true,
  });

  if (result.status === "completed") {
    console.log(`✓ Transfer completed: ${result.employee.name} → ${result.to_department.name}`);
  } else {
    console.log(`⏳ Transfer pending approval (ID: ${result.transfer_id})`);
  }
} catch (error) {
  console.error("✗ Error:", error.message);
}
```

---

## Best Practices

### 1. Batch Size Limits

For bulk assignments, limit batch size to 100 employees per request to avoid timeout issues:

```python
# Good: Process in batches
def assign_employees_in_batches(department_id, employee_ids, batch_size=50):
    results = []
    for i in range(0, len(employee_ids), batch_size):
        batch = employee_ids[i:i + batch_size]
        result = bulk_assign(department_id, batch)
        results.append(result)
    return results

# Avoid: Single large batch
# bulk_assign(department_id, [1, 2, ..., 500])  # Too large!
```

### 2. Error Handling

Always implement proper error handling and rollback logic:

```python
try:
    result = bulk_assign(dept_id, employee_ids)
    log_success(result)
except requests.HTTPError as e:
    if e.response.status_code == 409:
        # Handle capacity exceeded
        handle_capacity_error(e.response.json())
    elif e.response.status_code == 400:
        # Handle validation errors
        handle_validation_error(e.response.json())
    else:
        # Handle other errors
        log_error(e)
        raise
```

### 3. Audit Trail

Always provide meaningful reasons for assignments and transfers:

```python
# Good: Descriptive reason
data = {
    "employee_ids": [1, 2, 3],
    "reason": "Q4 2025 organizational restructuring - aligning with new product strategy"
}

# Avoid: Generic or missing reason
data = {
    "employee_ids": [1, 2, 3],
    "reason": "Update"  # Too vague
}
```

### 4. Notifications

Consider the impact of bulk operations on notification systems:

```python
# For bulk operations, consider batching notifications
data = {
    "employee_ids": [1, 2, 3, 4, 5],
    "reason": "Team reorganization",
    "notify_employees": True,  # Sends batch notification
    "notification_template": "bulk_assignment"  # Use appropriate template
}
```

### 5. Validation Before Transfer

Always validate transfers before executing:

```python
# Validate employee exists and is in source department
employee = get_employee(employee_id)
if employee.department_id != from_department_id:
    raise ValueError("Employee not in source department")

# Validate target department capacity
target_dept = get_department(to_department_id)
if target_dept.is_at_capacity:
    raise ValueError("Target department at capacity")

# Then execute transfer
result = transfer_employee(from_department_id, employee_id, to_department_id)
```

---

## Related Documentation

- [Department Schedule Management API](./department-schedule-api.md)
- [Department Analytics API](./API_REFERENCE.md#department-analytics)
- [Employee Management API](./API_REFERENCE.md#employee-management)
- [Authentication Guide](./AUTHENTICATION.md)

---

**Last Updated:** 2025-11-21
**API Version:** 1.0.0
**Maintained By:** AI Schedule Manager Development Team
