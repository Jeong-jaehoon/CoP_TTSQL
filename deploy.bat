@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    TTSQL Deployment Script (Windows)
echo ========================================
echo.

:: Check Docker
echo [1/6] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)
echo [OK] Docker is installed
echo.

:: Check Docker Compose
echo [2/6] Checking Docker Compose...
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed.
    exit /b 1
)
echo [OK] Docker Compose is installed
echo.

:: Stop existing containers
echo [3/6] Stopping existing containers...
docker-compose down 2>nul
echo [OK] Containers stopped
echo.

:: Build image
echo [4/6] Building Docker image (this may take a while)...
docker-compose build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build image
    exit /b 1
)
echo [OK] Image built successfully
echo.

:: Start containers
echo [5/6] Starting TTSQL application...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start containers
    exit /b 1
)
echo [OK] Application started
echo.

:: Wait and test
echo [6/6] Testing application (waiting 15 seconds)...
timeout /t 15 /nobreak >nul

curl -s http://localhost:8787/api/test >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] API test failed, but container may still be starting...
    echo [INFO] Check logs with: docker-compose logs -f
) else (
    echo [OK] API is responding
)
echo.

:: Success message
echo ========================================
echo  Deployment completed!
echo ========================================
echo.
echo Access points:
echo   - Web Interface: http://localhost:8787
echo   - Ollama API: http://localhost:11434
echo.
echo Useful commands:
echo   - View logs: docker-compose logs -f
echo   - Stop: docker-compose down
echo   - Restart: docker-compose restart
echo   - Status: docker-compose ps
echo.

pause
