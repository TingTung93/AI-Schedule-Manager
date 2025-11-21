# Department Assignment Integration Architecture

## Architecture Decision Record (ADR)

**Status**: Proposed
**Date**: 2025-11-20
**Decision Makers**: System Architecture Designer
**Context**: Complete integration of department assignment functionality in employee management system

---

## 1. System Overview

### 1.1 Current State Analysis

**Database Layer**:
- Employee model (User) has `department_id` field with nullable foreign key to Department
- Department model supports hierarchical structure with parent-child relationships
- Relationship exists: `Employee.department` → `Department.employees`

**API Layer**:
- Basic department filtering exists in `/api/employees` GET endpoint
- Department creation/update in employee routes accepts `department_id`
- Manual department loading in employee routes (workaround for lazy loading issues)

**Schema Layer**:
- `EmployeeCreate`: Accepts optional `department_id` (alias: 'department')
- `EmployeeUpdate`: Accepts optional `department_id`
- `EmployeeResponse`: Includes `department_id` and optional nested `department` object
- Field validators convert empty strings to None

### 1.2 Integration Objectives

1. Robust department assignment during employee creation/update
2. Rich department information in employee responses
3. Validation of department references
4. Clear error handling for invalid assignments
5. Performance optimization for department loading

---

## 2. Schema Architecture

### 2.1 Schema Structure Design

#### EmployeeCreate Schema (Enhanced)

```python
class EmployeeCreate(BaseModel):
    """Employee creation schema with department assignment."""

    # Required fields
    first_name: str = Field(..., min_length=1, max_length=50, alias='firstName')
    last_name: str = Field(..., min_length=1, max_length=50, alias='lastName')

    # Optional authentication
    email: Optional[EmailStr] = None

    # Optional assignment fields
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = Field(None, alias='departmentId', gt=0)

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "firstName": "John",
                "lastName": "Doe",
                "email": "john.doe@company.com",
                "departmentId": 5,
                "role": "employee"
            }
        }
    )

    @field_validator('email', 'department_id', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None for optional fields."""
        if v == '' or v is None:
            return None
        return v

    @field_validator('department_id')
    @classmethod
    def validate_department_id(cls, v):
        """Validate department_id is positive integer."""
        if v is not None and v <= 0:
            raise ValueError('Department ID must be a positive integer')
        return v
```

**Design Rationale**:
- Maintains backward compatibility (department_id optional)
- Supports both snake_case and camelCase (alias='departmentId')
- Validates department_id format before database lookup
- Provides clear schema example for API documentation

#### EmployeeUpdate Schema (Enhanced)

```python
class EmployeeUpdate(BaseModel):
    """Employee update schema with department reassignment."""

    first_name: Optional[str] = Field(None, min_length=1, max_length=50, alias='firstName')
    last_name: Optional[str] = Field(None, min_length=1, max_length=50, alias='lastName')
    email: Optional[EmailStr] = None
    role: Optional[EmployeeRole] = None
    phone: Optional[str] = Field(None, max_length=50)
    department_id: Optional[int] = Field(None, alias='departmentId')
    active: Optional[bool] = None

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "departmentId": 10,
                "role": "manager"
            }
        }
    )

    @field_validator('department_id', mode='before')
    @classmethod
    def handle_department_assignment(cls, v):
        """Handle department assignment/removal.

        - None/empty: Remove department assignment
        - Integer: Assign to department (validated later)
        """
        if v == '' or v == 'null':
            return None
        return v

    @field_validator('department_id')
    @classmethod
    def validate_department_id(cls, v):
        """Validate department_id format."""
        if v is not None and v <= 0:
            raise ValueError('Department ID must be a positive integer')
        return v
```

**Design Rationale**:
- Supports department reassignment
- Allows removal of department assignment (set to None)
- Handles edge cases (empty string, 'null' string)
- Validates format before database operations

#### EmployeeResponse Schema (Enhanced)

```python
class EmployeeResponse(BaseModel):
    """Employee response with rich department information."""

    # Employee core fields
    id: int
    first_name: str = Field(..., alias='firstName')
    last_name: str = Field(..., alias='lastName')
    email: str
    is_active: bool = Field(..., alias='isActive')
    created_at: datetime = Field(..., alias='createdAt')
    updated_at: datetime = Field(..., alias='updatedAt')

    # Optional fields
    role: Optional[str] = None
    phone: Optional[str] = None

    # Department assignment
    department_id: Optional[int] = Field(None, alias='departmentId')
    department: Optional["DepartmentResponse"] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "id": 42,
                "firstName": "John",
                "lastName": "Doe",
                "email": "john.doe@company.com",
                "isActive": True,
                "departmentId": 5,
                "department": {
                    "id": 5,
                    "name": "Engineering",
                    "description": "Software Development Team",
                    "active": True
                }
            }
        }
    )

    @property
    def full_name(self) -> str:
        """Compute full name."""
        return f"{self.first_name} {self.last_name}"

    @computed_field
    @property
    def department_name(self) -> Optional[str]:
        """Convenience property for department name."""
        return self.department.name if self.department else None
```

**Design Rationale**:
- Includes both `department_id` (for quick reference) and `department` (rich object)
- Supports camelCase output for frontend consistency
- Provides convenience property for common use case (department_name)
- Follows from_attributes pattern for SQLAlchemy ORM mapping

---

## 3. API Endpoint Enhancements

### 3.1 Endpoint Specifications

#### GET /api/employees

**Current Implementation**: Basic department filtering
**Enhancement**: Optimized department loading

```python
@router.get("", response_model=List[EmployeeResponse])
async def get_employees(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    department_id: Optional[int] = Query(None, gt=0, description="Filter by department ID"),
    include_department: bool = Query(True, description="Include department details in response"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get employees with optional filtering and department enrichment.

    Query Parameters:
    - department_id: Filter by department (null for unassigned)
    - include_department: Load department details (default: true)
    - role, is_active: Additional filters
    - skip, limit: Pagination

    Performance:
    - Uses selectinload for efficient department loading (1+1 queries)
    - Manual loading fallback for compatibility
    """
```

**Key Changes**:
- Add `include_department` parameter for response optimization
- Use `selectinload(User.department)` for efficient loading
- Validate `department_id` parameter format
- Support filtering by null department (unassigned employees)

#### GET /api/employees/{employee_id}

**Current Implementation**: Manual department loading
**Enhancement**: Eager loading optimization

```python
@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    include_department: bool = Query(True, description="Include department details"),
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Get employee by ID with department details.

    Performance: Uses selectinload for efficient department retrieval.
    """
```

#### POST /api/employees

**Current Implementation**: Basic department assignment
**Enhancement**: Robust validation and error handling

```python
@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Create employee with department assignment validation.

    Validation Flow:
    1. Validate schema (automatic via Pydantic)
    2. Validate department exists (if department_id provided)
    3. Validate department is active
    4. Check email uniqueness
    5. Create employee with department assignment
    6. Return with department details loaded

    Error Responses:
    - 400: Invalid department_id format
    - 404: Department not found
    - 409: Email already exists
    - 422: Validation errors (inactive department)
    - 500: Database errors
    """
```

**Validation Logic**:
```python
# 1. Validate department if provided
if employee_data.department_id:
    dept_query = select(Department).where(
        Department.id == employee_data.department_id
    )
    dept_result = await db.execute(dept_query)
    department = dept_result.scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Department not found",
                "department_id": employee_data.department_id,
                "suggestion": "Verify department ID or create department first"
            }
        )

    if not department.active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Cannot assign employee to inactive department",
                "department_id": employee_data.department_id,
                "department_name": department.name,
                "suggestion": "Activate department or choose different department"
            }
        )
```

#### PUT/PATCH /api/employees/{employee_id}

**Current Implementation**: Basic field mapping
**Enhancement**: Department reassignment validation

```python
@router.patch("/{employee_id}", response_model=EmployeeResponse)
@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user = Depends(get_current_user)
):
    """
    Update employee with department reassignment support.

    Department Assignment Logic:
    - None: Remove department assignment
    - Integer: Validate and assign to department
    - Unchanged: Keep current assignment

    Validation:
    - Department exists and is active
    - No circular references (future: prevent manager loops)
    """
```

---

## 4. Validation Rules

### 4.1 Department Assignment Validation

#### Rule 1: Department Existence
```python
async def validate_department_exists(
    db: AsyncSession,
    department_id: int
) -> Department:
    """Validate department exists in database."""
    query = select(Department).where(Department.id == department_id)
    result = await db.execute(query)
    department = result.scalar_one_or_none()

    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "Department not found",
                "department_id": department_id,
                "code": "DEPT_NOT_FOUND"
            }
        )

    return department
```

#### Rule 2: Department Active Status
```python
async def validate_department_active(department: Department):
    """Validate department is active."""
    if not department.active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Department is inactive",
                "department_id": department.id,
                "department_name": department.name,
                "code": "DEPT_INACTIVE",
                "suggestion": "Activate department before assignment"
            }
        )
```

#### Rule 3: Department ID Format
```python
# Handled by Pydantic validator in schema
@field_validator('department_id')
@classmethod
def validate_department_id_format(cls, v):
    """Validate department_id is positive integer."""
    if v is not None:
        if not isinstance(v, int):
            raise ValueError('Department ID must be an integer')
        if v <= 0:
            raise ValueError('Department ID must be positive')
    return v
```

#### Rule 4: Hierarchical Integrity (Future Enhancement)
```python
async def validate_department_hierarchy(
    db: AsyncSession,
    employee: User,
    new_department_id: int
):
    """
    Prevent circular management chains.

    Example:
    - Manager A in Department X
    - Department X parent is Department Y
    - Manager B in Department Y reports to Manager A
    - Invalid: Cannot move Manager A to Department Y (circular)
    """
    # Future implementation for manager role validation
    pass
```

### 4.2 Validation Integration Points

**Schema Level** (First Line):
- Field type validation (int, not string)
- Range validation (positive integers)
- Format validation (empty string → None)

**API Level** (Business Logic):
- Department existence check
- Department active status check
- Authorization checks (manager-only operations)

**Database Level** (Integrity):
- Foreign key constraint enforcement
- Cascade rules for deletions
- Index optimization for lookups

---

## 5. Error Handling Design

### 5.1 Error Response Format

```python
class ErrorDetail(BaseModel):
    """Structured error response."""

    error: str  # Human-readable error message
    code: str   # Machine-readable error code
    field: Optional[str] = None  # Field that caused error
    value: Optional[Any] = None  # Invalid value
    suggestion: Optional[str] = None  # How to fix
    documentation: Optional[str] = None  # Link to docs
```

### 5.2 Department Assignment Error Cases

#### 404 - Department Not Found
```json
{
    "detail": {
        "error": "Department not found",
        "code": "DEPT_NOT_FOUND",
        "field": "department_id",
        "value": 999,
        "suggestion": "Verify department ID exists using GET /api/departments",
        "documentation": "/docs#tag/departments"
    }
}
```

#### 422 - Inactive Department
```json
{
    "detail": {
        "error": "Cannot assign employee to inactive department",
        "code": "DEPT_INACTIVE",
        "field": "department_id",
        "value": 5,
        "department_name": "Legacy Systems",
        "suggestion": "Activate department using PATCH /api/departments/5 or choose active department",
        "documentation": "/docs#tag/departments/operation/update_department"
    }
}
```

#### 400 - Invalid Department ID Format
```json
{
    "detail": {
        "error": "Invalid department ID format",
        "code": "VALIDATION_ERROR",
        "field": "department_id",
        "value": "abc",
        "suggestion": "Department ID must be a positive integer"
    }
}
```

#### 409 - Email Conflict (Existing Behavior)
```json
{
    "detail": {
        "error": "Employee with email already exists",
        "code": "EMAIL_CONFLICT",
        "field": "email",
        "value": "john.doe@company.com",
        "existing_employee": {
            "id": 42,
            "full_name": "John Doe",
            "department_id": 5
        },
        "suggestion": "Use different email or leave empty to auto-generate"
    }
}
```

### 5.3 Error Handler Implementation

```python
class DepartmentValidationError(HTTPException):
    """Custom exception for department validation errors."""

    def __init__(
        self,
        code: str,
        message: str,
        department_id: Optional[int] = None,
        suggestion: Optional[str] = None
    ):
        detail = {
            "error": message,
            "code": code,
            "field": "department_id",
            "value": department_id,
            "suggestion": suggestion
        }
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

# Usage
if not department:
    raise DepartmentValidationError(
        code="DEPT_NOT_FOUND",
        message="Department not found",
        department_id=employee_data.department_id,
        suggestion="Verify department ID or create department first"
    )
```

---

## 6. Response Format Design

### 6.1 Single Employee Response

**Minimal Response** (include_department=false):
```json
{
    "id": 42,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "isActive": true,
    "departmentId": 5,
    "department": null,
    "createdAt": "2025-11-20T10:30:00Z",
    "updatedAt": "2025-11-20T10:30:00Z"
}
```

**Full Response** (include_department=true, default):
```json
{
    "id": 42,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "isActive": true,
    "departmentId": 5,
    "department": {
        "id": 5,
        "name": "Engineering",
        "description": "Software Development Team",
        "parentId": 1,
        "settings": {
            "timezone": "America/New_York",
            "work_hours": "9-5"
        },
        "active": true,
        "createdAt": "2025-01-15T08:00:00Z",
        "updatedAt": "2025-11-20T09:00:00Z"
    },
    "createdAt": "2025-11-20T10:30:00Z",
    "updatedAt": "2025-11-20T10:30:00Z"
}
```

### 6.2 Employee List Response

```json
{
    "items": [
        {
            "id": 42,
            "firstName": "John",
            "lastName": "Doe",
            "departmentId": 5,
            "department": {
                "id": 5,
                "name": "Engineering"
            }
        },
        {
            "id": 43,
            "firstName": "Jane",
            "lastName": "Smith",
            "departmentId": null,
            "department": null
        }
    ],
    "total": 2,
    "page": 1,
    "size": 100,
    "pages": 1
}
```

### 6.3 Response Optimization Strategies

**Strategy 1: Selective Loading**
```python
# Load department only when requested
if include_department:
    query = query.options(selectinload(User.department))
else:
    # Don't load relationship
    pass
```

**Strategy 2: Field Projection**
```python
# Partial department response for lists
class DepartmentSummary(BaseModel):
    id: int
    name: str
    active: bool

# Full department for detail views
class DepartmentResponse(DepartmentSummary):
    description: Optional[str]
    parent_id: Optional[int]
    settings: Optional[dict]
    created_at: datetime
    updated_at: datetime
```

**Strategy 3: Response Caching**
```python
# Cache department details for repeated requests
from functools import lru_cache

@lru_cache(maxsize=128)
async def get_department_cached(db: AsyncSession, dept_id: int):
    """Cache department lookups for performance."""
    # Implementation with TTL
    pass
```

---

## 7. Integration Points

### 7.1 Database Layer Integration

#### Model Relationship
```python
# Employee Model (User)
class Employee(Base):
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        back_populates="employees",
        lazy="selectin"  # Eager load by default
    )
```

#### Migration Strategy
```sql
-- Existing migration (already applied)
ALTER TABLE employees
ADD COLUMN department_id INTEGER
REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX ix_employees_department_id ON employees(department_id);

-- Future enhancement: Add constraint
ALTER TABLE employees
ADD CONSTRAINT fk_employee_department_active
CHECK (
    department_id IS NULL OR
    EXISTS (
        SELECT 1 FROM departments
        WHERE id = department_id AND active = true
    )
);
```

### 7.2 API Layer Integration

#### Dependency Injection
```python
async def validate_department_assignment(
    department_id: Optional[int],
    db: AsyncSession = Depends(get_database_session)
) -> Optional[Department]:
    """Reusable department validation dependency."""
    if department_id is None:
        return None

    department = await validate_department_exists(db, department_id)
    validate_department_active(department)
    return department

# Usage in endpoint
@router.post("")
async def create_employee(
    employee_data: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    department: Optional[Department] = Depends(validate_department_assignment)
):
    # department is pre-validated
    pass
```

#### Service Layer Pattern
```python
class EmployeeService:
    """Business logic for employee operations."""

    @staticmethod
    async def create_with_department(
        db: AsyncSession,
        employee_data: EmployeeCreate
    ) -> User:
        """Create employee with department validation."""
        # Validate department
        if employee_data.department_id:
            dept = await DepartmentService.get_active(
                db,
                employee_data.department_id
            )

        # Create employee
        employee = User(
            first_name=employee_data.first_name,
            last_name=employee_data.last_name,
            department_id=employee_data.department_id,
            # ... other fields
        )

        db.add(employee)
        await db.commit()
        await db.refresh(employee)

        return employee
```

### 7.3 Frontend Integration Points

#### API Contract
```typescript
// Employee Create Request
interface EmployeeCreateRequest {
    firstName: string;
    lastName: string;
    email?: string;
    departmentId?: number;
    role?: 'admin' | 'manager' | 'supervisor' | 'employee';
}

// Employee Response
interface EmployeeResponse {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    departmentId: number | null;
    department: DepartmentResponse | null;
    createdAt: string;
    updatedAt: string;
}

// Department Dropdown Data
interface DepartmentOption {
    id: number;
    name: string;
    active: boolean;
    parentId: number | null;
}
```

#### Error Handling
```typescript
try {
    const response = await createEmployee(employeeData);
    // Success
} catch (error) {
    if (error.status === 404) {
        // Department not found
        showError('Selected department no longer exists');
    } else if (error.status === 422) {
        // Inactive department
        const detail = error.response.data.detail;
        showError(`${detail.error}: ${detail.suggestion}`);
    }
}
```

---

## 8. Performance Considerations

### 8.1 Query Optimization

**Problem**: N+1 Query Problem
```python
# Bad: Causes N+1 queries
employees = await db.execute(select(User).limit(100))
for employee in employees:
    department = employee.department  # Separate query per employee!
```

**Solution**: Eager Loading
```python
# Good: Single query with join
query = select(User).options(selectinload(User.department)).limit(100)
employees = await db.execute(query)
# Only 2 queries: 1 for employees, 1 for all departments
```

### 8.2 Indexing Strategy

```sql
-- Essential indexes
CREATE INDEX ix_employees_department_id ON employees(department_id);
CREATE INDEX ix_departments_active ON departments(active);
CREATE INDEX ix_employees_dept_active ON employees(department_id, is_active);

-- Composite index for common query
CREATE INDEX ix_employees_lookup
ON employees(department_id, is_active, last_name, first_name);
```

### 8.3 Caching Strategy

**Level 1: Application Cache**
```python
from functools import lru_cache
from datetime import datetime, timedelta

class DepartmentCache:
    _cache = {}
    _ttl = timedelta(minutes=5)

    @classmethod
    async def get(cls, db: AsyncSession, dept_id: int):
        # Check cache
        if dept_id in cls._cache:
            cached_data, timestamp = cls._cache[dept_id]
            if datetime.utcnow() - timestamp < cls._ttl:
                return cached_data

        # Fetch from DB
        dept = await crud_department.get(db, dept_id)
        cls._cache[dept_id] = (dept, datetime.utcnow())
        return dept
```

**Level 2: Database Query Cache**
```python
# Use SQLAlchemy query cache
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Cache frequently accessed department queries
COMMON_DEPT_QUERY = (
    select(Department)
    .where(Department.active == True)
    .options(selectinload(Department.parent))
    .execution_options(compiled_cache={})
)
```

---

## 9. Security Considerations

### 9.1 Authorization Rules

```python
async def check_department_access(
    current_user: User,
    target_department_id: int,
    db: AsyncSession
):
    """Verify user can assign employees to department."""

    # Admin: Full access
    if current_user.is_admin:
        return True

    # Manager: Own department and children only
    if current_user.role == 'manager':
        user_dept = await crud_department.get(db, current_user.department_id)
        target_dept = await crud_department.get(db, target_department_id)

        # Check if target is user's department or descendant
        return await crud_department.is_descendant(
            db,
            target_dept,
            user_dept
        )

    # Others: No assignment permission
    return False
```

### 9.2 Data Validation

```python
# Prevent injection attacks
@field_validator('department_id')
@classmethod
def sanitize_department_id(cls, v):
    """Ensure department_id is clean integer."""
    if v is None:
        return None

    # Type coercion with validation
    try:
        dept_id = int(v)
        if dept_id <= 0 or dept_id > 2147483647:  # PostgreSQL INT range
            raise ValueError('Department ID out of range')
        return dept_id
    except (TypeError, ValueError) as e:
        raise ValueError('Invalid department ID format')
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```python
# tests/unit/test_employee_schemas.py
class TestEmployeeCreate:
    def test_valid_department_assignment(self):
        """Test valid department ID accepted."""
        data = {
            "firstName": "John",
            "lastName": "Doe",
            "departmentId": 5
        }
        schema = EmployeeCreate(**data)
        assert schema.department_id == 5

    def test_empty_department_converted_to_none(self):
        """Test empty string department_id becomes None."""
        data = {
            "firstName": "John",
            "lastName": "Doe",
            "departmentId": ""
        }
        schema = EmployeeCreate(**data)
        assert schema.department_id is None

    def test_invalid_department_id_rejected(self):
        """Test negative department ID raises error."""
        data = {
            "firstName": "John",
            "lastName": "Doe",
            "departmentId": -1
        }
        with pytest.raises(ValidationError):
            EmployeeCreate(**data)
```

### 10.2 Integration Tests

```python
# tests/integration/test_employee_department_assignment.py
class TestEmployeeDepartmentAssignment:
    async def test_create_employee_with_valid_department(self, db, test_department):
        """Test employee creation with valid department."""
        employee_data = EmployeeCreate(
            first_name="John",
            last_name="Doe",
            department_id=test_department.id
        )

        employee = await EmployeeService.create_with_department(db, employee_data)

        assert employee.department_id == test_department.id
        assert employee.department.name == test_department.name

    async def test_create_employee_with_invalid_department(self, db):
        """Test employee creation with non-existent department."""
        employee_data = EmployeeCreate(
            first_name="John",
            last_name="Doe",
            department_id=99999
        )

        with pytest.raises(HTTPException) as exc_info:
            await EmployeeService.create_with_department(db, employee_data)

        assert exc_info.value.status_code == 404
        assert "Department not found" in str(exc_info.value.detail)

    async def test_create_employee_with_inactive_department(self, db, inactive_dept):
        """Test employee creation with inactive department rejected."""
        employee_data = EmployeeCreate(
            first_name="John",
            last_name="Doe",
            department_id=inactive_dept.id
        )

        with pytest.raises(HTTPException) as exc_info:
            await EmployeeService.create_with_department(db, employee_data)

        assert exc_info.value.status_code == 422
        assert "inactive" in str(exc_info.value.detail).lower()
```

### 10.3 API Tests

```python
# tests/api/test_employee_endpoints.py
class TestEmployeeEndpoints:
    async def test_get_employee_with_department(self, client, test_employee):
        """Test GET employee returns department details."""
        response = await client.get(f"/api/employees/{test_employee.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["departmentId"] == test_employee.department_id
        assert data["department"]["id"] == test_employee.department_id
        assert data["department"]["name"] == test_employee.department.name

    async def test_update_employee_department(self, client, test_employee, other_dept):
        """Test PATCH employee department reassignment."""
        update_data = {"departmentId": other_dept.id}
        response = await client.patch(
            f"/api/employees/{test_employee.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["departmentId"] == other_dept.id
```

---

## 11. Deployment Considerations

### 11.1 Migration Path

**Phase 1: Schema Updates** (Already Complete)
- ✅ Add `department_id` column to employees table
- ✅ Create foreign key constraint
- ✅ Add index on `department_id`

**Phase 2: Code Deployment** (This Architecture)
- Update schema validators
- Enhance API endpoints with validation
- Add error handling
- Update response formats

**Phase 3: Data Migration** (If Needed)
```sql
-- Migrate legacy department data
UPDATE employees e
SET department_id = (
    SELECT d.id
    FROM departments d
    WHERE d.name = e.legacy_department_name
)
WHERE e.legacy_department_name IS NOT NULL;
```

**Phase 4: Monitoring**
- Track department assignment errors
- Monitor query performance
- Validate data integrity

### 11.2 Rollback Strategy

```python
# Feature flag for gradual rollout
ENABLE_DEPARTMENT_VALIDATION = env.bool('ENABLE_DEPT_VALIDATION', default=True)

if ENABLE_DEPARTMENT_VALIDATION:
    # New validation logic
    await validate_department_assignment(employee_data.department_id, db)
else:
    # Old behavior (accept any department_id)
    pass
```

---

## 12. Documentation Requirements

### 12.1 API Documentation Updates

**OpenAPI/Swagger Annotations**:
```python
@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create new employee with department assignment",
    description="""
    Create a new employee with optional department assignment.

    **Required Fields**:
    - firstName: Employee first name
    - lastName: Employee last name

    **Optional Fields**:
    - email: Auto-generated if not provided
    - departmentId: Assign to existing active department

    **Validation**:
    - Department must exist and be active
    - Email must be unique (or auto-generated)

    **Error Codes**:
    - 404: Department not found
    - 409: Email already exists
    - 422: Inactive department or validation error
    """,
    responses={
        201: {
            "description": "Employee created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": 42,
                        "firstName": "John",
                        "lastName": "Doe",
                        "departmentId": 5,
                        "department": {"id": 5, "name": "Engineering"}
                    }
                }
            }
        },
        404: {
            "description": "Department not found",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "error": "Department not found",
                            "code": "DEPT_NOT_FOUND",
                            "department_id": 999
                        }
                    }
                }
            }
        }
    }
)
```

### 12.2 User Documentation

```markdown
# Employee Department Assignment Guide

## Overview
Employees can be assigned to departments for organizational structure and access control.

## Creating Employee with Department

**Request**:
```bash
POST /api/employees
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "departmentId": 5
}
```

**Response**:
```json
{
  "id": 42,
  "firstName": "John",
  "lastName": "Doe",
  "departmentId": 5,
  "department": {
    "id": 5,
    "name": "Engineering",
    "active": true
  }
}
```

## Error Handling

### Department Not Found (404)
The specified department does not exist.

**Solution**: Verify department ID using `GET /api/departments`

### Inactive Department (422)
Cannot assign employee to inactive department.

**Solution**: Activate department first or choose different department
```

---

## 13. Future Enhancements

### 13.1 Advanced Features

**1. Bulk Department Assignment**
```python
@router.post("/api/employees/bulk-assign-department")
async def bulk_assign_department(
    employee_ids: List[int],
    department_id: int,
    db: AsyncSession = Depends(get_database_session)
):
    """Assign multiple employees to department in single transaction."""
    pass
```

**2. Department Transfer Workflow**
```python
@router.post("/api/employees/{employee_id}/transfer")
async def transfer_employee(
    employee_id: int,
    from_department_id: int,
    to_department_id: int,
    effective_date: datetime,
    db: AsyncSession = Depends(get_database_session)
):
    """Transfer employee with audit trail and notifications."""
    pass
```

**3. Department Hierarchy Validation**
```python
async def validate_manager_department_hierarchy(
    employee: User,
    new_department: Department,
    db: AsyncSession
):
    """Prevent managers from being in departments they oversee."""
    if employee.role == 'manager':
        # Check for circular hierarchy
        pass
```

### 13.2 Analytics & Reporting

**1. Department Assignment Metrics**
```python
@router.get("/api/analytics/department-distribution")
async def get_department_distribution(
    db: AsyncSession = Depends(get_database_session)
):
    """
    Get employee distribution across departments.

    Returns:
    - Employee count per department
    - Unassigned employee count
    - Department utilization metrics
    """
    pass
```

**2. Assignment History**
```python
class EmployeeDepartmentHistory(Base):
    """Track department assignment changes."""
    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int]
    department_id: Mapped[Optional[int]]
    changed_by: Mapped[int]
    changed_at: Mapped[datetime]
    reason: Mapped[Optional[str]]
```

---

## 14. Decision Summary

### 14.1 Key Architectural Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Optional department_id** | Backward compatibility, flexible org structure | Requires null handling |
| **Eager loading by default** | Better UX with department details | Slightly higher query cost |
| **Schema-level validation** | Catch errors early, better DX | Cannot validate DB constraints |
| **API-level business validation** | Enforce active department rule | Extra query overhead |
| **Structured error responses** | Better frontend integration | More complex error handling |
| **camelCase aliases** | Frontend consistency | Dual naming maintenance |

### 14.2 Non-Functional Requirements Met

✅ **Performance**:
- Optimized queries (selectinload)
- Indexed foreign keys
- Response caching strategy

✅ **Scalability**:
- Supports hierarchical departments
- Bulk operations possible
- Efficient pagination

✅ **Security**:
- Input validation (SQL injection prevention)
- Authorization checks
- Data sanitization

✅ **Maintainability**:
- Clear separation of concerns
- Reusable validation functions
- Comprehensive documentation

✅ **Reliability**:
- Transaction safety
- Rollback strategies
- Feature flags

---

## 15. Technology Evaluation

### 15.1 Validation Approach

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Pydantic validators** | Early validation, clear errors, type safety | Cannot check DB constraints | ✅ Use for format/type validation |
| **Database constraints** | Data integrity, automatic enforcement | Generic errors, harder to customize | ✅ Use for referential integrity |
| **API middleware** | Centralized logic, reusable | Harder to debug, performance overhead | ❌ Not needed for this use case |
| **Service layer** | Business logic separation, testable | More code, complexity | ✅ Use for complex operations |

### 15.2 Loading Strategy

| Strategy | Queries | Performance | Use Case |
|----------|---------|-------------|----------|
| **Lazy loading** | N+1 | Poor for lists | ❌ Avoid |
| **Eager loading (selectinload)** | 1+1 | Good | ✅ Default for lists |
| **Joined loading** | 1 | Best for single | ✅ Use for single employee |
| **Manual loading** | N+1 | Poor | ❌ Temporary workaround only |

---

## 16. Conclusion

This architecture provides a comprehensive, production-ready solution for department assignment integration in the employee management system. It balances:

- **Functionality**: Full CRUD operations with rich validation
- **Performance**: Optimized queries and caching strategies
- **Developer Experience**: Clear APIs, helpful errors, good documentation
- **User Experience**: Rich responses with nested department data
- **Maintainability**: Clean architecture, testable code, clear separation

The design is extensible for future enhancements (bulk operations, transfer workflows, analytics) while maintaining backward compatibility with existing systems.

---

## Appendices

### A. Complete Schema Definitions

See section 2 for full schema code.

### B. Complete API Endpoint Specifications

See section 3 for all endpoint details.

### C. Database Schema

```sql
-- employees table (existing)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_employees_department_id ON employees(department_id);
CREATE INDEX ix_employees_active ON employees(is_active);
CREATE INDEX ix_employees_dept_active ON employees(department_id, is_active);

-- departments table (existing)
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES departments(id),
    active BOOLEAN DEFAULT TRUE,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### D. Configuration Examples

```python
# settings.py
class Settings:
    # Department validation
    VALIDATE_DEPARTMENT_ACTIVE: bool = True
    DEPARTMENT_CACHE_TTL: int = 300  # seconds
    MAX_DEPARTMENT_HIERARCHY_DEPTH: int = 5

    # Response optimization
    DEFAULT_INCLUDE_DEPARTMENT: bool = True
    ENABLE_DEPARTMENT_CACHING: bool = True
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-20
**Author**: System Architecture Designer
**Review Status**: Pending Review
