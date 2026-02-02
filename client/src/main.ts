import {
  MessageType,
  JoinMessage,
  InputMessage,
  PingMessage,
  SnapshotMessage,
  WelcomeMessage,
  PongMessage,
  PlayerLeftMessage,
  PlayerSnapshot,
  ServerMessage,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  INTERPOLATION_DELAY,
  RECONCILIATION_THRESHOLD,
  SNAPSHOT_RETENTION_MS,
  clampPlayerPosition,
} from '@slime-sync/shared';

// Mobile controls
const DASH_BUTTON_SIZE = 80; // size of dash button touch area
const DASH_BUTTON_OFFSET = 50; // position offset from bottom-right corner
const JOYSTICK_MAX_DISTANCE = 50; // max distance from center for joystick
const DEFAULT_WS_PORT = 3001; // default WebSocket port

interface PendingInput {
  seq: number;
  dt: number;
  dx: number;
  dy: number;
  dash: boolean;
  clientTime: number;
}

interface InterpolationSnapshot {
  timestamp: number;
  x: number;
  y: number;
}

interface OtherPlayer {
  id: string;
  name: string;
  color: string;
  snapshots: InterpolationSnapshot[];
  currentX: number;
  currentY: number;
}

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private playerName: string = 'Player';
  
  // Player state
  private playerX: number = WORLD_WIDTH / 2;
  private playerY: number = WORLD_HEIGHT / 2;
  private playerColor: string = '#00ff00';
  
  // Input tracking
  private inputSeq: number = 0;
  private pendingInputs: PendingInput[] = [];
  private keys: Set<string> = new Set();
  
  // Other players with interpolation
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  
  // Mobile controls
  private joystickActive: boolean = false;
  private joystickStartX: number = 0;
  private joystickStartY: number = 0;
  private joystickDx: number = 0;
  private joystickDy: number = 0;
  private joystickPointerId: number | null = null;
  private dashButtonActive: boolean = false;
  private dashRequested: boolean = false;
  
  // Timing
  private lastFrameTime: number = performance.now();
  private serverTimeOffset: number = 0;
  
  // RTT tracking
  private rtt: number = 0;
  private lastPingTime: number = 0;
  
  // UI Elements
  private loginScreen: HTMLElement;
  private playerNameInput: HTMLInputElement;
  private joinButton: HTMLButtonElement;
  private connectionStatus: HTMLElement;
  private playerCountDisplay: HTMLElement;
  
  private isConnected: boolean = false;

  constructor() {
    // Setup canvas
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    // Get UI elements
    this.loginScreen = document.getElementById('login-screen')!;
    this.playerNameInput = document.getElementById('player-name') as HTMLInputElement;
    this.joinButton = document.getElementById('connect-button') as HTMLButtonElement;
    this.connectionStatus = document.getElementById('connection-status')!;
    this.playerCountDisplay = document.getElementById('player-count')!;
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start game loop
    this.gameLoop();
  }
  
  private setupEventListeners(): void {
    // Join button
    this.joinButton.addEventListener('click', () => this.connect());
    this.playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connect();
    });
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ' && this.isConnected) {
        this.dashRequested = true;
        e.preventDefault();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    
    // Mobile touch controls - joystick
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Right side is dash button
      if (x > WORLD_WIDTH - DASH_BUTTON_SIZE && y > WORLD_HEIGHT - DASH_BUTTON_SIZE) {
        this.dashButtonActive = true;
        this.dashRequested = true;
        e.preventDefault();
        return;
      }
      
      // Left side is joystick
      if (this.joystickPointerId === null) {
        this.joystickActive = true;
        this.joystickPointerId = e.pointerId;
        this.joystickStartX = x;
        this.joystickStartY = y;
        this.canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    });
    
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.joystickActive && e.pointerId === this.joystickPointerId) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const dx = x - this.joystickStartX;
        const dy = y - this.joystickStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > JOYSTICK_MAX_DISTANCE) {
          this.joystickDx = (dx / distance) * JOYSTICK_MAX_DISTANCE;
          this.joystickDy = (dy / distance) * JOYSTICK_MAX_DISTANCE;
        } else {
          this.joystickDx = dx;
          this.joystickDy = dy;
        }
        e.preventDefault();
      }
    });
    
    this.canvas.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.joystickPointerId) {
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickDx = 0;
        this.joystickDy = 0;
        this.canvas.releasePointerCapture(e.pointerId);
      }
      
      this.dashButtonActive = false;
    });
    
    this.canvas.addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.joystickPointerId) {
        this.joystickActive = false;
        this.joystickPointerId = null;
        this.joystickDx = 0;
        this.joystickDy = 0;
      }
      this.dashButtonActive = false;
    });
    
    // Connection status click to disconnect
    this.connectionStatus.addEventListener('click', () => {
      if (this.isConnected) {
        this.disconnect();
      }
    });
  }
  
  private connect(): void {
    const name = this.playerNameInput.value.trim() || 'Player';
    this.playerName = name;
    
    // Use secure WebSocket if page is served over HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsUrl = `${protocol}//localhost:${DEFAULT_WS_PORT}/ws`;
    const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.addEventListener('open', () => {
      this.isConnected = true;
      this.connectionStatus.textContent = 'Connected';
      this.connectionStatus.className = 'connected';
      this.loginScreen.classList.add('hidden');
      
      // Send join message
      const joinMsg: JoinMessage = {
        type: MessageType.JOIN,
        name: this.playerName,
      };
      this.send(joinMsg);
      
      // Start ping loop
      this.startPingLoop();
    });
    
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data) as ServerMessage;
      this.handleServerMessage(msg);
    });
    
    this.ws.addEventListener('close', () => {
      this.isConnected = false;
      this.connectionStatus.textContent = 'Disconnected';
      this.connectionStatus.className = 'disconnected';
      this.loginScreen.classList.remove('hidden');
      this.ws = null;
    });
    
    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.connectionStatus.textContent = 'Disconnected';
    this.connectionStatus.className = 'disconnected';
    this.loginScreen.classList.remove('hidden');
  }
  
  private send(msg: JoinMessage | InputMessage | PingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
  
  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case MessageType.WELCOME:
        this.handleWelcome(msg);
        break;
      case MessageType.SNAPSHOT:
        this.handleSnapshot(msg);
        break;
      case MessageType.PONG:
        this.handlePong(msg);
        break;
      case MessageType.PLAYER_LEFT:
        this.handlePlayerLeft(msg);
        break;
    }
  }
  
  private handleWelcome(msg: WelcomeMessage): void {
    this.playerId = msg.playerId;
    this.serverTimeOffset = msg.serverTime - performance.now();
  }
  
  private handleSnapshot(msg: SnapshotMessage): void {
    const serverTime = msg.serverTime;
    
    // Update other players with interpolation snapshots
    for (const playerData of msg.players) {
      if (playerData.id === this.playerId) {
        // Handle reconciliation for own player
        this.reconcilePlayer(playerData, msg.ackSeqByPlayerId?.[this.playerId]);
      } else {
        // Add snapshot for other players
        this.addOtherPlayerSnapshot(playerData, serverTime);
      }
    }
    
    // Remove players not in snapshot
    const playerIds = new Set(msg.players.map((p: PlayerSnapshot) => p.id));
    for (const [id] of this.otherPlayers) {
      if (!playerIds.has(id)) {
        this.otherPlayers.delete(id);
      }
    }
    
    // Update player count
    this.playerCountDisplay.textContent = `Players: ${msg.players.length}`;
  }
  
  private reconcilePlayer(serverPlayer: PlayerSnapshot, ackSeq: number | undefined): void {
    if (ackSeq === undefined) return;
    
    // Remove acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.seq > ackSeq);
    
    // Calculate where we should be according to server
    let predictedX = serverPlayer.x;
    let predictedY = serverPlayer.y;
    
    // Replay pending inputs
    for (const input of this.pendingInputs) {
      const result = this.applyInput(predictedX, predictedY, input.dx, input.dy, input.dt);
      predictedX = result.x;
      predictedY = result.y;
    }
    
    // Check if difference is significant
    const dx = predictedX - this.playerX;
    const dy = predictedY - this.playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > RECONCILIATION_THRESHOLD) {
      // Reconcile position
      this.playerX = predictedX;
      this.playerY = predictedY;
    }
    
    // Update color from server
    this.playerColor = serverPlayer.color;
  }
  
  private addOtherPlayerSnapshot(playerData: PlayerSnapshot, serverTime: number): void {
    let player = this.otherPlayers.get(playerData.id);
    
    if (!player) {
      player = {
        id: playerData.id,
        name: playerData.name,
        color: playerData.color,
        snapshots: [],
        currentX: playerData.x,
        currentY: playerData.y,
      };
      this.otherPlayers.set(playerData.id, player);
    }
    
    player.name = playerData.name;
    player.color = playerData.color;
    
    // Add snapshot with timestamp
    player.snapshots.push({
      timestamp: serverTime,
      x: playerData.x,
      y: playerData.y,
    });
    
    // Keep only recent snapshots
    const cutoff = serverTime - SNAPSHOT_RETENTION_MS;
    player.snapshots = player.snapshots.filter(s => s.timestamp > cutoff);
  }
  
  private handlePong(msg: PongMessage): void {
    const now = performance.now();
    this.rtt = now - this.lastPingTime;
    this.serverTimeOffset = msg.serverTime - now + this.rtt / 2;
  }
  
  private handlePlayerLeft(msg: PlayerLeftMessage): void {
    this.otherPlayers.delete(msg.id);
  }
  
  private startPingLoop(): void {
    const sendPing = () => {
      if (!this.isConnected) return;
      
      this.lastPingTime = performance.now();
      const pingMsg: PingMessage = {
        type: MessageType.PING,
        t: this.lastPingTime,
      };
      this.send(pingMsg);
      
      setTimeout(sendPing, 1000);
    };
    
    sendPing();
  }
  
  private getInputVector(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    
    // Keyboard input
    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;
    
    // Joystick input
    if (this.joystickActive) {
      dx += this.joystickDx / JOYSTICK_MAX_DISTANCE;
      dy += this.joystickDy / JOYSTICK_MAX_DISTANCE;
    }
    
    // Normalize
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }
    
    return { dx, dy };
  }
  
  private applyInput(x: number, y: number, dx: number, dy: number, dt: number): { x: number; y: number } {
    const speed = PLAYER_SPEED;
    const newX = x + dx * speed * dt;
    const newY = y + dy * speed * dt;
    
    return clampPlayerPosition(newX, newY, WORLD_WIDTH, WORLD_HEIGHT, PLAYER_RADIUS);
  }
  
  private updatePlayer(dt: number): void {
    if (!this.isConnected || !this.playerId) return;
    
    const { dx, dy } = this.getInputVector();
    
    // Send input to server
    if (dx !== 0 || dy !== 0 || this.dashRequested) {
      this.inputSeq++;
      
      const input: PendingInput = {
        seq: this.inputSeq,
        dt,
        dx,
        dy,
        dash: this.dashRequested,
        clientTime: performance.now(),
      };
      
      this.pendingInputs.push(input);
      
      const inputMsg: InputMessage = {
        type: MessageType.INPUT,
        seq: input.seq,
        dt: input.dt,
        dx: input.dx,
        dy: input.dy,
        dash: input.dash,
        clientTime: input.clientTime,
      };
      this.send(inputMsg);
      
      // Client-side prediction
      const result = this.applyInput(this.playerX, this.playerY, dx, dy, dt);
      this.playerX = result.x;
      this.playerY = result.y;
      
      this.dashRequested = false;
    }
  }
  
  private interpolateOtherPlayers(): void {
    const now = performance.now();
    // Calculate render time in the past to smooth out network jitter
    // We use server time offset to convert to server timeline, then subtract INTERPOLATION_DELAY
    // to render slightly behind the latest snapshot for smooth interpolation
    const renderTime = now + this.serverTimeOffset - INTERPOLATION_DELAY;
    
    for (const player of this.otherPlayers.values()) {
      if (player.snapshots.length < 2) {
        if (player.snapshots.length === 1) {
          player.currentX = player.snapshots[0].x;
          player.currentY = player.snapshots[0].y;
        }
        continue;
      }
      
      // Find the two snapshots to interpolate between
      let from: InterpolationSnapshot | null = null;
      let to: InterpolationSnapshot | null = null;
      
      for (let i = 0; i < player.snapshots.length - 1; i++) {
        if (player.snapshots[i].timestamp <= renderTime && player.snapshots[i + 1].timestamp >= renderTime) {
          from = player.snapshots[i];
          to = player.snapshots[i + 1];
          break;
        }
      }
      
      if (from && to) {
        const total = to.timestamp - from.timestamp;
        const progress = (renderTime - from.timestamp) / total;
        
        player.currentX = from.x + (to.x - from.x) * progress;
        player.currentY = from.y + (to.y - from.y) * progress;
      } else if (player.snapshots.length > 0) {
        // Use latest snapshot if no interpolation possible
        const latest = player.snapshots[player.snapshots.length - 1];
        player.currentX = latest.x;
        player.currentY = latest.y;
      }
    }
  }
  
  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#2d3748';
    this.ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Draw grid
    this.ctx.strokeStyle = '#4a5568';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, WORLD_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(WORLD_WIDTH, y);
      this.ctx.stroke();
    }
    
    // Draw other players
    for (const player of this.otherPlayers.values()) {
      this.drawPlayer(player.currentX, player.currentY, player.color, player.name, false);
    }
    
    // Draw own player
    if (this.playerId) {
      this.drawPlayer(this.playerX, this.playerY, this.playerColor, this.playerName, true);
    }
    
    // Draw mobile controls
    if (this.joystickActive) {
      this.drawJoystick();
    }
    this.drawDashButton();
    
    // Draw debug overlay
    this.updateDebugOverlay();
  }
  
  private drawPlayer(x: number, y: number, color: string, name: string, isOwn: boolean): void {
    // Draw circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw outline
    this.ctx.strokeStyle = isOwn ? '#ffffff' : '#000000';
    this.ctx.lineWidth = isOwn ? 3 : 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Draw name
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(name, x, y - PLAYER_RADIUS - 10);
  }
  
  private drawJoystick(): void {
    const baseX = this.joystickStartX;
    const baseY = this.joystickStartY;
    const stickX = baseX + this.joystickDx;
    const stickY = baseY + this.joystickDy;
    
    // Draw base
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.beginPath();
    this.ctx.arc(baseX, baseY, JOYSTICK_MAX_DISTANCE, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw stick
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.beginPath();
    this.ctx.arc(stickX, stickY, 25, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  private drawDashButton(): void {
    const x = WORLD_WIDTH - DASH_BUTTON_OFFSET;
    const y = WORLD_HEIGHT - DASH_BUTTON_OFFSET;
    const radius = 30;
    
    this.ctx.fillStyle = this.dashButtonActive ? 'rgba(255, 100, 100, 0.8)' : 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#000000';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('DASH', x, y);
  }
  
  private updateDebugOverlay(): void {
    // Update HTML debug overlay elements
    const rttElement = document.getElementById('rtt');
    const inputSeqElement = document.getElementById('input-seq');
    
    if (rttElement) {
      rttElement.textContent = this.rtt > 0 ? Math.round(this.rtt).toString() : '-';
    }
    
    if (inputSeqElement) {
      inputSeqElement.textContent = this.inputSeq.toString();
    }
    
    // Player count is updated separately in handleSnapshot
  }
  
  private gameLoop(): void {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    
    // Update
    this.updatePlayer(dt);
    this.interpolateOtherPlayers();
    
    // Render
    this.render();
    
    // Continue loop
    requestAnimationFrame(() => this.gameLoop());
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Game());
} else {
  new Game();
}
