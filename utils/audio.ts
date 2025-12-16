/**
 * Audio Subsystem
 * Handles Web Audio API context, synthesized SFX, and HTML5 Audio BGM.
 */

let audioCtx: AudioContext | null = null;
let bgmAudio: HTMLAudioElement | null = null;
let isMutedGlobal = false;

// Asset: Royalty-free Cyberpunk/Phonk track (Pixabay)
const BGM_URL = "https://cdn.pixabay.com/audio/2024/01/16/audio_e2b992254f.mp3"; 

const initAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// --- MUSIC CONTROLS ---

export const initMusic = () => {
    if (!bgmAudio) {
        bgmAudio = new Audio(BGM_URL);
        bgmAudio.loop = true;
        bgmAudio.volume = 0.4; // Mix level: Background
    }
    
    // Play only if system is active and not muted
    if (!isMutedGlobal && bgmAudio.paused) {
        bgmAudio.play().catch(e => console.warn("Audio Policy: Interaction required before playback.", e));
    }
};

export const setMusicMuted = (muted: boolean) => {
    isMutedGlobal = muted;
    if (bgmAudio) {
        if (muted) {
            bgmAudio.pause();
        } else {
            bgmAudio.play().catch(console.error);
        }
    }
};

// --- SFX SYNTHESIZER ---

export const playClickSound = () => {
  if (isMutedGlobal) return;
  const ctx = initAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  // UI Chirp: High frequency Sine blip
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.05);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.start(now);
  osc.stop(now + 0.05);
};

export const playSynthSound = (type: 'move' | 'jump' | 'gameover') => {
  if (isMutedGlobal) return;
  const ctx = initAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'move':
        // Digital Sway: Square wave slide
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

    case 'jump':
        // Power Lift: Sawtooth riser
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
  
    case 'gameover':
        // System Crash: Low frequency distorion
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
  }
};