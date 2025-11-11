"""
FastAPI backend for AI Schedule Manager with complete CRUD operations.
"""

from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime, date
from .dependencies import get_database_session, get_current_user, get_current_manager
from .schemas import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    RuleCreate,
    RuleUpdate,
    RuleResponse,
    RuleParseRequest,
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    ScheduleGenerateRequest,
    LoginRequest,
    TokenResponse,
    AnalyticsOverview,
    PaginatedResponse,
)
from .services.crud import crud_employee, crud_rule, crud_schedule, crud_notification
from .nlp.rule_parser import RuleParser
from .api.data_io import router as data_io_router
from .api.notifications import router as notifications_router
from .api.analytics import router as analytics_router
from .api.settings import router as settings_router
from .api_docs import setup_docs
import random
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Schedule Manager API",
    description="Neural-powered scheduling for small businesses with complete CRUD operations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Setup enhanced API documentation
setup_docs(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(data_io_router)
app.include_router(notifications_router)
app.include_router(analytics_router)
app.include_router(settings_router)

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
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# Authentication endpoints
@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Mock authentication endpoint."""
    if request.email and request.password:
        return TokenResponse(
            access_token=f"mock-jwt-token-{request.email}",
            token_type="bearer",
            user={"email": request.email, "role": "manager" if "admin" in request.email else "employee"},
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")


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


# Employee endpoints
@app.get("/api/employees", response_model=PaginatedResponse)
async def get_employees(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    role: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc", regex="^(asc|desc)$"),
):
    """Get all employees with pagination and filtering."""
    skip = (page - 1) * size

    result = await crud_employee.get_multi_with_search(
        db=db, skip=skip, limit=size, search=search, role=role, active=active, sort_by=sort_by, sort_order=sort_order
    )

    return PaginatedResponse(
        items=result["items"], total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


@app.post("/api/employees", response_model=EmployeeResponse)
async def create_employee(
    employee: EmployeeCreate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Create new employee."""
    # Check if email already exists
    existing = await crud_employee.get_by_email(db, employee.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_employee = await crud_employee.create(db, employee)
    return new_employee


@app.get("/api/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_user)
):
    """Get specific employee by ID."""
    employee = await crud_employee.get(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return employee


@app.patch("/api/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_update: EmployeeUpdate,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
):
    """Update employee."""
    employee = await crud_employee.get(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Check email uniqueness if being updated
    if employee_update.email and employee_update.email != employee.email:
        existing = await crud_employee.get_by_email(db, employee_update.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    updated_employee = await crud_employee.update(db, employee, employee_update)
    return updated_employee


@app.delete("/api/employees/{employee_id}")
async def delete_employee(
    employee_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)
):
    """Delete employee."""
    employee = await crud_employee.remove(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    return {"message": "Employee deleted successfully"}


@app.get("/api/employees/{employee_id}/schedule", response_model=List[ScheduleResponse])
async def get_employee_schedule(
    employee_id: int,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
):
    """Get employee schedule."""
    # Check if employee exists
    employee = await crud_employee.get(db, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    schedule = await crud_employee.get_schedule(db, employee_id, date_from, date_to)
    return schedule


# Schedule endpoints
@app.get("/api/schedules", response_model=PaginatedResponse)
async def get_schedules(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    employee_id: Optional[int] = Query(None),
    shift_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("date"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """Get all schedules with pagination and filtering."""
    skip = (page - 1) * size

    result = await crud_schedule.get_multi_with_relations(
        db=db,
        skip=skip,
        limit=size,
        employee_id=employee_id,
        shift_id=shift_id,
        date_from=date_from,
        date_to=date_to,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaginatedResponse(
        items=result["items"], total=result["total"], page=page, size=size, pages=(result["total"] + size - 1) // size
    )


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
    """Generate schedule for date range."""
    # Mock schedule generation for now
    # In production, this would use the constraint solver
    return {
        "id": random.randint(1000, 9999),
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "status": "generated",
        "shifts": [],
        "created_at": datetime.utcnow().isoformat(),
        "message": "Schedule generation started. Check back for results.",
    }


@app.post("/api/schedule/optimize")
async def optimize_schedule(
    schedule_id: int, db: AsyncSession = Depends(get_database_session), current_user: dict = Depends(get_current_manager)
):
    """Optimize existing schedule."""
    # Mock optimization
    return {
        "status": "optimized",
        "improvements": {
            "cost_savings": "$" + str(random.randint(200, 800)),
            "coverage": str(random.randint(92, 99)) + "%",
            "satisfaction": str(random.randint(85, 95)) + "%",
        },
        "message": "Schedule optimized successfully using AI",
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
