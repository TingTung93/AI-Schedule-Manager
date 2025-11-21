# Data Models Documentation

Complete reference for all data models in the AI Schedule Manager system.

## Table of Contents

- [Overview](#overview)
- [Core Models](#core-models)
  - [Schedule](#schedule)
  - [ScheduleAssignment](#scheduleassignment)
  - [Employee](#employee)
  - [Shift](#shift)
  - [Department](#department)
- [Supporting Models](#supporting-models)
- [Relationships](#relationships)
- [Data Model Diagrams](#data-model-diagrams)
- [Field Constraints](#field-constraints)
- [Computed Properties](#computed-properties)

## Overview

The AI Schedule Manager uses a relational data model with SQLAlchemy ORM. All models inherit from a `Base` class and include:

- Automatic timestamp fields (`created_at`, `updated_at`)
- Serialization methods (`to_dict()` with camelCase support)
- Validation constraints at the database level
- Computed properties for common calculations

### Key Design Principles

1. **Separation of Concerns**: Schedule container vs. individual assignments
2. **Audit Trail**: All modifications are tracked with timestamps and user IDs
3. **Workflow State**: Status-based workflow with validation
4. **Flexibility**: JSON fields for extensible requirements and settings
5. **Performance**: Strategic indexes and eager loading support

---

## Core Models

### Schedule

The `Schedule` model represents a weekly schedule container with approval workflow and versioning.

#### Purpose

- Contains metadata about a scheduling period (typically 1 week)
- Manages workflow status (draft → approval → published)
- Tracks versioning for schedule revisions
- Does NOT contain individual shift assignments (see ScheduleAssignment)

#### Database Table: `schedules`

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | Yes | Auto | Primary key |
| `week_start` | date | Yes | - | First day of schedule week |
| `week_end` | date | Yes | - | Last day of schedule week |
| `status` | string(50) | Yes | "draft" | Workflow status |
| `version` | integer | Yes | 1 | Version number for revisions |
| `parent_schedule_id` | integer | No | null | Parent schedule if this is a revision |
| `title` | string(255) | No | null | Schedule title |
| `description` | string(1000) | No | null | Schedule description |
| `notes` | string(2000) | No | null | Internal notes |
| `created_by` | integer | Yes | - | Employee ID of creator |
| `approved_by` | integer | No | null | Employee ID of approver |
| `approved_at` | timestamp | No | null | Approval timestamp |
| `published_at` | timestamp | No | null | Publishing timestamp |
| `created_at` | timestamp | Yes | now() | Creation timestamp |
| `updated_at` | timestamp | Yes | now() | Last update timestamp |

#### Status Values

```python
STATUS_CHOICES = [
    "draft",              # Initial state, editable
    "pending_approval",   # Submitted for approval
    "approved",          # Approved by manager
    "published",         # Published to employees
    "archived",          # Archived/inactive
    "rejected"           # Rejected, can return to draft
]
```

#### Constraints

```sql
-- Week period must be valid
CHECK (week_start <= week_end)

-- Week duration max 7 days
CHECK (week_end - week_start <= INTERVAL '7 days')

-- Valid status values
CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'archived', 'rejected'))

-- Version must be positive
CHECK (version > 0)

-- Approval data required when approved
CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR status != 'approved'
)

-- Published date required when published
CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR status != 'published'
)
```

#### Indexes

```sql
CREATE INDEX ix_schedules_week_period ON schedules (week_start, week_end);
CREATE INDEX ix_schedules_status_created ON schedules (status, created_at);
CREATE INDEX ix_schedules_creator_status ON schedules (created_by, status);
CREATE INDEX ix_schedules_parent_version ON schedules (parent_schedule_id, version);
```

#### Computed Properties

```python
@property
def is_editable(self) -> bool:
    """Can be edited only in draft or rejected status"""
    return self.status in ["draft", "rejected"]

@property
def is_current_week(self) -> bool:
    """True if schedule covers current week"""
    today = date.today()
    return self.week_start <= today <= self.week_end

@property
def days_until_start(self) -> int:
    """Days until schedule starts (negative if past)"""
    return (self.week_start - date.today()).days
```

#### Methods

```python
def can_approve(self, user: Employee) -> tuple[bool, str]:
    """Check if user can approve this schedule"""

def can_publish(self, user: Employee) -> tuple[bool, str]:
    """Check if user can publish this schedule"""

def create_revision(self, created_by: int, title: str = None) -> Schedule:
    """Create new revision of this schedule"""

def get_coverage_summary(self) -> dict:
    """Get summary of shift coverage"""
```

#### Example JSON

```json
{
  "id": 1,
  "weekStart": "2025-01-13",
  "weekEnd": "2025-01-19",
  "status": "published",
  "version": 2,
  "parentScheduleId": null,
  "title": "Week 3 - January 2025",
  "description": "Regular weekly schedule with extra coverage",
  "notes": "Updated to accommodate vacation requests",
  "createdBy": 5,
  "approvedBy": 1,
  "approvedAt": "2025-01-10T14:30:00Z",
  "publishedAt": "2025-01-11T09:00:00Z",
  "createdAt": "2025-01-08T10:15:00Z",
  "updatedAt": "2025-01-10T14:30:00Z",
  "isEditable": false,
  "isCurrentWeek": true,
  "daysUntilStart": 2
}
```

---

### ScheduleAssignment

The `ScheduleAssignment` model represents individual employee-to-shift assignments within a schedule.

#### Purpose

- Links an employee to a specific shift within a schedule
- Tracks assignment status and confirmation
- Manages conflict resolution
- Supports both manual and AI-generated assignments

#### Database Table: `schedule_assignments`

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | Yes | Auto | Primary key |
| `schedule_id` | integer | Yes | - | Parent schedule ID (FK) |
| `employee_id` | integer | Yes | - | Assigned employee ID (FK) |
| `shift_id` | integer | Yes | - | Assigned shift ID (FK) |
| `status` | string(50) | Yes | "assigned" | Assignment status |
| `priority` | integer | Yes | 1 | Assignment priority (1-10) |
| `notes` | string(1000) | No | null | Assignment notes |
| `assigned_by` | integer | No | null | Employee who created assignment |
| `assigned_at` | timestamp | Yes | now() | Assignment creation time |
| `conflicts_resolved` | boolean | Yes | false | Whether conflicts resolved |
| `auto_assigned` | boolean | Yes | false | Whether AI-generated |
| `created_at` | timestamp | Yes | now() | Record creation time |

#### Status Values

```python
ASSIGNMENT_STATUS = [
    "assigned",   # Initially assigned
    "pending",    # Pending employee confirmation
    "confirmed",  # Confirmed by employee
    "declined",   # Declined by employee
    "cancelled",  # Cancelled by manager
    "completed"   # Shift completed
]
```

#### Constraints

```sql
-- Unique constraint: one assignment per employee per shift in a schedule
UNIQUE (schedule_id, employee_id, shift_id)

-- Valid status values
CHECK (status IN ('assigned', 'pending', 'confirmed', 'declined', 'cancelled', 'completed'))

-- Priority range 1-10
CHECK (priority BETWEEN 1 AND 10)
```

#### Indexes

```sql
CREATE INDEX ix_assignments_schedule_status ON schedule_assignments (schedule_id, status);
CREATE INDEX ix_assignments_employee_status ON schedule_assignments (employee_id, status);
CREATE INDEX ix_assignments_shift_status ON schedule_assignments (shift_id, status);
CREATE INDEX ix_assignments_employee_schedule ON schedule_assignments (employee_id, schedule_id);
CREATE INDEX ix_assignments_auto_assigned ON schedule_assignments (auto_assigned, status);
```

#### Computed Properties

```python
@property
def is_active(self) -> bool:
    """Assignment is active if assigned or confirmed"""
    return self.status in ["assigned", "confirmed"]

@property
def is_confirmed(self) -> bool:
    """Assignment has been confirmed by employee"""
    return self.status == "confirmed"

@property
def needs_confirmation(self) -> bool:
    """Assignment requires employee confirmation"""
    return self.status in ["assigned", "pending"]
```

#### Methods

```python
def can_modify(self, user: Employee) -> tuple[bool, str]:
    """Check if user can modify this assignment"""

def can_confirm(self, user: Employee) -> tuple[bool, str]:
    """Check if user can confirm assignment"""

def can_decline(self, user: Employee) -> tuple[bool, str]:
    """Check if user can decline assignment (48-hour window)"""

def confirm_assignment(self, user: Employee) -> tuple[bool, str]:
    """Confirm the assignment"""

def decline_assignment(self, user: Employee, reason: str) -> tuple[bool, str]:
    """Decline the assignment"""

def check_conflicts(self) -> List[str]:
    """Check for scheduling conflicts"""

def resolve_conflicts(self) -> bool:
    """Attempt to resolve conflicts automatically"""
```

#### Example JSON

```json
{
  "id": 42,
  "scheduleId": 1,
  "employeeId": 7,
  "shiftId": 15,
  "status": "confirmed",
  "priority": 5,
  "notes": "Requested this shift for overtime",
  "assignedBy": 1,
  "assignedAt": "2025-01-10T10:00:00Z",
  "conflictsResolved": true,
  "autoAssigned": false,
  "createdAt": "2025-01-10T10:00:00Z",
  "isActive": true,
  "isConfirmed": true,
  "needsConfirmation": false
}
```

---

### Employee

The `Employee` model represents users with authentication and scheduling capabilities.

#### Purpose

- User authentication and authorization
- Employee profile and contact information
- Availability and qualification tracking
- Department assignment and role management

#### Database Table: `employees`

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | Yes | Auto | Primary key |
| `email` | string(255) | Yes | - | Email (unique, indexed) |
| `password_hash` | string(255) | Yes | - | Bcrypt password hash |
| `name` | string(255) | Yes | - | Full name |
| `role` | string(100) | Yes | "employee" | User role for permissions |
| `department_id` | integer | No | null | Department assignment (FK) |
| `qualifications` | string[] | No | null | Array of qualifications |
| `availability` | jsonb | No | null | Weekly availability schedule |
| `is_active` | boolean | Yes | true | Account active status |
| `is_admin` | boolean | Yes | false | Admin privileges |
| `created_at` | timestamp | Yes | now() | Account creation |
| `updated_at` | timestamp | Yes | now() | Last update |

#### Role Values

```python
ROLES = [
    "admin",      # Full system access
    "manager",    # Department/schedule management
    "supervisor", # Limited management
    "employee"    # Basic access
]
```

#### Availability JSON Structure

```json
{
  "monday": {
    "available": true,
    "timeSlots": [
      {"start": "09:00", "end": "17:00"}
    ]
  },
  "tuesday": {
    "available": true,
    "timeSlots": [
      {"start": "09:00", "end": "17:00"}
    ]
  },
  "wednesday": {
    "available": false
  }
}
```

#### Constraints

```sql
-- Valid role values
CHECK (role IN ('admin', 'manager', 'supervisor', 'employee'))

-- Email format validation
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')

-- Name minimum length
CHECK (char_length(name) >= 2)
```

#### Indexes

```sql
CREATE UNIQUE INDEX ix_employees_email ON employees (email);
CREATE INDEX ix_employees_role_active ON employees (role, is_active);
CREATE INDEX ix_employees_qualifications ON employees USING gin (qualifications);
CREATE INDEX ix_employees_availability ON employees USING gin (availability);
```

#### Methods

```python
def has_qualification(self, qualification: str) -> bool:
    """Check if employee has specific qualification"""

def is_available_at(self, day: str, time: str) -> bool:
    """Check availability at specific day/time"""

def can_work_shift_type(self, shift_type: str) -> bool:
    """Check if qualified for shift type"""
```

#### Example JSON

```json
{
  "id": 7,
  "email": "john.doe@example.com",
  "name": "John Doe",
  "role": "employee",
  "departmentId": 3,
  "qualifications": ["certified", "barista", "shift_lead"],
  "availability": {
    "monday": {
      "available": true,
      "timeSlots": [{"start": "09:00", "end": "17:00"}]
    },
    "wednesday": {
      "available": false
    }
  },
  "isActive": true,
  "isAdmin": false,
  "createdAt": "2024-06-15T08:00:00Z",
  "updatedAt": "2025-01-05T12:30:00Z"
}
```

---

### Shift

The `Shift` model defines work periods with staffing requirements.

#### Purpose

- Define shift timing and duration
- Specify staffing requirements
- Set qualification requirements
- Track shift priority and type

#### Database Table: `shifts`

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | Yes | Auto | Primary key |
| `date` | date | Yes | - | Shift date |
| `start_time` | time | Yes | - | Start time (HH:MM:SS) |
| `end_time` | time | Yes | - | End time (HH:MM:SS) |
| `shift_type` | string(100) | Yes | "general" | Shift classification |
| `department_id` | integer | No | null | Department (FK) |
| `required_staff` | integer | Yes | 1 | Number of staff needed |
| `requirements` | jsonb | No | null | Additional requirements |
| `description` | string(500) | No | null | Shift description |
| `priority` | integer | Yes | 1 | Assignment priority (1-10) |
| `created_at` | timestamp | Yes | now() | Creation time |

#### Shift Types

```python
SHIFT_TYPES = [
    "general",      # Standard shift, no special requirements
    "management",   # Requires management qualification
    "specialized",  # Requires specific certification
    "emergency",    # On-call or emergency coverage
    "training"      # Training or orientation shift
]
```

#### Requirements JSON Structure

```json
{
  "qualifications": ["barista", "pos_system"],
  "minExperience": 6,
  "specialInstructions": "Handle morning rush preparation"
}
```

#### Constraints

```sql
-- Start time before end time
CHECK (start_time < end_time)

-- Positive required staff
CHECK (required_staff > 0)

-- Priority range
CHECK (priority BETWEEN 1 AND 10)

-- Valid shift type
CHECK (shift_type IN ('general', 'management', 'specialized', 'emergency', 'training'))
```

#### Indexes

```sql
CREATE INDEX ix_shifts_date_time ON shifts (date, start_time, end_time);
CREATE INDEX ix_shifts_type_priority ON shifts (shift_type, priority);
CREATE INDEX ix_shifts_requirements ON shifts USING gin (requirements);
CREATE INDEX ix_shifts_date_type ON shifts (date, shift_type);
```

#### Computed Properties

```python
@property
def duration_hours(self) -> float:
    """Calculate shift duration in hours"""
    # Handles shifts crossing midnight

@property
def is_overtime(self) -> bool:
    """True if shift exceeds 8 hours"""
    return self.duration_hours > 8.0
```

#### Methods

```python
def requires_qualification(self, qualification: str) -> bool:
    """Check if shift requires specific qualification"""

def get_assigned_count(self) -> int:
    """Get count of currently assigned employees"""

def is_fully_staffed(self) -> bool:
    """Check if shift has enough assigned staff"""

def needs_more_staff(self) -> int:
    """Return number of additional staff needed"""

def conflicts_with(self, other_shift: Shift) -> bool:
    """Check if this shift conflicts with another"""

def can_assign_employee(self, employee: Employee) -> tuple[bool, str]:
    """Check if employee can be assigned"""
```

#### Example JSON

```json
{
  "id": 15,
  "date": "2025-01-15",
  "startTime": "09:00:00",
  "endTime": "17:00:00",
  "shiftType": "general",
  "departmentId": 3,
  "requiredStaff": 3,
  "requirements": {
    "qualifications": ["barista", "pos_system"],
    "minExperience": 6
  },
  "description": "Morning rush hour coverage with inventory check",
  "priority": 7,
  "durationHours": 8.0,
  "isOvertime": false,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### Department

The `Department` model organizes employees and shifts hierarchically.

#### Purpose

- Organize employees by department
- Support hierarchical department structure
- Store department-specific settings
- Group shifts by department

#### Database Table: `departments`

#### Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | integer | Yes | Auto | Primary key |
| `name` | string(100) | Yes | - | Department name (unique) |
| `description` | text | No | null | Department description |
| `parent_id` | integer | No | null | Parent department (FK) |
| `settings` | jsonb | No | {} | Department settings |
| `active` | boolean | Yes | true | Active status |
| `created_at` | timestamp | Yes | now() | Creation time |
| `updated_at` | timestamp | Yes | now() | Last update |

#### Settings JSON Structure

```json
{
  "minStaffPerShift": 2,
  "maxWeeklyHours": 40,
  "overtimeMultiplier": 1.5,
  "specialRequirements": ["food_handlers_cert"]
}
```

#### Constraints

```sql
-- Unique department name
UNIQUE (name)

-- Self-referential foreign key for hierarchy
FOREIGN KEY (parent_id) REFERENCES departments(id)
```

#### Indexes

```sql
CREATE UNIQUE INDEX ix_departments_name ON departments (name);
CREATE INDEX ix_departments_parent ON departments (parent_id);
CREATE INDEX ix_departments_active ON departments (active);
```

#### Example JSON

```json
{
  "id": 3,
  "name": "Kitchen",
  "description": "Food preparation and cooking",
  "parentId": 1,
  "settings": {
    "minStaffPerShift": 2,
    "maxWeeklyHours": 40
  },
  "active": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-06-15T10:00:00Z"
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│  Department │
│   (parent)  │
└──────┬──────┘
       │
       │ parent_id
       ▼
┌─────────────┐        ┌──────────────┐
│ Department  │◄───────┤   Employee   │
│  (children) │1     n │              │
└─────────────┘        └──────┬───────┘
       │                      │
       │ department_id        │ created_by
       ▼                      ▼
┌─────────────┐        ┌──────────────┐
│    Shift    │        │   Schedule   │
└──────┬──────┘        └──────┬───────┘
       │                      │
       │                      │ parent_schedule_id
       │                      ▼
       │               ┌──────────────┐
       │               │   Schedule   │
       │               │  (revision)  │
       │               └──────────────┘
       │                      │
       │  shift_id            │ schedule_id
       │                      │
       └──────────┬───────────┘
                  │
                  ▼
          ┌───────────────────┐
          │ ScheduleAssignment│
          │   (join table)    │
          └───────────────────┘
                  │
                  │ employee_id
                  ▼
          ┌───────────────┐
          │   Employee    │
          └───────────────┘
```

### Relationship Details

#### Schedule → ScheduleAssignment

- **Type:** One-to-Many
- **Cascade:** Delete (assignments deleted when schedule deleted)
- **Description:** A schedule contains multiple assignments

```python
# Schedule model
assignments: Mapped[List["ScheduleAssignment"]] = relationship(
    "ScheduleAssignment",
    back_populates="schedule",
    cascade="all, delete-orphan"
)
```

#### Employee → ScheduleAssignment

- **Type:** One-to-Many
- **Cascade:** Delete
- **Description:** Employee has multiple assignments

```python
# Employee model
schedule_assignments: Mapped[List["ScheduleAssignment"]] = relationship(
    "ScheduleAssignment",
    back_populates="employee",
    cascade="all, delete-orphan"
)
```

#### Shift → ScheduleAssignment

- **Type:** One-to-Many
- **Cascade:** Delete
- **Description:** Shift can have multiple assignments (different schedules)

```python
# Shift model
schedule_assignments: Mapped[List["ScheduleAssignment"]] = relationship(
    "ScheduleAssignment",
    back_populates="shift",
    cascade="all, delete-orphan"
)
```

#### Department → Employee

- **Type:** One-to-Many
- **Cascade:** Set Null (employees kept but department_id nulled)
- **Description:** Department contains employees

```python
# Department model
employees: Mapped[List["Employee"]] = relationship(
    "Employee",
    back_populates="department"
)
```

#### Department → Shift

- **Type:** One-to-Many
- **Cascade:** Set Null
- **Description:** Shifts belong to departments

```python
# Department model
shifts: Mapped[List["Shift"]] = relationship(
    "Shift",
    back_populates="department"
)
```

#### Department → Department (Hierarchy)

- **Type:** Self-referential One-to-Many
- **Description:** Departments can have parent/child relationships

```python
# Department model
parent: Mapped[Optional["Department"]] = relationship(
    "Department",
    remote_side=[id],
    back_populates="children"
)
children: Mapped[List["Department"]] = relationship(
    "Department",
    back_populates="parent",
    cascade="all, delete-orphan"
)
```

---

## Data Model Diagrams

### Schedule Workflow State Machine

```
┌───────┐
│ draft │ (Initial state, editable)
└───┬───┘
    │
    │ submit_for_approval()
    ▼
┌───────────────────┐
│ pending_approval  │
└─────┬─────────────┘
      │
      ├─────────────┐
      │             │
      │ approve()   │ reject()
      ▼             ▼
┌──────────┐   ┌──────────┐
│ approved │   │ rejected │
└────┬─────┘   └─────┬────┘
     │                │
     │ publish()      │ revise()
     ▼                ▼
┌───────────┐   ┌───────┐
│ published │   │ draft │
└─────┬─────┘   └───────┘
      │
      │ archive()
      ▼
┌──────────┐
│ archived │
└──────────┘
```

### Assignment Lifecycle

```
┌──────────┐
│ assigned │ (Created by manager or AI)
└────┬─────┘
     │
     ├─────────────────┐
     │                 │
     │ confirm()       │ decline()
     ▼                 ▼
┌───────────┐     ┌──────────┐
│ confirmed │     │ declined │
└─────┬─────┘     └──────────┘
      │
      │ complete_shift()
      ▼
┌───────────┐
│ completed │
└───────────┘

(Manager can cancel at any time)
      │
      │ cancel()
      ▼
┌───────────┐
│ cancelled │
└───────────┘
```

---

## Field Constraints

### String Length Limits

| Model | Field | Max Length | Reason |
|-------|-------|------------|--------|
| Schedule | title | 255 | Single line title |
| Schedule | description | 1000 | Brief description |
| Schedule | notes | 2000 | Detailed notes |
| Employee | email | 255 | Standard email length |
| Employee | name | 255 | Full name |
| Shift | description | 500 | Shift instructions |
| Department | name | 100 | Department name |
| ScheduleAssignment | notes | 1000 | Assignment notes |

### Numeric Ranges

| Model | Field | Min | Max | Description |
|-------|-------|-----|-----|-------------|
| Schedule | version | 1 | ∞ | Must be positive |
| Shift | required_staff | 1 | ∞ | At least one staff |
| Shift | priority | 1 | 10 | Priority level |
| ScheduleAssignment | priority | 1 | 10 | Assignment priority |

### Date/Time Constraints

- `week_start` ≤ `week_end`
- `week_end - week_start` ≤ 7 days
- `start_time` < `end_time`
- Timestamps always UTC

---

## Computed Properties

Properties that are calculated dynamically rather than stored:

### Schedule Computed Properties

```python
# Editability check
@property
def is_editable(self) -> bool:
    return self.status in ["draft", "rejected"]

# Current week check
@property
def is_current_week(self) -> bool:
    today = date.today()
    return self.week_start <= today <= self.week_end

# Days until start
@property
def days_until_start(self) -> int:
    return (self.week_start - date.today()).days
```

### Shift Computed Properties

```python
# Calculate duration
@property
def duration_hours(self) -> float:
    start_datetime = datetime.combine(date.today(), self.start_time)
    end_datetime = datetime.combine(date.today(), self.end_time)

    # Handle midnight crossing
    if end_datetime < start_datetime:
        end_datetime += timedelta(days=1)

    return (end_datetime - start_datetime).total_seconds() / 3600

# Overtime check
@property
def is_overtime(self) -> bool:
    return self.duration_hours > 8.0
```

### ScheduleAssignment Computed Properties

```python
# Active assignment
@property
def is_active(self) -> bool:
    return self.status in ["assigned", "confirmed"]

# Confirmed status
@property
def is_confirmed(self) -> bool:
    return self.status == "confirmed"

# Needs confirmation
@property
def needs_confirmation(self) -> bool:
    return self.status in ["assigned", "pending"]
```

---

## Best Practices

### Creating Schedules

1. **Always create in draft status first**
2. **Validate date ranges** before creating
3. **Use versioning** for schedule revisions
4. **Check approval permissions** before status changes

### Managing Assignments

1. **Check conflicts** before creating assignments
2. **Validate employee availability** against shift times
3. **Verify qualifications** match shift requirements
4. **Use auto_assigned flag** for AI-generated assignments

### Department Hierarchy

1. **Avoid circular references** in parent-child relationships
2. **Check for dependencies** before deleting departments
3. **Cascade carefully** when restructuring hierarchy

### Performance Tips

1. **Use eager loading** (`selectinload`) for relationships
2. **Apply filters early** in queries to reduce result sets
3. **Index frequently queried fields**
4. **Use pagination** for large result sets

---

For API usage examples, see [API Reference](./API_REFERENCE.md).

For authentication details, see [Authentication Guide](./AUTHENTICATION.md).
