# Slime-Sync Host Script for Windows (PowerShell)
# This script starts the game server and Cloudflare Tunnel

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Slime-Sync Server Hosting Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if cloudflared is available
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "[ERROR] cloudflared not found in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Cloudflare Tunnel:"
    Write-Host "1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    Write-Host "2. Add to PATH or place in this directory"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to server directory
Set-Location server

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing server dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Build server
Write-Host "[INFO] Building server..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to build server" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start server in a new window
Write-Host "[INFO] Starting server on port $env:PORT (default: 3001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node dist/index.js"

# Wait for server to start
Write-Host "[INFO] Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Set-Location ..

# Start Cloudflare Tunnel
Write-Host "[INFO] Starting Cloudflare Tunnel: irgri-tunnel" -ForegroundColor Green
Write-Host "[INFO] Make sure your tunnel is configured in ~/.cloudflared/config.yml" -ForegroundColor Yellow
Write-Host ""

try {
    cloudflared tunnel run irgri-tunnel
} catch {
    Write-Host "[ERROR] Tunnel failed: $_" -ForegroundColor Red
} finally {
    Write-Host ""
    Read-Host "Press Enter to exit"
}
