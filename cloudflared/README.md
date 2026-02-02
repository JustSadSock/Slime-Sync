# Cloudflare Tunnel Setup Guide

This directory contains example configurations for Cloudflare Tunnel (cloudflared).

## What is Cloudflare Tunnel?

Cloudflare Tunnel creates a secure connection from your local server to Cloudflare's edge network without opening inbound ports on your firewall.

## Setup Steps

### 1. Install Cloudflared
Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### 2. Login to Cloudflare
```cmd
cloudflared tunnel login
```

### 3. Create a Tunnel
```cmd
cloudflared tunnel create irgri-tunnel
```

### 4. Configure DNS
```cmd
cloudflared tunnel route dns irgri-tunnel your-domain.com
```

### 5. Create Configuration
Copy `config.example.yml` to `C:\Users\YourUsername\.cloudflared\config.yml` and edit with your tunnel UUID and domain.

### 6. Run with Slime-Sync
```cmd
host.bat
```

See the full guide in the main README.md
