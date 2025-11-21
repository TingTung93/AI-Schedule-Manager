"""
Database Index Documentation

This module documents all database indexes across the application,
their purpose, and performance characteristics.

Index Naming Convention:
- idx_<table>_<columns> - Composite or single column indexes
- ix_<table>_<column> - Auto-generated SQLAlchemy indexes
- uq_<table>_<column> - Unique constraint indexes
- fk_<table>_<column>_<ref_table> - Foreign key indexes
- pk_<table> - Primary key indexes

"""

from typing import Dict, List


class IndexDocumentation:
    """Documentation for database indexes and their performance characteristics."""

    # Critical Performance Indexes (Added in migration 004)
    PERFORMANCE_INDEXES = {
        "idx_assignment_lookup": {
            "table": "schedule_assignments",
            "columns": ["employee_id", "schedule_id", "shift_id"],
            "type": "composite",
            "purpose": "Optimize assignment lookups by employee, schedule, and shift",
            "queries_optimized": [
                "Find all assignments for an employee in a specific schedule",
                "Check if employee is assigned to a specific shift",
                "Detect scheduling conflicts for employees",
                "Generate employee schedules"
            ],
            "performance_impact": "10-100x faster for assignment queries",
            "usage_frequency": "Very High - Used in every assignment operation",
            "migration": "004_add_performance_indexes",
        },
        "idx_shift_date_dept": {
            "table": "shifts",
            "columns": ["date", "department_id"],
            "type": "composite",
            "purpose": "Optimize shift queries by date and department",
            "queries_optimized": [
                "Find all shifts for a department on a specific date",
                "Generate department schedules for a date range",
                "Check department shift coverage",
                "Department-specific shift assignment"
            ],
            "performance_impact": "5-20x faster for date/department queries",
            "usage_frequency": "High - Used in schedule generation and department views",
            "migration": "004_add_performance_indexes",
        },
        "idx_schedule_week_range": {
            "table": "schedules",
            "columns": ["week_start", "week_end"],
            "type": "composite",
            "purpose": "Optimize schedule queries by week period",
            "queries_optimized": [
                "Find schedules for a specific week",
                "Check for overlapping schedules",
                "Calendar view queries",
                "Week-based schedule filtering"
            ],
            "performance_impact": "3-10x faster for week range queries",
            "usage_frequency": "High - Used in calendar and schedule list views",
            "migration": "004_add_performance_indexes",
        },
        "idx_employee_email": {
            "table": "employees",
            "columns": ["email"],
            "type": "single",
            "unique": True,
            "purpose": "Ensure fast and unique employee email lookups",
            "queries_optimized": [
                "User authentication by email",
                "Employee search by email",
                "Duplicate email checking",
                "User account validation"
            ],
            "performance_impact": "2-5x faster for email lookups",
            "usage_frequency": "Very High - Used in every login and user lookup",
            "migration": "004_add_performance_indexes",
            "note": "May already exist from model definition"
        },
    }

    # Existing Model-Defined Indexes
    MODEL_INDEXES = {
        # Employee model indexes
        "ix_employees_role_active": {
            "table": "employees",
            "columns": ["role", "is_active"],
            "type": "composite",
            "purpose": "Filter employees by role and active status"
        },
        "ix_employees_qualifications": {
            "table": "employees",
            "columns": ["qualifications"],
            "type": "gin",
            "purpose": "Search employees by qualifications (PostgreSQL array)"
        },
        "ix_employees_availability": {
            "table": "employees",
            "columns": ["availability"],
            "type": "gin",
            "purpose": "Search employees by availability (JSONB)"
        },

        # Schedule model indexes
        "ix_schedules_week_period": {
            "table": "schedules",
            "columns": ["week_start", "week_end"],
            "type": "composite",
            "purpose": "Query schedules by week period"
        },
        "ix_schedules_status_created": {
            "table": "schedules",
            "columns": ["status", "created_at"],
            "type": "composite",
            "purpose": "Filter schedules by status and sort by creation date"
        },
        "ix_schedules_creator_status": {
            "table": "schedules",
            "columns": ["created_by", "status"],
            "type": "composite",
            "purpose": "Find schedules created by a user with specific status"
        },
        "ix_schedules_parent_version": {
            "table": "schedules",
            "columns": ["parent_schedule_id", "version"],
            "type": "composite",
            "purpose": "Track schedule versions and revisions"
        },

        # Shift model indexes
        "ix_shifts_date_time": {
            "table": "shifts",
            "columns": ["date", "start_time", "end_time"],
            "type": "composite",
            "purpose": "Query shifts by date and time range"
        },
        "ix_shifts_type_priority": {
            "table": "shifts",
            "columns": ["shift_type", "priority"],
            "type": "composite",
            "purpose": "Filter shifts by type and sort by priority"
        },
        "ix_shifts_requirements": {
            "table": "shifts",
            "columns": ["requirements"],
            "type": "gin",
            "purpose": "Search shifts by requirements (JSONB)"
        },
        "ix_shifts_date_type": {
            "table": "shifts",
            "columns": ["date", "shift_type"],
            "type": "composite",
            "purpose": "Find shifts by date and type"
        },

        # ScheduleAssignment model indexes
        "ix_assignments_schedule_status": {
            "table": "schedule_assignments",
            "columns": ["schedule_id", "status"],
            "type": "composite",
            "purpose": "Find assignments for a schedule by status"
        },
        "ix_assignments_employee_status": {
            "table": "schedule_assignments",
            "columns": ["employee_id", "status"],
            "type": "composite",
            "purpose": "Find employee assignments by status"
        },
        "ix_assignments_shift_status": {
            "table": "schedule_assignments",
            "columns": ["shift_id", "status"],
            "type": "composite",
            "purpose": "Find shift assignments by status"
        },
        "ix_assignments_employee_schedule": {
            "table": "schedule_assignments",
            "columns": ["employee_id", "schedule_id"],
            "type": "composite",
            "purpose": "Find all assignments for an employee in a schedule"
        },
        "ix_assignments_date_employee": {
            "table": "schedule_assignments",
            "columns": ["assigned_at", "employee_id"],
            "type": "composite",
            "purpose": "Track assignment history by date and employee"
        },
        "ix_assignments_auto_assigned": {
            "table": "schedule_assignments",
            "columns": ["auto_assigned", "status"],
            "type": "composite",
            "purpose": "Filter auto-assigned assignments by status"
        },
    }

    # Unique Constraints (act as indexes)
    UNIQUE_CONSTRAINTS = {
        "uq_schedule_employee_shift": {
            "table": "schedule_assignments",
            "columns": ["schedule_id", "employee_id", "shift_id"],
            "purpose": "Prevent duplicate assignments of same employee to same shift in same schedule"
        },
    }

    @classmethod
    def get_index_summary(cls) -> Dict[str, List[Dict]]:
        """Get a summary of all indexes by table."""
        summary = {}

        # Combine all indexes
        all_indexes = {
            **cls.PERFORMANCE_INDEXES,
            **cls.MODEL_INDEXES,
        }

        for index_name, index_info in all_indexes.items():
            table = index_info["table"]
            if table not in summary:
                summary[table] = []
            summary[table].append({
                "name": index_name,
                "columns": index_info["columns"],
                "type": index_info.get("type", "btree"),
                "purpose": index_info["purpose"]
            })

        return summary

    @classmethod
    def get_critical_indexes(cls) -> List[str]:
        """Get list of critical performance indexes."""
        return list(cls.PERFORMANCE_INDEXES.keys())

    @classmethod
    def get_index_info(cls, index_name: str) -> Dict:
        """Get detailed information about a specific index."""
        all_indexes = {
            **cls.PERFORMANCE_INDEXES,
            **cls.MODEL_INDEXES,
        }
        return all_indexes.get(index_name, {})


# Index Maintenance Guidelines
MAINTENANCE_GUIDELINES = """
Database Index Maintenance Guidelines
=====================================

1. Monitoring Index Usage
   - Check index usage with pg_stat_user_indexes
   - Identify unused indexes consuming space
   - Monitor index bloat and fragmentation

2. Index Rebuild Schedule
   - Rebuild indexes monthly for high-traffic tables
   - Use REINDEX CONCURRENTLY to avoid downtime
   - Schedule during low-traffic periods

3. Adding New Indexes
   - Always test on production-like data volumes
   - Use CREATE INDEX CONCURRENTLY for production
   - Document purpose and queries optimized
   - Add to this module's documentation

4. Index Types by Use Case
   - BTREE: Standard for equality and range queries (default)
   - GIN: PostgreSQL arrays and JSONB queries
   - HASH: Equality comparisons only (rarely used)
   - BRIN: Large tables with natural ordering

5. Performance Monitoring
   - Track query execution times before/after indexes
   - Monitor index size growth
   - Check for index scan vs sequential scan ratio
   - Use EXPLAIN ANALYZE to verify index usage

6. Common Issues
   - Over-indexing slows INSERT/UPDATE operations
   - Partial indexes for filtered queries
   - Expression indexes for computed columns
   - Covering indexes to avoid table lookups

SQL Commands for Monitoring:
----------------------------

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check index size
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE 'pg_toast%';

-- Check table bloat
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
                   pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"""


# Query Optimization Patterns
QUERY_PATTERNS = """
Query Optimization Patterns Using These Indexes
================================================

1. Assignment Lookups (idx_assignment_lookup)
   ------------------------------------------
   # Find employee assignments in a schedule
   SELECT * FROM schedule_assignments
   WHERE employee_id = ? AND schedule_id = ? AND shift_id = ?;

   # This uses the composite index for instant lookups

2. Shift by Date and Department (idx_shift_date_dept)
   --------------------------------------------------
   # Get all shifts for a department on a date
   SELECT * FROM shifts
   WHERE date = ? AND department_id = ?;

   # Perfect for department daily schedules

3. Schedule Week Range (idx_schedule_week_range)
   --------------------------------------------
   # Find schedules in a week range
   SELECT * FROM schedules
   WHERE week_start >= ? AND week_end <= ?;

   # Optimal for calendar views

4. Email Authentication (idx_employee_email)
   ----------------------------------------
   # User login lookup
   SELECT * FROM employees WHERE email = ?;

   # Critical for fast authentication

Best Practices:
--------------
- Always include indexed columns in WHERE clauses
- Use exact matches on indexed columns when possible
- Consider index column order for composite indexes
- Use EXPLAIN ANALYZE to verify index usage
- Monitor slow query logs for optimization opportunities
"""


if __name__ == "__main__":
    # Print index summary
    print("Database Index Summary")
    print("=" * 50)

    for table, indexes in IndexDocumentation.get_index_summary().items():
        print(f"\n{table}:")
        for idx in indexes:
            print(f"  - {idx['name']}: {', '.join(idx['columns'])}")
            print(f"    Purpose: {idx['purpose']}")

    print("\n\nCritical Performance Indexes:")
    print("=" * 50)
    for idx_name in IndexDocumentation.get_critical_indexes():
        info = IndexDocumentation.get_index_info(idx_name)
        print(f"\n{idx_name}:")
        print(f"  Table: {info['table']}")
        print(f"  Columns: {', '.join(info['columns'])}")
        print(f"  Impact: {info['performance_impact']}")
        print(f"  Usage: {info['usage_frequency']}")
