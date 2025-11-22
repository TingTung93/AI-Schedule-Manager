# Department Schedule Management API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-21
**Base URL:** `http://localhost:8000` (Development) | `https://api.example.com` (Production)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
   - [List Department Schedules](#list-department-schedules)
   - [Create Department Schedule](#create-department-schedule)
   - [Get Department Schedule Overview](#get-department-schedule-overview)
   - [List Department Templates](#list-department-templates)
   - [Create Department Template](#create-department-template)
   - [Apply Schedule Template](#apply-schedule-template)
4. [Request/Response Schemas](#requestresponse-schemas)
5. [Query Parameters Reference](#query-parameters-reference)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

---

## Overview

The Department Schedule Management API provides comprehensive endpoints for creating, managing, and analyzing schedules at the department level. These endpoints support department-specific scheduling, template management, and consolidated schedule views with coverage analytics.

### Key Features

- **Department Schedules**: Create and manage schedules specific to departments
- **Schedule Templates**: Save and reuse common schedule patterns
- **Consolidated Views**: Single view of all employee schedules in a department
- **Coverage Analytics**: Real-time staffing metrics and gap analysis
- **Template Application**: Quick schedule creation from templates

---

## Authentication

All endpoints require authentication using JWT tokens. Include the token in the request header:

```http
Authorization: Bearer <your_jwt_token>
```

**Required Roles:**
- `employee` - Can view their own department's schedules
- `manager` - Can manage schedules for their departments
- `admin` - Can manage all department schedules

---

## Endpoints

### List Department Schedules

Retrieve all schedules for a specific department with pagination and filtering.

#### Endpoint

```http
GET /api/departments/{department_id}/schedules
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (min: 1) |
| `size` | integer | No | 10 | Items per page (min: 1, max: 100) |
| `start_date` | string | No | - | Filter by start date (ISO 8601 format) |
| `end_date` | string | No | - | Filter by end date (ISO 8601 format) |
| `status` | string | No | - | Filter by status: `draft`, `pending_approval`, `approved`, `published`, `archived` |
| `sort_by` | string | No | created_at | Sort field: `created_at`, `start_date`, `name` |
| `sort_order` | string | No | desc | Sort order: `asc`, `desc` |

#### Response

**Success (200 OK):**

```json
{
  "items": [
    {
      "id": 123,
      "name": "Sales Department - Week 48",
      "department_id": 10,
      "department_name": "Sales",
      "start_date": "2025-11-25",
      "end_date": "2025-12-01",
      "employee_count": 15,
      "shift_count": 75,
      "total_hours": 600,
      "status": "published",
      "created_at": "2025-11-15T09:00:00Z",
      "created_by": {
        "id": 5,
        "name": "Jane Manager",
        "email": "jane.manager@example.com"
      },
      "published_at": "2025-11-20T14:30:00Z",
      "notes": "Holiday coverage plan included"
    },
    {
      "id": 124,
      "name": "Sales Department - Week 49",
      "department_id": 10,
      "department_name": "Sales",
      "start_date": "2025-12-02",
      "end_date": "2025-12-08",
      "employee_count": 15,
      "shift_count": 75,
      "total_hours": 600,
      "status": "draft",
      "created_at": "2025-11-18T10:30:00Z",
      "created_by": {
        "id": 5,
        "name": "Jane Manager",
        "email": "jane.manager@example.com"
      },
      "published_at": null,
      "notes": null
    }
  ],
  "total": 45,
  "page": 1,
  "size": 10,
  "pages": 5
}
```

#### Error Responses

**404 Not Found:**
```json
{
  "detail": "Department not found"
}
```

---

### Create Department Schedule

Create a new schedule for a department, optionally based on a template.

#### Endpoint

```http
POST /api/departments/{department_id}/schedules
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |

#### Request Body

```json
{
  "name": "Sales Floor - Holiday Week",
  "start_date": "2025-12-23",
  "end_date": "2025-12-29",
  "template_id": 5,
  "notes": "Extra coverage for holiday shopping season",
  "auto_assign": true,
  "notify_employees": true
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Schedule name (max 200 chars) |
| `start_date` | string | Yes | Schedule start date (ISO 8601) |
| `end_date` | string | Yes | Schedule end date (ISO 8601) |
| `template_id` | integer | No | Template to use for schedule generation |
| `notes` | string | No | Additional notes (max 1000 chars) |
| `auto_assign` | boolean | No | Auto-assign employees based on availability (default: false) |
| `notify_employees` | boolean | No | Send notifications to assigned employees (default: true) |

#### Response

**Success (201 Created):**

```json
{
  "id": 125,
  "name": "Sales Floor - Holiday Week",
  "department_id": 10,
  "department_name": "Sales",
  "start_date": "2025-12-23",
  "end_date": "2025-12-29",
  "employee_count": 18,
  "shift_count": 90,
  "total_hours": 720,
  "status": "draft",
  "created_at": "2025-11-21T11:00:00Z",
  "created_by": {
    "id": 5,
    "name": "Jane Manager",
    "email": "jane.manager@example.com"
  },
  "template_id": 5,
  "template_name": "Holiday Coverage Template",
  "notes": "Extra coverage for holiday shopping season",
  "shifts": [
    {
      "id": 501,
      "employee_id": 25,
      "employee_name": "Bob Johnson",
      "date": "2025-12-23",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "shift_type": "regular",
      "hours": 8
    }
  ],
  "notifications_sent": true
}
```

#### Error Responses

**400 Bad Request - Invalid Date Range:**
```json
{
  "detail": "End date must be after start date"
}
```

**404 Not Found - Template:**
```json
{
  "detail": "Schedule template not found"
}
```

**409 Conflict - Overlapping Schedule:**
```json
{
  "detail": {
    "message": "Schedule overlaps with existing schedule",
    "conflicting_schedule_id": 123,
    "conflicting_schedule_name": "Sales Department - Week 52",
    "overlap_start": "2025-12-23",
    "overlap_end": "2025-12-25"
  }
}
```

---

### Get Department Schedule Overview

Get a consolidated view of all employee schedules in a department with coverage analytics.

#### Endpoint

```http
GET /api/departments/{department_id}/schedule-overview
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | string | Yes | - | Start of date range (ISO 8601) |
| `end_date` | string | Yes | - | End of date range (ISO 8601) |
| `include_metrics` | boolean | No | true | Include coverage analytics |
| `group_by` | string | No | employee | Group by: `employee`, `date`, `shift_type` |

#### Response

**Success (200 OK):**

```json
{
  "department_id": 10,
  "department_name": "Sales",
  "date_range": {
    "start": "2025-11-25",
    "end": "2025-12-01"
  },
  "employees": [
    {
      "id": 25,
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "role": "sales_associate",
      "total_hours": 40,
      "shift_count": 5,
      "shifts": [
        {
          "id": 501,
          "date": "2025-11-25",
          "start_time": "09:00:00",
          "end_time": "17:00:00",
          "shift_type": "regular",
          "hours": 8,
          "schedule_id": 123,
          "schedule_name": "Sales Department - Week 48"
        },
        {
          "id": 502,
          "date": "2025-11-26",
          "start_time": "09:00:00",
          "end_time": "17:00:00",
          "shift_type": "regular",
          "hours": 8,
          "schedule_id": 123,
          "schedule_name": "Sales Department - Week 48"
        }
      ]
    }
  ],
  "metrics": {
    "total_employees": 15,
    "total_shifts": 75,
    "total_hours": 600,
    "average_hours_per_employee": 40,
    "coverage_percentage": 95.5,
    "overtime_hours": 15,
    "estimated_labor_cost": 15000.00,
    "understaffed_periods": [
      {
        "date": "2025-11-28",
        "time_range": "14:00:00-16:00:00",
        "required_staff": 5,
        "scheduled_staff": 3,
        "shortage": 2,
        "severity": "medium"
      }
    ],
    "overstaffed_periods": [
      {
        "date": "2025-11-26",
        "time_range": "10:00:00-12:00:00",
        "required_staff": 4,
        "scheduled_staff": 7,
        "excess": 3,
        "severity": "low"
      }
    ],
    "coverage_by_day": [
      {
        "date": "2025-11-25",
        "total_hours": 120,
        "employee_count": 15,
        "coverage_percentage": 100
      },
      {
        "date": "2025-11-26",
        "total_hours": 120,
        "employee_count": 15,
        "coverage_percentage": 100
      }
    ]
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Date Range:**
```json
{
  "detail": "Date range cannot exceed 31 days"
}
```

---

### List Department Templates

Get all schedule templates available for a department.

#### Endpoint

```http
GET /api/departments/{department_id}/templates
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `size` | integer | No | 20 | Items per page |
| `active` | boolean | No | - | Filter by active status |
| `pattern_type` | string | No | - | Filter by pattern: `weekly`, `rotating`, `custom` |

#### Response

**Success (200 OK):**

```json
{
  "items": [
    {
      "id": 5,
      "department_id": 10,
      "department_name": "Sales",
      "name": "Holiday Coverage Template",
      "description": "Extended hours for holiday shopping season",
      "pattern_type": "weekly",
      "rotation_days": null,
      "is_active": true,
      "created_at": "2025-10-15T10:00:00Z",
      "created_by": {
        "id": 5,
        "name": "Jane Manager"
      },
      "usage_count": 12,
      "last_used": "2025-11-15T14:30:00Z",
      "template_data": {
        "shifts_per_day": 3,
        "shift_duration": 8,
        "coverage_requirements": {
          "monday": 15,
          "tuesday": 15,
          "wednesday": 15,
          "thursday": 18,
          "friday": 20,
          "saturday": 20,
          "sunday": 12
        }
      }
    }
  ],
  "total": 8,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

---

### Create Department Template

Create a reusable schedule template for a department.

#### Endpoint

```http
POST /api/departments/{department_id}/templates
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |

#### Request Body

```json
{
  "name": "Standard Weekly Pattern",
  "description": "Regular weekly schedule with consistent coverage",
  "pattern_type": "weekly",
  "rotation_days": null,
  "template_data": {
    "shifts_per_day": 3,
    "shift_duration": 8,
    "coverage_requirements": {
      "monday": 12,
      "tuesday": 12,
      "wednesday": 12,
      "thursday": 12,
      "friday": 15,
      "saturday": 15,
      "sunday": 10
    },
    "shift_times": [
      {"start": "06:00:00", "end": "14:00:00"},
      {"start": "14:00:00", "end": "22:00:00"},
      {"start": "22:00:00", "end": "06:00:00"}
    ]
  },
  "is_active": true
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name (max 200 chars) |
| `description` | string | No | Template description (max 1000 chars) |
| `pattern_type` | string | Yes | Pattern type: `weekly`, `rotating`, `custom` |
| `rotation_days` | integer | No | Days in rotation cycle (for rotating patterns) |
| `template_data` | object | Yes | Template configuration (JSON) |
| `is_active` | boolean | No | Active status (default: true) |

#### Response

**Success (201 Created):**

```json
{
  "id": 9,
  "department_id": 10,
  "department_name": "Sales",
  "name": "Standard Weekly Pattern",
  "description": "Regular weekly schedule with consistent coverage",
  "pattern_type": "weekly",
  "rotation_days": null,
  "is_active": true,
  "created_at": "2025-11-21T11:30:00Z",
  "created_by": {
    "id": 5,
    "name": "Jane Manager",
    "email": "jane.manager@example.com"
  },
  "template_data": {
    "shifts_per_day": 3,
    "shift_duration": 8,
    "coverage_requirements": {
      "monday": 12,
      "tuesday": 12,
      "wednesday": 12,
      "thursday": 12,
      "friday": 15,
      "saturday": 15,
      "sunday": 10
    },
    "shift_times": [
      {"start": "06:00:00", "end": "14:00:00"},
      {"start": "14:00:00", "end": "22:00:00"},
      {"start": "22:00:00", "end": "06:00:00"}
    ]
  }
}
```

#### Error Responses

**400 Bad Request - Invalid Template Data:**
```json
{
  "detail": {
    "message": "Invalid template data",
    "errors": [
      "shifts_per_day must be between 1 and 10",
      "coverage_requirements must include all days of week"
    ]
  }
}
```

---

### Apply Schedule Template

Apply a template to create a new schedule.

#### Endpoint

```http
POST /api/departments/{department_id}/templates/{template_id}/apply
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department_id` | integer | Yes | Department ID |
| `template_id` | integer | Yes | Template ID |

#### Request Body

```json
{
  "name": "Week of December 23rd",
  "start_date": "2025-12-23",
  "end_date": "2025-12-29",
  "overrides": {
    "coverage_requirements": {
      "thursday": 20,
      "friday": 22
    }
  },
  "auto_assign": true,
  "notify_employees": true
}
```

**Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | New schedule name |
| `start_date` | string | Yes | Schedule start date (ISO 8601) |
| `end_date` | string | Yes | Schedule end date (ISO 8601) |
| `overrides` | object | No | Override template settings |
| `auto_assign` | boolean | No | Auto-assign employees (default: false) |
| `notify_employees` | boolean | No | Send notifications (default: true) |

#### Response

**Success (201 Created):**

```json
{
  "id": 126,
  "name": "Week of December 23rd",
  "department_id": 10,
  "department_name": "Sales",
  "start_date": "2025-12-23",
  "end_date": "2025-12-29",
  "employee_count": 15,
  "shift_count": 75,
  "total_hours": 600,
  "status": "draft",
  "created_at": "2025-11-21T12:00:00Z",
  "created_by": {
    "id": 5,
    "name": "Jane Manager"
  },
  "template_id": 5,
  "template_name": "Standard Weekly Pattern",
  "applied_overrides": {
    "coverage_requirements": {
      "thursday": 20,
      "friday": 22
    }
  },
  "shifts_created": 75,
  "employees_assigned": 15,
  "notifications_sent": true
}
```

---

## Request/Response Schemas

### Department Schedule Object

```typescript
interface DepartmentSchedule {
  id: number;
  name: string;
  department_id: number;
  department_name: string;
  start_date: string;  // ISO 8601 date
  end_date: string;    // ISO 8601 date
  employee_count: number;
  shift_count: number;
  total_hours: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
  created_at: string;  // ISO 8601 datetime
  created_by: {
    id: number;
    name: string;
    email: string;
  };
  published_at?: string;  // ISO 8601 datetime
  notes?: string;
}
```

### Schedule Template Object

```typescript
interface ScheduleTemplate {
  id: number;
  department_id: number;
  department_name: string;
  name: string;
  description?: string;
  pattern_type: 'weekly' | 'rotating' | 'custom';
  rotation_days?: number;
  is_active: boolean;
  created_at: string;
  created_by: {
    id: number;
    name: string;
  };
  template_data: {
    shifts_per_day: number;
    shift_duration: number;
    coverage_requirements: Record<string, number>;
    shift_times?: Array<{
      start: string;
      end: string;
    }>;
  };
}
```

### Coverage Metrics Object

```typescript
interface CoverageMetrics {
  total_employees: number;
  total_shifts: number;
  total_hours: number;
  average_hours_per_employee: number;
  coverage_percentage: number;
  overtime_hours: number;
  estimated_labor_cost: number;
  understaffed_periods: Array<{
    date: string;
    time_range: string;
    required_staff: number;
    scheduled_staff: number;
    shortage: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  overstaffed_periods: Array<{
    date: string;
    time_range: string;
    required_staff: number;
    scheduled_staff: number;
    excess: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}
```

---

## Query Parameters Reference

### Common Parameters

| Parameter | Type | Values | Default | Description |
|-----------|------|--------|---------|-------------|
| `page` | integer | ≥ 1 | 1 | Page number for pagination |
| `size` | integer | 1-100 | 10 | Items per page |
| `sort_by` | string | varies | varies | Field to sort by |
| `sort_order` | string | `asc`, `desc` | `desc` | Sort direction |

### Schedule Filters

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `start_date` | string | ISO 8601 | Filter schedules starting on/after this date |
| `end_date` | string | ISO 8601 | Filter schedules ending on/before this date |
| `status` | string | `draft`, `pending_approval`, `approved`, `published`, `archived` | Filter by schedule status |

### Template Filters

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `active` | boolean | `true`, `false` | Filter by active status |
| `pattern_type` | string | `weekly`, `rotating`, `custom` | Filter by pattern type |

---

## Error Handling

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data or validation error |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (overlapping schedule, etc.) |
| 422 | Unprocessable Entity | Request validation failed |
| 500 | Internal Server Error | Server error |

### Error Response Format

Standard error response:

```json
{
  "detail": "Error message or details object"
}
```

Validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "start_date"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Usage Examples

### Example 1: List Department Schedules (cURL)

```bash
# Get all published schedules for Sales department
curl -X GET "http://localhost:8000/api/departments/10/schedules?status=published&page=1&size=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example 2: Create Department Schedule (Python)

```python
import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
token = "your_jwt_token_here"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Calculate next week dates
start = datetime.now() + timedelta(days=7)
end = start + timedelta(days=6)

data = {
    "name": f"Week of {start.strftime('%B %d')}",
    "start_date": start.strftime("%Y-%m-%d"),
    "end_date": end.strftime("%Y-%m-%d"),
    "template_id": 5,
    "notes": "Regular weekly schedule",
    "auto_assign": True,
    "notify_employees": True
}

response = requests.post(
    f"{BASE_URL}/api/departments/10/schedules",
    headers=headers,
    json=data
)

if response.status_code == 201:
    schedule = response.json()
    print(f"✓ Created schedule: {schedule['name']}")
    print(f"  - {schedule['shift_count']} shifts for {schedule['employee_count']} employees")
    print(f"  - Total hours: {schedule['total_hours']}")
else:
    print(f"✗ Error: {response.status_code}")
    print(response.json())
```

### Example 3: Get Schedule Overview (JavaScript)

```javascript
const BASE_URL = "http://localhost:8000";
const token = "your_jwt_token_here";

async function getDepartmentScheduleOverview(departmentId, startDate, endDate) {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    include_metrics: 'true'
  });

  const response = await fetch(
    `${BASE_URL}/api/departments/${departmentId}/schedule-overview?${params}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch schedule overview: ${response.status}`);
  }

  return await response.json();
}

// Usage
try {
  const overview = await getDepartmentScheduleOverview(
    10,
    "2025-11-25",
    "2025-12-01"
  );

  console.log(`Schedule Overview for ${overview.department_name}`);
  console.log(`Coverage: ${overview.metrics.coverage_percentage}%`);
  console.log(`Total Hours: ${overview.metrics.total_hours}`);

  if (overview.metrics.understaffed_periods.length > 0) {
    console.log("\n⚠️  Understaffed Periods:");
    overview.metrics.understaffed_periods.forEach(period => {
      console.log(`  - ${period.date} ${period.time_range}: ${period.shortage} short`);
    });
  }
} catch (error) {
  console.error("Error:", error.message);
}
```

### Example 4: Create Template (Python)

```python
template_data = {
    "name": "Standard Weekly Pattern",
    "description": "Regular 3-shift daily rotation",
    "pattern_type": "weekly",
    "template_data": {
        "shifts_per_day": 3,
        "shift_duration": 8,
        "coverage_requirements": {
            "monday": 12,
            "tuesday": 12,
            "wednesday": 12,
            "thursday": 12,
            "friday": 15,
            "saturday": 15,
            "sunday": 10
        },
        "shift_times": [
            {"start": "06:00:00", "end": "14:00:00"},
            {"start": "14:00:00", "end": "22:00:00"},
            {"start": "22:00:00", "end": "06:00:00"}
        ]
    },
    "is_active": True
}

response = requests.post(
    f"{BASE_URL}/api/departments/10/templates",
    headers=headers,
    json=template_data
)

if response.status_code == 201:
    template = response.json()
    print(f"✓ Created template: {template['name']} (ID: {template['id']})")
else:
    print(f"✗ Error: {response.status_code}")
```

### Example 5: Apply Template (cURL)

```bash
# Apply holiday template to create new schedule
curl -X POST "http://localhost:8000/api/departments/10/templates/5/apply" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Holiday Week 2025",
    "start_date": "2025-12-23",
    "end_date": "2025-12-29",
    "overrides": {
      "coverage_requirements": {
        "thursday": 20,
        "friday": 22
      }
    },
    "auto_assign": true,
    "notify_employees": true
  }'
```

---

## Best Practices

### 1. Date Range Validation

Always validate date ranges before making requests:

```python
from datetime import datetime, timedelta

def validate_date_range(start_date, end_date, max_days=31):
    """Validate schedule date range."""
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)

    if end <= start:
        raise ValueError("End date must be after start date")

    if (end - start).days > max_days:
        raise ValueError(f"Date range cannot exceed {max_days} days")

    return True
```

### 2. Template Reusability

Design templates for maximum reusability:

```python
# Good: Generic template with overrides
template = {
    "name": "Standard Weekly",
    "pattern_type": "weekly",
    "template_data": {
        "shifts_per_day": 3,
        "shift_duration": 8,
        "coverage_requirements": {
            "monday": 10, "tuesday": 10, "wednesday": 10,
            "thursday": 10, "friday": 12, "saturday": 12, "sunday": 8
        }
    }
}

# Apply with seasonal overrides
apply_template(template_id=5, overrides={
    "coverage_requirements": {"thursday": 15, "friday": 18}  # Holiday boost
})
```

### 3. Coverage Analytics

Use coverage metrics to optimize scheduling:

```python
def analyze_coverage(overview):
    """Analyze schedule coverage and identify issues."""
    metrics = overview['metrics']

    # Check overall coverage
    if metrics['coverage_percentage'] < 90:
        print(f"⚠️  Low coverage: {metrics['coverage_percentage']}%")

    # Identify critical shortages
    critical = [p for p in metrics['understaffed_periods'] if p['severity'] == 'high']
    if critical:
        print(f"🚨 {len(critical)} critical understaffed periods")
        for period in critical:
            print(f"   {period['date']} {period['time_range']}: {period['shortage']} short")

    # Check overtime
    if metrics['overtime_hours'] > 0:
        print(f"⏰ Overtime hours: {metrics['overtime_hours']}")

    return {
        'needs_attention': metrics['coverage_percentage'] < 90 or len(critical) > 0,
        'critical_shortages': critical
    }
```

### 4. Batch Schedule Creation

For recurring schedules, create multiple weeks efficiently:

```python
from datetime import datetime, timedelta

def create_recurring_schedules(department_id, template_id, weeks=4):
    """Create multiple weeks of schedules from template."""
    schedules = []
    start = datetime.now() + timedelta(days=7)  # Start next week

    for week in range(weeks):
        week_start = start + timedelta(weeks=week)
        week_end = week_start + timedelta(days=6)

        response = requests.post(
            f"{BASE_URL}/api/departments/{department_id}/templates/{template_id}/apply",
            headers=headers,
            json={
                "name": f"Week of {week_start.strftime('%B %d')}",
                "start_date": week_start.strftime("%Y-%m-%d"),
                "end_date": week_end.strftime("%Y-%m-%d"),
                "auto_assign": True,
                "notify_employees": week == 0  # Only notify for first week
            }
        )

        if response.status_code == 201:
            schedules.append(response.json())
        else:
            print(f"Failed to create week {week + 1}: {response.status_code}")

    return schedules
```

### 5. Error Recovery

Implement proper error handling and recovery:

```python
def create_schedule_with_retry(department_id, data, max_retries=3):
    """Create schedule with automatic retry on transient errors."""
    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{BASE_URL}/api/departments/{department_id}/schedules",
                headers=headers,
                json=data,
                timeout=30
            )

            if response.status_code == 201:
                return response.json()
            elif response.status_code == 409:
                # Conflict - adjust dates and retry
                data['start_date'] = adjust_dates(data['start_date'])
                continue
            else:
                response.raise_for_status()

        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff

    raise Exception("Failed to create schedule after retries")
```

---

## Related Documentation

- [Department Assignment API](./department-assignment-api.md)
- [Schedule Management API](./API_REFERENCE.md#schedule-management)
- [Analytics API](./API_REFERENCE.md#analytics)
- [Authentication Guide](./AUTHENTICATION.md)
- [Data Models](./DATA_MODELS.md)

---

**Last Updated:** 2025-11-21
**API Version:** 1.0.0
**Maintained By:** AI Schedule Manager Development Team
