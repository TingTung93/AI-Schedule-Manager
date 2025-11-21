# Data Flow Diagrams

## Overview
Visual representation of data flow through the AI Schedule Manager system from user interaction to database and back.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ React        │  │ State        │  │ Router       │              │
│  │ Components   │◄─┤ Management   │◄─┤ (React       │              │
│  │              │  │ (Context)    │  │  Router)     │              │
│  └──────┬───────┘  └──────────────┘  └──────────────┘              │
│         │                                                            │
│         │ API Calls                                                 │
│  ┌──────▼─────────────────────────────────────────────┐            │
│  │  Axios Instance (api.js)                            │            │
│  │  - Request interceptors (add JWT, CSRF)             │            │
│  │  - Response interceptors (handle errors, refresh)   │            │
│  └──────────────────┬──────────────────────────────────┘            │
└────────────────────│─────────────────────────────────────────────────┘
                     │ HTTPS
                     │
┌────────────────────▼─────────────────────────────────────────────────┐
│                    Backend Server (FastAPI)                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  CORS Middleware                                                │  │
│  └────────────────┬────────────────────────────────────────────────┘  │
│  ┌────────────────▼────────────────────────────────────────────────┐  │
│  │  Authentication Middleware                                       │  │
│  │  - Verify JWT token                                             │  │
│  │  - Check permissions                                            │  │
│  └────────────────┬────────────────────────────────────────────────┘  │
│  ┌────────────────▼────────────────────────────────────────────────┐  │
│  │  API Routes                                                      │  │
│  │  /api/employees  /api/schedules  /api/shifts  /api/auth        │  │
│  └────────────────┬────────────────────────────────────────────────┘  │
│  ┌────────────────▼────────────────────────────────────────────────┐  │
│  │  Business Logic / Services                                       │  │
│  │  - CRUD operations                                              │  │
│  │  - Validation                                                   │  │
│  │  - Business rules                                               │  │
│  └────────────────┬────────────────────────────────────────────────┘  │
│  ┌────────────────▼────────────────────────────────────────────────┐  │
│  │  Database Layer (SQLAlchemy ORM)                                │  │
│  │  - Models                                                       │  │
│  │  - Relationships                                                │  │
│  │  - Transactions                                                 │  │
│  └────────────────┬────────────────────────────────────────────────┘  │
└───────────────────│───────────────────────────────────────────────────┘
                    │ SQL
                    │
┌───────────────────▼───────────────────────────────────────────────────┐
│               PostgreSQL Database                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │  employees  │ │  schedules  │ │   shifts    │ │ departments │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                     │
│  │  schedule_  │ │    rules    │ │notifications│                     │
│  │ assignments │ │             │ │             │                     │
│  └─────────────┘ └─────────────┘ └─────────────┘                     │
└───────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### User Login Flow

```
┌────────────┐                                    ┌────────────┐
│  Frontend  │                                    │  Backend   │
│  Login     │                                    │   API      │
│   Page     │                                    │            │
└─────┬──────┘                                    └──────┬─────┘
      │                                                  │
      │ 1. User enters email/password                  │
      │    and clicks "Login"                          │
      │                                                  │
      │ 2. POST /api/auth/login                        │
      │    { email, password }                          │
      ├─────────────────────────────────────────────────►
      │                                                  │
      │                                3. Validate       │
      │                                   credentials    │
      │                                   ┌──────────┐  │
      │                                   │PostgreSQL│  │
      │                                   │ employees│  │
      │                                   └────┬─────┘  │
      │                                        │        │
      │                                4. If valid,     │
      │                                   generate JWT  │
      │                                   tokens        │
      │                                                  │
      │ 5. Response: access_token, refresh_token       │
      │◄─────────────────────────────────────────────────┤
      │                                                  │
      │ 6. Store access_token in memory                 │
      │    Store refresh_token in HttpOnly cookie       │
      │                                                  │
      │ 7. GET /api/auth/me                             │
      ├─────────────────────────────────────────────────►
      │                                                  │
      │                                8. Decode JWT,    │
      │                                   fetch user     │
      │                                                  │
      │ 9. Response: user data                          │
      │◄─────────────────────────────────────────────────┤
      │                                                  │
      │ 10. Update AuthContext                          │
      │     Redirect to Dashboard                       │
      │                                                  │
```

### Token Refresh Flow

```
┌────────────┐                                    ┌────────────┐
│  Frontend  │                                    │  Backend   │
│   (Axios   │                                    │   API      │
│Interceptor)│                                    │            │
└─────┬──────┘                                    └──────┬─────┘
      │                                                  │
      │ 1. API call fails with 401 Unauthorized         │
      │◄─────────────────────────────────────────────────┤
      │                                                  │
      │ 2. Check if already refreshing                  │
      │    (prevent duplicate refresh calls)            │
      │                                                  │
      │ 3. POST /api/auth/refresh                       │
      │    Cookie: refresh_token=...                    │
      ├─────────────────────────────────────────────────►
      │                                                  │
      │                                4. Validate       │
      │                                   refresh token  │
      │                                                  │
      │                                5. If valid,      │
      │                                   generate new   │
      │                                   access token   │
      │                                                  │
      │ 6. Response: new access_token                   │
      │◄─────────────────────────────────────────────────┤
      │                                                  │
      │ 7. Update stored access_token                   │
      │                                                  │
      │ 8. Retry original failed request                │
      │    with new access_token                        │
      ├─────────────────────────────────────────────────►
      │                                                  │
      │ 9. Response: successful result                  │
      │◄─────────────────────────────────────────────────┤
      │                                                  │
```

## Employee Management Flow

### Load Employees List

```
┌────────────┐                      ┌────────────┐              ┌──────────┐
│ Employees  │                      │  Backend   │              │PostgreSQL│
│   Page     │                      │   API      │              │ Database │
└─────┬──────┘                      └──────┬─────┘              └────┬─────┘
      │                                    │                         │
      │ 1. useEffect(() => loadEmployees())│                         │
      │                                    │                         │
      │ 2. GET /api/employees              │                         │
      │    ?page=1&size=20&active=true     │                         │
      ├───────────────────────────────────►│                         │
      │                                    │                         │
      │                        3. Parse query params                 │
      │                           Calculate offset                   │
      │                                    │                         │
      │                        4. SELECT * FROM employees            │
      │                           WHERE is_active = true             │
      │                           ORDER BY name ASC                  │
      │                           LIMIT 20 OFFSET 0                  │
      │                                    ├────────────────────────►│
      │                                    │                         │
      │                                    │ 5. Return rows          │
      │                                    │◄────────────────────────┤
      │                                    │                         │
      │                        6. Transform to camelCase             │
      │                           Build pagination metadata          │
      │                                    │                         │
      │ 7. Response:                       │                         │
      │    {                               │                         │
      │      items: [...],                 │                         │
      │      total: 45,                    │                         │
      │      page: 1,                      │                         │
      │      size: 20,                     │                         │
      │      pages: 3                      │                         │
      │    }                               │                         │
      │◄───────────────────────────────────┤                         │
      │                                    │                         │
      │ 8. setEmployees(response.data.items)                         │
      │    Render employee cards           │                         │
      │                                    │                         │
```

### Create New Employee

```
┌────────────┐                      ┌────────────┐              ┌──────────┐
│ Employees  │                      │  Backend   │              │PostgreSQL│
│   Form     │                      │   API      │              │ Database │
└─────┬──────┘                      └──────┬─────┘              └────┬─────┘
      │                                    │                         │
      │ 1. User fills form and clicks Save│                         │
      │                                    │                         │
      │ 2. Validate form client-side       │                         │
      │    (email format, required fields) │                         │
      │                                    │                         │
      │ 3. POST /api/employees             │                         │
      │    {                               │                         │
      │      email: "jane@example.com",    │                         │
      │      name: "Jane Smith",           │                         │
      │      role: "employee",             │                         │
      │      departmentId: 2               │                         │
      │    }                               │                         │
      ├───────────────────────────────────►│                         │
      │                                    │                         │
      │                        4. Check permissions                  │
      │                           (Manager/Admin only)               │
      │                                    │                         │
      │                        5. Validate request data              │
      │                           (Pydantic schemas)                 │
      │                                    │                         │
      │                        6. Check email uniqueness             │
      │                           SELECT * FROM employees            │
      │                           WHERE email = 'jane@example.com'   │
      │                                    ├────────────────────────►│
      │                                    │                         │
      │                                    │ 7. No rows found (OK)   │
      │                                    │◄────────────────────────┤
      │                                    │                         │
      │                        8. Hash password (if provided)        │
      │                                    │                         │
      │                        9. INSERT INTO employees              │
      │                           (email, name, role, ...)           │
      │                           VALUES (...)                       │
      │                                    ├────────────────────────►│
      │                                    │                         │
      │                                    │ 10. Return new record   │
      │                                    │     with ID             │
      │                                    │◄────────────────────────┤
      │                                    │                         │
      │ 11. Response: 201 Created          │                         │
      │     { id: 10, email: ..., ... }    │                         │
      │◄───────────────────────────────────┤                         │
      │                                    │                         │
      │ 12. Show success notification      │                         │
      │     Add new employee to local state│                         │
      │     Close dialog                   │                         │
      │                                    │                         │
```

## Schedule Management Flow

### Load Schedule with Assignments

```
┌────────────┐              ┌────────────┐              ┌──────────┐
│ Schedule   │              │  Backend   │              │PostgreSQL│
│   Page     │              │   API      │              │ Database │
└─────┬──────┘              └──────┬─────┘              └────┬─────┘
      │                            │                         │
      │ 1. Select schedule from    │                         │
      │    dropdown (ID: 5)        │                         │
      │                            │                         │
      │ 2. GET /api/schedules/5    │                         │
      ├───────────────────────────►│                         │
      │                            │                         │
      │                3. SELECT * FROM schedules            │
      │                   WHERE id = 5                       │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 4. Return schedule row  │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                5. Eagerly load assignments:          │
      │                   SELECT * FROM schedule_assignments │
      │                   WHERE schedule_id = 5              │
      │                   JOIN employees ON ...              │
      │                   JOIN shifts ON ...                 │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 6. Return joined data   │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                7. Build response with nested data:   │
      │                   {                                  │
      │                     id: 5,                           │
      │                     weekStart: "2025-01-20",         │
      │                     assignments: [                   │
      │                       {                              │
      │                         id: 100,                     │
      │                         employee: {...},             │
      │                         shift: {...}                 │
      │                       }                              │
      │                     ]                                │
      │                   }                                  │
      │                            │                         │
      │ 8. Response: schedule with │                         │
      │    assignments             │                         │
      │◄───────────────────────────┤                         │
      │                            │                         │
      │ 9. Transform to calendar   │                         │
      │    events                  │                         │
      │    Render FullCalendar     │                         │
      │                            │                         │
```

### Create Assignment (Assign Employee to Shift)

```
┌────────────┐              ┌────────────┐              ┌──────────┐
│Assignment  │              │  Backend   │              │PostgreSQL│
│   Form     │              │   API      │              │ Database │
└─────┬──────┘              └──────┬─────┘              └────┬─────┘
      │                            │                         │
      │ 1. User selects:           │                         │
      │    - Employee: John (ID 2) │                         │
      │    - Shift: Morning (ID 15)│                         │
      │    Clicks "Assign"         │                         │
      │                            │                         │
      │ 2. POST /api/schedules/5/  │                         │
      │    assignments             │                         │
      │    {                       │                         │
      │      employeeId: 2,        │                         │
      │      shiftId: 15,          │                         │
      │      status: "assigned"    │                         │
      │    }                       │                         │
      ├───────────────────────────►│                         │
      │                            │                         │
      │                3. Load employee and shift data       │
      │                   to check availability and          │
      │                   qualifications                     │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 4. Return employee      │
      │                            │    and shift data       │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                5. Validate:                          │
      │                   - Employee available at shift time │
      │                   - Employee has qualifications      │
      │                   - No conflicting assignments       │
      │                            │                         │
      │                6. Check for conflicts:               │
      │                   SELECT * FROM schedule_assignments │
      │                   WHERE employee_id = 2              │
      │                   AND shift_id IN (                  │
      │                     SELECT id FROM shifts            │
      │                     WHERE date = shift.date          │
      │                     AND (start_time, end_time)       │
      │                         OVERLAPS (...)               │
      │                   )                                  │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 7. No conflicts         │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                8. INSERT INTO schedule_assignments   │
      │                   (schedule_id, employee_id,         │
      │                    shift_id, status, ...)            │
      │                   VALUES (5, 2, 15, 'assigned', ...)│
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 9. Return new record    │
      │                            │◄────────────────────────┤
      │                            │                         │
      │ 10. Response: 201 Created  │                         │
      │     { id: 101, ... }       │                         │
      │◄───────────────────────────┤                         │
      │                            │                         │
      │ 11. Update calendar events │                         │
      │     Show success message   │                         │
      │                            │                         │
```

## Schedule Generation Flow

### AI-Powered Schedule Generation

```
┌────────────┐              ┌────────────┐              ┌──────────┐
│ Schedule   │              │  Backend   │              │PostgreSQL│
│  Builder   │              │   API      │              │ Database │
└─────┬──────┘              └──────┬─────┘              └────┬─────┘
      │                            │                         │
      │ 1. User fills wizard:      │                         │
      │    - Date range            │                         │
      │    - Department            │                         │
      │    - Constraints           │                         │
      │    Clicks "Generate"       │                         │
      │                            │                         │
      │ 2. POST /api/schedule/     │                         │
      │    generate                │                         │
      │    {                       │                         │
      │      startDate: "2025-01-27"                         │
      │      endDate: "2025-02-02",│                         │
      │      departmentId: 2,      │                         │
      │      constraints: {...}    │                         │
      │    }                       │                         │
      ├───────────────────────────►│                         │
      │                            │                         │
      │                3. Load all required data:            │
      │                   - Employees (availability)         │
      │                   - Shifts (requirements)            │
      │                   - Rules (constraints)              │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 4. Return all data      │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                5. Initialize constraint solver       │
      │                   (OR-Tools CP-SAT)                  │
      │                                                      │
      │                6. Define variables:                  │
      │                   - Employee-shift assignments       │
      │                                                      │
      │                7. Add constraints:                   │
      │                   - Each shift has required staff    │
      │                   - Employee availability            │
      │                   - Qualifications match             │
      │                   - Max hours per week               │
      │                   - Rest periods                     │
      │                                                      │
      │                8. Add objectives:                    │
      │                   - Minimize overtime                │
      │                   - Balanced workload                │
      │                   - Preferred assignments            │
      │                                                      │
      │                9. Solve (may take 5-30 seconds)      │
      │                                                      │
      │                10. Extract solution                  │
      │                                                      │
      │                11. Create schedule and assignments   │
      │                    BEGIN TRANSACTION                 │
      │                    INSERT INTO schedules (...)       │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 12. Schedule ID: 6      │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                13. INSERT INTO schedule_assignments  │
      │                    (schedule_id, employee_id, ...)   │
      │                    VALUES (6, 1, 15, ...), (...)     │
      │                    (bulk insert ~35 assignments)     │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 14. Assignments created │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                    COMMIT TRANSACTION                │
      │                                                      │
      │ 15. Response: 200 OK       │                         │
      │     {                      │                         │
      │       status: "optimal",   │                         │
      │       schedule: [...],     │                         │
      │       savedAssignments: 35,│                         │
      │       statistics: {...}    │                         │
      │     }                      │                         │
      │◄───────────────────────────┤                         │
      │                            │                         │
      │ 16. Navigate to            │                         │
      │     validation step        │                         │
      │     Show statistics        │                         │
      │                            │                         │
```

## Error Handling Flow

### API Error with Recovery

```
┌────────────┐              ┌────────────┐              ┌──────────┐
│  Frontend  │              │  Backend   │              │PostgreSQL│
└─────┬──────┘              └──────┬─────┘              └────┬─────┘
      │                            │                         │
      │ 1. POST /api/employees     │                         │
      │    { email: "existing@..." }                         │
      ├───────────────────────────►│                         │
      │                            │                         │
      │                2. Validate request                   │
      │                                                      │
      │                3. Check email uniqueness             │
      │                   SELECT * FROM employees            │
      │                   WHERE email = 'existing@...'       │
      │                            ├────────────────────────►│
      │                            │                         │
      │                            │ 4. Row found (conflict) │
      │                            │◄────────────────────────┤
      │                            │                         │
      │                5. Raise HTTPException(409)           │
      │                   {                                  │
      │                     error: "Conflict",               │
      │                     message: "Email already exists", │
      │                     field: "email"                   │
      │                   }                                  │
      │                            │                         │
      │ 6. Response: 409 Conflict  │                         │
      │◄───────────────────────────┤                         │
      │                            │                         │
      │ 7. Axios interceptor       │                         │
      │    catches error           │                         │
      │                            │                         │
      │ 8. Extract user message    │                         │
      │    from error.response.data│                         │
      │                            │                         │
      │ 9. setFormErrors({         │                         │
      │      email: "Email already │                         │
      │              exists"        │                         │
      │    })                      │                         │
      │                            │                         │
      │ 10. Display error under    │                         │
      │     email field            │                         │
      │     Keep form open         │                         │
      │                            │                         │
```

## Summary

These data flow diagrams illustrate:
1. **Authentication**: JWT token flow with automatic refresh
2. **CRUD Operations**: Standard data loading, creation, updates
3. **Complex Operations**: Schedule generation with constraint solving
4. **Error Handling**: Graceful error recovery with user feedback
5. **State Management**: Data flow between components and contexts
