#!/bin/bash

# AI Schedule Manager - Deployment Validation Script
# This script validates that all prerequisites and configurations are correct

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Display header
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  AI Schedule Manager - Deployment Validation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Function to check and report
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo -e "${BLUE}1. Checking System Prerequisites...${NC}\n"

# Check Python version
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 9 ]; then
        check_pass "Python 3.9+ installed: $PYTHON_VERSION"
    else
        check_fail "Python version too old: $PYTHON_VERSION (need 3.9+)"
    fi
else
    check_fail "Python 3 not found"
fi

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1 | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

    if [ "$NODE_MAJOR" -ge 16 ]; then
        check_pass "Node.js 16+ installed: $NODE_VERSION"
    else
        check_fail "Node.js version too old: $NODE_VERSION (need 16+)"
    fi
else
    check_fail "Node.js not found"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version 2>&1 | awk '{print $3}')
    check_pass "PostgreSQL installed: $PG_VERSION"
else
    check_fail "PostgreSQL not found"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version 2>&1 | awk '{print $3}')
    check_pass "Git installed: $GIT_VERSION"
else
    check_fail "Git not found"
fi

# Check Redis (optional)
if command -v redis-cli &> /dev/null; then
    REDIS_VERSION=$(redis-cli --version 2>&1 | awk '{print $2}')
    check_pass "Redis installed: $REDIS_VERSION (optional)"
else
    check_warn "Redis not found (optional for caching)"
fi

# Check nginx (optional)
if command -v nginx &> /dev/null; then
    NGINX_VERSION=$(nginx -v 2>&1 | awk -F/ '{print $2}')
    check_pass "nginx installed: $NGINX_VERSION (optional for production)"
else
    check_warn "nginx not found (optional for production)"
fi

echo ""
echo -e "${BLUE}2. Checking Directory Structure...${NC}\n"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    check_fail "Not in AI-Schedule-Manager root directory"
    echo -e "${RED}Please run this script from the project root${NC}"
    exit 1
else
    check_pass "Running from project root"
fi

# Check required directories
for dir in backend frontend docs scripts; do
    if [ -d "$dir" ]; then
        check_pass "Directory exists: $dir"
    else
        check_fail "Directory missing: $dir"
    fi
done

echo ""
echo -e "${BLUE}3. Checking Backend Configuration...${NC}\n"

# Check backend virtual environment
if [ -d "backend/venv" ]; then
    check_pass "Backend virtual environment exists"
else
    check_warn "Backend virtual environment not found (run: python3 -m venv backend/venv)"
fi

# Check backend .env file
if [ -f "backend/.env" ]; then
    check_pass "Backend .env file exists"

    # Check SECRET_KEY
    SECRET_KEY=$(grep -E "^SECRET_KEY=" backend/.env | cut -d= -f2)
    if [ -n "$SECRET_KEY" ]; then
        KEY_LENGTH=${#SECRET_KEY}
        if [ $KEY_LENGTH -ge 32 ]; then
            if [ "$SECRET_KEY" != "your-secret-key-change-in-production" ]; then
                check_pass "SECRET_KEY is configured (length: $KEY_LENGTH)"
            else
                check_fail "SECRET_KEY is still default value - MUST CHANGE!"
            fi
        else
            check_fail "SECRET_KEY too short (length: $KEY_LENGTH, need: 32+)"
        fi
    else
        check_fail "SECRET_KEY not found in .env"
    fi

    # Check DATABASE_URL
    if grep -q "^DATABASE_URL=" backend/.env; then
        check_pass "DATABASE_URL is configured"
    else
        check_fail "DATABASE_URL not found in .env"
    fi

    # Check CORS_ORIGINS
    if grep -q "^CORS_ORIGINS=" backend/.env; then
        CORS_ORIGINS=$(grep "^CORS_ORIGINS=" backend/.env | cut -d= -f2)
        check_pass "CORS_ORIGINS configured: $CORS_ORIGINS"
    else
        check_warn "CORS_ORIGINS not found in .env"
    fi
else
    check_fail "Backend .env file not found (copy from .env.example)"
fi

# Check backend dependencies
if [ -f "backend/requirements.txt" ]; then
    check_pass "Backend requirements.txt exists"
else
    check_fail "Backend requirements.txt not found"
fi

echo ""
echo -e "${BLUE}4. Checking Frontend Configuration...${NC}\n"

# Check frontend .env file
if [ -f "frontend/.env" ]; then
    check_pass "Frontend .env file exists"

    # Check REACT_APP_API_URL
    if grep -q "^REACT_APP_API_URL=" frontend/.env; then
        API_URL=$(grep "^REACT_APP_API_URL=" frontend/.env | cut -d= -f2)
        check_pass "REACT_APP_API_URL configured: $API_URL"
    else
        check_fail "REACT_APP_API_URL not found in .env"
    fi
else
    check_fail "Frontend .env file not found (copy from .env.example)"
fi

# Check node_modules
if [ -d "frontend/node_modules" ]; then
    check_pass "Frontend dependencies installed"
else
    check_warn "Frontend node_modules not found (run: npm install)"
fi

echo ""
echo -e "${BLUE}5. Checking Database...${NC}\n"

# Try to connect to PostgreSQL
if command -v psql &> /dev/null; then
    # Extract database connection info from .env
    if [ -f "backend/.env" ]; then
        DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d= -f2)

        # Parse connection string
        DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_USER=$(echo $DB_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

        if [ -n "$DB_NAME" ]; then
            # Check if database exists
            if PGPASSWORD=postgres psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
                check_pass "Database exists: $DB_NAME"
            else
                check_fail "Database not found: $DB_NAME (needs to be created)"
            fi
        fi
    fi
else
    check_warn "Cannot verify database (PostgreSQL client not available)"
fi

echo ""
echo -e "${BLUE}6. Checking Services...${NC}\n"

# Check if backend is running
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    check_pass "Backend service is running (port 8000)"

    # Check health endpoint response
    HEALTH_STATUS=$(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' | cut -d: -f2 | tr -d '"')
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        check_pass "Backend health check: healthy"
    else
        check_warn "Backend health check: $HEALTH_STATUS"
    fi
else
    check_warn "Backend service not running (start with: cd backend && python src/main.py)"
fi

# Check if frontend is running (dev mode)
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    check_pass "Frontend development server is running (port 3000)"
else
    check_warn "Frontend development server not running (start with: cd frontend && npm start)"
fi

# Check PostgreSQL service
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet postgresql; then
        check_pass "PostgreSQL service is running"
    else
        check_fail "PostgreSQL service is not running"
    fi
elif command -v pg_ctl &> /dev/null; then
    check_warn "Cannot determine PostgreSQL service status (systemctl not available)"
fi

# Check Redis service (optional)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping > /dev/null 2>&1; then
        check_pass "Redis service is running (optional)"
    else
        check_warn "Redis service not running (optional for caching)"
    fi
fi

echo ""
echo -e "${BLUE}7. Checking Security Configuration...${NC}\n"

# Check for default passwords in .env
if [ -f "backend/.env" ]; then
    if grep -q "ADMIN_PASSWORD=Admin123" backend/.env || \
       grep -q "ADMIN_PASSWORD=admin123" backend/.env || \
       grep -q "ADMIN_PASSWORD=password" backend/.env; then
        check_fail "Default admin password detected - MUST CHANGE!"
    else
        check_pass "Admin password appears to be changed"
    fi
fi

# Check file permissions on .env files
if [ -f "backend/.env" ]; then
    BACKEND_ENV_PERMS=$(stat -c "%a" backend/.env 2>/dev/null || stat -f "%A" backend/.env 2>/dev/null)
    if [ "$BACKEND_ENV_PERMS" = "600" ] || [ "$BACKEND_ENV_PERMS" = "400" ]; then
        check_pass "Backend .env file permissions secure: $BACKEND_ENV_PERMS"
    else
        check_warn "Backend .env file permissions not secure: $BACKEND_ENV_PERMS (recommend: 600)"
        echo "         Run: chmod 600 backend/.env"
    fi
fi

# Check for console.log in production code (sample check)
CONSOLE_COUNT=$(find frontend/src -name "*.js" -o -name "*.jsx" | xargs grep -h "console\.log" 2>/dev/null | wc -l)
if [ $CONSOLE_COUNT -lt 10 ]; then
    check_pass "Console.log statements: $CONSOLE_COUNT (acceptable)"
else
    check_warn "Console.log statements: $CONSOLE_COUNT (should be removed for production)"
fi

echo ""
echo -e "${BLUE}8. Checking Documentation...${NC}\n"

# Check for required documentation
for doc in docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md \
           docs/deployment/PRODUCTION-READINESS-CHECKLIST.md \
           docs/deployment/LOCAL-LAN-SECURITY.md \
           docs/INTEGRATION_GUIDE.md \
           README.md; do
    if [ -f "$doc" ]; then
        check_pass "Documentation exists: $doc"
    else
        check_warn "Documentation missing: $doc"
    fi
done

echo ""
echo -e "${BLUE}9. Checking Test Environment...${NC}\n"

# Check for test directories
if [ -d "tests" ] || [ -d "backend/tests" ] || [ -d "frontend/src/__tests__" ]; then
    check_pass "Test directories found"
else
    check_warn "Test directories not found"
fi

# Check if pytest is installed (backend)
if [ -d "backend/venv" ]; then
    if backend/venv/bin/python -c "import pytest" 2>/dev/null; then
        check_pass "pytest installed in backend"
    else
        check_warn "pytest not found in backend venv"
    fi
fi

# Check if frontend test runner available
if [ -d "frontend/node_modules" ]; then
    if [ -f "frontend/node_modules/.bin/jest" ] || [ -f "frontend/node_modules/.bin/react-scripts" ]; then
        check_pass "Frontend test runner available"
    else
        check_warn "Frontend test runner not found"
    fi
fi

echo ""
echo -e "${BLUE}10. Network Configuration...${NC}\n"

# Get local IP address
if command -v ip &> /dev/null; then
    LOCAL_IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | cut -d/ -f1 | head -1)
    if [ -n "$LOCAL_IP" ]; then
        check_pass "Local IP address: $LOCAL_IP"

        # Check if IP is private
        if echo $LOCAL_IP | grep -qE "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" ; then
            check_pass "IP is in private range (LAN deployment model)"
        else
            check_warn "IP is not in private range - verify network configuration"
        fi
    fi
elif command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)
    if [ -n "$LOCAL_IP" ]; then
        check_pass "Local IP address: $LOCAL_IP"
    fi
else
    check_warn "Cannot determine local IP address"
fi

# Check if port 8000 is open
if command -v lsof &> /dev/null; then
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        check_pass "Port 8000 is in use (backend running)"
    else
        check_warn "Port 8000 not in use (backend not running)"
    fi
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Validation Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"

echo ""

# Determine overall status
if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ VALIDATION PASSED${NC}"
        echo -e "${GREEN}System is ready for deployment!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ VALIDATION PASSED WITH WARNINGS${NC}"
        echo -e "${YELLOW}Review warnings before deployment${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo -e "${RED}Fix the failed checks before deployment${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the failed checks above"
    echo "2. Consult docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md"
    echo "3. Re-run this script after fixes"
    exit 1
fi
