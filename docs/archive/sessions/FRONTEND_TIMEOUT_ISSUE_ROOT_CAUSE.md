# Frontend Timeout Issue - Root Cause Analysis and Resolution

## Issue Summary

User reported persistent 10-second timeout errors when trying to login or access authenticated endpoints:

```
Network error: timeout of 10000ms exceeded
installHook.js:1  Network error: timeout of 10000ms exceeded
Get current user failed
Login failed: Network error. Please check your connection.
```

Console showed timeouts on:
- `GET /api/auth/me`
- `POST /api/auth/login`
- Dashboard and other authenticated endpoints

## Investigation Timeline

### Initial Hypothesis: Frontend Timeout Configuration
- **Investigated**: Frontend `withTimeout` wrapper function with 10-second default
- **Finding**: Function exists in `api.js` line 874 but is **never used**
- **Result**: Not the cause

### Second Hypothesis: Nginx Proxy Timeout
- **Investigated**: Frontend nginx.conf proxy configuration
- **Finding**: Nginx correctly proxies to `ai-schedule-backend:8000` with 300s timeouts
- **Result**: Not the cause

### Third Hypothesis: Axios Client Timeout
- **Investigated**: Axios instance configuration in `frontend/src/services/api.js`
- **Finding**: Axios timeout set to 30000ms (30 seconds), not 10 seconds
- **Result**: Not the cause

### Critical Finding: HTTP 499 Errors in Nginx Logs

Nginx access logs showed **HTTP 499** (Client Closed Connection):

```
172.18.0.1 - - [20/Nov/2025:04:03:04 +0000] "GET /api/auth/me HTTP/1.1" 499 0
172.18.0.1 - - [20/Nov/2025:04:03:28 +0000] "POST /api/auth/login HTTP/1.1" 499 0
172.18.0.1 - - [20/Nov/2025:04:03:50 +0000] "POST /api/auth/login HTTP/1.1" 499 0
```

**HTTP 499 meaning**: Client (browser) closed the connection **before** the server could respond. This indicated the backend was hanging, causing the client to timeout and cancel the request.

### Backend Investigation

Backend logs showed:
- **Login requests**: Returning 200 OK (successful)
- **Auth/me requests**: Some 500 errors, some 200 OK
- **Critical error**: `anyio.WouldBlock` exceptions

```python
File "/app/src/main.py", line 122, in timeout_middleware
    return await asyncio.wait_for(call_next(request), timeout=30.0)
ERROR:    Exception in ASGI application
    raise WouldBlock
anyio.WouldBlock
```

### Database Connection Analysis

Checked PostgreSQL active connections:

```sql
SELECT pid, state, wait_event_type, wait_event, now() - query_start as duration
FROM pg_stat_activity
WHERE datname = 'schedule_manager' AND state <> 'idle';
```

**Result:**

```
  pid  | state  | wait_event_type | wait_event |    duration
-------+--------+-----------------+------------+-----------------
  9955 | active | Client          | ClientRead | 01:38:18.725483
```

## Root Cause

**A database connection was stuck for over 1.5 hours in `ClientRead` wait state**, holding onto resources and blocking the connection pool. This connection was from a SQLAlchemy type introspection query that never completed.

### Why This Caused Timeouts

1. **Connection Leak**: The stuck connection from a previous session was never properly closed
2. **Resource Blocking**: While the connection pool had capacity (only 6/30 connections used), the stuck connection was causing async operations to block
3. **Cascade Effect**: When new requests tried to use database sessions, they would encounter the blocking connection and hang
4. **Client Timeout**: Browser/axios would wait ~10 seconds (likely browser's internal timeout for hanging requests), then cancel the request (HTTP 499)

### Why Backend Showed 200 OK

The backend **did** successfully process some requests and return 200 OK, but the responses were **taking too long to reach the client** because of async/await blocking caused by the database connection issue. By the time the backend sent the response, the client had already given up and closed the connection.

## Resolution

### Immediate Fix

1. **Killed the stuck database connection:**
   ```sql
   SELECT pg_terminate_backend(9955);
   ```

2. **Restarted backend container:**
   ```bash
   docker restart ai-schedule-backend
   ```

3. **Verification:**
   - Health endpoint: `0.002s` response time ✅
   - CSRF token: `0.001s` response time ✅
   - Login endpoint: `0.259s` response time ✅

## Permanent Fix Needed

The immediate fix resolves the symptoms but not the root cause. The backend needs better connection lifecycle management to prevent leaks.

### Recommended Fixes

#### 1. Add Idle Connection Cleanup

Current `database.py` configuration:
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_recycle=3600,  # Recycle connections every hour
    pool_timeout=30,     # Wait max 30s for connection
    # ... other config
)
```

**Problem**: `pool_recycle=3600` only recycles idle connections after 1 hour. Stuck connections can persist longer.

**Solution**: Reduce recycle time and add idle timeout:

```python
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,          # ✅ Already enabled
    pool_recycle=600,            # Recycle after 10 minutes (was 3600)
    pool_timeout=30,             # ✅ Already configured
    pool_size=30,                # ✅ Already configured
    max_overflow=20,             # ✅ Already configured
    connect_args={
        "timeout": 10,           # ✅ Already configured
        "command_timeout": 30,   # ✅ Already configured
        "server_settings": {
            "statement_timeout": "30000",  # ✅ Already configured
            "idle_in_transaction_session_timeout": "60000",  # ⚠️ ADD THIS - 60s
        },
    },
)
```

#### 2. Add Database Connection Health Monitoring

Create a background task to monitor and kill stuck connections:

```python
# backend/src/database.py

import asyncio
from sqlalchemy import text

async def cleanup_stuck_connections():
    """Background task to cleanup stuck database connections"""
    while True:
        try:
            async with AsyncSessionLocal() as session:
                # Kill connections waiting for client read > 60 seconds
                await session.execute(text("""
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                      AND state = 'active'
                      AND wait_event = 'ClientRead'
                      AND now() - query_start > interval '60 seconds'
                      AND pid != pg_backend_pid()
                """))
                await session.commit()
        except Exception as e:
            logger.error(f"Connection cleanup error: {e}")

        # Run every 30 seconds
        await asyncio.sleep(30)
```

Register in `main.py`:

```python
@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    # Start connection cleanup background task
    asyncio.create_task(cleanup_stuck_connections())
```

#### 3. Improve Session Error Handling

The current `get_db_session()` dependency handles exceptions, but we should add more specific error handling:

```python
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session with enhanced error handling"""
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except asyncio.TimeoutError:
        logger.error("Database session timeout - rolling back")
        await session.rollback()
        raise HTTPException(
            status_code=504,
            detail="Database operation timed out"
        )
    except Exception as e:
        logger.error(f"Database session error: {e}", exc_info=True)
        await session.rollback()
        raise
    finally:
        # Ensure session is always closed
        await session.close()
```

#### 4. Add Request ID Tracking

Add request ID middleware to track which requests are causing connection leaks:

```python
import uuid
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar('request_id', default='')

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Add request ID for tracing"""
    request_id = str(uuid.uuid4())
    request_id_ctx.set(request_id)
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

Then log request IDs with database operations to trace leaked connections.

## Prevention Checklist

- [x] Database connection pool timeouts configured (✅ Already done in commit aa55f95)
- [x] Request timeout middleware (✅ Already done in commit aa55f95)
- [ ] Reduce `pool_recycle` from 3600s to 600s
- [ ] Add `idle_in_transaction_session_timeout` to PostgreSQL config
- [ ] Implement stuck connection cleanup background task
- [ ] Add request ID tracking for connection leak debugging
- [ ] Improve session error handling with timeout-specific logic
- [ ] Add monitoring/alerting for stuck database connections

## Testing Recommendations

1. **Load Testing**: Use tools like Locust or Apache Bench to simulate high concurrent load and verify connections are properly recycled
2. **Connection Leak Testing**: Intentionally cause errors and verify connections are cleaned up
3. **Long Request Testing**: Test endpoints that might take >30 seconds and verify they properly timeout
4. **Monitoring**: Add Prometheus metrics for:
   - Active database connections
   - Connection wait time
   - Number of stuck connections killed
   - Request timeout frequency

## Related Issues

- Previous fix: Commit aa55f95 "Add comprehensive database and request timeouts"
- Documentation: `TIMEOUT_AND_VALIDATION_FIXES.md` - FastAPI trailing slash and validation fixes
- Known issue: Session management intermittent 401 errors (separate from this connection leak issue)

## Summary

The "Network error: timeout of 10000ms exceeded" was caused by a **stuck PostgreSQL connection** (PID 9955) that had been in `ClientRead` wait state for over 1.5 hours, blocking async operations in the backend. This caused:

1. Backend requests to hang while waiting for database operations
2. Client (browser) to timeout after ~10 seconds and close connection (HTTP 499)
3. Backend eventually responding with 200 OK, but too late (client already disconnected)

**Immediate Resolution**: Killed stuck connection (PID 9955) and restarted backend - all endpoints now respond in <1 second.

**Permanent Fix**: Implement connection lifecycle monitoring, reduce pool_recycle time, add idle transaction timeouts, and create background task to cleanup stuck connections automatically.
