# Architecture Documentation

## Overview
Complete architectural design for replacing mocked data with real CRUD operations and API integration in the AI Schedule Manager application.

## Documents

### 1. Database Schema (`database-schema.md`)
Complete PostgreSQL database design with:
- **8 Core Tables**: employees, departments, schedules, shifts, schedule_assignments, rules, notifications, user_settings
- **Relationships**: One-to-many, many-to-many, self-referential
- **Constraints**: Foreign keys, check constraints, unique constraints
- **Indexes**: B-tree, GIN (JSONB), composite indexes
- **Audit Fields**: created_at, updated_at, soft delete support

**Key Features:**
- Hierarchical department structure
- Schedule versioning and approval workflow
- Employee availability tracking (JSONB)
- Shift requirements and qualifications
- Conflict detection via unique constraints
- Performance-optimized indexes

### 2. API Endpoints (`api-endpoints.md`)
RESTful API design with:
- **Authentication**: JWT-based with refresh tokens
- **CRUD Operations**: Full create, read, update, delete for all entities
- **Pagination**: Consistent pagination with page, size, total, pages
- **Filtering**: Query parameters for all list endpoints
- **Sorting**: Configurable sort_by and sort_order
- **Error Handling**: Standard error response format

**Endpoint Categories:**
- Authentication: /api/auth/*
- Employees: /api/employees/*
- Schedules: /api/schedules/*
- Shifts: /api/shifts/*
- Departments: /api/departments/*
- Schedule Generation: /api/schedule/generate
- Rules: /api/rules/*
- Notifications: /api/notifications/*
- Data I/O: /api/data/import, /api/data/export

### 3. Frontend Service Layer (`frontend-service-layer.md`)
Clean architecture for frontend API integration:
- **Axios Configuration**: Centralized HTTP client with interceptors
- **Authentication Service**: Login, logout, token refresh, session management
- **Direct API Usage**: KISS principle - use axios directly, avoid unnecessary wrappers
- **Custom Hooks**: useAsyncData, useApi for reusable patterns
- **Context API**: State management for shared data
- **Caching**: In-memory and localStorage caching strategies
- **Error Handling**: Comprehensive error extraction and user-friendly messages

**Key Patterns:**
```javascript
// Direct usage (recommended)
const response = await api.get('/api/employees');

// Custom hooks
const { data, loading, error, refetch } = useAsyncData(
  () => api.get('/api/employees'),
  []
);

// Context providers
const { employees, loadEmployees, createEmployee } = useEmployees();
```

### 4. Migration Plan (`migration-plan.md`)
4-week migration strategy with 7 phases:
- **Phase 1**: Database setup and seed data
- **Phase 2**: Backend API implementation
- **Phase 3**: Frontend component migration
- **Phase 4**: State management with Context API
- **Phase 5**: Testing (unit, integration, e2e)
- **Phase 6**: Performance optimization
- **Phase 7**: Deployment and monitoring

**Migration Order:**
1. Authentication (Login/Register)
2. Employees Page
3. Dashboard
4. Schedules Page
5. Schedule Builder
6. Shifts Management
7. Departments
8. Rules
9. Notifications
10. Settings

**Testing Strategy:**
- Unit tests for services and utilities
- Integration tests for component flows
- E2E tests with Cypress
- Performance benchmarks

### 5. Error Handling Strategy (`error-handling-strategy.md`)
Comprehensive error handling across all layers:
- **Backend Error Format**: Standardized JSON responses
- **HTTP Status Codes**: Proper use of 400, 401, 403, 404, 409, 422, 429, 500
- **Frontend Error Interceptor**: Automatic token refresh, error translation
- **Error Boundaries**: React error boundaries for component crashes
- **User Notifications**: Toast notifications for all operations
- **Recovery Strategies**: Retry with backoff, circuit breaker pattern

**Error Types:**
- Client errors (4xx): User or request issues
- Server errors (5xx): Backend issues
- Network errors: Connection problems
- Validation errors: Data format violations
- Authentication errors: Login and permission issues

### 6. Data Flow Diagrams (`data-flow-diagrams.md`)
Visual representation of data flow:
- **System Architecture**: Complete stack from browser to database
- **Authentication Flow**: Login and token refresh
- **Employee Management**: Load, create, update, delete
- **Schedule Management**: Complex schedule generation flow
- **Error Handling**: Error recovery with user feedback

## Architecture Decision Records

### ADR-001: Direct Axios Usage Over Service Wrappers
**Decision**: Use axios instance directly instead of creating service wrapper functions for each endpoint.

**Rationale:**
- Reduces code duplication (373 lines removed)
- Follows KISS and DRY principles
- Easier to maintain and understand
- Axios already provides all needed functionality

**Exceptions:**
- authService: Complex authentication logic
- scheduleService: Multi-step operations
- Complex business logic requiring coordination

### ADR-002: Context API Over Redux
**Decision**: Use React Context API for state management instead of Redux.

**Rationale:**
- Simpler for medium-sized applications
- Less boilerplate code
- Built-in to React
- Sufficient for our use case
- Can upgrade to Redux if needed

### ADR-003: JWT with Refresh Tokens
**Decision**: Use JWT access tokens (short-lived) with refresh tokens (long-lived, HttpOnly cookies).

**Rationale:**
- Secure: Refresh token in HttpOnly cookie prevents XSS
- Stateless: Access token can be validated without database
- Performance: No database lookup on every request
- Industry standard: Well-understood pattern

### ADR-004: PostgreSQL Over NoSQL
**Decision**: Use PostgreSQL as primary database.

**Rationale:**
- Strong relational data (employees, schedules, shifts)
- ACID compliance needed for scheduling
- Complex queries (conflict detection, optimization)
- JSONB support for flexible fields
- Proven reliability and performance

### ADR-005: Optimistic Updates
**Decision**: Update UI immediately, rollback on error.

**Rationale:**
- Better perceived performance
- Improved user experience
- Rare errors in practice
- Easy rollback on failure
- Industry best practice

## System Requirements

### Backend Requirements
- Python 3.9+
- FastAPI
- SQLAlchemy 2.0+
- PostgreSQL 12+
- Redis (for token management)
- OR-Tools (for constraint solving)

### Frontend Requirements
- React 18+
- Material-UI 5+
- Axios
- FullCalendar
- React Router 6+

### Infrastructure Requirements
- Docker & Docker Compose
- Nginx (reverse proxy)
- SSL/TLS certificates
- Monitoring tools (optional: Sentry, LogRocket)

## Performance Targets

### API Performance
- Response time: <200ms (95th percentile)
- Database query time: <100ms
- Concurrent users: 100+
- Requests per second: 1000+

### Frontend Performance
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s
- Page load time: <3s

### Reliability
- Uptime: >99.9%
- Error rate: <1%
- Data loss: 0%

## Security Considerations

### Authentication & Authorization
- JWT tokens with secure signing
- HttpOnly cookies for refresh tokens
- CSRF protection
- Rate limiting (100 req/hr anonymous, 1000 req/hr authenticated)
- Password hashing with bcrypt

### Data Protection
- SQL injection prevention (parameterized queries)
- XSS prevention (React escaping, CSP headers)
- CORS configuration
- Input validation
- Output encoding

### Database Security
- Row-level security (future enhancement)
- Encrypted connections
- Regular backups
- Audit logging

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                 Load Balancer                    │
│                   (Nginx)                        │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼──────┐       ┌────────▼────────┐
│   Frontend   │       │    Backend      │
│  (React App) │       │  (FastAPI)      │
│   Docker     │       │   Docker        │
└──────────────┘       └────────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼──────┐       ┌────────▼────────┐
            │  PostgreSQL  │       │     Redis       │
            │   Database   │       │     Cache       │
            │   Docker     │       │    Docker       │
            └──────────────┘       └─────────────────┘
```

## Next Steps

### Immediate Actions (Week 1)
1. Review architecture documents
2. Set up development database
3. Run database migrations
4. Seed test data
5. Test API endpoints

### Short-term (Week 2-4)
1. Migrate frontend components
2. Implement state management
3. Write tests
4. Optimize performance
5. Deploy to staging

### Long-term (Month 2+)
1. Monitor production metrics
2. Gather user feedback
3. Optimize based on usage patterns
4. Add advanced features
5. Scale infrastructure

## Support and Resources

### Documentation
- API Documentation: `/docs` (Swagger UI)
- Database Schema: This document
- Error Codes: `error-handling-strategy.md`

### Development
- Backend: `/backend/README.md`
- Frontend: `/frontend/README.md`
- Testing: `/tests/README.md`

### Contact
- Architecture Questions: See project CLAUDE.md
- Bug Reports: GitHub Issues
- Feature Requests: GitHub Discussions

## Changelog

### 2025-11-18 - Initial Architecture Design
- Created comprehensive database schema
- Designed RESTful API endpoints
- Documented frontend service layer
- Developed 4-week migration plan
- Defined error handling strategy
- Created data flow diagrams
