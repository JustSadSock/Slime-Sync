import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  ClientMessage,
  JoinMessage,
  InputMessage,
  PlayerSnapshot,
  generateRandomColor,
  clampPlayerPosition,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION,
  DASH_COOLDOWN,
} from '@slime-sync/shared';

// Configuration from environment variables with validation
function parseEnvInt(value: string | undefined, defaultValue: number, min: number, max: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    console.warn(`Invalid value "${value}", using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

const PORT = parseEnvInt(process.env.PORT, 3001, 1, 65535);
const TICK_HZ = parseEnvInt(process.env.TICK_HZ, 30, 1, 120);
const SNAPSHOT_HZ = parseEnvInt(process.env.SNAPSHOT_HZ, 15, 1, 60);

const TICK_INTERVAL = 1000 / TICK_HZ;
const SNAPSHOT_INTERVAL = 1000 / SNAPSHOT_HZ;

interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anim: string;
  dashStartTime: number;
  lastDashTime: number;
  lastInputSeq: number;
}

interface ClientConnection {
  ws: WebSocket;
  playerId: string | null;
  lastPingTime: number;
}

class GameServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private players: Map<string, PlayerState> = new Map();
  private lastTickTime: number = Date.now();

  constructor(port: number) {
    this.httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', players: this.players.size }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.setupServer();
    
    this.httpServer.listen(port, () => {
      console.log(`[SERVER] HTTP + WebSocket server started on port ${port}`);
      console.log(`[SERVER] WebSocket endpoint: ws://localhost:${port}/ws`);
      console.log(`[SERVER] Tick rate: ${TICK_HZ} Hz, Snapshot rate: ${SNAPSHOT_HZ} Hz`);
    });

    this.startGameLoop();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = { 
        ws, 
        playerId: null,
        lastPingTime: Date.now()
      };
      this.clients.set(clientId, client);

      console.log(`[SERVER] Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('[SERVER] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[SERVER] WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  private handleMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case MessageType.JOIN:
        this.handleJoin(clientId, message);
        break;
      case MessageType.INPUT:
        this.handleInput(clientId, message);
        break;
      case MessageType.PING:
        this.handlePing(clientId, message.t);
        break;
    }
  }

  private handleJoin(clientId: string, message: JoinMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const player: PlayerState = {
      id: clientId,
      name: message.name || 'Anonymous',
      color: generateRandomColor(),
      x: WORLD_WIDTH / 2 + (Math.random() - 0.5) * 100,
      y: WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
      anim: 'idle',
      dashStartTime: 0,
      lastDashTime: 0,
      lastInputSeq: 0,
    };

    client.playerId = clientId;
    this.players.set(clientId, player);

    this.sendToClient(clientId, {
      type: MessageType.WELCOME,
      playerId: clientId,
      serverTime: Date.now(),
    });

    console.log(`[SERVER] Player joined: ${player.name} (${clientId})`);
  }

  private handleInput(clientId: string, message: InputMessage): void {
    const player = this.players.get(clientId);
    if (!player) return;

    if (message.seq <= player.lastInputSeq) return;
    player.lastInputSeq = message.seq;

    this.applyInput(player, message, message.dt / 1000);
  }

  private applyInput(player: PlayerState, input: InputMessage, dt: number): void {
    const now = Date.now();
    const isDashing = now - player.dashStartTime < DASH_DURATION;
    
    if (input.dash && !isDashing) {
      const canDash = now - player.lastDashTime >= DASH_COOLDOWN;
      if (canDash && (input.dx !== 0 || input.dy !== 0)) {
        player.dashStartTime = now;
        player.lastDashTime = now;
        player.anim = 'dash';
      }
    }

    const speed = isDashing ? PLAYER_SPEED * DASH_SPEED_MULTIPLIER : PLAYER_SPEED;
    const magnitude = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
    let dx = input.dx;
    let dy = input.dy;
    
    if (magnitude > 0) {
      dx = input.dx / magnitude;
      dy = input.dy / magnitude;
    }

    player.vx = dx * speed;
    player.vy = dy * speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    
    const clamped = clampPlayerPosition(player.x, player.y, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS);
    player.x = clamped.x;
    player.y = clamped.y;

    if (isDashing) {
      player.anim = 'dash';
    } else if (magnitude > 0) {
      player.anim = 'move';
    } else {
      player.anim = 'idle';
    }
  }

  private handlePing(clientId: string, t: number): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPingTime = Date.now();
    this.sendToClient(clientId, {
      type: MessageType.PONG,
      t,
      serverTime: Date.now(),
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client?.playerId) {
      this.players.delete(client.playerId);
      this.broadcast({
        type: MessageType.PLAYER_LEFT,
        id: client.playerId,
      });
      console.log(`[SERVER] Player left: ${client.playerId}`);
    }
    this.clients.delete(clientId);
  }

  private startGameLoop(): void {
    setInterval(() => this.tick(), TICK_INTERVAL);
    setInterval(() => this.broadcastSnapshot(), SNAPSHOT_INTERVAL);
  }

  private tick(): void {
    const now = Date.now();
    for (const player of this.players.values()) {
      const isDashing = now - player.dashStartTime < DASH_DURATION;
      if (!isDashing && player.anim === 'dash') {
        player.anim = player.vx === 0 && player.vy === 0 ? 'idle' : 'move';
      }
    }
  }

  private broadcastSnapshot(): void {
    if (this.players.size === 0) return;

    const playerSnapshots: PlayerSnapshot[] = Array.from(this.players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      anim: p.anim,
      name: p.name,
      color: p.color,
    }));

    const ackSeqs: Record<string, number> = {};
    for (const player of this.players.values()) {
      ackSeqs[player.id] = player.lastInputSeq;
    }

    this.broadcast({
      type: MessageType.SNAPSHOT,
      serverTime: Date.now(),
      players: playerSnapshots,
      ackSeqByPlayerId: ackSeqs,
    });
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

new GameServer(PORT);
