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

# Create .env file from .env.example if it doesn't exist
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Write-Host "[INFO] Creating .env file from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
    } else {
        Write-Host "[INFO] Creating default .env file..." -ForegroundColor Yellow
        @"
# Server Configuration
PORT=3001
TICK_HZ=30
SNAPSHOT_HZ=15
"@ | Out-File -FilePath ".env" -Encoding UTF8
    }
}

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
Write-Host "[INFO] Starting server on port 3001..." -ForegroundColor Green
Write-Host "[INFO] Server will run in a separate window." -ForegroundColor Yellow
Write-Host "[INFO] Check that window for server output and errors." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node dist/index.js"

# Wait for server to start
Write-Host "[INFO] Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test if server is responding
Write-Host "[INFO] Testing server connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "[SUCCESS] Server is running and responding on port 3001" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARNING] Could not verify server is running. Check the server window for errors." -ForegroundColor Yellow
    Write-Host "[INFO] Server should be accessible at http://localhost:3001" -ForegroundColor Cyan
}

Set-Location ..

# Start Cloudflare Tunnel
Write-Host ""
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
