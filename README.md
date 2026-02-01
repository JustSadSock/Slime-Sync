# Slime-Sync

A real-time multiplayer slime game with WebSocket synchronization. Move your slime around the canvas and see other players in real-time!

## Project Structure

This is a monorepo workspace containing three packages:

```
/client   - Vite + TypeScript + Pixi.js frontend
/server   - Node.js + WebSocket (ws) + TypeScript backend
/shared   - Shared types and utilities used by both client and server
```

## Prerequisites

- Node.js 18+ and npm

## Installation

Install all dependencies:

```bash
npm install
```

## Development

### Start the Server

In one terminal:

```bash
npm run dev:server
```

The WebSocket server will start on `ws://localhost:8080`

### Start the Client

In another terminal:

```bash
npm run dev:client
```

The client will open in your browser at `http://localhost:3000`

## Building

Build all packages:

```bash
npm run build
```

Or build individually:

```bash
npm run build:shared  # Build shared types first
npm run build:server  # Build server
npm run build:client  # Build client
```

## Production

After building, start the production server:

```bash
npm run start:server
```

Then serve the client from `client/dist/` using any static file server.

## Features

- Real-time multiplayer synchronization via WebSockets
- Canvas-based rendering with Pixi.js
- Smooth player movement
- Player joining/leaving notifications
- Color-coded player slimes
- TypeScript across the entire stack
- Shared type definitions between client and server

## Tech Stack

- **Frontend**: Vite, TypeScript, Pixi.js
- **Backend**: Node.js, TypeScript, ws (WebSocket library)
- **Shared**: TypeScript types and utilities
- **Build**: npm workspaces for monorepo management
