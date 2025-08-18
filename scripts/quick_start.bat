@echo off
REM AI Schedule Manager - Windows Quick Start
REM One-click deployment for Windows Docker Desktop

echo ========================================
echo   AI Schedule Manager - Quick Deploy
echo ========================================
echo.

REM Check Docker installation
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Desktop is not installed or not running!
    echo Please install Docker Desktop from: https://docs.docker.com/desktop/windows/install/
    echo.
    echo Make sure Docker Desktop is running and try again.
    pause
    exit /b 1
)

echo [OK] Docker Desktop detected
echo.

REM Check if containers are already running
docker-compose ps | findstr "Up" >nul 2>&1
if %errorlevel% equ 0 (
    echo Existing deployment detected. What would you like to do?
    echo 1) Restart all services
    echo 2) Stop all services  
    echo 3) View logs
    echo 4) Exit
    set /p choice="Enter choice (1-4): "
    
    if "%choice%"=="1" (
        echo Restarting services...
        docker-compose down
        docker-compose up -d
    ) else if "%choice%"=="2" (
        echo Stopping services...
        docker-compose down
        pause
        exit /b 0
    ) else if "%choice%"=="3" (
        docker-compose logs -f
        pause
        exit /b 0
    ) else (
        exit /b 0
    )
) else (
    echo Starting fresh deployment...
    echo.
    
    REM Create .env file if it doesn't exist
    if not exist .env (
        echo Creating environment configuration...
        (
            echo # AI Schedule Manager Configuration
            echo DATABASE_URL=postgresql://scheduleuser:schedulepass123@postgres:5432/scheduledb
            echo REDIS_URL=redis://redis:6379
            echo SECRET_KEY=your-secret-key-change-in-production-%RANDOM%%RANDOM%
            echo CORS_ORIGINS=http://localhost:3000
            echo ENVIRONMENT=production
        ) > .env
        echo [OK] Configuration created
    )
    
    REM Pull latest images
    echo Pulling Docker images...
    docker-compose pull
    
    REM Start services
    echo Starting services...
    docker-compose up -d
    
    REM Wait for services
    echo Waiting for services to initialize...
    timeout /t 10 /nobreak >nul
    
    REM Check health
    echo Checking service health...
    
    curl -f http://localhost:8000/health >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Backend API is running
    ) else (
        echo [WARNING] Backend API is not responding yet. It may still be starting up.
    )
    
    curl -f http://localhost:3000 >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Frontend is running
    ) else (
        echo [WARNING] Frontend is not responding yet. It may still be starting up.
    )
)

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Access your AI Schedule Manager:
echo   - Main Application: http://localhost:3000
echo   - API Documentation: http://localhost:8000/docs
echo   - Task Monitor: http://localhost:5555
echo.
echo Default login:
echo   - Email: admin@example.com
echo   - Password: admin123
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
echo Need help? Visit: https://github.com/yourusername/AI-Schedule-Manager
echo.

pause