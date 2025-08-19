from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import random

app = FastAPI(
    title="AI Schedule Manager",
    description="Neural-powered scheduling for small businesses",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data storage
rules_db = []
schedules_db = []
employees_db = [
    {"id": 1, "name": "Sarah Johnson", "email": "sarah@test.com", "role": "Server"},
    {"id": 2, "name": "John Smith", "email": "john@test.com", "role": "Cook"},
    {"id": 3, "name": "Mike Davis", "email": "mike@test.com", "role": "Cashier"}
]

# Models
class LoginRequest(BaseModel):
    email: str
    password: str

class RuleRequest(BaseModel):
    rule_text: str

class ScheduleRequest(BaseModel):
    start_date: str
    end_date: str

class Employee(BaseModel):
    name: str
    email: str
    role: str

# Routes
@app.get("/")
async def root():
    return {
        "message": "AI Schedule Manager API",
        "version": "0.1.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/auth/login")
async def login(request: LoginRequest):
    # Mock authentication
    if request.email and request.password:
        return {
            "access_token": "mock-jwt-token-" + request.email,
            "token_type": "bearer",
            "user": {
                "email": request.email,
                "role": "manager" if "admin" in request.email else "employee"
            }
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/rules/parse")
async def parse_rule(request: RuleRequest):
    rule_text = request.rule_text.lower()
    
    # Simple rule parsing logic
    rule_type = "availability"
    if "prefer" in rule_text:
        rule_type = "preference"
    elif "need" in rule_text or "must" in rule_text:
        rule_type = "requirement"
    elif "max" in rule_text or "limit" in rule_text:
        rule_type = "restriction"
    
    # Extract employee name
    employee = "Unknown"
    for emp in employees_db:
        if emp["name"].split()[0].lower() in rule_text:
            employee = emp["name"]
            break
    
    # Extract constraints
    constraints = []
    if "morning" in rule_text:
        constraints.append({"type": "shift", "value": "morning"})
    if "evening" in rule_text or "night" in rule_text:
        constraints.append({"type": "shift", "value": "evening"})
    if "5pm" in rule_text or "17:00" in rule_text:
        constraints.append({"type": "time", "value": "17:00"})
    
    parsed_rule = {
        "id": len(rules_db) + 1,
        "rule_type": rule_type,
        "employee": employee,
        "constraints": constraints,
        "original_text": request.rule_text,
        "created_at": datetime.now().isoformat()
    }
    
    rules_db.append(parsed_rule)
    return parsed_rule

@app.get("/api/rules")
async def get_rules():
    return {"rules": rules_db, "total": len(rules_db)}

@app.post("/api/schedule/generate")
async def generate_schedule(request: ScheduleRequest):
    # Mock schedule generation
    schedule = {
        "id": len(schedules_db) + 1,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "shifts": [],
        "status": "generated",
        "created_at": datetime.now().isoformat()
    }
    
    # Generate mock shifts
    shift_types = ["morning", "afternoon", "evening"]
    for day in range(7):
        for shift_type in shift_types:
            assigned_employees = random.sample(employees_db, min(2, len(employees_db)))
            schedule["shifts"].append({
                "day": day,
                "type": shift_type,
                "employees": [emp["name"] for emp in assigned_employees],
                "start_time": "09:00" if shift_type == "morning" else "13:00" if shift_type == "afternoon" else "17:00",
                "end_time": "13:00" if shift_type == "morning" else "17:00" if shift_type == "afternoon" else "21:00"
            })
    
    schedules_db.append(schedule)
    return schedule

@app.post("/api/schedule/optimize")
async def optimize_schedule(schedule_id: int):
    # Mock optimization
    return {
        "status": "optimized",
        "improvements": {
            "cost_savings": "$" + str(random.randint(200, 800)),
            "coverage": str(random.randint(92, 99)) + "%",
            "satisfaction": str(random.randint(85, 95)) + "%"
        },
        "message": "Schedule optimized successfully using AI"
    }

@app.get("/api/employees")
async def get_employees():
    return {"employees": employees_db, "total": len(employees_db)}

@app.post("/api/employees")
async def create_employee(employee: Employee):
    new_employee = {
        "id": len(employees_db) + 1,
        "name": employee.name,
        "email": employee.email,
        "role": employee.role,
        "created_at": datetime.now().isoformat()
    }
    employees_db.append(new_employee)
    return new_employee

@app.get("/api/analytics/overview")
async def get_analytics():
    return {
        "total_employees": len(employees_db),
        "total_rules": len(rules_db),
        "total_schedules": len(schedules_db),
        "avg_hours_per_week": random.randint(32, 40),
        "labor_cost_trend": "decreasing",
        "optimization_score": random.randint(75, 95)
    }

@app.get("/api/notifications")
async def get_notifications():
    return {
        "notifications": [
            {
                "id": 1,
                "type": "schedule",
                "title": "New Schedule Published",
                "message": "Your schedule for next week is ready",
                "read": False,
                "created_at": datetime.now().isoformat()
            },
            {
                "id": 2,
                "type": "request",
                "title": "Shift Swap Request",
                "message": "John wants to swap shifts with you",
                "read": False,
                "created_at": datetime.now().isoformat()
            }
        ],
        "unread_count": 2
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)