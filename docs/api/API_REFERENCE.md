# AI Schedule Manager API Reference

Complete API reference for the AI Schedule Manager backend system.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Core Endpoints](#core-endpoints)
  - [Schedules](#schedules)
  - [Employees](#employees)
  - [Shifts](#shifts)
  - [Departments](#departments)
  - [Data Import/Export](#data-importexport)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Code Examples](#code-examples)

## Overview

Base URL: `http://localhost:8000` (development) or `https://api.example.com` (production)

All endpoints return JSON responses unless otherwise specified (e.g., file exports).

All timestamps are in ISO 8601 format with UTC timezone.

## Authentication

### Register New User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ss123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201 Created):**
```json
{
  "message": "Registration successful",
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"]
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Cookies Set:**
- `access_token` (HttpOnly, 15 min expiry)
- `refresh_token` (HttpOnly, 30 days expiry)

**Error Responses:**
- `400` - Password too weak or validation failed
- `409` - Email already registered

---

### Login

Authenticate existing user.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecureP@ss123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"]
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `401` - Invalid credentials (includes remaining attempts)
- `423` - Account locked (too many failed attempts)
- `403` - Account deactivated

**Security Features:**
- Account locks for 30 minutes after 5 failed attempts
- Failed login attempts are tracked and logged

---

### Logout

Revoke tokens and clear authentication cookies.

**Endpoint:** `POST /api/auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

---

### Get Current User

Get authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>` OR Cookie: `access_token`

**Response (200 OK):**
```json
{
  "user": {
    "id": 42,
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"],
    "permissions": ["read:schedules", "write:own_profile"]
  }
}
```

---

### Refresh Token

Get new access token using refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request:** Requires `refresh_token` cookie or in request body

**Response (200 OK):**
```json
{
  "message": "Token refreshed successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Response:**
- `401` - Invalid or expired refresh token

---

## Core Endpoints

### Schedules

#### List Schedules

Get all schedules with filtering and pagination.

**Endpoint:** `GET /api/schedules`

**Query Parameters:**
- `status` (optional): Filter by status (draft, pending_approval, approved, published, archived, rejected)
- `week_start` (optional): Filter schedules starting from date (YYYY-MM-DD)
- `week_end` (optional): Filter schedules ending by date (YYYY-MM-DD)
- `skip` (default: 0): Pagination offset
- `limit` (default: 100, max: 1000): Number of results

**Example Request:**
```bash
GET /api/schedules?status=published&skip=0&limit=20
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "weekStart": "2025-01-13",
    "weekEnd": "2025-01-19",
    "status": "published",
    "version": 2,
    "parentScheduleId": null,
    "title": "Week 3 - January 2025",
    "description": "Regular weekly schedule",
    "notes": "Updated for holiday coverage",
    "createdBy": 5,
    "approvedBy": 1,
    "approvedAt": "2025-01-10T14:30:00Z",
    "publishedAt": "2025-01-11T09:00:00Z",
    "createdAt": "2025-01-08T10:15:00Z",
    "updatedAt": "2025-01-10T14:30:00Z",
    "isEditable": false,
    "isCurrentWeek": true,
    "daysUntilStart": 2,
    "assignments": [
      {
        "id": 42,
        "scheduleId": 1,
        "employeeId": 7,
        "shiftId": 15,
        "status": "confirmed",
        "priority": 5,
        "assignedAt": "2025-01-10T10:00:00Z",
        "autoAssigned": false,
        "conflictsResolved": true
      }
    ]
  }
]
```

---

#### Get Schedule by ID

Retrieve specific schedule with all assignments.

**Endpoint:** `GET /api/schedules/{schedule_id}`

**Path Parameters:**
- `schedule_id` (integer): Schedule identifier

**Response (200 OK):**
```json
{
  "id": 1,
  "weekStart": "2025-01-13",
  "weekEnd": "2025-01-19",
  "status": "published",
  "version": 2,
  "title": "Week 3 - January 2025",
  "assignments": [
    {
      "id": 42,
      "employeeId": 7,
      "shiftId": 15,
      "status": "confirmed",
      "employee": {
        "id": 7,
        "name": "John Doe",
        "email": "john.doe@example.com"
      },
      "shift": {
        "id": 15,
        "date": "2025-01-15",
        "startTime": "09:00:00",
        "endTime": "17:00:00",
        "shiftType": "general"
      }
    }
  ]
}
```

**Error Responses:**
- `404` - Schedule not found
- `401` - Unauthorized

---

#### Create Schedule

Create a new schedule in draft status.

**Endpoint:** `POST /api/schedules`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "weekStart": "2025-01-20",
  "weekEnd": "2025-01-26",
  "title": "Week 4 - January 2025",
  "description": "Regular weekly schedule",
  "notes": "Plan for increased weekend traffic"
}
```

**Response (201 Created):**
```json
{
  "id": 2,
  "weekStart": "2025-01-20",
  "weekEnd": "2025-01-26",
  "status": "draft",
  "version": 1,
  "title": "Week 4 - January 2025",
  "createdBy": 5,
  "createdAt": "2025-01-12T10:00:00Z",
  "updatedAt": "2025-01-12T10:00:00Z",
  "isEditable": true,
  "assignments": []
}
```

**Validation Rules:**
- `weekStart` must be before `weekEnd`
- Week duration cannot exceed 7 days
- Current user is automatically set as creator

**Error Responses:**
- `400` - Validation error
- `401` - Unauthorized

---

#### Update Schedule

Update schedule details or change status.

**Endpoint:** `PUT /api/schedules/{schedule_id}`

**Path Parameters:**
- `schedule_id` (integer): Schedule identifier

**Request Body (partial update):**
```json
{
  "title": "Week 4 - January 2025 (Updated)",
  "status": "pending_approval",
  "notes": "Added extra coverage for inventory day"
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "weekStart": "2025-01-20",
  "weekEnd": "2025-01-26",
  "status": "pending_approval",
  "title": "Week 4 - January 2025 (Updated)",
  "notes": "Added extra coverage for inventory day",
  "updatedAt": "2025-01-12T14:30:00Z"
}
```

**Workflow Status Transitions:**
- `draft` → `pending_approval`, `archived`
- `pending_approval` → `approved`, `rejected`, `draft`
- `approved` → `published`, `draft`
- `published` → `archived`
- `rejected` → `draft`

**Error Responses:**
- `404` - Schedule not found
- `400` - Invalid status transition or validation error

---

#### Delete Schedule

Delete a schedule and all its assignments (cascade delete).

**Endpoint:** `DELETE /api/schedules/{schedule_id}`

**Path Parameters:**
- `schedule_id` (integer): Schedule identifier

**Response (204 No Content)**

**Error Responses:**
- `404` - Schedule not found
- `401` - Unauthorized

---

### Employees

#### List Employees

Get all employees with optional filtering.

**Endpoint:** `GET /api/employees`

**Query Parameters:**
- `role` (optional): Filter by role (admin, manager, supervisor, employee)
- `is_active` (optional): Filter by active status (true/false)
- `department_id` (optional): Filter by department ID
- `skip` (default: 0): Pagination offset
- `limit` (default: 100, max: 1000): Number of results

**Example Request:**
```bash
GET /api/employees?role=employee&is_active=true&department_id=3&limit=50
```

**Response (200 OK):**
```json
[
  {
    "id": 7,
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "employee",
    "departmentId": 3,
    "qualifications": ["certified", "barista", "pos_system"],
    "availability": {
      "monday": {
        "available": true,
        "timeSlots": [
          {"start": "09:00", "end": "17:00"}
        ]
      },
      "tuesday": {
        "available": true,
        "timeSlots": [
          {"start": "09:00", "end": "17:00"}
        ]
      },
      "wednesday": {
        "available": false
      }
    },
    "isActive": true,
    "isAdmin": false,
    "createdAt": "2024-06-15T08:00:00Z",
    "updatedAt": "2025-01-05T12:30:00Z"
  }
]
```

---

#### Get Employee by ID

Retrieve specific employee details.

**Endpoint:** `GET /api/employees/{employee_id}`

**Path Parameters:**
- `employee_id` (integer): Employee identifier

**Response (200 OK):**
```json
{
  "id": 7,
  "email": "john.doe@example.com",
  "name": "John Doe",
  "role": "employee",
  "departmentId": 3,
  "qualifications": ["certified", "barista"],
  "availability": {
    "monday": {"available": true, "timeSlots": [{"start": "09:00", "end": "17:00"}]},
    "tuesday": {"available": true, "timeSlots": [{"start": "09:00", "end": "17:00"}]},
    "wednesday": {"available": false}
  },
  "isActive": true,
  "isAdmin": false
}
```

**Error Responses:**
- `404` - Employee not found

---

#### Create Employee

Create a new employee account.

**Endpoint:** `POST /api/employees`

**Headers:** `Authorization: Bearer <token>` (requires manager or admin role)

**Request Body:**
```json
{
  "email": "jane.smith@example.com",
  "password": "SecureP@ssw0rd",
  "name": "Jane Smith",
  "role": "employee",
  "departmentId": 3,
  "qualifications": ["certified", "supervisor"],
  "availability": {
    "monday": {
      "available": true,
      "timeSlots": [{"start": "08:00", "end": "16:00"}]
    }
  }
}
```

**Response (201 Created):**
```json
{
  "id": 15,
  "email": "jane.smith@example.com",
  "name": "Jane Smith",
  "role": "employee",
  "departmentId": 3,
  "qualifications": ["certified", "supervisor"],
  "isActive": true,
  "isAdmin": false,
  "createdAt": "2025-01-12T10:00:00Z"
}
```

**Validation Rules:**
- Email must be unique and valid format
- Password minimum 8 characters
- Name minimum 2 characters
- Valid role: admin, manager, supervisor, employee
- Email format validated by regex

**Error Responses:**
- `409` - Email already exists
- `400` - Validation error

---

#### Update Employee

Update employee profile, availability, or qualifications.

**Endpoint:** `PUT /api/employees/{employee_id}`

**Path Parameters:**
- `employee_id` (integer): Employee identifier

**Request Body (partial update):**
```json
{
  "name": "Jane Smith-Johnson",
  "qualifications": ["certified", "supervisor", "trainer"],
  "availability": {
    "monday": {
      "available": true,
      "timeSlots": [{"start": "08:00", "end": "16:00"}]
    },
    "friday": {
      "available": false
    }
  }
}
```

**Response (200 OK):**
```json
{
  "id": 15,
  "email": "jane.smith@example.com",
  "name": "Jane Smith-Johnson",
  "qualifications": ["certified", "supervisor", "trainer"],
  "updatedAt": "2025-01-12T14:00:00Z"
}
```

**Special Fields:**
- `password`: If provided, will be hashed before storage
- `isActive`: Can deactivate accounts without deleting
- `role`: Requires admin permissions to change

---

#### Delete Employee

Permanently delete an employee account.

**Endpoint:** `DELETE /api/employees/{employee_id}`

**Path Parameters:**
- `employee_id` (integer): Employee identifier

**Response (204 No Content)**

**Cascade Behavior:**
- All schedule assignments are deleted
- Created schedules remain but show deleted user
- All notifications and settings are deleted

**Error Responses:**
- `404` - Employee not found
- `401` - Unauthorized

---

### Shifts

#### List Shifts

Get all shift definitions with pagination and filtering.

**Endpoint:** `GET /api/shifts`

**Query Parameters:**
- `department` (optional): Filter by department name
- `shift_type` (optional): Filter by type (morning, afternoon, evening, night)
- `active` (optional): Filter by active status (true/false)
- `page` (default: 1): Page number
- `size` (default: 10, max: 100): Items per page
- `sort_by` (default: "name"): Sort field
- `sort_order` (default: "asc"): Sort direction (asc/desc)

**Example Request:**
```bash
GET /api/shifts?shift_type=morning&active=true&page=1&size=20
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": 15,
      "date": "2025-01-15",
      "startTime": "09:00:00",
      "endTime": "17:00:00",
      "shiftType": "general",
      "departmentId": 3,
      "requiredStaff": 3,
      "requirements": {
        "qualifications": ["barista", "pos_system"],
        "minExperience": 6
      },
      "description": "Morning rush hour coverage",
      "priority": 7,
      "durationHours": 8.0,
      "isOvertime": false,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

---

#### Get Shift by ID

Retrieve specific shift details.

**Endpoint:** `GET /api/shifts/{shift_id}`

**Path Parameters:**
- `shift_id` (integer): Shift identifier

**Response (200 OK):**
```json
{
  "id": 15,
  "date": "2025-01-15",
  "startTime": "09:00:00",
  "endTime": "17:00:00",
  "shiftType": "general",
  "requiredStaff": 3,
  "requirements": {
    "qualifications": ["barista"],
    "minExperience": 6
  },
  "description": "Morning rush coverage",
  "priority": 7,
  "durationHours": 8.0,
  "isOvertime": false
}
```

---

#### Create Shift

Create a new shift definition.

**Endpoint:** `POST /api/shifts`

**Headers:** `Authorization: Bearer <token>` (requires manager role)

**Request Body:**
```json
{
  "date": "2025-01-20",
  "startTime": "06:00",
  "endTime": "14:00",
  "shiftType": "morning",
  "departmentId": 3,
  "requiredStaff": 4,
  "requirements": {
    "qualifications": ["barista", "opener"],
    "minExperience": 3
  },
  "description": "Early morning opening shift",
  "priority": 9
}
```

**Response (201 Created):**
```json
{
  "id": 42,
  "date": "2025-01-20",
  "startTime": "06:00:00",
  "endTime": "14:00:00",
  "shiftType": "morning",
  "requiredStaff": 4,
  "durationHours": 8.0,
  "createdAt": "2025-01-12T10:00:00Z"
}
```

**Validation Rules:**
- `startTime` must be before `endTime`
- `requiredStaff` must be at least 1
- Valid shift types: general, management, specialized, emergency, training
- Priority range: 1-10

**Error Responses:**
- `400` - Validation error
- `401` - Unauthorized

---

### Departments

#### List Departments

Get all departments with hierarchy and filtering.

**Endpoint:** `GET /api/departments`

**Query Parameters:**
- `active` (optional): Filter by active status
- `parent_id` (optional): Filter by parent department (null for root departments)
- `search` (optional): Search by department name
- `page` (default: 1): Page number
- `size` (default: 10, max: 100): Items per page
- `sort_by` (default: "name"): Sort field
- `sort_order` (default: "asc"): Sort direction

**Example Request:**
```bash
GET /api/departments?active=true&parent_id=null&page=1&size=20
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Operations",
      "description": "Main operations department",
      "parentId": null,
      "settings": {
        "minStaffPerShift": 2,
        "maxWeeklyHours": 40
      },
      "active": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-06-15T10:00:00Z"
    },
    {
      "id": 3,
      "name": "Kitchen",
      "description": "Food preparation and cooking",
      "parentId": 1,
      "settings": {},
      "active": true
    }
  ],
  "total": 8,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

---

#### Get Department by ID

Retrieve department with hierarchy information.

**Endpoint:** `GET /api/departments/{department_id}`

**Path Parameters:**
- `department_id` (integer): Department identifier

**Response (200 OK):**
```json
{
  "id": 3,
  "name": "Kitchen",
  "description": "Food preparation and cooking",
  "parentId": 1,
  "settings": {
    "minStaffPerShift": 2
  },
  "active": true,
  "parent": {
    "id": 1,
    "name": "Operations"
  },
  "children": []
}
```

---

#### Create Department

Create a new department with optional parent.

**Endpoint:** `POST /api/departments`

**Headers:** `Authorization: Bearer <token>` (requires manager role)

**Request Body:**
```json
{
  "name": "Bakery",
  "description": "Baked goods and pastries",
  "parentId": 3,
  "settings": {
    "minStaffPerShift": 1,
    "specialtyRequired": true
  },
  "active": true
}
```

**Response (201 Created):**
```json
{
  "id": 8,
  "name": "Bakery",
  "description": "Baked goods and pastries",
  "parentId": 3,
  "settings": {
    "minStaffPerShift": 1,
    "specialtyRequired": true
  },
  "active": true,
  "createdAt": "2025-01-12T10:00:00Z"
}
```

**Validation Rules:**
- Name must be unique
- Parent department must exist if specified
- Cannot create circular hierarchies

**Error Responses:**
- `400` - Validation error or name already exists
- `404` - Parent department not found

---

### Data Import/Export

#### Export Schedules

Export schedule data in various formats.

**Endpoint:** `GET /api/data/export/schedules`

**Query Parameters:**
- `format_type` (required): csv, excel, pdf, or ical
- `date_from` (optional): Start date filter (YYYY-MM-DD)
- `date_to` (optional): End date filter (YYYY-MM-DD)
- `employee_ids` (optional): Filter by employee IDs (comma-separated)
- `status` (optional): Filter by schedule status

**Example Request:**
```bash
GET /api/data/export/schedules?format_type=excel&date_from=2025-01-01&date_to=2025-01-31&status=published
```

**Response (200 OK):**
- Content-Type varies by format
- Content-Disposition: attachment; filename=schedules_20250112_143000.xlsx

**Supported Formats:**
- **CSV**: Plain text comma-separated values
- **Excel**: Microsoft Excel XLSX format
- **PDF**: Formatted PDF document
- **iCal**: Calendar format (.ics) for import into calendar apps

---

#### Upload Import File

Upload CSV or Excel file for data import.

**Endpoint:** `POST /api/data/import/upload`

**Headers:** `Authorization: Bearer <token>` (requires manager role)

**Request:** multipart/form-data with file

**Response (200 OK):**
```json
{
  "file_id": "abc123def456",
  "filename": "employees_import.xlsx",
  "size": 15234,
  "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "upload_time": "2025-01-12T10:00:00Z",
  "message": "File uploaded successfully. Use the file_id to preview or import data."
}
```

**File Requirements:**
- Max size: 50 MB
- Allowed formats: .csv, .xlsx, .xls
- Files are automatically scanned for malware
- Files expire after 24 hours

---

#### Preview Import Data

Preview imported data before processing.

**Endpoint:** `GET /api/data/import/preview/{file_id}`

**Path Parameters:**
- `file_id` (string): File identifier from upload

**Query Parameters:**
- `import_type` (required): employees, schedules, or rules
- `preview_rows` (default: 10, max: 50): Number of rows to preview

**Response (200 OK):**
```json
{
  "file_id": "abc123def456",
  "import_type": "employees",
  "total_rows": 150,
  "preview_rows": 10,
  "columns": ["name", "email", "role", "department"],
  "sample_data": [
    {
      "name": "Alice Johnson",
      "email": "alice.j@example.com",
      "role": "employee",
      "department": "Kitchen"
    }
  ],
  "detected_encoding": "utf-8",
  "warnings": []
}
```

---

## Error Handling

All error responses follow a consistent format:

### Standard Error Response

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Validation Error Response

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded with no response body
- `400 Bad Request` - Validation error or invalid input
- `401 Unauthorized` - Authentication required or token invalid
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists or conflict
- `423 Locked` - Account locked (too many failed login attempts)
- `500 Internal Server Error` - Server error

---

## Rate Limiting

Rate limiting is enforced per-user and per-IP address:

- **Authentication endpoints:** 10 requests per minute
- **Read operations (GET):** 100 requests per minute
- **Write operations (POST/PUT/DELETE):** 30 requests per minute
- **Export operations:** 10 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642089600
```

---

## Code Examples

### Python Example (requests library)

```python
import requests

# Base URL
BASE_URL = "http://localhost:8000"

# Login and get token
response = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "admin@example.com",
    "password": "SecurePassword123"
})
data = response.json()
access_token = data["access_token"]

# Set headers for authenticated requests
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Get all published schedules
response = requests.get(
    f"{BASE_URL}/api/schedules",
    params={"status": "published", "limit": 20},
    headers=headers
)
schedules = response.json()

# Create a new schedule
new_schedule = {
    "weekStart": "2025-01-27",
    "weekEnd": "2025-02-02",
    "title": "Week 5 - February Start",
    "description": "First week of February"
}
response = requests.post(
    f"{BASE_URL}/api/schedules",
    json=new_schedule,
    headers=headers
)
created_schedule = response.json()
print(f"Created schedule ID: {created_schedule['id']}")

# Update schedule status
response = requests.put(
    f"{BASE_URL}/api/schedules/{created_schedule['id']}",
    json={"status": "pending_approval"},
    headers=headers
)
```

### JavaScript/TypeScript Example (fetch)

```typescript
const BASE_URL = 'http://localhost:8000';

// Login
async function login(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include' // Include cookies
  });

  const data = await response.json();
  return data.access_token;
}

// Get schedules
async function getSchedules(accessToken: string, status?: string) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const response = await fetch(`${BASE_URL}/api/schedules?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  return await response.json();
}

// Create employee
async function createEmployee(accessToken: string, employeeData: any) {
  const response = await fetch(`${BASE_URL}/api/employees`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(employeeData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }

  return await response.json();
}

// Usage
const token = await login('admin@example.com', 'password');
const schedules = await getSchedules(token, 'published');
console.log(`Found ${schedules.length} published schedules`);
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePass123"}' \
  -c cookies.txt

# Get schedules (using cookies)
curl -X GET "http://localhost:8000/api/schedules?status=published" \
  -b cookies.txt

# Get schedules (using bearer token)
curl -X GET "http://localhost:8000/api/schedules?status=published" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."

# Create employee
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "email":"new.employee@example.com",
    "password":"SecurePass123",
    "name":"New Employee",
    "role":"employee",
    "departmentId":3
  }'

# Export schedules as Excel
curl -X GET "http://localhost:8000/api/data/export/schedules?format_type=excel&status=published" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -o schedules.xlsx

# Upload import file
curl -X POST http://localhost:8000/api/data/import/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "file=@employees.csv"
```

---

## Pagination Best Practices

For endpoints that return lists:

1. **Use appropriate page sizes**: Start with default (10-20 items), increase if needed
2. **Cache responses**: List data changes infrequently, consider caching
3. **Use filtering**: Reduce result set before pagination with query parameters
4. **Track total pages**: Use the `pages` field to know when to stop pagination

Example pagination loop:
```python
def get_all_schedules(status="published"):
    all_schedules = []
    page = 1

    while True:
        response = requests.get(
            f"{BASE_URL}/api/schedules",
            params={"status": status, "page": page, "size": 50},
            headers=headers
        )
        data = response.json()

        all_schedules.extend(data["items"])

        if page >= data["pages"]:
            break

        page += 1

    return all_schedules
```

---

## WebSocket Support

Real-time updates for schedules and assignments:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/schedules');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);

  if (update.type === 'schedule_updated') {
    console.log('Schedule updated:', update.schedule_id);
    // Refresh UI
  }

  if (update.type === 'assignment_confirmed') {
    console.log('Assignment confirmed:', update.assignment_id);
    // Update assignment status in UI
  }
};
```

Events emitted:
- `schedule_created`
- `schedule_updated`
- `schedule_published`
- `assignment_created`
- `assignment_confirmed`
- `assignment_declined`

---

For more details, see:
- [Data Models Documentation](./DATA_MODELS.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [OpenAPI Specification](./openapi.yaml)
