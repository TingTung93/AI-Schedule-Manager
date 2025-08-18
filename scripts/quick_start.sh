#!/bin/bash

# AI Schedule Manager - Quick Start Script
# One-click deployment for Docker environments

set -e

echo "========================================"
echo "  AI Schedule Manager - Quick Deploy"
echo "========================================"
echo ""

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed!"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed!"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker detected"

# Check if containers are already running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "Existing deployment detected. What would you like to do?"
    echo "1) Restart all services"
    echo "2) Stop all services"
    echo "3) View logs"
    echo "4) Exit"
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            echo "Restarting services..."
            docker-compose down
            docker-compose up -d
            ;;
        2)
            echo "Stopping services..."
            docker-compose down
            exit 0
            ;;
        3)
            docker-compose logs -f
            exit 0
            ;;
        4)
            exit 0
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
else
    echo "Starting fresh deployment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo "Creating environment configuration..."
        cat > .env << EOF
# AI Schedule Manager Configuration
DATABASE_URL=postgresql://scheduleuser:schedulepass123@postgres:5432/scheduledb
REDIS_URL=redis://redis:6379
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=production
EOF
        echo "✓ Configuration created"
    fi
    
    # Pull latest images
    echo "Pulling Docker images..."
    docker-compose pull
    
    # Start services
    echo "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    echo "Waiting for services to initialize..."
    sleep 10
    
    # Check health
    echo "Checking service health..."
    
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "✓ Backend API is running"
    else
        echo "⚠ Backend API is not responding yet. It may still be starting up."
    fi
    
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo "✓ Frontend is running"
    else
        echo "⚠ Frontend is not responding yet. It may still be starting up."
    fi
fi

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Access your AI Schedule Manager:"
echo "  • Main Application: http://localhost:3000"
echo "  • API Documentation: http://localhost:8000/docs"
echo "  • Task Monitor: http://localhost:5555"
echo ""
echo "Default login:"
echo "  • Email: admin@example.com"
echo "  • Password: admin123"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo ""
echo "Need help? Visit: https://github.com/yourusername/AI-Schedule-Manager"
echo ""