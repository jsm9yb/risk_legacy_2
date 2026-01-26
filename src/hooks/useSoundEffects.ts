import { useCallback, useEffect, useState } from 'react';
import {
  SoundEffect,
  playSound,
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  toggleSound,
  initializeAudio,
} from '@/utils/soundManager';

/**
 * Hook for using sound effects in components
 */
export function useSoundEffects() {
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);
  const [volume, setVolumeState] = useState(getSoundVolume);

  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Play a sound effect
  const play = useCallback((effect: SoundEffect) => {
    playSound(effect);
  }, []);

  // Toggle sound on/off
  const toggle = useCallback(() => {
    const newState = toggleSound();
    setSoundEnabledState(newState);
    return newState;
  }, []);

  // Set enabled state
  const setEnabled = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    setSoundEnabledState(enabled);
  }, []);

  // Set volume
  const setVolume = useCallback((vol: number) => {
    setSoundVolume(vol);
    setVolumeState(vol);
  }, []);

  return {
    play,
    toggle,
    setEnabled,
    setVolume,
    soundEnabled,
    volume,
  };
}

/**
 * Shorthand for playing a sound without the full hook
 */
export { playSound } from '@/utils/soundManager';
