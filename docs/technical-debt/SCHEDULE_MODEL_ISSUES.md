# Schedule Model Issues - Technical Debt

## Problem Summary

Multiple service files incorrectly treat the `Schedule` model as if it directly contains employee/shift assignments and dates. This is a fundamental misunderstanding of the data model.

## Actual Data Model

```
Schedule (Weekly schedule container)
├── id
├── week_start (date)
├── week_end (date)
├── status
├── created_by
└── assignments: List[ScheduleAssignment]

ScheduleAssignment (Links employees to shifts within a schedule)
├── id
├── schedule_id (FK -> schedules.id)
├── employee_id (FK -> employees.id)
├── shift_id (FK -> shifts.id)
├── status
└── assigned_at

Shift (Individual shift definition)
├── id
├── date (when the shift occurs)
├── start_time
├── end_time
├── shift_type
└── department_id
```

## Incorrect Assumptions in Code

The following files incorrectly assume `Schedule` has:
- `employee_id` field (doesn't exist)
- `shift_id` field (doesn't exist)
- `date` field (doesn't exist - use `week_start`/`week_end`)

## Affected Files

### 1. **backend/src/services/crud.py**
**Lines**: 183-191, 443
**Issues**:
- `Schedule.employee_id` - doesn't exist
- `Schedule.shift_id` - doesn't exist
- `Schedule.date` - doesn't exist
- `Schedule.shift` - relationship doesn't exist

**Methods Affected**:
- `get_schedule(employee_id, date_from, date_to)` - Lines 181-193
- `count_schedule_usage(shift_id)` - Lines 441-444

**Impact**: Medium - Used by shifts API endpoint

---

### 2. **backend/src/services/import_service.py**
**Lines**: 300, 442
**Issues**:
- Trying to query `Schedule` by `employee_id`, `shift_id`, `date`
- All three fields don't exist on Schedule model

**Methods Affected**:
- CSV import logic
- Excel import logic

**Impact**: High - Import functionality completely broken

---

### 3. **backend/src/services/export_service.py**
**Lines**: 96-102, 368
**Issues**:
- `Schedule.date` filtering
- `Schedule.employee_id` filtering
- Joins `Schedule` with `Employee` and `Shift` (invalid relationships)

**Methods Affected**:
- `export_schedules()` - primary export method
- iCal generation

**Impact**: High - Export functionality completely broken

---

### 4. **backend/src/services/schedule_service.py**
**Lines**: 143, 306
**Issues**:
- `Schedule.date` filtering
- `Schedule.employee_id` and `Schedule.shift_id` queries

**Methods Affected**:
- Schedule generation logic
- Template application

**Impact**: Critical - Schedule generation/AI features broken

---

### 5. **backend/src/services/integration_service.py**
**Lines**: 194-199, 303-307, 468
**Issues**:
- `Schedule.employee_id` queries
- `Schedule.date` filtering
- Invalid joins with Employee and Shift

**Methods Affected**:
- Calendar sync
- External system integrations
- Time tracking

**Impact**: High - All integration features broken

---

## Correct Implementation Patterns

### ❌ WRONG - Direct Schedule Queries
```python
# This is WRONG - Schedule doesn't have employee_id or date
query = select(Schedule).where(
    Schedule.employee_id == employee_id,
    Schedule.date == target_date
)
```

### ✅ CORRECT - Query via ScheduleAssignment
```python
# Query schedules that have assignments for specific employee
query = (
    select(Schedule)
    .join(ScheduleAssignment)
    .where(ScheduleAssignment.employee_id == employee_id)
    .where(Schedule.week_start <= target_date)
    .where(Schedule.week_end >= target_date)
)

# Or with eager loading
query = (
    select(Schedule)
    .options(
        selectinload(Schedule.assignments)
        .selectinload(ScheduleAssignment.employee)
    )
    .options(
        selectinload(Schedule.assignments)
        .selectinload(ScheduleAssignment.shift)
    )
)
```

### ✅ CORRECT - Query Shifts Directly
```python
# If you need shift dates, query Shift model directly
query = (
    select(Shift)
    .join(ScheduleAssignment)
    .join(Schedule)
    .where(Shift.date.between(start_date, end_date))
    .where(ScheduleAssignment.employee_id == employee_id)
)
```

---

## Fix Priority

### Immediate (Blocks Core Features)
1. ✅ **API Routes** - FIXED
   - Created proper `/api/schedules` and `/api/employees` endpoints
   - Using correct model relationships

### High Priority (Blocks Important Features)
2. **export_service.py** - Export functionality
3. **import_service.py** - Import functionality
4. **schedule_service.py** - Schedule generation/AI

### Medium Priority (Advanced Features)
5. **crud.py** - Some helper methods
6. **integration_service.py** - External integrations

---

## Recommended Fix Strategy

### Option 1: Fix Services (Complex)
- Rewrite all service methods to use correct model
- Update all queries to go through ScheduleAssignment
- High risk of introducing new bugs
- Time: 4-6 hours

### Option 2: Deprecate Broken Services (Pragmatic)
- Mark broken services as deprecated
- Build new services with correct model understanding
- Gradually migrate functionality
- Time: 1-2 hours per service

### Option 3: Remove Unused Code (Fastest)
- If services aren't actively used, remove them
- Reduce technical debt
- Add new services when features are needed
- Time: 30 minutes

---

## Current Status

### ✅ Working Features
- User authentication and registration
- Login/logout
- Basic schedule CRUD via `/api/schedules`
- Basic employee CRUD via `/api/employees`
- Frontend schedule display

### ❌ Broken Features
- Schedule import (CSV/Excel)
- Schedule export (CSV/Excel/PDF/iCal)
- AI schedule generation
- Calendar integrations
- Time tracking integrations

---

## Next Steps

1. **Immediate**: Application is functional for basic use
2. **Short-term**: Fix export_service.py for schedule exports
3. **Medium-term**: Fix import_service.py for data imports
4. **Long-term**: Rewrite schedule_service.py for AI features

---

## Notes for Future Development

When working with schedules, always remember:
- **Schedule** = Weekly container (week_start to week_end)
- **ScheduleAssignment** = Links (schedule_id, employee_id, shift_id)
- **Shift** = Individual work period (date, start_time, end_time)

Never query Schedule directly for employee/shift/date info. Always go through ScheduleAssignment and/or Shift.
