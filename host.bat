@echo off
REM Slime-Sync Host Script for Windows
REM This script starts the game server and Cloudflare Tunnel

echo ======================================
echo Slime-Sync Server Hosting Script
echo ======================================
echo.

REM Check if cloudflared is available
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] cloudflared not found in PATH!
    echo.
    echo Please install Cloudflare Tunnel:
    echo 1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo 2. Add to PATH or place in this directory
    echo.
    pause
    exit /b 1
)

REM Change to server directory
cd server

REM Create .env file from .env.example if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env file from .env.example...
        copy .env.example .env >nul
    ) else (
        echo [INFO] Creating default .env file...
        (
            echo # Server Configuration
            echo PORT=3001
            echo TICK_HZ=30
            echo SNAPSHOT_HZ=15
        ) > .env
    )
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing server dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Build server
echo [INFO] Building server...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to build server
    pause
    exit /b 1
)

REM Start server in a new window with proper environment
echo [INFO] Starting server on port 3001...
echo [INFO] Server will run in a separate window.
echo [INFO] Check that window for server output and errors.
start "Slime-Sync Server" cmd /k "node dist/index.js"

REM Wait for server to start
echo [INFO] Waiting for server to initialize...
timeout /t 5 /nobreak >nul

REM Test if server is responding
echo [INFO] Testing server connection...
curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Server is running and responding on port 3001
) else (
    echo [WARNING] Could not verify server is running. Check the server window for errors.
    echo [INFO] Server should be accessible at http://localhost:3001
)

cd ..

REM Start Cloudflare Tunnel
echo.
echo [INFO] Starting Cloudflare Tunnel: irgri-tunnel
echo [INFO] Make sure your tunnel is configured in ~/.cloudflared/config.yml
echo.
cloudflared tunnel run irgri-tunnel

REM If tunnel exits, keep window open
echo.
echo [INFO] Tunnel stopped. Press any key to exit...
pause >nul
