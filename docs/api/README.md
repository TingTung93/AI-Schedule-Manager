# AI Schedule Manager API Documentation

Comprehensive API documentation for the AI Schedule Manager backend system.

## Documentation Files

### 📋 [OpenAPI Specification](./openapi.yaml)
Complete OpenAPI 3.0 specification with all endpoints, schemas, and examples. Import this file into:
- **Postman** - Generate collection and test API
- **Swagger UI** - Interactive API explorer
- **OpenAPI Generator** - Generate client libraries in any language

**Quick start with Swagger UI:**
```bash
# Install swagger-ui-watcher (optional)
npm install -g swagger-ui-watcher

# Serve the OpenAPI spec
swagger-ui-watcher ./docs/api/openapi.yaml
# Opens in browser at http://localhost:8000
```

---

### 📖 [API Reference](./API_REFERENCE.md)
Human-readable API reference with:
- ✅ Complete endpoint documentation
- ✅ Request/response examples
- ✅ Authentication guides
- ✅ Error handling
- ✅ Code samples in Python, JavaScript, cURL
- ✅ Pagination and filtering examples
- ✅ WebSocket support

**Perfect for:** Developers integrating with the API

---

### 🗂️ [Data Models](./DATA_MODELS.md)
Comprehensive data model documentation including:
- ✅ Complete field descriptions with constraints
- ✅ Database table structures
- ✅ Relationship diagrams (ERD)
- ✅ Computed properties and methods
- ✅ Workflow state machines
- ✅ Best practices for data manipulation

**Perfect for:** Understanding the database schema and model relationships

---

### 🔐 [Authentication & Authorization](./AUTHENTICATION.md)
Complete authentication and security guide:
- ✅ JWT authentication flow
- ✅ Registration and login processes
- ✅ Token management (access + refresh)
- ✅ Role-based access control (RBAC)
- ✅ Security features (account locking, audit logging)
- ✅ Code examples for Python and JavaScript
- ✅ Best practices and common pitfalls

**Perfect for:** Implementing authentication in client applications

---

### 👥 [Department Assignment API](./department-assignment-api.md)
Department employee assignment and transfer endpoints:
- ✅ Bulk employee assignment to departments
- ✅ Employee transfer between departments
- ✅ Approval workflow support
- ✅ Complete audit trail tracking
- ✅ Request/response schemas with examples
- ✅ Error handling and validation
- ✅ Code examples in Python, JavaScript, and cURL

**Perfect for:** Managing department assignments and organizational structure

---

### 📅 [Department Schedule Management API](./department-schedule-api.md)
Department-specific scheduling and template management:
- ✅ Create and manage department schedules
- ✅ Schedule template creation and application
- ✅ Consolidated department schedule views
- ✅ Coverage analytics and metrics
- ✅ Staffing gap analysis
- ✅ Query parameters and filtering
- ✅ Comprehensive usage examples

**Perfect for:** Department-level schedule planning and optimization

---

## Quick Start

### 1. Start the Backend Server

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

Server will start at: **http://localhost:8000**

### 2. Explore the API

**Option A: Interactive API Docs (Built-in)**

FastAPI automatically generates interactive documentation:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

**Option B: Import OpenAPI Spec into Postman**

1. Open Postman
2. Import → Upload Files → Select `openapi.yaml`
3. Collection will be auto-generated with all endpoints

### 3. Authenticate

**Using cURL:**
```bash
# Register new user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecureP@ss123",
    "first_name": "Test",
    "last_name": "User"
  }' -c cookies.txt

# Login (saves cookies)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecureP@ss123"
  }' -c cookies.txt

# Use authenticated endpoints
curl -X GET http://localhost:8000/api/schedules \
  -b cookies.txt
```

**Using Python:**
```python
import requests

# Login
response = requests.post(
    "http://localhost:8000/api/auth/login",
    json={"email": "test@example.com", "password": "SecureP@ss123"}
)
token = response.json()["access_token"]

# Make authenticated request
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(
    "http://localhost:8000/api/schedules",
    headers=headers
)
schedules = response.json()
```

---

## API Overview

### Base URL
- **Development:** `http://localhost:8000`
- **Production:** `https://api.example.com`

### Authentication
All endpoints (except `/auth/*`) require JWT authentication via:
- **Bearer Token:** `Authorization: Bearer <token>`
- **HTTP-only Cookie:** `access_token=<token>`

### Core Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login` | Login and get tokens |
| `GET /api/auth/me` | Get current user |
| `GET /api/schedules` | List schedules (with filtering) |
| `POST /api/schedules` | Create schedule |
| `GET /api/schedules/{id}` | Get schedule details |
| `PUT /api/schedules/{id}` | Update schedule |
| `DELETE /api/schedules/{id}` | Delete schedule |
| `GET /api/employees` | List employees |
| `POST /api/employees` | Create employee |
| `GET /api/shifts` | List shifts |
| `POST /api/shifts` | Create shift |
| `GET /api/departments` | List departments (hierarchical) |
| `POST /api/departments/{id}/employees/bulk-assign` | Bulk assign employees to department |
| `POST /api/departments/{id}/employees/{emp_id}/transfer` | Transfer employee between departments |
| `GET /api/departments/{id}/schedules` | List department schedules |
| `POST /api/departments/{id}/schedules` | Create department schedule |
| `GET /api/departments/{id}/schedule-overview` | Get consolidated schedule view with analytics |
| `GET /api/departments/{id}/templates` | List schedule templates |
| `POST /api/departments/{id}/templates` | Create schedule template |
| `POST /api/departments/{id}/templates/{template_id}/apply` | Apply template to create schedule |
| `GET /api/data/export/schedules` | Export schedules (CSV/Excel/PDF/iCal) |
| `POST /api/data/import/upload` | Upload import file |

### Data Model Summary

**Core Models:**
- **Schedule** - Weekly schedule container with approval workflow
- **ScheduleAssignment** - Individual employee-to-shift assignments
- **Employee** - User accounts with authentication and availability
- **Shift** - Work period definitions with staffing requirements
- **Department** - Hierarchical organization structure

**Key Relationships:**
```
Schedule (1) ──── (N) ScheduleAssignment
Employee (1) ──── (N) ScheduleAssignment
Shift (1) ──── (N) ScheduleAssignment
Department (1) ──── (N) Employee
Department (1) ──── (N) Shift
```

---

## Common Use Cases

### 1. Create a Weekly Schedule

```python
import requests

# 1. Login
auth = requests.post("http://localhost:8000/api/auth/login", json={
    "email": "manager@example.com",
    "password": "SecureP@ss123"
})
token = auth.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Create schedule
schedule = requests.post(
    "http://localhost:8000/api/schedules",
    headers=headers,
    json={
        "weekStart": "2025-01-20",
        "weekEnd": "2025-01-26",
        "title": "Week of January 20th",
        "description": "Regular weekly schedule"
    }
)
schedule_id = schedule.json()["id"]

# 3. Add shift assignments (created separately via /shifts endpoint)
# 4. Submit for approval
requests.put(
    f"http://localhost:8000/api/schedules/{schedule_id}",
    headers=headers,
    json={"status": "pending_approval"}
)
```

### 2. Export Schedules

```bash
# Export as Excel
curl -X GET "http://localhost:8000/api/data/export/schedules?format_type=excel&date_from=2025-01-01&date_to=2025-01-31&status=published" \
  -H "Authorization: Bearer $TOKEN" \
  -o schedules.xlsx

# Export as iCal for calendar import
curl -X GET "http://localhost:8000/api/data/export/schedules?format_type=ical&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  -o schedules.ics
```

### 3. Bulk Import Employees

```bash
# 1. Upload CSV file
RESPONSE=$(curl -X POST http://localhost:8000/api/data/import/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@employees.csv")

FILE_ID=$(echo $RESPONSE | jq -r '.file_id')

# 2. Preview data
curl -X GET "http://localhost:8000/api/data/import/preview/$FILE_ID?import_type=employees&preview_rows=10" \
  -H "Authorization: Bearer $TOKEN"

# 3. Validate data
curl -X POST "http://localhost:8000/api/data/import/validate/$FILE_ID?import_type=employees" \
  -H "Authorization: Bearer $TOKEN"

# 4. Execute import
curl -X POST "http://localhost:8000/api/data/import/execute/$FILE_ID?import_type=employees&update_existing=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Response Formats

### Success Response
```json
{
  "id": 1,
  "weekStart": "2025-01-20",
  "weekEnd": "2025-01-26",
  "status": "draft",
  "createdAt": "2025-01-12T10:00:00Z"
}
```

### Error Response
```json
{
  "detail": "Resource not found"
}
```

### Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

### Paginated Response
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

---

## HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 204 | No Content | Delete succeeded |
| 400 | Bad Request | Validation error or invalid input |
| 401 | Unauthorized | Authentication required or token invalid |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 423 | Locked | Account locked (too many failed logins) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 10 requests/minute |
| Read operations (GET) | 100 requests/minute |
| Write operations (POST/PUT/DELETE) | 30 requests/minute |
| Export operations | 10 requests/minute |

Rate limit headers included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642089600
```

---

## Security Features

### Authentication
- ✅ JWT with dual tokens (access + refresh)
- ✅ HTTP-only cookies for XSS protection
- ✅ bcrypt password hashing
- ✅ Account locking after failed attempts
- ✅ Comprehensive audit logging

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Hierarchical permissions (admin > manager > supervisor > employee)
- ✅ Object-level permission checks
- ✅ Route-level dependency injection

### Protection
- ✅ CSRF protection with SameSite cookies
- ✅ Rate limiting per user and IP
- ✅ Input validation with Pydantic
- ✅ SQL injection prevention (ORM)
- ✅ CORS configuration

---

## Development Tools

### Swagger UI (Built-in)
Visit http://localhost:8000/docs for interactive API testing

### Generate Client Libraries

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate Python client
openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g python \
  -o client/python

# Generate TypeScript/Axios client
openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g typescript-axios \
  -o client/typescript
```

### Postman Collection
Import `openapi.yaml` into Postman to auto-generate a complete collection with:
- All endpoints organized by tag
- Example requests pre-populated
- Environment variables for easy testing

---

## Support & Resources

### Documentation
- [API Reference](./API_REFERENCE.md) - Complete endpoint documentation
- [Data Models](./DATA_MODELS.md) - Database schema and relationships
- [Authentication Guide](./AUTHENTICATION.md) - Security and auth flows
- [Department Assignment API](./department-assignment-api.md) - Employee assignment and transfers
- [Department Schedule API](./department-schedule-api.md) - Department scheduling and templates
- [OpenAPI Spec](./openapi.yaml) - Machine-readable API specification

### Interactive Docs
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Example Code
All documentation includes code examples in:
- Python (requests library)
- JavaScript/TypeScript (fetch)
- cURL (command line)

---

## Version History

**Version 1.0.0** (Current)
- Complete CRUD operations for schedules, employees, shifts, departments
- JWT authentication with dual tokens
- Role-based access control
- Data import/export (CSV, Excel, PDF, iCal)
- Real-time WebSocket support
- Comprehensive audit logging

---

## Contributing

When adding new endpoints:
1. Update the OpenAPI spec (`openapi.yaml`)
2. Add examples to API Reference (`API_REFERENCE.md`)
3. Document data models if new models added (`DATA_MODELS.md`)
4. Update authentication guide if auth changes (`AUTHENTICATION.md`)

---

## License

MIT License - See LICENSE file for details

---

**Need Help?**
- Check the [API Reference](./API_REFERENCE.md) for detailed examples
- Try the interactive docs at http://localhost:8000/docs
- Review the [Authentication Guide](./AUTHENTICATION.md) for security questions
