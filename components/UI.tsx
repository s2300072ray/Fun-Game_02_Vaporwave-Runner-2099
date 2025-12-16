import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store';
import { GameState } from '../types';
import { generateGameCommentary } from '../services/geminiService';
import { playSynthSound, playClickSound, initMusic } from '../utils/audio';

export const UI: React.FC = () => {
  const { gameState, score, highScore, isMuted, actions, lastRunCommentary } = useGameStore();
  const [loadingCommentary, setLoadingCommentary] = useState(false);

  // Global Click Sound Listener
  useEffect(() => {
    const handleClick = () => {
        playClickSound();
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === GameState.PLAYING) {
        if (e.key === 'ArrowLeft' || e.key === 'a') {
            actions.moveLeft();
            playSynthSound('move');
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
            actions.moveRight();
            playSynthSound('move');
        }
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
            actions.jump();
            // Sound is handled in Player component via effect on isJumping state to sync with physics
        }
      } else if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
          if (e.key === 'Enter' || e.key === ' ') {
            actions.startGame();
            // Initialize Audio on user gesture
            playSynthSound('move'); 
            initMusic();
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, actions]);

  // Trigger Gemini Analysis on Game Over
  useEffect(() => {
    if (gameState === GameState.GAME_OVER && !lastRunCommentary && !loadingCommentary) {
        setLoadingCommentary(true);
        const duration = score / 200; 
        generateGameCommentary(score, duration).then(comment => {
            actions.setCommentary(comment);
            setLoadingCommentary(false);
        });
    }
  }, [gameState, score, lastRunCommentary, loadingCommentary, actions]);


  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-8 font-cyber text-white z-10">
      
      {/* HUD - Always visible during play */}
      <div className="w-full flex justify-between items-start select-none">
        <div className="flex flex-col">
          <span className="text-neon-blue text-lg font-tech opacity-80">SCORE</span>
          <span className="text-4xl font-bold tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.8)]">
            {Math.floor(score).toString().padStart(6, '0')}
          </span>
        </div>

        {/* Mute Button & Info */}
        <div className="flex flex-col items-end gap-2">
            <button 
                onClick={(e) => {
                    // Prevent propagation so we don't trigger game actions if we add click controls later
                    e.stopPropagation(); 
                    actions.toggleMute();
                    // If unmuting, ensure music starts
                    if (isMuted) initMusic(); 
                }}
                className="pointer-events-auto p-2 border border-neon-blue/50 hover:bg-neon-blue/20 transition-colors rounded-sm"
            >
                {isMuted ? (
                    <span className="text-red-500 font-bold text-xs tracking-widest">AUDIO OFF</span>
                ) : (
                    <span className="text-neon-blue font-bold text-xs tracking-widest animate-pulse">AUDIO ON</span>
                )}
            </button>

            {gameState === GameState.PLAYING && (
                <div className="flex flex-col items-end">
                    <span className="text-neon-pink text-xs font-tech animate-pulse">SYSTEM LINKED</span>
                    <span className="text-neon-blue text-sm">A/D to Move | SPACE to Jump</span>
                </div>
            )}
        </div>
      </div>

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center pointer-events-auto backdrop-blur-sm">
          <h1 className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-neon-blue drop-shadow-[0_0_25px_rgba(0,243,255,0.6)] mb-2">
            NEON RUNNER
          </h1>
          <h2 className="text-2xl text-neon-pink tracking-widest mb-8 font-tech">2099 CYCLE</h2>
          
          {/* Game Instructions Panel */}
          <div className="mb-8 w-full max-w-lg bg-black/80 border border-neon-blue/50 p-6 relative overflow-hidden backdrop-blur-md">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-2 h-2 bg-neon-blue"></div>
            <div className="absolute top-0 right-0 w-2 h-2 bg-neon-blue"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 bg-neon-blue"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-neon-blue"></div>

            <h3 className="text-center text-neon-pink font-bold tracking-widest mb-4 border-b border-gray-800 pb-2">
              // SYSTEM_INSTRUCTIONS
            </h3>
            
            <div className="grid grid-cols-1 gap-4 font-tech text-sm text-gray-300">
               {/* Controls */}
               <div className="flex items-center justify-between">
                  <span className="text-neon-blue font-bold">CONTROLS</span>
                  <div className="flex flex-col items-end gap-1">
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">MOVE</span>
                        <kbd className="border border-gray-600 px-2 rounded bg-gray-900 text-white font-sans">A</kbd> / <kbd className="border border-gray-600 px-2 rounded bg-gray-900 text-white font-sans">D</kbd>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">JUMP</span>
                        <kbd className="border border-gray-600 px-2 min-w-[60px] text-center rounded bg-gray-900 text-white font-sans">SPACE</kbd>
                     </div>
                  </div>
               </div>

               {/* Objective */}
               <div className="flex flex-col gap-1">
                  <span className="text-neon-blue font-bold">OBJECTIVE</span>
                  <p className="text-xs leading-relaxed text-gray-400">
                    Navigate the infinite grid. Switch lanes or jump to dodge red obstacles. Collect blue orbs.
                  </p>
               </div>

               {/* Win/Loss */}
               <div className="flex flex-col gap-1">
                  <span className="text-neon-blue font-bold">TACTICS</span>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <span><span className="text-white">JUMP:</span> Clear obstacles by jumping over them.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <span><span className="text-white">SPEED:</span> Velocity increases rapidly over distance.</span>
                    </li>
                  </ul>
               </div>
            </div>
          </div>

          <button 
            onClick={() => {
                actions.startGame();
                initMusic();
            }}
            className="group relative px-12 py-4 bg-transparent border-2 border-neon-blue hover:bg-neon-blue/20 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-neon-blue/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            <span className="text-xl font-bold tracking-widest text-white group-hover:text-neon-blue transition-colors">INITIATE RUN</span>
          </button>
          
          <p className="mt-8 text-gray-400 font-tech text-sm">PRESS SPACE TO START</p>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center pointer-events-auto backdrop-blur-md">
          <h2 className="text-6xl font-black text-neon-pink drop-shadow-[0_0_15px_rgba(188,19,254,0.8)] mb-6 glitch-text">
            FLATLINED
          </h2>
          
          <div className="bg-black/80 border border-neon-blue p-8 max-w-lg w-full text-center relative overflow-hidden">
             {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-blue"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-blue"></div>
            
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-tech">FINAL SCORE</span>
                    <span className="text-3xl text-white font-bold">{Math.floor(score)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-400 text-xs font-tech">HIGH SCORE</span>
                    <span className="text-3xl text-neon-blue font-bold">{Math.floor(highScore)}</span>
                </div>
            </div>

            {/* Gemini AI Commentary Section */}
            <div className="mb-8 min-h-[80px] flex items-center justify-center">
                {loadingCommentary ? (
                    <span className="text-neon-blue animate-pulse font-tech text-sm">
                        &gt; UPLOADING NEURAL DATA...
                    </span>
                ) : (
                    <p className="text-neon-purple font-tech text-lg italic border-l-2 border-neon-pink pl-4 text-left">
                        "{lastRunCommentary || "System Offline."}"
                    </p>
                )}
            </div>

            <button 
                onClick={() => {
                    actions.startGame();
                    initMusic();
                }}
                className="w-full py-3 bg-neon-blue hover:bg-white hover:text-black text-black font-bold tracking-wider transition-colors"
            >
                REBOOT SYSTEM
            </button>
          </div>
        </div>
      )}
    </div>
  );
};