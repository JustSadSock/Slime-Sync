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

REM Start server in a new window
echo [INFO] Starting server on port %PORT% (default: 3001)...
start "Slime-Sync Server" cmd /k "node dist/index.js"

REM Wait for server to start
echo [INFO] Waiting for server to initialize...
timeout /t 3 /nobreak >nul

cd ..

REM Start Cloudflare Tunnel
echo [INFO] Starting Cloudflare Tunnel: irgri-tunnel
echo [INFO] Make sure your tunnel is configured in ~/.cloudflared/config.yml
echo.
cloudflared tunnel run irgri-tunnel

REM If tunnel exits, keep window open
echo.
echo [INFO] Tunnel stopped. Press any key to exit...
pause >nul
