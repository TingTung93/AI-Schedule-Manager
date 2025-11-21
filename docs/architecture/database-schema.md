# Database Schema Architecture

## Overview
Complete PostgreSQL database schema for AI Schedule Manager with comprehensive CRUD operations, relationships, and constraints.

## Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   Employees     │───────│   Departments    │───────│     Shifts      │
│                 │   1:N │                  │  1:N  │                 │
│ - id (PK)       │       │ - id (PK)        │       │ - id (PK)       │
│ - email (UQ)    │       │ - name (UQ)      │       │ - date          │
│ - name          │       │ - parent_id (FK) │       │ - start_time    │
│ - role          │       │ - description    │       │ - end_time      │
│ - department_id │       │ - settings       │       │ - shift_type    │
│ - qualifications│       │ - active         │       │ - department_id │
│ - availability  │       └──────────────────┘       │ - required_staff│
│ - is_active     │                                  │ - requirements  │
└────────┬────────┘                                  │ - priority      │
         │                                           └────────┬────────┘
         │                                                    │
         │         ┌──────────────────────┐                  │
         │    1:N  │  Schedule_Assignments│  N:1             │
         └─────────│                      │──────────────────┘
                   │ - id (PK)            │
         ┌─────────│ - schedule_id (FK)   │
         │         │ - employee_id (FK)   │
         │         │ - shift_id (FK)      │
         │         │ - status             │
         │         │ - priority           │
         │         │ - assigned_by (FK)   │
         │         │ - conflicts_resolved │
         │         │ - auto_assigned      │
         │         └──────────────────────┘
         │                   │
         │                   │ N:1
         │         ┌─────────▼────────┐
         │         │    Schedules     │
         │    1:N  │                  │
         ├─────────│ - id (PK)        │
         │         │ - week_start     │
         │         │ - week_end       │
         │         │ - status         │
         │         │ - version        │
         │         │ - created_by (FK)│
         │         │ - approved_by(FK)│
         │         │ - parent_id (FK) │
         │         └──────────────────┘
         │
         │         ┌──────────────────┐
         │    1:N  │      Rules       │
         └─────────│                  │
                   │ - id (PK)        │
                   │ - rule_type      │
                   │ - employee_id(FK)│
                   │ - constraints    │
                   │ - priority       │
                   │ - active         │
                   └──────────────────┘
```

## Core Tables

### 1. Employees
Primary user and employee management table with authentication.

```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'employee',
    department_id INTEGER REFERENCES departments(id),
    qualifications TEXT[],
    availability JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_role CHECK (role IN ('admin', 'manager', 'supervisor', 'employee')),
    CONSTRAINT valid_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT name_min_length CHECK (char_length(name) >= 2)
);

CREATE INDEX ix_employees_email ON employees(email);
CREATE INDEX ix_employees_name ON employees(name);
CREATE INDEX ix_employees_role_active ON employees(role, is_active);
CREATE INDEX ix_employees_qualifications ON employees USING GIN(qualifications);
CREATE INDEX ix_employees_availability ON employees USING GIN(availability);
```

**Availability JSON Structure:**
```json
{
  "monday": {
    "available": true,
    "time_slots": [
      {"start": "09:00", "end": "17:00"}
    ]
  },
  "tuesday": {
    "available": true,
    "time_slots": [
      {"start": "09:00", "end": "17:00"}
    ]
  }
}
```

### 2. Departments
Hierarchical department structure with settings.

```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES departments(id),
    settings JSONB DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_departments_name ON departments(name);
CREATE INDEX ix_departments_parent_id ON departments(parent_id);
CREATE INDEX ix_departments_active ON departments(active);
```

### 3. Shifts
Shift definitions with staffing requirements.

```sql
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type VARCHAR(100) NOT NULL DEFAULT 'general',
    department_id INTEGER REFERENCES departments(id),
    required_staff INTEGER NOT NULL DEFAULT 1,
    requirements JSONB,
    description VARCHAR(500),
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_shift_times CHECK (start_time < end_time),
    CONSTRAINT positive_required_staff CHECK (required_staff > 0),
    CONSTRAINT valid_priority_range CHECK (priority BETWEEN 1 AND 10),
    CONSTRAINT valid_shift_type CHECK (shift_type IN ('general', 'management', 'specialized', 'emergency', 'training'))
);

CREATE INDEX ix_shifts_date ON shifts(date);
CREATE INDEX ix_shifts_date_time ON shifts(date, start_time, end_time);
CREATE INDEX ix_shifts_type_priority ON shifts(shift_type, priority);
CREATE INDEX ix_shifts_requirements ON shifts USING GIN(requirements);
CREATE INDEX ix_shifts_date_type ON shifts(date, shift_type);
```

**Requirements JSON Structure:**
```json
{
  "qualifications": ["certified", "supervisor"],
  "skills": ["customer_service", "cash_handling"],
  "min_experience_months": 6
}
```

### 4. Schedules
Weekly schedule management with versioning and approval workflow.

```sql
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    parent_schedule_id INTEGER REFERENCES schedules(id),
    title VARCHAR(255),
    description VARCHAR(1000),
    notes VARCHAR(2000),
    created_by INTEGER NOT NULL REFERENCES employees(id),
    approved_by INTEGER REFERENCES employees(id),
    approved_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_week_period CHECK (week_start <= week_end),
    CONSTRAINT max_week_duration CHECK (week_end - week_start <= INTERVAL '7 days'),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'archived', 'rejected')),
    CONSTRAINT positive_version CHECK (version > 0),
    CONSTRAINT approval_required_when_approved CHECK ((status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR status != 'approved'),
    CONSTRAINT published_date_required_when_published CHECK ((status = 'published' AND published_at IS NOT NULL) OR status != 'published')
);

CREATE INDEX ix_schedules_week_start ON schedules(week_start);
CREATE INDEX ix_schedules_week_end ON schedules(week_end);
CREATE INDEX ix_schedules_status ON schedules(status);
CREATE INDEX ix_schedules_week_period ON schedules(week_start, week_end);
CREATE INDEX ix_schedules_status_created ON schedules(status, created_at);
CREATE INDEX ix_schedules_creator_status ON schedules(created_by, status);
CREATE INDEX ix_schedules_parent_version ON schedules(parent_schedule_id, version);
```

### 5. Schedule_Assignments
Junction table linking employees to shifts within schedules.

```sql
CREATE TABLE schedule_assignments (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'assigned',
    priority INTEGER NOT NULL DEFAULT 1,
    notes VARCHAR(1000),
    assigned_by INTEGER REFERENCES employees(id),
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    conflicts_resolved BOOLEAN NOT NULL DEFAULT false,
    auto_assigned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_schedule_employee_shift UNIQUE (schedule_id, employee_id, shift_id),
    CONSTRAINT valid_assignment_status CHECK (status IN ('assigned', 'pending', 'confirmed', 'declined', 'cancelled', 'completed')),
    CONSTRAINT valid_assignment_priority CHECK (priority BETWEEN 1 AND 10)
);

CREATE INDEX ix_assignments_schedule_id ON schedule_assignments(schedule_id);
CREATE INDEX ix_assignments_employee_id ON schedule_assignments(employee_id);
CREATE INDEX ix_assignments_shift_id ON schedule_assignments(shift_id);
CREATE INDEX ix_assignments_schedule_status ON schedule_assignments(schedule_id, status);
CREATE INDEX ix_assignments_employee_status ON schedule_assignments(employee_id, status);
CREATE INDEX ix_assignments_shift_status ON schedule_assignments(shift_id, status);
CREATE INDEX ix_assignments_employee_schedule ON schedule_assignments(employee_id, schedule_id);
CREATE INDEX ix_assignments_date_employee ON schedule_assignments(assigned_at, employee_id);
CREATE INDEX ix_assignments_auto_assigned ON schedule_assignments(auto_assigned, status);
```

### 6. Rules
Scheduling rules and constraints for employees.

```sql
CREATE TABLE rules (
    id SERIAL PRIMARY KEY,
    rule_type VARCHAR(100) NOT NULL,
    employee_id INTEGER REFERENCES employees(id),
    original_text TEXT,
    constraints JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_rule_type CHECK (rule_type IN ('availability', 'max_hours', 'min_hours', 'rest_period', 'preferred_shift', 'blocked_shift', 'skill_requirement', 'custom')),
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 10)
);

CREATE INDEX ix_rules_rule_type ON rules(rule_type);
CREATE INDEX ix_rules_employee_id ON rules(employee_id);
CREATE INDEX ix_rules_active ON rules(active);
CREATE INDEX ix_rules_constraints ON rules USING GIN(constraints);
```

### 7. Notifications
User notifications and alerts.

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    notification_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'normal',
    read BOOLEAN NOT NULL DEFAULT false,
    action_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP,

    CONSTRAINT valid_notification_type CHECK (notification_type IN ('schedule_update', 'shift_assignment', 'shift_change', 'approval_request', 'system', 'reminder')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX ix_notifications_user_id ON notifications(user_id);
CREATE INDEX ix_notifications_type ON notifications(notification_type);
CREATE INDEX ix_notifications_read ON notifications(read);
CREATE INDEX ix_notifications_user_read ON notifications(user_id, read);
CREATE INDEX ix_notifications_created_at ON notifications(created_at DESC);
```

### 8. User_Settings
User preferences and configuration.

```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(100) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{}',
    display_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_user_settings_user_id ON user_settings(user_id);
```

## Relationships Summary

### One-to-Many Relationships
- **Department → Employees**: One department has many employees
- **Department → Shifts**: One department has many shifts
- **Department → Department**: Hierarchical (parent → children)
- **Employee → Rules**: One employee has many rules
- **Employee → Notifications**: One employee has many notifications
- **Employee → Schedule_Assignments**: One employee has many assignments
- **Schedule → Schedule_Assignments**: One schedule has many assignments
- **Shift → Schedule_Assignments**: One shift can have many assignments

### Many-to-Many Relationships
- **Employees ↔ Shifts**: Through schedule_assignments
- **Schedules ↔ Employees**: Through schedule_assignments
- **Schedules ↔ Shifts**: Through schedule_assignments

### Self-Referential Relationships
- **Department → Department**: Hierarchical structure (parent_id)
- **Schedule → Schedule**: Versioning (parent_schedule_id)

## Database Constraints

### Data Integrity
1. **Foreign Key Constraints**: All relationships enforced with CASCADE/RESTRICT policies
2. **Unique Constraints**: Email uniqueness, department name uniqueness
3. **Check Constraints**: Valid enums, date ranges, positive numbers
4. **NOT NULL Constraints**: Required fields enforced at database level

### Performance Indexes
1. **B-tree Indexes**: Standard indexes on foreign keys and frequently queried columns
2. **Composite Indexes**: Multi-column indexes for common query patterns
3. **GIN Indexes**: JSONB and array column indexing for fast lookups
4. **Unique Indexes**: Enforcing uniqueness constraints with performance benefits

## Audit and Tracking
All core tables include:
- `created_at`: Timestamp of record creation
- `updated_at`: Timestamp of last modification (auto-updated)
- Soft delete support via `active` or `is_active` flags

## Migration Strategy
See `/docs/architecture/migration-plan.md` for detailed migration steps from mocked data to this schema.
