# E2E Test Inventory
**AI Schedule Manager - Complete Test Catalog**

## Overview
- **Total Test Files**: 19
- **Total Test Cases**: 190+
- **Test Framework**: Playwright 1.54.2
- **Languages**: TypeScript, JavaScript

## Test Files by Category

### 1. Authentication & Security (5 files, 60+ tests)

#### `/e2e-tests/auth.spec.ts` (8 tests)
- ✓ Display login page
- ✓ Show validation errors for empty form
- ✓ Show password toggle button
- ✓ Navigate to register page
- ✓ Display registration form
- ✓ Show password requirements
- ✓ Validate password match

#### `/e2e-tests/tests/01-authentication.spec.ts` (9 tests)
- Display login form
- Login with valid credentials
- Show error with invalid credentials
- Validate email format
- Require password
- Logout successfully
- Handle session timeout
- Support remember me option

#### `/e2e-tests/tests/authentication.spec.js` (37 tests)
**Login Flow** (7 tests):
- Login successfully with valid credentials
- Show error with invalid credentials
- Validate required fields
- Handle network errors gracefully
- Remember login state across sessions
- Support keyboard navigation

**Logout Flow** (3 tests):
- Logout successfully
- Clear authentication state on logout
- Handle logout errors gracefully

**Protected Routes** (3 tests):
- Allow authenticated users to access protected routes
- Redirect unauthenticated users to login
- Handle expired tokens

**Role-Based Access** (3 tests):
- Display manager features for manager role
- Hide admin features for employee role
- Prevent unauthorized access to admin pages

**Security Features** (4 tests):
- Enforce rate limiting on login attempts
- Clear sensitive data on browser close
- Handle CSRF protection
- Enforce secure password requirements

**Accessibility** (3 tests):
- Accessible to screen readers
- Support high contrast mode
- Work with keyboard navigation only

**Mobile Authentication** (2 tests):
- Work on mobile devices
- Handle touch interactions

**Performance** (2 tests):
- Load login page quickly
- Handle login process efficiently

#### `/e2e-tests/tests/demo-login.spec.ts` (3 tests)
- Login with demo account and display dashboard
- Have proper page title
- Display login form elements OR dashboard if logged in

#### `/e2e-tests/tests/dashboard-debug.spec.ts` (1 test)
- Capture console errors and page state

### 2. Rule Management (1 file, 13 tests)

#### `/e2e-tests/tests/02-rule-management.spec.ts` (13 tests)
- Display rule creation interface
- Parse and add availability rule
- Parse and add preference rule
- Parse and add requirement rule
- Handle multiple rules
- Toggle rule active status
- Delete rule
- Validate rule syntax
- Show rule preview before adding
- Handle rule conflicts
- Search and filter rules
- Export rules
- Import rules from file

### 3. Schedule Generation (1 file, 12 tests)

#### `/e2e-tests/tests/03-schedule-generation.spec.ts` (12 tests)
- Display schedule generation interface
- Generate weekly schedule
- Respect rules when generating schedule
- Handle schedule conflicts
- Allow manual schedule adjustments
- Validate schedule completeness
- Calculate labor costs
- Export schedule to different formats
- Publish schedule to employees
- Show schedule history
- Copy from previous schedule
- Handle recurring schedules

### 4. AI Optimization (1 file, 11 tests)

#### `/e2e-tests/tests/04-ai-optimization.spec.ts` (11 tests)
- Display AI optimization options
- Optimize for minimal labor costs
- Balance employee workload
- Respect employee preferences
- Show optimization progress
- Provide optimization recommendations
- Detect and resolve conflicts
- Predict staffing needs
- Learn from historical data
- Compare multiple optimization strategies
- Export optimization report

### 5. Calendar Integration (1 file, 12 tests)

#### `/e2e-tests/tests/05-calendar-integration.spec.ts` (12 tests)
- Display calendar view
- Switch between calendar views
- Navigate between dates
- Display employee shifts on calendar
- Show shift details on click
- Request shift swap
- Request time off
- Sync with external calendars
- Show availability overview
- Filter calendar by shift type
- Print calendar
- Show notifications for schedule changes
- Integrate with team calendar (Note: 13 test descriptions for 12 tests)

### 6. Notification System (1 file, 12 tests)

#### `/e2e-tests/tests/06-notifications.spec.ts` (12 tests)
- Display notification center
- Show different notification types
- Receive real-time notifications
- Mark notifications as read
- Mark all as read
- Delete notifications
- Configure notification preferences
- Handle notification actions
- Show notification history
- Support email notifications
- Handle push notifications
- Group similar notifications

### 7. Navigation (3 files, 15+ tests)

#### `/e2e-tests/navigation.spec.ts` (3 tests)
- Navigate through main pages
- Display responsive navigation
- Display 404 page for invalid routes

#### `/e2e-tests/tests/navigation-flow.spec.ts` (7 tests)
**Application Navigation** (5 tests):
- Navigation Map: Discover all accessible routes
- Deep Navigation: Dashboard → All Sections
- User Flow: Complete journey through main features
- Back/Forward Navigation: Browser history
- Search and Filter: Test search functionality if available
- Mobile Navigation: Test mobile menu and navigation

**Protected Routes & Permissions** (1 test):
- Protected Routes: Test authentication redirects

#### `/e2e-tests/tests/user-workflows.spec.ts` (8 tests)
**User Workflows** (7 tests):
- Complete workflow: Login → Dashboard → Navigation
- Navigation: Test all main navigation links
- User Journey: View and explore dashboard components
- Responsiveness: Test mobile and tablet viewports
- Performance: Measure page load times
- Accessibility: Check basic accessibility features
- Error Handling: Test navigation to non-existent pages

**Quick Action Workflows** (1 test):
- Quick Actions: Test clickable elements on dashboard

### 8. Schedule Workflows (1 file, 27 tests)

#### `/e2e-tests/tests/schedule-workflow.spec.js` (27 tests)
**Schedule Creation** (4 tests):
- Create a new schedule successfully
- Handle schedule generation with constraints
- Validate schedule parameters
- Handle generation failures gracefully

**Schedule Viewing and Navigation** (4 tests):
- Display schedule in calendar view
- Switch between calendar views
- Navigate between time periods
- Show shift details on click

**Schedule Editing** (5 tests):
- Edit shift details
- Reassign employees to shifts
- Delete shifts
- Add new shifts
- Handle drag and drop shift rescheduling

**Schedule Optimization** (4 tests):
- Optimize schedule for cost savings
- Optimize for employee satisfaction
- Show before/after comparison
- Allow rejecting optimization results

**Schedule Publishing and Sharing** (3 tests):
- Publish schedule to employees
- Export schedule in different formats
- Send schedule notifications

**Schedule Analytics and Reporting** (2 tests):
- Display schedule analytics
- Generate schedule reports

**Error Handling and Edge Cases** (3 tests):
- Handle network failures during schedule operations
- Handle concurrent schedule modifications
- Handle insufficient employee coverage

### 9. Integration Tests (2 files, 25+ tests)

#### `/e2e-tests/integration.spec.ts` (17 tests)
**Frontend-Backend Integration Tests** (12 tests):
- API health check
- Authentication flow
- Rule parsing integration
- Employee management
- Schedule generation
- Schedule optimization
- Analytics overview
- Notifications system
- Full workflow: Create rule and generate schedule
- CORS headers validation
- Error handling for invalid requests
- UI responsiveness and loading states

**Performance Tests** (2 tests):
- API response times
- Concurrent request handling

#### `/e2e-tests/frontend-backend-integration.spec.js` (12 tests)
**Authentication Flow** (2 tests):
- Successfully login and receive token
- Handle login failures gracefully

**Rule Management** (2 tests):
- Parse and save a scheduling rule
- Fetch and display all rules

**Schedule Generation** (2 tests):
- Generate schedule based on rules
- Optimize existing schedule

**Employee Management** (2 tests):
- Fetch and display employees
- Add new employee

**Analytics Dashboard** (1 test):
- Fetch and display analytics overview

**Notifications** (1 test):
- Fetch and display notifications

**Error Handling** (2 tests):
- Handle network errors gracefully
- Handle API errors with proper messages

**Real-time Updates** (1 test):
- Update UI when data changes

### 10. Accessibility (1 file, 5 tests)

#### `/e2e-tests/accessibility.spec.ts` (5 tests)
- Login page should have proper ARIA labels
- Register page should have proper ARIA labels
- Support keyboard navigation
- Have proper heading hierarchy

### 11. Demo & Smoke Tests (2 files, 11 tests)

#### `/e2e-tests/tests/demo-test.spec.ts` (6 tests)
- Demonstrate login flow with mocked API
- Demonstrate rule parsing with mocked API
- Demonstrate calendar view
- Demonstrate notification system
- Demonstrate schedule optimization UI

#### `/e2e-tests/tests/smoke-test.spec.ts` (5 tests)
- Load test framework
- Take screenshot
- Handle navigation
- Measure performance
- Handle multiple viewports

## Test Projects (Browser/Device Configurations)

### Desktop Browsers
1. **Chromium** (Desktop Chrome)
2. **Firefox** (Desktop Firefox)
3. **WebKit** (Desktop Safari)

### Mobile Browsers
4. **Mobile Chrome** (Pixel 5)
5. **Mobile Safari** (iPhone 12)

### Tablet
6. **Tablet** (iPad Pro)

### Special Configurations
7. **High DPI** (2x device scale factor)
8. **Slow Network** (3G simulation: 50KB/s down, 20KB/s up, 2s latency)
9. **Dark Mode** (Dark color scheme)
10. **Accessibility** (Reduced motion, forced colors)
11. **Performance** (Memory monitoring, GPU features)
12. **API** (Direct API testing without UI)

## Test Helpers & Utilities

### Page Objects (`/e2e-tests/fixtures/page-objects.ts`)
- `LoginPage`: Login form interactions
- `RulePage`: Rule management operations
- `SchedulePage`: Schedule generation and viewing
- `EmployeePage`: Employee management

### Test Data (`/e2e-tests/fixtures/test-data.ts`)
- `testUsers`: Admin, manager, employee credentials
- `testEmployees`: Sample employee data
- `testRules`: Sample scheduling rules
- `testSchedule`: Sample schedule configuration

### API Helpers (`/e2e-tests/helpers/api-helpers.ts`)
- API request utilities
- Authentication helpers
- Response validation

### Mock Server (`/e2e-tests/fixtures/mock-server.ts`)
- Mock API responses
- Test data fixtures

## Test Configuration

### Timeouts
- **Global Test Timeout**: 30,000ms (30 seconds)
- **Expect Timeout**: 5,000ms (5 seconds)
- **Action Timeout**: 10,000ms (10 seconds)
- **Navigation Timeout**: 30,000ms (30 seconds)

### Execution Settings
- **Parallel Execution**: Yes (14 workers)
- **Retries**: 2 (in CI), 0 (locally)
- **Fully Parallel**: Yes
- **Headless**: Yes (in CI), No (locally)

### Reporting
- **HTML Report**: `e2e-tests/reports/html/`
- **JSON Report**: `e2e-tests/reports/results.json`
- **JUnit Report**: `e2e-tests/reports/junit.xml`
- **List**: Console output

### Artifacts
- **Screenshots**: Only on failure
- **Videos**: Retain on failure
- **Traces**: On first retry

## Coverage Matrix

### By User Role
| Feature | Admin | Manager | Employee |
|---------|-------|---------|----------|
| Login | ✓ | ✓ | ✓ |
| Rules | ✓ | ✓ | View |
| Schedules | ✓ | ✓ | View |
| Employees | ✓ | ✓ | - |
| Analytics | ✓ | ✓ | Limited |
| Settings | ✓ | Limited | - |

### By Workflow
| Workflow | Tests | Critical |
|----------|-------|----------|
| Authentication | 60+ | Yes |
| Create Schedule | 15+ | Yes |
| Manage Rules | 13 | Yes |
| AI Optimization | 11 | Yes |
| Employee Management | 10+ | Yes |
| Notifications | 12 | Medium |
| Calendar Sync | 12 | Medium |
| Analytics | 5+ | Medium |

### By Test Type
| Type | Count | % |
|------|-------|---|
| Functional | 150+ | 79% |
| Integration | 25+ | 13% |
| Accessibility | 10+ | 5% |
| Performance | 5+ | 3% |

## Test Naming Conventions

### Pattern
```
[Feature] › [Sub-Feature] › [Test Case]
```

### Examples
- `Authentication › Login Flow › should login successfully with valid credentials`
- `Rule Management › should parse and add availability rule`
- `Schedule Generation › should generate weekly schedule`

## Running Tests

### All Tests
```bash
npx playwright test
```

### By Category
```bash
npx playwright test auth                  # All auth tests
npx playwright test 02-rule-management    # Rule tests
npx playwright test schedule-workflow     # Schedule workflows
```

### By Project
```bash
npx playwright test --project=chromium    # Desktop Chrome only
npx playwright test --project="Mobile Chrome"  # Mobile only
```

### Debug Mode
```bash
npx playwright test --ui                  # UI mode
npx playwright test --headed              # Show browser
npx playwright test --debug               # Debug mode
```

## Expected Test Duration

### By Test Type
- **Smoke Tests**: <1 minute
- **Authentication**: 2-3 minutes
- **Rule Management**: 2-3 minutes
- **Schedule Generation**: 3-4 minutes
- **Full Suite (Single Browser)**: 15-20 minutes
- **Full Suite (All Browsers)**: 45-60 minutes

## Test Dependencies

### Runtime
- Node.js >= 16
- Playwright >= 1.54.2
- Application servers running (frontend:3000, backend:8000)

### Database
- Test database with seed data
- Clean state between test runs

### External Services (Optional)
- Email service for notification tests
- Calendar API for integration tests

## Maintenance

### Adding New Tests
1. Create test file in appropriate directory
2. Follow naming conventions
3. Use page objects for UI interactions
4. Add test data to fixtures
5. Update this inventory

### Debugging Failed Tests
1. Check screenshots in `test-results/`
2. Watch videos of failures
3. Review trace files
4. Run test in UI mode: `--ui`
5. Run test headed: `--headed`

---

**Last Updated**: November 21, 2025
**Test Infrastructure Version**: 1.0
**Playwright Version**: 1.54.2
