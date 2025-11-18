# Frontend-Backend Data Flow Analysis Report
**Date**: 2025-11-18
**Project**: AI-Schedule-Manager
**Analyzer**: Code Quality Analyzer

---

## Executive Summary

This report provides a comprehensive analysis of the data flow between the frontend React application and the FastAPI backend. The analysis reveals a **well-architected but partially implemented system** with clear separation of concerns, robust authentication, and real-time capabilities via WebSocket.

**Key Findings**:
- ✅ Centralized API client with JWT auth and token refresh
- ✅ Custom React hooks for data management (useApi, useApiMutation)
- ⚠️ **Critical Gap**: Many frontend services reference non-existent API service methods
- ✅ Real-time WebSocket integration for live updates
- ✅ Comprehensive error handling and loading states
- ⚠️ Inconsistent data structure mapping (snake_case ↔ camelCase)

---

## 1. Frontend API Client Architecture

### 1.1 Core API Service (`/frontend/src/services/api.js`)

**Base Configuration**:
```javascript
axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 10000,
  withCredentials: true,  // HttpOnly cookies enabled
  headers: { 'Content-Type': 'application/json' }
})
```

**Authentication Flow**:
1. **Request Interceptor**: Adds `Authorization: Bearer {token}` + CSRF token
2. **Response Interceptor**: Handles 401 errors with automatic token refresh
3. **Token Storage**: In-memory fallback + HttpOnly cookies
4. **Refresh Mechanism**: Queue pattern prevents multiple refresh calls

### 1.2 Available Services

**Fully Implemented**:
- ✅ `authService` - 12 methods (login, register, logout, refresh, etc.)
- ✅ `scheduleService` - 5 methods (CRUD operations)
- ✅ `taskService` - 5 methods (CRUD operations)
- ✅ `userService` - 4 methods (user management)

**Removed/Deprecated** (373 lines removed - good practice):
- ❌ `employeeService` - **Components still reference this!**
- ❌ `ruleService` - **Components still reference this!**
- ❌ `analyticsService` - **Dashboard still references this!**
- ❌ `notificationService` - **Dashboard still references this!**
- ❌ `shiftService`
- ❌ `settingsService`

**Note**: The api.js file was refactored to remove wrapper methods, but **components were not updated** to use the raw axios instance directly.

---

## 2. React Hooks for Data Management

### 2.1 Custom Hooks (`/frontend/src/hooks/useApi.js`)

| Hook | Purpose | Features |
|------|---------|----------|
| `useApi` | GET requests with auto-fetch | Loading states, error handling, retry logic, refetch |
| `useApiMutation` | POST/PUT/DELETE operations | Optimistic updates, success/error callbacks |
| `usePaginatedApi` | Paginated data loading | Infinite scroll, load more, page management |
| `useRealTimeApi` | Polling-based real-time data | Configurable intervals, start/stop polling |

**Usage Pattern**:
```javascript
// Data fetching
const { data, loading, error, refetch } = useApi(
  () => api.get('/api/employees'),
  [],
  { onSuccess, onError }
);

// Mutations
const { mutate, loading } = useApiMutation(
  (data) => api.post('/api/employees', data),
  { onSuccess, onError }
);
```

### 2.2 WebSocket Hooks (`/frontend/src/hooks/useWebSocket.js`)

**Real-time Features**:
- ✅ `useWebSocket()` - Connection management
- ✅ `useScheduleUpdates(scheduleId)` - Live schedule changes
- ✅ `useEmployeeUpdates()` - Employee status changes
- ✅ `useNotifications()` - Real-time notifications
- ✅ `usePresence()` - Online users tracking
- ✅ `useTypingIndicator(location)` - Collaborative editing
- ✅ `useConflictAlerts()` - Scheduling conflicts

---

## 3. Component → API Mapping

### 3.1 Dashboard Component

**Expected Data**:
```javascript
analyticsData = {
  // Expected structure (undefined)
}

schedulesData = {
  schedules: [{
    id, name, startDate, endDate,
    shifts: [], createdAt, status
  }]
}

employeesData = {
  employees: [{
    id, firstName, lastName, email,
    role, isActive, qualifications
  }]
}

notificationsData = {
  notifications: [{
    id, title, message, type,
    createdAt, read
  }]
}
```

**API Calls Used**:
- `analyticsService.getOverview()` - ❌ **DOES NOT EXIST**
- `analyticsService.getLaborCosts(timeRange)` - ❌ **DOES NOT EXIST**
- `scheduleService.getSchedules()` - ✅ EXISTS (`GET /api/schedules`)
- `employeeService.getEmployees()` - ❌ **DOES NOT EXIST** (should use `api.get('/api/employees')`)
- `notificationService.getNotifications()` - ❌ **DOES NOT EXIST**

**Critical Issue**: Dashboard will fail to load analytics, employees, and notifications data.

### 3.2 EmployeeManagement Component

**Expected Data**:
```javascript
employeesData = {
  employees: [{
    id, firstName, lastName, email, phone,
    role, hourlyRate, qualifications: [],
    availability: {
      monday: { available, start, end },
      // ... other days
    },
    maxHoursPerWeek, isActive
  }]
}
```

**API Calls Used**:
- `api.get('/api/employees')` - ✅ CORRECT
- `api.post('/api/employees', data)` - ✅ CORRECT
- `api.patch('/api/employees/{id}', data)` - ✅ CORRECT
- `api.delete('/api/employees/{id}')` - ✅ CORRECT

**Status**: ✅ **Fully functional** - Uses axios instance directly.

### 3.3 ScheduleDisplay Component

**Expected Data**:
```javascript
schedulesData = {
  schedules: [{
    id, name, startDate, endDate,
    assignments: [{
      id, employeeId, startTime, endTime,
      role, notes, needsConfirmation
    }]
  }]
}
```

**API Calls Used**:
- `scheduleService.getSchedules()` - ✅ EXISTS
- `scheduleService.updateShift(scheduleId, shiftId, updates)` - ⚠️ **METHOD NOT IN SERVICE**
- `scheduleService.generateSchedule(startDate, endDate)` - ⚠️ **METHOD NOT IN SERVICE**
- `api.get('/api/employees')` - ✅ CORRECT

**Critical Issue**: Shift update and generation will fail.

### 3.4 RuleInput Component

**Expected Data**:
```javascript
rulesData = {
  rules: [{
    id, text, rule_type, employee,
    constraints: [], active, createdAt
  }]
}

parsedResult = {
  id, rule_type, employee, constraints: []
}
```

**API Calls Used**:
- `api.get('/api/rules')` - ✅ CORRECT
- `api.post('/api/rules/parse', { rule_text })` - ✅ CORRECT
- `api.delete('/api/rules/{id}')` - ✅ CORRECT
- `api.put('/api/rules/{id}', data)` - ✅ CORRECT

**Status**: ✅ **Fully functional** - Uses axios instance directly.

---

## 4. Backend API Endpoints

### 4.1 Available Endpoints (from `/backend/src/api/`)

| Module | File | Key Endpoints |
|--------|------|---------------|
| **Assignments** | `assignments.py` | POST `/schedules/{id}/assignments`, POST `/bulk`, GET/PUT/DELETE `/{id}`, POST `/{id}/confirm`, POST `/{id}/decline` |
| **Analytics** | `analytics.py` | Analytics endpoints (need verification) |
| **Departments** | `departments.py` | CRUD for departments |
| **Employees** | `employees.py` | GET/POST `/api/employees`, PUT/DELETE `/api/employees/{id}` |
| **Rules** | `rules.py` | GET/POST `/api/rules`, POST `/api/rules/parse`, PUT/DELETE `/api/rules/{id}` |
| **Schedules** | `schedules.py` | GET/POST `/api/schedules`, PUT/DELETE `/api/schedules/{id}` |
| **Shifts** | `shifts.py` | Shift management endpoints |
| **Notifications** | `notifications.py` | Notification endpoints |
| **Settings** | `settings.py` | Settings endpoints |
| **Data I/O** | `data_io.py` | Import/export endpoints |

### 4.2 Data Schemas (Pydantic - `/backend/src/schemas.py`)

**Key Models**:
```python
# Employee
class EmployeeResponse:
    id: int
    name: str  # ❌ Frontend expects firstName + lastName
    email: EmailStr
    role: EmployeeRole
    phone: Optional[str]
    hourly_rate: Optional[float]  # ❌ Frontend uses camelCase
    max_hours_per_week: Optional[int]
    qualifications: Optional[List[str]]
    availability_pattern: Optional[Dict]  # ❌ Frontend uses 'availability'
    department_id: Optional[int]
    active: bool
    created_at: datetime
    updated_at: datetime

# Department
class DepartmentResponse:
    id: int
    name: str
    description: Optional[str]
    parent_id: Optional[int]
    settings: Optional[Dict]
    active: bool
    created_at: datetime
    updated_at: datetime

# Rule
class RuleResponse:
    id: int
    rule_type: RuleType
    original_text: str
    constraints: Dict
    priority: int (1-5)
    employee_id: Optional[int]
    active: bool
```

**Field Naming Issues**:
- Backend uses `snake_case` (Python convention)
- Frontend expects `camelCase` (JavaScript convention)
- **No transformation layer** between backend/frontend

---

## 5. Data Structure Inconsistencies

### 5.1 Employee Data Mapping

| Backend Field | Frontend Expected | Status |
|--------------|-------------------|--------|
| `name` | `firstName` + `lastName` | ❌ Mismatch |
| `hourly_rate` | `hourlyRate` | ❌ Case mismatch |
| `max_hours_per_week` | `maxHoursPerWeek` | ❌ Case mismatch |
| `availability_pattern` | `availability` | ❌ Name mismatch |
| `department_id` | `departmentId` | ❌ Case mismatch |
| `is_active` | `isActive` | ❌ Case mismatch |

### 5.2 Schedule Data Mapping

| Backend Field | Frontend Expected | Status |
|--------------|-------------------|--------|
| `start_date` | `startDate` | ❌ Case mismatch |
| `end_date` | `endDate` | ❌ Case mismatch |
| `created_at` | `createdAt` | ❌ Case mismatch |
| `updated_at` | `updatedAt` | ❌ Case mismatch |
| `needs_confirmation` | `needsConfirmation` | ❌ Case mismatch |

---

## 6. State Management Patterns

### 6.1 Local Component State

**All components use local state** (no Redux/Context for data):
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
```

**Pattern**: Each component fetches its own data independently.

### 6.2 Real-time State Updates

**WebSocket Integration**:
```javascript
const { schedules: realtimeSchedules, lastUpdate } = useScheduleUpdates(selectedSchedule?.id);
const { onlineUsers, userActivity } = usePresence();
const { typingUsers } = useTypingIndicator('schedule-main');
```

**Updates**: Components listen to WebSocket events and update local state.

---

## 7. Error Handling & Loading States

### 7.1 Error Handling Pattern

**Centralized in axios interceptor**:
```javascript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401: Token refresh
    // 403: Permission denied
    // 429: Rate limiting
    // Network errors
  }
);
```

**Component-level**:
```javascript
const { onError } = options;
setNotification({ type: 'error', message: getErrorMessage(error) });
```

### 7.2 Loading States

**Patterns**:
1. **Component-level**: `{loading ? <CircularProgress /> : <Data />}`
2. **Button-level**: `disabled={loading} startIcon={loading ? <CircularProgress /> : null}`
3. **Suspense**: `<Suspense fallback={<LoadingFallback />}>`

---

## 8. API Integration Gaps

### 8.1 Missing Service Methods

**Dashboard requires**:
```javascript
// ❌ NOT IMPLEMENTED
analyticsService.getOverview()
analyticsService.getLaborCosts(timeRange)
employeeService.getEmployees()  // Should use api.get('/api/employees')
notificationService.getNotifications()
```

**ScheduleDisplay requires**:
```javascript
// ❌ NOT IMPLEMENTED
scheduleService.updateShift(scheduleId, shiftId, updates)
scheduleService.generateSchedule(startDate, endDate)
```

### 8.2 Recommended Implementation

**Option 1: Use axios directly** (as intended by refactor):
```javascript
// Dashboard.jsx
const { data: employeesData } = useApi(
  () => api.get('/api/employees'),
  []
);

const { data: analyticsData } = useApi(
  () => api.get('/api/analytics/overview'),
  []
);
```

**Option 2: Restore service wrappers**:
```javascript
// services/api.js
export const employeeService = {
  getEmployees: () => api.get('/api/employees'),
  // ... other methods
};
```

---

## 9. Data Transformation Layer (Missing)

### 9.1 Current Approach

**No transformation** - Components expect backend to return camelCase:
```javascript
// ❌ This assumes backend returns camelCase
const employee = employeesData?.employees[0];
console.log(employee.firstName);  // undefined (backend returns 'name')
console.log(employee.hourlyRate);  // undefined (backend returns 'hourly_rate')
```

### 9.2 Recommended Approach

**Add transformation interceptor**:
```javascript
// utils/caseTransform.js
export const snakeToCamel = (obj) => {
  // Transform snake_case to camelCase
};

// api.js
api.interceptors.response.use(
  (response) => {
    response.data = snakeToCamel(response.data);
    return response;
  }
);
```

---

## 10. WebSocket Integration

### 10.1 Connection Management

**Manager**: `/frontend/src/services/websocket.js`
- Automatic reconnection
- Room-based subscriptions
- Event broadcasting
- Presence tracking

**Events**:
- `schedule_created`, `schedule_updated`, `schedule_deleted`
- `employee_status_changed`, `employee_availability_updated`
- `notification_new`, `notification_read`
- `user_connected`, `user_disconnected`, `user_editing`, `user_typing`
- `conflict_detected`, `conflict_resolved`

### 10.2 Real-time Features

**Schedule Collaboration**:
```javascript
// Editing indicator
websocketManager.sendEditing('shift', shiftId);
websocketManager.stopEditing('shift', shiftId);

// Typing indicator
websocketManager.sendTyping('schedule-main');
websocketManager.stopTyping('schedule-main');
```

**Conflict Detection**:
```javascript
const { conflicts, activeConflicts } = useConflictAlerts();
```

---

## 11. Routing & Protected Routes

### 11.1 Route Configuration

**Public Routes**:
- `/login` → `LoginPage`
- `/register` → `RegisterPage`

**Protected Routes** (with role-based access):
- `/dashboard` → `DashboardPage` (all authenticated)
- `/employees` → `EmployeesPage` (admin, manager)
- `/departments` → `DepartmentManager` (admin, manager)
- `/shifts` → `ShiftManager` (admin, manager)
- `/schedule` → `SchedulePage` (all authenticated)
- `/schedule/builder` → `ScheduleBuilder` (admin, manager)
- `/rules` → `RulesPage` (admin, manager)
- `/analytics` → `AnalyticsPage` (admin, manager)
- `/roles` → `RoleManager` (admin only)
- `/settings` → `SettingsPage` (all authenticated)
- `/profile` → `ProfilePage` (all authenticated)

### 11.2 Protected Route Pattern

```javascript
<ProtectedRoute requiredRoles={['admin', 'manager']}>
  <Component />
</ProtectedRoute>
```

---

## 12. Performance Optimizations

### 12.1 Code Splitting

**Lazy Loading**:
```javascript
const ScheduleBuilder = lazy(() => import('./pages/ScheduleBuilder'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
// ... etc
```

**Benefits**: Reduced initial bundle size, faster TTI.

### 12.2 Memoization

**Used in components**:
```javascript
const recentSchedules = useMemo(() => {
  return schedules.sort().slice(0, 5);
}, [schedules]);

const weekShifts = useMemo(() => {
  return extractShiftsFromSchedule(selectedSchedule);
}, [selectedSchedule, weekDays]);
```

### 12.3 Polling Management

```javascript
const { startPolling, stopPolling } = useRealTimeApi(
  apiCall,
  30000  // 30s interval
);
```

---

## 13. Critical Issues & Recommendations

### 13.1 HIGH Priority

1. **❌ API Service Mismatch**
   - **Issue**: Components reference removed service methods
   - **Impact**: Dashboard, ScheduleDisplay will fail
   - **Fix**: Update all components to use `api.get/post/put/delete` directly

2. **❌ Data Structure Inconsistency**
   - **Issue**: Backend uses snake_case, frontend expects camelCase
   - **Impact**: All data access will return undefined
   - **Fix**: Add transformation layer in axios interceptor

3. **❌ Missing Employee Name Split**
   - **Issue**: Backend has single `name` field, frontend expects `firstName` + `lastName`
   - **Impact**: Employee names won't display
   - **Fix**: Backend should split into first_name/last_name OR frontend should handle single name

### 13.2 MEDIUM Priority

4. **⚠️ scheduleService Missing Methods**
   - **Issue**: `updateShift`, `generateSchedule` not implemented
   - **Impact**: Schedule editing won't work
   - **Fix**: Add methods to scheduleService

5. **⚠️ No Analytics Endpoints**
   - **Issue**: analyticsService referenced but not implemented
   - **Impact**: Dashboard analytics won't load
   - **Fix**: Verify analytics.py endpoints and add service methods

### 13.3 LOW Priority

6. **📝 Inconsistent Error Messages**
   - Extract from `error.response.data.message` vs `error.message`
   - Consider standardizing backend error format

7. **📝 Notification System**
   - WebSocket notifications work, but HTTP fallback unclear
   - Consider adding REST endpoint for notifications

---

## 14. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Components                                                  │
│  ├─ Dashboard.jsx ───┐                                       │
│  ├─ EmployeeManagement.jsx                                   │
│  ├─ ScheduleDisplay.jsx                                      │
│  └─ RuleInput.jsx ───┘                                       │
│          │                                                   │
│          │ uses                                              │
│          ▼                                                   │
│  Hooks (useApi, useApiMutation, useWebSocket)                │
│          │                                                   │
│          │ calls                                             │
│          ▼                                                   │
│  API Client (axios + interceptors)                           │
│  ├─ Request: Add Auth + CSRF tokens                          │
│  ├─ Response: Handle 401 refresh, transform data ❌           │
│  └─ Services: authService, scheduleService ✅                 │
│                employeeService ❌ (removed)                   │
│                analyticsService ❌ (removed)                  │
│          │                                                   │
│          │ HTTP + WebSocket                                  │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│                    Network Layer                             │
│  ├─ HTTP: /api/* endpoints                                   │
│  └─ WebSocket: Real-time updates                             │
├─────────────────────────────────────────────────────────────┤
│                    Backend (FastAPI)                         │
│  ├─ Routes (/api/employees, /api/schedules, etc.)            │
│  ├─ Schemas (Pydantic - snake_case)                          │
│  ├─ Services (Business logic)                                │
│  └─ Database (PostgreSQL via SQLAlchemy)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. Dependencies

### 15.1 Frontend

**Core**:
- `axios` - HTTP client
- `react`, `react-dom`, `react-router-dom`
- `@mui/material` - UI components
- `date-fns` - Date manipulation
- `chart.js`, `react-chartjs-2` - Charts

**Real-time**:
- WebSocket (native)
- `framer-motion` - Animations

### 15.2 Backend

**Core**:
- `fastapi` - Web framework
- `pydantic` - Data validation
- `sqlalchemy` - ORM
- `python-jose` - JWT
- `passlib` - Password hashing

---

## 16. Conclusion

### 16.1 Strengths

✅ **Well-designed architecture** with clear separation of concerns
✅ **Robust authentication** with JWT + HttpOnly cookies + CSRF
✅ **Custom hooks** abstract API complexity well
✅ **Real-time features** via WebSocket are comprehensive
✅ **Error handling** is centralized and consistent
✅ **Code splitting** reduces initial bundle size

### 16.2 Critical Gaps

❌ **Service method removal** broke component API calls
❌ **No data transformation** layer (snake_case ↔ camelCase)
❌ **Employee name structure** mismatch (name vs firstName/lastName)
❌ **Missing schedule methods** (updateShift, generateSchedule)
❌ **Analytics service** completely missing

### 16.3 Immediate Actions Required

1. **Update all components** to use axios instance directly OR restore service wrappers
2. **Add transformation layer** in axios response interceptor
3. **Implement missing schedule methods** in scheduleService
4. **Verify analytics endpoints** and create service methods
5. **Test data flow** end-to-end for each component

---

**Report Generated**: 2025-11-18
**Stored in Memory**: `swarm/analyzer/data-flow`
**Next Steps**: Address HIGH priority issues, then run integration tests
