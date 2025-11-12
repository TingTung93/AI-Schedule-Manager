# API Standardization to camelCase - Implementation Guide

## Overview

This document describes the comprehensive API standardization implementation that converts all API responses from snake_case (Python) to camelCase (JavaScript) for frontend consistency.

## Implementation Components

### 1. Serialization Utility (`/backend/src/utils/serializers.py`)

**Created:** ✅ Complete

Core utility functions for case conversion:

- `to_camel_case(snake_str)` - Convert snake_case → camelCase
- `to_snake_case(camel_str)` - Convert camelCase → snake_case
- `serialize_dict(data)` - Convert dictionary keys to camelCase
- `serialize_list(data)` - Convert list items to camelCase
- `deserialize_dict(data)` - Convert dictionary keys to snake_case
- `deserialize_list(data)` - Convert list items to snake_case
- `serialize_model(obj)` - Convert SQLAlchemy model to camelCase dict
- `serialize_response(data)` - Generic response serialization

**Examples:**
```python
# Basic conversion
to_camel_case("first_name")  # → "firstName"
to_snake_case("firstName")   # → "first_name"

# Dictionary conversion
serialize_dict({"first_name": "John", "employee_id": 1})
# → {"firstName": "John", "employeeId": 1}

# Nested structures
serialize_dict({
    "employee_info": {
        "first_name": "John",
        "work_schedule": [{"day_of_week": "Monday"}]
    }
})
# → {"employeeInfo": {"firstName": "John", "workSchedule": [{"dayOfWeek": "Monday"}]}}
```

### 2. Model Serialization Methods

**Created:** ✅ Complete

All models now have `to_dict(camelCase=True)` methods:

#### Employee Model
```python
employee.to_dict(camelCase=True)
# Returns:
{
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "role": "employee",
    "qualifications": ["Python", "JavaScript"],
    "availability": {...},
    "isActive": True,
    "isAdmin": False,
    "createdAt": "2025-01-01T00:00:00",
    "updatedAt": "2025-01-01T00:00:00"
}
```

#### Shift Model
```python
shift.to_dict(camelCase=True)
# Returns:
{
    "id": 1,
    "date": "2025-01-15",
    "startTime": "09:00:00",
    "endTime": "17:00:00",
    "shiftType": "general",
    "requiredStaff": 2,
    "requirements": {...},
    "description": "Morning shift",
    "priority": 1,
    "createdAt": "2025-01-01T00:00:00",
    "durationHours": 8.0,
    "isOvertime": False
}
```

#### Schedule Model
```python
schedule.to_dict(camelCase=True, include_assignments=False)
# Returns:
{
    "id": 1,
    "weekStart": "2025-01-13",
    "weekEnd": "2025-01-19",
    "status": "draft",
    "version": 1,
    "parentScheduleId": None,
    "title": "Week 3 Schedule",
    "description": null,
    "notes": null,
    "createdBy": 1,
    "approvedBy": None,
    "approvedAt": None,
    "publishedAt": None,
    "createdAt": "2025-01-10T10:00:00",
    "updatedAt": "2025-01-10T10:00:00",
    "isEditable": True,
    "isCurrentWeek": False,
    "daysUntilStart": 3
}
```

#### ScheduleAssignment Model
```python
assignment.to_dict(camelCase=True, include_relations=False)
# Returns:
{
    "id": 1,
    "scheduleId": 1,
    "employeeId": 2,
    "shiftId": 3,
    "status": "assigned",
    "priority": 1,
    "notes": None,
    "assignedBy": 1,
    "assignedAt": "2025-01-10T10:00:00",
    "conflictsResolved": False,
    "autoAssigned": True,
    "createdAt": "2025-01-10T10:00:00",
    "isActive": True,
    "isConfirmed": False,
    "needsConfirmation": True
}
```

#### Rule Model
```python
rule.to_dict(camelCase=True)
# Returns:
{
    "id": 1,
    "ruleText": "No more than 40 hours per week",
    "ruleType": "workload",
    "employeeId": None,
    "constraints": {"maxWeeklyHours": 40},
    "priority": 5,
    "active": True,
    "strict": True,
    "violationCount": 0,
    "effectiveFrom": None,
    "effectiveUntil": None,
    "description": "Standard workload limit",
    "tags": ["compliance", "hours"],
    "createdAt": "2025-01-01T00:00:00",
    "updatedAt": "2025-01-01T00:00:00",
    "isGlobal": True,
    "isEffective": True
}
```

#### Notification Model
```python
notification.to_dict(camelCase=True)
# Returns:
{
    "id": 1,
    "userId": 2,
    "type": "shift_assignment",
    "title": "New Shift Assignment",
    "message": "You have been assigned to work on Monday",
    "data": {...},
    "read": False,
    "readAt": None,
    "priority": "normal",
    "category": "assignment",
    "actionUrl": "/assignments/1",
    "actionText": "View Assignment",
    "relatedEntityType": "schedule_assignment",
    "relatedEntityId": 1,
    "deliveryMethod": "in_app",
    "emailSent": False,
    "emailSentAt": None,
    "pushSent": False,
    "pushSentAt": None,
    "expiresAt": None,
    "createdAt": "2025-01-10T10:00:00",
    "isExpired": False,
    "isUrgent": False,
    "ageHours": 2.5
}
```

### 3. Response Helper Functions

**Created:** ✅ Complete (`/backend/src/utils/response_helpers.py`)

Helper functions for creating standardized API responses:

```python
from backend.src.utils.response_helpers import (
    to_camel_response,
    paginated_response,
    success_response,
    error_response
)

# Convert any data to camelCase
data = to_camel_response(employee)
# or
data = to_camel_response([employee1, employee2, employee3])

# Create paginated response
response = paginated_response(items=employees, total=100, page=1, size=10)
# Returns:
{
    "items": [...],  # camelCase formatted items
    "total": 100,
    "page": 1,
    "size": 10,
    "pages": 10
}

# Create success response
response = success_response("Employee created successfully", data=employee)
# Returns:
{
    "success": True,
    "message": "Employee created successfully",
    "data": {...}  # camelCase formatted
}

# Create error response
response = error_response(
    "Validation failed",
    errors=["Email is required", "Name is too short"],
    code="VALIDATION_ERROR"
)
# Returns:
{
    "success": False,
    "message": "Validation failed",
    "errors": ["Email is required", "Name is too short"],
    "errorCode": "VALIDATION_ERROR"
}
```

### 4. Middleware Implementation

**Created:** ✅ Complete (`/backend/src/middleware/serialization_middleware.py`)

Two middleware options available:

#### Option 1: SerializationMiddleware (Generic)
Automatically converts all JSON responses to camelCase.

#### Option 2: ModelSerializationMiddleware (Recommended)
Uses model `to_dict()` methods for precise serialization.

**Integration in main.py:**
```python
from .middleware.serialization_middleware import ModelSerializationMiddleware

app.add_middleware(ModelSerializationMiddleware)
```

### 5. Comprehensive Test Suite

**Created:** ✅ Complete (`/backend/tests/test_serializers.py`)

Test coverage includes:
- ✅ Basic case conversion (snake_case ↔ camelCase)
- ✅ Dictionary serialization/deserialization
- ✅ List serialization/deserialization
- ✅ Nested structures
- ✅ Complex API response structures
- ✅ Edge cases (empty, None, unicode, special characters)
- ✅ Round-trip conversion
- ✅ Model serialization

**Run tests:**
```bash
cd backend
pytest tests/test_serializers.py -v
```

## Integration Instructions

### Step 1: Update main.py

Add imports:
```python
from .middleware.serialization_middleware import ModelSerializationMiddleware
from .utils.response_helpers import paginated_response, to_camel_response
```

Add middleware:
```python
app.add_middleware(ModelSerializationMiddleware)
```

### Step 2: Update API Endpoints

Replace Pydantic response models with helper functions:

**Before:**
```python
@app.get("/api/employees", response_model=PaginatedResponse)
async def get_employees(...):
    result = await crud_employee.get_multi_with_search(...)
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=page,
        size=size,
        pages=(result["total"] + size - 1) // size
    )
```

**After:**
```python
@app.get("/api/employees")
async def get_employees(...):
    result = await crud_employee.get_multi_with_search(...)
    return paginated_response(result["items"], result["total"], page, size)
```

**Before:**
```python
@app.get("/api/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: int, ...):
    employee = await crud_employee.get(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee
```

**After:**
```python
@app.get("/api/employees/{employee_id}")
async def get_employee(employee_id: int, ...):
    employee = await crud_employee.get(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return to_camel_response(employee)
```

### Step 3: Update All Endpoints

Apply the same pattern to all CRUD endpoints:

**✅ Employees:**
- GET /api/employees
- POST /api/employees
- GET /api/employees/{id}
- PATCH /api/employees/{id}
- DELETE /api/employees/{id}
- GET /api/employees/{id}/schedule

**✅ Schedules:**
- GET /api/schedules
- GET /api/schedules/{id}
- PATCH /api/schedules/{id}
- DELETE /api/schedules/{id}
- PATCH /api/schedules/{id}/shifts/{shift_id}

**✅ Rules:**
- POST /api/rules/parse
- GET /api/rules
- GET /api/rules/{id}
- PATCH /api/rules/{id}
- DELETE /api/rules/{id}

**✅ Notifications:**
- GET /api/notifications
- POST /api/notifications
- PATCH /api/notifications/{id}/read
- DELETE /api/notifications/{id}
- POST /api/notifications/mark-all-read

**✅ Other endpoints:**
- POST /api/schedule/generate
- POST /api/schedule/optimize
- GET /api/analytics/overview

## Frontend Migration Guide

### Changes Required in Frontend

**⚠️ IMPORTANT:** After API standardization, frontend code will receive camelCase responses automatically. No manual transformation needed.

### Components That Need Updates

#### 1. Remove Manual Case Conversions

**Before (manual transformation needed):**
```javascript
const employee = await api.get('/api/employees/1');
// Had to manually transform:
const transformed = {
    firstName: employee.first_name,
    lastName: employee.last_name,
    isActive: employee.is_active
};
```

**After (automatic camelCase):**
```javascript
const employee = await api.get('/api/employees/1');
// Already in camelCase:
console.log(employee.firstName);
console.log(employee.lastName);
console.log(employee.isActive);
```

#### 2. Update Type Definitions

**Before:**
```typescript
interface Employee {
    first_name: string;
    last_name: string;
    employee_id: number;
    is_active: boolean;
    created_at: string;
}
```

**After:**
```typescript
interface Employee {
    firstName: string;
    lastName: string;
    employeeId: number;
    isActive: boolean;
    createdAt: string;
}
```

#### 3. Component Updates Needed

Files that likely need updates (search for snake_case access patterns):

1. **Employee Management:**
   - `/frontend/src/components/EmployeeManagement.jsx`
   - `/frontend/src/components/EmployeeManagementValidated.jsx`
   - `/frontend/src/pages/EmployeesPage.jsx`

2. **Schedule Management:**
   - `/frontend/src/components/ScheduleDisplay.jsx`
   - `/frontend/src/pages/SchedulePage.jsx`
   - `/frontend/src/context/ScheduleContext.jsx`
   - `/frontend/src/hooks/useSchedule.js`

3. **Rules:**
   - `/frontend/src/components/RuleInput.jsx`
   - `/frontend/src/components/forms/RuleInputForm.jsx`
   - `/frontend/src/pages/RulesPage.jsx`

4. **Notifications:**
   - `/frontend/src/context/NotificationContext.jsx`
   - `/frontend/src/hooks/useNotifications.js`

5. **API Service:**
   - `/frontend/src/services/api.js`

### Search Patterns for Manual Cleanup

Use these regex patterns to find code that needs updating:

```bash
# Find snake_case property access
grep -r "\\.\\w*_\\w*" frontend/src

# Find snake_case in TypeScript interfaces
grep -r "^\\s*\\w*_\\w*:" frontend/src

# Find snake_case in object destructuring
grep -r "{\\s*\\w*_\\w*" frontend/src
```

## API Response Examples

### Before Standardization (snake_case)
```json
{
    "items": [
        {
            "id": 1,
            "first_name": "John",
            "last_name": "Doe",
            "employee_id": 123,
            "is_active": true,
            "created_at": "2025-01-01T00:00:00"
        }
    ],
    "total": 1,
    "page": 1,
    "page_size": 10
}
```

### After Standardization (camelCase)
```json
{
    "items": [
        {
            "id": 1,
            "firstName": "John",
            "lastName": "Doe",
            "employeeId": 123,
            "isActive": true,
            "createdAt": "2025-01-01T00:00:00"
        }
    ],
    "total": 1,
    "page": 1,
    "size": 10,
    "pages": 1
}
```

## Benefits

✅ **Consistency:** All API responses use JavaScript naming conventions
✅ **Type Safety:** Frontend types match API responses exactly
✅ **No Manual Transformation:** Automatic conversion on both request and response
✅ **Maintainable:** Centralized serialization logic
✅ **Testable:** Comprehensive test coverage
✅ **Flexible:** Can disable camelCase conversion when needed

## Testing

### Backend Tests

```bash
# Run serialization tests
cd backend
pytest tests/test_serializers.py -v

# Test specific function
pytest tests/test_serializers.py::TestCaseConversion::test_to_camel_case_simple -v
```

### API Testing

```bash
# Start backend
cd backend
python -m uvicorn src.main:app --reload

# Test endpoint with curl
curl http://localhost:8000/api/employees | jq

# Should return camelCase response:
# {
#   "items": [{"firstName": "John", "lastName": "Doe", ...}],
#   "total": 10,
#   "page": 1,
#   "size": 10,
#   "pages": 1
# }
```

## Rollback Plan

If issues arise, you can disable serialization temporarily:

1. **Comment out middleware:**
```python
# app.add_middleware(ModelSerializationMiddleware)
```

2. **Revert endpoint changes:**
```python
# Use original Pydantic response models
@app.get("/api/employees", response_model=PaginatedResponse)
```

3. **Frontend fallback:**
```javascript
// Add temporary transformer
const response = await api.get('/api/employees');
const transformed = transformSnakeToCamel(response);
```

## Status

- ✅ Serialization utility created
- ✅ All model to_dict() methods added
- ✅ Response helper functions created
- ✅ Middleware implemented
- ✅ Comprehensive tests written
- ⏳ Main.py integration (needs manual application)
- ⏳ Frontend components updated (needs review)
- ⏳ Type definitions updated (needs review)

## Next Steps

1. **Backend Integration:**
   - Apply middleware to main.py
   - Update all API endpoints to use response helpers
   - Run full test suite
   - Test all endpoints with Postman/curl

2. **Frontend Updates:**
   - Update TypeScript interfaces
   - Remove manual case transformations
   - Update component property access
   - Test all forms and data displays

3. **Documentation:**
   - Update API documentation
   - Update OpenAPI schema
   - Add migration guide for developers

4. **Deployment:**
   - Deploy to staging environment
   - Perform integration testing
   - Deploy to production

## Contact

For questions or issues with API standardization:
- Review this document
- Check test suite for examples
- Consult serializers.py for implementation details
