# Shift Management API Documentation

## Overview

The Shift Management API provides comprehensive CRUD operations for shift definitions and shift templates. This enables managers to configure shift patterns, manage staffing requirements, and apply templates to generate schedules efficiently.

**Base URL:** `/api/shifts`

**Authentication:** All endpoints require authentication. Template creation and shift management require manager role.

---

## Endpoints Summary

### Shift CRUD Operations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/shifts` | List all shifts with filtering | User |
| GET | `/api/shifts/types` | Get available shift types | User |
| GET | `/api/shifts/{id}` | Get single shift | User |
| POST | `/api/shifts` | Create shift definition | Manager |
| PATCH | `/api/shifts/{id}` | Update shift | Manager |
| DELETE | `/api/shifts/{id}` | Delete shift | Manager |
| POST | `/api/shifts/bulk` | Bulk create shifts | Manager |

### Shift Templates
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/shifts/templates` | List shift templates | User |
| POST | `/api/shifts/templates` | Create template | Manager |
| POST | `/api/shifts/templates/{id}/apply` | Apply template | Manager |

---

## Shift Model

```json
{
  "id": 1,
  "name": "Morning Server Shift",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 3,
  "required_qualifications": ["food_handling", "pos_system"],
  "department": "Kitchen",
  "hourly_rate_multiplier": 1.0,
  "active": true,
  "created_at": "2025-11-12T10:00:00",
  "updated_at": "2025-11-12T10:00:00"
}
```

### Field Descriptions

- **id** (integer): Unique identifier
- **name** (string, required): Shift name (max 100 chars)
- **shift_type** (string, required): Type of shift
  - Valid values: `morning`, `afternoon`, `evening`, `night`, `split`, `on-call`
- **start_time** (time, required): Shift start time (HH:MM format)
- **end_time** (time, required): Shift end time (HH:MM format)
- **required_staff** (integer, required): Number of staff required (min: 1)
- **required_qualifications** (array[string]): List of required qualifications
- **department** (string, optional): Department name (max 100 chars)
- **hourly_rate_multiplier** (float): Pay rate multiplier (default: 1.0, min: 0)
- **active** (boolean): Whether shift is active (default: true)

---

## API Endpoints

### 1. List Shifts

**GET** `/api/shifts`

Get all shift definitions with pagination and filtering.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| department | string | null | Filter by department |
| shift_type | string | null | Filter by shift type |
| active | boolean | null | Filter by active status |
| page | integer | 1 | Page number (min: 1) |
| size | integer | 10 | Items per page (1-100) |
| sort_by | string | "name" | Sort field |
| sort_order | string | "asc" | Sort order (asc/desc) |

#### Example Request

```bash
GET /api/shifts?department=Kitchen&shift_type=morning&page=1&size=10
```

#### Example Response

```json
{
  "items": [
    {
      "id": 1,
      "name": "Morning Server Shift",
      "shift_type": "morning",
      "start_time": "06:00:00",
      "end_time": "14:00:00",
      "required_staff": 3,
      "required_qualifications": ["food_handling"],
      "department": "Kitchen",
      "hourly_rate_multiplier": 1.0,
      "active": true,
      "created_at": "2025-11-12T10:00:00",
      "updated_at": "2025-11-12T10:00:00"
    }
  ],
  "total": 15,
  "page": 1,
  "size": 10,
  "pages": 2
}
```

---

### 2. Get Shift Types

**GET** `/api/shifts/types`

Get available shift types with usage statistics.

#### Example Response

```json
{
  "shift_types": [
    "morning",
    "afternoon",
    "evening",
    "night",
    "split",
    "on-call"
  ],
  "used_types": {
    "morning": 5,
    "afternoon": 3,
    "evening": 7
  },
  "total_shifts": 15
}
```

---

### 3. Get Single Shift

**GET** `/api/shifts/{shift_id}`

Get specific shift definition by ID.

#### Path Parameters

- **shift_id** (integer, required): The ID of the shift to retrieve

#### Example Response

```json
{
  "id": 1,
  "name": "Morning Server Shift",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 3,
  "required_qualifications": ["food_handling"],
  "department": "Kitchen",
  "hourly_rate_multiplier": 1.0,
  "active": true,
  "created_at": "2025-11-12T10:00:00",
  "updated_at": "2025-11-12T10:00:00"
}
```

#### Error Responses

- **404 Not Found**: Shift with specified ID does not exist

---

### 4. Create Shift

**POST** `/api/shifts`

Create a new shift definition.

**Authorization:** Manager role required

#### Request Body

```json
{
  "name": "Morning Server Shift",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 3,
  "required_qualifications": ["food_handling", "pos_system"],
  "department": "Kitchen",
  "hourly_rate_multiplier": 1.0,
  "active": true
}
```

#### Validation Rules

1. **start_time < end_time** - Start time must be before end time
2. **required_staff >= 1** - At least 1 staff member required
3. **hourly_rate_multiplier >= 0** - Multiplier must be non-negative

#### Example Response (201 Created)

```json
{
  "id": 1,
  "name": "Morning Server Shift",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 3,
  "required_qualifications": ["food_handling", "pos_system"],
  "department": "Kitchen",
  "hourly_rate_multiplier": 1.0,
  "active": true,
  "created_at": "2025-11-12T10:00:00",
  "updated_at": "2025-11-12T10:00:00"
}
```

#### Error Responses

- **400 Bad Request**: Validation failed (invalid times, negative values, etc.)
- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: Not a manager

---

### 5. Update Shift

**PATCH** `/api/shifts/{shift_id}`

Update an existing shift definition.

**Authorization:** Manager role required

#### Path Parameters

- **shift_id** (integer, required): The ID of the shift to update

#### Request Body

All fields are optional. Only provided fields will be updated.

```json
{
  "name": "Updated Shift Name",
  "required_staff": 4,
  "active": false
}
```

#### Example Response

```json
{
  "id": 1,
  "name": "Updated Shift Name",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 4,
  "required_qualifications": ["food_handling"],
  "department": "Kitchen",
  "hourly_rate_multiplier": 1.0,
  "active": false,
  "created_at": "2025-11-12T10:00:00",
  "updated_at": "2025-11-12T11:30:00"
}
```

#### Error Responses

- **400 Bad Request**: Validation failed
- **404 Not Found**: Shift not found

---

### 6. Delete Shift

**DELETE** `/api/shifts/{shift_id}`

Delete a shift definition.

**Authorization:** Manager role required

#### Path Parameters

- **shift_id** (integer, required): The ID of the shift to delete

#### Query Parameters

- **force** (boolean, default: false): Force delete even if shift is used in schedules

#### Safety Check

By default, shifts referenced in schedules cannot be deleted. Use `force=true` to override.

#### Example Request

```bash
DELETE /api/shifts/1?force=false
```

#### Example Response (200 OK)

```json
{
  "message": "Shift deleted successfully",
  "shift_id": 1
}
```

#### Error Responses

- **400 Bad Request**: Shift is used in schedules (without force flag)
- **404 Not Found**: Shift not found

---

### 7. Bulk Create Shifts

**POST** `/api/shifts/bulk`

Create multiple shift definitions at once.

**Authorization:** Manager role required

#### Request Body

```json
{
  "shifts": [
    {
      "name": "Morning Shift",
      "shift_type": "morning",
      "start_time": "06:00:00",
      "end_time": "14:00:00",
      "required_staff": 2,
      "department": "Kitchen"
    },
    {
      "name": "Evening Shift",
      "shift_type": "evening",
      "start_time": "14:00:00",
      "end_time": "22:00:00",
      "required_staff": 3,
      "department": "Kitchen"
    }
  ]
}
```

#### Limits

- Maximum 50 shifts per request
- All shifts must pass validation
- Operation is transactional

#### Example Response (201 Created)

```json
{
  "message": "Successfully created 2 shifts",
  "created": [
    {
      "id": 1,
      "name": "Morning Shift",
      ...
    },
    {
      "id": 2,
      "name": "Evening Shift",
      ...
    }
  ],
  "count": 2,
  "errors": null
}
```

---

## Shift Templates

### 8. List Templates

**GET** `/api/shifts/templates`

Get all shift templates with pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| active | boolean | null | Filter by active status |
| page | integer | 1 | Page number |
| size | integer | 10 | Items per page |

#### Example Response

```json
{
  "items": [
    {
      "id": 1,
      "name": "Standard Week",
      "description": "Standard 5-day work week pattern",
      "template_data": {
        "shifts": [...],
        "weekly_pattern": {...}
      },
      "active": true,
      "created_at": "2025-11-12T10:00:00"
    }
  ],
  "total": 3,
  "page": 1,
  "size": 10,
  "pages": 1
}
```

---

### 9. Create Template

**POST** `/api/shifts/templates`

Create a new shift template.

**Authorization:** Manager role required

#### Request Body

```json
{
  "name": "Standard Week",
  "description": "Standard 5-day work week pattern",
  "template_data": {
    "shifts": [
      {
        "name": "Morning Shift",
        "shift_type": "morning",
        "start_time": "06:00",
        "end_time": "14:00",
        "required_staff": 3,
        "department": "Kitchen"
      }
    ],
    "weekly_pattern": {
      "monday": ["shift_1", "shift_2"],
      "tuesday": ["shift_1", "shift_3"],
      "wednesday": ["shift_1", "shift_2"],
      "thursday": ["shift_1", "shift_3"],
      "friday": ["shift_1", "shift_2", "shift_3"]
    }
  },
  "active": true
}
```

#### Example Response (201 Created)

```json
{
  "message": "Shift template created successfully",
  "template": {
    "id": 1,
    "name": "Standard Week",
    "description": "Standard 5-day work week pattern",
    "template_data": {...},
    "active": true,
    "created_at": "2025-11-12T10:00:00"
  },
  "id": 1
}
```

---

### 10. Apply Template

**POST** `/api/shifts/templates/{template_id}/apply`

Apply a shift template to generate schedules.

**Authorization:** Manager role required

#### Path Parameters

- **template_id** (integer, required): ID of the template to apply

#### Query Parameters

- **start_date** (string, required): Start date (YYYY-MM-DD format)
- **end_date** (string, required): End date (YYYY-MM-DD format)

#### Example Request

```bash
POST /api/shifts/templates/1/apply?start_date=2025-11-15&end_date=2025-11-22
```

#### Example Response

```json
{
  "message": "Template applied successfully",
  "template_name": "Standard Week",
  "shifts_created": 15,
  "schedules_created": 45,
  "date_range": {
    "start": "2025-11-15",
    "end": "2025-11-22"
  }
}
```

#### Error Responses

- **400 Bad Request**: Invalid dates, inactive template, or start >= end
- **404 Not Found**: Template not found

---

## Validation Rules

### Shift Validation

1. **Time Validation**
   - `start_time` must be before `end_time`
   - Times must be valid 24-hour format (HH:MM)

2. **Staff Validation**
   - `required_staff` must be at least 1
   - Cannot be negative

3. **Rate Multiplier**
   - `hourly_rate_multiplier` must be >= 0
   - Typically ranges from 1.0 (standard) to 2.0 (double time)

4. **Conflict Detection**
   - System warns about overlapping shifts in same department
   - Does not prevent creation (manager decision)

### Template Validation

1. **Structure Validation**
   - `template_data` must be valid JSON object
   - Must contain required fields based on template type

2. **Date Range Validation**
   - `start_date` must be before `end_date`
   - Dates must be in YYYY-MM-DD format

---

## Common Use Cases

### Creating Morning/Afternoon/Evening Shifts

```bash
# Morning shift
POST /api/shifts
{
  "name": "Morning Kitchen",
  "shift_type": "morning",
  "start_time": "06:00:00",
  "end_time": "14:00:00",
  "required_staff": 3,
  "department": "Kitchen"
}

# Afternoon shift
POST /api/shifts
{
  "name": "Afternoon Kitchen",
  "shift_type": "afternoon",
  "start_time": "14:00:00",
  "end_time": "22:00:00",
  "required_staff": 4,
  "department": "Kitchen"
}
```

### Bulk Creating Department Shifts

```bash
POST /api/shifts/bulk
{
  "shifts": [
    {
      "name": "Kitchen Morning",
      "shift_type": "morning",
      "start_time": "06:00:00",
      "end_time": "14:00:00",
      "required_staff": 3,
      "department": "Kitchen"
    },
    {
      "name": "Front Desk Morning",
      "shift_type": "morning",
      "start_time": "08:00:00",
      "end_time": "16:00:00",
      "required_staff": 2,
      "department": "Reception"
    }
  ]
}
```

### Creating and Applying Template

```bash
# 1. Create template
POST /api/shifts/templates
{
  "name": "Restaurant Week",
  "description": "Standard restaurant shifts",
  "template_data": {
    "shifts": [
      {
        "name": "Breakfast",
        "shift_type": "morning",
        "start_time": "06:00",
        "end_time": "14:00",
        "required_staff": 2
      },
      {
        "name": "Dinner",
        "shift_type": "evening",
        "start_time": "16:00",
        "end_time": "23:00",
        "required_staff": 4
      }
    ]
  }
}

# 2. Apply template
POST /api/shifts/templates/1/apply?start_date=2025-11-15&end_date=2025-11-22
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Integration with Schedule System

Shifts integrate with the scheduling system:

1. **Schedule Creation**: Schedules reference shift definitions
2. **Validation**: System validates employee qualifications against shift requirements
3. **Deletion Protection**: Active shifts used in schedules cannot be deleted without force flag
4. **Templates**: Templates generate both shift definitions and schedule assignments

---

## Best Practices

1. **Naming Conventions**
   - Use descriptive names: "Kitchen Morning Shift" vs "Shift 1"
   - Include department in name for clarity

2. **Shift Types**
   - Use consistent shift_type values across organization
   - Standard types: morning, afternoon, evening, night

3. **Templates**
   - Create templates for recurring patterns
   - Test templates with short date ranges first
   - Keep template names descriptive

4. **Deletion**
   - Archive shifts (set active=false) instead of deleting
   - Use force delete only when necessary
   - Check schedule usage before deletion

5. **Bulk Operations**
   - Group related shifts in bulk create
   - Limit to 50 shifts per batch
   - Validate locally before sending

---

## Related APIs

- **Schedules API** - `/api/schedules` - Create schedule assignments
- **Employees API** - `/api/employees` - Manage employee qualifications
- **Analytics API** - `/api/analytics` - Analyze shift coverage and costs

---

## Support

For issues or questions about the Shift Management API, please contact the development team or refer to the main API documentation.
