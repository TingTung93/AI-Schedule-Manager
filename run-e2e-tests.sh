#!/bin/bash

# AI Schedule Manager - E2E Test Runner Script
# This script sets up the environment and runs comprehensive E2E tests

echo "🚀 AI Schedule Manager - E2E Test Suite"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Install Playwright browsers if not already installed
echo "🌐 Installing Playwright browsers..."
npx playwright install
echo ""

# Start backend server
echo "🔧 Starting backend server..."
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null || true
pip install -r requirements.txt 2>/dev/null || pip install fastapi uvicorn sqlalchemy psycopg2-binary redis celery
uvicorn src.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..
echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
echo ""

# Start frontend server
echo "🎨 Starting frontend server..."
cd frontend
npm install
npm start &
FRONTEND_PID=$!
cd ..
echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"
echo ""

# Wait for servers to be ready
echo "⏳ Waiting for servers to be ready..."
sleep 10

# Check if servers are running
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo -e "${YELLOW}⚠️  Backend may not be fully ready${NC}"
fi

if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${YELLOW}⚠️  Frontend may not be fully ready${NC}"
fi

echo ""
echo "🧪 Running E2E Tests..."
echo "========================"
echo ""

# Run tests with different configurations
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    
    echo "Running: $suite_name"
    echo "----------------------------------------"
    
    if $test_command; then
        echo -e "${GREEN}✅ $suite_name passed${NC}"
    else
        echo -e "${RED}❌ $suite_name failed${NC}"
        FAILED_TESTS+=("$suite_name")
    fi
    echo ""
}

FAILED_TESTS=()

# Run different test suites
run_test_suite "Authentication Tests" "npx playwright test 01-authentication.spec.ts"
run_test_suite "Rule Management Tests" "npx playwright test 02-rule-management.spec.ts"
run_test_suite "Schedule Generation Tests" "npx playwright test 03-schedule-generation.spec.ts"
run_test_suite "AI Optimization Tests" "npx playwright test 04-ai-optimization.spec.ts"
run_test_suite "Calendar Integration Tests" "npx playwright test 05-calendar-integration.spec.ts"
run_test_suite "Notification Tests" "npx playwright test 06-notifications.spec.ts"

# Run all tests together for coverage
echo "📊 Running complete test suite for coverage..."
npx playwright test --reporter=html

# Generate and open report
echo ""
echo "📈 Generating test report..."
npx playwright show-report

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null

# Summary
echo ""
echo "========================================"
echo "📋 Test Summary"
echo "========================================"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All test suites passed successfully!${NC}"
else
    echo -e "${RED}❌ Failed test suites:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
fi

echo ""
echo "📊 Test report available at: playwright-report/index.html"
echo "📝 Test results saved to: test-results.json"
echo ""
echo "To run tests again:"
echo "  npm test                 # Run all tests"
echo "  npm run test:ui          # Run with UI mode"
echo "  npm run test:debug       # Run in debug mode"
echo "  npm run test:report      # View last report"
echo ""
echo "🎉 E2E Test execution complete!"