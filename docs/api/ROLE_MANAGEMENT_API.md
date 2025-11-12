# Role Management API Documentation

## Overview

This document describes the required API endpoints for the Role Management feature. These endpoints need to be implemented in the backend to support the RoleManager UI component.

## Backend Status

The backend already has comprehensive role and permission models in place:
- `Role` model with many-to-many relationships with Users and Permissions
- `Permission` model with resource and action fields
- Built-in roles: admin, manager, user, guest
- Default permissions for user, schedule, and system resources

## Required API Endpoints

### 1. List All Roles

```
GET /api/roles
```

**Description**: Retrieve all roles with their permissions and user counts.

**Response**:
```json
{
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "description": "System administrator with full access",
      "permissions": ["user.manage", "schedule.manage", "system.admin"],
      "userCount": 2,
      "isBuiltIn": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Get Single Role

```
GET /api/roles/{id}
```

**Description**: Get detailed information about a specific role.

**Response**:
```json
{
  "id": 1,
  "name": "admin",
  "description": "System administrator with full access",
  "permissions": [
    {
      "id": 1,
      "name": "user.manage",
      "description": "Full user management",
      "resource": "user",
      "action": "manage"
    }
  ],
  "users": [
    {
      "id": 1,
      "email": "admin@example.com",
      "first_name": "Admin",
      "last_name": "User"
    }
  ],
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 3. Create Role

```
POST /api/roles
```

**Authorization**: Admin only

**Request Body**:
```json
{
  "name": "custom_role",
  "description": "Custom role description",
  "permissions": ["user.read", "schedule.read"]
}
```

**Response**:
```json
{
  "id": 5,
  "name": "custom_role",
  "description": "Custom role description",
  "permissions": ["user.read", "schedule.read"],
  "created_at": "2025-01-12T00:00:00Z"
}
```

### 4. Update Role

```
PATCH /api/roles/{id}
```

**Authorization**: Admin only

**Request Body**:
```json
{
  "description": "Updated description",
  "permissions": ["user.read", "schedule.read", "schedule.write"]
}
```

**Response**: Updated role object

**Notes**:
- Cannot modify name of built-in roles (admin, manager, user, guest)
- Can modify permissions for all roles

### 5. Delete Role

```
DELETE /api/roles/{id}
```

**Authorization**: Admin only

**Response**:
```json
{
  "message": "Role deleted successfully"
}
```

**Constraints**:
- Cannot delete built-in roles (admin, manager, user, guest)
- Should handle users with this role (reassign or prevent deletion)

### 6. Get All Permissions

```
GET /api/roles/permissions
```

**Description**: Get list of all available permissions for role assignment.

**Response**:
```json
{
  "permissions": [
    {
      "id": 1,
      "name": "user.read",
      "description": "Read user information",
      "resource": "user",
      "action": "read"
    }
  ],
  "categories": {
    "user": ["user.read", "user.write", "user.delete", "user.manage"],
    "schedule": ["schedule.read", "schedule.write", "schedule.delete", "schedule.manage"],
    "system": ["system.admin", "system.audit", "system.config"]
  }
}
```

### 7. Assign Role to User

```
POST /api/roles/{id}/assign
```

**Authorization**: Admin only

**Request Body**:
```json
{
  "userId": 10
}
```

**Response**:
```json
{
  "message": "Role assigned successfully",
  "user": {
    "id": 10,
    "email": "user@example.com",
    "roles": ["user", "custom_role"]
  }
}
```

### 8. Remove Role from User

```
DELETE /api/roles/{id}/users/{userId}
```

**Authorization**: Admin only

**Response**:
```json
{
  "message": "Role removed successfully"
}
```

## Implementation Notes

### Database Queries

The backend already has the necessary models. The API endpoints should use:

```python
from src.auth.models import Role, Permission, User, user_roles

# Get roles with user counts
roles = session.query(Role).all()
for role in roles:
    role.user_count = len(role.users)
    role.is_built_in = role.name in ['admin', 'manager', 'user', 'guest']

# Assign role to user
user = session.query(User).get(user_id)
role = session.query(Role).get(role_id)
if role not in user.roles:
    user.roles.append(role)
session.commit()
```

### Authorization

All endpoints should be protected:
- Require authentication (valid JWT token)
- Require admin role for all operations
- Can optionally allow managers to view roles

### Validation

- Role names must be unique
- Role names must be alphanumeric with underscores only
- Cannot delete roles that have users assigned (or auto-reassign)
- Permission names must exist in the permissions table

### Error Handling

Standard error responses:
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

Status codes:
- 200: Success
- 201: Created
- 400: Bad request (validation error)
- 401: Unauthorized
- 403: Forbidden (not admin)
- 404: Not found
- 409: Conflict (duplicate name)
- 500: Server error

## Frontend Integration

The RoleManager component at `/frontend/src/pages/RoleManager.jsx` is already built and ready to consume these endpoints. It includes:

1. Role list view with cards
2. Permission matrix with categorized checkboxes
3. Role creation/editing dialog
4. Role assignment interface
5. Protection against deleting built-in roles
6. Fallback to mock data if API is unavailable

## Testing

Once endpoints are implemented, test:
1. Create custom role with permissions
2. Update role permissions
3. Assign role to user
4. Remove role from user
5. Delete custom role
6. Attempt to delete built-in role (should fail)
7. Attempt to create duplicate role name (should fail)
8. Non-admin user access (should be forbidden)

## Migration Guide

If implementing these endpoints in FastAPI (current backend):

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.auth.models import Role, Permission, User
from src.auth.fastapi_integration import get_current_user, require_role

router = APIRouter(prefix="/api/roles", tags=["roles"])

@router.get("/")
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Implementation
    pass

@router.post("/")
async def create_role(
    role_data: dict,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    # Implementation
    pass

# ... other endpoints
```

Register in main app:
```python
from src.api.roles import router as roles_router
app.include_router(roles_router)
```
