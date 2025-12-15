import { create } from 'zustand';
import { GameState, Lane, GameStore } from './types';
import { playSynthSound } from './utils/audio';

const INITIAL_SPEED = 30; // Increased from 20 to 30
const INITIAL_LANE = Lane.CENTER;

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: GameState.MENU,
  score: 0,
  highScore: 0,
  currentLane: INITIAL_LANE,
  speed: INITIAL_SPEED,
  gameSpeedMultiplier: 1,
  isJumping: false,
  lastRunCommentary: null,
  actions: {
    startGame: () => set({ 
      gameState: GameState.PLAYING, 
      score: 0, 
      currentLane: INITIAL_LANE,
      speed: INITIAL_SPEED,
      gameSpeedMultiplier: 1,
      isJumping: false,
      lastRunCommentary: null
    }),
    endGame: () => {
      const { score, highScore } = get();
      playSynthSound('gameover');
      set({ 
        gameState: GameState.GAME_OVER,
        highScore: Math.max(score, highScore)
      });
    },
    moveLeft: () => set((state) => ({ 
      currentLane: Math.max(Lane.LEFT, state.currentLane - 1) 
    })),
    moveRight: () => set((state) => ({ 
      currentLane: Math.min(Lane.RIGHT, state.currentLane + 1) 
    })),
    jump: () => set((state) => {
        if (state.isJumping) return {};
        return { isJumping: true };
    }),
    land: () => set({ isJumping: false }),
    setScore: (score) => set({ score }),
    increaseSpeed: (delta) => set((state) => ({ 
      gameSpeedMultiplier: state.gameSpeedMultiplier + delta 
    })),
    setCommentary: (text) => set({ lastRunCommentary: text }),
  }
}));