/**
 * Sound effect types
 */
export type SoundEffect =
  | 'dice_roll'
  | 'dice_land'
  | 'combat_hit'
  | 'combat_miss'
  | 'conquest'
  | 'deploy'
  | 'maneuver'
  | 'victory'
  | 'defeat'
  | 'turn_start'
  | 'button_click'
  | 'error';

/**
 * Sound manager configuration
 */
interface SoundConfig {
  enabled: boolean;
  volume: number; // 0-1
  musicEnabled: boolean;
  musicVolume: number; // 0-1
}

/**
 * Audio context singleton
 */
let audioContext: AudioContext | null = null;

/**
 * Get or create audio context
 */
function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Sound manager state
 */
const state: SoundConfig = {
  enabled: true,
  volume: 0.5,
  musicEnabled: false,
  musicVolume: 0.3,
};

/**
 * Generate a simple oscillator-based sound effect
 * Uses Web Audio API to synthesize sounds without audio files
 */
function generateSynthSound(
  type: OscillatorType,
  frequency: number,
  duration: number,
  gainStart: number = 1,
  gainEnd: number = 0,
  frequencyEnd?: number
): void {
  if (!state.enabled) return;

  try {
    const ctx = getAudioContext();

    // Create oscillator
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    if (frequencyEnd !== undefined) {
      oscillator.frequency.linearRampToValueAtTime(frequencyEnd, ctx.currentTime + duration);
    }

    // Create gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gainStart * state.volume, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(gainEnd * state.volume, ctx.currentTime + duration);

    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Audio context may not be available
    console.warn('Sound playback failed');
  }
}

/**
 * Generate a noise-based sound effect
 */
function generateNoiseSound(duration: number, gainStart: number = 1): void {
  if (!state.enabled) return;

  try {
    const ctx = getAudioContext();

    // Create noise buffer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Create buffer source
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Create filter for shaping the noise
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3000;

    // Create gain envelope
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gainStart * state.volume * 0.3, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    // Connect and play
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(ctx.currentTime);
  } catch {
    console.warn('Sound playback failed');
  }
}

/**
 * Sound effect generators for each sound type
 */
const soundGenerators: Record<SoundEffect, () => void> = {
  dice_roll: () => {
    // Rattling dice sound - rapid clicks
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        generateSynthSound('square', 200 + Math.random() * 100, 0.05, 0.3, 0);
      }, i * 40);
    }
  },

  dice_land: () => {
    // Dice landing - thud with decay
    generateSynthSound('sine', 150, 0.1, 0.5, 0, 80);
    generateNoiseSound(0.08, 0.5);
  },

  combat_hit: () => {
    // Impact sound
    generateSynthSound('sawtooth', 200, 0.15, 0.6, 0, 50);
    generateNoiseSound(0.1, 0.4);
  },

  combat_miss: () => {
    // Whoosh/miss sound
    generateSynthSound('sine', 400, 0.2, 0.3, 0, 200);
  },

  conquest: () => {
    // Fanfare for capturing territory
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        generateSynthSound('triangle', freq, 0.2, 0.4, 0);
      }, i * 100);
    });
  },

  deploy: () => {
    // Troop placement sound - marching steps
    generateSynthSound('square', 100, 0.1, 0.3, 0);
    setTimeout(() => generateSynthSound('square', 120, 0.1, 0.3, 0), 100);
  },

  maneuver: () => {
    // Movement sound - sweeping
    generateSynthSound('sine', 300, 0.3, 0.3, 0, 500);
  },

  victory: () => {
    // Victory fanfare - ascending arpeggio
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        generateSynthSound('triangle', freq, 0.3, 0.5, 0.1);
      }, i * 150);
    });
  },

  defeat: () => {
    // Defeat sound - descending sad tones
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        generateSynthSound('sine', freq, 0.3, 0.4, 0);
      }, i * 200);
    });
  },

  turn_start: () => {
    // Turn notification - bell-like
    generateSynthSound('sine', 880, 0.1, 0.4, 0);
    setTimeout(() => generateSynthSound('sine', 1100, 0.15, 0.3, 0), 100);
  },

  button_click: () => {
    // UI click - short blip
    generateSynthSound('square', 600, 0.05, 0.2, 0);
  },

  error: () => {
    // Error buzz
    generateSynthSound('sawtooth', 150, 0.2, 0.4, 0, 100);
  },
};

/**
 * Play a sound effect
 */
export function playSound(effect: SoundEffect): void {
  if (!state.enabled) return;

  const generator = soundGenerators[effect];
  if (generator) {
    generator();
  }
}

/**
 * Set sound enabled state
 */
export function setSoundEnabled(enabled: boolean): void {
  state.enabled = enabled;
}

/**
 * Get sound enabled state
 */
export function isSoundEnabled(): boolean {
  return state.enabled;
}

/**
 * Set sound volume (0-1)
 */
export function setSoundVolume(volume: number): void {
  state.volume = Math.max(0, Math.min(1, volume));
}

/**
 * Get sound volume
 */
export function getSoundVolume(): number {
  return state.volume;
}

/**
 * Toggle sound enabled state
 */
export function toggleSound(): boolean {
  state.enabled = !state.enabled;
  return state.enabled;
}

/**
 * Initialize audio context on user interaction
 * Required by browsers to start audio
 */
export function initializeAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch {
    console.warn('Audio initialization failed');
  }
}

/**
 * Sound settings for storage/retrieval
 */
export function getSoundSettings(): SoundConfig {
  return { ...state };
}

export function setSoundSettings(config: Partial<SoundConfig>): void {
  Object.assign(state, config);
}
