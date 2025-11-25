# Qualifications and Availability Fields Implementation

## Overview

Added JSONB fields to the User model to support employee qualifications and weekly availability scheduling. This enables the frontend `EmployeeManagement.jsx` to persist collected data and supports advanced scheduling optimization.

## Database Changes

### New Fields in `users` Table

1. **`qualifications`** (JSONB, nullable)
   - Stores array of strings representing employee skills/certifications
   - Example: `["Python", "FastAPI", "PostgreSQL", "Docker"]`
   - Max 20 qualifications enforced at schema level

2. **`availability`** (JSONB, nullable)
   - Stores weekly schedule with day-based structure
   - Example:
     ```json
     {
       "monday": {
         "available": true,
         "start": "09:00",
         "end": "17:00"
       },
       "tuesday": {
         "available": false
       },
       "wednesday": {
         "available": true,
         "start": "10:00",
         "end": "18:00"
       }
     }
     ```

### Migration

**File**: `backend/migrations/versions/c7f8a9b1d2e3_add_qualifications_and_availability.py`

```bash
# Run migration
cd backend
alembic upgrade head
```

## Model Updates

### `backend/src/auth/models.py`

**Changes to User class:**

1. Added JSON column imports:
   ```python
   from sqlalchemy.dialects.postgresql import JSON
   ```

2. Added fields:
   ```python
   qualifications = Column(JSON, nullable=True)
   availability = Column(JSON, nullable=True)
   ```

3. Updated `__repr__()` method:
   ```python
   def __repr__(self):
       qual_count = len(self.qualifications) if self.qualifications else 0
       return f"<User {self.email} (phone={self.phone}, hire_date={self.hire_date}, qualifications={qual_count})>"
   ```

4. Updated `to_dict()` method to include new fields:
   ```python
   data = {
       # ... existing fields ...
       "qualifications": self.qualifications,
       "availability": self.availability,
   }
   ```

## Schema Validation

### `backend/src/schemas.py`

#### EmployeeCreate Schema

**Added Fields:**
```python
qualifications: Optional[List[str]] = Field(None, max_length=20, description="List of employee qualifications/skills")
availability: Optional[Dict[str, Any]] = Field(None, description="Weekly availability schedule")
```

**Qualifications Validator:**
- Validates list type
- Enforces max 20 qualifications
- Removes duplicates and empty strings
- Strips whitespace

**Availability Validator:**
- Validates dictionary structure
- Validates day names (monday-sunday, case-insensitive)
- Requires `available` boolean field for each day
- When `available=true`, requires `start` and `end` times
- Validates time format: HH:MM (00:00-23:59)
- Validates start < end for same-day shifts

#### EmployeeResponse Schema

**Added Fields:**
```python
qualifications: Optional[List[str]] = Field(None, description="Employee qualifications/skills")
availability: Optional[Dict[str, Any]] = Field(None, description="Weekly availability schedule")
```

## API Integration

The fields are now available in employee API endpoints:

### Create Employee
```http
POST /api/employees
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "qualifications": ["Python", "Docker", "PostgreSQL"],
  "availability": {
    "monday": {
      "available": true,
      "start": "09:00",
      "end": "17:00"
    },
    "tuesday": {
      "available": false
    }
  }
}
```

### Update Employee
```http
PUT /api/employees/{id}
Content-Type: application/json

{
  "qualifications": ["Python", "FastAPI", "React"],
  "availability": {
    "monday": {
      "available": true,
      "start": "10:00",
      "end": "18:00"
    }
  }
}
```

### Get Employee
```http
GET /api/employees/{id}

Response:
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "qualifications": ["Python", "Docker", "PostgreSQL"],
  "availability": {
    "monday": {
      "available": true,
      "start": "09:00",
      "end": "17:00"
    },
    "tuesday": {
      "available": false
    }
  },
  ...
}
```

## Testing

### Test File
**Location**: `backend/tests/test_jsonb_fields.py`

**Test Coverage:**

1. **Qualifications Tests**
   - Create user with qualifications list
   - Update qualifications
   - Handle null qualifications
   - Handle empty qualifications list

2. **Availability Tests**
   - Create user with availability schedule
   - Update availability
   - Handle null availability
   - Query users by availability

3. **to_dict() Tests**
   - Verify fields included in dictionary
   - Handle null values correctly

### Run Tests
```bash
cd backend
pytest tests/test_jsonb_fields.py -v
```

## Validation Examples

### Valid Qualifications
```python
✅ ["Python", "FastAPI", "PostgreSQL"]
✅ ["Skill 1", "Skill 2"]
✅ []  # Empty list
✅ None  # Null value
```

### Invalid Qualifications
```python
❌ ["Q1", "Q2", ...21 items]  # Max 20
❌ "Not a list"  # Must be list
```

### Valid Availability
```python
✅ {
    "monday": {"available": True, "start": "09:00", "end": "17:00"}
}
✅ {
    "tuesday": {"available": False}
}
✅ None  # Null value
```

### Invalid Availability
```python
❌ {
    "monday": {"available": True}  # Missing start/end when available=true
}
❌ {
    "monday": {"available": True, "start": "25:00", "end": "17:00"}  # Invalid time
}
❌ {
    "monday": {"available": True, "start": "17:00", "end": "09:00"}  # Start >= end
}
❌ {
    "invalidday": {"available": True}  # Invalid day name
}
```

## Use Cases

### 1. Scheduling Optimization
- Match employee qualifications to shift requirements
- Check employee availability before assignment
- Reduce scheduling conflicts

### 2. Skill Management
- Track employee certifications and training
- Identify skill gaps in departments
- Plan training programs

### 3. Availability Tracking
- Respect employee availability preferences
- Optimize shift coverage
- Reduce last-minute conflicts

## Future Enhancements

1. **Qualification Validation**
   - Pre-defined skill list
   - Skill categories/levels
   - Certification expiry dates

2. **Advanced Availability**
   - Date-specific overrides
   - Recurring patterns
   - Time-off integration

3. **Analytics**
   - Skill gap analysis
   - Availability heatmaps
   - Coverage reports

## Migration Notes

### Backwards Compatibility
- Fields are nullable, so existing users are unaffected
- No data migration required for existing records
- Frontend can handle null values gracefully

### Database Performance
- JSONB fields are indexable if needed
- Consider GIN index for frequent queries:
  ```sql
  CREATE INDEX idx_users_qualifications ON users USING GIN (qualifications);
  CREATE INDEX idx_users_availability ON users USING GIN (availability);
  ```

## Related Files

- **Model**: `backend/src/auth/models.py`
- **Schemas**: `backend/src/schemas.py`
- **Migration**: `backend/migrations/versions/c7f8a9b1d2e3_add_qualifications_and_availability.py`
- **Tests**: `backend/tests/test_jsonb_fields.py`
- **Frontend**: `frontend/src/pages/EmployeesPage.jsx` (EmployeeManagement.jsx)

## Summary

The qualifications and availability fields provide essential functionality for:
- ✅ Storing employee skills and certifications
- ✅ Tracking weekly availability schedules
- ✅ Supporting scheduling optimization
- ✅ Enabling qualification-based shift matching
- ✅ Comprehensive validation at schema level
- ✅ Full test coverage for JSONB operations

All data collected by the frontend is now persisted and available for scheduling and analytics.
