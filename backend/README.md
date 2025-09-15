# AI Schedule Manager - Backend

A comprehensive SQLAlchemy-based backend for AI-powered schedule management with proper relationships, constraints, and async support.

## 🏗️ Database Models

### Core Models

- **Employee**: User management with authentication, qualifications, and availability tracking
- **Shift**: Work periods with time constraints and staffing requirements
- **Schedule**: Weekly schedules with versioning and approval workflow
- **ScheduleAssignment**: Links employees to shifts with conflict resolution
- **Rule**: Scheduling constraints and business rules with validation
- **Notification**: Multi-channel user messaging system

### Key Features

- ✅ SQLAlchemy 2.0 with async support
- ✅ Comprehensive relationships and foreign keys
- ✅ Advanced constraints and validation
- ✅ Alembic migrations with async configuration
- ✅ PostgreSQL with JSONB support for flexible data
- ✅ Proper indexing for performance
- ✅ Development seed data script

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Configuration

Update your `.env` file or environment variables:

```env
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/ai_schedule_manager
```

### 3. Database Setup

```bash
# Run migrations
python scripts/run_migrations.py

# Seed development data
python scripts/seed_data.py
```

## 📊 Database Schema Overview

### Employee Model
- Authentication with password hashing
- Role-based permissions (admin, manager, supervisor, employee)
- Qualifications tracking (JSONB array)
- Flexible availability (JSONB with day/time slots)
- Audit trails and soft delete support

### Shift Model
- Date and time constraints with validation
- Shift type classification (general, management, specialized, emergency)
- Staffing requirements and priority levels
- Requirements specification (JSONB)
- Conflict detection and duration calculations

### Schedule Model
- Weekly schedule periods with validation
- Status workflow (draft → pending → approved → published)
- Version control with parent/child relationships
- Approval workflow with timestamps
- Coverage analytics and reporting

### ScheduleAssignment Model
- Employee-to-shift assignments within schedules
- Status tracking (assigned, pending, confirmed, declined)
- Conflict resolution with automatic detection
- Priority system and auto-assignment tracking
- Confirmation workflow with time limits

### Rule Model
- Comprehensive constraint validation system
- Multiple rule types (availability, workload, qualification, etc.)
- Global and employee-specific rules
- Priority-based rule processing
- Violation tracking and reporting

### Notification Model
- Multi-channel delivery (in-app, email, push, SMS)
- Priority levels and categorization
- Factory methods for common notification types
- Read/unread tracking with timestamps
- Expiration and cleanup support

## 🔧 Advanced Features

### Relationship Mapping
- Proper foreign key constraints with cascade rules
- Bidirectional relationships with back_populates
- Efficient eager loading with relationship configuration
- Cross-table constraint validation

### Validation System
- Database-level constraints (CHECK, UNIQUE, NOT NULL)
- Application-level validation methods
- Business rule enforcement with priority handling
- Conflict detection and resolution algorithms

### Performance Optimization
- Strategic indexing on frequently queried columns
- Composite indexes for complex queries
- JSONB GIN indexes for flexible data querying
- Connection pooling with async support

### Migration Management
- Alembic with async engine support
- Automatic schema generation from models
- Migration rollback and upgrade paths
- Environment-specific configuration

## 🧪 Development Tools

### Seed Data
```bash
python scripts/seed_data.py
```
Creates comprehensive test data including:
- 5 sample employees with different roles
- 28 shifts over 7 days with various types
- 1 published schedule with assignments
- Multiple scheduling rules and constraints
- Sample notifications for testing

### Test Credentials
- Manager: `john.manager@company.com` / `manager123`
- Supervisor: `alice.supervisor@company.com` / `supervisor123`
- Worker: `bob.worker@company.com` / `worker123`
- Specialist: `carol.specialist@company.com` / `specialist123`
- Night Worker: `david.night@company.com` / `night123`

## 📝 Usage Examples

### Basic Operations

```python
from src.database import AsyncSessionLocal
from src.models import Employee, Shift, Schedule

async def create_employee():
    async with AsyncSessionLocal() as session:
        employee = Employee(
            name="Jane Doe",
            email="jane@example.com",
            password_hash=hash_password("secure123"),
            role="employee",
            qualifications=["general", "certified"],
            availability={
                "monday": {
                    "available": True,
                    "time_slots": [{"start": "09:00", "end": "17:00"}]
                }
            }
        )
        session.add(employee)
        await session.commit()
```

### Advanced Queries

```python
# Find available employees for a shift
async def find_available_employees(shift_id: int):
    async with AsyncSessionLocal() as session:
        shift = await session.get(Shift, shift_id)
        day_name = shift.date.strftime("%A").lower()

        # Query employees with proper qualifications and availability
        employees = await session.execute(
            select(Employee)
            .where(Employee.is_active == True)
            .where(Employee.qualifications.contains([shift.requirements.get("qualifications", [])]))
        )

        available = []
        for employee in employees.scalars():
            if employee.is_available_at(day_name, shift.start_time.strftime("%H:%M")):
                can_assign, reason = shift.can_assign_employee(employee)
                if can_assign:
                    available.append(employee)

        return available
```

## 🔍 Model Details

### Constraint Examples

```sql
-- Employee constraints
CHECK (role IN ('admin', 'manager', 'supervisor', 'employee'))
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
CHECK (char_length(name) >= 2)

-- Shift constraints
CHECK (start_time < end_time)
CHECK (required_staff > 0)
CHECK (priority BETWEEN 1 AND 10)

-- Schedule constraints
CHECK (week_start <= week_end)
CHECK (week_end - week_start <= INTERVAL '7 days')
CHECK ((status = 'approved' AND approved_by IS NOT NULL) OR status != 'approved')
```

### Index Strategy

```sql
-- Performance indexes
CREATE INDEX ix_employees_role_active ON employees (role, is_active);
CREATE INDEX ix_shifts_date_time ON shifts (date, start_time, end_time);
CREATE INDEX ix_assignments_schedule_status ON schedule_assignments (schedule_id, status);

-- JSONB indexes for flexible querying
CREATE INDEX ix_employees_qualifications ON employees USING gin (qualifications);
CREATE INDEX ix_employees_availability ON employees USING gin (availability);
CREATE INDEX ix_shifts_requirements ON shifts USING gin (requirements);
```

## 🛠️ Configuration

### Database Settings
- Connection pooling: 20 connections, 30 overflow
- Connection recycling: 300 seconds
- Async engine with pre-ping health checks
- Echo mode for development (disable in production)

### Alembic Configuration
- Async migration support
- Automatic schema comparison
- Environment-based database URLs
- Type and default value comparison

## 📚 Dependencies

```txt
fastapi==0.104.0
uvicorn[standard]==0.24.0
sqlalchemy==2.0.0
pydantic==2.5.0
alembic==1.13.1
asyncpg==0.29.0
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
```

## 🔒 Security Features

- Password hashing with bcrypt
- SQL injection prevention through parameterized queries
- Role-based access control
- Input validation at multiple levels
- Audit trails for sensitive operations

## 📈 Performance Considerations

- Async database operations throughout
- Efficient relationship loading strategies
- Strategic use of JSONB for flexible data
- Connection pooling and recycling
- Query optimization with proper indexing

This backend provides a solid foundation for AI-powered schedule management with enterprise-grade features, proper data integrity, and excellent performance characteristics.