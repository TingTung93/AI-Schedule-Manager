# Frontend-Backend Integration Guide

## Overview
This guide documents the complete integration between the React frontend and FastAPI backend for the AI Schedule Manager application.

## Architecture

### Backend (FastAPI)
- **Port**: 8000
- **Base URL**: http://localhost:8000
- **API Prefix**: /api
- **Technology**: Python 3.x with FastAPI framework

### Frontend (React)
- **Port**: 3000
- **Base URL**: http://localhost:3000
- **Technology**: React 18.x with Material-UI

## API Integration

### Service Layer (`frontend/src/services/api.js`)
The frontend uses a centralized API service with the following features:
- Axios-based HTTP client
- Automatic token injection
- Request/response interceptors
- Error handling
- Auto-redirect on 401 errors

### Available Services

#### Authentication Service
```javascript
authService.login(email, password)
authService.logout()
authService.getCurrentUser()
authService.isAuthenticated()
```

#### Rule Service
```javascript
ruleService.parseRule(ruleText)
ruleService.getRules()
ruleService.deleteRule(ruleId)
ruleService.updateRule(ruleId, updates)
```

#### Schedule Service
```javascript
scheduleService.generateSchedule(startDate, endDate)
scheduleService.optimizeSchedule(scheduleId)
scheduleService.getSchedule(scheduleId)
scheduleService.getSchedules()
scheduleService.updateShift(scheduleId, shiftId, updates)
```

#### Employee Service
```javascript
employeeService.getEmployees()
employeeService.createEmployee(employee)
employeeService.updateEmployee(employeeId, updates)
employeeService.deleteEmployee(employeeId)
employeeService.getEmployeeSchedule(employeeId, startDate, endDate)
```

#### Analytics Service
```javascript
analyticsService.getOverview()
analyticsService.getLaborCosts(period)
analyticsService.getOptimizationMetrics()
analyticsService.getEmployeeMetrics(employeeId)
```

#### Notification Service
```javascript
notificationService.getNotifications()
notificationService.markAsRead(notificationId)
notificationService.markAllAsRead()
notificationService.deleteNotification(notificationId)
```

## Custom Hooks

### useApi Hook
For fetching data with automatic loading and error states:
```javascript
const { data, loading, error, refetch } = useApi(
  () => ruleService.getRules(),
  [], // dependencies
  { onSuccess, onError, retryCount: 3 }
);
```

### useApiMutation Hook
For POST/PUT/DELETE operations:
```javascript
const { mutate, data, loading, error } = useApiMutation(
  ruleService.parseRule,
  { onSuccess, onError }
);

// Usage
await mutate(ruleText);
```

### usePaginatedApi Hook
For paginated data fetching:
```javascript
const { data, page, hasMore, loadMore } = usePaginatedApi(
  apiCall,
  { pageSize: 10 }
);
```

### useRealTimeApi Hook
For polling and real-time updates:
```javascript
const { data, isPolling, startPolling, stopPolling } = useRealTimeApi(
  apiCall,
  5000 // polling interval
);
```

## CORS Configuration

The backend is configured to accept requests from:
- http://localhost:3000 (development frontend)
- http://localhost:3001 (alternative port)

CORS settings in `backend/src/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Environment Variables

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:8000
```

### Backend
No environment variables required for basic setup.

## Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Backend returns JWT token and user data
3. Frontend stores token in localStorage
4. Token is automatically included in all subsequent requests
5. On 401 response, user is redirected to login

## Testing

### Unit Tests
```bash
# Backend
cd backend && python -m pytest tests/

# Frontend
cd frontend && npm test
```

### Integration Tests
```bash
# Run the complete integration test suite
./test-integration.sh
```

### E2E Tests
```bash
# Run Playwright E2E tests
npx playwright test e2e-tests/
```

## Error Handling

### Frontend Error Handling
- API errors are caught and displayed to users
- Loading states prevent duplicate requests
- Automatic retry with exponential backoff
- User-friendly error messages

### Backend Error Handling
- FastAPI exception handlers
- Structured error responses
- Proper HTTP status codes
- Detailed error messages for debugging

## Development Workflow

1. **Start Backend**:
   ```bash
   cd backend
   python src/main.py
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm start
   ```

3. **Run Tests**:
   ```bash
   ./test-integration.sh
   ```

## API Endpoints

### Health Check
- **GET** `/health` - Service health status

### Authentication
- **POST** `/api/auth/login` - User login

### Rules
- **POST** `/api/rules/parse` - Parse natural language rule
- **GET** `/api/rules` - Get all rules
- **DELETE** `/api/rules/{id}` - Delete a rule
- **PATCH** `/api/rules/{id}` - Update a rule

### Schedule
- **POST** `/api/schedule/generate` - Generate new schedule
- **POST** `/api/schedule/optimize` - Optimize existing schedule
- **GET** `/api/schedule/{id}` - Get specific schedule
- **GET** `/api/schedules` - Get all schedules
- **PATCH** `/api/schedule/{id}/shift/{shiftId}` - Update shift

### Employees
- **GET** `/api/employees` - Get all employees
- **POST** `/api/employees` - Create employee
- **PATCH** `/api/employees/{id}` - Update employee
- **DELETE** `/api/employees/{id}` - Delete employee
- **GET** `/api/employees/{id}/schedule` - Get employee schedule

### Analytics
- **GET** `/api/analytics/overview` - System overview
- **GET** `/api/analytics/labor-costs` - Labor cost analysis
- **GET** `/api/analytics/optimization` - Optimization metrics
- **GET** `/api/analytics/employee/{id}` - Employee metrics

### Notifications
- **GET** `/api/notifications` - Get all notifications
- **PATCH** `/api/notifications/{id}/read` - Mark as read
- **POST** `/api/notifications/read-all` - Mark all as read
- **DELETE** `/api/notifications/{id}` - Delete notification

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend is running on port 8000
   - Check CORS middleware configuration
   - Verify frontend proxy setting in package.json

2. **Authentication Failures**
   - Clear localStorage
   - Check token expiration
   - Verify backend is running

3. **API Connection Issues**
   - Check backend server is running
   - Verify port numbers
   - Check network/firewall settings

4. **Test Failures**
   - Install all dependencies
   - Ensure both services are running
   - Check port availability

## Performance Optimization

- API response caching
- Debounced search inputs
- Lazy loading for large datasets
- Optimistic UI updates
- Request batching where possible

## Security Considerations

- JWT tokens for authentication
- HTTPS in production
- Input validation on both frontend and backend
- SQL injection prevention
- XSS protection through React
- CSRF protection via tokens

## Deployment Checklist

- [ ] Update CORS origins for production URLs
- [ ] Configure environment variables
- [ ] Set up HTTPS certificates
- [ ] Configure production database
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Set up backup strategy
- [ ] Document API for external consumers