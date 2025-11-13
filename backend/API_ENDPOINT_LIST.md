# Complete API Endpoint List

## Assignment Management (`/api/assignments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/schedules/{schedule_id}/assignments` | Create single assignment |
| POST | `/bulk` | Bulk create assignments |
| GET | `/{id}` | Get assignment details |
| PUT | `/{id}` | Update assignment |
| DELETE | `/{id}` | Delete assignment |
| POST | `/{id}/confirm` | Employee confirms assignment |
| POST | `/{id}/decline` | Employee declines assignment |
| GET | `/` | List assignments with filtering |

**Total: 8 endpoints**

---

## All API Endpoints Summary

### Authentication
- Auth endpoints via `/api/auth/*`

### Assignments (NEW)
- 8 endpoints for assignment CRUD

### Analytics
- Via `/api/analytics/*`

### Data I/O
- Via `/api/data-io/*`

### Departments
- Via `/api/departments/*`

### Employees
- Via `/api/employees/*`

### Notifications
- Via `/api/notifications/*`

### Rules
- Via `/api/rules/*`

### Schedules
- Via `/api/schedules/*`

### Settings
- Via `/api/settings/*`

### Shifts
- Via `/api/shifts/*`

---

**Last Updated**: 2025-01-13

**New Additions**: Assignment API (8 endpoints)
