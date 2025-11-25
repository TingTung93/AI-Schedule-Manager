# Server-Side Search and Filtering Implementation

## Overview

Implemented comprehensive server-side search, filtering, and sorting capabilities for the `/api/employees` endpoint to improve performance and user experience.

## Features Implemented

### 1. Search Functionality
- **Endpoint**: `GET /api/employees?search=<query>`
- **Behavior**: Case-insensitive search across:
  - First name
  - Last name
  - Email address
- **Implementation**: Uses PostgreSQL `ILIKE` with `OR` operator for flexible matching

```python
if search:
    search_pattern = f'%{search}%'
    search_filter = or_(
        User.first_name.ilike(search_pattern),
        User.last_name.ilike(search_pattern),
        User.email.ilike(search_pattern)
    )
    query = query.where(search_filter)
```

### 2. Filtering

#### By Active Status
- **Parameter**: `is_active=true|false`
- **Usage**: `GET /api/employees?is_active=true`
- **Behavior**: Returns only active or inactive employees

#### By Department
- **Parameter**: `department_id=<int>`
- **Usage**: `GET /api/employees?department_id=5`
- **Behavior**: Returns employees in the specified department

#### By Role
- **Parameter**: `role=<role_name>`
- **Usage**: `GET /api/employees?role=admin`
- **Behavior**: Returns employees with the specified role
- **Note**: Requires a join with the `user_roles` table

```python
if role:
    query = query.join(User.roles).where(Role.name == role)
```

### 3. Sorting

#### Supported Fields
- `first_name` (default)
- `last_name`
- `email`
- `is_active`
- `department_id`

#### Sort Order
- `asc` (ascending, default)
- `desc` (descending)

#### Security
- Validates `sort_by` field against whitelist to prevent SQL injection
- Invalid fields default to `first_name`

```python
allowed_sort_fields = ['first_name', 'last_name', 'email', 'is_active', 'department_id']
if sort_by not in allowed_sort_fields:
    sort_by = 'first_name'
```

### 4. Pagination

- **Parameters**:
  - `skip` (default: 0) - Number of records to skip
  - `limit` (default: 100, max: 1000) - Maximum records to return

- **Response Format**:
```json
{
  "employees": [...],
  "total": 150,
  "skip": 0,
  "limit": 100
}
```

## Performance Optimizations

### 1. Eager Loading
- Prevents N+1 queries by using `selectinload` for relationships
- Loads roles eagerly when needed for filtering
- Bulk-loads departments in a single query

```python
query = select(User).options(
    selectinload(User.roles)
)
```

### 2. Efficient Count Query
- Gets total count before pagination
- Uses subquery to count filtered results

```python
count_query = select(func.count()).select_from(query.subquery())
total = total_result.scalar()
```

### 3. Bulk Department Loading
- Collects all unique department IDs
- Loads all departments in a single query
- Maps departments to users efficiently

## API Examples

### Basic Search
```bash
GET /api/employees?search=john
```

### Filter Active Users
```bash
GET /api/employees?is_active=true
```

### Sort by Last Name (Descending)
```bash
GET /api/employees?sort_by=last_name&sort_order=desc
```

### Combined: Search + Filter + Sort
```bash
GET /api/employees?search=admin&is_active=true&sort_by=email&sort_order=asc
```

### Pagination
```bash
GET /api/employees?skip=20&limit=10
```

### Full Example
```bash
GET /api/employees?search=user&department_id=5&is_active=true&sort_by=last_name&sort_order=asc&skip=0&limit=50
```

## Response Structure

### Success Response (200 OK)
```json
{
  "employees": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Admin",
      "email": "admin@example.com",
      "is_active": true,
      "department_id": 1,
      "department": {
        "id": 1,
        "name": "Engineering",
        ...
      },
      ...
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 100
}
```

### Error Response (500 Internal Server Error)
```json
{
  "detail": "Failed to fetch employees: <error message>"
}
```

## Authorization

- **Admins and Managers**: Can view all employees
- **Regular Users**: Can only view their own profile
- **Authentication**: Required (JWT token in Authorization header)

## Testing

### Manual Testing
```bash
# Login first
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# Get token from response, then test search
curl -X GET "http://localhost:8000/api/employees?search=admin&sort_by=email&sort_order=asc" \
  -H "Authorization: Bearer <token>"
```

### Automated Testing
See `backend/test_search_filter.py` for comprehensive test suite.

## Implementation Details

### File Modified
- `/home/peter/AI-Schedule-Manager/backend/src/api/employees.py`

### Changes Made
1. Added new query parameters: `search`, `sort_by`, `sort_order`
2. Imported `asc`, `or_` from SQLAlchemy
3. Updated return type from `List[EmployeeResponse]` to `dict`
4. Implemented search logic with `ILIKE` and `OR`
5. Implemented role filtering with join
6. Implemented sorting with validation
7. Added total count to response
8. Added bulk department loading for performance

### Lines of Code
- Approximately 100 lines of new/modified code
- Follows DRY, KISS, and single responsibility principles

## Future Enhancements

1. **Full-text search**: Implement PostgreSQL full-text search for better performance
2. **Advanced filters**: Add date range filters, multi-select roles, etc.
3. **Caching**: Implement Redis caching for frequently accessed queries
4. **GraphQL**: Consider GraphQL for more flexible client-side queries
5. **Elasticsearch**: For very large datasets, consider Elasticsearch integration

## Security Considerations

1. **SQL Injection Prevention**: All sort fields are validated against whitelist
2. **RBAC**: Role-based access control enforced for all queries
3. **Input Sanitization**: Search patterns are parameterized (not concatenated)
4. **Rate Limiting**: Existing rate limiting applies to this endpoint

## Commit Message

```
feat: Implement server-side search, filtering, and sorting

- Add search across first_name, last_name, and email
- Implement filters for role, department, and active status
- Add sorting by multiple fields (asc/desc)
- Include total count in response for pagination
- Optimize with eager loading to prevent N+1 queries
- Bulk-load departments for better performance
- Validate sort fields to prevent SQL injection
```
