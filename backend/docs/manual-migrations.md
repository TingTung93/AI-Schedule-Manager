# Manual Database Migrations

This document tracks manual database schema changes that were applied outside of Alembic migrations.

## 2025-11-21: Add department_id column to users table

**Issue**: The User model in `src/auth/models.py` defines a `department_id` column (line 49), but this column was never created in the database via Alembic migration. This caused a 500 Internal Server Error on login with the error:

```
column users.department_id does not exist
```

**Root Cause**:
- Dual Base class architecture prevents proper Alembic autogeneration
- User model uses `src.auth.models.Base`
- Other models use `src.models.base.Base`
- Foreign key relationships cannot cross Base class boundaries in SQLAlchemy metadata

**Manual Fix Applied**:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS department_id INTEGER
REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_users_department_id
ON users(department_id);
```

**Executed via**:
```bash
docker-compose exec postgres psql -U postgres -d schedule_manager -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS ix_users_department_id ON users(department_id);"
```

**Result**:
- Login API now returns proper 401 Unauthorized for invalid credentials
- No more 500 Internal Server Error
- Column visible in schema: `department_id | integer | | |`

**Note**: Future Alembic migrations should account for this column already existing in the database.

## Related Code Changes

- Committed: `backend/src/models/department_history.py` - Commented out User relationships due to Base class conflict
