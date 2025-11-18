# API Endpoints Architecture

## Overview
RESTful API design with complete CRUD operations, pagination, filtering, and comprehensive error handling.

## Base Configuration
- **Base URL**: `/api`
- **Protocol**: HTTPS in production
- **Authentication**: JWT Bearer tokens
- **Content-Type**: `application/json`
- **Versioning**: URL-based (future: `/api/v2/`)

## Authentication & Authorization

### Auth Endpoints

#### POST /api/auth/register
Register new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "employee"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee"
  },
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

**Errors:**
- `400`: Invalid input, password too weak, email format invalid
- `409`: Email already registered

#### POST /api/auth/login
Authenticate user and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee"
  }
}
```

**Errors:**
- `401`: Invalid credentials
- `403`: Account deactivated

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Headers:**
```
Cookie: refresh_token=eyJhbGc...
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGc..."
}
```

#### POST /api/auth/logout
Revoke tokens and end session.

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

#### GET /api/auth/me
Get current authenticated user information.

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "employee",
  "department": {
    "id": 2,
    "name": "Customer Service"
  }
}
```

## Employees Endpoints

### GET /api/employees
Get paginated list of employees with filtering.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `size` (integer, default: 10, max: 100): Items per page
- `role` (string): Filter by role
- `active` (boolean): Filter by active status
- `search` (string): Search by name or email
- `sort_by` (string, default: "name"): Sort field
- `sort_order` (string, default: "asc"): Sort direction (asc/desc)

**Example:** `/api/employees?page=1&size=20&role=employee&active=true&search=john`

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "employee",
      "departmentId": 2,
      "qualifications": ["certified", "customer_service"],
      "availability": {...},
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

### POST /api/employees
Create new employee (Manager/Admin only).

**Request:**
```json
{
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "role": "employee",
  "departmentId": 2,
  "qualifications": ["certified"],
  "availability": {
    "monday": {
      "available": true,
      "timeSlots": [{"start": "09:00", "end": "17:00"}]
    }
  }
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "role": "employee",
  "departmentId": 2,
  "isActive": true
}
```

**Errors:**
- `400`: Email already exists
- `403`: Insufficient permissions
- `422`: Validation error

### GET /api/employees/:id
Get specific employee details.

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "john.doe@example.com",
  "name": "John Doe",
  "role": "employee",
  "department": {
    "id": 2,
    "name": "Customer Service"
  },
  "qualifications": ["certified", "supervisor"],
  "availability": {...},
  "isActive": true
}
```

**Errors:**
- `404`: Employee not found

### PATCH /api/employees/:id
Update employee information (Manager/Admin only).

**Request:**
```json
{
  "name": "John R. Doe",
  "qualifications": ["certified", "supervisor", "trainer"],
  "availability": {...}
}
```

**Response:** `200 OK` (updated employee object)

**Errors:**
- `403`: Insufficient permissions
- `404`: Employee not found
- `409`: Email conflict

### DELETE /api/employees/:id
Delete employee (soft delete - Manager/Admin only).

**Response:** `200 OK`
```json
{
  "message": "Employee deleted successfully"
}
```

## Schedules Endpoints

### GET /api/schedules
Get paginated schedules with filtering.

**Query Parameters:**
- `page`, `size`, `sort_by`, `sort_order`: Pagination
- `employee_id` (integer): Filter by assigned employee
- `shift_id` (integer): Filter by shift
- `date_from` (date): Start date filter
- `date_to` (date): End date filter
- `status` (string): Filter by schedule status

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "weekStart": "2025-01-20",
      "weekEnd": "2025-01-26",
      "status": "published",
      "title": "Week 3 Schedule",
      "createdBy": 5,
      "assignments": [...]
    }
  ],
  "total": 12,
  "page": 1,
  "size": 10,
  "pages": 2
}
```

### POST /api/schedules
Create new schedule (Manager/Admin only).

**Request:**
```json
{
  "weekStart": "2025-01-27",
  "weekEnd": "2025-02-02",
  "title": "Week 4 Schedule",
  "description": "Regular weekly schedule",
  "status": "draft"
}
```

**Response:** `201 Created`

### GET /api/schedules/:id
Get specific schedule with assignments.

**Response:** `200 OK`
```json
{
  "id": 1,
  "weekStart": "2025-01-20",
  "weekEnd": "2025-01-26",
  "status": "published",
  "title": "Week 3 Schedule",
  "assignments": [
    {
      "id": 1,
      "employeeId": 2,
      "shiftId": 15,
      "status": "confirmed",
      "employee": {...},
      "shift": {...}
    }
  ],
  "coverage": {
    "totalShifts": 35,
    "assignedShifts": 35,
    "coveragePercentage": 100
  }
}
```

### PATCH /api/schedules/:id
Update schedule (Manager/Admin only).

**Request:**
```json
{
  "status": "pending_approval",
  "notes": "Ready for review"
}
```

**Response:** `200 OK`

### DELETE /api/schedules/:id
Delete schedule (Manager/Admin only).

**Response:** `200 OK`

### POST /api/schedules/:id/assignments
Create assignment in schedule.

**Request:**
```json
{
  "employeeId": 2,
  "shiftId": 15,
  "status": "assigned",
  "priority": 3,
  "notes": "Requested by employee"
}
```

**Response:** `201 Created`
```json
{
  "id": 100,
  "scheduleId": 1,
  "employeeId": 2,
  "shiftId": 15,
  "status": "assigned",
  "conflictsResolved": true,
  "conflicts": []
}
```

**Errors:**
- `409`: Assignment conflict (overlapping shifts, unavailable employee)
- `400`: Employee not qualified for shift type

## Shifts Endpoints

### GET /api/shifts
Get shifts with filtering.

**Query Parameters:**
- `date_from`, `date_to`: Date range
- `department_id`: Filter by department
- `shift_type`: Filter by shift type
- `status`: Filter by staffing status (understaffed/fully_staffed)

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 15,
      "date": "2025-01-22",
      "startTime": "09:00:00",
      "endTime": "17:00:00",
      "shiftType": "general",
      "departmentId": 2,
      "requiredStaff": 3,
      "requirements": {
        "qualifications": ["certified"]
      },
      "assignedCount": 2,
      "needsMoreStaff": 1,
      "isFullyStaffed": false
    }
  ],
  "total": 35,
  "page": 1,
  "size": 20,
  "pages": 2
}
```

### POST /api/shifts
Create new shift (Manager/Admin only).

**Request:**
```json
{
  "date": "2025-01-28",
  "startTime": "09:00",
  "endTime": "17:00",
  "shiftType": "general",
  "departmentId": 2,
  "requiredStaff": 2,
  "requirements": {
    "qualifications": ["certified"]
  },
  "priority": 5
}
```

**Response:** `201 Created`

### GET /api/shifts/:id
Get shift details with assignments.

### PATCH /api/shifts/:id
Update shift details.

### DELETE /api/shifts/:id
Delete shift.

## Departments Endpoints

### GET /api/departments
Get all departments with hierarchy.

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": 1,
      "name": "Operations",
      "description": "Main operations department",
      "parentId": null,
      "active": true,
      "children": [
        {
          "id": 2,
          "name": "Customer Service",
          "parentId": 1
        }
      ]
    }
  ]
}
```

### POST /api/departments
Create new department.

### GET /api/departments/:id/shifts
Get shift requirements for department.

**Query Parameters:**
- `start_date`: Start date for requirements
- `end_date`: End date for requirements

**Response:** `200 OK`
```json
{
  "requirements": [
    {
      "date": "2025-01-27",
      "shifts": [
        {
          "startTime": "09:00",
          "endTime": "17:00",
          "requiredStaff": 3,
          "shiftType": "general"
        }
      ]
    }
  ]
}
```

## Schedule Generation & Validation

### POST /api/schedule/generate
Generate optimized schedule using constraint solver.

**Request:**
```json
{
  "startDate": "2025-01-27",
  "endDate": "2025-02-02",
  "departmentId": 2,
  "constraints": {
    "maxHoursPerWeek": 40,
    "minRestHours": 12,
    "preferredAssignments": true
  }
}
```

**Response:** `200 OK`
```json
{
  "status": "optimal",
  "schedule": [...],
  "savedAssignments": 35,
  "conflicts": [],
  "statistics": {
    "totalShifts": 35,
    "assignedShifts": 35,
    "coveragePercentage": 100,
    "averageHoursPerEmployee": 32.5
  },
  "message": "Schedule generated successfully"
}
```

### POST /api/schedule/validate
Validate schedule for conflicts.

**Request:**
```json
{
  "schedule": {...},
  "department": 2,
  "dateRange": {
    "start": "2025-01-27",
    "end": "2025-02-02"
  }
}
```

**Response:** `200 OK`
```json
{
  "conflicts": [],
  "violations": [],
  "validationPassed": true
}
```

### POST /api/schedule/optimize
Optimize existing schedule.

**Request:**
```json
{
  "scheduleIds": [1, 2, 3]
}
```

**Response:** `200 OK`
```json
{
  "status": "optimal",
  "improvements": {
    "reducedOvertime": 5,
    "improvedCoverage": 3,
    "balancedWorkload": true
  }
}
```

## Notifications Endpoints

### GET /api/notifications
Get user notifications.

**Query Parameters:**
- `read` (boolean): Filter by read status
- `notification_type`: Filter by type
- `priority`: Filter by priority

**Response:** `200 OK`

### PATCH /api/notifications/:id/read
Mark notification as read.

### DELETE /api/notifications/:id
Delete notification.

### POST /api/notifications/mark-all-read
Mark all notifications as read.

## Rules Endpoints

### GET /api/rules
Get scheduling rules.

### POST /api/rules/parse
Parse natural language rule.

**Request:**
```json
{
  "ruleText": "John cannot work on Mondays"
}
```

**Response:** `201 Created`
```json
{
  "id": 10,
  "ruleType": "blocked_shift",
  "employeeId": 1,
  "constraints": {
    "days": ["monday"]
  },
  "originalText": "John cannot work on Mondays"
}
```

## Data Import/Export

### POST /api/data/import
Import schedules from CSV/Excel.

**Request:** `multipart/form-data`
```
file: schedule.xlsx
format: "excel"
```

**Response:** `200 OK`
```json
{
  "shiftsCreated": 35,
  "errors": [],
  "warnings": []
}
```

### GET /api/data/export
Export schedule data.

**Query Parameters:**
- `format`: "csv", "excel", "pdf", "ical"
- `scheduleId`: Schedule to export
- `dateRange`: Date range for export

**Response:** File download

## Error Responses

### Standard Error Format
```json
{
  "error": "Resource not found",
  "message": "Employee with ID 999 does not exist",
  "statusCode": 404,
  "timestamp": "2025-01-18T10:30:00Z",
  "path": "/api/employees/999"
}
```

### HTTP Status Codes
- `200 OK`: Successful GET, PATCH
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (duplicate, constraint violation)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Validation Error Format
```json
{
  "error": "Validation failed",
  "statusCode": 422,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

## Rate Limiting
- **Anonymous requests**: 100 requests/hour
- **Authenticated requests**: 1000 requests/hour
- **Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Pagination
All list endpoints support pagination with consistent format:
- Query params: `page`, `size`, `sort_by`, `sort_order`
- Response includes: `items`, `total`, `page`, `size`, `pages`
- Maximum page size: 100
