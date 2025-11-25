# Migration Guide

## Table of Contents

1. [Overview](#overview)
2. [Database Migrations](#database-migrations)
3. [Backup Procedures](#backup-procedures)
4. [Rollback Procedures](#rollback-procedures)
5. [Migration Testing](#migration-testing)
6. [Production Deployment](#production-deployment)
7. [Zero-Downtime Migrations](#zero-downtime-migrations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers database migration procedures for the AI Schedule Manager system. All database schema changes are managed through Alembic migrations.

### Migration Tools

- **Alembic**: Database migration tool for SQLAlchemy
- **PostgreSQL**: Primary database system
- **SQLAlchemy**: ORM for database operations

### Key Principles

1. **Never modify production database directly**
2. **Always test migrations in staging first**
3. **Always create backups before migrations**
4. **Write reversible migrations when possible**
5. **Document breaking changes**

---

## Database Migrations

### Understanding Alembic

Alembic tracks database schema versions through migration scripts. Each migration has:
- **Revision ID**: Unique identifier (e.g., `abc123`)
- **Upgrade Function**: Applies changes
- **Downgrade Function**: Reverts changes
- **Dependencies**: Links to previous migration

### Migration Workflow

```
Development → Testing → Staging → Production
```

---

### Creating Migrations

#### Auto-Generate from Model Changes

```bash
cd backend

# Generate migration automatically
alembic revision --autogenerate -m "Add employee qualifications field"

# Review generated migration in alembic/versions/
# File: alembic/versions/abc123_add_employee_qualifications_field.py
```

**Important**: Always review auto-generated migrations before applying.

#### Common Issues with Auto-Generation

Auto-generation may miss:
- Data migrations (moving data between columns)
- Index renames
- Custom constraints
- Default value changes

#### Manual Migration Creation

For complex changes, create manual migrations:

```bash
alembic revision -m "Migrate department data to new structure"
```

---

### Example Migrations

#### Adding a Column

```python
"""Add employee qualifications

Revision ID: abc123
Revises: xyz789
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    op.add_column('users',
        sa.Column('qualifications',
                  postgresql.ARRAY(sa.String(100)),
                  nullable=True,
                  server_default='{}'))

def downgrade():
    op.drop_column('users', 'qualifications')
```

#### Adding an Index

```python
"""Add index on department_id

Revision ID: def456
Revises: abc123
"""
from alembic import op

def upgrade():
    op.create_index(
        'ix_users_department_id',
        'users',
        ['department_id']
    )

def downgrade():
    op.drop_index('ix_users_department_id', table_name='users')
```

#### Data Migration

```python
"""Migrate employee data to users table

Revision ID: ghi789
Revises: def456
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

def upgrade():
    # Create temporary reference to tables
    employees = table('employees',
        column('id', sa.Integer),
        column('name', sa.String),
        column('email', sa.String)
    )
    users = table('users',
        column('id', sa.Integer),
        column('first_name', sa.String),
        column('last_name', sa.String),
        column('email', sa.String)
    )

    # Copy data from employees to users
    conn = op.get_bind()

    # Select from old table
    rows = conn.execute(employees.select()).fetchall()

    # Insert into new table
    for row in rows:
        # Split name into first and last
        name_parts = row.name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        conn.execute(
            users.insert().values(
                id=row.id,
                first_name=first_name,
                last_name=last_name,
                email=row.email
            )
        )

def downgrade():
    # Reverse migration
    employees = table('employees',
        column('id', sa.Integer),
        column('name', sa.String),
        column('email', sa.String)
    )
    users = table('users',
        column('id', sa.Integer),
        column('first_name', sa.String),
        column('last_name', sa.String),
        column('email', sa.String)
    )

    conn = op.get_bind()
    rows = conn.execute(users.select()).fetchall()

    for row in rows:
        full_name = f"{row.first_name} {row.last_name}".strip()
        conn.execute(
            employees.insert().values(
                id=row.id,
                name=full_name,
                email=row.email
            )
        )
```

---

### Applying Migrations

#### Development Environment

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Apply one migration at a time
alembic upgrade +1

# View current version
alembic current

# View migration history
alembic history --verbose
```

#### Staging Environment

```bash
# 1. Backup database first
pg_dump scheduledb_staging > staging_backup_$(date +%Y%m%d).sql

# 2. Apply migrations
alembic upgrade head

# 3. Test application
pytest tests/

# 4. Verify data integrity
psql scheduledb_staging -c "SELECT COUNT(*) FROM users;"
```

#### Production Environment

See [Production Deployment](#production-deployment) section.

---

## Backup Procedures

### Before Every Migration

**Always create a backup before running migrations in production.**

### PostgreSQL Backup Commands

#### Full Database Backup

```bash
# Create backup
pg_dump -h localhost -U postgres -d scheduledb -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump

# Compressed backup (smaller file)
pg_dump -h localhost -U postgres -d scheduledb | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Table-Specific Backup

```bash
# Backup specific tables
pg_dump -h localhost -U postgres -d scheduledb -t users -t departments > backup_users_$(date +%Y%m%d).sql
```

#### Schema-Only Backup

```bash
# Backup schema without data (faster)
pg_dump -h localhost -U postgres -d scheduledb --schema-only > schema_backup_$(date +%Y%m%d).sql
```

### Automated Backup Script

```bash
#!/bin/bash
# backup_database.sh

BACKUP_DIR="/var/backups/scheduledb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="scheduledb"
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.dump"

# Create backup directory if needed
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U postgres -d $DB_NAME -F c -b -v -f $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.dump.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

### Backup Verification

```bash
# Verify backup integrity
pg_restore --list backup_20250115_120000.dump | head -n 20

# Test restore to temporary database
createdb scheduledb_test
pg_restore -d scheduledb_test backup_20250115_120000.dump
dropdb scheduledb_test
```

---

## Rollback Procedures

### Rolling Back Migrations

#### Rollback One Version

```bash
# Downgrade by one migration
alembic downgrade -1

# View what will be rolled back
alembic history
```

#### Rollback to Specific Version

```bash
# Rollback to specific revision
alembic downgrade abc123

# Rollback to base (WARNING: removes all migrations)
alembic downgrade base
```

### Database Restore from Backup

#### Full Restore

```bash
# 1. Drop existing database
dropdb scheduledb

# 2. Create new database
createdb scheduledb

# 3. Restore from backup
pg_restore -d scheduledb backup_20250115_120000.dump

# Or from SQL dump
psql scheduledb < backup_20250115_120000.sql

# Or from compressed backup
gunzip -c backup_20250115_120000.sql.gz | psql scheduledb
```

#### Partial Restore (Table-Level)

```bash
# Restore specific table
pg_restore -d scheduledb -t users backup_20250115_120000.dump
```

### Emergency Rollback Procedure

```
1. Stop application servers
2. Restore database from pre-migration backup
3. Rollback code deployment
4. Restart application servers
5. Verify system functionality
6. Investigate migration failure
```

---

## Migration Testing

### Testing Checklist

Before deploying migrations to production:

- [ ] Migration runs successfully in development
- [ ] Migration runs successfully in staging
- [ ] Downgrade/rollback works correctly
- [ ] Application works with new schema
- [ ] All tests pass
- [ ] Data integrity verified
- [ ] Performance impact assessed
- [ ] Backup created and verified

### Testing Environments

```
Development → Local PostgreSQL
Testing → CI/CD PostgreSQL (Docker)
Staging → Staging PostgreSQL (mirror of production)
Production → Production PostgreSQL
```

### Test Migration Script

```bash
#!/bin/bash
# test_migration.sh

set -e  # Exit on error

echo "🧪 Testing migration..."

# 1. Create test database
echo "Creating test database..."
createdb scheduledb_test

# 2. Apply all migrations except new one
echo "Applying previous migrations..."
alembic upgrade head~1

# 3. Load test data
echo "Loading test data..."
psql scheduledb_test < test_data.sql

# 4. Apply new migration
echo "Applying new migration..."
alembic upgrade head

# 5. Run application tests
echo "Running tests..."
pytest tests/

# 6. Test rollback
echo "Testing rollback..."
alembic downgrade -1
alembic upgrade head

# 7. Cleanup
echo "Cleaning up..."
dropdb scheduledb_test

echo "✅ Migration test passed!"
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Migration tested in staging environment
- [ ] Backup created and verified
- [ ] Rollback procedure documented
- [ ] Maintenance window scheduled
- [ ] Team notified of deployment
- [ ] Monitoring alerts configured

### Deployment Steps

#### 1. Maintenance Mode

```bash
# Enable maintenance mode (frontend)
export REACT_APP_MAINTENANCE_MODE=true
npm run build

# Or use database flag
psql scheduledb -c "UPDATE system_settings SET maintenance_mode = true;"
```

#### 2. Backup Database

```bash
# Create pre-migration backup
pg_dump -h prod-db-host -U postgres -d scheduledb \
  -F c -b -v -f pre_migration_backup_$(date +%Y%m%d_%H%M%S).dump
```

#### 3. Apply Migration

```bash
# Connect to production server
ssh production-server

# Navigate to backend
cd /opt/ai-schedule-manager/backend

# Activate virtual environment
source venv/bin/activate

# Apply migrations
alembic upgrade head 2>&1 | tee migration_$(date +%Y%m%d_%H%M%S).log
```

#### 4. Verify Migration

```bash
# Check current version
alembic current

# Verify data integrity
psql scheduledb -c "SELECT COUNT(*) FROM users;"
psql scheduledb -c "SELECT COUNT(*) FROM departments;"

# Check for errors in logs
tail -n 100 /var/log/schedulemanager/app.log
```

#### 5. Deploy Application Code

```bash
# Pull latest code
git pull origin main

# Install dependencies
pip install -r requirements.txt

# Restart application
systemctl restart schedulemanager
```

#### 6. Smoke Tests

```bash
# Test health endpoint
curl https://api.example.com/health

# Test authentication
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test employee endpoint
curl https://api.example.com/api/employees \
  -H "Authorization: Bearer <token>"
```

#### 7. Disable Maintenance Mode

```bash
# Disable maintenance mode
export REACT_APP_MAINTENANCE_MODE=false
npm run build

# Or use database flag
psql scheduledb -c "UPDATE system_settings SET maintenance_mode = false;"
```

#### 8. Monitor

```bash
# Monitor logs
tail -f /var/log/schedulemanager/app.log

# Monitor database connections
psql scheduledb -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor API metrics
curl https://api.example.com/health/detailed
```

---

## Zero-Downtime Migrations

### Strategies

#### 1. Backward-Compatible Changes

Deploy in two phases:

**Phase 1**: Add new column (nullable)
```python
def upgrade():
    op.add_column('users',
        sa.Column('new_field', sa.String(100), nullable=True))
```

**Deploy application that uses both old and new columns**

**Phase 2**: Make column required, remove old column
```python
def upgrade():
    op.alter_column('users', 'new_field', nullable=False)
    op.drop_column('users', 'old_field')
```

#### 2. Expand-Contract Pattern

```
Expand (add new structure) → Migrate data → Contract (remove old structure)
```

**Step 1**: Add new table/columns
**Step 2**: Dual-write to old and new
**Step 3**: Migrate existing data
**Step 4**: Read from new, write to both
**Step 5**: Remove old structure

#### 3. Blue-Green Deployment

- **Blue**: Current production
- **Green**: New version with migration

Process:
1. Apply migration to Green database
2. Deploy application to Green servers
3. Test Green environment
4. Switch traffic to Green
5. Keep Blue as fallback

---

## Troubleshooting

### Common Migration Issues

#### Migration Fails with "Relation already exists"

**Cause**: Migration already partially applied

**Solution**:
```bash
# Check current version
alembic current

# Manually mark migration as applied (if safe)
alembic stamp head

# Or rollback and retry
alembic downgrade -1
alembic upgrade head
```

#### Migration Fails with Foreign Key Constraint

**Cause**: Data violates new constraint

**Solution**:
```python
# Add data cleanup to migration
def upgrade():
    # Clean up orphaned records
    op.execute("""
        DELETE FROM schedules
        WHERE employee_id NOT IN (SELECT id FROM users)
    """)

    # Then add constraint
    op.create_foreign_key(
        'fk_schedules_employee_id',
        'schedules', 'users',
        ['employee_id'], ['id']
    )
```

#### Migration Too Slow

**Cause**: Large table, missing indexes

**Solution**:
```python
# Create index before adding constraint
def upgrade():
    # Add index first (faster)
    op.create_index('ix_schedules_employee_id',
                    'schedules', ['employee_id'])

    # Then add constraint
    op.create_foreign_key(...)
```

#### Alembic Version Conflict

**Cause**: Multiple heads in migration history

**Solution**:
```bash
# View all heads
alembic heads

# Merge heads
alembic merge -m "Merge migration branches" head_1 head_2
```

#### Cannot Rollback Data Migration

**Cause**: Downgrade function not implemented

**Solution**:
```python
# Always implement downgrade for data migrations
def downgrade():
    # Reverse the data transformation
    op.execute("""
        UPDATE users
        SET old_field = new_field
        WHERE new_field IS NOT NULL
    """)
```

---

### Recovery Procedures

#### Production Migration Failed

```
1. STOP: Halt migration immediately
2. ASSESS: Check database state
3. DECIDE:
   - If safe: Complete migration
   - If unsafe: Rollback
4. RESTORE: From backup if needed
5. COMMUNICATE: Notify stakeholders
6. DOCUMENT: Record incident
```

#### Restore from Backup

```bash
# 1. Put application in maintenance mode
systemctl stop schedulemanager

# 2. Drop corrupted database
dropdb scheduledb

# 3. Create new database
createdb scheduledb

# 4. Restore from backup
pg_restore -d scheduledb backup.dump

# 5. Restart application
systemctl start schedulemanager

# 6. Verify functionality
curl https://api.example.com/health
```

---

## Best Practices Summary

### DO

✅ Always create backups before migrations
✅ Test migrations in staging first
✅ Write reversible migrations
✅ Use transactions for data migrations
✅ Add indexes for foreign keys
✅ Document breaking changes
✅ Monitor migrations in production
✅ Keep migration scripts in version control

### DON'T

❌ Modify production database directly
❌ Skip testing in staging
❌ Deploy migrations during peak hours
❌ Ignore rollback procedures
❌ Forget to verify backups
❌ Rush migrations under pressure
❌ Leave orphaned data
❌ Skip documentation

---

## Additional Resources

- **Alembic Documentation**: https://alembic.sqlalchemy.org
- **PostgreSQL Backup Documentation**: https://www.postgresql.org/docs/current/backup.html
- **SQLAlchemy Documentation**: https://docs.sqlalchemy.org
- **Developer Guide**: `/docs/DEVELOPER_GUIDE.md`

---

*Last Updated: 2025-01-15*
