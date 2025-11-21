#!/bin/bash
# PostgreSQL Installation Script for WSL
# Run with: sudo bash scripts/install-postgresql.sh

set -e  # Exit on error

echo "========================================="
echo "PostgreSQL Installation for Schedule Manager"
echo "========================================="
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run with sudo: sudo bash scripts/install-postgresql.sh"
    exit 1
fi

# Update package list
echo "📦 Updating package list..."
apt update

# Install PostgreSQL
echo "📥 Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Verify installation
echo ""
echo "✅ PostgreSQL installed successfully!"
psql --version

# Start PostgreSQL service
echo ""
echo "🚀 Starting PostgreSQL service..."
service postgresql start

# Check status
echo ""
echo "📊 PostgreSQL service status:"
service postgresql status

# Get the actual user running sudo
ACTUAL_USER=${SUDO_USER:-$USER}
PROJECT_DIR="/home/$ACTUAL_USER/AI-Schedule-Manager"

echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Run database setup script:"
echo "   sudo bash scripts/setup-database.sh"
echo ""
echo "2. Or manually configure:"
echo "   sudo -u postgres psql"
echo ""
echo "3. Then apply migrations:"
echo "   cd $PROJECT_DIR/backend"
echo "   alembic upgrade head"
echo ""
echo "✅ PostgreSQL installation complete!"
