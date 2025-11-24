# Critical Fixes Roadmap - Schedule Model Services

## Overview
This document outlines the critical fixes needed to restore import, export, and AI generation functionality that are essential for the initial product offering.

---

## 🔴 CRITICAL PRIORITY (Must Fix Immediately)

### 1. Export Service - Schedule Export (2-3 hours)
**File**: `backend/src/services/export_service.py`
**Lines**: 96-102, 368

**Issues**:
- Queries `Schedule.date` (doesn't exist)
- Queries `Schedule.employee_id` (doesn't exist)
- Invalid joins with Employee and Shift

**Fix Strategy**:
```python
# WRONG (current)
query = select(Schedule).join(Employee).join(Shift).where(Schedule.date.between(...))

# CORRECT (needed)
query = (
    select(ScheduleAssignment)
    .join(Schedule)
    .join(Employee)
    .join(Shift)
    .where(Shift.date.between(date_from, date_to))
    .options(selectinload(...))
)
```

**Tasks**:
- [ ] Rewrite `export_schedules()` to query ScheduleAssignment
- [ ] Fix CSV export format
- [ ] Fix Excel export format
- [ ] Fix PDF export format
- [ ] Fix iCal export format
- [ ] Add proper date filtering via Shift.date
- [ ] Add proper employee filtering via ScheduleAssignment.employee_id
- [ ] Test each export format with sample data

**API Endpoint**: `GET /api/data/export/schedules`

---

### 2. Import Service - Schedule Import (2-3 hours)
**File**: `backend/src/services/import_service.py`
**Lines**: 300, 442

**Issues**:
- Tries to create Schedule with employee_id, shift_id, date
- Should create ScheduleAssignment instead

**Fix Strategy**:
```python
# WRONG (current)
new_schedule = Schedule(
    employee_id=employee.id,
    shift_id=shift.id,
    date=schedule_date
)

# CORRECT (needed)
# 1. Find or create Schedule for the week
schedule = await get_or_create_schedule_for_week(schedule_date)

# 2. Create ScheduleAssignment linking schedule, employee, shift
assignment = ScheduleAssignment(
    schedule_id=schedule.id,
    employee_id=employee.id,
    shift_id=shift.id,
    status="assigned"
)
```

**Tasks**:
- [ ] Rewrite CSV import logic
- [ ] Rewrite Excel import logic
- [ ] Add `get_or_create_schedule_for_week()` helper
- [ ] Create ScheduleAssignment instead of Schedule
- [ ] Add validation for duplicate assignments
- [ ] Add validation for shift conflicts
- [ ] Add transaction rollback on errors
- [ ] Test import with sample CSV
- [ ] Test import with sample Excel

**API Endpoint**: `POST /api/data/import/schedules`

---

### 3. Schedule Service - AI Generation (3-4 hours)
**File**: `backend/src/services/schedule_service.py`
**Lines**: 143, 306

**Issues**:
- Queries Schedule by date (should use week range)
- Creates Schedule with employee_id, shift_id (should create ScheduleAssignment)

**Fix Strategy**:
```python
# Generate schedule for a week
def generate_schedule(week_start, week_end):
    # 1. Create Schedule container
    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="draft",
        created_by=user_id
    )

    # 2. Get all shifts in date range
    shifts = get_shifts_in_range(week_start, week_end)

    # 3. For each shift, assign employees
    for shift in shifts:
        employee = find_best_employee(shift)
        assignment = ScheduleAssignment(
            schedule_id=schedule.id,
            employee_id=employee.id,
            shift_id=shift.id,
            auto_assigned=True
        )
```

**Tasks**:
- [ ] Rewrite schedule generation algorithm
- [ ] Fix date range queries (use week_start/week_end)
- [ ] Create ScheduleAssignment for each assignment
- [ ] Implement conflict detection properly
- [ ] Implement employee availability checking
- [ ] Implement qualification matching
- [ ] Add optimization algorithm for best assignments
- [ ] Test generation with sample data
- [ ] Test with edge cases (insufficient staff, conflicts)

**API Endpoint**: `POST /api/schedules/generate`

---

## 🟡 HIGH PRIORITY (Fix Soon)

### 4. CRUD Service - Helper Methods (1 hour)
**File**: `backend/src/services/crud.py`
**Lines**: 183-191, 443

**Tasks**:
- [ ] Fix `get_schedule(employee_id)` - query via ScheduleAssignment
- [ ] Fix `count_schedule_usage(shift_id)` - query via ScheduleAssignment
- [ ] Add `get_assignments_for_employee()` helper
- [ ] Add `get_assignments_for_shift()` helper

---

### 5. Integration Service - Calendar Sync (2 hours)
**File**: `backend/src/services/integration_service.py`
**Lines**: 194-199, 303-307, 468

**Tasks**:
- [ ] Fix calendar sync queries
- [ ] Query shifts via ScheduleAssignment
- [ ] Fix iCal event generation
- [ ] Test Google Calendar integration
- [ ] Test Outlook integration

---

## 🟢 MEDIUM PRIORITY (Nice to Have)

### 6. Testing & Documentation (2-3 hours)

**Tasks**:
- [ ] Create unit tests for export_service
- [ ] Create unit tests for import_service
- [ ] Create unit tests for schedule_service
- [ ] Create integration tests for export API
- [ ] Create integration tests for import API
- [ ] Create integration tests for generation API
- [ ] Update API documentation
- [ ] Create user guide for import/export

---

## 📊 Estimated Timeline

### Week 1: Critical Fixes
- **Day 1-2**: Export Service (2-3 hours)
- **Day 2-3**: Import Service (2-3 hours)
- **Day 3-4**: Schedule Service AI Generation (3-4 hours)
- **Day 5**: Testing & Bug Fixes (2 hours)

**Total**: 10-13 hours

### Week 2: High Priority
- **Day 1**: CRUD Service fixes (1 hour)
- **Day 2**: Integration Service (2 hours)
- **Day 3-5**: Testing & Documentation (2-3 hours)

**Total**: 5-6 hours

### Overall: 15-19 hours of development time

---

## 🎯 Success Criteria

### Export Functionality ✅
- [ ] Can export schedules to CSV
- [ ] Can export schedules to Excel
- [ ] Can export schedules to PDF
- [ ] Can export schedules to iCal
- [ ] Exports include all assignments, employees, shifts
- [ ] Date filtering works correctly
- [ ] Employee filtering works correctly

### Import Functionality ✅
- [ ] Can import schedules from CSV
- [ ] Can import schedules from Excel
- [ ] Validation catches duplicate assignments
- [ ] Validation catches shift conflicts
- [ ] Rollback works on errors
- [ ] Progress tracking works
- [ ] Error messages are clear

### AI Generation ✅
- [ ] Can generate schedule for a week
- [ ] Respects employee availability
- [ ] Respects employee qualifications
- [ ] Detects and prevents conflicts
- [ ] Optimizes for coverage and fairness
- [ ] Can apply schedule templates
- [ ] Can regenerate with constraints

---

## 🛠️ Development Approach

### Step 1: Fix One Service at a Time
1. Export Service first (most visible to users)
2. Import Service second (data entry)
3. AI Generation third (automation)

### Step 2: Test Incrementally
- Write tests alongside fixes
- Test each format/method individually
- Use real sample data

### Step 3: Commit Frequently
- Commit after each service fix
- Include tests in commits
- Update documentation

---

## 📝 Code Review Checklist

Before marking each fix as complete:

### For Each Service Fix
- [ ] No references to `Schedule.employee_id`
- [ ] No references to `Schedule.shift_id`
- [ ] No references to `Schedule.date`
- [ ] Uses `Schedule.week_start` and `Schedule.week_end`
- [ ] Uses `ScheduleAssignment` for linking
- [ ] Proper eager loading with `selectinload()`
- [ ] Error handling and rollback
- [ ] Logging for debugging
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] API endpoint tested manually

---

## 🚀 Quick Start Guide

### To Begin Fixing Export Service:
```bash
# 1. Read the current implementation
cat backend/src/services/export_service.py

# 2. Check the actual usage
grep -r "export_schedules" backend/src/api/

# 3. Run existing tests (if any)
pytest backend/tests/test_export_service.py -v

# 4. Start fixing line by line
```

### To Begin Fixing Import Service:
```bash
# 1. Read the current implementation
cat backend/src/services/import_service.py

# 2. Create sample import files
# CSV format: schedule_id, employee_id, shift_id, date, status
# Excel format: Similar structure

# 3. Test current behavior (will fail)
curl -X POST http://localhost:8000/api/data/import/schedules \
  -F "file=@sample_schedule.csv"
```

### To Begin Fixing Schedule Service:
```bash
# 1. Read the AI generation logic
cat backend/src/services/schedule_service.py

# 2. Understand the algorithm
# - Fetches shifts for date range
# - Matches employees to shifts
# - Creates assignments

# 3. Identify all Schedule model usage
grep -n "Schedule\." backend/src/services/schedule_service.py
```

---

## 📌 Important Notes

1. **Do NOT delete old code immediately** - Comment it out first for reference
2. **Keep backward compatibility** where possible
3. **Add extensive logging** for debugging
4. **Test with edge cases**: empty data, conflicts, invalid inputs
5. **Document breaking changes** in commit messages

---

## 🔗 Related Documents

- `SCHEDULE_MODEL_ISSUES.md` - Technical debt documentation
- `backend/src/models/schedule.py` - Schedule model definition
- `backend/src/models/schedule_assignment.py` - ScheduleAssignment model
- `backend/src/models/shift.py` - Shift model definition

---

## ✅ Completion Checklist

Mark items as complete when:
- [ ] Export Service fully functional
- [ ] Import Service fully functional
- [ ] AI Generation fully functional
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No Schedule model misuse in codebase
- [ ] Application ready for initial offering
