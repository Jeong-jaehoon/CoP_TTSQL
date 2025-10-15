@echo off
echo ========================================
echo    TTSQL Auto Startup Script
echo ========================================
echo.

:: Check if Docker is running
echo [1/3] Checking Docker...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo [INFO] Waiting for Docker to start (30 seconds)...
    timeout /t 30 /nobreak >nul
)
echo [OK] Docker is ready
echo.

:: Start Docker containers
echo [2/3] Starting TTSQL Docker container...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker containers
    pause
    exit /b 1
)
echo [OK] Docker containers started
echo.

:: Start ngrok
echo [3/3] Starting ngrok tunnel...
start /min ngrok.exe http 8787 --log=stdout
timeout /t 5 /nobreak >nul
echo [OK] ngrok tunnel started
echo.

:: Get ngrok URL
echo ========================================
echo  TTSQL is now running!
echo ========================================
echo.
echo Checking ngrok URL...
timeout /t 3 /nobreak >nul

curl -s http://localhost:4040/api/tunnels | findstr "public_url" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo Access your application at:
    for /f "tokens=2 delims=:," %%a in ('curl -s http://localhost:4040/api/tunnels ^| findstr "https://.*ngrok"') do (
        set URL=%%a
        set URL=!URL:"=!
        echo   External URL: !URL!
    )
    echo   Local URL: http://localhost:8787
    echo.
    echo ngrok Dashboard: http://localhost:4040
) else (
    echo [WARNING] Could not retrieve ngrok URL
    echo Please check: http://localhost:4040
)
echo.
echo ========================================
echo.

pause
