# Department Management System - API Summary

## Overview

Complete department management system with hierarchical organization support for the AI Schedule Manager.

## Database Schema

### Department Table
- **id**: Integer (Primary Key)
- **name**: String(100) - Unique, indexed
- **description**: Text (Optional)
- **parent_id**: Integer (Foreign Key to departments.id) - Self-referential for hierarchy
- **settings**: JSONB - Flexible configuration storage
- **active**: Boolean (Default: true)
- **created_at**: DateTime
- **updated_at**: DateTime

### Indexes
- Primary key on `id`
- Unique index on `name`
- Index on `parent_id` for efficient hierarchy queries
- Index on `active` for filtering

### Updated Models
- **Employee**: Added `department_id` (Foreign Key to departments.id)
- **Shift**: Changed `department` from String to `department_id` (Foreign Key to departments.id)

## API Endpoints

### Base URL: `/api/departments`

### 1. List Departments
**GET** `/api/departments`

Query Parameters:
- `active` (boolean, optional): Filter by active status
- `parent_id` (integer, optional): Filter by parent department
- `search` (string, optional): Search by name
- `page` (integer, default: 1): Page number
- `size` (integer, default: 10, max: 100): Items per page
- `sort_by` (string, default: "name"): Sort field
- `sort_order` (string, default: "asc"): Sort direction (asc/desc)

Response: Paginated list of departments with parent and children relationships

### 2. Get Single Department
**GET** `/api/departments/{department_id}`

Returns: Department with full hierarchy (parent and children loaded)

### 3. Create Department
**POST** `/api/departments`

Request Body:
```json
{
  "name": "string (required, unique)",
  "description": "string (optional)",
  "parent_id": "integer (optional)",
  "settings": "object (optional)",
  "active": "boolean (default: true)"
}
```

Requires: Manager role

### 4. Update Department
**PATCH** `/api/departments/{department_id}`

Request Body: (all fields optional)
```json
{
  "name": "string",
  "description": "string",
  "parent_id": "integer",
  "settings": "object",
  "active": "boolean"
}
```

Validation:
- Prevents circular hierarchy (department cannot be its own parent)
- Validates parent exists if parent_id provided

Requires: Manager role

### 5. Delete Department
**DELETE** `/api/departments/{department_id}`

Query Parameters:
- `force` (boolean, default: false): Force delete even with dependencies

Behavior:
- Default: Prevents deletion if department has employees, shifts, or child departments
- With `force=true`: Deletes department and nulls out foreign key references

Returns dependency information:
```json
{
  "message": "Department deleted successfully",
  "dependencies_cleared": {
    "employees": 0,
    "shifts": 0,
    "children": 0
  }
}
```

Requires: Manager role

### 6. Get Department Staff
**GET** `/api/departments/{department_id}/staff`

Query Parameters:
- `page` (integer, default: 1)
- `size` (integer, default: 10, max: 100)

Returns: Paginated list of employees assigned to the department

### 7. Get Department Shifts
**GET** `/api/departments/{department_id}/shifts`

Query Parameters:
- `page` (integer, default: 1)
- `size` (integer, default: 10, max: 100)

Returns: Paginated list of shifts assigned to the department

## CRUD Operations

### CRUDDepartment Class Methods

#### `get_with_hierarchy(db, department_id)`
Retrieves department with parent and children relationships loaded.

#### `get_multi_with_hierarchy(db, skip, limit, active, parent_id, search, sort_by, sort_order)`
Advanced filtering and pagination with hierarchy support.

#### `get_staff(db, department_id, skip, limit)`
Get all employees in a department with pagination.

#### `get_shifts(db, department_id, skip, limit)`
Get all shifts in a department with pagination.

#### `check_dependencies(db, department_id)`
Check for dependencies before deletion:
- Returns counts of employees, shifts, and child departments
- Returns `has_dependencies` boolean flag

## Migration File

**File**: `/backend/migrations/versions/002_add_departments.py`

### Upgrade Operations:
1. Creates `departments` table with all fields and indexes
2. Adds `department_id` column to `employees` table
3. Adds `department_id` column to `shifts` table
4. Creates foreign key constraints
5. Creates performance indexes
6. Removes old `department` string column from `shifts`

### Downgrade Operations:
- Reverses all changes
- Restores original schema

## Features

### Hierarchical Organization
- Self-referential parent-child relationships
- Support for nested department structures
- Cascade delete of child departments
- Prevention of circular references

### Business Logic
- Unique department names
- Optional parent department for hierarchy
- Flexible JSONB settings for department configuration
- Active/inactive status for soft deletion

### Performance
- Indexed fields for efficient queries
- Eager loading of relationships to prevent N+1 queries
- Pagination support on all list endpoints
- Optimized count queries

### Security
- Manager role required for create, update, delete operations
- All users can view departments
- Dependency checking prevents data integrity issues

## Usage Examples

### Create Root Department
```bash
POST /api/departments
{
  "name": "Operations",
  "description": "Main operations department",
  "active": true
}
```

### Create Child Department
```bash
POST /api/departments
{
  "name": "Kitchen",
  "description": "Kitchen operations",
  "parent_id": 1,
  "active": true
}
```

### List All Root Departments
```bash
GET /api/departments?parent_id=null&page=1&size=10
```

### Assign Employee to Department
```bash
PATCH /api/employees/{employee_id}
{
  "department_id": 1
}
```

### Assign Shift to Department
```bash
PATCH /api/shifts/{shift_id}
{
  "department_id": 1
}
```

## Integration Points

### Employee Management
- Employees can be assigned to departments via `department_id`
- Filter employees by department
- View all staff in a department via `/departments/{id}/staff`

### Shift Management
- Shifts can be assigned to departments via `department_id`
- Filter shifts by department
- View all shifts in a department via `/departments/{id}/shifts`

### Scheduling
- Department context available for schedule generation
- Can optimize schedules per department
- Support for department-specific constraints

## File Locations

- **Model**: `/backend/src/models.py` - Department, Employee, Shift models
- **Schemas**: `/backend/src/schemas.py` - DepartmentCreate, DepartmentUpdate, DepartmentResponse
- **CRUD**: `/backend/src/services/crud.py` - CRUDDepartment class
- **API**: `/backend/src/api/departments.py` - All REST endpoints
- **Migration**: `/backend/migrations/versions/002_add_departments.py`
- **Router Registration**: `/backend/src/main.py` - departments_router

## Testing Recommendations

1. Test hierarchy creation and retrieval
2. Test circular reference prevention
3. Test dependency checking before deletion
4. Test force deletion with dependencies
5. Test staff and shift assignment to departments
6. Test filtering and search functionality
7. Test pagination across all endpoints
8. Test permission requirements (manager vs regular user)

---

**Status**: Completed and committed to git
**Task Duration**: 216.80s
**Coordination**: Claude-Flow hooks integration
