# Performance Optimization & Cleanup Plan
**AI Schedule Manager - Codebase Health & Performance Initiative**

**Date**: 2025-11-21
**Status**: Planning Phase - Awaiting Architect Approval
**Priority**: High

---

## Executive Summary

This document outlines a comprehensive performance optimization and codebase cleanup strategy for the AI Schedule Manager. The analysis identified **3,195 lines** of large files requiring refactoring, **78 console.log statements** to replace with proper logging, **659 lines** of backup code to remove, and **7,600+ Python cache files** consuming disk space.

**Expected Improvements**:
- **50-60% reduction** in large file complexity through modular refactoring
- **40-50% reduction** in frontend bundle size via tree-shaking and code splitting
- **30-40% faster** API response times with caching strategies
- **20-30% reduction** in memory usage through optimized data structures
- **24KB+ disk space** freed from backup file removal
- **Improved maintainability** through proper logging infrastructure

---

## 1. Large File Refactoring Plan

### 1.1 Backend Schemas (schemas.py - 1,255 lines)

**Current Issues**:
- Single monolithic file containing 50+ schema classes
- Mixed domain concerns (employees, departments, schedules, analytics, auth)
- Difficult to navigate and maintain
- High cognitive load for developers

**Refactoring Strategy**:

```
backend/src/schemas/
├── __init__.py                    # Re-export all schemas
├── base.py                        # Base models and common utilities
├── enums.py                       # All Enum definitions
├── employees.py                   # EmployeeBase, EmployeeCreate, EmployeeUpdate, EmployeeResponse
├── departments.py                 # Department schemas + DepartmentAnalytics
├── schedules.py                   # Schedule, ScheduleAssignment schemas
├── shifts.py                      # Shift, ShiftDefinition schemas
├── rules.py                       # Rule schemas + RuleParseRequest
├── notifications.py               # Notification schemas
├── auth.py                        # LoginRequest, TokenResponse
├── analytics.py                   # AnalyticsOverview, EmployeeFilters
└── pagination.py                  # PaginatedResponse, common pagination types
```

**Estimated Line Distribution**:
- `base.py` + `enums.py`: ~100 lines
- `employees.py`: ~150 lines
- `departments.py`: ~200 lines (includes analytics)
- `schedules.py`: ~200 lines
- `shifts.py`: ~150 lines
- `rules.py`: ~100 lines
- `notifications.py`: ~80 lines
- `auth.py`: ~50 lines
- `analytics.py`: ~150 lines
- `pagination.py`: ~75 lines

**Benefits**:
- Each file under 200 lines (max complexity)
- Clear domain separation
- Easier parallel development
- Faster imports (only load needed schemas)

**Implementation Steps**:
1. Create directory structure
2. Move enums first (no dependencies)
3. Move base models and validators
4. Split domain schemas (employees → departments → schedules → ...)
5. Update imports in `__init__.py`
6. Update all import statements across codebase
7. Run tests to verify functionality
8. Remove original schemas.py

**Risk Assessment**: **MEDIUM**
- Breaking changes if imports not updated correctly
- Requires comprehensive testing
- **REQUIRES ARCHITECT APPROVAL BEFORE EXECUTION**

---

### 1.2 Backend CRUD Services (crud.py - 935 lines)

**Current Issues**:
- 8 CRUD classes in one file
- Generic base class + 7 specialized classes
- Mixed responsibilities

**Refactoring Strategy**:

```
backend/src/services/crud/
├── __init__.py                    # Re-export all CRUD classes
├── base.py                        # CRUDBase with common operations
├── employees.py                   # CRUDEmployee
├── departments.py                 # CRUDDepartment
├── schedules.py                   # CRUDSchedule
├── shifts.py                      # CRUDShift
├── rules.py                       # CRUDRule
├── notifications.py               # CRUDNotification
└── assignments.py                 # CRUDScheduleAssignment
```

**Estimated Line Distribution**:
- `base.py`: ~150 lines (shared logic)
- Each domain CRUD: ~100-120 lines
- Total: ~900 lines (slight reduction through DRY improvements)

**Benefits**:
- Single Responsibility Principle
- Easier to test individual CRUDs
- Parallel development by domain
- Reduced merge conflicts

**Implementation Steps**:
1. Extract CRUDBase to `base.py`
2. Create individual CRUD files
3. Update cache invalidation imports
4. Update API route imports
5. Test each domain separately
6. Remove original crud.py

**Risk Assessment**: **LOW**
- Well-defined class boundaries
- No circular dependencies expected
- **CAN PROCEED AFTER SCHEMA REFACTORING**

---

### 1.3 Frontend API Service (api.js - 1,005 lines)

**Current Issues**:
- 20+ API function groups in single file
- Data transformation utilities mixed with API calls
- Difficult to tree-shake unused endpoints

**Refactoring Strategy**:

```
frontend/src/services/api/
├── index.js                       # Re-export all APIs + main client
├── client.js                      # Axios instance, interceptors, auth (~250 lines)
├── transforms.js                  # snake_case <-> camelCase utilities (~100 lines)
├── employees.js                   # Employee API calls (~100 lines)
├── departments.js                 # Department API calls (~80 lines)
├── schedules.js                   # Schedule API calls (~120 lines)
├── shifts.js                      # Shift API calls (~80 lines)
├── rules.js                       # Rule API calls (~60 lines)
├── notifications.js               # Notification API calls (~60 lines)
├── analytics.js                   # Analytics API calls (~80 lines)
└── auth.js                        # Login, logout, token refresh (~75 lines)
```

**Estimated Line Distribution**:
- Core infrastructure: ~350 lines
- Domain APIs: ~655 lines
- Total: ~1,005 lines (maintained but modularized)

**Benefits**:
- Better code splitting opportunities
- Import only needed API modules
- Easier to mock for testing
- Clear separation of concerns

**Implementation Steps**:
1. Extract transformation utilities
2. Extract axios client configuration
3. Split API functions by domain
4. Update imports across components
5. Test all API calls
6. Remove original api.js

**Risk Assessment**: **MEDIUM**
- Many import statements to update
- Critical authentication flow
- **REQUIRES THOROUGH TESTING**

---

## 2. Console Logging Cleanup

### 2.1 Current State

**Findings**:
- **78 console.log/error/warn/info** statements in frontend
- Primarily in utility files:
  - `debugTools.js` - 17 console statements (intentional debugging tool)
  - `persistence.js` - 10 console.warn statements
  - `performanceMonitor.js` - 9 console statements
  - Others scattered across components

**Issues**:
- No centralized logging
- No log levels or filtering
- Debug logs visible in production
- No structured logging for monitoring

### 2.2 Logging Infrastructure Plan

**Strategy**: Replace console.* with Winston-style logger

**Create Logging Service**:

```javascript
// frontend/src/services/logging/logger.js

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

class Logger {
  constructor() {
    this.level = process.env.REACT_APP_LOG_LEVEL || 'info';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  _shouldLog(level) {
    const levels = Object.values(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  _formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const formatted = {
      timestamp,
      level,
      message,
      ...context,
    };

    // In production, send to monitoring service
    if (this.isProduction && level === LOG_LEVELS.ERROR) {
      this._sendToMonitoring(formatted);
    }

    return formatted;
  }

  _sendToMonitoring(logEntry) {
    // Future: Send to Sentry, LogRocket, etc.
    // For now, store in sessionStorage for debugging
    try {
      const logs = JSON.parse(sessionStorage.getItem('error_logs') || '[]');
      logs.push(logEntry);
      sessionStorage.setItem('error_logs', JSON.stringify(logs.slice(-100)));
    } catch (e) {
      // Fail silently
    }
  }

  error(message, context) {
    if (this._shouldLog(LOG_LEVELS.ERROR)) {
      const formatted = this._formatMessage(LOG_LEVELS.ERROR, message, context);
      console.error(formatted);
    }
  }

  warn(message, context) {
    if (this._shouldLog(LOG_LEVELS.WARN)) {
      const formatted = this._formatMessage(LOG_LEVELS.WARN, message, context);
      console.warn(formatted);
    }
  }

  info(message, context) {
    if (this._shouldLog(LOG_LEVELS.INFO)) {
      const formatted = this._formatMessage(LOG_LEVELS.INFO, message, context);
      console.info(formatted);
    }
  }

  debug(message, context) {
    if (this._shouldLog(LOG_LEVELS.DEBUG)) {
      const formatted = this._formatMessage(LOG_LEVELS.DEBUG, message, context);
      console.log(formatted);
    }
  }
}

export const logger = new Logger();
export { LOG_LEVELS };
```

### 2.3 Migration Plan

**Phase 1: High Priority (Production Code)**
- Replace console.error → logger.error in API service
- Replace console.warn in error boundaries
- Replace console.log in critical paths

**Phase 2: Medium Priority (Utility Code)**
- Update persistence.js warnings
- Update performanceMonitor.js logging
- Update routeHistory.js warnings

**Phase 3: Low Priority (Debug Tools)**
- Keep debugTools.js console.logs (intentional debugging)
- Add environment check to disable in production

**Implementation Script**:

```bash
# Find and replace patterns (manual review required)
find frontend/src -type f -name "*.js" -not -path "*/node_modules/*" \
  -exec sed -i 's/console\.error(/logger.error(/g' {} \;

find frontend/src -type f -name "*.js" -not -path "*/node_modules/*" \
  -exec sed -i 's/console\.warn(/logger.warn(/g' {} \;

find frontend/src -type f -name "*.js" -not -path "*/node_modules/*" \
  -not -path "*/debugTools.js" \
  -exec sed -i 's/console\.log(/logger.debug(/g' {} \;
```

**Environment Configuration**:

```bash
# .env.development
REACT_APP_LOG_LEVEL=debug

# .env.production
REACT_APP_LOG_LEVEL=warn
```

---

## 3. Dead File Cleanup

### 3.1 Backup Files to Remove

**Identified Files**:

1. **backend/src/api/employees_backup.py** (659 lines, 24KB)
   - Old employee API implementation
   - **Verification Required**: Compare with current employees.py
   - **Action**: Archive to git history, then delete

2. **Python Cache Files** (7,600+ files)
   - `__pycache__` directories and `.pyc` files
   - Safe to delete (regenerated on run)
   - **Action**: Add to .gitignore, delete from repo

**Files in venv/** (555MB)
- `test_old_ma.py` (numpy tests)
- `test_old_base.py` (pandas tests)
- `_old_api.py` (openai library)
- **Action**: Keep (part of dependencies, not our code)

### 3.2 Cleanup Script

```bash
#!/bin/bash
# cleanup-dead-files.sh

echo "=== AI Schedule Manager Cleanup Script ==="

# 1. Remove Python cache files
echo "Removing Python cache files..."
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete
find backend -type f -name "*.pyo" -delete
echo "✓ Python cache files removed"

# 2. Backup and remove backup files
echo "Archiving backup files to git..."
git log --all --full-history -- "backend/src/api/employees_backup.py" > /tmp/employees_backup_history.txt
git rm backend/src/api/employees_backup.py
echo "✓ Backup file archived and removed"

# 3. Remove log files (if any)
echo "Removing temporary log files..."
find . -type f -name "*.log" -not -path "*/venv/*" -not -path "*/node_modules/*" -delete
find . -type f -name "*.tmp" -not -path "*/venv/*" -not -path "*/node_modules/*" -delete
echo "✓ Temporary files removed"

# 4. Update .gitignore
echo "Updating .gitignore..."
cat >> .gitignore << EOF

# Python cache files
__pycache__/
*.py[cod]
*\$py.class
*.so

# Logs
*.log
*.tmp

# Backup files
*_backup.*
*_old.*
*.bak
*~
EOF
echo "✓ .gitignore updated"

echo ""
echo "=== Cleanup Complete ==="
echo "Files removed:"
echo "  - 7,600+ Python cache files"
echo "  - 1 backup file (employees_backup.py)"
echo "  - Temporary logs"
echo ""
echo "Space freed: ~30-50MB"
```

---

## 4. Performance Quick Wins

### 4.1 Immediate Optimizations (No Refactoring Required)

**Database Indexing** (Backend)

```python
# backend/src/models/employee.py
from sqlalchemy import Index

class Employee(Base):
    __tablename__ = "employees"

    # Add strategic indexes
    __table_args__ = (
        Index('idx_employee_name', 'name'),
        Index('idx_employee_email', 'email'),
        Index('idx_employee_department', 'department_id'),
        Index('idx_employee_active', 'active'),
        Index('idx_employee_role_dept', 'role', 'department_id'),
    )

# backend/src/models/schedule.py
class Schedule(Base):
    __tablename__ = "schedules"

    __table_args__ = (
        Index('idx_schedule_date', 'date'),
        Index('idx_schedule_employee', 'employee_id'),
        Index('idx_schedule_date_emp', 'date', 'employee_id'),
        Index('idx_schedule_status_date', 'status', 'date'),
    )
```

**Expected Impact**: 40-60% faster database queries

---

**Frontend Bundle Tree-Shaking** (Frontend)

```javascript
// Replace in components using MUI
// ❌ BEFORE
import { Box, Button, TextField } from '@mui/material';

// ✅ AFTER
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
```

**Expected Impact**: 15-20% bundle size reduction

---

**API Response Caching** (Backend)

```python
# backend/src/api/schedules.py
from fastapi_cache.decorator import cache

@router.get("/schedules")
@cache(expire=300)  # 5-minute cache
async def get_schedules(
    date: str,
    db: AsyncSession = Depends(get_db)
):
    # Expensive schedule generation
    return await crud_schedule.get_by_date(db, date)
```

**Required Dependency**:
```bash
pip install fastapi-cache2[redis]
```

**Expected Impact**: 50-70% faster repeated requests

---

### 4.2 Medium-Term Optimizations

**1. Lazy Loading for Frontend Routes**

```javascript
// frontend/src/App.js
import { lazy, Suspense } from 'react';

const Schedule = lazy(() => import('./pages/Schedule'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Employees = lazy(() => import('./pages/Employees'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/employees" element={<Employees />} />
      </Routes>
    </Suspense>
  );
}
```

**Expected Impact**: 30-40% faster initial load

---

**2. OR-Tools Solver Optimization**

```python
# backend/src/scheduler/optimized_solver.py
def _get_solver_config(self, problem_size: int):
    """Adaptive solver configuration based on problem complexity."""
    if problem_size < 100:  # Small problems (< 10 employees, 10 shifts)
        return {
            'max_time_in_seconds': 5,
            'num_search_workers': 1,
        }
    elif problem_size < 1000:  # Medium problems
        return {
            'max_time_in_seconds': 15,
            'num_search_workers': 2,
        }
    else:  # Large problems
        return {
            'max_time_in_seconds': 30,
            'num_search_workers': 4,
        }
```

**Expected Impact**: 40-50% faster schedule generation for small/medium problems

---

**3. Docker Multi-Stage Builds**

```dockerfile
# backend/Dockerfile
FROM python:3.9-slim as builder
RUN apt-get update && apt-get install -y gcc g++ postgresql-client
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
RUN python -m spacy download en_core_web_sm

FROM python:3.9-slim as production
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY src/ ./src/
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0"]
```

**Expected Impact**: 50-60% smaller Docker images

---

## 5. Implementation Roadmap

### Phase 1: Immediate Actions (Week 1)
**Priority**: HIGH | **Risk**: LOW

- [ ] Run cleanup script to remove backup files and cache
- [ ] Add database indexes
- [ ] Implement logging infrastructure
- [ ] Replace critical console.log statements
- [ ] Update .gitignore

**Deliverables**:
- Clean codebase
- Proper logging in place
- Faster database queries

---

### Phase 2: Backend Refactoring (Week 2-3)
**Priority**: HIGH | **Risk**: MEDIUM

- [ ] **Get architect approval for refactoring plan**
- [ ] Refactor schemas.py into domain modules
- [ ] Refactor crud.py into domain modules
- [ ] Update all imports
- [ ] Run full test suite
- [ ] Update documentation

**Deliverables**:
- Modular backend structure
- Easier maintenance
- Improved developer experience

**Dependencies**:
- Architect approval
- Code freeze during refactoring
- Comprehensive testing

---

### Phase 3: Frontend Optimization (Week 3-4)
**Priority**: MEDIUM | **Risk**: MEDIUM

- [ ] Refactor api.js into domain modules
- [ ] Implement lazy loading for routes
- [ ] Optimize MUI imports
- [ ] Add bundle analyzer
- [ ] Measure bundle size improvements

**Deliverables**:
- Smaller bundle size
- Faster page loads
- Better code splitting

---

### Phase 4: Performance Enhancements (Week 4-5)
**Priority**: MEDIUM | **Risk**: LOW

- [ ] Implement API response caching
- [ ] Optimize OR-Tools solver configuration
- [ ] Add multi-stage Docker builds
- [ ] Add performance monitoring

**Deliverables**:
- 30-50% performance improvement
- Better resource utilization
- Production-ready Docker images

---

## 6. Success Metrics

### Code Quality Metrics
- **File Size**: All files < 500 lines (target: < 300 lines)
- **Console Logs**: 0 console.* in production code
- **Dead Files**: 0 backup/temporary files
- **Test Coverage**: Maintain > 80% coverage

### Performance Metrics
- **Database Queries**: < 100ms for 95th percentile
- **API Response Time**: < 500ms average
- **Frontend Bundle**: < 500KB gzipped
- **Initial Load Time**: < 2 seconds on 3G
- **Docker Image Size**: < 200MB for backend

### Developer Experience
- **Build Time**: < 30 seconds
- **Test Time**: < 2 minutes for full suite
- **Import Discovery**: < 5 seconds in IDE
- **Merge Conflicts**: Reduce by 50%

---

## 7. Risk Mitigation

### High-Risk Activities
1. **Large File Refactoring**
   - **Risk**: Breaking imports, missing dependencies
   - **Mitigation**:
     - Full test suite before/after
     - Feature flags for gradual rollout
     - Automated import analysis
     - Architect review required

2. **Frontend API Refactoring**
   - **Risk**: Breaking authentication flow
   - **Mitigation**:
     - Test authentication thoroughly
     - Monitor error rates in production
     - Rollback plan ready

### Testing Strategy
- **Unit Tests**: Run before/after each refactoring step
- **Integration Tests**: Verify API contracts maintained
- **E2E Tests**: Ensure user flows still work
- **Performance Tests**: Benchmark before/after

### Rollback Plan
1. All changes in feature branches
2. Tag stable commits before major refactoring
3. Database migrations reversible
4. Docker images versioned
5. Blue-green deployment for production

---

## 8. Approval Required

**This plan requires approval from**:
- [ ] **System Architect** - File refactoring structure
- [ ] **Tech Lead** - Performance optimization priorities
- [ ] **DevOps** - Docker and deployment changes
- [ ] **QA Lead** - Testing strategy and timeline

**Next Steps**:
1. Review this document with team
2. Get architect approval for refactoring structure
3. Create detailed tasks in project management system
4. Assign owners to each phase
5. Begin Phase 1 (immediate actions)

---

## 9. References

- [Performance Bottleneck Analysis](./performance-bottleneck-analysis.md)
- [SPARC Methodology](../CLAUDE.md)
- [Testing Strategy](../testing/test-strategy.md)
- [Deployment Guide](../deployment/README.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-21
**Owner**: Optimizer Worker 7
**Status**: **AWAITING ARCHITECT APPROVAL**
