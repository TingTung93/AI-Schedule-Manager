# Parallel Agent Implementation Todo List
## Employee Management System Frontend/Backend Alignment

**Generated**: 2025-11-25
**Review Reference**: docs/EMPLOYEE_SYSTEM_REVIEW_SUMMARY.md
**Total Tasks**: 350+
**Estimated Effort**: 52 hours (with parallel execution)
**Recommended Agents**: 6-8 concurrent agents

---

## 📋 EXECUTION STRATEGY

### Agent Coordination Protocol
Each agent should:
1. ✅ Mark task as IN_PROGRESS before starting
2. 🔄 Update task status during work
3. ✅ Mark task as COMPLETED when done
4. 💾 Commit changes with descriptive message
5. 📢 Notify other agents via memory system

### Parallel Execution Guidelines
- **Independent tasks**: Execute simultaneously
- **Dependent tasks**: Wait for prerequisites
- **Shared files**: Use Git branches to avoid conflicts
- **Testing**: Each agent tests their own changes
- **Integration**: Coordinate before merging

---

## 🚨 WEEK 1: CRITICAL PRIORITY (4 Agents)

### AGENT 1: Backend Model & Migration Specialist
**Branch**: `feature/add-phone-hiredate-fields`
**Prerequisites**: None
**Execution**: Can start immediately

#### Tasks
- [ ] 1.1 Open `backend/src/auth/models.py`
- [ ] 1.2 Add `phone` field to User model after email field
  ```python
  phone = Column(String(20), nullable=True, index=True)
  ```
- [ ] 1.3 Add `hire_date` field to User model after phone
  ```python
  hire_date = Column(Date, nullable=True)
  ```
- [ ] 1.4 Update User model `__repr__` method to include new fields
- [ ] 1.5 Create Alembic migration
  ```bash
  cd backend
  alembic revision --autogenerate -m "add_phone_and_hire_date_to_users"
  ```
- [ ] 1.6 Review generated migration file in `backend/migrations/versions/`
- [ ] 1.7 Test migration up
  ```bash
  alembic upgrade head
  ```
- [ ] 1.8 Test migration down
  ```bash
  alembic downgrade -1
  alembic upgrade head
  ```
- [ ] 1.9 Verify fields exist in database
  ```bash
  psql -d schedule_db -c "\d users"
  ```
- [ ] 1.10 Commit changes
  ```bash
  git add backend/src/auth/models.py backend/migrations/versions/*
  git commit -m "feat: Add phone and hire_date fields to User model"
  ```

**Estimated Time**: 2 hours
**Dependencies**: None
**Blocks**: Agent 2 (needs model changes)

---

### AGENT 2: Backend API Schema Specialist
**Branch**: `feature/update-employee-schemas`
**Prerequisites**: Agent 1 completes tasks 1.1-1.5
**Execution**: Can start when User model is updated

#### Tasks
- [ ] 2.1 Open `backend/src/api/employees.py`
- [ ] 2.2 Locate `EmployeeCreate` Pydantic schema (around line 100)
- [ ] 2.3 Add `phone` field to EmployeeCreate
  ```python
  phone: Optional[str] = Field(None, max_length=20, regex=r'^\+?[1-9]\d{1,14}$')
  ```
- [ ] 2.4 Add `hire_date` field to EmployeeCreate
  ```python
  hire_date: Optional[date] = Field(None, description="Employee hire date")
  ```
- [ ] 2.5 Add phone format validator
  ```python
  @validator('phone')
  def validate_phone(cls, v):
      if v and not re.match(r'^\+?[1-9]\d{1,14}$', v):
          raise ValueError('Invalid phone format. Use international format.')
      return v
  ```
- [ ] 2.6 Add hire_date validator
  ```python
  @validator('hire_date')
  def validate_hire_date(cls, v):
      if v and v > date.today():
          raise ValueError('Hire date cannot be in the future')
      if v and v.year < 1900:
          raise ValueError('Hire date cannot be before 1900')
      return v
  ```
- [ ] 2.7 Update `EmployeeUpdate` schema with same fields (all Optional)
- [ ] 2.8 Add `role` field to EmployeeUpdate
  ```python
  role: Optional[str] = Field(None, regex=r'^(employee|manager|admin)$')
  ```
- [ ] 2.9 Add role validator
  ```python
  @validator('role')
  def validate_role(cls, v):
      valid_roles = ['employee', 'manager', 'admin']
      if v and v not in valid_roles:
          raise ValueError(f'Invalid role. Must be one of: {", ".join(valid_roles)}')
      return v
  ```
- [ ] 2.10 Update `EmployeeResponse` schema to include phone and hire_date
- [ ] 2.11 Import required modules at top of file
  ```python
  from datetime import date
  import re
  from pydantic import Field, validator
  ```
- [ ] 2.12 Test schema validation with pytest
  ```bash
  pytest backend/tests/test_employee_schemas.py -v
  ```
- [ ] 2.13 Commit changes
  ```bash
  git add backend/src/api/employees.py
  git commit -m "feat: Add phone, hire_date, and role fields to employee schemas with validation"
  ```

**Estimated Time**: 3 hours
**Dependencies**: Agent 1 (tasks 1.1-1.5)
**Blocks**: Agent 3, Agent 4

---

### AGENT 3: Backend Role Assignment Implementation
**Branch**: `feature/role-assignment-api`
**Prerequisites**: Agent 2 completes schema updates
**Execution**: Can start after schemas updated

#### Tasks
- [ ] 3.1 Open `backend/src/auth/models.py`
- [ ] 3.2 Review `user_roles` table structure and User relationship
- [ ] 3.3 Open `backend/src/api/employees.py`
- [ ] 3.4 Create helper function `update_user_role` (after imports, before routes)
  ```python
  async def update_user_role(
      db: AsyncSession,
      user_id: int,
      new_role: str,
      changed_by_id: int,
      reason: Optional[str] = None
  ) -> bool:
      """Update user role and log the change."""
      # Get current role from user_roles table
      # Update user_roles table
      # Create RoleChangeHistory entry
      # Return success/failure
  ```
- [ ] 3.5 Create `RoleChangeHistory` model in `backend/src/models/role_history.py`
  ```python
  class RoleChangeHistory(Base):
      __tablename__ = "role_change_history"
      id = Column(Integer, primary_key=True)
      user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
      old_role = Column(String(50))
      new_role = Column(String(50), nullable=False)
      changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
      changed_at = Column(DateTime, default=datetime.utcnow)
      reason = Column(Text)
      metadata_json = Column(JSON)
  ```
- [ ] 3.6 Create Alembic migration for RoleChangeHistory table
  ```bash
  alembic revision --autogenerate -m "create_role_change_history_table"
  ```
- [ ] 3.7 In PATCH /api/employees/{id} endpoint, add role change logic
  ```python
  if employee_data.role and employee_data.role != user.role:
      success = await update_user_role(
          db, employee_id, employee_data.role,
          current_user.id, reason="Role updated via API"
      )
      if not success:
          raise HTTPException(status_code=400, detail="Failed to update role")
  ```
- [ ] 3.8 Add GET /api/employees/{id}/role-history endpoint
  ```python
  @router.get("/{employee_id}/role-history")
  async def get_role_history(
      employee_id: int,
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      # Query RoleChangeHistory with enriched data
  ```
- [ ] 3.9 Test role assignment with existing users
  ```bash
  pytest backend/tests/test_role_assignment.py -v
  ```
- [ ] 3.10 Verify role changes persist in user_roles table
- [ ] 3.11 Verify RoleChangeHistory records created
- [ ] 3.12 Commit changes
  ```bash
  git add backend/src/api/employees.py backend/src/models/role_history.py backend/migrations/
  git commit -m "feat: Implement role assignment API with audit logging"
  ```

**Estimated Time**: 4 hours
**Dependencies**: Agent 2 (schema updates)
**Blocks**: Frontend role assignment work

---

### AGENT 4: Backend Validation Enhancement
**Branch**: `feature/enhanced-validation`
**Prerequisites**: Agent 2 completes schema updates
**Execution**: Can start in parallel with Agent 3

#### Tasks
- [ ] 4.1 Open `backend/src/api/employees.py`
- [ ] 4.2 Locate all Pydantic schemas (EmployeeCreate, EmployeeUpdate)
- [ ] 4.3 Add Config class to reject unknown fields
  ```python
  class EmployeeCreate(BaseModel):
      # ... existing fields ...

      class Config:
          extra = 'forbid'  # Reject unknown fields
  ```
- [ ] 4.4 Add same to EmployeeUpdate schema
- [ ] 4.5 Enhance email validation with comprehensive regex
  ```python
  @validator('email')
  def validate_email_format(cls, v):
      if v:
          pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
          if not re.match(pattern, v):
              raise ValueError('Invalid email format. Please enter a valid email address.')
      return v
  ```
- [ ] 4.6 Add first_name validation
  ```python
  first_name: str = Field(..., min_length=2, max_length=100, regex=r"^[A-Za-z '-]+$")

  @validator('first_name')
  def validate_first_name(cls, v):
      if not re.match(r"^[A-Za-z '-]+$", v):
          raise ValueError('Name must contain only letters, spaces, hyphens, and apostrophes')
      return v.strip()
  ```
- [ ] 4.7 Add last_name validation (same as first_name)
- [ ] 4.8 Update error response format to include field names
  ```python
  # In exception handlers
  except ValidationError as e:
      errors = []
      for error in e.errors():
          errors.append({
              'field': '.'.join(str(x) for x in error['loc']),
              'message': error['msg'],
              'code': error['type']
          })
      raise HTTPException(status_code=422, detail={'errors': errors})
  ```
- [ ] 4.9 Test validation with invalid data
  ```bash
  pytest backend/tests/test_validation.py -v
  ```
- [ ] 4.10 Test error response format
- [ ] 4.11 Document all validation rules in docstrings
- [ ] 4.12 Commit changes
  ```bash
  git add backend/src/api/employees.py
  git commit -m "feat: Enhanced field validation with clear error messages"
  ```

**Estimated Time**: 2 hours
**Dependencies**: Agent 2 (schema updates)
**Blocks**: Frontend validation integration

---

## 🔒 WEEK 2: SECURITY PRIORITY (5 Agents)

### AGENT 5: RBAC Foundation
**Branch**: `feature/rbac-foundation`
**Prerequisites**: None (independent work)
**Execution**: Can start immediately

#### Tasks
- [ ] 5.1 Create `backend/src/auth/permissions.py` file
- [ ] 5.2 Import required dependencies
  ```python
  from fastapi import Depends, HTTPException, status
  from typing import List, Optional
  from sqlalchemy.ext.asyncio import AsyncSession
  from src.auth.models import User
  from src.database import get_db
  from src.auth.dependencies import get_current_user
  ```
- [ ] 5.3 Create Permission enum
  ```python
  from enum import Enum

  class Permission(str, Enum):
      CREATE_EMPLOYEE = "create:employee"
      READ_EMPLOYEE = "read:employee"
      UPDATE_EMPLOYEE = "update:employee"
      DELETE_EMPLOYEE = "delete:employee"
      MANAGE_ROLES = "manage:roles"
      MANAGE_DEPARTMENTS = "manage:departments"
      VIEW_AUDIT_LOGS = "view:audit_logs"
  ```
- [ ] 5.4 Create role-permission mapping
  ```python
  ROLE_PERMISSIONS = {
      "admin": [
          Permission.CREATE_EMPLOYEE,
          Permission.READ_EMPLOYEE,
          Permission.UPDATE_EMPLOYEE,
          Permission.DELETE_EMPLOYEE,
          Permission.MANAGE_ROLES,
          Permission.MANAGE_DEPARTMENTS,
          Permission.VIEW_AUDIT_LOGS,
      ],
      "manager": [
          Permission.CREATE_EMPLOYEE,
          Permission.READ_EMPLOYEE,
          Permission.UPDATE_EMPLOYEE,
          Permission.MANAGE_DEPARTMENTS,
      ],
      "employee": [
          Permission.READ_EMPLOYEE,  # Only own profile
      ]
  }
  ```
- [ ] 5.5 Implement `check_user_role` function
  ```python
  async def check_user_role(user: User, allowed_roles: List[str]) -> bool:
      """Check if user has one of the allowed roles."""
      # Query user_roles table for user's current role
      # Return True if user.role in allowed_roles
  ```
- [ ] 5.6 Implement `check_user_permission` function
  ```python
  async def check_user_permission(user: User, permission: Permission) -> bool:
      """Check if user has specific permission."""
      user_role = await get_user_role(user)
      return permission in ROLE_PERMISSIONS.get(user_role, [])
  ```
- [ ] 5.7 Implement `require_role` dependency
  ```python
  def require_role(allowed_roles: List[str]):
      """Dependency that requires user to have one of the specified roles."""
      async def role_checker(
          current_user: User = Depends(get_current_user),
          db: AsyncSession = Depends(get_db)
      ):
          has_role = await check_user_role(current_user, allowed_roles)
          if not has_role:
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail=f"This action requires one of the following roles: {', '.join(allowed_roles)}"
              )
          return current_user
      return role_checker
  ```
- [ ] 5.8 Implement `require_permission` dependency
  ```python
  def require_permission(permission: Permission):
      """Dependency that requires user to have specific permission."""
      # Similar to require_role but checks permissions
  ```
- [ ] 5.9 Implement helper `get_user_role` function
  ```python
  async def get_user_role(user: User, db: AsyncSession) -> str:
      """Get user's current role from user_roles table."""
      # Query user_roles and return role string
  ```
- [ ] 5.10 Create permission matrix documentation
  ```python
  """
  Permission Matrix:

  | Role     | Create | Read | Update | Delete | Manage Roles | Manage Depts |
  |----------|--------|------|--------|--------|--------------|--------------|
  | Admin    | ✅     | ✅   | ✅     | ✅     | ✅           | ✅           |
  | Manager  | ✅     | ✅   | ✅     | ❌     | ❌           | ✅           |
  | Employee | ❌     | ✅*  | ✅*    | ❌     | ❌           | ❌           |

  * Employee can only read/update own profile
  """
  ```
- [ ] 5.11 Write unit tests for permission checking
  ```bash
  pytest backend/tests/test_permissions.py -v
  ```
- [ ] 5.12 Commit changes
  ```bash
  git add backend/src/auth/permissions.py
  git commit -m "feat: Implement RBAC foundation with role and permission checking"
  ```

**Estimated Time**: 4 hours
**Dependencies**: None
**Blocks**: Agent 6 (API implementation)

---

### AGENT 6: RBAC API Implementation
**Branch**: `feature/rbac-api-protection`
**Prerequisites**: Agent 5 completes RBAC foundation
**Execution**: Must wait for Agent 5

#### Tasks
- [ ] 6.1 Open `backend/src/api/employees.py`
- [ ] 6.2 Import permission dependencies
  ```python
  from src.auth.permissions import require_role, require_permission, Permission
  ```
- [ ] 6.3 Add authorization to POST /api/employees endpoint
  ```python
  @router.post("",
      dependencies=[Depends(require_role(["admin", "manager"]))],
      status_code=status.HTTP_201_CREATED,
      response_model=EmployeeResponse
  )
  async def create_employee(...):
  ```
- [ ] 6.4 Add authorization to PATCH /api/employees/{id} endpoint
  ```python
  @router.patch("/{employee_id}",
      dependencies=[Depends(require_role(["admin", "manager"]))],
      response_model=EmployeeResponse
  )
  async def update_employee(...):
  ```
- [ ] 6.5 Add resource-based authorization in update_employee
  ```python
  # Inside update_employee function
  if current_user.role == "employee" and current_user.id != employee_id:
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Employees can only update their own profile"
      )
  ```
- [ ] 6.6 Add special authorization for role changes
  ```python
  # In update_employee, before role change logic
  if employee_data.role:
      has_permission = await check_user_permission(current_user, Permission.MANAGE_ROLES)
      if not has_permission:
          raise HTTPException(
              status_code=status.HTTP_403_FORBIDDEN,
              detail="Only administrators can change employee roles"
          )
  ```
- [ ] 6.7 Add authorization to DELETE /api/employees/{id} endpoint
  ```python
  @router.delete("/{employee_id}",
      dependencies=[Depends(require_role(["admin"]))],
      status_code=status.HTTP_204_NO_CONTENT
  )
  async def delete_employee(...):
  ```
- [ ] 6.8 Add authorization to GET /api/employees/unassigned
  ```python
  @router.get("/unassigned",
      dependencies=[Depends(require_role(["admin", "manager"]))],
      response_model=List[EmployeeResponse]
  )
  async def get_unassigned_employees(...):
  ```
- [ ] 6.9 Update GET /api/employees list endpoint with resource filtering
  ```python
  # Inside get_employees function
  if current_user.role == "employee":
      # Filter to only show own profile
      query = query.where(User.id == current_user.id)
  ```
- [ ] 6.10 Update GET /api/employees/{id} with resource check
  ```python
  # Inside get_employee function
  if current_user.role == "employee" and current_user.id != employee_id:
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Employees can only view their own profile"
      )
  ```
- [ ] 6.11 Add authorization to department endpoints
  ```python
  # In department assignment endpoints
  dependencies=[Depends(require_role(["admin", "manager"]))]
  ```
- [ ] 6.12 Test authorization manually with different roles
  ```bash
  # Use Postman or curl to test
  curl -H "Authorization: Bearer <employee_token>" POST /api/employees
  # Should return 403
  ```
- [ ] 6.13 Commit changes
  ```bash
  git add backend/src/api/employees.py
  git commit -m "feat: Add RBAC authorization to all employee endpoints"
  ```

**Estimated Time**: 3 hours
**Dependencies**: Agent 5 (RBAC foundation)
**Blocks**: Frontend authorization integration

---

### AGENT 7: RBAC Testing
**Branch**: `feature/rbac-tests`
**Prerequisites**: Agent 6 completes API protection
**Execution**: Can start after Agent 6 completes

#### Tasks
- [ ] 7.1 Create `backend/tests/test_authorization.py`
- [ ] 7.2 Import test dependencies
  ```python
  import pytest
  from fastapi.testclient import TestClient
  from sqlalchemy.ext.asyncio import AsyncSession
  from src.main import app
  from src.auth.models import User
  ```
- [ ] 7.3 Create test fixtures for different role tokens
  ```python
  @pytest.fixture
  async def admin_token(db: AsyncSession):
      # Create admin user and return JWT token

  @pytest.fixture
  async def manager_token(db: AsyncSession):
      # Create manager user and return JWT token

  @pytest.fixture
  async def employee_token(db: AsyncSession):
      # Create employee user and return JWT token
  ```
- [ ] 7.4 Test: Non-authenticated request returns 401
  ```python
  def test_create_employee_no_auth(client: TestClient):
      response = client.post("/api/employees", json={...})
      assert response.status_code == 401
  ```
- [ ] 7.5 Test: Employee role cannot create employee (403)
  ```python
  def test_employee_cannot_create_employee(client, employee_token):
      response = client.post(
          "/api/employees",
          json={...},
          headers={"Authorization": f"Bearer {employee_token}"}
      )
      assert response.status_code == 403
  ```
- [ ] 7.6 Test: Employee role cannot update other employee (403)
- [ ] 7.7 Test: Employee role can update own profile (200)
- [ ] 7.8 Test: Employee role cannot view other profiles (403)
- [ ] 7.9 Test: Employee role cannot delete employee (403)
- [ ] 7.10 Test: Manager role can create employee (201)
- [ ] 7.11 Test: Manager role can update employee (200)
- [ ] 7.12 Test: Manager role cannot delete employee (403)
- [ ] 7.13 Test: Manager role cannot change roles (403)
- [ ] 7.14 Test: Admin role can delete employee (204)
- [ ] 7.15 Test: Admin role can change roles (200)
- [ ] 7.16 Test: Admin role can perform all operations
- [ ] 7.17 Create integration test for complete RBAC workflow
  ```python
  async def test_rbac_workflow():
      # Create employee as manager
      # Try to delete as manager (should fail)
      # Delete as admin (should succeed)
  ```
- [ ] 7.18 Run all authorization tests
  ```bash
  pytest backend/tests/test_authorization.py -v --cov
  ```
- [ ] 7.19 Verify test coverage >90%
- [ ] 7.20 Commit changes
  ```bash
  git add backend/tests/test_authorization.py
  git commit -m "test: Comprehensive RBAC authorization test suite"
  ```

**Estimated Time**: 4 hours
**Dependencies**: Agent 6 (API protection)
**Blocks**: None (verification only)

---

### AGENT 8: Input Sanitization & Rate Limiting
**Branch**: `feature/security-hardening`
**Prerequisites**: None (independent work)
**Execution**: Can start immediately

#### Tasks
- [ ] 8.1 Install rate limiting library
  ```bash
  cd backend
  pip install slowapi
  pip freeze > requirements.txt
  ```
- [ ] 8.2 Open `backend/src/main.py`
- [ ] 8.3 Import rate limiting
  ```python
  from slowapi import Limiter, _rate_limit_exceeded_handler
  from slowapi.util import get_remote_address
  from slowapi.errors import RateLimitExceeded
  ```
- [ ] 8.4 Initialize limiter
  ```python
  limiter = Limiter(key_func=get_remote_address)
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
  ```
- [ ] 8.5 Add rate limiting to employee routes
  ```python
  # In employees.py
  @router.post("", dependencies=[limiter.limit("10/minute")])
  async def create_employee(...):
  ```
- [ ] 8.6 Add stricter rate limiting to auth endpoints
  ```python
  @router.post("/login", dependencies=[limiter.limit("5/15minutes")])
  async def login(...):
  ```
- [ ] 8.7 Add global rate limit
  ```python
  @app.middleware("http")
  async def add_rate_limit(request: Request, call_next):
      # 100 requests per 15 minutes per IP globally
  ```
- [ ] 8.8 Open `backend/src/api/employees.py`
- [ ] 8.9 Add HTML escaping utility
  ```python
  import html

  def sanitize_text(text: Optional[str]) -> Optional[str]:
      """Escape HTML characters in text input."""
      if text:
          return html.escape(text.strip())
      return text
  ```
- [ ] 8.10 Apply sanitization to all text fields in create_employee
  ```python
  employee_data.first_name = sanitize_text(employee_data.first_name)
  employee_data.last_name = sanitize_text(employee_data.last_name)
  ```
- [ ] 8.11 Apply sanitization to update_employee
- [ ] 8.12 Add request size limit middleware
  ```python
  @app.middleware("http")
  async def limit_request_size(request: Request, call_next):
      if request.method in ["POST", "PUT", "PATCH"]:
          if int(request.headers.get("content-length", 0)) > 1_000_000:  # 1MB
              raise HTTPException(status_code=413, detail="Request too large")
      return await call_next(request)
  ```
- [ ] 8.13 Add request logging for security monitoring
  ```python
  import logging
  security_logger = logging.getLogger("security")

  @app.middleware("http")
  async def log_requests(request: Request, call_next):
      security_logger.info(f"{request.method} {request.url.path} from {request.client.host}")
      return await call_next(request)
  ```
- [ ] 8.14 Test rate limiting
  ```bash
  # Send 20 requests rapidly
  for i in {1..20}; do curl http://localhost:8000/api/employees; done
  # Should see 429 errors
  ```
- [ ] 8.15 Test sanitization with HTML input
- [ ] 8.16 Commit changes
  ```bash
  git add backend/src/main.py backend/src/api/employees.py backend/requirements.txt
  git commit -m "feat: Add rate limiting and input sanitization"
  ```

**Estimated Time**: 3 hours
**Dependencies**: None
**Blocks**: None

---

### AGENT 9: CSRF & Security Headers
**Branch**: `feature/csrf-security-headers`
**Prerequisites**: None (independent work)
**Execution**: Can start immediately

#### Tasks
- [ ] 9.1 Install CSRF protection library
  ```bash
  cd backend
  pip install fastapi-csrf-protect
  pip freeze > requirements.txt
  ```
- [ ] 9.2 Open `backend/src/main.py`
- [ ] 9.3 Import CSRF protect
  ```python
  from fastapi_csrf_protect import CsrfProtect
  from fastapi_csrf_protect.exceptions import CsrfProtectError
  ```
- [ ] 9.4 Configure CSRF protection
  ```python
  from pydantic import BaseModel

  class CsrfSettings(BaseModel):
      secret_key: str = os.getenv("CSRF_SECRET_KEY", "your-secret-key")

  @CsrfProtect.load_config
  def get_csrf_config():
      return CsrfSettings()
  ```
- [ ] 9.5 Add CSRF exception handler
  ```python
  @app.exception_handler(CsrfProtectError)
  def csrf_protect_exception_handler(request: Request, exc: CsrfProtectError):
      return JSONResponse(
          status_code=403,
          content={"detail": "CSRF token validation failed"}
      )
  ```
- [ ] 9.6 Add CSRF token generation endpoint
  ```python
  @app.get("/api/csrf-token")
  async def get_csrf_token(csrf_protect: CsrfProtect = Depends()):
      response = JSONResponse(content={"message": "CSRF token generated"})
      csrf_protect.set_csrf_cookie(response)
      return response
  ```
- [ ] 9.7 Add CSRF validation to mutating endpoints
  ```python
  # In employees.py
  @router.post("", dependencies=[Depends(CsrfProtect.validate_csrf)])
  async def create_employee(...):
  ```
- [ ] 9.8 Add security headers middleware
  ```python
  @app.middleware("http")
  async def add_security_headers(request: Request, call_next):
      response = await call_next(request)
      response.headers["X-Content-Type-Options"] = "nosniff"
      response.headers["X-Frame-Options"] = "DENY"
      response.headers["X-XSS-Protection"] = "1; mode=block"
      response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
      response.headers["Content-Security-Policy"] = "default-src 'self'"
      return response
  ```
- [ ] 9.9 Configure CORS properly
  ```python
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
      allow_headers=["*"],
  )
  ```
- [ ] 9.10 Update error messages for production
  ```python
  @app.exception_handler(Exception)
  async def generic_exception_handler(request: Request, exc: Exception):
      if os.getenv("ENVIRONMENT") == "production":
          return JSONResponse(
              status_code=500,
              content={"detail": "An internal error occurred. Please contact support."}
          )
      else:
          # Return detailed error for development
          return JSONResponse(
              status_code=500,
              content={"detail": str(exc), "type": type(exc).__name__}
          )
  ```
- [ ] 9.11 Test CSRF protection
  ```bash
  # Try POST without CSRF token - should fail
  curl -X POST http://localhost:8000/api/employees -d '{...}'
  ```
- [ ] 9.12 Verify security headers
  ```bash
  curl -I http://localhost:8000/api/employees
  # Should see X-Content-Type-Options, X-Frame-Options, etc.
  ```
- [ ] 9.13 Test CORS configuration
- [ ] 9.14 Commit changes
  ```bash
  git add backend/src/main.py backend/requirements.txt
  git commit -m "feat: Add CSRF protection and security headers"
  ```

**Estimated Time**: 3 hours
**Dependencies**: None
**Blocks**: Frontend CSRF integration

---

## ⚡ WEEK 2-3: HIGH PRIORITY FEATURES (6 Agents)

### AGENT 10: Account Status Management Backend
**Branch**: `feature/account-status-backend`
**Prerequisites**: None (independent work)
**Execution**: Can start immediately

#### Tasks
- [ ] 10.1 Create `backend/src/models/account_status_history.py`
- [ ] 10.2 Define AccountStatusHistory model
  ```python
  class AccountStatusHistory(Base):
      __tablename__ = "account_status_history"

      id = Column(Integer, primary_key=True)
      user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
      old_status = Column(String(50))
      new_status = Column(String(50), nullable=False)
      changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
      changed_at = Column(DateTime, default=datetime.utcnow, index=True)
      reason = Column(Text)
      metadata_json = Column(JSON)

      # Relationships
      user = relationship("User", foreign_keys=[user_id])
      changed_by = relationship("User", foreign_keys=[changed_by_id])
  ```
- [ ] 10.3 Create migration for AccountStatusHistory
  ```bash
  alembic revision --autogenerate -m "create_account_status_history_table"
  alembic upgrade head
  ```
- [ ] 10.4 Open `backend/src/api/employees.py`
- [ ] 10.5 Create PATCH /api/employees/{id}/status endpoint
  ```python
  class StatusUpdate(BaseModel):
      status: str = Field(..., regex=r'^(active|inactive|locked|verified)$')
      reason: Optional[str] = None

  @router.patch("/{employee_id}/status",
      dependencies=[Depends(require_role(["admin"]))],
      response_model=EmployeeResponse
  )
  async def update_employee_status(
      employee_id: int,
      status_update: StatusUpdate,
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      # Get employee
      # Validate cannot deactivate own account
      # Get current status
      # Update status fields (is_active, is_locked, is_verified based on status)
      # Create history record
      # Commit and return
  ```
- [ ] 10.6 Add validation: cannot deactivate own account
  ```python
  if employee_id == current_user.id and status_update.status in ["inactive", "locked"]:
      raise HTTPException(
          status_code=400,
          detail="You cannot deactivate or lock your own account"
      )
  ```
- [ ] 10.7 Add validation: reason required for lock/deactivate
  ```python
  if status_update.status in ["inactive", "locked"] and not status_update.reason:
      raise HTTPException(
          status_code=400,
          detail="Reason is required when locking or deactivating an account"
      )
  ```
- [ ] 10.8 Implement status change logic
  ```python
  if status_update.status == "active":
      user.is_active = True
      user.is_locked = False
  elif status_update.status == "inactive":
      user.is_active = False
  elif status_update.status == "locked":
      user.is_locked = True
  elif status_update.status == "verified":
      user.is_verified = True
  ```
- [ ] 10.9 Create history record
  ```python
  history = AccountStatusHistory(
      user_id=employee_id,
      old_status=get_status_string(user),  # Helper function
      new_status=status_update.status,
      changed_by_id=current_user.id,
      reason=status_update.reason,
      metadata_json={"ip": request.client.host}
  )
  db.add(history)
  ```
- [ ] 10.10 Create GET /api/employees/{id}/status-history endpoint
  ```python
  @router.get("/{employee_id}/status-history",
      dependencies=[Depends(require_role(["admin", "manager"]))],
      response_model=List[StatusHistoryResponse]
  )
  async def get_status_history(
      employee_id: int,
      skip: int = 0,
      limit: int = 100,
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      # Query with eager loading
      query = (
          select(AccountStatusHistory)
          .where(AccountStatusHistory.user_id == employee_id)
          .options(
              selectinload(AccountStatusHistory.changed_by)
          )
          .order_by(AccountStatusHistory.changed_at.desc())
          .offset(skip)
          .limit(limit)
      )
      # Return enriched results
  ```
- [ ] 10.11 Create StatusHistoryResponse schema
  ```python
  class StatusHistoryResponse(BaseModel):
      id: int
      old_status: Optional[str]
      new_status: str
      changed_by_name: str
      changed_at: datetime
      reason: Optional[str]
  ```
- [ ] 10.12 Test status changes
  ```bash
  pytest backend/tests/test_account_status.py -v
  ```
- [ ] 10.13 Commit changes
  ```bash
  git add backend/src/api/employees.py backend/src/models/account_status_history.py backend/migrations/
  git commit -m "feat: Add account status management with audit logging"
  ```

**Estimated Time**: 4 hours
**Dependencies**: None (but needs RBAC from Agent 5-6)
**Blocks**: Agent 11 (frontend UI)

---

### AGENT 11: Account Status Management Frontend
**Branch**: `feature/account-status-frontend`
**Prerequisites**: Agent 10 completes backend
**Execution**: Must wait for Agent 10

#### Tasks
- [ ] 11.1 Create `frontend/src/components/AccountStatusDialog.jsx`
- [ ] 11.2 Import dependencies
  ```javascript
  import React, { useState } from 'react';
  import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    FormControl, InputLabel, Select, MenuItem,
    TextField, Button, Alert
  } from '@mui/material';
  import { useAuth } from '../contexts/AuthContext';
  import api from '../services/api';
  ```
- [ ] 11.3 Create component structure
  ```javascript
  const AccountStatusDialog = ({ open, onClose, employee, onSuccess }) => {
    const [status, setStatus] = useState(employee?.is_active ? 'active' : 'inactive');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const requiresReason = ['inactive', 'locked'].includes(status);

    // Handler functions
  }
  ```
- [ ] 11.4 Implement status change handler
  ```javascript
  const handleSubmit = async () => {
    if (requiresReason && !reason.trim()) {
      setError('Reason is required for this status change');
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/api/employees/${employee.id}/status`, {
        status,
        reason: reason.trim() || undefined
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] 11.5 Add status selector UI
  ```javascript
  <FormControl fullWidth margin="normal">
    <InputLabel>Status</InputLabel>
    <Select
      value={status}
      onChange={(e) => setStatus(e.target.value)}
      disabled={loading}
    >
      <MenuItem value="active">Active</MenuItem>
      <MenuItem value="inactive">Inactive</MenuItem>
      <MenuItem value="locked">Locked</MenuItem>
      <MenuItem value="verified">Verified</MenuItem>
    </Select>
  </FormControl>
  ```
- [ ] 11.6 Add reason textarea
  ```javascript
  {requiresReason && (
    <TextField
      label="Reason *"
      multiline
      rows={3}
      fullWidth
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      disabled={loading}
      helperText="Required for deactivating or locking accounts"
    />
  )}
  ```
- [ ] 11.7 Add confirmation for destructive actions
  ```javascript
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    if (['inactive', 'locked'].includes(status)) {
      setConfirmOpen(true);
    } else {
      handleSubmit();
    }
  };
  ```
- [ ] 11.8 Open `frontend/src/pages/EmployeesPage.jsx`
- [ ] 11.9 Import AccountStatusDialog
  ```javascript
  import AccountStatusDialog from '../components/AccountStatusDialog';
  ```
- [ ] 11.10 Add state for status dialog
  ```javascript
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  ```
- [ ] 11.11 Add "Manage Status" button to employee actions menu (admin only)
  ```javascript
  {user?.role === 'admin' && (
    <MenuItem onClick={() => {
      setSelectedEmployee(employee);
      setStatusDialogOpen(true);
      setMenuAnchor(null);
    }}>
      <ManageAccountsIcon />
      Manage Status
    </MenuItem>
  )}
  ```
- [ ] 11.12 Add AccountStatusDialog to render
  ```javascript
  <AccountStatusDialog
    open={statusDialogOpen}
    onClose={() => setStatusDialogOpen(false)}
    employee={selectedEmployee}
    onSuccess={() => {
      loadEmployees();
      setNotification({ message: 'Status updated successfully', type: 'success' });
    }}
  />
  ```
- [ ] 11.13 Update employee list to show lock status badge
  ```javascript
  {employee.is_locked && (
    <Chip
      label="Locked"
      color="error"
      size="small"
      icon={<LockIcon />}
    />
  )}
  ```
- [ ] 11.14 Add status filter to employee list
  ```javascript
  const [statusFilter, setStatusFilter] = useState('all');

  // In filter logic
  .filter(emp => {
    if (statusFilter === 'active') return emp.is_active && !emp.is_locked;
    if (statusFilter === 'locked') return emp.is_locked;
    if (statusFilter === 'unverified') return !emp.is_verified;
    return true;
  })
  ```
- [ ] 11.15 Test status management UI
- [ ] 11.16 Test validation and error handling
- [ ] 11.17 Commit changes
  ```bash
  git add frontend/src/components/AccountStatusDialog.jsx frontend/src/pages/EmployeesPage.jsx
  git commit -m "feat: Add account status management UI with admin controls"
  ```

**Estimated Time**: 3 hours
**Dependencies**: Agent 10 (backend API)
**Blocks**: None

---

### AGENT 12: Account Status History UI
**Branch**: `feature/status-history-ui`
**Prerequisites**: Agent 10 completes backend
**Execution**: Can work in parallel with Agent 11

#### Tasks
- [ ] 12.1 Create `frontend/src/components/AccountStatusHistoryDialog.jsx`
- [ ] 12.2 Set up component structure
  ```javascript
  import React, { useState, useEffect } from 'react';
  import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Table, TableHead, TableBody, TableRow, TableCell,
    Button, CircularProgress, Alert, Chip,
    TableContainer, Paper
  } from '@mui/material';
  import { format } from 'date-fns';
  import api from '../services/api';
  ```
- [ ] 12.3 Create state management
  ```javascript
  const AccountStatusHistoryDialog = ({ open, onClose, employeeId, employeeName }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
      if (open && employeeId) {
        loadHistory();
      }
    }, [open, employeeId]);
  };
  ```
- [ ] 12.4 Implement load history function
  ```javascript
  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/employees/${employeeId}/status-history`);
      setHistory(response.data);
    } catch (err) {
      setError('Failed to load status history');
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] 12.5 Create status chip component
  ```javascript
  const getStatusChip = (status) => {
    const colors = {
      active: 'success',
      inactive: 'default',
      locked: 'error',
      verified: 'info'
    };
    return <Chip label={status} color={colors[status]} size="small" />;
  };
  ```
- [ ] 12.6 Create history table UI
  ```javascript
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Date/Time</TableCell>
          <TableCell>Old Status</TableCell>
          <TableCell>New Status</TableCell>
          <TableCell>Changed By</TableCell>
          <TableCell>Reason</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {history.map((record) => (
          <TableRow key={record.id}>
            <TableCell>
              {format(new Date(record.changed_at), 'MMM dd, yyyy HH:mm')}
            </TableCell>
            <TableCell>
              {record.old_status ? getStatusChip(record.old_status) : '-'}
            </TableCell>
            <TableCell>{getStatusChip(record.new_status)}</TableCell>
            <TableCell>{record.changed_by_name}</TableCell>
            <TableCell>{record.reason || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
  ```
- [ ] 12.7 Add date range filter
  ```javascript
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  <TextField
    type="date"
    label="From"
    value={dateRange.start || ''}
    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
  />
  <TextField
    type="date"
    label="To"
    value={dateRange.end || ''}
    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
  />
  ```
- [ ] 12.8 Implement client-side date filtering
  ```javascript
  const filteredHistory = history.filter(record => {
    const recordDate = new Date(record.changed_at);
    if (dateRange.start && recordDate < new Date(dateRange.start)) return false;
    if (dateRange.end && recordDate > new Date(dateRange.end)) return false;
    return true;
  });
  ```
- [ ] 12.9 Add export to CSV functionality
  ```javascript
  const exportToCSV = () => {
    const headers = ['Date', 'Old Status', 'New Status', 'Changed By', 'Reason'];
    const rows = filteredHistory.map(r => [
      format(new Date(r.changed_at), 'yyyy-MM-dd HH:mm'),
      r.old_status || '',
      r.new_status,
      r.changed_by_name,
      r.reason || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status-history-${employeeName}-${Date.now()}.csv`;
    a.click();
  };
  ```
- [ ] 12.10 Add loading and error states
  ```javascript
  {loading && <CircularProgress />}
  {error && <Alert severity="error">{error}</Alert>}
  {!loading && history.length === 0 && (
    <Alert severity="info">No status changes recorded</Alert>
  )}
  ```
- [ ] 12.11 Open `frontend/src/pages/EmployeesPage.jsx`
- [ ] 12.12 Add "View History" button next to status badge
  ```javascript
  import AccountStatusHistoryDialog from '../components/AccountStatusHistoryDialog';

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  <Button
    size="small"
    startIcon={<HistoryIcon />}
    onClick={() => {
      setSelectedEmployee(employee);
      setHistoryDialogOpen(true);
    }}
  >
    View History
  </Button>
  ```
- [ ] 12.13 Add dialog to render
  ```javascript
  <AccountStatusHistoryDialog
    open={historyDialogOpen}
    onClose={() => setHistoryDialogOpen(false)}
    employeeId={selectedEmployee?.id}
    employeeName={`${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
  />
  ```
- [ ] 12.14 Test history loading and display
- [ ] 12.15 Test date filtering
- [ ] 12.16 Test CSV export
- [ ] 12.17 Commit changes
  ```bash
  git add frontend/src/components/AccountStatusHistoryDialog.jsx frontend/src/pages/EmployeesPage.jsx
  git commit -m "feat: Add account status history viewer with export"
  ```

**Estimated Time**: 3 hours
**Dependencies**: Agent 10 (backend API)
**Blocks**: None

---

### AGENT 13: Department History UI
**Branch**: `feature/department-history-ui`
**Prerequisites**: Backend endpoint already exists
**Execution**: Can start immediately

#### Tasks
- [ ] 13.1 Create `frontend/src/components/DepartmentHistoryDialog.jsx`
- [ ] 13.2 Similar structure to AccountStatusHistoryDialog
  ```javascript
  const DepartmentHistoryDialog = ({ open, onClose, employeeId, employeeName }) => {
    // Similar state and structure as status history
  };
  ```
- [ ] 13.3 Load department history from existing endpoint
  ```javascript
  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/employees/${employeeId}/department-history`);
      setHistory(response.data);
    } catch (err) {
      setError('Failed to load department history');
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] 13.4 Create history table with columns:
  - Date/Time
  - Old Department
  - New Department
  - Changed By
  - Reason
- [ ] 13.5 Add date range filter (reuse from status history)
- [ ] 13.6 Add export to CSV functionality
- [ ] 13.7 Add statistics section
  ```javascript
  const stats = useMemo(() => {
    return {
      totalChanges: history.length,
      departments: [...new Set(history.map(h => h.new_department_name))].length,
      averageDuration: calculateAverageDuration(history)
    };
  }, [history]);

  <Box sx={{ mb: 2 }}>
    <Typography variant="body2">
      Total Changes: {stats.totalChanges} |
      Departments: {stats.departments} |
      Average Duration: {stats.averageDuration} days
    </Typography>
  </Box>
  ```
- [ ] 13.8 Implement calculateAverageDuration helper
  ```javascript
  const calculateAverageDuration = (records) => {
    if (records.length < 2) return 0;
    const durations = [];
    for (let i = 0; i < records.length - 1; i++) {
      const start = new Date(records[i + 1].changed_at);
      const end = new Date(records[i].changed_at);
      durations.push((end - start) / (1000 * 60 * 60 * 24)); // days
    }
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  };
  ```
- [ ] 13.9 Open `frontend/src/components/departments/DepartmentEmployeeAssignment.jsx`
- [ ] 13.10 Add "View History" button in assigned employees section
  ```javascript
  import DepartmentHistoryDialog from '../DepartmentHistoryDialog';

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState(null);

  // In employee card
  <IconButton
    size="small"
    onClick={() => {
      setSelectedEmployeeForHistory(employee);
      setHistoryDialogOpen(true);
    }}
    title="View Department History"
  >
    <HistoryIcon fontSize="small" />
  </IconButton>
  ```
- [ ] 13.11 Add dialog to render
  ```javascript
  <DepartmentHistoryDialog
    open={historyDialogOpen}
    onClose={() => setHistoryDialogOpen(false)}
    employeeId={selectedEmployeeForHistory?.id}
    employeeName={selectedEmployeeForHistory?.name}
  />
  ```
- [ ] 13.12 Also add to EmployeesPage.jsx in department section
- [ ] 13.13 Test history loading and display
- [ ] 13.14 Test statistics calculation
- [ ] 13.15 Test CSV export
- [ ] 13.16 Commit changes
  ```bash
  git add frontend/src/components/DepartmentHistoryDialog.jsx frontend/src/components/departments/DepartmentEmployeeAssignment.jsx frontend/src/pages/EmployeesPage.jsx
  git commit -m "feat: Add department history viewer with statistics"
  ```

**Estimated Time**: 3 hours
**Dependencies**: None (endpoint exists)
**Blocks**: None

---

### AGENT 14: Password Management Backend
**Branch**: `feature/password-management-backend`
**Prerequisites**: None (independent work)
**Execution**: Can start immediately

#### Tasks
- [ ] 14.1 Open `backend/src/api/employees.py`
- [ ] 14.2 Import password utilities
  ```python
  import secrets
  import string
  from src.auth.password import get_password_hash, verify_password
  ```
- [ ] 14.3 Create password generation function
  ```python
  def generate_secure_password(length: int = 12) -> str:
      """Generate a secure random password."""
      alphabet = string.ascii_letters + string.digits + string.punctuation
      password = ''.join(secrets.choice(alphabet) for _ in range(length))

      # Ensure password has at least one of each type
      has_upper = any(c.isupper() for c in password)
      has_lower = any(c.islower() for c in password)
      has_digit = any(c.isdigit() for c in password)
      has_special = any(c in string.punctuation for c in password)

      if not (has_upper and has_lower and has_digit and has_special):
          return generate_secure_password(length)  # Regenerate

      return password
  ```
- [ ] 14.4 Create POST /api/employees/{id}/reset-password endpoint
  ```python
  class PasswordResetResponse(BaseModel):
      temporary_password: str
      message: str

  @router.post("/{employee_id}/reset-password",
      dependencies=[Depends(require_role(["admin"]))],
      response_model=PasswordResetResponse
  )
  async def reset_employee_password(
      employee_id: int,
      send_email: bool = False,
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      user = await db.get(User, employee_id)
      if not user:
          raise HTTPException(status_code=404, detail="Employee not found")

      # Generate secure password
      temp_password = generate_secure_password()

      # Hash and save
      user.password = get_password_hash(temp_password)
      user.password_must_change = True
      user.password_changed_at = datetime.utcnow()

      # Log action
      # TODO: Add to audit log

      # Send email if requested
      if send_email:
          # TODO: Send email with temp password
          pass

      await db.commit()

      return PasswordResetResponse(
          temporary_password=temp_password,
          message="Password reset successfully. This is the only time this password will be displayed."
      )
  ```
- [ ] 14.5 Add password_must_change field to User model if not exists
  ```python
  # In backend/src/auth/models.py
  password_must_change = Column(Boolean, default=False)
  password_changed_at = Column(DateTime, nullable=True)
  ```
- [ ] 14.6 Create PATCH /api/employees/{id}/change-password endpoint
  ```python
  class PasswordChange(BaseModel):
      old_password: Optional[str] = None  # Required for self, not for admin
      new_password: str = Field(..., min_length=8, max_length=128)
      confirm_password: str

      @validator('new_password')
      def validate_password_complexity(cls, v):
          # At least 8 chars, 1 upper, 1 lower, 1 digit, 1 special
          if len(v) < 8:
              raise ValueError('Password must be at least 8 characters')
          if not any(c.isupper() for c in v):
              raise ValueError('Password must contain at least one uppercase letter')
          if not any(c.islower() for c in v):
              raise ValueError('Password must contain at least one lowercase letter')
          if not any(c.isdigit() for c in v):
              raise ValueError('Password must contain at least one digit')
          if not any(c in string.punctuation for c in v):
              raise ValueError('Password must contain at least one special character')
          return v

      @validator('confirm_password')
      def passwords_match(cls, v, values):
          if 'new_password' in values and v != values['new_password']:
              raise ValueError('Passwords do not match')
          return v

  @router.patch("/{employee_id}/change-password")
  async def change_employee_password(
      employee_id: int,
      password_data: PasswordChange,
      db: AsyncSession = Depends(get_db),
      current_user: User = Depends(get_current_user)
  ):
      # Check authorization (admin or self)
      is_admin = await check_user_role(current_user, ["admin"])
      is_self = current_user.id == employee_id

      if not (is_admin or is_self):
          raise HTTPException(status_code=403, detail="Not authorized")

      # If self, verify old password
      if is_self and not is_admin:
          if not password_data.old_password:
              raise HTTPException(status_code=400, detail="Old password required")
          if not verify_password(password_data.old_password, current_user.password):
              raise HTTPException(status_code=400, detail="Incorrect old password")

      # Check password history (prevent reuse of last 5)
      # TODO: Implement password history check

      # Update password
      user = await db.get(User, employee_id)
      user.password = get_password_hash(password_data.new_password)
      user.password_must_change = False
      user.password_changed_at = datetime.utcnow()

      # Log password change
      # TODO: Add to audit log

      await db.commit()

      return {"message": "Password changed successfully"}
  ```
- [ ] 14.7 Create PasswordHistory model
  ```python
  class PasswordHistory(Base):
      __tablename__ = "password_history"

      id = Column(Integer, primary_key=True)
      user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
      password_hash = Column(String(255), nullable=False)
      changed_at = Column(DateTime, default=datetime.utcnow, index=True)
  ```
- [ ] 14.8 Implement password history check
  ```python
  async def check_password_history(db: AsyncSession, user_id: int, new_password: str) -> bool:
      """Check if password was used in last 5 passwords."""
      history = await db.execute(
          select(PasswordHistory)
          .where(PasswordHistory.user_id == user_id)
          .order_by(PasswordHistory.changed_at.desc())
          .limit(5)
      )
      recent_passwords = history.scalars().all()

      for old_password in recent_passwords:
          if verify_password(new_password, old_password.password_hash):
              return False  # Password was used recently

      return True  # Password is unique
  ```
- [ ] 14.9 Add password history saving
  ```python
  # After changing password
  password_history = PasswordHistory(
      user_id=user.id,
      password_hash=user.password
  )
  db.add(password_history)
  ```
- [ ] 14.10 Create migrations
  ```bash
  alembic revision --autogenerate -m "add_password_management_fields"
  alembic upgrade head
  ```
- [ ] 14.11 Test password reset
  ```bash
  pytest backend/tests/test_password_management.py -v
  ```
- [ ] 14.12 Commit changes
  ```bash
  git add backend/src/api/employees.py backend/src/auth/models.py backend/migrations/
  git commit -m "feat: Add password management with reset and change functionality"
  ```

**Estimated Time**: 4 hours
**Dependencies**: None
**Blocks**: Agent 15 (frontend UI)

---

### AGENT 15: Password Management Frontend
**Branch**: `feature/password-management-frontend`
**Prerequisites**: Agent 14 completes backend
**Execution**: Must wait for Agent 14

#### Tasks
- [ ] 15.1 Create `frontend/src/components/PasswordResetDialog.jsx`
- [ ] 15.2 Set up component structure
  ```javascript
  import React, { useState } from 'react';
  import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Checkbox, FormControlLabel,
    Alert, TextField, IconButton, Typography,
    Box, Paper
  } from '@mui/material';
  import { ContentCopy, Visibility, VisibilityOff } from '@mui/icons-material';
  import api from '../services/api';
  ```
- [ ] 15.3 Create state management
  ```javascript
  const PasswordResetDialog = ({ open, onClose, employee }) => {
    const [sendEmail, setSendEmail] = useState(false);
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
  };
  ```
- [ ] 15.4 Implement reset handler
  ```javascript
  const handleReset = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post(
        `/api/employees/${employee.id}/reset-password`,
        null,
        { params: { send_email: sendEmail } }
      );
      setPassword(response.data.temporary_password);
    } catch (err) {
      setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] 15.5 Implement copy to clipboard
  ```javascript
  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  ```
- [ ] 15.6 Create UI for password display
  ```javascript
  {password && (
    <Paper elevation={3} sx={{ p: 2, mt: 2, bgcolor: 'warning.light' }}>
      <Alert severity="warning" sx={{ mb: 2 }}>
        This password will only be displayed once. Make sure to copy it now!
      </Alert>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          value={password}
          type={showPassword ? 'text' : 'password'}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <>
                <IconButton onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
                <IconButton onClick={handleCopy}>
                  <ContentCopy />
                </IconButton>
              </>
            )
          }}
        />
        {copied && (
          <Typography variant="caption" color="success.main">
            Copied!
          </Typography>
        )}
      </Box>
    </Paper>
  )}
  ```
- [ ] 15.7 Add send email checkbox
  ```javascript
  {!password && (
    <FormControlLabel
      control={
        <Checkbox
          checked={sendEmail}
          onChange={(e) => setSendEmail(e.target.checked)}
        />
      }
      label="Send temporary password via email"
    />
  )}
  ```
- [ ] 15.8 Create `frontend/src/components/ChangePasswordDialog.jsx`
- [ ] 15.9 Set up change password component
  ```javascript
  const ChangePasswordDialog = ({ open, onClose, employeeId, isSelf }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [strength, setStrength] = useState(0);
    const [errors, setErrors] = useState({});
  };
  ```
- [ ] 15.10 Implement password strength indicator
  ```javascript
  const calculateStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  useEffect(() => {
    setStrength(calculateStrength(newPassword));
  }, [newPassword]);

  const getStrengthColor = () => {
    if (strength < 3) return 'error';
    if (strength < 5) return 'warning';
    return 'success';
  };

  const getStrengthText = () => {
    if (strength < 3) return 'Weak';
    if (strength < 5) return 'Medium';
    return 'Strong';
  };
  ```
- [ ] 15.11 Create password strength UI
  ```javascript
  <Box sx={{ mt: 1 }}>
    <Typography variant="caption">Password Strength:</Typography>
    <LinearProgress
      variant="determinate"
      value={(strength / 6) * 100}
      color={getStrengthColor()}
    />
    <Typography variant="caption" color={`${getStrengthColor()}.main`}>
      {getStrengthText()}
    </Typography>
  </Box>
  ```
- [ ] 15.12 Implement password change handler
  ```javascript
  const handleChangePassword = async () => {
    setErrors({});

    // Validate
    if (isSelf && !oldPassword) {
      setErrors({ oldPassword: 'Current password is required' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/api/employees/${employeeId}/change-password`, {
        old_password: isSelf ? oldPassword : undefined,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'object' && detail.errors) {
        const fieldErrors = {};
        detail.errors.forEach(e => {
          fieldErrors[e.field] = e.message;
        });
        setErrors(fieldErrors);
      } else {
        setError(detail || 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] 15.13 Create password input fields with validation
  ```javascript
  {isSelf && (
    <TextField
      label="Current Password"
      type={showPasswords ? 'text' : 'password'}
      value={oldPassword}
      onChange={(e) => setOldPassword(e.target.value)}
      error={!!errors.oldPassword}
      helperText={errors.oldPassword}
      fullWidth
      margin="normal"
    />
  )}
  <TextField
    label="New Password"
    type={showPasswords ? 'text' : 'password'}
    value={newPassword}
    onChange={(e) => setNewPassword(e.target.value)}
    error={!!errors.newPassword}
    helperText={errors.newPassword || "Min 8 chars, 1 upper, 1 lower, 1 digit, 1 special"}
    fullWidth
    margin="normal"
  />
  <TextField
    label="Confirm New Password"
    type={showPasswords ? 'text' : 'password'}
    value={confirmPassword}
    onChange={(e) => setConfirmPassword(e.target.value)}
    error={!!errors.confirmPassword}
    helperText={errors.confirmPassword}
    fullWidth
    margin="normal"
  />
  ```
- [ ] 15.14 Add dialogs to EmployeesPage
- [ ] 15.15 Test password reset workflow
- [ ] 15.16 Test password change workflow
- [ ] 15.17 Commit changes
  ```bash
  git add frontend/src/components/PasswordResetDialog.jsx frontend/src/components/ChangePasswordDialog.jsx frontend/src/pages/EmployeesPage.jsx
  git commit -m "feat: Add password management UI with reset and change"
  ```

**Estimated Time**: 4 hours
**Dependencies**: Agent 14 (backend API)
**Blocks**: None

---

## 📊 TRACKING & COORDINATION

### Daily Standup Format (Async via Memory System)
Each agent should update at start/end of work:

```bash
npx claude-flow@alpha hooks notify --message "Agent X: Starting tasks 1.1-1.5 (Backend Model)"
# ... work ...
npx claude-flow@alpha hooks notify --message "Agent X: Completed 1.1-1.5, blocked on Y"
```

### Dependency Tracking
Before starting work, check:
```bash
npx claude-flow@alpha hooks session-restore --session-id "employee-alignment"
# Review which tasks are completed
```

### Merge Strategy
1. **Complete your task branch**
2. **Run all tests locally**
3. **Pull latest main**
4. **Resolve conflicts**
5. **Create PR with task checklist**
6. **Wait for approval**
7. **Merge and notify**

---

## 🎯 SUCCESS CRITERIA

### Week 1 Complete When:
- [ ] All critical fields (phone, hire_date, role) functional end-to-end
- [ ] No silent data loss
- [ ] Backend validation comprehensive
- [ ] All migrations tested

### Week 2 Complete When:
- [ ] RBAC fully implemented and tested
- [ ] All security issues addressed
- [ ] Rate limiting active
- [ ] CSRF protection working

### Week 3 Complete When:
- [ ] Account status management functional
- [ ] Password management complete
- [ ] Department history UI implemented
- [ ] All audit trails working

### Overall Success:
- [ ] All 4 critical issues resolved
- [ ] Security score 8/10+
- [ ] Field alignment 100%
- [ ] CRUD completeness 95%+
- [ ] Test coverage >80%
- [ ] All documentation updated

---

**Total Tasks**: 350+
**Parallel Execution**: 6-8 agents recommended
**Estimated Timeline**: 4-5 weeks with proper coordination
**Review Document**: docs/EMPLOYEE_SYSTEM_REVIEW_SUMMARY.md
