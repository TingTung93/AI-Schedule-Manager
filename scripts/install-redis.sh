#!/bin/bash
# Redis Installation Script for WSL
# Run with: sudo bash scripts/install-redis.sh

set -e  # Exit on error

echo "========================================="
echo "Redis Installation for Schedule Manager"
echo "========================================="
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run with sudo: sudo bash scripts/install-redis.sh"
    exit 1
fi

# Update package list
echo "📦 Updating package list..."
apt update

# Install Redis
echo "📥 Installing Redis..."
apt install -y redis-server

# Verify installation
echo ""
echo "✅ Redis installed successfully!"
redis-server --version

# Start Redis service
echo ""
echo "🚀 Starting Redis service..."
service redis-server start

# Check status
echo ""
echo "📊 Redis service status:"
service redis-server status

# Test connection
echo ""
echo "🧪 Testing Redis connection..."
redis-cli ping

# Get the actual user running sudo
ACTUAL_USER=${SUDO_USER:-$USER}
PROJECT_DIR="/home/$ACTUAL_USER/AI-Schedule-Manager"

# Update .env file
echo ""
echo "📝 Updating backend/.env file..."
cat >> "$PROJECT_DIR/backend/.env" <<EOF

# Redis Configuration (Added $(date))
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379/0
REDIS_MAX_CONNECTIONS=10
CACHE_TTL=3600
EOF

# Secure .env file
chmod 600 "$PROJECT_DIR/backend/.env"
chown "$ACTUAL_USER:$ACTUAL_USER" "$PROJECT_DIR/backend/.env"

echo ""
echo "✅ Redis installation complete!"
echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Test Redis connection:"
echo "   python scripts/test-redis.py"
echo ""
echo "2. Monitor Redis:"
echo "   redis-cli --stat"
echo ""
echo "3. Optional: Configure Redis persistence"
echo "   See: docs/deployment/REDIS-SETUP-GUIDE.md"
echo ""
