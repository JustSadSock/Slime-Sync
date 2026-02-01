import { WebSocketServer, WebSocket } from 'ws';
import {
  MessageType,
  Player,
  ClientMessage,
  JoinMessage,
  MoveMessage,
  generateRandomColor,
} from '@slime-sync/shared';

const PORT = process.env.PORT || 8080;

interface ClientConnection {
  ws: WebSocket;
  player: Player | null;
}

class GameServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private players: Map<string, Player> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
    console.log(`WebSocket server started on port ${port}`);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = { ws, player: null };
      this.clients.set(clientId, client);

      console.log(`Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  private handleMessage(clientId: string, message: ClientMessage): void {
    switch (message.type) {
      case MessageType.JOIN:
        this.handleJoin(clientId, message);
        break;
      case MessageType.MOVE:
        this.handleMove(clientId, message);
        break;
      case MessageType.PING:
        this.handlePing(clientId, message.timestamp);
        break;
      default:
        console.warn(`Unknown message type:`, message);
    }
  }

  private handleJoin(clientId: string, message: JoinMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const player: Player = {
      id: clientId,
      name: message.name || 'Anonymous',
      position: { x: 400, y: 300 },
      color: generateRandomColor(),
    };

    client.player = player;
    this.players.set(clientId, player);

    // Send welcome message to the new player
    this.sendToClient(clientId, {
      type: MessageType.WELCOME,
      playerId: clientId,
      players: Array.from(this.players.values()),
    });

    // Notify all other players about the new player
    this.broadcast(
      {
        type: MessageType.PLAYER_JOINED,
        player,
      },
      clientId
    );

    console.log(`Player joined: ${player.name} (${clientId})`);
  }

  private handleMove(clientId: string, message: MoveMessage): void {
    const player = this.players.get(clientId);
    if (!player) return;

    player.position = message.position;

    // Broadcast state update to all clients
    this.broadcast({
      type: MessageType.STATE_UPDATE,
      players: Array.from(this.players.values()),
    });
  }

  private handlePing(clientId: string, timestamp: number): void {
    this.sendToClient(clientId, {
      type: MessageType.PONG,
      timestamp,
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client?.player) {
      this.players.delete(clientId);
      
      // Notify all clients about player leaving
      this.broadcast({
        type: MessageType.PLAYER_LEFT,
        playerId: clientId,
      });

      console.log(`Player left: ${client.player.name} (${clientId})`);
    }

    this.clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: any, excludeClientId?: string): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Start the server
new GameServer(Number(PORT));
