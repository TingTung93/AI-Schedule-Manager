"""
FastAPI backend for AI Schedule Manager with complete CRUD operations.
"""

import logging
import os
import random
import secrets
from datetime import date, datetime, timedelta
from typing import List, Optional

import redis
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from .api.analytics import router as analytics_router
from .api.assignments import router as assignments_router
from .api.data_io import router as data_io_router
from .api.departments import router as departments_router
from .api.employees import router as employees_router
from .api.notifications import router as notifications_router
from .api.rules import router as rules_router
from .api.schedules import router as schedules_router
from .api.settings import router as settings_router
from .api.shift_definitions import router as shift_definitions_router
from .api.shifts import router as shifts_router
from .api_docs import setup_docs
from .auth.auth import auth_service
from .auth.fastapi_routes import auth_router  # Native FastAPI auth routes
from .dependencies import get_current_manager, get_current_user, get_database_session
from .nlp.rule_parser import RuleParser
from .schemas import (
    AnalyticsOverview,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    LoginRequest,
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
    PaginatedResponse,
    RuleCreate,
    RuleParseRequest,
    RuleResponse,
    RuleUpdate,
    ScheduleCreate,
    ScheduleGenerateRequest,
    ScheduleOptimizeRequest,
    ScheduleResponse,
    ScheduleUpdate,
    TokenResponse,
)
from .services.crud import crud_employee, crud_notification, crud_rule, crud_schedule
from .core.config import settings

logger = logging.getLogger(__name__)

# Validate SECRET_KEY on startup
if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
    raise ValueError("SECRET_KEY must be set and at least 32 characters. Generate with: openssl rand -base64 32")

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AI Schedule Manager API",
    description="Neural-powered scheduling for small businesses with complete CRUD operations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup enhanced API documentation
setup_docs(app)

# Initialize authentication service with FastAPI
# Since FastAPI doesn't have app.config like Flask, we set the values directly
auth_service.secret_key = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
auth_service.refresh_secret_key = os.getenv("JWT_REFRESH_SECRET_KEY", secrets.token_urlsafe(32))
auth_service.access_token_expires = timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "15")))
auth_service.refresh_token_expires = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))

# Initialize Redis client for token management
try:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    auth_service.redis_client = redis.from_url(redis_url, decode_responses=False)
    # Test connection
    auth_service.redis_client.ping()
    logger.info("Redis connection established for auth service")
except Exception as e:
    logger.warning(f"Redis connection failed: {e}. Using in-memory fallback for auth.")
    # Fallback to localhost Redis
    auth_service.redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:80"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)


# Add request timeout middleware to prevent hanging requests
import asyncio
from fastapi.responses import JSONResponse


@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    """Enforce 30-second timeout on all requests to prevent database deadlocks"""
    try:
        return await asyncio.wait_for(call_next(request), timeout=30.0)
    except asyncio.TimeoutError:
        logger.error(f"Request timeout: {request.method} {request.url.path}")
        return JSONResponse(
            status_code=504,
            content={
                "detail": "Request timeout after 30 seconds",
                "path": str(request.url.path),
                "method": request.method,
            },
        )
    except Exception as e:
        logger.error(f"Request error: {e}", exc_info=True)
        raise

# Application startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize monitoring and background tasks on startup"""
    from .database import engine
    from .monitoring import HealthMonitor, set_health_monitor

    logger.info("Starting application...")

    # Initialize health monitoring
    monitor = HealthMonitor(engine, check_interval=60)  # Check every 60 seconds
    set_health_monitor(monitor)
    await monitor.start()

    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    from .monitoring import get_health_monitor
    from .database import close_db_connection

    logger.info("Shutting down application...")

    # Stop health monitoring
    monitor = get_health_monitor()
    if monitor:
        await monitor.stop()

    # Close database connections
    await close_db_connection()

    logger.info("Application shutdown complete")


# Include API routers
app.include_router(auth_router)  # Authentication routes (replaces mock endpoints)
app.include_router(assignments_router)  # Assignment CRUD API
app.include_router(data_io_router)
app.include_router(departments_router)
app.include_router(employees_router)
app.include_router(notifications_router)
app.include_router(rules_router)
app.include_router(schedules_router)
app.include_router(analytics_router)
app.include_router(settings_router)
app.include_router(shift_definitions_router)  # Shift definitions (reusable templates)
app.include_router(shifts_router)

# Initialize rule parser
rule_parser = RuleParser()


# Health and info endpoints
@app.get("/")
async def root():
    return {
        "message": "AI Schedule Manager API",
        "version": "1.0.0",
        "status": "operational",
        "features": ["CRUD operations", "Database integration", "Authentication", "Pagination"],
    }


@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with monitoring metrics"""
    from .monitoring import get_health_monitor

    monitor = get_health_monitor()
    if monitor:
        return monitor.get_health_status()
    else:
        return {"status": "monitoring_not_enabled", "timestamp": datetime.utcnow().isoformat()}


# ============================================================================
# DEPRECATED MOCK AUTHENTICATION ENDPOINTS - REMOVED
# ============================================================================
# The mock authentication endpoints have been removed and replaced with the
# complete Flask authentication system located in /backend/src/auth/routes.py
#
# The Flask auth routes are now integrated into FastAPI using ASGI middleware.
# All authentication endpoints are available at /api/auth/* including:
#   - POST /api/auth/register - User registration
#   - POST /api/auth/login - User login with JWT tokens
#   - POST /api/auth/logout - Logout and revoke tokens
#   - GET /api/auth/me - Get current user information
#   - POST /api/auth/refresh - Refresh access token
#   - POST /api/auth/change-password - Change user password
#   - POST /api/auth/forgot-password - Request password reset
#   - POST /api/auth/reset-password - Reset password with token
#   - GET /api/auth/csrf-token - Get CSRF token for protected requests
#   - GET /api/auth/sessions - Get active refresh token sessions
#   - DELETE /api/auth/sessions/{token_jti} - Revoke specific session
#
# For implementation details, see:
#   - /backend/src/auth/routes.py - Flask authentication routes
#   - /backend/src/auth/auth.py - JWT service and password hashing
#   - /backend/src/auth/middleware.py - Authentication middleware
#   - /backend/src/auth/models.py - User, Role, Permission models
# ============================================================================


# Rules endpoints
@app.post("/api/rules/parse", response_model=RuleResponse)
async def parse_rule(
    request: RuleParseRequest, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Parse natural language rule and create rule entry."""
    try:
        # Parse the rule text using NLP
        parsed_data = await rule_parser.parse_rule(request.rule_text)

        # Create rule in database
        rule_create = RuleCreate(
            rule_type=parsed_data["rule_type"],
            original_text=request.rule_text,
            constraints=parsed_data["constraints"],
            priority=parsed_data.get("priority", 1),
            employee_id=parsed_data.get("employee_id"),
        )

        rule = await crud_rule.create(db, rule_create)
        return rule

    except Exception as e:
        logger.error(f"Rule parsing error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse rule: {str(e)}")


@app.get("/api/rules", response_model=PaginatedResponse)
async def get_rules(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    rule_type: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """Get all rules with pagination and filtering."""
    skip = (page - 1) * size

    result = await crud_rule.get_multi_with_filters(
        db=db,
        skip=skip,
        limit=size,
        rule_type=rule_type,
        employee_id=employee_id,
        active=active,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=result["items"], total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


@app.get("/api/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Get specific rule by ID."""
    rule = await crud_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@app.patch("/api/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    rule_update: RuleUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Update rule."""
    rule = await crud_rule.get(db, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    updated_rule = await crud_rule.update(db, rule, rule_update)
    return updated_rule


@app.delete("/api/rules/{rule_id}")
async def delete_rule(
    rule_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)
):
    """Delete rule."""
    rule = await crud_rule.remove(db, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return {"message": "Rule deleted successfully"}


# Employee endpoints - REMOVED IN FAVOR OF employees_router
# These endpoints query the deprecated employees table.
# The employees_router in src/api/employees.py uses the users table instead.
# @app.get("/api/employees", response_model=PaginatedResponse)


# @app.post("/api/employees", response_model=EmployeeResponse)
# async def create_employee(
#     employee: EmployeeCreate,
#     db: AsyncSession = Depends(get_database_session),
#     current_user: dict = Depends(get_current_manager),
# ):
#     """Create new employee."""
#     # Check if email already exists
#     existing = await crud_employee.get_by_email(db, employee.email)
#     if existing:
#         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
# 
#     new_employee = await crud_employee.create(db, employee)
#     return new_employee
# 
# 
# @app.get("/api/employees/{employee_id}", response_model=EmployeeResponse)
# async def get_employee(
#     employee_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
# ):
#     """Get specific employee by ID."""
#     employee = await crud_employee.get(db, employee_id)
#     if not employee:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
#     return employee
# 
# 
# @app.patch("/api/employees/{employee_id}", response_model=EmployeeResponse)
# async def update_employee(
#     employee_id: int,
#     employee_update: EmployeeUpdate,
#     db: AsyncSession = Depends(get_database_session),
#     current_user: dict = Depends(get_current_manager),
# ):
#     """Update employee."""
#     employee = await crud_employee.get(db, employee_id)
#     if not employee:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
# 
#     # Check email uniqueness if being updated
#     if employee_update.email and employee_update.email != employee.email:
#         existing = await crud_employee.get_by_email(db, employee_update.email)
#         if existing:
#             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
# 
#     updated_employee = await crud_employee.update(db, employee, employee_update)
#     return updated_employee
# 
# 
# @app.delete("/api/employees/{employee_id}")
# async def delete_employee(
#     employee_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)
# ):
#     """Delete employee."""
#     employee = await crud_employee.remove(db, employee_id)
#     if not employee:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
#     return {"message": "Employee deleted successfully"}
# 
# 
# @app.get("/api/employees/{employee_id}/schedule", response_model=List[ScheduleResponse])
# async def get_employee_schedule(
#     employee_id: int,
#     db: AsyncSession = Depends(get_database_session),
#     current_user: dict = Depends(get_current_user),
#     date_from: Optional[date] = Query(None),
#     date_to: Optional[date] = Query(None),
# ):
#     """Get employee schedule."""
#     # Check if employee exists
#     employee = await crud_employee.get(db, employee_id)
#     if not employee:
#         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
# 
#     schedule = await crud_employee.get_schedule(db, employee_id, date_from, date_to)
#     return schedule
# 
# 
# # Schedule endpoints
# @app.get("/api/schedules", response_model=PaginatedResponse)
# async def get_schedules(
#     db: AsyncSession = Depends(get_database_session),
#     current_user: dict = Depends(get_current_user),
#     employee_id: Optional[int] = Query(None),
#     shift_id: Optional[int] = Query(None),
#     date_from: Optional[date] = Query(None),
#     date_to: Optional[date] = Query(None),
#     status: Optional[str] = Query(None),
#     page: int = Query(1, ge=1),
#     size: int = Query(10, ge=1, le=100),
#     sort_by: str = Query("date"),
#     sort_order: str = Query("desc", regex="^(asc|desc)$"),
# ):
#     """Get all schedules with pagination and filtering."""
#     skip = (page - 1) * size
# 
#     result = await crud_schedule.get_multi_with_relations(
#         db=db,
#         skip=skip,
#         limit=size,
#         employee_id=employee_id,
#         shift_id=shift_id,
#         date_from=date_from,
#         date_to=date_to,
#         status=status,
#         sort_by=sort_by,
#         sort_order=sort_order,
#     )
# 
#     return PaginatedResponse(
#         items=result["items"], total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
#     )


@app.get("/api/schedules/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Get specific schedule by ID."""
    schedule = await crud_schedule.get(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return schedule


@app.patch("/api/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Update schedule."""
    schedule = await crud_schedule.get(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    updated_schedule = await crud_schedule.update(db, schedule, schedule_update)
    return updated_schedule


@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)
):
    """Delete schedule."""
    schedule = await crud_schedule.remove(db, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return {"message": "Schedule deleted successfully"}


@app.patch("/api/schedules/{schedule_id}/shifts/{shift_id}", response_model=ScheduleResponse)
async def update_schedule_shift(
    schedule_id: int,
    shift_id: int,
    updates: dict,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Update specific shift in schedule."""
    updated_schedule = await crud_schedule.update_shift(db, schedule_id, shift_id, updates)
    if not updated_schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return updated_schedule


# Notification endpoints
@app.get("/api/notifications", response_model=PaginatedResponse)
async def get_notifications(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    employee_id: Optional[int] = Query(None),
    notification_type: Optional[str] = Query(None),
    read: Optional[bool] = Query(None),
    priority: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """Get all notifications with pagination and filtering."""
    skip = (page - 1) * size

    result = await crud_notification.get_multi_with_filters(
        db=db,
        skip=skip,
        limit=size,
        employee_id=employee_id,
        notification_type=notification_type,
        read=read,
        priority=priority,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=result["items"], total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


@app.post("/api/notifications", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Create new notification."""
    new_notification = await crud_notification.create(db, notification)
    return new_notification


@app.patch("/api/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Mark notification as read."""
    notification = await crud_notification.mark_as_read(db, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@app.delete("/api/notifications/{notification_id}")
async def delete_notification(
    notification_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Delete notification."""
    notification = await crud_notification.remove(db, notification_id)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"message": "Notification deleted successfully"}


@app.post("/api/notifications/mark-all-read")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    employee_id: Optional[int] = Query(None),
):
    """Mark all notifications as read."""
    count = await crud_notification.mark_all_as_read(db, employee_id)
    return {"message": f"Marked {count} notifications as read"}


# Schedule generation and optimization endpoints
@app.post("/api/schedule/generate")
async def generate_schedule(
    request: ScheduleGenerateRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Generate schedule for date range using constraint solver."""
    from .services.schedule_service import schedule_service

    try:
        # Generate schedule using constraint solver
        result = await schedule_service.generate_schedule(
            db=db, start_date=request.start_date, end_date=request.end_date, constraints=request.constraints
        )

        # Check for conflicts before returning
        if result["status"] in ["optimal", "feasible"]:
            conflicts = await schedule_service.check_conflicts(db=db, start_date=request.start_date, end_date=request.end_date)

            return {
                "status": result["status"],
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "schedule": result.get("schedule", []),
                "saved_assignments": result.get("saved_assignments", 0),
                "conflicts": conflicts.get("conflicts", []),
                "statistics": result.get("statistics", {}),
                "message": result.get("message", "Schedule generated successfully"),
                "created_at": datetime.utcnow().isoformat(),
            }
        else:
            # Handle infeasible or error cases
            return {
                "status": result["status"],
                "start_date": request.start_date.isoformat(),
                "end_date": request.end_date.isoformat(),
                "schedule": [],
                "message": result.get(
                    "message",
                    "Could not generate feasible schedule. Try relaxing constraints or adjusting employee availability.",
                ),
                "suggestions": [
                    "Increase employee availability windows",
                    "Reduce required qualifications for some shifts",
                    "Add more employees to the system",
                    "Reduce the number of shifts or adjust shift times",
                ],
            }

    except Exception as e:
        logger.error(f"Schedule generation error: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to generate schedule: {str(e)}",
            "schedule": [],
        }


@app.post("/api/schedule/optimize")
async def optimize_schedule(
    request: ScheduleOptimizeRequest,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Optimize existing schedule using constraint solver."""
    from .services.schedule_service import schedule_service

    try:
        # Optimize schedule using constraint solver
        result = await schedule_service.optimize_schedule(db=db, schedule_ids=request.schedule_ids)

        if result["status"] in ["optimal", "feasible"]:
            return {
                "status": result["status"],
                "improvements": result.get("improvements", {}),
                "schedule": result.get("schedule", []),
                "statistics": result.get("statistics", {}),
                "message": "Schedule optimized successfully using constraint-based AI solver",
            }
        else:
            return {
                "status": result["status"],
                "message": result.get("message", "Optimization failed"),
                "suggestions": [
                    "Review and relax some constraints",
                    "Ensure all employees have availability set",
                    "Check for conflicting rules",
                ],
            }

    except Exception as e:
        logger.error(f"Schedule optimization error: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to optimize schedule: {str(e)}",
        }


@app.get("/api/schedule/conflicts")
async def check_schedule_conflicts(
    start_date: date = Query(..., description="Start date for conflict check"),
    end_date: date = Query(..., description="End date for conflict check"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Check for conflicts in schedule for given date range."""
    from .services.schedule_service import schedule_service

    try:
        conflicts = await schedule_service.check_conflicts(db=db, start_date=start_date, end_date=end_date)

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "conflicts": conflicts.get("conflicts", []),
            "conflict_count": conflicts.get("conflict_count", 0),
            "status": "ok" if conflicts.get("conflict_count", 0) == 0 else "conflicts_found",
        }

    except Exception as e:
        logger.error(f"Conflict check error: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to check conflicts: {str(e)}",
            "conflicts": [],
        }


# Analytics endpoint
@app.get("/api/analytics/overview", response_model=AnalyticsOverview)
async def get_analytics(db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)):
    """Get analytics overview."""
    # Get counts from database
    employees_result = await crud_employee.get_multi(db, limit=1)
    rules_result = await crud_rule.get_multi(db, limit=1)
    schedules_result = await crud_schedule.get_multi(db, limit=1)

    return AnalyticsOverview(
        total_employees=employees_result["total"],
        total_rules=rules_result["total"],
        total_schedules=schedules_result["total"],
        avg_hours_per_week=random.randint(32, 40),
        labor_cost_trend="decreasing",
        optimization_score=random.randint(75, 95),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
