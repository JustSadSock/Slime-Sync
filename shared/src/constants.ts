// Game constants shared between client and server

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 450;

export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 150; // units per second
export const DASH_SPEED_MULTIPLIER = 2.5;
export const DASH_DURATION = 200; // ms
export const DASH_COOLDOWN = 2000; // ms

export const INTERPOLATION_DELAY = 100; // ms - render delay to buffer network jitter; trade-off: higher = smoother but more lag
export const RECONCILIATION_THRESHOLD = 5; // units - max position difference before correction; trade-off: higher = smoother but less accurate
export const SNAPSHOT_RETENTION_MS = 1000; // ms - how long to keep old snapshots for interpolation
