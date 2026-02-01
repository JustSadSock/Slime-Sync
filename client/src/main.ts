import * as PIXI from 'pixi.js';
import {
  MessageType,
  Player,
  ServerMessage,
  JoinMessage,
  MoveMessage,
} from '@slime-sync/shared';

const WS_URL = 'ws://localhost:8080';
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_RADIUS = 25;

class GameClient {
  private app: PIXI.Application;
  private ws: WebSocket | null = null;
  private players: Map<string, { player: Player; graphics: PIXI.Graphics }> = new Map();
  private myPlayerId: string | null = null;
  private mousePosition = { x: 400, y: 300 };
  private lastSentPosition = { x: 400, y: 300 };
  private isConnected = false;

  constructor() {
    // Initialize Pixi Application
    this.app = new PIXI.Application({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0x1a1a2e,
      antialias: true,
    });

    const container = document.getElementById('game-container');
    if (container) {
      container.appendChild(this.app.view as HTMLCanvasElement);
    }

    this.setupEventListeners();
    this.startGameLoop();
  }

  private setupEventListeners(): void {
    // Mouse movement
    this.app.view.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = (this.app.view as HTMLCanvasElement).getBoundingClientRect();
      this.mousePosition.x = e.clientX - rect.left;
      this.mousePosition.y = e.clientY - rect.top;
    });

    // Touch movement for mobile
    this.app.view.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const rect = (this.app.view as HTMLCanvasElement).getBoundingClientRect();
      const touch = e.touches[0];
      this.mousePosition.x = touch.clientX - rect.left;
      this.mousePosition.y = touch.clientY - rect.top;
    });

    // Join button
    const joinButton = document.getElementById('join-button');
    const playerNameInput = document.getElementById('player-name') as HTMLInputElement;

    if (joinButton && playerNameInput) {
      joinButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim() || 'Anonymous';
        this.connect(name);
      });

      playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const name = playerNameInput.value.trim() || 'Anonymous';
          this.connect(name);
        }
      });
    }
  }

  private connect(playerName: string): void {
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('Connected to server');
      this.isConnected = true;
      this.updateConnectionStatus(true);

      // Send join message
      const joinMessage: JoinMessage = {
        type: MessageType.JOIN,
        name: playerName,
      };
      this.send(joinMessage);

      // Hide login screen
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) {
        loginScreen.classList.add('hidden');
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.isConnected = false;
      this.updateConnectionStatus(false);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case MessageType.WELCOME:
        this.myPlayerId = message.playerId;
        message.players.forEach((player) => {
          if (player.id !== this.myPlayerId) {
            this.addPlayer(player);
          } else {
            // Add self
            this.addPlayer(player);
            this.lastSentPosition = { ...player.position };
          }
        });
        this.updatePlayerCount();
        break;

      case MessageType.PLAYER_JOINED:
        this.addPlayer(message.player);
        this.updatePlayerCount();
        break;

      case MessageType.PLAYER_LEFT:
        this.removePlayer(message.playerId);
        this.updatePlayerCount();
        break;

      case MessageType.STATE_UPDATE:
        message.players.forEach((player) => {
          if (player.id !== this.myPlayerId) {
            this.updatePlayer(player);
          }
        });
        break;

      case MessageType.PONG:
        // Handle pong if needed for latency measurement
        break;
    }
  }

  private addPlayer(player: Player): void {
    if (this.players.has(player.id)) return;

    const graphics = new PIXI.Graphics();
    this.drawPlayer(graphics, player);
    this.app.stage.addChild(graphics);

    this.players.set(player.id, { player, graphics });
  }

  private updatePlayer(player: Player): void {
    const existing = this.players.get(player.id);
    if (existing) {
      existing.player = player;
      this.drawPlayer(existing.graphics, player);
    }
  }

  private removePlayer(playerId: string): void {
    const existing = this.players.get(playerId);
    if (existing) {
      this.app.stage.removeChild(existing.graphics);
      existing.graphics.destroy();
      this.players.delete(playerId);
    }
  }

  private drawPlayer(graphics: PIXI.Graphics, player: Player): void {
    graphics.clear();

    // Draw slime body
    graphics.beginFill(parseInt(player.color.replace('#', '0x')));
    graphics.drawCircle(player.position.x, player.position.y, PLAYER_RADIUS);
    graphics.endFill();

    // Draw highlight
    graphics.beginFill(0xffffff, 0.3);
    graphics.drawCircle(
      player.position.x - 8,
      player.position.y - 8,
      PLAYER_RADIUS * 0.4
    );
    graphics.endFill();

    // Draw eyes
    const eyeOffsetX = 10;
    const eyeOffsetY = -5;
    graphics.beginFill(0xffffff);
    graphics.drawCircle(player.position.x - eyeOffsetX, player.position.y + eyeOffsetY, 5);
    graphics.drawCircle(player.position.x + eyeOffsetX, player.position.y + eyeOffsetY, 5);
    graphics.endFill();

    graphics.beginFill(0x000000);
    graphics.drawCircle(player.position.x - eyeOffsetX, player.position.y + eyeOffsetY, 3);
    graphics.drawCircle(player.position.x + eyeOffsetX, player.position.y + eyeOffsetY, 3);
    graphics.endFill();

    // Draw name
    const text = new PIXI.Text(player.name, {
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    text.anchor.set(0.5);
    text.position.set(player.position.x, player.position.y - PLAYER_RADIUS - 15);
    
    // Remove old text if exists
    graphics.children.forEach((child) => {
      if (child instanceof PIXI.Text) {
        graphics.removeChild(child);
      }
    });
    graphics.addChild(text);
  }

  private startGameLoop(): void {
    this.app.ticker.add(() => {
      if (this.isConnected && this.myPlayerId) {
        // Smoothly move our player towards mouse position
        const myPlayer = this.players.get(this.myPlayerId);
        if (myPlayer) {
          const dx = this.mousePosition.x - myPlayer.player.position.x;
          const dy = this.mousePosition.y - myPlayer.player.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 2) {
            const speed = Math.min(distance * 0.1, 5);
            myPlayer.player.position.x += (dx / distance) * speed;
            myPlayer.player.position.y += (dy / distance) * speed;

            this.drawPlayer(myPlayer.graphics, myPlayer.player);

            // Send position update to server (throttled)
            const deltaX = Math.abs(myPlayer.player.position.x - this.lastSentPosition.x);
            const deltaY = Math.abs(myPlayer.player.position.y - this.lastSentPosition.y);
            if (deltaX > 5 || deltaY > 5) {
              this.sendPosition(myPlayer.player.position);
              this.lastSentPosition = { ...myPlayer.player.position };
            }
          }
        }
      }
    });
  }

  private sendPosition(position: { x: number; y: number }): void {
    const moveMessage: MoveMessage = {
      type: MessageType.MOVE,
      position,
    };
    this.send(moveMessage);
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private updateConnectionStatus(connected: boolean): void {
    const status = document.getElementById('connection-status');
    if (status) {
      status.textContent = connected ? 'Connected' : 'Disconnected';
      status.className = connected ? 'connected' : 'disconnected';
    }
  }

  private updatePlayerCount(): void {
    const count = document.getElementById('player-count');
    if (count) {
      count.textContent = `Players: ${this.players.size}`;
    }
  }
}

// Start the game when the page loads
new GameClient();
