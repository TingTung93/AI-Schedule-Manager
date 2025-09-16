# API Changelog

All notable changes to the AI Schedule Manager API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Advanced analytics dashboard endpoints
- Bulk employee import/export functionality
- Schedule template system
- Advanced notification preferences

### Changed
- Improved natural language processing accuracy
- Enhanced schedule optimization algorithms
- Better error messages and validation

### Deprecated
- Legacy authentication endpoints (will be removed in v2.0.0)

## [1.0.0] - 2024-01-15

### Added
- Initial stable release
- Complete CRUD operations for employees, schedules, rules, and notifications
- JWT-based authentication with refresh tokens
- Role-based access control (Manager/Employee)
- Natural language rule parsing using NLP
- AI-powered schedule generation and optimization
- Real-time WebSocket notifications
- Comprehensive pagination and filtering
- Rate limiting and security features
- OpenAPI 3.0 specification
- Interactive Swagger UI documentation

### Security
- Implemented account lockout after failed login attempts
- Added CSRF protection for state-changing operations
- Audit logging for all security events
- Secure HTTP-only cookie handling for refresh tokens

## [0.9.0] - 2024-01-08

### Added
- Schedule optimization endpoint
- Enhanced employee availability patterns
- Notification priority levels
- Analytics overview endpoint

### Changed
- Improved error handling and response formats
- Better validation for employee and schedule data
- Enhanced natural language rule parsing

### Fixed
- Fixed timezone handling in schedule generation
- Resolved pagination issues with large datasets
- Fixed WebSocket connection stability

## [0.8.0] - 2024-01-01

### Added
- WebSocket support for real-time notifications
- Natural language rule parsing
- Advanced filtering options for all list endpoints
- Employee schedule history endpoint

### Changed
- Updated authentication flow to use JWT tokens
- Improved API response consistency
- Enhanced validation error messages

### Removed
- Deprecated session-based authentication

## [0.7.0] - 2023-12-15

### Added
- AI-powered schedule generation
- Employee qualification tracking
- Shift template system
- Basic analytics endpoints

### Changed
- Refactored database schema for better performance
- Improved schedule conflict resolution
- Enhanced employee availability handling

## [0.6.0] - 2023-12-01

### Added
- Complete employee CRUD operations
- Schedule management endpoints
- Basic rule system
- Notification system

### Changed
- Switched to FastAPI framework
- Improved API documentation
- Better error handling

## [0.5.0] - 2023-11-15

### Added
- Initial API framework
- Basic authentication
- Employee and schedule models
- Database integration

---

## Migration Guides

### Migrating from v0.9.x to v1.0.0

#### Breaking Changes

1. **Authentication Headers**
   ```diff
   - X-Auth-Token: <token>
   + Authorization: Bearer <jwt_token>
   ```

2. **Error Response Format**
   ```diff
   - { "error": "message" }
   + { "detail": "message" }
   ```

3. **Pagination Response**
   ```diff
   - { "data": [...], "count": 100 }
   + { "items": [...], "total": 100, "page": 1, "size": 10, "pages": 10 }
   ```

#### New Features

- WebSocket support at `/ws` endpoint
- Natural language rule parsing at `/api/rules/parse`
- Enhanced analytics at `/api/analytics/overview`

### Migrating from v0.8.x to v0.9.0

#### Authentication Changes

The API now uses JWT tokens instead of session cookies:

1. **Login Request** (unchanged)
   ```bash
   POST /api/auth/login
   ```

2. **Token Usage** (new)
   ```bash
   Authorization: Bearer <access_token>
   ```

3. **Token Refresh** (new)
   ```bash
   POST /api/auth/refresh
   ```

---

## Versioning Policy

### API Versioning

The AI Schedule Manager API follows semantic versioning:

- **Major version** (X.0.0): Breaking changes to existing endpoints
- **Minor version** (0.X.0): New features, backward compatible
- **Patch version** (0.0.X): Bug fixes, backward compatible

### Version Support

- **Current stable**: v1.0.0 (full support)
- **Previous major**: v0.9.x (security fixes only until 2024-07-15)
- **Deprecated**: v0.8.x and earlier (no support)

### Deprecation Timeline

When features are deprecated:

1. **Announcement**: 6 months before removal
2. **Warning headers**: Added to deprecated endpoints
3. **Documentation**: Updated with migration guides
4. **Removal**: In next major version

---

## Endpoint Changes

### Added Endpoints

#### v1.0.0
- `POST /api/rules/parse` - Natural language rule parsing
- `POST /api/schedule/optimize` - Schedule optimization
- `GET /api/analytics/overview` - Analytics dashboard
- `WebSocket /ws` - Real-time notifications

#### v0.9.0
- `GET /api/employees/{id}/schedule` - Employee schedule history
- `POST /api/notifications/mark-all-read` - Bulk notification management

### Modified Endpoints

#### v1.0.0
- `GET /api/employees` - Added advanced filtering options
- `GET /api/schedules` - Enhanced with relationship data
- `POST /api/auth/login` - Returns JWT tokens instead of cookies

#### v0.9.0
- `GET /api/notifications` - Added priority and type filtering
- `POST /api/schedule/generate` - Improved constraint handling

### Deprecated Endpoints

#### Will be removed in v2.0.0
- `POST /api/auth/login-session` - Use `/api/auth/login` instead
- `GET /api/legacy/employees` - Use `/api/employees` instead

---

## Data Model Changes

### v1.0.0

#### Employee Model
```diff
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "server",
+   "qualifications": ["food_safety", "cash_handling"],
+   "availability_pattern": {"monday": ["09:00-17:00"]},
+   "max_hours_per_week": 40,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
```

#### Schedule Model
```diff
  {
    "id": 1,
    "employee_id": 1,
    "shift_id": 1,
    "date": "2024-01-15",
    "status": "scheduled",
+   "notes": "Optional notes",
+   "overtime_approved": false,
+   "employee": { ... },
+   "shift": { ... }
  }
```

### v0.9.0

#### Notification Model
```diff
  {
    "id": 1,
    "title": "Schedule Updated",
    "message": "Your schedule has been updated",
+   "priority": "normal",
+   "notification_type": "schedule",
+   "metadata": { "schedule_id": 123 },
    "read": false,
    "created_at": "2024-01-15T10:00:00Z"
  }
```

---

## Performance Improvements

### v1.0.0
- **Database optimization**: 40% faster query performance
- **Caching layer**: Redis integration for frequently accessed data
- **Pagination**: Efficient cursor-based pagination for large datasets
- **WebSocket**: Reduced polling with real-time updates

### v0.9.0
- **API response time**: 25% improvement in average response time
- **Schedule generation**: 60% faster AI-powered optimization
- **Bulk operations**: Support for batch employee operations

---

## Security Updates

### v1.0.0
- **JWT tokens**: More secure than session cookies
- **Rate limiting**: Configurable limits per endpoint
- **Audit logging**: Comprehensive security event tracking
- **CSRF protection**: Built-in CSRF token validation
- **Account lockout**: Automatic protection against brute force

### v0.9.0
- **Password policies**: Enforced strong password requirements
- **Session security**: Improved session management
- **Input validation**: Enhanced sanitization and validation

---

## Bug Fixes

### v1.0.0
- Fixed timezone inconsistencies in schedule generation
- Resolved memory leaks in WebSocket connections
- Fixed pagination edge cases with filtered results
- Corrected schedule conflict detection algorithm

### v0.9.0
- Fixed employee availability validation
- Resolved notification delivery issues
- Fixed schedule optimization edge cases
- Corrected date range validation

---

## Known Issues

### Current Issues (v1.0.0)
- WebSocket connections may timeout after 1 hour of inactivity (will be extended in v1.0.1)
- Large schedule generations (>1000 shifts) may take longer than expected
- Some complex natural language rules may not parse correctly

### Workarounds
- **WebSocket timeout**: Implement periodic ping to keep connection alive
- **Large schedules**: Use smaller date ranges or break into weekly segments
- **Rule parsing**: Use structured rule format for complex constraints

---

## Upcoming Features

### v1.1.0 (Q2 2024)
- Mobile push notifications
- Advanced reporting and analytics
- Schedule template library
- Multi-location support
- Time clock integration

### v1.2.0 (Q3 2024)
- Machine learning-based demand forecasting
- Advanced conflict resolution
- Custom notification channels
- API webhooks

### v2.0.0 (Q4 2024)
- GraphQL API support
- Multi-tenant architecture
- Advanced AI features
- Enhanced security model

---

## Support and Documentation

- **API Documentation**: [docs.ai-schedule-manager.com](https://docs.ai-schedule-manager.com)
- **Interactive API**: [localhost:8000/docs](http://localhost:8000/docs)
- **Support**: [support@ai-schedule-manager.com](mailto:support@ai-schedule-manager.com)
- **Status Page**: [status.ai-schedule-manager.com](https://status.ai-schedule-manager.com)

## Contributing

We welcome feedback and contributions to improve the API. Please see our [contribution guidelines](https://github.com/ai-schedule-manager/api/blob/main/CONTRIBUTING.md) for more information.