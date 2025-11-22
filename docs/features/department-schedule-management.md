# Department Assignment and Schedule Management

## Overview

This document describes the department assignment and departmental schedule management features for the AI Schedule Manager application.

## Features

### 1. Department Assignment Management

#### 1.1 Bulk Employee Assignment
- Assign multiple employees to a department in a single operation
- Validate department capacity and constraints
- Automatic audit trail creation
- Rollback capability on errors

#### 1.2 Employee Transfer Between Departments
- Transfer employees from one department to another
- Optional approval workflow for transfers
- Transfer reason tracking
- Historical record of all transfers

#### 1.3 Assignment Audit Trail
- Complete history of all department assignments
- Track who made changes and when
- Reason/justification for changes
- Ability to filter and search assignment history

### 2. Department Schedule Management

#### 2.1 Department-Specific Schedules
- Create schedules that belong to a specific department
- View all schedules for a department
- Department-level schedule templates
- Automatic employee filtering by department

#### 2.2 Consolidated Department Schedule View
- Single view showing all employee schedules in a department
- Department schedule calendar with all shifts
- Coverage analysis (understaffed/overstaffed periods)
- Shift conflict detection

#### 2.3 Department Schedule Templates
- Save common schedule patterns as templates
- Apply templates to create new schedules quickly
- Support for rotating shifts
- Weekly/bi-weekly patterns

#### 2.4 Department Schedule Analytics
- Coverage metrics (% of shifts filled)
- Overtime tracking by department
- Labor cost analysis
- Staffing gap identification

## Database Schema

### New Tables

#### `department_schedules`
Links schedules to specific departments for better organization.

```sql
CREATE TABLE department_schedules (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    UNIQUE(department_id, schedule_id)
);

CREATE INDEX idx_dept_schedules_dept ON department_schedules(department_id);
CREATE INDEX idx_dept_schedules_schedule ON department_schedules(schedule_id);
```

#### `department_schedule_templates`
Store reusable schedule patterns for departments.

```sql
CREATE TABLE department_schedule_templates (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    pattern_type VARCHAR(50), -- 'weekly', 'rotating', 'custom'
    rotation_days INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dept_templates_dept ON department_schedule_templates(department_id);
```

### Schema Enhancements

#### Add `department_id` to `schedules` table (if not exists)
```sql
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_schedules_department
ON schedules(department_id);
```

## API Endpoints

### Department Assignment

#### `POST /api/departments/{department_id}/employees/bulk-assign`
Bulk assign employees to a department.

**Request Body:**
```json
{
  "employee_ids": [1, 2, 3, 4, 5],
  "reason": "Team reorganization",
  "effective_date": "2025-12-01"
}
```

**Response:**
```json
{
  "success": true,
  "assigned_count": 5,
  "assignments": [
    {
      "employee_id": 1,
      "employee_name": "John Doe",
      "previous_department_id": null,
      "new_department_id": 10,
      "assigned_at": "2025-11-21T10:30:00Z"
    }
  ]
}
```

#### `POST /api/departments/{department_id}/employees/{employee_id}/transfer`
Transfer employee to different department.

**Request Body:**
```json
{
  "to_department_id": 15,
  "reason": "Skills better suited for new department",
  "requires_approval": false
}
```

### Department Schedules

#### `GET /api/departments/{department_id}/schedules`
Get all schedules for a department.

**Query Parameters:**
- `page` - Page number
- `size` - Items per page
- `start_date` - Filter by start date
- `end_date` - Filter by end date
- `status` - Filter by schedule status

**Response:**
```json
{
  "items": [
    {
      "id": 123,
      "name": "Sales Department - Week 48",
      "department_id": 10,
      "department_name": "Sales",
      "start_date": "2025-11-25",
      "end_date": "2025-12-01",
      "employee_count": 15,
      "shift_count": 75,
      "status": "published"
    }
  ],
  "total": 45,
  "page": 1,
  "size": 10
}
```

#### `POST /api/departments/{department_id}/schedules`
Create schedule for department.

**Request Body:**
```json
{
  "name": "Sales Floor - Holiday Week",
  "start_date": "2025-12-23",
  "end_date": "2025-12-29",
  "template_id": 5,
  "notes": "Extra coverage for holiday shopping"
}
```

#### `GET /api/departments/{department_id}/schedule-overview`
Get consolidated schedule view for department.

**Query Parameters:**
- `start_date` - Start of date range
- `end_date` - End of date range
- `include_metrics` - Include coverage analytics

**Response:**
```json
{
  "department_id": 10,
  "department_name": "Sales",
  "date_range": {
    "start": "2025-11-25",
    "end": "2025-12-01"
  },
  "employees": [
    {
      "id": 25,
      "name": "Jane Smith",
      "shifts": [
        {
          "date": "2025-11-25",
          "start_time": "09:00",
          "end_time": "17:00",
          "shift_type": "regular"
        }
      ]
    }
  ],
  "metrics": {
    "total_hours": 320,
    "coverage_percentage": 95,
    "understaffed_periods": [
      {
        "date": "2025-11-28",
        "time": "14:00-16:00",
        "required": 5,
        "scheduled": 3
      }
    ]
  }
}
```

#### `GET /api/departments/{department_id}/templates`
Get schedule templates for department.

#### `POST /api/departments/{department_id}/templates`
Create schedule template.

#### `POST /api/departments/{department_id}/templates/{template_id}/apply`
Apply template to create new schedule.

## Frontend Components

### `DepartmentScheduleManager`
Main component for managing department schedules.

**Features:**
- List all department schedules
- Create new schedules
- Edit existing schedules
- Apply templates
- View schedule details

### `DepartmentEmployeeAssignment`
Interface for assigning employees to departments.

**Features:**
- Drag-and-drop employee assignment
- Bulk selection and assignment
- Transfer between departments
- View assignment history

### `DepartmentScheduleCalendar`
Calendar view showing all department employee schedules.

**Features:**
- Month/week/day views
- Color-coded by shift type
- Highlight conflicts/gaps
- Quick shift editing
- Coverage indicators

### `DepartmentScheduleAnalytics`
Dashboard showing department schedule metrics.

**Features:**
- Coverage charts
- Overtime tracking
- Labor cost breakdown
- Staffing recommendations
- Trend analysis

## Business Rules

### Assignment Rules
1. Employees can only be assigned to one department at a time
2. Assignment changes require a reason if employee has existing assignments
3. Historical assignment records must never be deleted (soft delete only)
4. Department capacity limits must be respected (if configured)

### Schedule Rules
1. Department schedules can only include employees from that department
2. Schedule conflicts must be detected across all department schedules
3. Published schedules cannot be deleted (only archived)
4. Schedule templates must be validated before application

### Permission Rules
1. Managers can only assign employees to their own departments
2. Admins can assign employees to any department
3. Schedule creation requires manager or admin role
4. Template management requires admin role

## Implementation Phases

### Phase 1: Database & Backend (Current)
1. Create database migrations
2. Implement models
3. Create API endpoints
4. Write backend tests

### Phase 2: Frontend Components
1. Build core UI components
2. Integrate with backend APIs
3. Add validation and error handling
4. Write component tests

### Phase 3: Analytics & Templates
1. Implement analytics calculations
2. Create template system
3. Add reporting features
4. Write E2E tests

### Phase 4: Polish & Documentation
1. UI/UX refinements
2. Performance optimization
3. Complete documentation
4. User guides

## Success Metrics

- All employees can be assigned to departments via UI
- Department schedules can be created in under 2 minutes using templates
- Schedule conflicts are detected with 100% accuracy
- Coverage analytics load in under 1 second
- 90% code coverage for new features
