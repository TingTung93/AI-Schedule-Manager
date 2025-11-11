# API Services Tests

## Current Status

- **api-services-remaining.test.js** - Active test file for services that still exist after KISS refactoring
- **api.test.js.deprecated** - Old comprehensive test file (NEEDS UPDATE)

## Services Removed During KISS Refactoring

The following services were removed and now use axios directly:
- `employeeService` - Use `api.get('/api/employees')` instead
- `ruleService` - Use `api.post('/api/rules/parse', data)` instead
- `shiftService` - Use `api.get('/api/shifts')` instead

## Services Still Active

These services are still in use and have authentication/business logic:
- `authService` - Authentication and session management
- `scheduleService` - Schedule operations with auth
- `analyticsService` - Analytics data retrieval
- `notificationService` - Notification management

## TODO

The `api.test.js.deprecated` file contains comprehensive tests for all services (including deleted ones). It should be:
1. Split into separate test files per service
2. Tests for deleted services should be converted to test direct axios calls
3. Tests for remaining services should be kept and updated

For now, use `api-services-remaining.test.js` for active service testing.
