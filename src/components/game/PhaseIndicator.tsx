import { GamePhase, SubPhase } from '@/types/game';

interface PhaseIndicatorProps {
  currentTurn: number;
  phase: GamePhase;
  subPhase: SubPhase;
  isYourTurn: boolean;
  troopsRemaining?: number;
}

// Define the main phases in order for the progress bar
const MAIN_PHASES: GamePhase[] = ['SETUP', 'RECRUIT', 'ATTACK', 'MANEUVER'];

// Display names for phases
const PHASE_DISPLAY_NAMES: Record<GamePhase, string> = {
  SETUP: 'Setup',
  RECRUIT: 'Reinforce',
  ATTACK: 'Attack',
  MANEUVER: 'Move',
  END: 'End',
};

// Display names for sub-phases
const SUB_PHASE_DISPLAY_NAMES: Record<Exclude<SubPhase, null>, string> = {
  SCAR_PLACEMENT: 'SCAR PLACEMENT',
  ROLL_FOR_ORDER: 'ROLL FOR ORDER',
  FACTION_SELECTION: 'FACTION SELECTION',
  HQ_PLACEMENT: 'HQ PLACEMENT',
  PLACE_TROOPS: 'PLACE TROOPS',
  IDLE: 'SELECT ACTION',
  SELECT_ATTACK: 'SELECT TARGET',
  ATTACKER_DICE: 'CHOOSE DICE',
  DEFENDER_DICE: 'DEFENDER CHOOSING',
  MISSILE_WINDOW: 'MISSILE WINDOW',
  RESOLVE: 'RESOLVING COMBAT',
  TROOP_MOVE: 'MOVE TROOPS',
};

export function PhaseIndicator({
  currentTurn,
  phase,
  subPhase,
  isYourTurn,
  troopsRemaining,
}: PhaseIndicatorProps) {
  // Get the current phase index for progress display
  const currentPhaseIndex = MAIN_PHASES.indexOf(phase);

  // Build the sub-phase display text
  let subPhaseText = '';
  if (subPhase) {
    subPhaseText = SUB_PHASE_DISPLAY_NAMES[subPhase];
    if (subPhase === 'PLACE_TROOPS' && troopsRemaining !== undefined) {
      subPhaseText += ` (${troopsRemaining} remaining)`;
    }
  }

  return (
    <div className="bg-board-border rounded-lg p-4 border-2 border-board-wood">
      {/* Turn and player indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg text-board-parchment">
          TURN {currentTurn}
        </span>
        <span
          className={`font-body text-sm ${
            isYourTurn ? 'text-yellow-400 font-semibold' : 'text-board-parchment/60'
          }`}
        >
          {isYourTurn ? '- YOUR TURN' : '- Waiting...'}
        </span>
      </div>

      {/* Phase progress bar with labels */}
      <div className="flex items-center gap-2 mb-2">
        {MAIN_PHASES.map((p, index) => {
          const isCurrentPhase = phase === p;
          const isPastPhase = currentPhaseIndex > index;
          const isFuturePhase = currentPhaseIndex < index;

          return (
            <div key={p} className="flex items-center gap-2 flex-1">
              {/* Phase indicator circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center text-xs
                    ${isCurrentPhase ? 'bg-yellow-500 text-board-wood' : ''}
                    ${isPastPhase ? 'bg-green-600 text-white' : ''}
                    ${isFuturePhase ? 'bg-board-wood text-board-parchment/40' : ''}
                  `}
                >
                  {isPastPhase ? '\u2713' : isCurrentPhase ? '\u25CF' : '\u25CB'}
                </div>
                <span
                  className={`
                    text-xs font-body mt-1
                    ${isCurrentPhase ? 'text-yellow-400' : 'text-board-parchment/60'}
                  `}
                >
                  {PHASE_DISPLAY_NAMES[p]}
                </span>
              </div>

              {/* Connector line (except after last phase) */}
              {index < MAIN_PHASES.length - 1 && (
                <div
                  className={`
                    h-0.5 flex-1 -mt-4
                    ${isPastPhase ? 'bg-green-600' : 'bg-board-wood'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current sub-phase display */}
      {subPhaseText && (
        <div className="mt-3 pt-3 border-t border-board-wood/50">
          <span className="text-xs font-body text-board-parchment/60">Phase: </span>
          <span className="text-sm font-body text-board-parchment font-semibold">
            {subPhaseText}
          </span>
        </div>
      )}
    </div>
  );
}

export default PhaseIndicator;
