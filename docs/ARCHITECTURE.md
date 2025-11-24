# AI Schedule Manager - System Architecture

## Executive Summary

AI Schedule Manager is an intelligent scheduling application designed for small to medium businesses managing up to 100 staff across 24-hour operations. The system uses constraint-based optimization to generate schedules that satisfy business rules, employee availability, and operational requirements.

## Market Analysis

### Existing Solutions Gap
- **Deputy, Motion, Zendesk**: Enterprise-focused, complex, expensive
- **Connecteam, Homebase**: Limited AI capabilities, no plain language rules
- **Sling**: Basic features, lacks constraint solving

### Our Differentiators
1. **Rule-Based Scheduling**: Flexible constraint and preference management
2. **Constraint Optimization**: Advanced algorithms for optimal schedule generation
3. **Simple Deployment**: Docker and Kubernetes deployment options
4. **Small Business Focus**: Designed for 10-100 employees
5. **Fully Open Source**: No licensing fees, fully customizable

## Technology Stack

### Core Technologies (All Commercial-Friendly Licenses)

#### Backend
- **FastAPI** (MIT License): High-performance Python web framework
- **SQLAlchemy** (MIT License): SQL toolkit and ORM
- **PostgreSQL** (PostgreSQL License): Robust relational database
- **Alembic** (MIT License): Database migration tool
- **Pydantic** (MIT License): Data validation
- **Redis** (BSD License): Caching and session management (planned)

#### Frontend
- **React 18** (MIT License): Modern UI framework
- **Material-UI (MUI)** (MIT License): Professional component library
- **FullCalendar** (MIT License): Interactive scheduling calendar
- **Axios** (MIT License): HTTP client
- **React Router** (MIT License): Navigation

#### Future Enhancements
- **Google OR-Tools** (Apache 2.0): Constraint solver for advanced optimization
- **spaCy** (MIT License): NLP for natural language rule parsing
- **Celery** (BSD License): Async task processing for long-running operations

#### Deployment
- **Docker** (Apache 2.0): Containerization
- **Docker Compose**: Multi-container orchestration
- **Nginx** (BSD License): Reverse proxy
- **Electron** (MIT License): Windows desktop app wrapper

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Dashboard │  │Schedule  │  │Rules     │  │Analytics │  │
│  │          │  │Calendar  │  │Manager   │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Gateway                          │
│                    (FastAPI + Nginx)                         │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   NLP Engine │    │  Scheduling  │    │   Business   │
│    (spaCy)   │    │    Engine    │    │    Logic     │
│              │    │  (OR-Tools)  │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │PostgreSQL│  │  Redis   │  │   File   │  │  Neural  │  │
│  │          │  │  Cache   │  │  Storage │  │  Models  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Rule Management Engine
- **Purpose**: Store and validate scheduling rules and constraints
- **Technology**: PostgreSQL + Pydantic validation
- **Features**:
  - Employee availability rules
  - Shift coverage requirements
  - Labor law compliance rules
  - Department-specific constraints

#### 2. Schedule Generation Engine
- **Purpose**: Generate optimal schedules respecting all rules
- **Technology**: Constraint-based algorithms with SQLAlchemy
- **Features**:
  - Hard constraints (legal requirements, availability)
  - Soft constraints (preferences, fairness)
  - Conflict detection and resolution
  - Department-based assignment

#### 3. Optimization Service
- **Purpose**: Optimize schedules for cost and coverage
- **Technology**: Custom optimization algorithms
- **Capabilities**:
  - Minimize labor costs
  - Balance workload across employees
  - Maximize shift coverage
  - Detect scheduling conflicts

## Database Schema

### Core Tables

```sql
-- Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(100),
    hourly_rate DECIMAL(10,2),
    max_hours_week INTEGER,
    min_hours_week INTEGER,
    created_at TIMESTAMP
);

-- Scheduling Rules
CREATE TABLE scheduling_rules (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(id),
    rule_text TEXT,  -- Original plain language
    rule_type VARCHAR(50),  -- availability, preference, requirement
    parsed_constraint JSONB,  -- Structured constraint
    priority INTEGER,
    active BOOLEAN,
    created_at TIMESTAMP
);

-- Shifts
CREATE TABLE shifts (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    position VARCHAR(100),
    status VARCHAR(20),  -- scheduled, confirmed, completed
    created_at TIMESTAMP
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMP
);

-- Schedule Assignments (many-to-many linking table)
CREATE TABLE schedule_assignments (
    id UUID PRIMARY KEY,
    schedule_id UUID REFERENCES schedules(id),
    employee_id UUID REFERENCES employees(id),
    shift_id UUID REFERENCES shifts(id),
    status VARCHAR(20),
    created_at TIMESTAMP
);
```

## API Design

### REST Endpoints

```yaml
# Rules Management
POST   /api/rules/parse     # Parse natural language rule
GET    /api/rules           # List all rules
PUT    /api/rules/{id}      # Update rule
DELETE /api/rules/{id}      # Delete rule

# Scheduling
POST   /api/schedule/generate   # Generate schedule
GET    /api/schedule/current    # Get current schedule
POST   /api/schedule/optimize   # Optimize existing schedule
POST   /api/shifts/swap         # Request shift swap

# Employees
GET    /api/employees           # List employees
POST   /api/employees           # Add employee
GET    /api/employees/{id}/availability

# Analytics
GET    /api/analytics/coverage  # Shift coverage analysis
GET    /api/analytics/costs     # Labor cost projections
GET    /api/analytics/patterns  # Scheduling patterns
```

## Deployment Strategy

### Docker Deployment (Recommended)

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
    ports:
      - "8000:8000"
  
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
```

### Windows Deployment

1. **Electron Desktop App**: Wraps the web application
2. **Embedded PostgreSQL**: Portable database
3. **Python Runtime**: Embedded Python for backend
4. **Auto-updater**: Built-in update mechanism

## Security Considerations

1. **Authentication**: JWT tokens with refresh mechanism
2. **Authorization**: Role-based access control (RBAC)
3. **Data Protection**: AES-256 encryption for sensitive data
4. **API Security**: Rate limiting, CORS, input validation
5. **Compliance**: GDPR, labor law compliance checks

## Performance Targets

- Schedule generation: < 3 seconds for 100 employees
- Rule parsing: < 500ms per rule
- API response time: < 200ms (p95)
- Concurrent users: 50+ simultaneous
- Database size: Support 2+ years of historical data

## Scalability Path

1. **Phase 1** (MVP): Single server, up to 100 employees
2. **Phase 2**: Multi-tenant SaaS, up to 500 employees
3. **Phase 3**: Distributed system, unlimited scale

## Cost Analysis

### Infrastructure Costs (Self-Hosted)
- Small business (< 50 employees): $20-50/month
- Medium business (50-100 employees): $50-150/month

### Development Time Estimate
- MVP: 8-10 weeks
- Production-ready: 14-16 weeks
- Full feature set: 20-24 weeks

## Next Steps

1. Set up development environment
2. Implement core NLP rule parser
3. Build constraint solver integration
4. Create basic UI prototype
5. Deploy Docker demo