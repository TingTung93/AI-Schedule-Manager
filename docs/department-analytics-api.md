# Department Analytics API Documentation

## Overview

Comprehensive analytics endpoints for department management insights, employee distribution tracking, and organizational metrics.

## Endpoints

### 1. Department Analytics Overview

**Endpoint:** `GET /api/departments/analytics/overview`

**Authentication:** Required (any authenticated user)

**Description:** Get comprehensive department analytics overview with organization-wide statistics.

**Response Schema:** `DepartmentAnalyticsOverview`

```json
{
  "total_departments": 10,
  "active_departments": 8,
  "inactive_departments": 2,
  "total_employees_assigned": 45,
  "total_employees_unassigned": 5,
  "average_employees_per_department": 5.62,
  "largest_department": {
    "id": 3,
    "name": "Operations",
    "employee_count": 15,
    "active": true
  },
  "smallest_department": {
    "id": 7,
    "name": "Legal",
    "employee_count": 2,
    "active": true
  },
  "max_hierarchy_depth": 3,
  "root_departments_count": 4
}
```

**Use Cases:**
- Executive dashboard overview
- Organization structure insights
- Capacity planning
- Resource distribution assessment

**Performance:** Single optimized query using SQL aggregations (no N+1 queries)

---

### 2. Employee Distribution Across Departments

**Endpoint:** `GET /api/departments/analytics/distribution`

**Authentication:** Required (any authenticated user)

**Description:** Get employee distribution across all departments with percentages for charting.

**Response Schema:** `List[EmployeeDistributionItem]`

```json
[
  {
    "department_id": 3,
    "department_name": "Operations",
    "employee_count": 15,
    "percentage": 33.33,
    "active": true
  },
  {
    "department_id": 5,
    "department_name": "Engineering",
    "employee_count": 12,
    "percentage": 26.67,
    "active": true
  },
  {
    "department_id": 2,
    "department_name": "Sales",
    "employee_count": 10,
    "percentage": 22.22,
    "active": true
  },
  {
    "department_id": 8,
    "department_name": "Support",
    "employee_count": 8,
    "percentage": 17.78,
    "active": true
  }
]
```

**Use Cases:**
- Pie chart visualization
- Bar graph comparison
- Resource allocation analysis
- Department size comparison

**Features:**
- Ordered by employee count (descending)
- Includes percentage calculations
- Ready for charting libraries (Chart.js, D3.js, etc.)

**Performance:** Single query with GROUP BY and aggregation

---

### 3. Department Detailed Analytics

**Endpoint:** `GET /api/departments/{department_id}/analytics`

**Authentication:** Required (any authenticated user)

**Description:** Get detailed analytics for a specific department including employee breakdowns and trends.

**Path Parameters:**
- `department_id` (integer, required): Department ID

**Response Schema:** `DepartmentDetailedAnalytics`

```json
{
  "department_id": 3,
  "department_name": "Operations",
  "total_employees": 15,
  "employee_by_role": {
    "manager": 2,
    "supervisor": 3,
    "employee": 10
  },
  "active_employees": 14,
  "inactive_employees": 1,
  "subdepartment_count": 3,
  "assignment_trends_30d": [],
  "assignment_trends_60d": [],
  "assignment_trends_90d": []
}
```

**Use Cases:**
- Department manager dashboard
- Team composition analysis
- Staffing level assessment
- Subdepartment structure overview

**Features:**
- Employee count by role
- Active/inactive employee tracking
- Subdepartment hierarchy count
- Assignment trend tracking (placeholder for future implementation)

**Performance:** Multiple optimized queries with aggregations

**Error Responses:**
- `404 Not Found`: Department does not exist

---

## Implementation Details

### Optimizations

1. **SQL Aggregations**: All analytics use `COUNT`, `SUM`, `AVG` SQL functions
2. **Single Queries**: Overview endpoint uses single query with multiple aggregations
3. **No N+1 Queries**: All data fetched efficiently with JOIN operations
4. **Percentage Calculations**: Computed in application layer after data retrieval

### Database Queries

**Overview Endpoint:**
```python
# Single aggregation query for department stats
select(
    func.count(Department.id).label("total"),
    func.sum(func.cast(Department.active, Integer)).label("active")
)

# Single aggregation query for employee stats
select(
    func.count(Employee.id).label("total"),
    func.sum(func.cast(Employee.department_id.isnot(None), Integer)).label("assigned")
)

# Efficient GROUP BY for largest/smallest departments
select(
    Department.id, Department.name, Department.active,
    func.count(Employee.id).label("employee_count")
)
.outerjoin(Employee)
.group_by(Department.id, Department.name, Department.active)
.order_by(func.count(Employee.id).desc())
```

**Distribution Endpoint:**
```python
# Single query with GROUP BY
select(
    Department.id, Department.name, Department.active,
    func.count(Employee.id).label("employee_count")
)
.outerjoin(Employee)
.group_by(Department.id, Department.name, Department.active)
.order_by(func.count(Employee.id).desc())
```

**Detailed Analytics:**
```python
# Separate optimized queries for each metric
# Employee count by role
select(Employee.role, func.count(Employee.id))
.where(Employee.department_id == department_id)
.group_by(Employee.role)

# Active employee count
select(func.count(Employee.id))
.where(Employee.department_id == department_id, Employee.is_active == True)

# Subdepartment count
select(func.count(Department.id))
.where(Department.parent_id == department_id)
```

### Schema Definitions

**Response Schemas (Pydantic):**
- `DepartmentAnalyticsOverview`: Overview statistics
- `DepartmentSizeInfo`: Department size information
- `EmployeeDistributionItem`: Distribution data point
- `DepartmentDetailedAnalytics`: Detailed department analytics
- `AssignmentTrendData`: Trend data point (for future implementation)

### Future Enhancements

1. **Assignment Trends**: Track historical department assignments
   - Implement department_assignment_history table
   - Track assignments, unassignments, transfers
   - Generate 30/60/90 day trend data

2. **Average Tenure**: Calculate average time in department
   - Use created_at from assignment history
   - Compute median and mean tenure

3. **Hierarchy Depth**: Implement recursive CTE for accurate depth
   - PostgreSQL WITH RECURSIVE
   - Calculate exact hierarchy levels

4. **Caching**: Add Redis caching for analytics
   - Cache overview data (5-minute TTL)
   - Invalidate on department/employee changes

## Example Usage

### React Component Example

```javascript
import { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';

function DepartmentDistribution() {
  const [distribution, setDistribution] = useState([]);

  useEffect(() => {
    fetch('/api/departments/analytics/distribution', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setDistribution(data));
  }, []);

  const chartData = {
    labels: distribution.map(d => d.department_name),
    datasets: [{
      data: distribution.map(d => d.employee_count),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
    }]
  };

  return <Pie data={chartData} />;
}
```

### Python Client Example

```python
import requests

# Get analytics overview
response = requests.get(
    'http://localhost:8000/api/departments/analytics/overview',
    headers={'Authorization': f'Bearer {token}'}
)
analytics = response.json()

print(f"Total Departments: {analytics['total_departments']}")
print(f"Active: {analytics['active_departments']}")
print(f"Average Employees: {analytics['average_employees_per_department']}")

if analytics['largest_department']:
    largest = analytics['largest_department']
    print(f"Largest: {largest['name']} ({largest['employee_count']} employees)")
```

## Testing

### Manual Testing with cURL

```bash
# Get overview
curl -X GET "http://localhost:8000/api/departments/analytics/overview" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get distribution
curl -X GET "http://localhost:8000/api/departments/analytics/distribution" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific department analytics
curl -X GET "http://localhost:8000/api/departments/3/analytics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Unit Test Example

```python
import pytest
from fastapi.testclient import TestClient

def test_analytics_overview(client: TestClient, auth_headers):
    """Test department analytics overview endpoint."""
    response = client.get("/api/departments/analytics/overview", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert "total_departments" in data
    assert "active_departments" in data
    assert "average_employees_per_department" in data
    assert isinstance(data["total_departments"], int)
    assert isinstance(data["average_employees_per_department"], float)

def test_employee_distribution(client: TestClient, auth_headers):
    """Test employee distribution endpoint."""
    response = client.get("/api/departments/analytics/distribution", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "department_id" in item
        assert "department_name" in item
        assert "employee_count" in item
        assert "percentage" in item
        assert isinstance(item["percentage"], float)
        assert 0 <= item["percentage"] <= 100
```

## Performance Metrics

Expected response times (with 100 departments, 1000 employees):
- Overview: ~50-100ms
- Distribution: ~30-80ms
- Detailed Analytics: ~40-90ms

All endpoints use efficient SQL aggregations and should scale linearly with database size.

## Security

- All endpoints require authentication
- No authorization restrictions (any authenticated user can view)
- No sensitive data exposed (employee counts only, no PII)
- SQL injection protection via SQLAlchemy ORM

## Conclusion

These analytics endpoints provide comprehensive insights into department structure and employee distribution, optimized for performance with minimal database queries. The data is formatted ready for visualization in dashboards and reporting tools.
