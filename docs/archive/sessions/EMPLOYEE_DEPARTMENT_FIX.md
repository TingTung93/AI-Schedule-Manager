# Employee and Department API Fix

## Issue Summary

User reported that after clicking "Add" on employee and department forms, nothing happened. Console showed timeout errors:

```
Network error: timeout of 10000ms exceeded
GET /api/employees - timeout
POST /api/employees - timeout
GET /api/departments - timeout
POST /api/departments - timeout
```

## Root Cause Analysis

### 1. Duplicate Endpoints
The main issue was **duplicate endpoint definitions** in `backend/src/main.py`:
- Lines 296-397 defined employee endpoints that used `crud_employee`
- These endpoints queried the deprecated `employees` table (which was empty)
- The `employees_router` from `src/api/employees.py` was being overridden
- Frontend timeouts occurred because queries to empty table returned no results, causing Pydantic validation to fail silently

### 2. Schema Mismatch
- `EmployeeResponse` schema expected fields from `Employee` model (role, phone, department, etc.)
- Database uses `User` model with different fields (first_name, last_name, email, is_active)
- Pydantic couldn't validate User objects against EmployeeBase schema

### 3. Table Migration
- Database was migrated from `employees` table to `users` table
- Seed script populated `users` table with 6 users
- Old `employees` table exists but is empty
- Employee router was still referencing the empty `employees` table via `Employee` model

## Fixes Applied

### 1. Updated Employees Router (`backend/src/api/employees.py`)

**Changed Model Reference:**
```python
# BEFORE:
from ..models.employee import Employee

# AFTER:
from ..models import User
```

**Updated All Endpoints to Use User Model:**
- GET `/api/employees` - Now queries `users` table
- GET `/api/employees/{id}` - Returns User objects
- POST `/api/employees` - Creates User with auto-generated email if not provided
- PUT `/api/employees/{id}` - Updates User fields
- DELETE `/api/employees/{id}` - Deletes User

**Auto-Generated Email for New Employees:**
```python
if not employee_data.email:
    email_base = f"{employee_data.first_name.lower()}.{employee_data.last_name.lower()}"
    email = f"{email_base}.{uuid.uuid4().hex[:8]}@temp.example.com"
```

### 2. Updated Employee Schemas (`backend/src/schemas.py`)

**EmployeeCreate - Only First/Last Name Required:**
```python
class EmployeeCreate(BaseModel):
    """Employee creation schema - only first_name and last_name required."""

    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = None
```

**EmployeeResponse - Maps to User Model:**
```python
class EmployeeResponse(BaseModel):
    """Employee response schema - maps to User model."""

    id: int
    first_name: str
    last_name: str
    email: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Optional fields
    role: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
```

### 3. Removed Duplicate Endpoints (`backend/src/main.py`)

**Commented Out Lines 296-412:**
- Removed duplicate GET `/api/employees`
- Removed duplicate POST `/api/employees`
- Removed duplicate GET `/api/employees/{id}`
- Removed duplicate PATCH `/api/employees/{id}`
- Removed duplicate DELETE `/api/employees/{id}`
- Removed GET `/api/employees/{id}/schedule`

**Added Comment:**
```python
# Employee endpoints - REMOVED IN FAVOR OF employees_router
# These endpoints query the deprecated employees table.
# The employees_router in src/api/employees.py uses the users table instead.
```

## Testing Results

### Employee Endpoints ✅

**GET /api/employees:**
```bash
Status: 200
Found: 6 employees
- Admin User
- Sarah Johnson
- Mike Williams
- John Smith
- Emily Davis
- David Brown
```

**POST /api/employees:**
```bash
Input: { "first_name": "Test", "last_name": "Employee" }
Status: 201
Created: Test Employee
Email: test.employee.16c5c85c@temp.example.com (auto-generated)
ID: 7
```

### Department Endpoints ✅

**GET /api/departments:**
```bash
Status: 200
Found: 4 departments
- Administration
- Sales
- Operations
- Support
```

**POST /api/departments:**
```bash
Input: { "name": "Test Department", "description": "A test department" }
Status: 201
Created: Test Department
ID: 5
```

## User Requirements Met

✅ Employee creation works - no timeout
✅ Department creation works - no timeout
✅ Only firstName and lastName are mandatory for employees
✅ Contact info (email, phone) is optional
✅ System auto-generates temp email if not provided
✅ Employees can add contact info later via update

## Database Schema

### Current Tables:
- **users** (6 rows) - Active, used by employees_router ✅
- **departments** (4 rows) - Active, used by departments_router ✅
- **employees** (0 rows) - Deprecated, empty ⚠️

### Users Table Fields:
```sql
id, email, password_hash, first_name, last_name, is_active,
is_verified, is_locked, created_at, updated_at
```

## Files Modified

1. `/backend/src/api/employees.py` - Updated to use User model
2. `/backend/src/schemas.py` - Simplified EmployeeCreate and EmployeeResponse
3. `/backend/src/main.py` - Commented out duplicate employee endpoints (lines 296-412)

## Notes

- The `employees` table still exists in the database but is not used
- All employee data is now stored in the `users` table
- Frontend should handle auto-generated emails (user can update later)
- Default password for new employees: "Employee123!"
- Departments endpoint was already working, no changes needed
