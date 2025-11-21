#!/bin/bash
# Database Setup Script
# Run with: sudo bash scripts/setup-database.sh

set -e  # Exit on error

echo "========================================="
echo "Database Setup for Schedule Manager"
echo "========================================="
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run with sudo: sudo bash scripts/setup-database.sh"
    exit 1
fi

# Check if PostgreSQL is running
if ! service postgresql status > /dev/null 2>&1; then
    echo "🚀 Starting PostgreSQL..."
    service postgresql start
fi

# Prompt for password
echo "Enter a secure password for the database user 'schedule_admin':"
read -s DB_PASSWORD
echo ""
echo "Confirm password:"
read -s DB_PASSWORD_CONFIRM
echo ""

if [ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]; then
    echo "❌ Passwords do not match!"
    exit 1
fi

# Create database and user
echo "🗄️  Creating database and user..."
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE schedule_manager;

-- Create user with password
CREATE USER schedule_admin WITH PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE schedule_manager TO schedule_admin;

-- Connect to database
\c schedule_manager

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO schedule_admin;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO schedule_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO schedule_admin;

-- Display success
\l schedule_manager
\du schedule_admin
EOF

# Get the actual user running sudo
ACTUAL_USER=${SUDO_USER:-$USER}
PROJECT_DIR="/home/$ACTUAL_USER/AI-Schedule-Manager"

# Update .env file
echo ""
echo "📝 Updating backend/.env file..."
cat >> "$PROJECT_DIR/backend/.env" <<EOF

# PostgreSQL Configuration (Added $(date))
DATABASE_URL=postgresql+asyncpg://schedule_admin:$DB_PASSWORD@localhost:5432/schedule_manager
DB_HOST=localhost
DB_PORT=5432
DB_NAME=schedule_manager
DB_USER=schedule_admin
DB_PASSWORD=$DB_PASSWORD
EOF

# Secure .env file
echo "🔒 Securing .env file permissions..."
chmod 600 "$PROJECT_DIR/backend/.env"
chown "$ACTUAL_USER:$ACTUAL_USER" "$PROJECT_DIR/backend/.env"

echo ""
echo "✅ Database setup complete!"
echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Apply migrations:"
echo "   cd $PROJECT_DIR/backend"
echo "   alembic upgrade head"
echo ""
echo "2. Create admin user:"
echo "   python scripts/create-admin-user.py"
echo ""
echo "3. Test database connection:"
echo "   python scripts/test-database.py"
echo ""
