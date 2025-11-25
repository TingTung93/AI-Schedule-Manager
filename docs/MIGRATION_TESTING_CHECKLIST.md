# Migration Testing Checklist

## Overview
This checklist ensures all database migrations are tested thoroughly before production deployment.

## Pre-Testing Setup

### 1. Create Clean Test Database
```bash
# Drop existing test database if it exists
dropdb test_employee_system 2>/dev/null || true

# Create fresh test database
createdb test_employee_system

# Verify database creation
psql -l | grep test_employee_system
```

### 2. Verify Migration Files
```bash
cd /home/peter/AI-Schedule-Manager/backend

# List all migration files
ls -la migrations/versions/

# Expected migrations (10+):
# - Initial schema
# - Add extended_fields
# - Add indexes
# - Add audit fields
# - Add department_assignment_history table
# - Add performance indexes
# - Add CSRF security
# - Add rate limiting tables
```

## Migration Testing Protocol

### Phase 1: Forward Migration Testing

#### Test 1: Run All Migrations
```bash
cd /home/peter/AI-Schedule-Manager/backend

# Set test database connection
export DATABASE_URL="postgresql://postgres:password@localhost/test_employee_system"

# Run all migrations
alembic upgrade head

# Expected output:
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# INFO  [alembic.runtime.migration] Will assume transactional DDL.
# INFO  [alembic.runtime.migration] Running upgrade -> xxxxx, description
```

**Checklist**:
- [ ] No errors during migration
- [ ] All migrations applied successfully
- [ ] Alembic version table updated
- [ ] Migration logs reviewed

#### Test 2: Verify All Tables Created
```bash
# List all tables
psql test_employee_system -c "\dt"

# Expected tables:
# - alembic_version
# - users
# - employees
# - department_assignment_history
# - rate_limit_violations (if security migrations included)
# - audit_logs (if audit migrations included)
```

**Checklist**:
- [ ] `users` table exists
- [ ] `employees` table exists
- [ ] `department_assignment_history` table exists
- [ ] `alembic_version` table exists
- [ ] All expected tables present

#### Test 3: Verify Table Schemas
```bash
# Check users table schema
psql test_employee_system -c "\d users"

# Expected columns:
# - id (INTEGER, PRIMARY KEY)
# - username (VARCHAR, NOT NULL, UNIQUE)
# - email (VARCHAR, NOT NULL, UNIQUE)
# - hashed_password (VARCHAR, NOT NULL)
# - role (VARCHAR, DEFAULT 'employee')
# - is_active (BOOLEAN, DEFAULT true)
# - created_at (TIMESTAMP)
# - updated_at (TIMESTAMP)

# Check employees table schema
psql test_employee_system -c "\d employees"

# Expected columns:
# - id (INTEGER, PRIMARY KEY)
# - user_id (INTEGER, FOREIGN KEY -> users.id)
# - first_name (VARCHAR, NOT NULL)
# - last_name (VARCHAR, NOT NULL)
# - department (VARCHAR)
# - position (VARCHAR)
# - hire_date (DATE)
# - extended_fields (JSONB)
# - created_at (TIMESTAMP)
# - updated_at (TIMESTAMP)

# Check department_assignment_history table schema
psql test_employee_system -c "\d department_assignment_history"

# Expected columns:
# - id (INTEGER, PRIMARY KEY)
# - employee_id (INTEGER, FOREIGN KEY -> employees.id)
# - old_department (VARCHAR)
# - new_department (VARCHAR, NOT NULL)
# - changed_by (INTEGER, FOREIGN KEY -> users.id)
# - changed_at (TIMESTAMP, NOT NULL)
# - reason (TEXT)
```

**Checklist**:
- [ ] All columns present in users table
- [ ] All columns present in employees table
- [ ] All columns present in department_assignment_history table
- [ ] NOT NULL constraints correct
- [ ] DEFAULT values correct
- [ ] JSONB type for extended_fields

#### Test 4: Verify Indexes
```bash
# List all indexes
psql test_employee_system -c "\di"

# Expected indexes:
# - users_username_idx (UNIQUE)
# - users_email_idx (UNIQUE)
# - employees_user_id_idx
# - employees_department_idx
# - employees_hire_date_idx
# - department_assignment_history_employee_id_idx
# - department_assignment_history_changed_at_idx
```

**Checklist**:
- [ ] Primary key indexes created
- [ ] Unique constraints indexed
- [ ] Foreign key columns indexed
- [ ] Search columns indexed (department, hire_date)
- [ ] Performance-critical columns indexed

#### Test 5: Verify Foreign Keys
```bash
# Check foreign key constraints
psql test_employee_system -c "
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
"

# Expected foreign keys:
# - employees.user_id -> users.id
# - department_assignment_history.employee_id -> employees.id
# - department_assignment_history.changed_by -> users.id
```

**Checklist**:
- [ ] employees.user_id references users.id
- [ ] department_assignment_history.employee_id references employees.id
- [ ] department_assignment_history.changed_by references users.id
- [ ] CASCADE rules configured correctly

### Phase 2: Data Integrity Testing

#### Test 6: Insert Sample Data
```bash
cd /home/peter/AI-Schedule-Manager/backend

# Run seed script
python scripts/seed_test_data.py

# Expected output:
# ✅ Created 10 users
# ✅ Created 10 employees
# ✅ Created 5 department assignments
```

**Checklist**:
- [ ] Users inserted successfully
- [ ] Employees inserted successfully
- [ ] Department assignments created
- [ ] No foreign key violations
- [ ] No unique constraint violations

#### Test 7: Verify Data Integrity
```bash
# Run data integrity verification
python scripts/verify_data_integrity.py

# Expected checks:
# - All employees have valid user_id
# - All department assignments have valid employee_id
# - All department assignments have valid changed_by
# - extended_fields is valid JSON
# - No orphaned records
```

**Checklist**:
- [ ] All foreign key relationships valid
- [ ] No orphaned records
- [ ] JSONB data valid
- [ ] Timestamps populated correctly
- [ ] Default values applied

### Phase 3: Rollback Testing

#### Test 8: Single Migration Rollback
```bash
cd /home/peter/AI-Schedule-Manager/backend

# Get current migration version
alembic current

# Rollback one migration
alembic downgrade -1

# Verify rollback
alembic current

# Upgrade back
alembic upgrade +1

# Verify data still intact
python scripts/verify_data_integrity.py
```

**Checklist**:
- [ ] Downgrade executes successfully
- [ ] Table/column removed correctly
- [ ] Upgrade restores schema
- [ ] Data preserved during rollback cycle
- [ ] No errors in logs

#### Test 9: Full Rollback
```bash
# Rollback all migrations
alembic downgrade base

# Verify all tables removed (except alembic_version)
psql test_employee_system -c "\dt"

# Re-apply all migrations
alembic upgrade head

# Verify schema restored
psql test_employee_system -c "\dt"
```

**Checklist**:
- [ ] All migrations rollback successfully
- [ ] Database returns to base state
- [ ] Re-migration succeeds
- [ ] Schema identical after re-migration

### Phase 4: Migration Performance Testing

#### Test 10: Migration Performance
```bash
# Time migration execution
time alembic upgrade head

# Expected performance:
# - Initial schema: < 5 seconds
# - Index creation: < 10 seconds per index
# - Total migration time: < 60 seconds
```

**Checklist**:
- [ ] Migration completes within acceptable time
- [ ] No long-running locks
- [ ] Index creation efficient
- [ ] No blocking operations

### Phase 5: Production Simulation

#### Test 11: Migration with Existing Data
```bash
# Insert large dataset
python scripts/seed_large_dataset.py  # 1000+ records

# Run a new migration
alembic upgrade head

# Verify data preserved
python scripts/verify_data_integrity.py

# Check performance impact
python scripts/performance_benchmark.py
```

**Checklist**:
- [ ] Migration handles existing data correctly
- [ ] No data loss during migration
- [ ] Performance acceptable with large dataset
- [ ] Indexes created efficiently

## Final Verification

### Complete Migration Checklist

**Schema Verification**:
- [ ] All 10+ migrations run successfully
- [ ] All tables created with correct schema
- [ ] All columns have correct types
- [ ] All NOT NULL constraints present
- [ ] All DEFAULT values correct
- [ ] JSONB type for extended_fields

**Index Verification**:
- [ ] All primary key indexes created
- [ ] All unique constraint indexes created
- [ ] All foreign key columns indexed
- [ ] All search columns indexed
- [ ] Index names follow convention

**Foreign Key Verification**:
- [ ] employees.user_id → users.id
- [ ] department_assignment_history.employee_id → employees.id
- [ ] department_assignment_history.changed_by → users.id
- [ ] CASCADE rules correct

**Data Integrity Verification**:
- [ ] Sample data inserts successfully
- [ ] No foreign key violations
- [ ] No orphaned records
- [ ] JSONB data valid
- [ ] Timestamps populated

**Rollback Capability**:
- [ ] Single migration rollback works
- [ ] Full rollback to base works
- [ ] Re-migration after rollback works
- [ ] Data preserved during rollback cycle
- [ ] No migration errors in logs

**Performance Verification**:
- [ ] Total migration time < 60 seconds
- [ ] Index creation efficient
- [ ] No long-running locks
- [ ] Migration handles large datasets

## Post-Migration Validation

```bash
# Final validation script
python scripts/production_validation.py

# Expected output:
# ✅ Database connectivity: PASS
# ✅ All migrations applied: PASS
# ✅ Schema validation: PASS
# ✅ Data integrity: PASS
# ✅ Index validation: PASS
# ✅ Foreign key validation: PASS
# ✅ Performance acceptable: PASS
#
# 🎉 Production Ready: 7/7 checks passed
```

## Migration Approval

**Sign-off Requirements**:
- [ ] All checklist items completed
- [ ] No critical issues identified
- [ ] Performance acceptable
- [ ] Rollback capability verified
- [ ] Data integrity confirmed

**Approved By**: _________________
**Date**: _________________
**Production Deployment Date**: _________________

## Troubleshooting

### Common Issues

**Issue**: Migration fails with "relation already exists"
```bash
# Solution: Reset alembic version
psql test_employee_system -c "DELETE FROM alembic_version;"
alembic stamp head
```

**Issue**: Foreign key constraint violation
```bash
# Solution: Check insertion order
# Users must be created before employees
# Employees must be created before department assignments
```

**Issue**: Index creation timeout
```bash
# Solution: Create indexes concurrently (requires manual SQL)
CREATE INDEX CONCURRENTLY idx_name ON table_name(column_name);
```

**Issue**: JSONB invalid format
```bash
# Solution: Validate JSON before insertion
SELECT '{"key": "value"}'::jsonb;
```

## Next Steps

After successful migration testing:
1. Document any migration-specific issues
2. Update deployment plan with migration steps
3. Schedule production migration window
4. Prepare rollback scripts
5. Notify stakeholders of deployment schedule
