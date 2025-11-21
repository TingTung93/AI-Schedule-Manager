# Production Deployment Guide
**AI Schedule Manager - Local/LAN Deployment**

Version: 1.0.0
Last Updated: 2025-11-21
Deployment Model: Local Host / Intranet LAN Only

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Configuration](#configuration)
5. [Security Hardening](#security-hardening)
6. [Database Setup](#database-setup)
7. [Service Startup](#service-startup)
8. [Verification](#verification)
9. [Backup & Recovery](#backup-and-recovery)
10. [Troubleshooting](#troubleshooting)
11. [Monitoring](#monitoring)

---

## Overview

### Deployment Architecture

AI Schedule Manager is designed for **local host or intranet LAN deployment only**. The application runs on your organization's private network and is NOT intended for public internet exposure.

**Components:**
- **Backend**: FastAPI (Python 3.9+) on port 8000
- **Frontend**: React 18.x on port 3000 (development) or served via nginx (production)
- **Database**: PostgreSQL 12+ on port 5432
- **Cache**: Redis 6+ on port 6379 (optional)

**Network Requirements:**
- Private network (192.168.x.x, 10.x.x.x, or 172.16-31.x.x)
- No port forwarding from public internet
- Firewall protection at network perimeter

---

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **OS**: Ubuntu 20.04 LTS / Windows 10+ / macOS 11+
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 20 GB free space
- **Network**: 100 Mbps LAN connection

**Recommended Requirements:**
- **OS**: Ubuntu 22.04 LTS or Windows Server 2019+
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: 1 Gbps LAN connection

### Software Dependencies

**Required Software:**

1. **Python 3.9 or higher**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install python3.9 python3.9-venv python3-pip

   # Windows (Download from python.org)
   # Ensure Python is added to PATH during installation

   # Verify installation
   python3 --version  # Should show 3.9.x or higher
   ```

2. **Node.js 16.x or higher**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Windows (Download from nodejs.org)
   # Install LTS version

   # Verify installation
   node --version  # Should show v16.x.x or higher
   npm --version   # Should show 8.x.x or higher
   ```

3. **PostgreSQL 12 or higher**
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib

   # Windows (Download from postgresql.org)
   # Install with default settings, remember the password

   # Verify installation
   psql --version  # Should show 12.x or higher
   ```

4. **Git**
   ```bash
   # Ubuntu/Debian
   sudo apt install git

   # Windows (Download from git-scm.com)

   # Verify installation
   git --version
   ```

**Optional Dependencies:**

5. **Redis (for caching and rate limiting)**
   ```bash
   # Ubuntu/Debian
   sudo apt install redis-server

   # Windows (Download from github.com/microsoftarchive/redis)

   # Verify installation
   redis-cli --version
   ```

6. **nginx (for production reverse proxy)**
   ```bash
   # Ubuntu/Debian
   sudo apt install nginx

   # Windows (Download from nginx.org)
   ```

---

## Installation Steps

### Step 1: Clone Repository

```bash
# Navigate to installation directory
cd /opt  # Linux
cd C:\Apps  # Windows

# Clone the repository
git clone https://github.com/your-org/AI-Schedule-Manager.git
cd AI-Schedule-Manager

# Checkout the correct branch
git checkout main  # Or your production branch
```

### Step 2: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/macOS
.\venv\Scripts\activate   # Windows

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi; print(fastapi.__version__)"
```

**Expected Output:** `0.104.1` or similar

### Step 3: Frontend Setup

```bash
# Navigate to frontend directory (open new terminal)
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Verify installation
npm list react --depth=0
```

**Expected Output:** `react@18.2.0` or similar

### Step 4: Environment Configuration

```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Generate secure SECRET_KEY (CRITICAL!)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output and update backend/.env
```

**IMPORTANT:** Never use default SECRET_KEY in production!

---

## Configuration

### Backend Environment Variables

Edit `/home/peter/AI-Schedule-Manager/backend/.env`:

```bash
# Database Configuration
DATABASE_URL=postgresql://schedule_user:SECURE_PASSWORD@localhost:5432/schedule_manager

# Security (GENERATE NEW VALUES!)
SECRET_KEY=YOUR_GENERATED_SECRET_KEY_HERE_MIN_32_CHARS
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days

# CORS Settings (Update with your actual LAN IPs)
CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.100:80,http://localhost:3000

# Environment
ENVIRONMENT=production

# Rate Limiting (Disabled for LAN - see LOCAL-LAN-SECURITY.md)
RATE_LIMIT_ENABLED=false
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Admin User (for initial setup only)
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# Optional: Redis
REDIS_URL=redis://localhost:6379/0

# Optional: Email (for password resets)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

### Frontend Environment Variables

Edit `/home/peter/AI-Schedule-Manager/frontend/.env`:

```bash
# Backend API URL
REACT_APP_API_URL=http://192.168.1.100:8000

# Optional: Analytics
REACT_APP_ENABLE_ANALYTICS=false

# Optional: Feature Flags
REACT_APP_ENABLE_WEBSOCKET=true
```

### Security Configuration Checklist

- [ ] Generate new SECRET_KEY (min 32 characters)
- [ ] Change ADMIN_PASSWORD to strong password
- [ ] Update CORS_ORIGINS with actual LAN IPs
- [ ] Verify RATE_LIMIT_ENABLED setting (false for LAN)
- [ ] Configure SMTP credentials if using email
- [ ] Review DATABASE_URL password strength

---

## Security Hardening

### For Local/LAN Deployment

**See**: `docs/deployment/LOCAL-LAN-SECURITY.md` for detailed security model.

**Key Security Measures:**

1. **Network Isolation**
   ```bash
   # Ensure firewall blocks external access
   sudo ufw enable  # Ubuntu
   sudo ufw allow from 192.168.1.0/24 to any port 8000  # Allow LAN only
   sudo ufw deny 8000  # Deny all other traffic
   ```

2. **Database Security**
   ```bash
   # Create dedicated database user with limited privileges
   sudo -u postgres psql
   CREATE USER schedule_user WITH PASSWORD 'SECURE_PASSWORD';
   CREATE DATABASE schedule_manager OWNER schedule_user;
   GRANT ALL PRIVILEGES ON DATABASE schedule_manager TO schedule_user;
   ```

3. **File Permissions**
   ```bash
   # Restrict .env file access
   chmod 600 backend/.env
   chmod 600 frontend/.env

   # Set proper ownership
   chown www-data:www-data backend/.env  # Linux with nginx
   ```

4. **Secret Rotation**
   ```bash
   # Generate new SECRET_KEY periodically (quarterly)
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   # Update backend/.env and restart services
   ```

5. **Password Policy**
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers
   - Consider using password manager for admin accounts

---

## Database Setup

### Step 1: Create Database

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create user and database
CREATE USER schedule_user WITH PASSWORD 'SECURE_PASSWORD_HERE';
CREATE DATABASE schedule_manager OWNER schedule_user;
GRANT ALL PRIVILEGES ON DATABASE schedule_manager TO schedule_user;

# Exit PostgreSQL
\q
```

### Step 2: Run Migrations

```bash
# Activate backend virtual environment
cd backend
source venv/bin/activate  # Linux/macOS
.\venv\Scripts\activate   # Windows

# Run Alembic migrations
alembic upgrade head

# Expected output: "Running upgrade -> xxx, Initial migration"
```

### Step 3: Seed Initial Data

```bash
# Run seed script to create default users and data
python scripts/seed_data.py

# Expected output:
# ✓ Created admin user: admin@yourcompany.com
# ✓ Created 5 departments
# ✓ Created 10 employees
# ✓ Database seeded successfully
```

### Step 4: Verify Database

```bash
# Connect to database
psql -U schedule_user -d schedule_manager -h localhost

# Check tables
\dt

# Expected tables:
# employees, departments, schedules, shifts, users, notifications, etc.

# Verify admin user
SELECT email, role FROM users WHERE role = 'admin';

# Exit
\q
```

---

## Service Startup

### Development Mode

**Backend:**
```bash
cd backend
source venv/bin/activate
python src/main.py

# Expected output:
# INFO:     Started server process [12345]
# INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Frontend:**
```bash
cd frontend
npm start

# Expected output:
# Compiled successfully!
# webpack compiled with 0 warnings
# On Your Network: http://192.168.1.100:3000
```

### Production Mode (with nginx)

**1. Build Frontend:**
```bash
cd frontend
npm run build

# This creates optimized production build in frontend/build/
```

**2. Configure nginx:**
```bash
sudo nano /etc/nginx/sites-available/schedule-manager
```

Add configuration:
```nginx
server {
    listen 80;
    server_name 192.168.1.100;

    # Frontend (React app)
    location / {
        root /opt/AI-Schedule-Manager/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8000;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/schedule-manager /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

**3. Create Systemd Service (Backend):**
```bash
sudo nano /etc/systemd/system/schedule-manager.service
```

Add service definition:
```ini
[Unit]
Description=AI Schedule Manager Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/AI-Schedule-Manager/backend
Environment="PATH=/opt/AI-Schedule-Manager/backend/venv/bin"
ExecStart=/opt/AI-Schedule-Manager/backend/venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable schedule-manager
sudo systemctl start schedule-manager
sudo systemctl status schedule-manager
```

### Using Docker (Alternative)

**See existing `deploy.sh` for Docker deployment with Cloudflare tunnel.**

For local-only Docker deployment:
```bash
# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## Verification

### Automated Verification Script

Run the included validation script:
```bash
./scripts/validate-deployment.sh
```

### Manual Verification Steps

**1. Backend Health Check:**
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","version":"1.0.0"}
```

**2. Frontend Access:**
```bash
# Open browser
http://localhost:3000  # Development
http://192.168.1.100   # Production with nginx
```

**3. API Documentation:**
```bash
# Open browser
http://localhost:8000/docs  # Swagger UI
http://localhost:8000/redoc # ReDoc
```

**4. Database Connection:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"your_password"}'

# Expected: JWT token returned
```

**5. WebSocket Connection:**
```bash
# Install wscat if needed: npm install -g wscat
wscat -c ws://localhost:8000/ws

# Should connect successfully
```

---

## Backup and Recovery

### Daily Backup Script

Create `/opt/AI-Schedule-Manager/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/schedule-manager"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U schedule_user -h localhost schedule_manager > \
  $BACKUP_DIR/db_backup_$DATE.sql

# Backup .env files (encrypted)
tar czf $BACKUP_DIR/config_backup_$DATE.tar.gz \
  backend/.env frontend/.env

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

Make executable:
```bash
chmod +x /opt/AI-Schedule-Manager/scripts/backup.sh
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
# Add line:
0 2 * * * /opt/AI-Schedule-Manager/scripts/backup.sh >> /var/log/schedule-backup.log 2>&1
```

### Recovery Procedure

**Restore Database:**
```bash
# Stop backend service
sudo systemctl stop schedule-manager

# Restore from backup
psql -U schedule_user -h localhost schedule_manager < \
  /opt/backups/schedule-manager/db_backup_YYYYMMDD_HHMMSS.sql

# Restart service
sudo systemctl start schedule-manager
```

**Restore Configuration:**
```bash
# Extract config backup
tar xzf /opt/backups/schedule-manager/config_backup_YYYYMMDD_HHMMSS.tar.gz

# Restart services
sudo systemctl restart schedule-manager
sudo systemctl restart nginx
```

---

## Troubleshooting

### Common Issues

**Issue 1: Backend won't start - Port 8000 already in use**

Solution:
```bash
# Find process using port 8000
sudo lsof -i :8000
# or
sudo netstat -tulpn | grep 8000

# Kill the process
sudo kill -9 <PID>

# Restart service
sudo systemctl restart schedule-manager
```

**Issue 2: Database connection refused**

Check PostgreSQL status:
```bash
sudo systemctl status postgresql

# If stopped, start it
sudo systemctl start postgresql

# Check if database exists
sudo -u postgres psql -l | grep schedule_manager
```

**Issue 3: Frontend shows blank page**

Check console for errors:
```bash
# Rebuild frontend
cd frontend
npm run build

# Clear browser cache
# Ctrl+F5 or Cmd+Shift+R
```

**Issue 4: CORS errors in browser**

Update `backend/.env`:
```bash
CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.100,http://localhost:3000
```

Restart backend:
```bash
sudo systemctl restart schedule-manager
```

**Issue 5: 401 Unauthorized errors**

JWT token may have expired or SECRET_KEY changed:
```bash
# Clear browser localStorage
# In browser console:
localStorage.clear()

# Login again
```

**Issue 6: Slow performance**

Check database indexes:
```bash
# Run optimization script
cd backend
python scripts/optimize_database.py

# Or manually add indexes (see docs/performance/department-query-optimization.md)
```

### Log Locations

- **Backend logs**: `backend/logs/app.log`
- **nginx logs**: `/var/log/nginx/error.log`, `/var/log/nginx/access.log`
- **PostgreSQL logs**: `/var/log/postgresql/postgresql-12-main.log`
- **Systemd service logs**: `journalctl -u schedule-manager -f`

### Getting Help

1. Check logs: `sudo journalctl -u schedule-manager -n 100`
2. Review documentation in `docs/`
3. Check GitHub issues
4. Contact system administrator

---

## Monitoring

### Health Monitoring

**Setup health check cron:**
```bash
# Create monitoring script
cat > /opt/AI-Schedule-Manager/scripts/health-check.sh << 'EOF'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ $RESPONSE -ne 200 ]; then
  echo "Health check failed: HTTP $RESPONSE"
  sudo systemctl restart schedule-manager
  # Send email alert (optional)
fi
EOF

chmod +x /opt/AI-Schedule-Manager/scripts/health-check.sh

# Add to crontab (every 5 minutes)
crontab -e
*/5 * * * * /opt/AI-Schedule-Manager/scripts/health-check.sh >> /var/log/health-check.log 2>&1
```

### Performance Monitoring

**Monitor resource usage:**
```bash
# CPU and memory
top -p $(pgrep -f uvicorn)

# Database connections
psql -U schedule_user -d schedule_manager -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='schedule_manager';"

# Disk usage
df -h /opt/AI-Schedule-Manager
```

### Log Rotation

Configure logrotate:
```bash
sudo nano /etc/logrotate.d/schedule-manager
```

Add configuration:
```
/opt/AI-Schedule-Manager/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        systemctl reload schedule-manager > /dev/null 2>&1 || true
    endscript
}
```

---

## Post-Deployment Checklist

After successful deployment, verify:

- [ ] All services running (`systemctl status schedule-manager`)
- [ ] Health endpoint returns 200 (`curl http://localhost:8000/health`)
- [ ] Database accessible and seeded
- [ ] Frontend loads in browser
- [ ] Can login with admin credentials
- [ ] Can create employee
- [ ] Can generate schedule
- [ ] Backups configured and tested
- [ ] Monitoring scripts active
- [ ] Log rotation configured
- [ ] Documentation updated with actual IPs
- [ ] Default passwords changed
- [ ] SECRET_KEY rotated from default

---

## Maintenance Schedule

### Daily Tasks
- Review error logs
- Check backup completion
- Monitor disk space

### Weekly Tasks
- Review user activity logs
- Check database performance
- Update dependencies if security patches available

### Monthly Tasks
- Test backup restoration
- Review access logs for anomalies
- Update documentation

### Quarterly Tasks
- Rotate SECRET_KEY
- Audit user accounts
- Review and update dependencies
- Performance optimization review

---

## References

- [Local/LAN Security Model](./LOCAL-LAN-SECURITY.md)
- [Production Readiness Checklist](./PRODUCTION-READINESS-CHECKLIST.md)
- [Technical Debt Analysis](../technical-debt/ANALYSIS.md)
- [Integration Guide](../INTEGRATION_GUIDE.md)
- [API Documentation](../README.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-21
**Maintained By**: DevOps Team
