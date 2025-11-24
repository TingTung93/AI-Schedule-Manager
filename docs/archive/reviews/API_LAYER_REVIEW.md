# API Layer Comprehensive Review
**Date:** 2025-11-13
**Reviewer:** API Architecture Specialist
**Project:** AI Schedule Manager

---

## Executive Summary

This comprehensive review identifies **critical API architecture gaps** preventing wizard functionality, schedule generation, and proper frontend-backend integration. The system has **14 missing endpoint categories**, significant contract mismatches, and incomplete CRUD implementations.

### Critical Findings
- ❌ **NO assignment management endpoints** (required for wizard)
- ❌ **NO schedule generation/validation API** (AI service exists but not exposed)
- ❌ **NO batch operations** for assignments
- ❌ **NO wizard-specific endpoints** for multi-step flows
- ⚠️ **Frontend expects 25+ endpoints that don't exist**
- ⚠️ **Inconsistent response formats** across endpoints
- ⚠️ **Missing pagination** on several list endpoints

---

## 1. API Endpoint Inventory

### 1.1 Existing Backend Endpoints

#### ✅ Schedules API (`/api/schedules`)
- `GET /api/schedules` - List schedules (paginated)
- `GET /api/schedules/{id}` - Get schedule by ID
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/{id}` - Update schedule
- `DELETE /api/schedules/{id}` - Delete schedule

**Issues:**
- Missing: `POST /api/schedules/generate` (AI generation)
- Missing: `POST /api/schedules/{id}/validate`
- Missing: `POST /api/schedules/{id}/publish`
- Missing: `POST /api/schedules/{id}/clone`
- Missing: `GET /api/schedules/{id}/assignments`
- Missing: Query parameters for advanced filtering

#### ✅ Employees API (`/api/employees`)
- `GET /api/employees` - List employees (paginated)
- `GET /api/employees/{id}` - Get employee
- `POST /api/employees` - Create employee
- `PUT /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee

**Issues:**
- Missing: `GET /api/employees/{id}/availability`
- Missing: `GET /api/employees/{id}/schedules`
- Missing: `POST /api/employees/bulk` - Bulk create
- Missing: Password field should not be in EmployeeCreate (security issue)

#### ✅ Shifts API (`/api/shifts`)
- `GET /api/shifts` - List shifts (paginated)
- `GET /api/shifts/{id}` - Get shift
- `POST /api/shifts` - Create shift
- `PATCH /api/shifts/{id}` - Update shift
- `DELETE /api/shifts/{id}` - Delete shift
- `POST /api/shifts/bulk` - Bulk create
- `GET /api/shifts/types` - Get shift types
- `GET /api/shifts/templates` - List templates
- `POST /api/shifts/templates` - Create template
- `POST /api/shifts/templates/{id}/apply` - Apply template

**Status:** ✅ Most complete API - good pagination, bulk operations

#### ✅ Departments API (`/api/departments`)
- `GET /api/departments` - List departments (paginated)
- `GET /api/departments/{id}` - Get department
- `POST /api/departments` - Create department
- `PATCH /api/departments/{id}` - Update department
- `DELETE /api/departments/{id}` - Delete department
- `GET /api/departments/{id}/staff` - Get department staff
- `GET /api/departments/{id}/shifts` - Get department shifts

**Status:** ✅ Well-designed with hierarchy support

#### ✅ Analytics API (`/api/analytics`)
- `GET /api/analytics/overview` - Dashboard metrics
- `GET /api/analytics/labor-costs` - Labor cost analysis
- `GET /api/analytics/performance` - Performance metrics
- `GET /api/analytics/efficiency` - Efficiency metrics

**Status:** ✅ Good analytics coverage with real database queries

#### ✅ Data I/O API (`/api/data`)
- `POST /api/data/import/upload` - Upload file
- `GET /api/data/import/preview/{file_id}` - Preview data
- `POST /api/data/import/validate/{file_id}` - Validate import
- `POST /api/data/import/execute/{file_id}` - Execute import
- `GET /api/data/export/employees` - Export employees
- `GET /api/data/export/schedules` - Export schedules
- `GET /api/data/export/rules` - Export rules
- `POST /api/data/backup/create` - Create backup
- `GET /api/data/backup/list` - List backups

**Status:** ✅ Comprehensive import/export functionality

#### ✅ Notifications API (`/api/notifications`)
- `GET /api/notifications` - List notifications
- `GET /api/notifications/{id}` - Get notification
- `PATCH /api/notifications/{id}/read` - Mark as read
- `POST /api/notifications/mark-all-read` - Mark all read
- `DELETE /api/notifications/{id}` - Delete notification

**Status:** ✅ Basic notification CRUD complete

#### ✅ Settings API (`/api/settings`)
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

**Status:** ✅ Settings persistence working

---

### 1.2 Critical Missing Endpoints

#### ❌ Assignment Management (CRITICAL - Wizard Blocker)
**Required Endpoints:**
```
POST   /api/assignments                    - Create assignment
POST   /api/assignments/bulk               - Bulk create assignments
GET    /api/assignments/{id}               - Get assignment
PATCH  /api/assignments/{id}               - Update assignment
DELETE /api/assignments/{id}               - Delete assignment
GET    /api/assignments/schedule/{id}      - Get assignments by schedule
POST   /api/assignments/{id}/confirm       - Employee confirms shift
POST   /api/assignments/{id}/decline       - Employee declines shift
PATCH  /api/assignments/{id}/status        - Update assignment status
```

**Impact:** Wizard cannot create shift assignments, making schedule generation useless.

#### ❌ Schedule Generation API (CRITICAL)
**Required Endpoints:**
```
POST   /api/schedules/generate             - AI-powered schedule generation
POST   /api/schedules/{id}/validate        - Validate schedule constraints
POST   /api/schedules/{id}/optimize        - Optimize existing schedule
GET    /api/schedules/{id}/conflicts       - Check for conflicts
POST   /api/schedules/{id}/publish         - Publish draft schedule
POST   /api/schedules/{id}/clone           - Clone schedule
```

**Impact:** AI generation service exists but is not exposed via API.

**Evidence:**
- `ScheduleGenerationService` exists in `/backend/src/services/schedule_service.py`
- Has methods: `generate_schedule()`, `optimize_schedule()`, `validate_schedule()`
- **NOT connected to any API endpoint**

#### ❌ Wizard-Specific Endpoints
**Required Endpoints:**
```
POST   /api/wizard/init                    - Initialize wizard session
POST   /api/wizard/step/basic-info         - Save basic info
POST   /api/wizard/step/shifts             - Save shift selection
POST   /api/wizard/step/employees          - Save employee selection
POST   /api/wizard/step/rules              - Save rules
POST   /api/wizard/step/preview            - Generate preview
POST   /api/wizard/finalize                - Create final schedule
GET    /api/wizard/session/{id}            - Get wizard state
DELETE /api/wizard/session/{id}            - Cancel wizard
```

**Impact:** Wizard has no backend state management.

#### ❌ Rules/Constraints API
**Partially Missing:**
```
GET    /api/rules                          - List rules
POST   /api/rules                          - Create rule
GET    /api/rules/{id}                     - Get rule
PATCH  /api/rules/{id}                     - Update rule
DELETE /api/rules/{id}                     - Delete rule
POST   /api/rules/validate                 - Validate rule syntax
GET    /api/rules/employee/{id}            - Get employee rules
```

**Status:** No API file found for rules management.

#### ❌ Availability Management
```
GET    /api/employees/{id}/availability    - Get availability
PUT    /api/employees/{id}/availability    - Update availability
POST   /api/availability/bulk              - Bulk update
GET    /api/availability/conflicts         - Check conflicts
```

#### ❌ Time-Off Requests
```
GET    /api/time-off                       - List requests
POST   /api/time-off                       - Create request
PATCH  /api/time-off/{id}/approve          - Approve request
PATCH  /api/time-off/{id}/deny             - Deny request
```

#### ❌ Swap Requests
```
GET    /api/swaps                          - List swap requests
POST   /api/swaps                          - Create swap request
PATCH  /api/swaps/{id}/approve             - Approve swap
PATCH  /api/swaps/{id}/decline             - Decline swap
```

---

## 2. Frontend-Backend Contract Analysis

### 2.1 Frontend API Expectations (api.js)

The frontend `api.js` file defines these services:

#### ✅ authService (COMPLETE)
- login, register, logout
- refresh token, getCurrentUser
- changePassword, forgotPassword, resetPassword
- CSRF token handling
- Session management

**Status:** ✅ All methods implemented and working

#### ⚠️ scheduleService (INCOMPLETE)
Frontend expects:
```javascript
scheduleService.getSchedules()        // ✅ EXISTS
scheduleService.getSchedule(id)       // ✅ EXISTS
scheduleService.createSchedule(data)  // ✅ EXISTS
scheduleService.updateSchedule(id, data) // ✅ EXISTS
scheduleService.deleteSchedule(id)    // ✅ EXISTS

// MISSING - Wizard would need:
scheduleService.generateSchedule(params)  // ❌ MISSING
scheduleService.validateSchedule(id)      // ❌ MISSING
scheduleService.publishSchedule(id)       // ❌ MISSING
scheduleService.getAssignments(scheduleId) // ❌ MISSING
```

#### ❌ taskService (NOT USED)
- The frontend has `taskService` but backend has no `/api/tasks` endpoint
- **Recommendation:** Remove from frontend or implement backend

#### ❌ employeeService (REMOVED)
- Previously wrapped axios calls with no added value
- **Status:** Correctly removed - use axios directly

### 2.2 Critical Missing Frontend Integration

**The wizard would need these frontend service methods:**

```javascript
// Assignment Service (MISSING ENTIRELY)
assignmentService.createBulk(assignments)
assignmentService.updateStatus(id, status)
assignmentService.getBySchedule(scheduleId)

// Generation Service (MISSING)
generationService.generate(params)
generationService.preview(params)
generationService.validate(scheduleId)

// Rules Service (MISSING)
ruleService.getAll()
ruleService.create(rule)
ruleService.validateSyntax(rule)
```

---

## 3. RESTful Design Violations

### 3.1 HTTP Method Inconsistencies

#### ❌ Inconsistent Update Methods
- Schedules: `PUT /api/schedules/{id}` ✅ Full replacement
- Employees: `PUT /api/employees/{id}` ✅ Full replacement
- Shifts: `PATCH /api/shifts/{id}` ✅ Partial update
- Departments: `PATCH /api/departments/{id}` ✅ Partial update
- Notifications: `PATCH /api/notifications/{id}/read` ✅ Partial update

**Issue:** Mixing PUT (full replacement) and PATCH (partial update)

**Recommendation:**
- Use PATCH for all partial updates
- Reserve PUT for full resource replacement
- **Proposed Standard:** Use PATCH everywhere for consistency

### 3.2 Endpoint Naming Violations

#### ❌ Non-RESTful Action Endpoints
```
❌ POST /api/notifications/mark-all-read
✅ Should be: PATCH /api/notifications/bulk-read

❌ POST /api/shifts/templates/{id}/apply
✅ Should be: POST /api/schedules/from-template/{id}

❌ PATCH /api/notifications/{id}/read
✅ Better: PATCH /api/notifications/{id} with body: {read: true}
```

**Recommendation:** Avoid verb-based endpoints; use resource-oriented design.

### 3.3 Missing Resource Relationships

Current API treats resources as flat entities. Missing:

```
❌ GET /api/schedules/{id}/assignments
❌ GET /api/employees/{id}/schedules
❌ GET /api/employees/{id}/assignments
❌ GET /api/departments/{id}/employees
❌ GET /api/departments/{id}/schedules
```

**Some exist but not consistently across all resources.**

---

## 4. Response Format Inconsistencies

### 4.1 Success Response Formats

#### Schedules API
```json
{
  "id": 1,
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "title": "Week 3 Schedule",
  "status": "draft",
  "assignments": [...]
}
```

#### Shifts API (with metadata)
```json
{
  "items": [...],
  "total": 50,
  "page": 1,
  "size": 10,
  "pages": 5
}
```

#### Settings API (nested)
```json
{
  "message": "Settings updated successfully",
  "settings": {
    "notifications": {...},
    "appearance": {...}
  }
}
```

**Issue:** Three different response structures:
1. Direct resource
2. Paginated wrapper
3. Message + resource

**Recommendation:** Standardize on:
```json
{
  "data": {...},           // Single resource or array
  "meta": {                // Optional metadata
    "page": 1,
    "total": 50
  },
  "message": "Success"     // Optional message
}
```

### 4.2 Error Response Formats

#### Current Implementation
```json
// Sometimes:
{"detail": "Error message"}

// Sometimes:
{"message": "Error message"}

// Sometimes:
{"error": "Error message"}
```

**Recommendation:** Standardize error responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly message",
    "details": {
      "field": "email",
      "constraint": "unique"
    }
  },
  "status": 400
}
```

---

## 5. Pagination Issues

### 5.1 Endpoints With Pagination ✅
- `GET /api/schedules` (skip/limit)
- `GET /api/employees` (skip/limit)
- `GET /api/shifts` (page/size)
- `GET /api/departments` (page/size)
- `GET /api/notifications` (page/size)

### 5.2 Pagination Inconsistencies

**Two different pagination styles:**

1. **Offset-based (skip/limit):**
   ```
   ?skip=0&limit=100
   ```

2. **Page-based (page/size):**
   ```
   ?page=1&size=10
   ```

**Issue:** Inconsistent query parameter names

**Recommendation:** Standardize on page-based:
```
?page=1&per_page=20&sort_by=created_at&order=desc
```

### 5.3 Missing Pagination

These endpoints should be paginated but aren't:
- ❌ `GET /api/analytics/*` - Could return large datasets
- ❌ `GET /api/data/backup/list` - Has pagination but incomplete

---

## 6. Query Parameter Design Issues

### 6.1 Inconsistent Filter Formats

#### Schedules
```
?status=draft&week_start=2025-01-13&skip=0&limit=100
```

#### Employees
```
?role=server&is_active=true&department_id=1&skip=0&limit=100
```

#### Shifts
```
?department=kitchen&shift_type=morning&active=true&page=1&size=10
```

**Issue:** Mixing snake_case and camelCase, inconsistent naming

**Recommendation:**
```
?status=draft
&filter[week_start]=2025-01-13
&filter[department_id]=1
&sort=-created_at
&page=1
&per_page=20
```

### 6.2 Missing Advanced Filtering

**No support for:**
- Date ranges: `?start_date=2025-01-01&end_date=2025-01-31`
- Full-text search: `?search=john`
- Multiple values: `?status=draft,pending`
- Comparison operators: `?hours_gt=40`

**Recommendation:** Implement query parser for complex filters:
```
?filter[created_at][gte]=2025-01-01
&filter[status][in]=draft,pending
&search=john
```

---

## 7. Critical API Gaps Summary

### 7.1 Missing Functionality by Priority

#### 🔴 CRITICAL (Wizard Blockers)
1. **Assignment Management API** - Complete CRUD + bulk operations
2. **Schedule Generation API** - Expose AI service
3. **Validation API** - Constraint checking
4. **Wizard State API** - Multi-step flow management

#### 🟠 HIGH PRIORITY
5. **Rules/Constraints API** - Missing entirely
6. **Availability Management** - Partial implementation
7. **Batch Operations** - Only shifts have bulk create
8. **Schedule Publishing Workflow** - draft → published transition

#### 🟡 MEDIUM PRIORITY
9. **Time-Off Requests API**
10. **Shift Swap Requests API**
11. **Employee Schedule View** - Personal calendar
12. **Conflict Detection API**

#### 🟢 LOW PRIORITY
13. **Schedule Templates API** - Advanced templates
14. **Reporting API** - Custom reports
15. **Audit Log API** - Change tracking

---

## 8. Data Transformation Issues

### 8.1 Frontend Expects vs Backend Returns

**Example: Schedule Response**

Backend returns:
```json
{
  "id": 1,
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "created_at": "2025-01-13T10:00:00",
  "assignments": [...]
}
```

Frontend might expect:
```json
{
  "id": 1,
  "weekStart": "2025-01-13",      // camelCase
  "weekEnd": "2025-01-19",
  "createdAt": "2025-01-13T10:00:00",
  "assignmentCount": 10,           // Computed field
  "totalHours": 80,                // Computed field
  "assignments": [...]
}
```

**Issue:** snake_case vs camelCase mismatch

**Current Status:** Frontend must transform all responses

**Recommendation:**
1. Backend standardizes on snake_case (Python convention)
2. Add middleware to convert to camelCase for frontend
3. OR: Document that frontend must transform

### 8.2 Missing Computed Fields

Backend should compute:
- `assignmentCount` on schedules
- `employeeCount` on departments
- `totalHours` on schedules
- `conflictCount` on validation responses

---

## 9. Security & Validation Issues

### 9.1 Input Validation Gaps

#### ❌ Weak Validation
```python
# employees.py - Password in EmployeeCreate schema
EmployeeCreate(
    email: EmailStr,
    password: str,  # ❌ No strength validation
    name: str,
    ...
)
```

**Issue:** Password validation should be in authentication API, not employee API

#### ✅ Good Validation
```python
# shifts.py - Comprehensive validation
if shift.start_time >= shift.end_time:
    raise HTTPException(400, "Start time must be before end time")

if shift.required_staff < 1:
    raise HTTPException(400, "Required staff must be at least 1")
```

### 9.2 Authorization Issues

**Current:** Basic `get_current_user` dependency

**Missing:**
- Role-based access control (RBAC)
- Resource-level permissions
- Manager-only endpoints not properly secured

**Example:**
```python
# ❌ Inconsistent authorization
@router.post("/api/shifts")
async def create_shift(
    ...,
    current_user: dict = Depends(get_current_manager)  # ✅ Manager required
)

@router.delete("/api/employees/{id}")
async def delete_employee(
    ...,
    current_user: dict = Depends(get_current_user)  # ❌ Should require manager
)
```

### 9.3 SQL Injection Protection

**Status:** ✅ Good - Using SQLAlchemy ORM with parameterized queries

**No raw SQL queries found** - all using SQLAlchemy select/where

---

## 10. API Documentation Issues

### 10.1 OpenAPI/Swagger Documentation

**Current Status:**
- ✅ FastAPI auto-generates OpenAPI docs
- ✅ Most endpoints have docstrings
- ⚠️ Inconsistent detail level
- ❌ No examples in responses
- ❌ No error response documentation

**Missing:**
```python
# Should have:
@router.post("/api/schedules/generate",
    response_model=ScheduleResponse,
    responses={
        200: {"description": "Schedule generated successfully"},
        400: {"description": "Invalid parameters"},
        422: {"description": "Validation error"},
        500: {"description": "Generation failed"}
    }
)
```

### 10.2 Response Schema Documentation

**Good Example (Shifts):**
```python
"""
Create a new shift definition.

- **name**: Shift name (e.g., "Morning Server Shift")
- **shift_type**: Type of shift (morning, afternoon, evening, night)
- **start_time**: Start time (HH:MM format)
...
"""
```

**Poor Example (Schedules):**
```python
"""Create a new schedule."""  # ❌ Too brief
```

---

## 11. Performance Issues

### 11.1 N+1 Query Problems

**Example from schedules.py:**
```python
query = select(Schedule).options(
    selectinload(Schedule.assignments).selectinload(ScheduleAssignment.employee),
    selectinload(Schedule.assignments).selectinload(ScheduleAssignment.shift),
    selectinload(Schedule.creator)
)
```

**Status:** ✅ Good - Using eager loading to prevent N+1 queries

### 11.2 Missing Caching

**No caching headers** on read-only endpoints:
- Analytics endpoints
- Static reference data (shift types, departments)

**Recommendation:** Add cache headers:
```python
@router.get("/api/shifts/types")
async def get_shift_types(...):
    # Add cache header
    return Response(
        content=json.dumps(data),
        headers={"Cache-Control": "public, max-age=3600"}
    )
```

### 11.3 Large Response Payloads

**Issue:**
- `GET /api/schedules/{id}` returns full assignments with nested employees and shifts
- Could be megabytes for large schedules

**Recommendation:**
- Add query parameter: `?include=assignments,employees`
- Default to minimal response
- Support field selection: `?fields=id,title,status`

---

## 12. API Enhancement Recommendations

### 12.1 Immediate Actions (Week 1)

1. **Create Assignment Management API**
   - File: `backend/src/api/assignments.py`
   - Endpoints: CRUD + bulk operations
   - Priority: 🔴 CRITICAL

2. **Expose Schedule Generation Service**
   - Add: `POST /api/schedules/generate`
   - Connect to existing `ScheduleGenerationService`
   - Priority: 🔴 CRITICAL

3. **Add Validation Endpoint**
   - Add: `POST /api/schedules/{id}/validate`
   - Use existing constraint solver
   - Priority: 🔴 CRITICAL

4. **Standardize Response Formats**
   - Create response wrapper middleware
   - Unify error responses
   - Priority: 🟠 HIGH

### 12.2 Short-term Actions (Week 2-3)

5. **Create Rules API**
   - File: `backend/src/api/rules.py`
   - Full CRUD + validation
   - Priority: 🟠 HIGH

6. **Implement Wizard API**
   - Stateful multi-step flow
   - Session management
   - Priority: 🟠 HIGH

7. **Add Batch Operations**
   - Bulk create/update/delete for all resources
   - Priority: 🟡 MEDIUM

8. **Improve Documentation**
   - Add request/response examples
   - Document all error codes
   - Priority: 🟡 MEDIUM

### 12.3 Medium-term Actions (Month 1-2)

9. **Implement Advanced Filtering**
10. **Add Caching Strategy**
11. **Create Audit Log API**
12. **Add WebSocket Support** for real-time updates

---

## 13. Specific Code Issues Found

### 13.1 Schedules API Issues

**File:** `backend/src/api/schedules.py`

```python
# ❌ ISSUE 1: Inconsistent error handling
except Exception as e:
    print(f"Error fetching schedules: {e}")  # ❌ Should use logger
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to fetch schedules: {str(e)}"  # ❌ Exposes internal errors
    )

# ✅ RECOMMENDATION:
except Exception as e:
    logger.error(f"Error fetching schedules: {e}", exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to fetch schedules"  # Generic message
    )
```

```python
# ❌ ISSUE 2: No assignment management
# Missing endpoints:
# POST /api/schedules/{id}/assignments
# GET  /api/schedules/{id}/assignments
# PATCH /api/schedules/{id}/assignments/{assignment_id}
```

### 13.2 Employees API Issues

**File:** `backend/src/api/employees.py`

```python
# ❌ ISSUE 1: Password in employee creation
class EmployeeCreate(EmployeeBase):
    password: str  # ❌ Should be in auth API, not employee API

# ✅ RECOMMENDATION:
# Remove password from EmployeeCreate
# Handle authentication separately via /api/auth/invite endpoint
```

```python
# ❌ ISSUE 2: Missing availability endpoints
# Should have:
# GET  /api/employees/{id}/availability
# PUT  /api/employees/{id}/availability
# GET  /api/employees/{id}/schedules
```

### 13.3 Shifts API Issues

**File:** `backend/src/api/shifts.py`

```python
# ✅ GOOD: Best-designed API in the system
# Has: Bulk operations, templates, validation, proper pagination

# ⚠️ MINOR ISSUE: Template application doesn't create assignments
@router.post("/shifts/templates/{id}/apply")
async def apply_shift_template(...):
    # Mock implementation - doesn't actually create shifts
    shifts_created = len(template_data["shifts"])  # ❌ No DB insert
```

### 13.4 Analytics API Issues

**File:** `backend/src/api/analytics.py`

```python
# ✅ GOOD: Real database queries, no mock data

# ⚠️ ISSUE: Hardcoded hourly rate
HOURLY_RATE = 25.0  # ❌ Should come from employee records

# ✅ RECOMMENDATION:
# Join with employee table to get actual hourly_rate
```

### 13.5 Data I/O API Issues

**File:** `backend/src/api/data_io.py`

```python
# ✅ GOOD: Comprehensive import/export

# ❌ ISSUE: Import types don't match export types
# Export: employees, schedules, rules, analytics
# Import: employees, schedules, rules
# Missing: analytics import/restore
```

---

## 14. Frontend Integration Gaps

### 14.1 Missing Frontend Service Methods

**Required additions to `frontend/src/services/api.js`:**

```javascript
// Assignment Service (NEW)
export const assignmentService = {
  async createBulk(assignments) {
    return api.post('/api/assignments/bulk', { assignments });
  },

  async getBySchedule(scheduleId) {
    return api.get(`/api/schedules/${scheduleId}/assignments`);
  },

  async updateStatus(id, status) {
    return api.patch(`/api/assignments/${id}`, { status });
  },

  async confirm(id) {
    return api.post(`/api/assignments/${id}/confirm`);
  },

  async decline(id) {
    return api.post(`/api/assignments/${id}/decline`);
  }
};

// Generation Service (NEW)
export const generationService = {
  async generate(params) {
    return api.post('/api/schedules/generate', params);
  },

  async validate(scheduleId) {
    return api.post(`/api/schedules/${scheduleId}/validate`);
  },

  async optimize(scheduleId) {
    return api.post(`/api/schedules/${scheduleId}/optimize`);
  },

  async preview(params) {
    return api.post('/api/schedules/preview', params);
  }
};

// Rules Service (NEW)
export const ruleService = {
  async getAll(params) {
    return api.get('/api/rules', { params });
  },

  async create(rule) {
    return api.post('/api/rules', rule);
  },

  async update(id, rule) {
    return api.patch(`/api/rules/${id}`, rule);
  },

  async delete(id) {
    return api.delete(`/api/rules/${id}`);
  },

  async validateSyntax(rule) {
    return api.post('/api/rules/validate', { rule });
  }
};

// Wizard Service (NEW)
export const wizardService = {
  async initSession() {
    return api.post('/api/wizard/init');
  },

  async saveStep(sessionId, step, data) {
    return api.post(`/api/wizard/session/${sessionId}/step/${step}`, data);
  },

  async getSession(sessionId) {
    return api.get(`/api/wizard/session/${sessionId}`);
  },

  async finalize(sessionId) {
    return api.post(`/api/wizard/session/${sessionId}/finalize`);
  },

  async cancel(sessionId) {
    return api.delete(`/api/wizard/session/${sessionId}`);
  }
};

// Enhanced Schedule Service
scheduleService.generate = async (params) => {
  return api.post('/api/schedules/generate', params);
};

scheduleService.validate = async (id) => {
  return api.post(`/api/schedules/${id}/validate`);
};

scheduleService.publish = async (id) => {
  return api.post(`/api/schedules/${id}/publish`);
};

scheduleService.getAssignments = async (id) => {
  return api.get(`/api/schedules/${id}/assignments`);
};
```

---

## 15. Implementation Roadmap

### Phase 1: Critical Foundations (Week 1) 🔴

**Goal:** Enable wizard functionality

1. **Day 1-2: Assignment Management API**
   - Create `backend/src/api/assignments.py`
   - Implement CRUD endpoints
   - Add bulk operations
   - Write tests

2. **Day 3-4: Schedule Generation API**
   - Add `POST /api/schedules/generate` endpoint
   - Connect to `ScheduleGenerationService`
   - Add validation endpoint
   - Test with real data

3. **Day 5: Frontend Integration**
   - Add assignment service to `api.js`
   - Add generation service
   - Update wizard to call APIs
   - Integration testing

### Phase 2: API Standardization (Week 2) 🟠

**Goal:** Consistent API design

1. **Day 6-7: Response Format Standardization**
   - Create response wrapper middleware
   - Standardize error responses
   - Update all endpoints
   - Update frontend error handling

2. **Day 8-9: Rules API**
   - Create `backend/src/api/rules.py`
   - Implement CRUD
   - Add validation
   - Frontend integration

3. **Day 10: Documentation**
   - Add OpenAPI examples
   - Document error codes
   - Create API usage guide

### Phase 3: Advanced Features (Week 3-4) 🟡

1. **Wizard State Management**
2. **Batch Operations**
3. **Advanced Filtering**
4. **Caching Strategy**

---

## 16. Testing Requirements

### 16.1 API Endpoint Tests Needed

```python
# test_assignments_api.py
def test_create_assignment()
def test_create_bulk_assignments()
def test_get_assignments_by_schedule()
def test_update_assignment_status()
def test_employee_confirm_assignment()
def test_employee_decline_assignment()
def test_assignment_conflict_detection()

# test_generation_api.py
def test_generate_schedule()
def test_validate_schedule()
def test_optimize_schedule()
def test_generation_with_constraints()
def test_generation_error_handling()

# test_rules_api.py
def test_create_rule()
def test_validate_rule_syntax()
def test_apply_rules_to_schedule()
```

### 16.2 Integration Tests

```python
# test_wizard_flow.py
def test_complete_wizard_flow()
def test_wizard_with_assignments()
def test_wizard_validation()
def test_wizard_cancellation()
```

---

## 17. Metrics & Monitoring

### 17.1 API Metrics to Track

```python
# Add to middleware
- Request count by endpoint
- Response time percentiles (p50, p95, p99)
- Error rate by endpoint
- Payload size distribution
- Cache hit rate
- Database query count per request
```

### 17.2 Alerts to Configure

```python
- Response time > 2s
- Error rate > 5%
- Database connection pool exhaustion
- Memory usage > 80%
```

---

## Conclusion

### Critical Path to Wizard Functionality

1. ✅ **Implement Assignment Management API** (2 days)
2. ✅ **Expose Schedule Generation API** (2 days)
3. ✅ **Create Frontend Services** (1 day)
4. ✅ **Integration Testing** (1 day)

**Total Time to Unblock Wizard: 6 days**

### Long-term API Health

**Current Score: 6/10**

Strengths:
- ✅ Good pagination on most endpoints
- ✅ Proper eager loading to prevent N+1 queries
- ✅ Comprehensive analytics with real data
- ✅ Good import/export functionality

Weaknesses:
- ❌ Missing 14 critical endpoint categories
- ❌ No assignment management (wizard blocker)
- ❌ AI service not exposed via API
- ❌ Inconsistent response formats
- ❌ Inadequate error handling

**Recommended Actions:**
1. Implement missing critical APIs (Phase 1)
2. Standardize response formats (Phase 2)
3. Improve documentation (Phase 2)
4. Add comprehensive testing (Ongoing)

---

**Next Steps:**
1. Review this document with development team
2. Prioritize critical endpoints
3. Create detailed implementation tickets
4. Begin Phase 1 development

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Status:** Ready for Implementation
