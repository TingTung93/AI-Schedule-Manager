# Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Environment](#development-environment)
4. [Database Migrations](#database-migrations)
5. [Running Tests](#running-tests)
6. [Code Style Guide](#code-style-guide)
7. [RBAC Implementation](#rbac-implementation)
8. [Adding New Endpoints](#adding-new-endpoints)
9. [Performance Best Practices](#performance-best-practices)
10. [Security Checklist](#security-checklist)
11. [Debugging](#debugging)
12. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

- **Python**: 3.9 or higher
- **Node.js**: 18 or higher
- **PostgreSQL**: 15 or higher
- **Redis**: 7 or higher (for authentication token management)
- **Git**: For version control

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/AI-Schedule-Manager.git
cd AI-Schedule-Manager

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .

# Frontend setup
cd ../frontend
npm install

# Database setup
createdb scheduledb
cd ../backend
alembic upgrade head

# Start development servers
# Terminal 1 - Backend
cd backend
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm start
```

Access the application at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Project Structure

```
AI-Schedule-Manager/
├── backend/
│   ├── alembic/                 # Database migrations
│   │   ├── versions/            # Migration scripts
│   │   └── env.py              # Alembic configuration
│   ├── src/
│   │   ├── api/                # API route modules
│   │   │   ├── employees.py    # Employee endpoints
│   │   │   ├── departments.py  # Department endpoints
│   │   │   ├── password_management.py
│   │   │   └── ...
│   │   ├── auth/               # Authentication system
│   │   │   ├── auth.py         # JWT service
│   │   │   ├── models.py       # User, Role, Permission
│   │   │   ├── fastapi_routes.py
│   │   │   └── middleware.py
│   │   ├── models/             # Database models
│   │   │   ├── department.py
│   │   │   ├── department_history.py
│   │   │   ├── role_history.py
│   │   │   ├── password_history.py
│   │   │   └── account_status_history.py
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── dependencies.py     # Dependency injection
│   │   ├── database.py         # Database connection
│   │   ├── main.py             # FastAPI application
│   │   └── core/
│   │       └── config.py       # Configuration settings
│   ├── tests/                  # Test suite
│   │   ├── test_employees.py
│   │   ├── test_auth.py
│   │   └── ...
│   ├── alembic.ini             # Alembic configuration
│   ├── setup.py                # Package setup
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   ├── context/            # React context
│   │   └── App.jsx             # Main application
│   ├── public/
│   └── package.json
├── docs/                       # Documentation
│   ├── API_REFERENCE.md
│   ├── DEVELOPER_GUIDE.md
│   ├── USER_GUIDE.md
│   └── MIGRATION_GUIDE.md
└── README.md
```

---

## Development Environment

### Environment Variables

Create a `.env` file in the `/backend` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/scheduledb
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis (for auth token management)
REDIS_URL=redis://localhost:6379/0

# JWT Secrets (generate with: openssl rand -base64 32)
SECRET_KEY=your-super-secret-key-min-32-chars
JWT_SECRET_KEY=your-jwt-secret-key
JWT_REFRESH_SECRET_KEY=your-refresh-secret-key

# Token Expiration
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRES_DAYS=30

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80

# Environment
ENVIRONMENT=development  # or production

# CSRF (optional, defaults to SECRET_KEY)
CSRF_SECRET_KEY=your-csrf-secret-key
```

Create a `.env` file in the `/frontend` directory:

```env
REACT_APP_API_URL=http://localhost:8000
```

### Installing Dependencies

#### Backend

```bash
cd backend
pip install -e .              # Install package in editable mode
pip install -r requirements.txt  # Or install from requirements
```

#### Frontend

```bash
cd frontend
npm install
```

---

## Database Migrations

### Creating a New Migration

```bash
cd backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add employee qualifications field"

# Create empty migration manually
alembic revision -m "Custom migration description"
```

### Applying Migrations

```bash
# Upgrade to latest version
alembic upgrade head

# Upgrade by one version
alembic upgrade +1

# Downgrade by one version
alembic downgrade -1

# View migration history
alembic history

# View current version
alembic current
```

### Migration Best Practices

1. **Always review auto-generated migrations** before applying
2. **Test migrations** on development database first
3. **Write reversible migrations** with both `upgrade()` and `downgrade()`
4. **Backup production database** before running migrations
5. **Use transactions** for data migrations
6. **Add indexes** for foreign keys and frequently queried columns

### Example Migration

```python
"""Add employee qualifications

Revision ID: abc123
Revises: xyz789
Create Date: 2025-01-15 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'abc123'
down_revision = 'xyz789'
branch_labels = None
depends_on = None

def upgrade():
    # Add qualifications column
    op.add_column('employees',
        sa.Column('qualifications',
                  postgresql.ARRAY(sa.String(100)),
                  nullable=True,
                  server_default='{}'))

def downgrade():
    # Remove qualifications column
    op.drop_column('employees', 'qualifications')
```

---

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html --cov-report=term

# Run specific test file
pytest tests/test_employees.py

# Run specific test function
pytest tests/test_employees.py::test_create_employee

# Run with verbose output
pytest -v

# Run and stop on first failure
pytest -x
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Structure

```python
# tests/test_employees.py
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_get_employees():
    """Test retrieving employees list"""
    # Arrange
    token = get_auth_token("admin@example.com", "password")

    # Act
    response = client.get(
        "/api/employees",
        headers={"Authorization": f"Bearer {token}"}
    )

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "employees" in data
    assert "total" in data
```

---

## Code Style Guide

### Python (Backend)

Follow **PEP 8** with these additional conventions:

#### 1. KISS (Keep It Simple, Stupid)

```python
# ❌ Bad - overly complex
def calculate_pay(emp):
    return emp.hours * emp.rate if emp.hours <= 40 else \
           emp.hours * emp.rate + (emp.hours - 40) * emp.rate * 0.5

# ✅ Good - simple and clear
def calculate_pay(employee):
    regular_hours = min(employee.hours, 40)
    overtime_hours = max(employee.hours - 40, 0)

    regular_pay = regular_hours * employee.rate
    overtime_pay = overtime_hours * employee.rate * 1.5

    return regular_pay + overtime_pay
```

#### 2. DRY (Don't Repeat Yourself)

```python
# ❌ Bad - repetitive
async def get_user(db, user_id):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

async def get_department(db, dept_id):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    return result.scalar_one_or_none()

# ✅ Good - reusable
async def get_by_id(db, model, record_id):
    result = await db.execute(select(model).where(model.id == record_id))
    return result.scalar_one_or_none()

# Usage
user = await get_by_id(db, User, user_id)
dept = await get_by_id(db, Department, dept_id)
```

#### 3. Single Responsibility Principle

```python
# ❌ Bad - multiple responsibilities
async def create_employee(db, data, current_user):
    # Validation
    if not data.email:
        raise ValueError("Email required")

    # Business logic
    employee = User(**data)
    db.add(employee)

    # Logging
    print(f"Created employee {employee.id}")

    # Notification
    send_email(employee.email, "Welcome!")

    await db.commit()
    return employee

# ✅ Good - single responsibility per function
async def validate_employee_data(data):
    if not data.email:
        raise ValueError("Email required")

async def save_employee(db, employee):
    db.add(employee)
    await db.flush()
    return employee

async def log_employee_creation(employee):
    logger.info(f"Created employee {employee.id}")

async def send_welcome_email(employee):
    email_service.send(employee.email, "Welcome!")

async def create_employee(db, data, current_user):
    validate_employee_data(data)
    employee = User(**data)
    employee = await save_employee(db, employee)
    await log_employee_creation(employee)
    await send_welcome_email(employee)
    await db.commit()
    return employee
```

#### 4. File Size Limit

- **Maximum**: 500 lines per file
- If exceeded, split into logical modules
- Use separate files for models, schemas, services, and routes

#### 5. Naming Conventions

```python
# Variables and functions: snake_case
user_count = 10
def get_employee_by_id(employee_id):
    pass

# Classes: PascalCase
class EmployeeService:
    pass

# Constants: UPPER_SNAKE_CASE
MAX_EMPLOYEES = 1000
DEFAULT_ROLE = "user"

# Private methods: _leading_underscore
def _internal_helper():
    pass
```

### JavaScript/React (Frontend)

Follow **Airbnb Style Guide** with these conventions:

```javascript
// Variables and functions: camelCase
const employeeCount = 10;
function getEmployeeById(id) { }

// Components: PascalCase
function EmployeeList() { }

// Constants: UPPER_SNAKE_CASE
const MAX_EMPLOYEES = 1000;

// Use functional components with hooks
function EmployeeForm({ onSubmit }) {
  const [formData, setFormData] = useState({});

  return <form onSubmit={onSubmit}>...</form>;
}
```

---

## RBAC Implementation

### Role Hierarchy

```
admin (full access)
  └─ manager (department + employee management)
      └─ user (standard employee)
          └─ guest (read-only)
```

### Permission Checking in Endpoints

```python
from ..dependencies import require_roles, require_permissions

# Require specific roles
@router.post("/api/employees",
             dependencies=[Depends(require_roles("admin", "manager"))])
async def create_employee(...):
    pass

# Require specific permissions
@router.patch("/api/employees/{id}",
              dependencies=[Depends(require_permissions("employee:write"))])
async def update_employee(...):
    pass

# Resource-based authorization (in function body)
@router.patch("/api/employees/{employee_id}")
async def update_employee(employee_id: int, current_user = Depends(get_current_user)):
    # Check if user owns resource
    if employee_id != current_user.id and "admin" not in current_user.roles:
        raise HTTPException(403, "Access denied")
```

### Role Assignment

Only administrators can change user roles:

```python
if 'role' in update_data and not is_admin:
    raise HTTPException(403, "Only administrators can change user roles")
```

---

## Adding New Endpoints

### Step-by-Step Guide

#### 1. Create Database Model

```python
# backend/src/models/qualification.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Qualification(Base):
    __tablename__ = "qualifications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(500))
    category = Column(String(50), index=True)

    # Relationships
    employees = relationship("Employee", secondary="employee_qualifications")
```

#### 2. Create Pydantic Schemas

```python
# backend/src/schemas.py
from pydantic import BaseModel, Field

class QualificationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    category: str | None = None

class QualificationCreate(QualificationBase):
    pass

class QualificationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None

class QualificationResponse(QualificationBase):
    id: int

    class Config:
        from_attributes = True
```

#### 3. Create API Router

```python
# backend/src/api/qualifications.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..dependencies import get_database_session, require_roles
from ..models.qualification import Qualification
from ..schemas import QualificationCreate, QualificationResponse

router = APIRouter(prefix="/api/qualifications", tags=["qualifications"])

@router.get("", response_model=list[QualificationResponse])
async def get_qualifications(
    db: AsyncSession = Depends(get_database_session),
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all qualifications with filtering"""
    query = select(Qualification)

    if category:
        query = query.where(Qualification.category == category)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("",
             response_model=QualificationResponse,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_roles("admin", "manager"))])
async def create_qualification(
    qualification: QualificationCreate,
    db: AsyncSession = Depends(get_database_session)
):
    """Create new qualification"""
    # Check for duplicates
    existing = await db.execute(
        select(Qualification).where(Qualification.name == qualification.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Qualification already exists")

    # Create qualification
    new_qual = Qualification(**qualification.model_dump())
    db.add(new_qual)
    await db.commit()
    await db.refresh(new_qual)

    return new_qual
```

#### 4. Register Router in main.py

```python
# backend/src/main.py
from .api.qualifications import router as qualifications_router

app.include_router(qualifications_router)
```

#### 5. Create Database Migration

```bash
alembic revision --autogenerate -m "Add qualifications table"
alembic upgrade head
```

#### 6. Add Authorization

```python
# For role-based access
@router.post("", dependencies=[Depends(require_roles("admin"))])

# For resource-based access
async def update_qualification(qual_id: int, current_user = Depends(get_current_user)):
    # Check ownership or permissions in function body
    if not has_permission(current_user, "qualification:write"):
        raise HTTPException(403, "Access denied")
```

---

## Performance Best Practices

### 1. Avoid N+1 Queries

```python
# ❌ Bad - N+1 queries
users = await db.execute(select(User))
for user in users.scalars():
    # Triggers separate query for each department
    print(user.department.name)

# ✅ Good - eager loading
from sqlalchemy.orm import selectinload

query = select(User).options(selectinload(User.department))
users = await db.execute(query)
for user in users.scalars():
    # Department already loaded
    print(user.department.name)
```

### 2. Bulk Loading Related Data

```python
# Load multiple related objects efficiently
dept_ids = [user.department_id for user in users if user.department_id]
if dept_ids:
    dept_query = select(Department).where(Department.id.in_(dept_ids))
    departments = {d.id: d for d in (await db.execute(dept_query)).scalars()}

    for user in users:
        user.department = departments.get(user.department_id)
```

### 3. Use Database Indexes

```python
# Add indexes to frequently queried columns
id = Column(Integer, primary_key=True, index=True)
email = Column(String, unique=True, index=True)
department_id = Column(Integer, ForeignKey("departments.id"), index=True)
is_active = Column(Boolean, default=True, index=True)
```

### 4. Pagination

Always paginate large result sets:

```python
@router.get("/api/employees")
async def get_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    query = select(User).offset(skip).limit(limit)
```

### 5. Database Connection Pooling

Configure in `database.py`:

```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,        # Number of connections to keep
    max_overflow=20,     # Additional connections when needed
    pool_pre_ping=True,  # Test connections before use
    pool_recycle=3600    # Recycle connections after 1 hour
)
```

---

## Security Checklist

### Backend Security

- [ ] **Input Validation**: All inputs validated with Pydantic schemas
- [ ] **SQL Injection**: Use parameterized queries (SQLAlchemy ORM)
- [ ] **XSS Prevention**: Sanitize text inputs (escape HTML)
- [ ] **CSRF Protection**: CSRF tokens for state-changing requests
- [ ] **Authentication**: JWT tokens with short expiration (15 min)
- [ ] **Authorization**: RBAC checks on all protected endpoints
- [ ] **Password Security**: bcrypt hashing with salt
- [ ] **Password History**: Prevent reuse of last 5 passwords
- [ ] **Rate Limiting**: Limit login attempts and API requests
- [ ] **HTTPS**: Force HTTPS in production
- [ ] **Security Headers**: Set X-Frame-Options, CSP, etc.
- [ ] **Secrets Management**: Never hardcode secrets
- [ ] **Logging**: Log security events (auth, permission denied)
- [ ] **Error Messages**: Sanitize errors in production

### Frontend Security

- [ ] **Token Storage**: Store JWT in httpOnly cookies or secure storage
- [ ] **CSRF Token**: Include in all mutating requests
- [ ] **Input Validation**: Client-side validation for UX
- [ ] **XSS Prevention**: Escape user-generated content
- [ ] **Dependency Audit**: Run `npm audit` regularly
- [ ] **Environment Variables**: Never commit `.env` files

---

## Debugging

### Backend Debugging

#### Enable Debug Logging

```python
# backend/src/main.py
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

#### Print SQL Queries

```python
# backend/src/database.py
engine = create_async_engine(
    DATABASE_URL,
    echo=True  # Print all SQL queries
)
```

#### Use Debugger

```python
import pdb

@router.get("/api/employees/{id}")
async def get_employee(employee_id: int):
    pdb.set_trace()  # Breakpoint
    # Code execution pauses here
```

#### View Request Details

```python
@router.post("/api/employees")
async def create_employee(request: Request, employee: EmployeeCreate):
    print(f"Headers: {request.headers}")
    print(f"Client: {request.client}")
    print(f"Body: {employee.model_dump()}")
```

### Frontend Debugging

```javascript
// Enable React DevTools
// Install: npm install react-devtools

// Console debugging
console.log('Employee data:', employee);
console.table(employees);

// Network debugging
// Use browser DevTools Network tab to inspect API calls
```

---

## Contributing

### Workflow

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m "feat: Add amazing feature"`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** Pull Request

### Commit Message Format

Follow Conventional Commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Example**:
```
feat(employees): Add qualifications field

- Add qualifications array to employee model
- Create migration for new column
- Update API endpoints to support qualifications
- Add validation for max 20 qualifications

Closes #123
```

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass (`pytest` and `npm test`)
- [ ] Added tests for new features
- [ ] Updated documentation
- [ ] No merge conflicts
- [ ] Passes code review

---

## Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com
- **SQLAlchemy Documentation**: https://docs.sqlalchemy.org
- **Alembic Documentation**: https://alembic.sqlalchemy.org
- **React Documentation**: https://react.dev
- **Material-UI Documentation**: https://mui.com

---

*Last Updated: 2025-01-15*
