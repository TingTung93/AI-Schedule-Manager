"""
Analytics API endpoints
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from ..dependencies import get_database_session, get_current_user
from ..schemas import AnalyticsOverview
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get analytics overview."""
    # TODO: Replace with actual database queries
    return {
        "totalEmployees": random.randint(20, 50),
        "totalSchedules": random.randint(10, 30),
        "totalHours": random.randint(500, 1500),
        "efficiency": random.uniform(75, 95),
        "overtimeHours": random.randint(10, 50)
    }

@router.get("/labor-costs")
async def get_labor_costs(
    timeRange: str = Query("7d"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get labor costs for time range."""
    # Parse time range
    days = 7
    if timeRange == "30d" or timeRange == "30days":
        days = 30
    elif timeRange == "90d" or timeRange == "90days":
        days = 90
    
    # Generate mock data
    today = datetime.now()
    data = []
    for i in range(days):
        date = today - timedelta(days=days-i-1)
        data.append({
            "date": date.isoformat(),
            "cost": random.uniform(500, 2000)
        })
    
    return {
        "data": data,
        "total": sum(d["cost"] for d in data),
        "average": sum(d["cost"] for d in data) / len(data)
    }

@router.get("/performance")
async def get_performance_metrics(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get employee performance metrics."""
    return {
        "averageRating": random.uniform(4.0, 5.0),
        "completionRate": random.uniform(85, 99),
        "punctuality": random.uniform(90, 99)
    }

@router.get("/efficiency")
async def get_efficiency_metrics(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user)
):
    """Get schedule efficiency metrics."""
    return {
        "utilizationRate": random.uniform(75, 95),
        "schedulingAccuracy": random.uniform(85, 98),
        "costEfficiency": random.uniform(80, 95)
    }
