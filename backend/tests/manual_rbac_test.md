# Manual RBAC Testing Guide

This guide provides step-by-step instructions for manually testing the RBAC implementation on employee endpoints.

## Prerequisites

1. Backend server running
2. At least 3 test users with different roles:
   - Admin user
   - Manager user
   - Regular employee user

## Test Scenarios

### Scenario 1: GET /api/employees (List all employees)

#### Test 1.1: Admin views all employees
```bash
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

Expected: 200 OK, returns all employees
```

#### Test 1.2: Manager views all employees
```bash
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer <MANAGER_TOKEN>"

Expected: 200 OK, returns all employees
```

#### Test 1.3: Employee views list
```bash
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>"

Expected: 200 OK, returns only their own profile
```

### Scenario 2: GET /api/employees/{id} (Get specific employee)

#### Test 2.1: Admin views any employee
```bash
curl -X GET http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

Expected: 200 OK, returns employee data
```

#### Test 2.2: Employee views own profile
```bash
curl -X GET http://localhost:8000/api/employees/<THEIR_ID> \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>"

Expected: 200 OK, returns their profile
```

#### Test 2.3: Employee tries to view another employee
```bash
curl -X GET http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>"

Expected: 403 Forbidden
```

### Scenario 3: POST /api/employees (Create employee)

#### Test 3.1: Admin creates employee
```bash
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Employee",
    "email": "test@example.com"
  }'

Expected: 201 Created
```

#### Test 3.2: Manager creates employee
```bash
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Manager",
    "last_name": "Created",
    "email": "mgr@example.com"
  }'

Expected: 201 Created
```

#### Test 3.3: Employee tries to create employee
```bash
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Unauthorized",
    "last_name": "Create",
    "email": "unauth@example.com"
  }'

Expected: 403 Forbidden
```

### Scenario 4: PATCH /api/employees/{id} (Update employee)

#### Test 4.1: Admin updates any employee
```bash
curl -X PATCH http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Updated"
  }'

Expected: 200 OK
```

#### Test 4.2: Manager updates employee
```bash
curl -X PATCH http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Manager Update"
  }'

Expected: 200 OK
```

#### Test 4.3: Employee updates own profile
```bash
curl -X PATCH http://localhost:8000/api/employees/<THEIR_ID> \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Self Update"
  }'

Expected: 200 OK
```

#### Test 4.4: Employee tries to update another employee
```bash
curl -X PATCH http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Unauthorized"
  }'

Expected: 403 Forbidden
```

### Scenario 5: Role Changes (Special permission check)

#### Test 5.1: Admin changes user role
```bash
curl -X PATCH http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "manager"
  }'

Expected: 200 OK
```

#### Test 5.2: Manager tries to change role
```bash
curl -X PATCH http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'

Expected: 403 Forbidden with message about administrators only
```

### Scenario 6: DELETE /api/employees/{id} (Delete employee)

#### Test 6.1: Admin deletes employee
```bash
curl -X DELETE http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

Expected: 204 No Content
```

#### Test 6.2: Manager tries to delete employee
```bash
curl -X DELETE http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <MANAGER_TOKEN>"

Expected: 403 Forbidden
```

#### Test 6.3: Employee tries to delete employee
```bash
curl -X DELETE http://localhost:8000/api/employees/5 \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>"

Expected: 403 Forbidden
```

## Expected Results Summary

| Endpoint | Method | Admin | Manager | Employee |
|----------|--------|-------|---------|----------|
| /api/employees | GET | All employees | All employees | Own profile only |
| /api/employees/{id} | GET | Any employee | Any employee | Own profile only |
| /api/employees | POST | ✅ | ✅ | ❌ 403 |
| /api/employees/{id} | PATCH | ✅ | ✅ | Own profile ✅, Others ❌ |
| /api/employees/{id} (role) | PATCH | ✅ | ❌ 403 | ❌ 403 |
| /api/employees/{id} | DELETE | ✅ | ❌ 403 | ❌ 403 |

## Audit Trail Verification

After performing updates, check that audit logs are created:

```bash
curl -X GET http://localhost:8000/api/employees/{id}/department-history \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

curl -X GET http://localhost:8000/api/employees/{id}/role-history \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected: Audit records showing who made changes, when, and what was changed.

## Troubleshooting

### 401 Unauthorized
- Check that the token is valid and not expired
- Ensure the Authorization header is formatted correctly: `Bearer <token>`

### 403 Forbidden
- Verify the user has the required role
- For resource-based checks, ensure the user is accessing their own resource

### 500 Internal Server Error
- Check server logs for detailed error messages
- Verify database connections
- Check that all required fields are provided in request body
