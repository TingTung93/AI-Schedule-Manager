# AI Schedule Manager - Architecture Map

**Last Updated:** November 21, 2025

## Quick Reference

**Health Score:** 🟡 6.5/10 (Moderate Architectural Debt)

**Critical Issues:** 10 file size violations, mixed concerns, configuration chaos

**Top 3 Priorities:**
1. Split mega-files (47k+ lines)
2. Consolidate configuration management
3. Document critical architectural paths

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Users/Clients                          │
│              (Web Browser, Mobile Browser)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Container                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React 18 + Material-UI SPA                          │  │
│  │  - Code splitting (lazy loading)                     │  │
│  │  - Context API state management                      │  │
│  │  - Axios HTTP client                                 │  │
│  │  - WebSocket client                                  │  │
│  │  - Service Worker (offline support)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                 nginx:alpine (Static files)                  │
│                 Port: 3000 (dev), 80 (prod)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP REST + WebSocket
                              │ /api/v1/*
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend Container                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FastAPI + Uvicorn                                   │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  API Routes (/api/v1/*)                        │ │  │
│  │  │  - Employees    - Schedules                     │ │  │
│  │  │  - Departments  - Analytics                     │ │  │
│  │  │  - Assignments  - Notifications                 │ │  │
│  │  │  - Shifts       - Rules                         │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Authentication & Authorization                 │ │  │
│  │  │  - JWT tokens (access + refresh)                │ │  │
│  │  │  - Redis session store                          │ │  │
│  │  │  - Password hashing (bcrypt)                    │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Business Services                              │ │  │
│  │  │  - CRUD operations                              │ │  │
│  │  │  - Schedule generation                          │ │  │
│  │  │  - Data transformation                          │ │  │
│  │  │  - Import/Export                                │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  Middleware Layer                               │ │  │
│  │  │  - CORS                                         │ │  │
│  │  │  - Rate limiting (slowapi)                      │ │  │
│  │  │  - Error handling                               │ │  │
│  │  │  - Logging                                      │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                 Python 3.11 + FastAPI                        │
│                 Port: 8001 (dev), 8000 (prod)                │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  PostgreSQL Container    │    │   Redis Container        │
│  ┌────────────────────┐  │    │  ┌────────────────────┐  │
│  │  Database Tables   │  │    │  │  Session Store     │  │
│  │  - users           │  │    │  │  - JWT tokens      │  │
│  │  - employees       │  │    │  │  - Rate limits     │  │
│  │  - departments     │  │    │  │  - Cache data      │  │
│  │  - schedules       │  │    │  └────────────────────┘  │
│  │  - shifts          │  │    │  Redis 7+                │
│  │  - assignments     │  │    │  Port: 6379              │
│  │  - rules           │  │    └──────────────────────────┘
│  │  - notifications   │  │
│  └────────────────────┘  │
│  PostgreSQL 14+          │
│  Port: 5432              │
└──────────────────────────┘

Optional Services (for production):
┌──────────────────────────┐    ┌──────────────────────────┐
│  Celery Workers          │    │  Monitoring Stack        │
│  (Background Tasks)      │    │  - Prometheus            │
│                          │    │  - Grafana               │
│  Port: N/A               │    │  - Sentry                │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Component Breakdown

### Frontend (React)

**Technology:** React 18.2.0 + Material-UI 7.3.5

**Structure:**
```
frontend/src/
├── App.jsx                    # Main application entry (11k lines ⚠️)
├── index.js                   # React DOM render
├── pages/                     # Page-level components (lazy loaded)
│   ├── DashboardPage.jsx
│   ├── EmployeesPage.jsx
│   ├── ScheduleBuilder.jsx
│   ├── AnalyticsPage.jsx
│   └── [8 more pages]
├── components/                # Reusable UI components
│   ├── Dashboard.jsx          # (22k lines 🔴)
│   ├── EmployeeManagement.jsx # (28k lines 🔴)
│   ├── ScheduleDisplay.jsx    # (32k lines 🔴)
│   ├── auth/                  # Authentication components
│   ├── calendar/              # Calendar UI
│   ├── forms/                 # Form components
│   └── layout/                # Layout components
├── services/                  # API and business logic
│   ├── api.js                 # (26k lines 🔴) ALL API calls
│   ├── validationService.js
│   └── websocket.js
├── contexts/                  # React Context providers
│   └── AuthContext.jsx        # Global auth state
├── hooks/                     # Custom React hooks
│   └── useOnlineStatus.js
├── utils/                     # Utility functions
└── config/                    # Configuration
```

**Key Patterns:**
- ✅ Code splitting with React.lazy()
- ✅ Context API for state management
- ✅ Custom hooks for reusable logic
- 🔴 Monolithic components (20k+ lines)
- 🔴 Single API service file

### Backend (FastAPI)

**Technology:** FastAPI 0.104.1 + SQLAlchemy 2.0.23

**Structure:**
```
backend/src/
├── main.py                    # App initialization (738 lines ⚠️)
├── api/                       # API route handlers
│   ├── analytics.py           # Analytics endpoints
│   ├── assignments.py         # (26k lines 🔴)
│   ├── departments.py         # Department CRUD
│   ├── employees.py           # (22k lines 🔴)
│   ├── schedules.py           # (31k lines 🔴)
│   ├── shifts.py              # Shift management
│   ├── rules.py               # Business rules
│   ├── notifications.py       # Notification system
│   └── [3 more routers]
├── auth/                      # Authentication module
│   ├── auth.py                # Auth service
│   └── fastapi_routes.py      # Auth API routes
├── core/                      # Core infrastructure
│   └── config.py              # Pydantic settings
├── services/                  # Business logic layer
│   ├── crud.py                # Generic CRUD (935 lines ⚠️)
│   ├── schedule_service.py    # Schedule generation
│   ├── import_service.py      # (47k lines 🔴) Data import
│   ├── export_service.py      # Data export
│   └── [8 more services]
├── models/                    # SQLAlchemy models
│   └── [domain models]        # Employee, Schedule, etc.
├── schemas/                   # Pydantic schemas
│   └── [domain schemas]       # Request/response DTOs
├── scheduler/                 # Scheduling algorithms
│   └── optimizer.py           # OR-Tools optimization
├── nlp/                       # Natural language processing
│   └── rule_parser.py         # NLP rule parser
├── middleware/                # Custom middleware
├── exceptions/                # Custom exceptions
├── utils/                     # Utility functions
├── database.py                # Database connection
├── dependencies.py            # FastAPI dependencies
└── schemas.py                 # (1,255 lines 🔴) Monolithic schemas
```

**Key Patterns:**
- ✅ Async/await throughout
- ✅ Dependency injection
- ✅ Pydantic validation
- ✅ Modular router structure
- 🔴 Mega-files (30k+ lines)
- 🔴 Mixed concerns in API routes

### Database (PostgreSQL)

**Technology:** PostgreSQL 14+

**Schema (Simplified):**
```sql
-- Core entities
users (id, email, password_hash, role, created_at)
employees (id, user_id, name, email, phone, skills, availability)
departments (id, name, description, manager_id)
shifts (id, name, start_time, end_time, min_staff, max_staff)
schedules (id, name, start_date, end_date, status, created_by)
assignments (id, schedule_id, employee_id, shift_id, date, status)
rules (id, name, description, type, priority, conditions)
notifications (id, user_id, type, message, read, created_at)

-- Supporting tables
shift_definitions (id, department_id, shift_id)
employee_departments (employee_id, department_id)
employee_skills (employee_id, skill)
audit_logs (id, user_id, action, table_name, record_id, timestamp)
```

**Indexes:**
- Primary keys on all tables
- Foreign key indexes
- Composite indexes on frequently queried columns
- ⚠️ Missing indexes documented in assessment

### Cache Layer (Redis)

**Technology:** Redis 7+

**Usage:**
```
Keys:
- auth:token:{token_id}          # JWT tokens
- auth:refresh:{token_id}         # Refresh tokens
- session:{user_id}               # User sessions
- ratelimit:{ip}:{endpoint}       # Rate limiting counters
- cache:schedule:{id}             # Schedule cache
- cache:employee:{id}             # Employee cache
```

**TTL Strategy:**
- JWT tokens: 15 minutes (access), 30 days (refresh)
- Rate limits: 60 seconds
- Data cache: 1 hour (configurable)

---

## Data Flow Diagrams

### Authentication Flow

```
┌──────────┐                                      ┌──────────┐
│  Client  │                                      │  Backend │
└─────┬────┘                                      └────┬─────┘
      │                                                │
      │  POST /api/v1/auth/login                      │
      │  { email, password }                          │
      ├──────────────────────────────────────────────►│
      │                                                │
      │                                           ┌────▼────┐
      │                                           │ Validate│
      │                                           │Password │
      │                                           └────┬────┘
      │                                                │
      │                                           ┌────▼────┐
      │                                           │Generate │
      │                                           │  JWT    │
      │                                           └────┬────┘
      │                                                │
      │                                           ┌────▼────┐
      │                                           │  Store  │
      │                                           │ in Redis│
      │                                           └────┬────┘
      │  { access_token, refresh_token, user }        │
      │◄──────────────────────────────────────────────┤
      │                                                │
┌─────▼────┐                                          │
│  Store   │                                          │
│  Tokens  │                                          │
└─────┬────┘                                          │
      │                                                │
      │  Subsequent requests with Authorization header│
      │  Bearer {access_token}                        │
      ├──────────────────────────────────────────────►│
      │                                                │
      │                                           ┌────▼────┐
      │                                           │ Validate│
      │                                           │  Token  │
      │                                           └────┬────┘
      │  Protected resource                           │
      │◄──────────────────────────────────────────────┤
      │                                                │
```

### Schedule Generation Flow

```
┌────────┐      ┌─────────┐      ┌──────────┐      ┌────────┐
│ Client │      │  API    │      │ Service  │      │   DB   │
└───┬────┘      └────┬────┘      └────┬─────┘      └───┬────┘
    │                │                 │                │
    │ POST /api/v1/schedules/generate │                │
    │ { start, end, rules }           │                │
    ├────────────────►│                │                │
    │                 │                │                │
    │                 │ scheduleService│                │
    │                 │  .generate()   │                │
    │                 ├───────────────►│                │
    │                 │                │                │
    │                 │                │ SELECT employees,│
    │                 │                │   shifts, rules │
    │                 │                ├───────────────►│
    │                 │                │                │
    │                 │                │ Raw data       │
    │                 │                │◄───────────────┤
    │                 │                │                │
    │                 │          ┌─────▼─────┐         │
    │                 │          │ OR-Tools  │         │
    │                 │          │Optimization│        │
    │                 │          └─────┬─────┘         │
    │                 │                │                │
    │                 │          ┌─────▼─────┐         │
    │                 │          │ Validate  │         │
    │                 │          │  Rules    │         │
    │                 │          └─────┬─────┘         │
    │                 │                │                │
    │                 │                │ INSERT schedule,│
    │                 │                │   assignments  │
    │                 │                ├───────────────►│
    │                 │                │                │
    │                 │                │ schedule_id    │
    │                 │                │◄───────────────┤
    │                 │                │                │
    │                 │ scheduleData   │                │
    │                 │◄───────────────┤                │
    │                 │                │                │
    │ 201 Created     │                │                │
    │ { schedule }    │                │                │
    │◄────────────────┤                │                │
    │                 │                │                │
```

---

## Deployment Architecture

### Development Environment

```
Host Machine (Windows)
└── WSL2 (Linux)
    └── Docker Desktop
        ├── frontend:dev    (port 3000)
        ├── backend:dev     (port 8001)
        ├── postgres:14     (port 5432)
        └── redis:7         (port 6379)

Hot reload: ✅ Enabled
Debugging: ✅ Enabled
HTTPS: ❌ Not required
```

### Production Environment (Proposed)

```
Cloud Provider (AWS/Azure/GCP)
├── Load Balancer (HTTPS termination)
│   └── nginx (reverse proxy)
│       ├── frontend:prod (static files)
│       └── backend:prod (API)
├── Application Tier
│   ├── Backend Pods (3+ replicas)
│   │   ├── FastAPI + Uvicorn
│   │   └── Health checks
│   └── Celery Workers (2+ replicas)
│       └── Background tasks
├── Data Tier
│   ├── PostgreSQL (managed service)
│   │   ├── Primary (read/write)
│   │   └── Replica (read-only)
│   └── Redis (managed service)
│       └── High availability mode
└── Monitoring Tier
    ├── Prometheus (metrics)
    ├── Grafana (dashboards)
    └── Sentry (error tracking)
```

---

## Security Architecture

### Authentication & Authorization

**JWT Token Strategy:**
```
Access Token:
- Lifetime: 15 minutes
- Stored: Client memory (not localStorage)
- Claims: user_id, email, role, exp

Refresh Token:
- Lifetime: 30 days
- Stored: HttpOnly cookie (secure)
- Claims: user_id, exp, jti (token ID)
- Redis: Token whitelist
```

**Role-Based Access Control (RBAC):**
```
Roles:
- admin     (full access)
- manager   (department management)
- employee  (view own schedule)

Permissions:
- create:schedule
- read:schedule
- update:schedule
- delete:schedule
- manage:employees
- manage:departments
```

### Data Protection

**In Transit:**
- ✅ HTTPS/TLS 1.3
- ✅ Secure WebSocket (WSS)
- ✅ Certificate pinning (mobile)

**At Rest:**
- ✅ Encrypted database (AES-256)
- ✅ Hashed passwords (bcrypt)
- ❌ Encrypted backups (not implemented)

**Input Validation:**
- ✅ Pydantic schemas (backend)
- ✅ Yup/Joi schemas (frontend)
- ✅ SQL injection prevention (ORM)
- ✅ XSS prevention (React escaping)

---

## Performance Characteristics

### Current Benchmarks (Development)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| API Response Time (p50) | 120ms | <100ms | ⚠️ |
| API Response Time (p95) | 450ms | <200ms | 🔴 |
| Frontend Initial Load | 2.8s | <2s | ⚠️ |
| Frontend Bundle Size | 842KB | <500KB | 🔴 |
| Database Query Time (p95) | 180ms | <100ms | ⚠️ |
| Lighthouse Performance | 72 | >90 | 🔴 |

### Scalability Limits (Estimated)

| Resource | Current Capacity | Bottleneck |
|----------|------------------|------------|
| Concurrent Users | ~100 | Frontend bundle size |
| API Requests/sec | ~500 | Single uvicorn process |
| Database Connections | 20 | Pool size configuration |
| Schedule Generation | 1 per 5s | OR-Tools optimization |
| WebSocket Connections | ~50 | No load balancing |

---

## Technology Decisions (ADRs)

### ADR-001: Why FastAPI?

**Status:** ✅ Accepted

**Context:** Need modern async Python web framework

**Decision:** Use FastAPI over Flask/Django

**Reasons:**
- Native async/await support
- Automatic API documentation
- Type hints + Pydantic validation
- High performance (on par with Node.js)
- Modern dependency injection

**Consequences:**
- Faster development
- Better type safety
- Automatic OpenAPI docs
- Learning curve for team

### ADR-002: Why React?

**Status:** ✅ Accepted

**Context:** Need modern SPA framework

**Decision:** Use React over Vue/Angular

**Reasons:**
- Largest ecosystem
- Material-UI component library
- Team experience
- Better tooling (Create React App)
- Strong community support

**Consequences:**
- Large bundle size (needs optimization)
- State management complexity
- Performance requires optimization

### ADR-003: Why PostgreSQL?

**Status:** ✅ Accepted

**Context:** Need relational database

**Decision:** Use PostgreSQL over MySQL/MongoDB

**Reasons:**
- ACID compliance
- Complex queries support
- JSON/JSONB support
- Excellent performance
- Strong ecosystem

**Consequences:**
- More complex schema migrations
- Higher learning curve
- Excellent query optimization

### ADR-004: Why Material-UI?

**Status:** ⚠️ Under Review

**Context:** Need component library

**Decision:** Use Material-UI v7

**Reasons:**
- Comprehensive components
- Google Material Design
- TypeScript support
- Good documentation

**Consequences:**
- Large bundle size (700KB+)
- v7 is very new (stability concerns)
- Customization can be complex

**Recommendation:** Consider Mantine or Chakra UI for better bundle size

---

## Related Documents

- **[ASSESSMENT.md](./ASSESSMENT.md)** - Full architectural assessment (this document's source)
- **[docs/API_STANDARDIZATION.md](../API_STANDARDIZATION.md)** - API design patterns
- **[docs/PERFORMANCE_OPTIMIZATION.md](../PERFORMANCE_OPTIMIZATION.md)** - Performance tuning guide
- **[backend/README.md](../../backend/README.md)** - Backend setup instructions
- **[frontend/README.md](../../frontend/README.md)** - Frontend setup instructions

---

**Document Version:** 1.0
**Last Updated:** November 21, 2025
**Next Review:** December 21, 2025
