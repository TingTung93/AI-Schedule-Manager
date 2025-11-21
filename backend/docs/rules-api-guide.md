# Rules API Guide

## Overview

The Rules API provides endpoints for managing scheduling constraints and requirements in the AI Schedule Manager. Rules can be employee-specific or global, and they define constraints that the scheduling algorithm must respect.

## Endpoints

### GET `/api/rules/`
Get all scheduling rules with optional filtering.

**Query Parameters:**
- `employee_id` (optional): Filter by specific employee
- `rule_type` (optional): Filter by rule type (`availability`, `preference`, `requirement`, `restriction`)
- `active` (optional): Filter by active status (default: `true`)
- `skip` (optional): Pagination offset (default: `0`)
- `limit` (optional): Maximum results (default: `100`, max: `1000`)

**Response:** Array of rule objects

**Example:**
```bash
GET /api/rules/?rule_type=restriction&active=true
```

---

### POST `/api/rules/`
Create a new scheduling rule.

**Request Body:**
```json
{
  "rule_type": "restriction",
  "original_text": "Maximum 40 hours per week",
  "constraints": {
    "max_hours": 40,
    "period": "week"
  },
  "priority": 5,
  "employee_id": 123,
  "active": true
}
```

**Response:** Created rule object (HTTP 201)

---

### GET `/api/rules/{rule_id}`
Get a specific rule by ID.

**Response:** Rule object with employee details

**Error:** 404 if rule not found

---

### PUT `/api/rules/{rule_id}`
Update an existing rule.

**Request Body:** Partial rule object (only fields to update)
```json
{
  "original_text": "Updated constraint text",
  "priority": 4,
  "active": false
}
```

**Response:** Updated rule object

---

### DELETE `/api/rules/{rule_id}`
Delete a rule.

**Response:** 204 No Content on success

---

### POST `/api/rules/bulk`
Create multiple rules at once.

**Request Body:** Array of rule objects
```json
[
  {
    "rule_type": "restriction",
    "original_text": "Max 8 hours per day",
    "constraints": {"max_hours": 8, "period": "day"},
    "priority": 5,
    "employee_id": 123,
    "active": true
  },
  {
    "rule_type": "preference",
    "original_text": "Prefers morning shifts",
    "constraints": {"preferred_time": "morning"},
    "priority": 2,
    "employee_id": 123,
    "active": true
  }
]
```

**Response:** Array of created rules (HTTP 201)

**Note:** If any rule fails validation, the entire operation is rolled back.

---

### GET `/api/rules/employee/{employee_id}`
Get all rules for a specific employee.

**Response:** Array of employee-specific rules

---

## Rule Types

### `availability`
Defines when an employee is available to work.

**Example constraints:**
```json
{
  "unavailable_days": ["sunday", "monday"],
  "available_hours": {
    "tuesday": {"start": "09:00", "end": "17:00"}
  }
}
```

### `preference`
Defines employee scheduling preferences.

**Example constraints:**
```json
{
  "preferred_shifts": ["morning", "afternoon"],
  "preferred_days": ["tuesday", "wednesday", "thursday"]
}
```

### `requirement`
Defines required qualifications or certifications.

**Example constraints:**
```json
{
  "required_certifications": ["food_handler", "first_aid"],
  "required_training": ["safety_orientation"]
}
```

### `restriction`
Defines hard scheduling constraints.

**Example constraints:**
```json
{
  "max_hours_per_week": 40,
  "max_consecutive_days": 5,
  "min_rest_hours": 12,
  "max_shifts_per_day": 1
}
```

---

## Priority Levels

Rules have priority from 1 (lowest) to 5 (highest):

- **5**: Critical hard constraint (must be enforced)
- **4**: Important constraint (should be enforced)
- **3**: Normal constraint (preferred)
- **2**: Soft preference (nice to have)
- **1**: Optional preference (can be ignored)

---

## Using with Schedule Wizard

The wizard's Requirements step uses the Rules API to:

1. **List existing rules**: `GET /api/rules/?employee_id={id}`
2. **Create new constraints**: `POST /api/rules/bulk`
3. **Update rules**: `PUT /api/rules/{id}`

**Example workflow:**
```javascript
// Step 1: Get existing rules
const rules = await fetch('/api/rules/?employee_id=123');

// Step 2: Create new constraints from wizard
await fetch('/api/rules/bulk', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify([
    {
      rule_type: 'restriction',
      original_text: 'No more than 5 consecutive days',
      constraints: {max_consecutive_days: 5},
      priority: 5,
      employee_id: 123,
      active: true
    }
  ])
});
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- **200**: Success
- **201**: Created
- **204**: No Content (delete success)
- **404**: Resource not found
- **500**: Internal server error

**Error Response Format:**
```json
{
  "detail": "Employee 99999 not found"
}
```

---

## Best Practices

1. **Use bulk creation** for multiple rules to ensure atomicity
2. **Set appropriate priorities** based on business requirements
3. **Include descriptive original_text** for audit trails
4. **Use structured constraints** for programmatic validation
5. **Test rules** before activating in production schedules

---

## Integration with Scheduling Algorithm

Rules are automatically applied during schedule generation:

1. **Hard constraints** (priority 5) must be satisfied
2. **Soft constraints** (priority 1-4) are optimized when possible
3. **Conflicts** are reported with suggested resolutions
4. **Global rules** apply to all employees unless overridden

---

## Future Enhancements

Planned features:
- [ ] Rule validation endpoint
- [ ] Conflict detection API
- [ ] Rule templates library
- [ ] Natural language rule parsing
- [ ] Rule effectiveness analytics
