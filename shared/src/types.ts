// Message types for client-server communication

export enum MessageType {
  // Client -> Server
  JOIN = 'join',
  MOVE = 'move',
  PING = 'ping',
  
  // Server -> Client
  WELCOME = 'welcome',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  STATE_UPDATE = 'state_update',
  PONG = 'pong',
}

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  position: Position;
  color: string;
  name: string;
}

// Base message interface
export interface BaseMessage {
  type: MessageType;
}

// Client -> Server messages
export interface JoinMessage extends BaseMessage {
  type: MessageType.JOIN;
  name: string;
}

export interface MoveMessage extends BaseMessage {
  type: MessageType.MOVE;
  position: Position;
}

export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
  timestamp: number;
}

// Server -> Client messages
export interface WelcomeMessage extends BaseMessage {
  type: MessageType.WELCOME;
  playerId: string;
  players: Player[];
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: MessageType.PLAYER_JOINED;
  player: Player;
}

export interface PlayerLeftMessage extends BaseMessage {
  type: MessageType.PLAYER_LEFT;
  playerId: string;
}

export interface StateUpdateMessage extends BaseMessage {
  type: MessageType.STATE_UPDATE;
  players: Player[];
}

export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
  timestamp: number;
}

export type ClientMessage = JoinMessage | MoveMessage | PingMessage;
export type ServerMessage = WelcomeMessage | PlayerJoinedMessage | PlayerLeftMessage | StateUpdateMessage | PongMessage;
export type Message = ClientMessage | ServerMessage;
