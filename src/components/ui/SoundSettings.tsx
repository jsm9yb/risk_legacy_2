import { useSoundEffects } from '@/hooks/useSoundEffects';

interface SoundSettingsProps {
  className?: string;
}

/**
 * Sound settings component
 * Provides toggle and volume control for sound effects
 */
export function SoundSettings({ className = '' }: SoundSettingsProps) {
  const { soundEnabled, volume, toggle, setVolume, play } = useSoundEffects();

  const handleToggle = () => {
    const newState = toggle();
    if (newState) {
      // Play a small sound to confirm sound is on
      play('button_click');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    // Play a sample sound at new volume
    play('button_click');
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Sound toggle button */}
      <button
        onClick={handleToggle}
        className={`
          p-2 rounded-lg transition-colors
          ${soundEnabled
            ? 'bg-board-wood text-board-parchment hover:bg-board-wood/80'
            : 'bg-gray-600 text-gray-400 hover:bg-gray-500'}
        `}
        title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
      >
        {soundEnabled ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        )}
      </button>

      {/* Volume slider (only show when sound is enabled) */}
      {soundEnabled && (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-board-parchment/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3-3H6a1 1 0 01-1-1v-4a1 1 0 011-1h3l3-3v12l-3-3z"
            />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-2 bg-board-wood/30 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-board-parchment
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Compact sound toggle (just the button)
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const { soundEnabled, toggle, play } = useSoundEffects();

  const handleToggle = () => {
    const newState = toggle();
    if (newState) {
      play('button_click');
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        p-2 rounded-lg transition-colors
        ${soundEnabled
          ? 'text-board-parchment hover:bg-board-wood/30'
          : 'text-board-parchment/40 hover:bg-board-wood/20'}
        ${className}
      `}
      title={soundEnabled ? 'Sound on (click to mute)' : 'Sound off (click to unmute)'}
    >
      {soundEnabled ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
      )}
    </button>
  );
}

export default SoundSettings;
