# Backend Hang Issue - Recurring Timeout After Hard Refresh

## Problem Description

After a hard refresh (Ctrl+F5), the frontend shows timeout errors again:
```
Network error: timeout of 10000ms exceeded
Login failed: Network error. Please check your connection.
```

The backend becomes "unhealthy" after 20-30 minutes of runtime and stops responding to requests, even though:
- ✅ No stuck database connections (PostgreSQL is healthy)
- ✅ No database deadlocks
- ✅ Database configuration has proper timeouts
- ❌ Backend Python process freezes/hangs

## Symptoms

1. Backend works fine after restart
2. After 20-30 minutes, Docker healthcheck starts failing
3. Container status shows "(unhealthy)"
4. All HTTP requests timeout (health endpoint, login, etc.)
5. Nginx logs show HTTP 499 (Client Closed Connection)
6. Backend logs show no new errors - process is completely frozen

## Root Cause Analysis

### What We've Ruled Out

- ❌ NOT stuck PostgreSQL connections (verified with `pg_stat_activity`)
- ❌ NOT database deadlocks (no long-running queries)
- ❌ NOT nginx timeout (configured with 300s timeout)
- ❌ NOT axios timeout (configured with 30s timeout)

### Likely Causes (Requires Further Investigation)

1. **Async Event Loop Deadlock**
   - FastAPI/Starlette async operations might be blocking
   - No available event loop workers to process new requests
   - Could be caused by await operations that never complete

2. **Database Session Pool Exhaustion (Python Side)**
   - Even though PostgreSQL shows healthy connections
   - SQLAlchemy async sessions might not be releasing properly
   - Python holds onto sessions even though DB released them

3. **Memory Leak**
   - Python process gradually consuming all available memory
   - Eventually becomes unresponsive
   - Need to monitor memory usage over time

4. **Background Task Blocking**
   - Rate limit cleanup task (`_periodic_cleanup()` in rate_limit.py:177)
   - Runs `while True` loop every 5 minutes
   - If cleanup task blocks, entire app freezes

5. **WebSocket Connections**
   - Found `while True` loops in websocket code
   - If WebSocket connections aren't properly closed
   - Could exhaust resources

## Evidence

### Docker Container Status
```bash
$ docker ps | grep backend
c3a64d1b90ba   ai-schedule-manager-backend   ... Up 28 minutes (unhealthy) ...
```

### Nginx Logs (HTTP 499 - Client Timeout)
```
172.18.0.1 - - "POST /api/auth/login HTTP/1.1" 499 0
172.18.0.1 - - "GET /api/auth/me HTTP/1.1" 499 0
```

### Backend Logs (No Errors During Hang)
- No stack traces
- No error messages
- Process appears completely frozen

### Code Issues Found

**TypeError in notifications API:**
```python
File "/app/src/api/notifications.py", line 29, in get_notifications
    result = await crud_notification.get_multi_with_filters(...)
TypeError: CRUDNotification.get_multi_with_filters() got an unexpected keyword argument 'user_id'
```

**Background Tasks Creating Infinite Loops:**
```python
# /backend/src/middleware/rate_limit.py:98
asyncio.create_task(self._periodic_cleanup())  # Created at import time!

# Line 177:
async def _periodic_cleanup(self):
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        for limiter in self.limiters.values():
            await limiter.cleanup_old_buckets()
```

## Temporary Workarounds

### Option 1: Manual Restart (Current Workaround)
```bash
docker restart ai-schedule-backend
```

### Option 2: Automated Health Monitor (Recommended)

Run the monitoring script in a separate terminal:
```bash
cd /home/peter/AI-Schedule-Manager
./scripts/monitor-backend.sh
```

This script:
- Checks backend health every 30 seconds
- Automatically restarts after 2 consecutive failures
- Logs all restart events with timestamps

To run in background:
```bash
nohup ./scripts/monitor-backend.sh > logs/backend-monitor.log 2>&1 &
```

### Option 3: Reduce Healthcheck Interval

Detect failures faster by checking more frequently:

**Edit docker-compose.yml** (backend section):
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 15s      # Changed from 30s
  timeout: 5s        # Changed from 10s
  retries: 2         # Changed from 3
  start_period: 40s
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

## Permanent Fix (Requires Code Changes)

### 1. Fix Background Task Creation

**Problem**: Background tasks created at import time, not startup time.

**File**: `backend/src/middleware/rate_limit.py:98`

**Change:**
```python
# BEFORE (Line 98):
asyncio.create_task(self._periodic_cleanup())

# AFTER:
# Remove this line from __init__, move to startup event in main.py
```

**File**: `backend/src/main.py`

**Add:**
```python
@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    from .middleware.rate_limit import RateLimitMiddleware
    # Start cleanup task properly
    if hasattr(app.state, 'rate_limiter'):
        asyncio.create_task(app.state.rate_limiter._periodic_cleanup())
```

### 2. Add Timeout to Background Tasks

**File**: `backend/src/middleware/rate_limit.py:175`

**Change:**
```python
async def _periodic_cleanup(self):
    """Periodically clean up old rate limit buckets."""
    while True:
        try:
            # Add timeout to prevent blocking forever
            await asyncio.wait_for(
                self._cleanup_iteration(),
                timeout=30.0  # 30 second max cleanup time
            )
        except asyncio.TimeoutError:
            logger.error("Rate limit cleanup timed out")
        except Exception as e:
            logger.error(f"Rate limit cleanup error: {e}")

        await asyncio.sleep(300)  # Run every 5 minutes

async def _cleanup_iteration(self):
    """Single cleanup iteration"""
    for limiter in self.limiters.values():
        await limiter.cleanup_old_buckets()
```

### 3. Fix Notifications API

**File**: `backend/src/api/notifications.py:29`

Check the function signature and fix the parameter name mismatch.

### 4. Add Session Pool Monitoring

Add logging to track session pool usage:

**File**: `backend/src/database.py`

**Add after engine creation:**
```python
import logging
logger = logging.getLogger(__name__)

# Log pool status periodically
async def log_pool_status():
    while True:
        await asyncio.sleep(60)  # Every minute
        pool = engine.pool
        logger.info(f"DB Pool: size={pool.size()}, checked_in={pool.checkedin()}, checked_out={pool.checkedout()}, overflow={pool.overflow()}")
```

Register in `main.py`:
```python
@app.on_event("startup")
async def startup_event():
    from .database import log_pool_status
    asyncio.create_task(log_pool_status())
```

### 5. Add Memory Monitoring

Track memory usage to identify leaks:

```python
import psutil
import os

async def log_memory_usage():
    process = psutil.Process(os.getpid())
    while True:
        await asyncio.sleep(300)  # Every 5 minutes
        mem = process.memory_info()
        logger.info(f"Memory: RSS={mem.rss / 1024**2:.1f}MB, VMS={mem.vms / 1024**2:.1f}MB")
```

## Investigation Steps

### 1. Check Memory Usage Over Time

Monitor backend container memory:
```bash
watch -n 5 'docker stats ai-schedule-backend --no-stream --format "{{.MemUsage}} {{.CPUPerc}}"'
```

### 2. Enable Debug Logging

**File**: `backend/src/database.py:19`

```python
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # ✅ Already enabled - shows all SQL
    # ...
)
```

### 3. Monitor Event Loop Health

Add to main.py:
```python
import asyncio

async def monitor_event_loop():
    while True:
        await asyncio.sleep(30)
        loop = asyncio.get_event_loop()
        tasks = [t for t in asyncio.all_tasks(loop) if not t.done()]
        logger.info(f"Event loop: {len(tasks)} active tasks")
        if len(tasks) > 100:
            logger.warning(f"High number of pending tasks: {len(tasks)}")
```

### 4. Check for Connection Leaks

```bash
# While backend is running but before it hangs:
docker exec ai-schedule-db psql -U postgres -d schedule_manager -c "
SELECT count(*) as total, state
FROM pg_stat_activity
WHERE datname = 'schedule_manager'
GROUP BY state;"
```

Expected: 5-10 connections (4-6 idle, 1-3 active)
Problem: 30+ connections (approaching pool limit)

## Testing Plan

1. **Reproduce the hang** - Monitor logs and metrics when it happens
2. **Check memory growth** - Does RSS increase over time?
3. **Check connection pool** - Do sessions accumulate?
4. **Check event loop** - Do pending tasks accumulate?
5. **Test with background tasks disabled** - Comment out rate limiter, check if still hangs

## Related Documentation

- `FRONTEND_TIMEOUT_ISSUE_ROOT_CAUSE.md` - Previous database connection leak fix
- `SESSION_SUMMARY_TIMEOUT_FIXES.md` - Complete fix history

## Current Status

**Immediate**: Use manual restart or monitoring script to auto-restart
**Short-term**: Investigate and fix background task creation
**Long-term**: Add comprehensive monitoring and logging

The issue is **reproducible but cause unknown** - requires systematic debugging with added monitoring to identify exact cause.
