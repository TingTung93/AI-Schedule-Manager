# Backend Database Seeding

## Overview

The backend now automatically seeds the database on startup, ensuring fresh containers always have demo data ready for testing and development.

## How It Works

### Startup Process

1. **Wait for PostgreSQL** - Container waits for database to be ready
2. **Run Migrations** - Alembic migrations create/update schema
3. **Seed Database** - Initial data is populated (idempotent)
4. **Start Application** - Uvicorn server starts on port 8000

### Files

- `backend/scripts/startup.sh` - Main startup script
- `backend/scripts/seed_data.py` - Seeding logic
- `backend/Dockerfile` - Updated to use startup.sh

## Seeded Data

### Roles (4)
- **admin** - System Administrator with full access
- **manager** - Department Manager with scheduling authority
- **supervisor** - Team Supervisor with limited scheduling
- **employee** - Regular Employee

### Permissions (19)
- User management: create, read, update, delete
- Schedule management: create, read, update, delete, publish
- Department management: create, read, update, delete
- Shift management: create, read, update, delete
- Reports: view, export

### Departments (4)
- Administration (2 min staff, 8hr shifts)
- Sales (3 min staff, 8hr shifts)
- Operations (4 min staff, 8hr shifts)
- Support (2 min staff, 8hr shifts)

### Demo Users (6)

| Email | Password | Role | Department | Name |
|-------|----------|------|------------|------|
| admin@example.com | Admin123! | admin | Administration | Admin User |
| manager@example.com | Manager123! | manager | Sales | Sarah Johnson |
| supervisor@example.com | Supervisor123! | supervisor | Operations | Mike Williams |
| employee1@example.com | Employee123! | employee | Sales | John Smith |
| employee2@example.com | Employee123! | employee | Sales | Emily Davis |
| employee3@example.com | Employee123! | employee | Operations | David Brown |

## Testing

All users have been verified to login successfully and receive JWT tokens:

```bash
✅ admin@example.com - SUCCESS
✅ manager@example.com - SUCCESS
✅ supervisor@example.com - SUCCESS
✅ employee1@example.com - SUCCESS
```

## Rebuilding Fresh Container

To rebuild the backend with fresh data:

```bash
# Stop containers and remove volumes
docker-compose down -v

# Rebuild backend
docker-compose build backend

# Start all services
docker-compose up -d

# Check seeding logs
docker logs ai-schedule-backend
```

## Database Statistics

After fresh seeding:
- **Users**: 6
- **Roles**: 4
- **Permissions**: 19
- **Departments**: 4

## Notes

- Seeding is **idempotent** - running multiple times won't create duplicates
- Uses bcrypt for password hashing
- Environment variable `DATABASE_URL` used for connection
- Startup script includes error handling and continues even if seeding fails (data may already exist)
