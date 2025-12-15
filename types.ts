export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum Lane {
  LEFT = -1,
  CENTER = 0,
  RIGHT = 1
}

export type ObstacleType = 'obstacle' | 'bonus' | 'laser';

export interface ObstacleData {
  id: string;
  lane: Lane;
  z: number;
  type: ObstacleType;
}

export interface GameStore {
  gameState: GameState;
  score: number;
  highScore: number;
  currentLane: Lane;
  speed: number;
  gameSpeedMultiplier: number;
  isJumping: boolean; // New state for jump
  lastRunCommentary: string | null;
  actions: {
    startGame: () => void;
    endGame: () => void;
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void; // Trigger jump
    land: () => void; // Reset jump state
    setScore: (score: number) => void;
    increaseSpeed: (delta: number) => void;
    setCommentary: (text: string) => void;
  };
}
