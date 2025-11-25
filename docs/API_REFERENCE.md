# API Reference

## Overview

The AI Schedule Manager API provides comprehensive REST endpoints for employee management, scheduling, role-based access control, and audit logging. All endpoints require JWT authentication unless otherwise specified.

**Base URL**: `http://localhost:8000` (development) or your production domain

**API Version**: 1.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Employees](#employees)
3. [Departments](#departments)
4. [Password Management](#password-management)
5. [Role Management](#role-management)
6. [Account Status](#account-status)
7. [Audit Trails](#audit-trails)
8. [Schedules](#schedules)
9. [Rules](#rules)
10. [Notifications](#notifications)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)

---

## Authentication

All API requests (except login/register) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### POST /api/auth/register

Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response** (201 Created):
```json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Errors**:
- `409 Conflict`: Email already exists
- `422 Validation Error`: Invalid input data

---

### POST /api/auth/login

Authenticate user and receive access/refresh tokens.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  }
}
```

**Errors**:
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account locked or inactive
- `429 Too Many Requests`: Rate limit exceeded

**Rate Limit**: 5 requests per minute per IP

---

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Errors**:
- `401 Unauthorized`: Invalid or expired refresh token
- `403 Forbidden`: Token revoked

---

### POST /api/auth/logout

Revoke refresh token and logout.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response** (200 OK):
```json
{
  "message": "Successfully logged out"
}
```

---

## Employees

### GET /api/employees

Retrieve employees with search, filtering, sorting, and pagination.

**Authorization**:
- **Admin/Manager**: View all employees
- **Employee**: View own profile only

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by first name, last name, or email (case-insensitive) |
| `department_id` | integer | No | Filter by department ID |
| `role` | string | No | Filter by role (`admin`, `manager`, `user`, `guest`) |
| `is_active` | boolean | No | Filter by active status |
| `sort_by` | string | No | Sort field (`first_name`, `last_name`, `email`, `hire_date`, `role`) |
| `sort_order` | string | No | Sort order (`asc`, `desc`) - default: `asc` |
| `skip` | integer | No | Pagination offset (default: 0) |
| `limit` | integer | No | Results per page (max: 1000, default: 100) |

**Example Request**:
```
GET /api/employees?search=john&department_id=5&role=manager&is_active=true&sort_by=last_name&sort_order=asc&skip=0&limit=50
```

**Response** (200 OK):
```json
{
  "employees": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "role": "manager",
      "department_id": 5,
      "department": {
        "id": 5,
        "name": "Engineering",
        "parent_id": 1
      },
      "is_active": true,
      "is_locked": false,
      "is_verified": true,
      "qualifications": ["First Aid", "Food Safety"],
      "availability": {
        "monday": {"available": true, "start": "09:00", "end": "17:00"},
        "tuesday": {"available": true, "start": "09:00", "end": "17:00"}
      },
      "hourly_rate": 25.50,
      "max_hours_per_week": 40,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "skip": 0,
  "limit": 50
}
```

**Errors**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `422 Validation Error`: Invalid query parameters
- `500 Internal Server Error`: Server error

---

### GET /api/employees/{employee_id}

Get a specific employee by ID.

**Authorization**:
- **Admin/Manager**: View any employee
- **Employee**: View own profile only

**Path Parameters**:
- `employee_id` (integer): Unique employee identifier

**Example Request**:
```
GET /api/employees/1
```

**Response** (200 OK):
```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "role": "manager",
  "department_id": 5,
  "department": {
    "id": 5,
    "name": "Engineering",
    "description": "Software Engineering Department",
    "parent_id": 1,
    "active": true
  },
  "is_active": true,
  "is_locked": false,
  "is_verified": true,
  "qualifications": ["First Aid", "Food Safety", "Management"],
  "availability": {
    "monday": {"available": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"available": true, "start": "09:00", "end": "17:00"},
    "wednesday": {"available": true, "start": "09:00", "end": "17:00"},
    "thursday": {"available": true, "start": "09:00", "end": "17:00"},
    "friday": {"available": true, "start": "09:00", "end": "15:00"}
  },
  "hourly_rate": 25.50,
  "max_hours_per_week": 40,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Errors**:
- `403 Forbidden`: Trying to view another user's profile without permission
- `404 Not Found`: Employee not found
- `500 Internal Server Error`: Server error

---

### POST /api/employees

Create a new employee (admin/manager only).

**Authorization**: Requires `admin` or `manager` role

**Request Body** (all fields except first_name and last_name are optional):
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "department_id": 5,
  "qualifications": ["First Aid", "CPR"],
  "availability": {
    "monday": {"available": true, "start": "08:00", "end": "16:00"}
  },
  "hourly_rate": 22.00,
  "max_hours_per_week": 35
}
```

**Field Specifications**:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `first_name` | string | Yes | 1-50 chars | Employee first name |
| `last_name` | string | Yes | 1-50 chars | Employee last name |
| `email` | string | No | Valid email format, unique | Auto-generated if not provided |
| `department_id` | integer | No | Must exist and be active | Department assignment |
| `qualifications` | array[string] | No | Max 20 items, each 1-100 chars | Employee qualifications/certifications |
| `availability` | object | No | Valid day/time structure | Weekly availability schedule |
| `hourly_rate` | decimal | No | 0.00-1000.00 | Hourly pay rate |
| `max_hours_per_week` | integer | No | 1-168 | Maximum weekly hours |

**Response** (201 Created):
```json
{
  "id": 42,
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "role": "user",
  "department_id": 5,
  "department": {
    "id": 5,
    "name": "Engineering"
  },
  "is_active": true,
  "qualifications": ["First Aid", "CPR"],
  "availability": {
    "monday": {"available": true, "start": "08:00", "end": "16:00"}
  },
  "hourly_rate": 22.00,
  "max_hours_per_week": 35,
  "created_at": "2025-01-15T12:00:00Z"
}
```

**Default Values**:
- Password: `Employee123!` (user must change on first login)
- Role: `user`
- Active: `true`
- Email: Auto-generated as `first.last.{random}@temp.example.com` if not provided

**Errors**:
- `400 Bad Request`: Invalid department (inactive)
- `404 Not Found`: Department not found
- `409 Conflict`: Email already exists
- `422 Validation Error`: Invalid field values
- `429 Too Many Requests`: Rate limit exceeded (10/minute)
- `500 Internal Server Error`: Server error

---

### PATCH /api/employees/{employee_id}

Update an existing employee (supports partial updates).

**Authorization**:
- **Admin/Manager**: Update any employee
- **Employee**: Update own profile only (except role)
- **Admin only**: Can change user roles

**Path Parameters**:
- `employee_id` (integer): Employee to update

**Request Body** (all fields optional):
```json
{
  "first_name": "Jane",
  "last_name": "Doe-Smith",
  "email": "jane.doesmith@example.com",
  "department_id": 7,
  "active": true,
  "role": "manager",
  "qualifications": ["First Aid", "CPR", "Food Safety"],
  "availability": {
    "monday": {"available": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"available": true, "start": "09:00", "end": "17:00"},
    "friday": {"available": false}
  },
  "hourly_rate": 28.00,
  "max_hours_per_week": 40
}
```

**Response** (200 OK):
```json
{
  "id": 42,
  "first_name": "Jane",
  "last_name": "Doe-Smith",
  "email": "jane.doesmith@example.com",
  "role": "manager",
  "department_id": 7,
  "is_active": true,
  "qualifications": ["First Aid", "CPR", "Food Safety"],
  "availability": {
    "monday": {"available": true, "start": "09:00", "end": "17:00"},
    "tuesday": {"available": true, "start": "09:00", "end": "17:00"},
    "friday": {"available": false}
  },
  "hourly_rate": 28.00,
  "max_hours_per_week": 40,
  "updated_at": "2025-01-15T14:30:00Z"
}
```

**Automatic Audit Logging**:
- Department changes automatically logged to `department_assignment_history`
- Role changes automatically logged to `role_change_history`

**Errors**:
- `400 Bad Request`: Invalid department (inactive)
- `403 Forbidden`: Insufficient permissions or attempting to change own role
- `404 Not Found`: Employee or department not found
- `409 Conflict`: Email already exists
- `422 Validation Error`: Invalid field values
- `429 Too Many Requests`: Rate limit exceeded (10/minute)

---

### DELETE /api/employees/{employee_id}

Delete an employee (admin only).

**Authorization**: Requires `admin` role

**Path Parameters**:
- `employee_id` (integer): Employee to delete

**Response** (204 No Content):
```
No content returned on successful deletion
```

**Note**: Audit trail records are preserved with CASCADE on `employee_id` foreign key.

**Errors**:
- `404 Not Found`: Employee not found
- `500 Internal Server Error`: Server error

---

## Departments

### GET /api/departments

List all departments with hierarchical structure.

**Query Parameters**:
- `active` (boolean, optional): Filter by active status

**Response** (200 OK):
```json
{
  "departments": [
    {
      "id": 1,
      "name": "Corporate",
      "description": "Corporate Headquarters",
      "parent_id": null,
      "active": true,
      "children": [
        {
          "id": 5,
          "name": "Engineering",
          "parent_id": 1,
          "active": true
        }
      ],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## Password Management

### POST /api/employees/{employee_id}/reset-password

Reset employee password (admin only). Generates secure random password.

**Authorization**: Requires `admin` role

**Path Parameters**:
- `employee_id` (integer): Employee to reset password for

**Request Body**:
```json
{
  "send_email": false
}
```

**Response** (200 OK):
```json
{
  "message": "Password successfully reset. Employee must change password on next login.",
  "temporary_password": "aB3$kL9mP2@qR",
  "password_must_change": true,
  "employee_id": 42,
  "employee_email": "jane.smith@example.com"
}
```

**Security Notes**:
- Temporary password shown only once in response
- Account flagged to require password change on next login
- Password change tracked in `password_history` table
- Generated passwords meet complexity requirements (12+ chars, uppercase, lowercase, digit, special)

**Errors**:
- `404 Not Found`: Employee not found
- `429 Too Many Requests`: Rate limit exceeded (5/minute)
- `500 Internal Server Error`: Server error

---

### PATCH /api/employees/{employee_id}/change-password

Change employee password.

**Authorization**:
- **Employee**: Can change own password (requires old password)
- **Admin**: Can change any employee's password (old password optional)

**Path Parameters**:
- `employee_id` (integer): Employee to change password for

**Request Body**:
```json
{
  "old_password": "currentPassword123!",
  "new_password": "NewSecurePassword456!",
  "confirm_password": "NewSecurePassword456!"
}
```

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character
- Cannot be one of last 5 passwords

**Response** (200 OK):
```json
{
  "message": "Password successfully changed.",
  "password_changed_at": "2025-01-15T15:00:00Z",
  "employee_id": 42
}
```

**Errors**:
- `400 Bad Request`: Password validation failed or password reused
- `401 Unauthorized`: Invalid old password
- `403 Forbidden`: Access denied
- `404 Not Found`: Employee not found
- `429 Too Many Requests`: Rate limit exceeded (5/minute)
- `500 Internal Server Error`: Server error

---

## Role Management

### PATCH /api/employees/{employee_id}/role

Update employee role (admin only).

**Authorization**: Requires `admin` role

**Available Roles**:
- `admin`: Full system access
- `manager`: Department management, employee management
- `user`: Standard employee access
- `guest`: Read-only access

**Request Body**:
```json
{
  "role": "manager",
  "reason": "Promoted to team lead position"
}
```

**Response** (200 OK):
```json
{
  "id": 42,
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "role": "manager",
  "updated_at": "2025-01-15T16:00:00Z"
}
```

**Automatic Audit Logging**:
Role change automatically logged to `role_change_history` table with:
- Old role
- New role
- Changed by user ID
- Timestamp
- Reason
- Metadata (API endpoint, requester email)

**Errors**:
- `403 Forbidden`: Non-admin attempting role change
- `404 Not Found`: Employee or role not found
- `422 Validation Error`: Invalid role name

---

### GET /api/employees/{employee_id}/role-history

Get role change history for an employee.

**Authorization**:
- **Admin/Manager**: View any employee's role history
- **Employee**: View own role history

**Path Parameters**:
- `employee_id` (integer): Employee ID

**Query Parameters**:
- `skip` (integer, default: 0): Pagination offset
- `limit` (integer, default: 50, max: 500): Results per page

**Response** (200 OK):
```json
{
  "total": 3,
  "items": [
    {
      "id": 15,
      "user_id": 42,
      "user_name": "Jane Smith",
      "old_role": "user",
      "new_role": "manager",
      "changed_by_id": 1,
      "changed_by_name": "Admin User",
      "changed_at": "2025-01-15T16:00:00Z",
      "reason": "Promoted to team lead position",
      "metadata_json": {
        "action": "role_change",
        "api_endpoint": "/api/employees"
      }
    }
  ],
  "skip": 0,
  "limit": 50
}
```

**Errors**:
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Employee not found

---

## Account Status

### PATCH /api/employees/{employee_id}/status

Update employee account status (admin only).

**Authorization**: Requires `admin` role

**Restrictions**: Cannot modify own account status

**Path Parameters**:
- `employee_id` (integer): Employee to update

**Request Body**:
```json
{
  "status": "locked",
  "reason": "Multiple failed login attempts"
}
```

**Status Actions**:
- `active`: Enable account login
- `inactive`: Disable account login
- `locked`: Lock account (security measure)
- `unlocked`: Unlock account and reset failed login attempts
- `verified`: Mark account as verified
- `unverified`: Mark account as unverified

**Response** (200 OK):
```json
{
  "id": 42,
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "is_active": true,
  "is_locked": true,
  "is_verified": true,
  "updated_at": "2025-01-15T17:00:00Z"
}
```

**Automatic Audit Logging**:
Status change automatically logged to `account_status_history` table.

**Errors**:
- `400 Bad Request`: Invalid status action
- `403 Forbidden`: Attempting to modify own account or insufficient permissions
- `404 Not Found`: Employee not found
- `500 Internal Server Error`: Server error

---

### GET /api/employees/{employee_id}/status-history

Get account status change history.

**Authorization**:
- **Admin**: View any employee's status history
- **Manager**: View department employees' status history
- **Employee**: View own status history

**Path Parameters**:
- `employee_id` (integer): Employee ID

**Query Parameters**:
- `skip` (integer, default: 0): Pagination offset
- `limit` (integer, default: 50, max: 500): Results per page

**Response** (200 OK):
```json
{
  "total": 2,
  "items": [
    {
      "id": 8,
      "user_id": 42,
      "user_name": "Jane Smith",
      "old_status": "unlocked",
      "new_status": "locked",
      "changed_by_id": 1,
      "changed_by_name": "Admin User",
      "changed_at": "2025-01-15T17:00:00Z",
      "reason": "Multiple failed login attempts",
      "metadata_json": {
        "action": "status_change",
        "status_type": "locked",
        "changed_by_email": "admin@example.com"
      }
    }
  ],
  "skip": 0,
  "limit": 50
}
```

**Errors**:
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Employee not found

---

## Audit Trails

### GET /api/employees/{employee_id}/department-history

Get department assignment history for an employee.

**Path Parameters**:
- `employee_id` (integer): Employee ID

**Query Parameters**:
- `skip` (integer, default: 0): Pagination offset
- `limit` (integer, default: 50, max: 500): Results per page

**Response** (200 OK):
```json
{
  "total": 5,
  "items": [
    {
      "id": 23,
      "employee_id": 42,
      "employee_name": "Jane Smith",
      "from_department_id": 5,
      "from_department_name": "Engineering",
      "to_department_id": 7,
      "to_department_name": "Product Management",
      "changed_by_user_id": 1,
      "changed_by_name": "Admin User",
      "changed_at": "2025-01-15T14:30:00Z",
      "change_reason": "Department assignment updated via employee update API",
      "metadata": {
        "action": "update",
        "updated_fields": ["department_id", "role"]
      }
    }
  ],
  "skip": 0,
  "limit": 50
}
```

**Errors**:
- `404 Not Found`: Employee not found
- `500 Internal Server Error`: Server error

---

## Error Handling

### Standard Error Response Format

All errors follow a consistent JSON format:

```json
{
  "detail": "Error message describing what went wrong",
  "error_code": "SPECIFIC_ERROR_CODE"
}
```

### Validation Errors (422)

Field-specific validation errors provide detailed information:

```json
{
  "errors": [
    {
      "field": "email",
      "message": "Field must be at least 5 characters long.",
      "type": "string_too_short"
    },
    {
      "field": "hourly_rate",
      "message": "Value must be between 0.00 and 1000.00",
      "type": "value_error"
    }
  ]
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Deletion successful |
| 400 | Bad Request | Invalid request data or business logic error |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions or CSRF token invalid |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate email) |
| 413 | Request Entity Too Large | Request body exceeds 1MB limit |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

### Global Rate Limits

- **Per IP**: 100 requests per 15 minutes (all endpoints)

### Endpoint-Specific Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/auth/login | 5/minute |
| POST /api/auth/register | 5/minute |
| POST /api/employees | 10/minute |
| PATCH /api/employees/{id} | 10/minute |
| POST /api/employees/{id}/reset-password | 5/minute |
| PATCH /api/employees/{id}/change-password | 5/minute |

### Rate Limit Headers

Responses include rate limit information in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642276800
```

### Rate Limit Exceeded Response (429)

```json
{
  "detail": "Rate limit exceeded. Please try again later.",
  "retry_after": 60
}
```

---

## Pagination

List endpoints support pagination with the following parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `skip` | integer | 0 | - | Number of records to skip |
| `limit` | integer | 50-100 | 1000 | Maximum records to return |

**Paginated Response Format**:
```json
{
  "items": [...],
  "total": 150,
  "skip": 0,
  "limit": 50
}
```

---

## Security

### HTTPS Required (Production)

All production API requests must use HTTPS. HTTP requests are redirected to HTTPS.

### CSRF Protection

State-changing requests (POST, PUT, PATCH, DELETE) require a CSRF token:

1. Get CSRF token: `GET /api/csrf-token`
2. Include token in header: `X-CSRF-Token: <token>`

### Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production only)
- `Content-Security-Policy`

### Input Sanitization

All text inputs are automatically sanitized to prevent XSS attacks:
- HTML special characters are escaped
- Whitespace is trimmed
- Maximum length enforced

---

## Additional Resources

- **Interactive API Docs (Swagger)**: http://localhost:8000/docs
- **ReDoc Documentation**: http://localhost:8000/redoc
- **OpenAPI Specification**: http://localhost:8000/openapi.json
- **Developer Guide**: See `/docs/DEVELOPER_GUIDE.md`
- **User Guide**: See `/docs/USER_GUIDE.md`

---

*Last Updated: 2025-01-15*
