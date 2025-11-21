# Quick Start Guide - Production Deployment

**Time Required**: 1-2 hours
**Skill Level**: Intermediate

---

## Prerequisites

- WSL2 or Ubuntu 20.04+
- sudo access
- Internet connection

---

## Step-by-Step Instructions

### 1. Install PostgreSQL (30 minutes)

```bash
cd /home/peter/AI-Schedule-Manager

# Install PostgreSQL
sudo bash scripts/install-postgresql.sh

# Verify installation
psql --version
sudo service postgresql status
```

**Expected Output**:
```
psql (PostgreSQL) 15.x
✓ PostgreSQL is running
```

---

### 2. Setup Database (15 minutes)

```bash
# Run setup script (will prompt for password)
sudo bash scripts/setup-database.sh
```

**Prompts**:
- Enter a secure password for `schedule_admin`
- Confirm password

**What it does**:
- Creates database `schedule_manager`
- Creates user `schedule_admin`
- Grants all privileges
- Updates `backend/.env` with credentials
- Secures `.env` file (chmod 600)

---

### 3. Apply Database Migrations (10 minutes)

```bash
cd backend

# Check Python dependencies
pip install -r requirements.txt

# Apply all migrations
alembic upgrade head

# Verify migrations
alembic current
```

**Expected Output**:
```
INFO  [alembic.runtime.migration] Running upgrade ... -> ..., ...
INFO  [alembic.runtime.migration] Running upgrade ... -> ..., ...
...
✓ All migrations applied successfully
```

---

### 4. Create Admin User (5 minutes)

```bash
# Interactive creation (recommended)
python ../scripts/create-admin-user.py
```

**Prompts**:
- Admin email: `admin@example.com`
- Full name: `System Administrator`
- Password: (enter secure password)
- Confirm password

**Alternative** (for testing only):
```bash
# Creates admin@example.com with password admin123
python ../scripts/create-admin-user.py --default
```

---

### 5. Test Database Connection (5 minutes)

```bash
# Run test script
python ../scripts/test-database.py
```

**Expected Output**:
```
========================================
Database Connection Test
========================================

✓ Connected to PostgreSQL
  Version: PostgreSQL 15.x
✓ Users table accessible
  Users count: 1
✓ Schedules table accessible
✓ Departments table accessible
✓ Employees table accessible

========================================
✓ All database tests passed!
========================================
```

---

### 6. Install Redis (Optional, 15 minutes)

```bash
# Install Redis
sudo bash ../scripts/install-redis.sh

# Test Redis
python ../scripts/test-redis.py
```

**Expected Output**:
```
✓ Redis is responding
✓ Set key 'test:connection'
✓ Get key 'test:connection': Hello from Schedule Manager!
✓ All Redis tests passed!
```

**Skip if**: You don't need caching for initial deployment

---

### 7. Start Backend (5 minutes)

```bash
# Still in /backend directory
uvicorn src.main:app --reload
```

**Expected Output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

**Test**:
- Open browser: http://localhost:8000/api/docs
- Should see Swagger API documentation

---

### 8. Start Frontend (5 minutes)

**In a new terminal**:
```bash
cd /home/peter/AI-Schedule-Manager/frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm start
```

**Expected Output**:
```
Compiled successfully!

You can now view frontend in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

---

### 9. Verify Full Stack (10 minutes)

**Backend Tests**:
```bash
# In browser, test these endpoints:
http://localhost:8000/health         # Should return {"status":"ok"}
http://localhost:8000/api/docs       # Should show Swagger UI
```

**Frontend Tests**:
```bash
# In browser:
http://localhost:3000               # Should show login page
```

**Login Test**:
- Email: `admin@example.com`
- Password: (the password you set)
- Should successfully login and show dashboard

---

### 10. Create Backup (5 minutes)

```bash
# Create initial backup
pg_dump -U schedule_admin -h localhost schedule_manager > \
  ~/backups/schedule_manager_initial_$(date +%Y%m%d_%H%M%S).sql

# Verify backup created
ls -lh ~/backups/
```

---

## Troubleshooting

### PostgreSQL Won't Start

```bash
# Check status
sudo service postgresql status

# View logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Restart
sudo service postgresql restart
```

### Database Connection Refused

```bash
# Verify PostgreSQL is running
sudo service postgresql status

# Check if listening on port 5432
sudo netstat -plnt | grep 5432

# Test connection
psql -U schedule_admin -d schedule_manager -h localhost
```

### Migration Errors

```bash
# Check current migration state
cd backend
alembic current

# Check migration history
alembic history

# Downgrade one step if needed
alembic downgrade -1

# Try upgrade again
alembic upgrade head
```

### Backend Won't Start

```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill process if needed
kill -9 <PID>

# Check Python dependencies
cd backend
pip install -r requirements.txt

# Try starting again
uvicorn src.main:app --reload
```

### Frontend Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Install dependencies
cd frontend
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try starting again
npm start
```

### Can't Login

```bash
# Verify admin user exists
cd backend
python ../scripts/test-database.py

# Create new admin user
python ../scripts/create-admin-user.py

# Check backend logs for errors
# (in terminal running uvicorn)
```

---

## Next Steps After Deployment

### Immediate
1. ✅ Change admin password
2. ✅ Create additional users (managers, employees)
3. ✅ Create departments
4. ✅ Test all features

### Short-term
5. ✅ Set up automated backups
6. ✅ Configure monitoring
7. ✅ Document any issues
8. ✅ Train users

### Long-term
9. ✅ Enable HTTPS (if internet-facing)
10. ✅ Implement additional security measures
11. ✅ Optimize performance based on usage
12. ✅ Regular security updates

---

## Production Checklist

Use the comprehensive checklist:
```bash
cat docs/deployment/PRODUCTION-DEPLOYMENT-CHECKLIST.md
```

---

## Getting Help

### Documentation
- PostgreSQL Setup: `docs/deployment/POSTGRESQL-SETUP-GUIDE.md`
- Redis Setup: `docs/deployment/REDIS-SETUP-GUIDE.md`
- Full Checklist: `docs/deployment/PRODUCTION-DEPLOYMENT-CHECKLIST.md`
- Readiness Report: `docs/deployment/DEPLOYMENT-READINESS-REPORT.md`

### Common Issues
See troubleshooting sections in setup guides above.

---

## Summary

You've successfully deployed the AI Schedule Manager! 🎉

**What you accomplished**:
- ✅ PostgreSQL installed and configured
- ✅ Database created with all tables and indexes
- ✅ Admin user created
- ✅ Backend API running
- ✅ Frontend UI running
- ✅ Full stack tested
- ✅ Initial backup created

**Access Points**:
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- Frontend: http://localhost:3000
- Database: localhost:5432

**Credentials**:
- Database User: `schedule_admin`
- Database: `schedule_manager`
- Admin User: `admin@example.com`

---

*Happy scheduling! 📅*
