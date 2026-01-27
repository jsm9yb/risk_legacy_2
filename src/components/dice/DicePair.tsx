/**
 * DicePair - Animates two dice sliding together for comparison
 * Shows "VS" indicator between paired dice with winner/loser effects
 */

import { DiceRoller } from './DiceRoller';

interface DicePairProps {
  attackerValue: number;
  defenderValue: number;
  attackerWins: boolean;
  pairIndex: number;
  isPairing: boolean;
  showResult: boolean;
}

export function DicePair({
  attackerValue,
  defenderValue,
  attackerWins,
  pairIndex,
  isPairing,
  showResult,
}: DicePairProps) {
  const animationDelay = `${pairIndex * 350}ms`;

  // Clamp values to valid die range
  const safeAttackerValue = Math.max(1, Math.min(6, attackerValue)) as 1 | 2 | 3 | 4 | 5 | 6;
  const safeDefenderValue = Math.max(1, Math.min(6, defenderValue)) as 1 | 2 | 3 | 4 | 5 | 6;

  return (
    <div
      className="flex items-center justify-center gap-2"
      style={{ animationDelay }}
    >
      {/* Attacker die */}
      <div
        className={`
          transition-all duration-300
          ${isPairing ? 'animate-dice-pair-slide-right' : ''}
          ${showResult && attackerWins ? 'animate-dice-win-glow' : ''}
          ${showResult && !attackerWins ? 'animate-dice-lose-fade' : ''}
        `}
        style={{ animationDelay }}
      >
        <DiceRoller
          value={safeAttackerValue}
          color="red"
          isRolling={false}
          dieIndex={pairIndex}
          size={48}
        />
      </div>

      {/* VS indicator */}
      <div
        className={`
          font-display text-sm text-board-parchment/60 px-1
          transition-opacity duration-300
          ${isPairing ? 'opacity-100 animate-fade-in' : 'opacity-0'}
        `}
        style={{ animationDelay }}
      >
        VS
      </div>

      {/* Defender die */}
      <div
        className={`
          transition-all duration-300
          ${isPairing ? 'animate-dice-pair-slide-left' : ''}
          ${showResult && !attackerWins ? 'animate-dice-win-glow' : ''}
          ${showResult && attackerWins ? 'animate-dice-lose-fade' : ''}
        `}
        style={{ animationDelay }}
      >
        <DiceRoller
          value={safeDefenderValue}
          color="blue"
          isRolling={false}
          dieIndex={pairIndex}
          size={48}
        />
      </div>

      {/* Result indicator */}
      {showResult && (
        <div
          className={`
            ml-2 text-sm font-body animate-fade-in-up
            ${attackerWins ? 'text-red-400' : 'text-blue-400'}
          `}
          style={{ animationDelay }}
        >
          {attackerWins ? '← Wins' : 'Wins →'}
        </div>
      )}
    </div>
  );
}

export default DicePair;
