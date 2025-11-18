# Migration Plan: Mocked Data to Real API Integration

## Overview
Comprehensive migration strategy to replace all mocked frontend data with real database-backed API calls.

## Migration Phases

### Phase 1: Database Setup (Week 1)
**Goal**: Establish complete database schema and seed data

#### Tasks
1. **Create Database Schema**
   - Execute complete schema from `/docs/architecture/database-schema.md`
   - Verify all constraints and indexes
   - Test foreign key relationships

2. **Create Seed Data Script**
   ```sql
   -- /backend/seeds/001_initial_data.sql

   -- Insert departments
   INSERT INTO departments (name, description, active) VALUES
     ('Customer Service', 'Customer support and relations', true),
     ('Operations', 'Daily operations management', true),
     ('Management', 'Executive management', true);

   -- Insert employees (with hashed passwords)
   INSERT INTO employees (email, password_hash, name, role, department_id, is_active) VALUES
     ('admin@example.com', '$2b$12$...', 'Admin User', 'admin', 3, true),
     ('manager@example.com', '$2b$12$...', 'Jane Manager', 'manager', 2, true),
     ('john.doe@example.com', '$2b$12$...', 'John Doe', 'employee', 1, true);

   -- Insert shifts
   INSERT INTO shifts (date, start_time, end_time, shift_type, department_id, required_staff) VALUES
     ('2025-01-27', '09:00', '17:00', 'general', 1, 2),
     ('2025-01-27', '17:00', '01:00', 'general', 1, 1);

   -- Insert schedules
   INSERT INTO schedules (week_start, week_end, title, status, created_by) VALUES
     ('2025-01-27', '2025-02-02', 'Week 5 Schedule', 'draft', 2);
   ```

3. **Run Migrations**
   ```bash
   cd backend
   python -m alembic upgrade head
   python -m seeds.run_seeds
   ```

4. **Verify Data Integrity**
   - Check all foreign key relationships
   - Verify constraints are working
   - Test queries for performance

**Success Criteria:**
- ✅ All tables created without errors
- ✅ Seed data inserted successfully
- ✅ All constraints functional
- ✅ Query performance acceptable (<100ms for simple queries)

### Phase 2: Backend API Implementation (Week 1-2)
**Goal**: Implement and test all REST API endpoints

#### Already Complete
Based on `/backend/src/main.py`, these endpoints exist:
- ✅ Authentication endpoints (JWT-based)
- ✅ Employee CRUD endpoints with pagination
- ✅ Schedule CRUD endpoints
- ✅ Notifications endpoints
- ✅ Rules endpoints with NLP parsing
- ✅ Schedule generation and optimization

#### Remaining Tasks
1. **Complete Missing Endpoints**
   - ✅ Shifts CRUD (check `/backend/src/api/shifts.py`)
   - ✅ Departments CRUD (check `/backend/src/api/departments.py`)
   - ✅ Assignments CRUD (check `/backend/src/api/assignments.py`)
   - ✅ Data import/export (check `/backend/src/api/data_io.py`)

2. **Add Response Transformations**
   - Ensure all responses use camelCase for frontend
   - Implement pagination metadata consistently
   - Add HATEOAS links where appropriate

3. **Error Handling**
   - Standardize error response format
   - Add validation error details
   - Implement proper HTTP status codes

4. **Testing**
   ```bash
   # Unit tests
   pytest backend/tests/unit/

   # Integration tests
   pytest backend/tests/integration/

   # API tests
   pytest backend/tests/api/
   ```

**Success Criteria:**
- ✅ All endpoints return 200-series responses for valid requests
- ✅ Proper error responses (400, 401, 403, 404, 409, 422)
- ✅ All tests passing (unit, integration, API)
- ✅ API documentation complete and accurate

### Phase 3: Frontend Service Layer (Week 2)
**Goal**: Replace mocked data with real API calls

#### Component Migration Order
**Priority 1 - Core Features:**
1. Authentication (Login/Register)
2. Employees Page
3. Dashboard (basic stats)

**Priority 2 - Scheduling:**
4. Schedules Page (calendar view)
5. Schedule Builder (wizard)
6. Shifts Management

**Priority 3 - Supporting Features:**
7. Departments
8. Rules
9. Notifications
10. Settings

#### Migration Process per Component

**1. Employees Page Migration**

Current state:
```javascript
// EmployeesPage.jsx - MOCKED
const [employees, setEmployees] = useState(mockEmployees);
```

Migration steps:
```javascript
// Step 1: Update imports
import api, { getErrorMessage } from '../services/api';

// Step 2: Replace state initialization
const [employees, setEmployees] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Step 3: Add data loading effect
useEffect(() => {
  loadEmployees();
}, []);

const loadEmployees = async () => {
  try {
    setLoading(true);
    const response = await api.get('/api/employees', {
      params: {
        page: 1,
        size: 100,
        active: true
      }
    });
    setEmployees(response.data.items);
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setLoading(false);
  }
};

// Step 4: Update CRUD operations
const handleCreateEmployee = async (employeeData) => {
  try {
    await api.post('/api/employees', employeeData);
    await loadEmployees(); // Refresh list
    setNotification({ type: 'success', message: 'Employee created' });
  } catch (error) {
    setNotification({ type: 'error', message: getErrorMessage(error) });
  }
};

// Step 5: Add loading and error UI
if (loading) return <CircularProgress />;
if (error) return <Alert severity="error">{error}</Alert>;
```

**2. Schedule Page Migration**

Current state:
```javascript
// SchedulePage.jsx - MOCKED
const [schedules, setSchedules] = useState(mockSchedules);
```

Migration steps:
```javascript
// Step 1: Load schedules with assignments
const loadSchedules = async () => {
  try {
    setLoading(true);
    const response = await api.get('/api/schedules', {
      params: {
        page: 1,
        size: 50,
        status: 'published'
      }
    });
    setSchedules(response.data.items);

    // Load first schedule's details
    if (response.data.items.length > 0) {
      const detailsResponse = await api.get(
        `/api/schedules/${response.data.items[0].id}`
      );
      setSelectedSchedule(detailsResponse.data);
    }
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setLoading(false);
  }
};

// Step 2: Update calendar events transformation
const calendarEvents = useMemo(() => {
  if (!selectedSchedule?.assignments) return [];

  return selectedSchedule.assignments.map(assignment => ({
    id: assignment.id,
    title: `${assignment.employee.name} - ${assignment.shift.shiftType}`,
    start: `${assignment.shift.date}T${assignment.shift.startTime}`,
    end: `${assignment.shift.date}T${assignment.shift.endTime}`,
    extendedProps: {
      employeeId: assignment.employeeId,
      employeeName: assignment.employee.name,
      shiftType: assignment.shift.shiftType,
      status: assignment.status
    }
  }));
}, [selectedSchedule]);
```

#### Testing Checklist per Component
- [ ] Data loads without errors
- [ ] Loading states display correctly
- [ ] Error states display user-friendly messages
- [ ] Create operations work and refresh data
- [ ] Update operations work and refresh data
- [ ] Delete operations work and refresh data
- [ ] Pagination works (if applicable)
- [ ] Filtering works (if applicable)
- [ ] Search works (if applicable)
- [ ] Navigation between pages maintains state

### Phase 4: State Management (Week 3)
**Goal**: Implement proper state management for shared data

#### Context Providers to Create
1. **AuthContext** (✅ Already exists)
2. **EmployeesContext**
3. **SchedulesContext**
4. **DepartmentsContext**
5. **NotificationsContext**

#### Example: EmployeesContext
```javascript
// /frontend/src/context/EmployeesContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import api, { getErrorMessage } from '../services/api';

const EmployeesContext = createContext();

export const EmployeesProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadEmployees = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/employees', { params });
      setEmployees(response.data.items);
      return response.data;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEmployee = useCallback(async (employeeData) => {
    const response = await api.post('/api/employees', employeeData);
    setEmployees(prev => [...prev, response.data]);
    return response.data;
  }, []);

  const updateEmployee = useCallback(async (id, updates) => {
    const response = await api.patch(`/api/employees/${id}`, updates);
    setEmployees(prev => prev.map(emp =>
      emp.id === id ? response.data : emp
    ));
    return response.data;
  }, []);

  const deleteEmployee = useCallback(async (id) => {
    await api.delete(`/api/employees/${id}`);
    setEmployees(prev => prev.filter(emp => emp.id !== id));
  }, []);

  const value = {
    employees,
    loading,
    error,
    loadEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee
  };

  return (
    <EmployeesContext.Provider value={value}>
      {children}
    </EmployeesContext.Provider>
  );
};

export const useEmployees = () => {
  const context = useContext(EmployeesContext);
  if (!context) {
    throw new Error('useEmployees must be used within EmployeesProvider');
  }
  return context;
};
```

#### Update App.jsx
```javascript
// /frontend/src/App.jsx
import { EmployeesProvider } from './context/EmployeesContext';
import { SchedulesProvider } from './context/SchedulesContext';
import { DepartmentsProvider } from './context/DepartmentsContext';

function App() {
  return (
    <AuthProvider>
      <DepartmentsProvider>
        <EmployeesProvider>
          <SchedulesProvider>
            <Router>
              {/* Routes */}
            </Router>
          </SchedulesProvider>
        </EmployeesProvider>
      </DepartmentsProvider>
    </AuthProvider>
  );
}
```

### Phase 5: Testing & Validation (Week 3-4)
**Goal**: Comprehensive testing of integrated system

#### Unit Tests
```javascript
// /frontend/src/services/__tests__/api.test.js
import api, { authService, getErrorMessage } from '../api';

describe('authService', () => {
  it('should login successfully', async () => {
    const response = await authService.login('test@example.com', 'password');
    expect(response.data.access_token).toBeDefined();
  });

  it('should handle login errors', async () => {
    try {
      await authService.login('invalid@example.com', 'wrong');
    } catch (error) {
      expect(getErrorMessage(error)).toBe('Invalid credentials');
    }
  });
});
```

#### Integration Tests
```javascript
// /frontend/src/__tests__/integration/EmployeesFlow.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeesProvider } from '../../context/EmployeesContext';
import EmployeesPage from '../../pages/EmployeesPage';

describe('Employees Flow', () => {
  it('should load and display employees', async () => {
    render(
      <EmployeesProvider>
        <EmployeesPage />
      </EmployeesProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should create new employee', async () => {
    render(
      <EmployeesProvider>
        <EmployeesPage />
      </EmployeesProvider>
    );

    userEvent.click(screen.getByText('Add Employee'));
    userEvent.type(screen.getByLabelText('Name'), 'Jane Smith');
    userEvent.type(screen.getByLabelText('Email'), 'jane@example.com');
    userEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });
});
```

#### End-to-End Tests
```javascript
// /frontend/cypress/e2e/employees.cy.js
describe('Employee Management', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password');
    cy.visit('/employees');
  });

  it('should display employees list', () => {
    cy.get('[data-testid="employee-card"]').should('have.length.greaterThan', 0);
  });

  it('should create new employee', () => {
    cy.get('[data-testid="add-employee-btn"]').click();
    cy.get('input[name="name"]').type('New Employee');
    cy.get('input[name="email"]').type('new@example.com');
    cy.get('button[type="submit"]').click();

    cy.contains('Employee created successfully').should('be.visible');
    cy.contains('New Employee').should('be.visible');
  });
});
```

### Phase 6: Performance Optimization (Week 4)
**Goal**: Optimize API calls and reduce bundle size

#### Optimization Tasks
1. **Code Splitting**
   ```javascript
   // Lazy load routes
   const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
   const SchedulePage = lazy(() => import('./pages/SchedulePage'));
   ```

2. **Request Caching**
   - Implement in-memory cache for reference data (departments, roles)
   - Cache user settings in localStorage
   - Use React Query for advanced caching

3. **Request Batching**
   ```javascript
   // Batch multiple requests
   const [employees, departments, shifts] = await Promise.all([
     api.get('/api/employees'),
     api.get('/api/departments'),
     api.get('/api/shifts')
   ]);
   ```

4. **Pagination**
   - Implement virtual scrolling for large lists
   - Use cursor-based pagination for better performance

5. **Debouncing**
   ```javascript
   const debouncedSearch = useMemo(
     () => debounce((term) => {
       api.get('/api/employees', { params: { search: term } });
     }, 300),
     []
   );
   ```

### Phase 7: Deployment & Monitoring (Week 4)
**Goal**: Deploy to production and monitor

#### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] All environment variables configured
- [ ] Database migrations ready
- [ ] Backup strategy in place
- [ ] Monitoring tools configured

#### Deployment Steps
1. **Database Migration**
   ```bash
   # Backup production database
   pg_dump -h $DB_HOST -U $DB_USER -d schedule_manager > backup.sql

   # Run migrations
   python -m alembic upgrade head
   ```

2. **Backend Deployment**
   ```bash
   # Build Docker image
   docker build -t ai-schedule-manager-backend .

   # Deploy
   docker-compose up -d backend
   ```

3. **Frontend Deployment**
   ```bash
   # Build production bundle
   npm run build

   # Deploy static files
   docker-compose up -d frontend
   ```

4. **Smoke Tests**
   - Test login
   - Test data loading
   - Test CRUD operations
   - Check error handling

#### Monitoring
1. **Backend Monitoring**
   - API response times
   - Error rates
   - Database query performance
   - Memory/CPU usage

2. **Frontend Monitoring**
   - Page load times
   - API call latency
   - JavaScript errors
   - User interactions

## Rollback Plan

### If Migration Fails
1. **Restore Database Backup**
   ```bash
   psql -h $DB_HOST -U $DB_USER -d schedule_manager < backup.sql
   ```

2. **Revert Backend Code**
   ```bash
   git revert <migration-commit>
   docker-compose up -d backend
   ```

3. **Revert Frontend Code**
   - Re-enable mocked data
   - Comment out API calls
   - Redeploy frontend

## Success Metrics

### Performance Metrics
- API response time: <200ms for 95th percentile
- Page load time: <3 seconds
- Time to interactive: <5 seconds

### Reliability Metrics
- Uptime: >99.9%
- Error rate: <1%
- Failed requests: <0.1%

### User Experience Metrics
- Login success rate: >95%
- Data load success rate: >99%
- Form submission success rate: >95%

## Post-Migration Tasks

### Week 5+
1. **Monitor & Optimize**
   - Review error logs daily
   - Optimize slow queries
   - Address user feedback

2. **Documentation**
   - Update user guide
   - Create admin documentation
   - Document API changes

3. **Training**
   - Train users on new features
   - Document common issues
   - Create FAQ

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Database | Week 1 | Schema, seed data |
| Phase 2: Backend API | Week 1-2 | Complete API endpoints |
| Phase 3: Frontend | Week 2 | Component migration |
| Phase 4: State Mgmt | Week 3 | Context providers |
| Phase 5: Testing | Week 3-4 | Comprehensive tests |
| Phase 6: Optimization | Week 4 | Performance improvements |
| Phase 7: Deployment | Week 4 | Production deployment |

**Total Estimated Duration: 4 weeks**
