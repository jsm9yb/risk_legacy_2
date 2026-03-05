import { useEffect, useState } from 'react';
import { Player } from '@/types/player';
import { factionsById } from '@/data/factions';
import { FactionEmblem } from '@/components/icons/FactionEmblems';

interface TurnIndicatorOverlayProps {
  player: Player;
  turn: number;
  isVisible: boolean;
  onDismiss?: () => void;
}

export function TurnIndicatorOverlay({
  player,
  turn,
  isVisible,
  onDismiss,
}: TurnIndicatorOverlayProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>('hidden');
  const faction = factionsById[player.factionId];

  useEffect(() => {
    if (isVisible) {
      // Start entering
      setPhase('entering');

      // After enter animation, stay visible
      const visibleTimer = setTimeout(() => {
        setPhase('visible');
      }, 500);

      // Start exit after 2.5 seconds
      const exitTimer = setTimeout(() => {
        setPhase('exiting');
      }, 2500);

      // Hide completely after exit animation
      const hideTimer = setTimeout(() => {
        setPhase('hidden');
        onDismiss?.();
      }, 3000);

      return () => {
        clearTimeout(visibleTimer);
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setPhase('hidden');
    }
  }, [isVisible, onDismiss]);

  if (phase === 'hidden') return null;

  return (
    <div
      className={`
        absolute top-4 left-4 z-40 pointer-events-none
        ${phase === 'entering' ? 'animate-[turnIndicatorSlideIn_0.5s_ease-out_forwards]' : ''}
        ${phase === 'exiting' ? 'animate-[turnIndicatorFadeOut_0.5s_ease-in_forwards]' : ''}
      `}
    >
      <div
        className="rounded-lg p-4 border-2 shadow-2xl backdrop-blur-sm"
        style={{
          backgroundColor: `${faction?.color}cc` || '#2C1810cc',
          borderColor: faction?.color || '#4A3728',
        }}
      >
        {/* Turn number */}
        <div className="text-xs uppercase tracking-wider text-white/70 font-body mb-1">
          Turn {turn}
        </div>

        {/* Player/Faction info */}
        <div className="flex items-center gap-3">
          <FactionEmblem factionId={player.factionId} size={48} />
          <div>
            <div className="font-display text-white text-lg font-bold">
              {faction?.name || 'Unknown Faction'}
            </div>
            <div className="font-display text-yellow-300 text-xl animate-pulse">
              YOUR TURN
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TurnIndicatorOverlay;
