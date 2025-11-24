# Constraint Solver Integration

## Overview

The AI Schedule Manager now uses a real constraint-based scheduling algorithm powered by Google OR-Tools instead of mock random data generation. This provides optimal schedule generation that respects all business rules and employee constraints.

## What Changed

### Before (Mock Implementation)
- Random assignment of employees to shifts
- No constraint checking
- Mock optimization metrics
- No conflict detection

### After (Real Constraint Solver)
- OR-Tools CP-SAT solver for optimal assignments
- Hard constraints: availability, qualifications, max hours, rest periods
- Soft constraints: preferences, workload balance, weekend fairness
- Real-time conflict detection
- Actual optimization with measurable improvements

## Architecture

### Components

1. **ScheduleOptimizer** (`/backend/src/scheduler/constraint_solver.py`)
   - Core constraint solving logic
   - OR-Tools integration
   - Objective function optimization
   - Constraint application

2. **ScheduleGenerationService** (`/backend/src/services/schedule_service.py`)
   - Database integration layer
   - Data transformation (DB models ↔ Solver objects)
   - Schedule persistence
   - Conflict detection

3. **API Endpoints** (`/backend/src/main.py`)
   - `POST /api/schedule/generate` - Generate new schedules
   - `POST /api/schedule/optimize` - Optimize existing schedules
   - `GET /api/schedule/conflicts` - Check for scheduling conflicts

## Key Features

### Hard Constraints (Must be satisfied)

1. **Shift Coverage**
   - Each shift has minimum and maximum employee requirements
   - Only qualified employees can be assigned

2. **Employee Availability**
   - Employees only assigned when available
   - Respects availability patterns from database

3. **Working Hours**
   - Max hours per week enforced
   - Min hours per week respected

4. **No Double Booking**
   - Employees cannot work overlapping shifts
   - Same-day shift overlap detection

5. **Rest Periods**
   - Minimum 8 hours rest between shifts (configurable)
   - Prevents burnout and legal compliance

### Soft Constraints (Optimized, not required)

1. **Preference Matching**
   - Preferred shift types (morning, afternoon, evening, night)
   - Preferred days of the week
   - Penalty-based optimization

2. **Workload Balance**
   - Minimizes variance in hours between employees
   - Fair distribution of work

3. **Weekend Fairness**
   - Equal distribution of weekend shifts
   - Prevents same employees always working weekends

## API Usage

### Generate Schedule

```http
POST /api/schedule/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "start_date": "2025-11-13",
  "end_date": "2025-11-20",
  "constraints": {
    "prefer_full_time_first": true,
    "minimize_overtime": true
  }
}
```

**Response (Success):**
```json
{
  "status": "optimal",
  "start_date": "2025-11-13",
  "end_date": "2025-11-20",
  "schedule": [
    {
      "shift_id": "1_2025-11-13",
      "date": "2025-11-13",
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "assigned_employees": [
        {"id": "1", "name": "Alice Smith"},
        {"id": "3", "name": "Charlie Brown"}
      ]
    }
  ],
  "saved_assignments": 45,
  "conflicts": [],
  "statistics": {
    "solve_time": 2.34,
    "objective_value": 125
  },
  "message": "Generated 45 schedule assignments"
}
```

**Response (Infeasible):**
```json
{
  "status": "infeasible",
  "start_date": "2025-11-13",
  "end_date": "2025-11-20",
  "schedule": [],
  "message": "Could not generate feasible schedule. Try relaxing constraints or adjusting employee availability.",
  "suggestions": [
    "Increase employee availability windows",
    "Reduce required qualifications for some shifts",
    "Add more employees to the system",
    "Reduce the number of shifts or adjust shift times"
  ]
}
```

### Optimize Schedule

```http
POST /api/schedule/optimize
Authorization: Bearer <token>
Content-Type: application/json

{
  "schedule_ids": [101, 102, 103, 104, 105],
  "optimization_goals": ["cost", "coverage", "satisfaction"]
}
```

**Response:**
```json
{
  "status": "optimal",
  "improvements": {
    "total_assignments": 48,
    "coverage_improved": true,
    "conflicts_resolved": 3,
    "workload_balanced": true,
    "coverage_percentage": "95.8%"
  },
  "schedule": [...],
  "statistics": {
    "solve_time": 3.12,
    "objective_value": 98
  },
  "message": "Schedule optimized successfully using constraint-based AI solver"
}
```

### Check Conflicts

```http
GET /api/schedule/conflicts?start_date=2025-11-13&end_date=2025-11-20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "start_date": "2025-11-13",
  "end_date": "2025-11-20",
  "conflicts": [
    {
      "type": "double_booking",
      "employee_id": 5,
      "date": "2025-11-15",
      "shift_ids": [12, 15]
    },
    {
      "type": "qualification_mismatch",
      "employee_id": 8,
      "shift_id": 20,
      "missing_qualifications": ["manager", "supervisor"]
    }
  ],
  "conflict_count": 2,
  "status": "conflicts_found"
}
```

## Data Model Mapping

### Database Employee → Solver Employee

```python
DB Employee {
  id: int
  name: str
  qualifications: List[str]
  availability_pattern: Dict
  max_hours_per_week: int
}

↓ Transform ↓

Solver Employee {
  id: str
  name: str
  qualifications: List[str]
  availability: Dict[str, List[Tuple[time, time]]]
  max_hours_per_week: int
  min_hours_per_week: int
}
```

### Database Shift → Solver Shift

```python
DB Shift Template {
  id: int
  name: str
  shift_type: str
  start_time: time
  end_time: time
  required_staff: int
  required_qualifications: List[str]
}

↓ Generate for each date ↓

Solver Shift {
  id: str (template_id + date)
  date: date
  start_time: time
  end_time: time
  required_qualifications: List[str]
  min_employees: int
  max_employees: int
  shift_type: ShiftType
}
```

## Configuration

The solver can be configured via the `ScheduleOptimizer` config:

```python
optimizer = ScheduleOptimizer(config={
    "max_solve_time": 60,      # Maximum seconds for solving
    "min_rest_hours": 8,        # Minimum rest between shifts
})
```

## Error Handling

The system handles several error cases:

1. **No Employees**: Returns error status with helpful message
2. **No Shifts**: Returns error status
3. **Infeasible**: Solver cannot find valid solution, provides suggestions
4. **Timeout**: Returns best solution found so far (feasible but not optimal)
5. **Exception**: Catches and logs errors, returns error response

## Performance

- **Typical solve time**: 1-5 seconds for weekly schedule
- **Large schedules**: Up to 60 seconds (configurable timeout)
- **Fallback mode**: If OR-Tools not available, uses simple round-robin

## Testing

Run integration tests:

```bash
cd /home/peter/AI-Schedule-Manager/backend
pytest tests/test_schedule_integration.py -v
```

## Future Enhancements

1. **Advanced Constraints**
   - Employee seniority preferences
   - Skill-based pairing requirements
   - Department-specific rules
   - Union contract compliance

2. **Multi-Objective Optimization**
   - Cost minimization
   - Employee satisfaction maximization
   - Coverage quality scoring

3. **Learning from History**
   - Pattern recognition in past schedules
   - Prediction of no-shows
   - Seasonal demand forecasting

4. **Real-Time Updates**
   - WebSocket notifications for schedule changes
   - Live conflict detection as edits are made
   - Instant re-optimization

## Dependencies

- **OR-Tools**: Google's optimization library
- **SQLAlchemy**: Database ORM
- **FastAPI**: Web framework
- **Pydantic**: Data validation

## Troubleshooting

### "No feasible schedule found"

**Causes:**
- Too many constraints
- Insufficient employee availability
- Qualification mismatches
- Overlapping shift requirements

**Solutions:**
1. Review and relax some constraints
2. Add more employees or increase availability
3. Reduce required qualifications
4. Adjust shift times to reduce overlaps

### Slow performance

**Causes:**
- Large date range
- Many employees and shifts
- Complex constraint interactions

**Solutions:**
1. Reduce date range
2. Increase `max_solve_time`
3. Simplify constraints
4. Generate schedules in smaller batches

### Conflicts detected

**Causes:**
- Manual schedule edits
- Database inconsistencies
- Constraint violations

**Solutions:**
1. Use conflict check endpoint before saving
2. Re-run optimization to fix conflicts
3. Review rules for contradictions

## Support

For issues or questions:
- Check logs: `/backend/logs/app.log`
- Review constraint solver code: `/backend/src/scheduler/constraint_solver.py`
- Service layer: `/backend/src/services/schedule_service.py`
- API endpoints: `/backend/src/main.py` (lines 488-616)
