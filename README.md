# Slime-Sync

🟢 Real-time multiplayer game with WebSocket synchronization, client-side prediction, and server reconciliation.

## 🎮 Features

- **Real-time Multiplayer**: See other players move in real-time with minimal latency
- **Client-Side Prediction**: Instant local response to inputs
- **Server Reconciliation**: Smooth correction of prediction errors
- **Interpolation**: Buttery-smooth movement for other players
- **Cross-Platform**: Works on desktop (WASD/arrows) and mobile (virtual joystick)
- **Dash Ability**: Speed boost with cooldown mechanic
- **Production Ready**: Deploy client to Netlify, server via Cloudflare Tunnel

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Netlify (CDN)                       │
│                    Static Client Deployment                 │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS + WSS
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Tunnel                        │
│              Secure Connection (no port opening)            │
└────────────────┬────────────────────────────────────────────┘
                 │ WebSocket (/ws)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Windows Server (Local)                    │
│      Game Server (Node.js + ws) on localhost:3001         │
│   • 30Hz tick rate  • 15Hz snapshot broadcast              │
│   • Input buffering • Dash cooldown mechanics              │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** package manager
- **Cloudflared** (for hosting) - [Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Servers

This starts both client and server in parallel:

```bash
npm run dev
```

- **Server**: http://localhost:3001 (WebSocket: ws://localhost:3001/ws)
- **Client**: http://localhost:3000

### 3. Play!

Open http://localhost:3000 in multiple browser tabs or devices on your network to see real-time synchronization.

## 🌐 Production Deployment

### Client Deployment (Netlify)

1. **Fork/Clone this repository** to your GitHub account

2. **Import to Netlify**:
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Select your repository

3. **Configure Environment Variable** (Optional):
   - By default, the client will connect to `wss://irgri.uk/ws` when served over HTTPS
   - To use a custom server, add in Netlify Site Settings → Environment Variables:
   - `VITE_WS_URL` = `wss://your-custom-domain.com/ws`

4. **Deploy**:
   - Netlify will automatically build and deploy
   - Build command: `cd client && npm ci && npm run build`
   - Publish directory: `client/dist`

### Server Deployment (Windows + Cloudflare Tunnel)

**Production Server**: The game server is hosted at `irgri.uk` via Cloudflare Tunnel.

#### Step 1: Setup Cloudflare Tunnel

1. **Install Cloudflared**:
   - Download from [Cloudflare Downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
   - Add `cloudflared.exe` to your PATH

2. **Authenticate**:
   ```cmd
   cloudflared tunnel login
   ```

3. **Create Tunnel**:
   ```cmd
   cloudflared tunnel create irgri-tunnel
   ```
   
   Note the tunnel UUID shown in output.

4. **Configure DNS**:
   ```cmd
   cloudflared tunnel route dns irgri-tunnel irgri.uk
   ```
   
   This routes `irgri.uk` domain to the tunnel.

5. **Create Configuration**:
   - Copy `cloudflared/config.example.yml`
   - Save to `C:\Users\YourUsername\.cloudflared\config.yml`
   - Update with your tunnel UUID and set hostname to `irgri.uk`

#### Step 2: Run Host Script

From the project root:

```cmd
host.bat
```

Or with PowerShell:

```powershell
.\host.ps1
```

This will:
1. Build the server
2. Start the server on port 3001
3. Start the Cloudflare tunnel

**Detailed setup**: See [cloudflared/README.md](cloudflared/README.md)

## 🎯 How to Test

1. **Local Testing**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 in two browser tabs

2. **Network Testing**:
   - Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - Open http://YOUR_IP:3000 on another device on same network

3. **Production Testing**:
   - Deploy client to Netlify
   - Run `host.bat` on Windows
   - Visit your Netlify URL from any device

You should see:
- ✅ Players can join with custom names
- ✅ Movement is synchronized in real-time
- ✅ No "teleporting" or jittering
- ✅ Dash ability works with cooldown
- ✅ Debug overlay shows connection status and RTT

## 🎮 Controls

### Desktop
- **WASD** or **Arrow Keys**: Move
- **Space**: Dash (2 second cooldown)

### Mobile
- **Virtual Joystick**: Move (drag anywhere on screen)
- **Dash Button**: Speed boost (bottom-right corner)

## 📁 Project Structure

```
/
├── client/              # Vite + TypeScript + Canvas 2D
│   ├── src/
│   │   └── main.ts      # Game client with prediction & interpolation
│   ├── index.html       # Entry point with UI
│   └── .env.example     # Environment variables template
│
├── server/              # Node.js + WebSocket (ws)
│   ├── src/
│   │   └── index.ts     # Game server with fixed tickrate
│   └── .env.example     # Server configuration template
│
├── shared/              # Shared TypeScript types and constants
│   ├── src/
│   │   ├── types.ts     # Message protocol definitions
│   │   ├── constants.ts # Game constants (speeds, world size, etc.)
│   │   └── utils.ts     # Shared utility functions
│
├── cloudflared/         # Cloudflare Tunnel configuration
│   ├── config.example.yml  # Tunnel ingress rules
│   └── README.md           # Detailed setup guide
│
├── host.bat             # Windows hosting script
├── host.ps1             # PowerShell hosting script
├── netlify.toml         # Netlify build configuration
└── package.json         # Monorepo workspace configuration
```

## ⚙️ Configuration

### Server Environment Variables

Create `server/.env` (see `server/.env.example`):

```env
PORT=3001          # Server port
TICK_HZ=30         # Game tick rate (30 Hz recommended)
SNAPSHOT_HZ=15     # Snapshot broadcast rate (15 Hz recommended)
```

### Client Environment Variables

Create `client/.env` (see `client/.env.example`):

```env
VITE_WS_URL=ws://localhost:3001/ws
```

For production (Netlify), set `VITE_WS_URL` in Netlify environment variables.

## 🔧 Development Commands

### Root Commands
```bash
npm run dev          # Start client + server in parallel
npm run build        # Build all workspaces
npm run host         # Run host.bat (Windows only)
```

### Client Commands
```bash
npm run dev:client   # Start Vite dev server
npm run build:client # Build for production
```

### Server Commands
```bash
npm run dev:server   # Start with nodemon (auto-restart)
npm run build:server # Compile TypeScript
npm run start:server # Run production build
```

### Shared Commands
```bash
npm run build:shared # Compile shared types
```

## 🧪 Networking Details

### Client-Side Prediction
- Client applies inputs immediately without waiting for server
- Creates responsive feel even with network latency

### Server Reconciliation
- Server sends back acknowledged input sequence number
- Client replays unacknowledged inputs if position differs
- Threshold: 5 units difference triggers reconciliation

### Interpolation
- Other players rendered with 100ms delay
- Linear interpolation between snapshots
- Smooth movement even with 15Hz snapshot rate

### Message Protocol

**Client → Server**:
- `join`: Player name
- `input`: { seq, dt, dx, dy, dash, clientTime }
- `ping`: Round-trip time measurement

**Server → Client**:
- `welcome`: Player ID and server time
- `snapshot`: World state with all players
- `pong`: RTT response
- `player_left`: Player disconnect notification

## 🐛 Troubleshooting

### Client can't connect to server
- ✅ Check server is running: `http://localhost:3001/health`
- ✅ Verify VITE_WS_URL matches server URL
- ✅ Check browser console for errors

### Cloudflare Tunnel not working
- ✅ Run `cloudflared tunnel list` to verify tunnel exists
- ✅ Check config.yml has correct tunnel UUID
- ✅ Verify ingress rules in config.yml
- ✅ Test locally first: `ws://localhost:3001/ws`

### Players teleporting/jittering
- ⚠️ High latency (>200ms) - check network connection
- ⚠️ Packet loss - check WiFi signal strength
- ✅ Debug overlay shows RTT - aim for <100ms

### Build errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Rebuild all workspaces
npm run build
```

## 📚 Additional Resources

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Netlify Docs](https://docs.netlify.com/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Game Networking Patterns](https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/)

## 🔒 Security Notes

⚠️ **Never commit**:
- `.cloudflared/*.json` (tunnel credentials)
- `.cloudflared/config.yml` (your actual configuration)
- `.env` files with real values

✅ **Committed**:
- `.env.example` files (templates only)
- `config.example.yml` (example configuration)

## 📄 License

ISC

## 🤝 Contributing

This is an MVP. Contributions welcome! Please open issues for bugs or feature requests.

---

**Built with** TypeScript, Node.js, Vite, Canvas 2D, WebSockets, Cloudflare Tunnel, and Netlify
