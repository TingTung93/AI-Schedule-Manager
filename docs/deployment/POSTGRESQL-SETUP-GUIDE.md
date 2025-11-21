# PostgreSQL Setup Guide

## Installation on WSL

### 1. Install PostgreSQL

```bash
# Update package list
sudo apt update

# Install PostgreSQL and contrib packages
sudo apt install -y postgresql postgresql-contrib

# Verify installation
psql --version
```

### 2. Start PostgreSQL Service

```bash
# Start PostgreSQL
sudo service postgresql start

# Check status
sudo service postgresql status

# Enable auto-start (optional)
sudo systemctl enable postgresql
```

### 3. Configure PostgreSQL User and Database

```bash
# Switch to postgres user and create database
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE schedule_manager;

-- Create user with password
CREATE USER schedule_admin WITH PASSWORD 'ChangeThisSecurePassword123!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE schedule_manager TO schedule_admin;

-- Connect to database
\c schedule_manager

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO schedule_admin;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO schedule_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO schedule_admin;

-- Verify
\l
\du
EOF
```

### 4. Update Backend Environment Variables

```bash
cd /home/peter/AI-Schedule-Manager/backend

# Backup current .env
cp .env .env.backup

# Update .env with PostgreSQL credentials
cat >> .env <<EOF

# PostgreSQL Configuration
DATABASE_URL=postgresql+asyncpg://schedule_admin:ChangeThisSecurePassword123!@localhost:5432/schedule_manager
DB_HOST=localhost
DB_PORT=5432
DB_NAME=schedule_manager
DB_USER=schedule_admin
DB_PASSWORD=ChangeThisSecurePassword123!
EOF
```

### 5. Secure Environment File

```bash
# Restrict .env file permissions
chmod 600 backend/.env

# Verify
ls -la backend/.env
# Should show: -rw------- (only owner can read/write)
```

### 6. Apply Database Migrations

```bash
cd /home/peter/AI-Schedule-Manager/backend

# Install Python dependencies if not already installed
pip install -r requirements.txt

# Check current migration status
alembic current

# View migration history
alembic history

# Apply all migrations
alembic upgrade head

# Verify migrations applied
alembic current
```

### 7. Verify Database Setup

```bash
# Connect to database as schedule_admin
psql -U schedule_admin -d schedule_manager -h localhost

# Inside psql, run:
\dt                    # List all tables
\d users              # Describe users table
\d schedules          # Describe schedules table
\d departments        # Describe departments table
SELECT COUNT(*) FROM users;
\q                    # Quit
```

### 8. Create Initial Admin User

```bash
cd /home/peter/AI-Schedule-Manager/backend

# Run Python script to create admin user
python3 <<EOF
import asyncio
import sys
sys.path.insert(0, '/home/peter/AI-Schedule-Manager/backend/src')

from database import AsyncSessionLocal, engine
from models import User
from auth.password import hash_password

async def create_admin():
    async with AsyncSessionLocal() as db:
        try:
            # Create admin user
            admin = User(
                email="admin@example.com",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                role="admin",
                is_active=True
            )
            db.add(admin)
            await db.commit()
            print("✅ Admin user created successfully!")
            print("Email: admin@example.com")
            print("Password: admin123")
            print("⚠️  Please change the password immediately after first login!")
        except Exception as e:
            print(f"❌ Error creating admin user: {e}")
            await db.rollback()
        finally:
            await engine.dispose()

asyncio.run(create_admin())
EOF
```

## Troubleshooting

### PostgreSQL Not Starting

```bash
# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Restart service
sudo service postgresql restart
```

### Connection Refused

```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Check listening ports
sudo netstat -plnt | grep postgres

# Edit pg_hba.conf to allow local connections
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host    all    all    127.0.0.1/32    md5
```

### Permission Denied

```bash
# Grant all privileges again
sudo -u postgres psql -d schedule_manager <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO schedule_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO schedule_admin;
EOF
```

### Migration Errors

```bash
# Downgrade one step
alembic downgrade -1

# Check current state
alembic current

# Try upgrade again
alembic upgrade head

# Force specific revision
alembic upgrade <revision_id>
```

## Security Best Practices

1. **Change Default Password**: Replace 'ChangeThisSecurePassword123!' with a strong, unique password
2. **Secure .env File**: Always `chmod 600 backend/.env`
3. **Use Strong Admin Password**: Change 'admin123' after first login
4. **Regular Backups**: Set up automated database backups
5. **Network Security**: Configure firewall if exposing to LAN

## Backup and Restore

### Create Backup

```bash
# Full database backup
pg_dump -U schedule_admin -h localhost schedule_manager > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U schedule_admin -h localhost schedule_manager | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Backup

```bash
# Restore from backup
psql -U schedule_admin -h localhost schedule_manager < backup_20250121_120000.sql

# Restore from compressed backup
gunzip -c backup_20250121_120000.sql.gz | psql -U schedule_admin -h localhost schedule_manager
```

## Next Steps

After PostgreSQL setup:
1. ✅ PostgreSQL installed and running
2. ✅ Database and user created
3. ✅ Migrations applied
4. ✅ Admin user created
5. ⏭️  Proceed to Redis setup (see REDIS-SETUP-GUIDE.md)
6. ⏭️  Test full stack (see TESTING-GUIDE.md)
