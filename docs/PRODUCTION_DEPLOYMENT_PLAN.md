# Production Deployment Plan

## Overview
Comprehensive plan for deploying the Employee Management System to production.

## Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All features tested and working
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

### 2. Database Preparation
- [ ] All migrations tested on staging
- [ ] Migration rollback plan prepared
- [ ] Database backup created
- [ ] Migration performance validated
- [ ] Data integrity verified
- [ ] Index optimization completed

### 3. Environment Setup
- [ ] Production server provisioned
- [ ] Database server configured
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] DNS records configured
- [ ] CDN configured (if applicable)

### 4. Security Verification
- [ ] Security audit completed
- [ ] SSL/TLS enabled
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Security headers configured
- [ ] Secrets management configured

### 5. Monitoring Setup
- [ ] Application monitoring configured
- [ ] Database monitoring configured
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Log aggregation configured
- [ ] Alerting rules configured
- [ ] Uptime monitoring configured

## Deployment Steps

### Phase 1: Pre-Deployment (T-24 hours)

#### Step 1: Final Testing on Staging
```bash
# 1. Deploy to staging environment
cd /home/peter/AI-Schedule-Manager
git checkout main
git pull origin main

# 2. Run full test suite
cd backend
pytest tests/ -v --cov=src --cov-report=html

# 3. Run E2E tests
cd ..
npm run test:e2e

# 4. Run performance benchmarks
cd backend
python scripts/performance_benchmark.py

# 5. Run security validation
python scripts/production_validation.py
```

**Checklist**:
- [ ] All tests pass
- [ ] Performance meets targets
- [ ] Security validation passes
- [ ] No critical bugs

#### Step 2: Database Backup
```bash
# Create full database backup
pg_dump -U postgres -h localhost employee_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
pg_restore --list backup_*.sql | head -20

# Store backup in secure location
# - Local: /backups/
# - Cloud: S3, Google Cloud Storage, etc.
# - Keep at least 3 backup copies in different locations
```

**Checklist**:
- [ ] Backup created successfully
- [ ] Backup verified (can be restored)
- [ ] Backup stored in multiple locations
- [ ] Backup size reasonable

#### Step 3: Code Freeze
```bash
# Tag release version
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0

# Create release branch
git checkout -b release/v1.0.0
git push origin release/v1.0.0

# No more commits to main until after deployment
```

**Checklist**:
- [ ] Release tagged
- [ ] Release branch created
- [ ] Team notified of code freeze
- [ ] Emergency hotfix procedure documented

### Phase 2: Deployment Window (T-0)

#### Step 1: Notify Stakeholders
```text
Subject: Production Deployment - Employee Management System v1.0.0

Dear Team,

We are beginning the production deployment of the Employee Management System v1.0.0.

Deployment Window: [START TIME] - [END TIME]
Expected Downtime: 15-30 minutes
Impact: Employee Management System will be unavailable

Timeline:
- [TIME]: Start deployment
- [TIME]: Database migration
- [TIME]: Application deployment
- [TIME]: Smoke tests
- [TIME]: System available

We will send updates every 15 minutes.

Thank you,
DevOps Team
```

**Checklist**:
- [ ] All stakeholders notified
- [ ] Support team on standby
- [ ] Rollback team ready

#### Step 2: Stop Application
```bash
# Stop backend service
sudo systemctl stop employee-backend

# Or if using Docker
docker-compose down

# Or if using PM2
pm2 stop all

# Verify application stopped
curl http://localhost:8000/health
# Expected: Connection refused or timeout
```

**Checklist**:
- [ ] Application stopped successfully
- [ ] No active connections
- [ ] Maintenance page displayed (if applicable)

#### Step 3: Backup Production Database
```bash
# Create pre-migration backup
pg_dump -U postgres -h production-db employee_system > \
  pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh pre_migration_*.sql

# Copy to safe location
cp pre_migration_*.sql /backups/production/
```

**Checklist**:
- [ ] Production backup created
- [ ] Backup verified
- [ ] Backup stored safely

#### Step 4: Deploy New Code
```bash
# Navigate to application directory
cd /var/www/employee-system

# Pull latest code
git fetch --all
git checkout v1.0.0

# Install dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm ci --production

# Build frontend
npm run build
```

**Checklist**:
- [ ] Code pulled successfully
- [ ] Dependencies installed
- [ ] Frontend built
- [ ] No errors during build

#### Step 5: Update Environment Variables
```bash
# Review environment variables
cat /var/www/employee-system/backend/.env

# Update if needed (example)
cat > /var/www/employee-system/backend/.env <<EOF
DATABASE_URL=postgresql://user:password@prod-db:5432/employee_system
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://employees.company.com
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=INFO
EOF

# Set proper permissions
chmod 600 /var/www/employee-system/backend/.env
```

**Checklist**:
- [ ] Environment variables updated
- [ ] Secrets rotated (if needed)
- [ ] Permissions set correctly
- [ ] No secrets in code

#### Step 6: Run Database Migrations
```bash
cd /var/www/employee-system/backend

# Check current migration status
alembic current

# Run migrations with verbose output
alembic upgrade head --sql > migration.sql
# Review SQL before applying
cat migration.sql

# Apply migrations
alembic upgrade head

# Verify migrations applied
alembic current
# Expected: head revision
```

**Checklist**:
- [ ] Migrations reviewed
- [ ] Migrations executed successfully
- [ ] No errors in migration logs
- [ ] Database schema updated

#### Step 7: Verify Database Integrity
```bash
# Run data integrity check
python scripts/verify_data_integrity.py

# Check critical tables exist
psql $DATABASE_URL -c "\dt"

# Verify data accessible
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM employees;"
```

**Checklist**:
- [ ] All tables present
- [ ] Data integrity verified
- [ ] No orphaned records
- [ ] Foreign keys intact

#### Step 8: Start Application
```bash
# Start backend service
sudo systemctl start employee-backend

# Or if using Docker
docker-compose up -d

# Or if using PM2
pm2 start ecosystem.config.js

# Check service status
sudo systemctl status employee-backend
# Or
docker-compose ps
# Or
pm2 status
```

**Checklist**:
- [ ] Service started successfully
- [ ] No errors in startup logs
- [ ] Process running
- [ ] Listening on correct port

#### Step 9: Run Smoke Tests
```bash
# Wait for application to be ready
sleep 10

# 1. Health check
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# 2. Database connectivity
curl http://localhost:8000/health/db
# Expected: {"database": "connected"}

# 3. Authentication
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -d "username=admin&password=admin123" | jq -r .access_token)

echo "Token: $TOKEN"
# Expected: JWT token

# 4. List employees
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN"
# Expected: JSON array of employees

# 5. Create employee
curl -X POST http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Smoke",
    "last_name": "Test",
    "department": "Testing",
    "position": "QA Engineer"
  }'
# Expected: 201 Created

# 6. Update employee
curl -X PUT http://localhost:8000/api/employees/999 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"position": "Senior QA Engineer"}'
# Expected: 200 OK

# 7. Delete test employee
curl -X DELETE http://localhost:8000/api/employees/999 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content
```

**Checklist**:
- [ ] Health check passes
- [ ] Database connectivity confirmed
- [ ] Authentication working
- [ ] CRUD operations working
- [ ] No errors in logs

#### Step 10: Monitor Logs
```bash
# Monitor application logs
tail -f /var/log/employee-system/app.log

# Or if using Docker
docker-compose logs -f backend

# Or if using PM2
pm2 logs

# Watch for errors
grep -i error /var/log/employee-system/app.log
```

**Checklist**:
- [ ] No error messages
- [ ] Normal startup messages
- [ ] Database queries executing
- [ ] API requests processing

### Phase 3: Post-Deployment Validation (T+15 minutes)

#### Step 1: Full Functional Testing
```bash
# Run comprehensive smoke tests
cd /var/www/employee-system
python backend/scripts/smoke_tests.py

# Expected output:
# ✅ Authentication: PASS
# ✅ Employee CRUD: PASS
# ✅ Search/Filter: PASS
# ✅ Department Assignment: PASS
# ✅ Extended Fields: PASS
# ✅ Authorization: PASS
```

**Checklist**:
- [ ] All smoke tests pass
- [ ] No functional regressions
- [ ] UI responsive
- [ ] No console errors

#### Step 2: Performance Validation
```bash
# Run performance benchmarks
python backend/scripts/performance_benchmark.py

# Verify metrics:
# - Employee list: <100ms
# - Search: <150ms
# - Create: <50ms
# - Update: <50ms
```

**Checklist**:
- [ ] Response times acceptable
- [ ] No performance degradation
- [ ] Database queries optimized
- [ ] No memory leaks

#### Step 3: Notify Stakeholders (Success)
```text
Subject: Production Deployment Complete - SUCCESS

Dear Team,

The production deployment of Employee Management System v1.0.0 has completed successfully.

Deployment Summary:
- Start Time: [TIME]
- End Time: [TIME]
- Duration: [DURATION]
- Status: ✅ SUCCESS

System Status:
- Application: ✅ Running
- Database: ✅ Healthy
- Performance: ✅ Within targets
- All tests: ✅ Passing

The system is now available at: https://employees.company.com

Thank you for your patience.

DevOps Team
```

**Checklist**:
- [ ] All stakeholders notified
- [ ] Success message sent
- [ ] Documentation updated
- [ ] Deployment tagged in monitoring

## Rollback Plan

### When to Rollback

Initiate rollback if:
- Critical functionality broken
- Data integrity issues
- Security vulnerabilities exposed
- Performance degradation >50%
- Database migration fails
- Multiple service errors

### Rollback Procedure

#### Step 1: Decide to Rollback
```bash
# Assess situation
# - Check error logs
# - Check monitoring dashboards
# - Assess user impact
# - Consult with team

# If rollback needed, notify team immediately
```

#### Step 2: Stop Application
```bash
# Stop current version
sudo systemctl stop employee-backend
# Or
docker-compose down
# Or
pm2 stop all
```

#### Step 3: Restore Database
```bash
# Drop current database (CAUTION!)
dropdb employee_system

# Recreate database
createdb employee_system

# Restore from pre-migration backup
pg_restore -U postgres -d employee_system pre_migration_*.sql

# Or if using SQL dump
psql -U postgres employee_system < pre_migration_*.sql

# Verify restoration
psql employee_system -c "SELECT COUNT(*) FROM users;"
```

#### Step 4: Deploy Previous Version
```bash
cd /var/www/employee-system

# Get previous version tag
git tag | grep -v v1.0.0 | tail -1
# Example: v0.9.5

# Checkout previous version
git checkout v0.9.5

# Install dependencies
cd backend
pip install -r requirements.txt

cd ../frontend
npm ci --production
npm run build
```

#### Step 5: Rollback Database Migrations
```bash
cd /var/www/employee-system/backend

# Identify target migration (previous version)
alembic history | grep v0.9.5

# Downgrade to that revision
alembic downgrade [revision_id]

# Verify
alembic current
```

#### Step 6: Start Previous Version
```bash
# Start application
sudo systemctl start employee-backend
# Or
docker-compose up -d
# Or
pm2 start ecosystem.config.js

# Verify startup
sleep 10
curl http://localhost:8000/health
```

#### Step 7: Verify Rollback
```bash
# Run smoke tests
python backend/scripts/smoke_tests.py

# Check logs
tail -f /var/log/employee-system/app.log

# Test critical functionality
curl -X GET http://localhost:8000/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

#### Step 8: Notify Stakeholders (Rollback)
```text
Subject: Production Deployment - ROLLED BACK

Dear Team,

The production deployment of v1.0.0 has been rolled back due to [ISSUE].

Rollback Summary:
- Rollback Time: [TIME]
- Current Version: v0.9.5
- Reason: [DETAILED EXPLANATION]
- Impact: [USER IMPACT]

System Status:
- Application: ✅ Running (previous version)
- Database: ✅ Restored
- Functionality: ✅ Working

Next Steps:
- Root cause analysis
- Fix issues in development
- Schedule new deployment

DevOps Team
```

## Post-Deployment Tasks

### Immediate (T+1 hour)
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Review logs for issues
- [ ] Verify all functionality
- [ ] Update status page

### Short-term (T+24 hours)
- [ ] Analyze usage patterns
- [ ] Review monitoring alerts
- [ ] Check database performance
- [ ] Gather user feedback
- [ ] Document lessons learned

### Long-term (T+1 week)
- [ ] Performance optimization review
- [ ] Security scan
- [ ] User satisfaction survey
- [ ] Plan next iteration
- [ ] Update documentation

## Emergency Contacts

**On-Call Engineer**: [PHONE] / [EMAIL]
**Database Admin**: [PHONE] / [EMAIL]
**Product Manager**: [PHONE] / [EMAIL]
**CTO**: [PHONE] / [EMAIL]

## Deployment Timeline

| Time | Activity | Duration | Responsible |
|------|----------|----------|-------------|
| T-24h | Final testing | 2 hours | QA Team |
| T-24h | Database backup | 30 min | DBA |
| T-2h | Code freeze | - | Dev Team |
| T-1h | Stakeholder notification | 15 min | PM |
| T-0 | Stop application | 2 min | DevOps |
| T+2 | Database backup | 5 min | DevOps |
| T+7 | Deploy code | 3 min | DevOps |
| T+10 | Run migrations | 5 min | DevOps |
| T+15 | Start application | 2 min | DevOps |
| T+17 | Smoke tests | 5 min | DevOps |
| T+22 | Validation | 10 min | QA |
| T+32 | Success notification | 3 min | PM |

**Total Deployment Time**: ~35 minutes
**Maximum Downtime**: 15-20 minutes

## Deployment Sign-Off

**Deployment Date**: _________________
**Deployment Time**: _________________
**Version Deployed**: v1.0.0

**Sign-Off**:
- [ ] Dev Lead: _________________
- [ ] QA Lead: _________________
- [ ] DevOps Lead: _________________
- [ ] Product Manager: _________________

**Deployment Status**: [ ] Success  [ ] Partial  [ ] Rolled Back

**Notes**:
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________
