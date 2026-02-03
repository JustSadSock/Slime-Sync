// Utility functions

export function generateRandomColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Cyan
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampPlayerPosition(x: number, y: number, worldWidth: number, worldHeight: number, radius: number): { x: number; y: number } {
  return {
    x: clamp(x, radius, worldWidth - radius),
    y: clamp(y, radius, worldHeight - radius),
  };
}
