// Message types for client-server communication

export enum MessageType {
  // Client -> Server
  JOIN = 'join',
  INPUT = 'input',
  PING = 'ping',
  
  // Server -> Client
  WELCOME = 'welcome',
  SNAPSHOT = 'snapshot',
  PONG = 'pong',
  PLAYER_LEFT = 'player_left',
}

// Base message interface
export interface BaseMessage {
  type: MessageType;
}

// Client -> Server messages
export interface JoinMessage extends BaseMessage {
  type: MessageType.JOIN;
  name?: string;
}

export interface InputMessage extends BaseMessage {
  type: MessageType.INPUT;
  seq: number;
  dt: number;
  dx: number;
  dy: number;
  dash: boolean;
  clientTime: number;
}

export interface PingMessage extends BaseMessage {
  type: MessageType.PING;
  t: number;
}

// Server -> Client messages
export interface WelcomeMessage extends BaseMessage {
  type: MessageType.WELCOME;
  playerId: string;
  serverTime: number;
}

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anim: string;
  name: string;
  color: string;
}

export interface SnapshotMessage extends BaseMessage {
  type: MessageType.SNAPSHOT;
  serverTime: number;
  players: PlayerSnapshot[];
  ackSeqByPlayerId?: Record<string, number>;
}

export interface PongMessage extends BaseMessage {
  type: MessageType.PONG;
  t: number;
  serverTime: number;
}

export interface PlayerLeftMessage extends BaseMessage {
  type: MessageType.PLAYER_LEFT;
  id: string;
}

export type ClientMessage = JoinMessage | InputMessage | PingMessage;
export type ServerMessage = WelcomeMessage | SnapshotMessage | PongMessage | PlayerLeftMessage;
export type Message = ClientMessage | ServerMessage;
