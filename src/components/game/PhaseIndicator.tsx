import { GamePhase, SubPhase } from '@/types/game';

interface PhaseIndicatorProps {
  currentTurn: number;
  phase: GamePhase;
  subPhase: SubPhase;
  isYourTurn: boolean;
  activePlayerName?: string;
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

// Phase colors for better visual distinction
const PHASE_COLORS: Record<GamePhase, { bg: string; text: string; ring: string }> = {
  SETUP: { bg: 'bg-purple-600', text: 'text-purple-400', ring: 'ring-purple-500' },
  RECRUIT: { bg: 'bg-green-600', text: 'text-green-400', ring: 'ring-green-500' },
  ATTACK: { bg: 'bg-red-600', text: 'text-red-400', ring: 'ring-red-500' },
  MANEUVER: { bg: 'bg-blue-600', text: 'text-blue-400', ring: 'ring-blue-500' },
  END: { bg: 'bg-gray-600', text: 'text-gray-400', ring: 'ring-gray-500' },
};

// Display names for sub-phases
const SUB_PHASE_DISPLAY_NAMES: Record<Exclude<SubPhase, null>, string> = {
  SCAR_PLACEMENT: 'Placing Scars',
  ROLL_FOR_ORDER: 'Rolling for Order',
  FACTION_SELECTION: 'Selecting Faction',
  HQ_PLACEMENT: 'Placing HQ',
  PLACE_TROOPS: 'Deploy Reinforcements',
  IDLE: 'Choose Territory to Attack',
  SELECT_ATTACK: 'Select Attack Target',
  ATTACKER_DICE: 'Choose Attack Dice',
  DEFENDER_DICE: 'Defender Choosing Dice',
  MISSILE_WINDOW: 'Missile Decision',
  RESOLVE: 'Resolving Combat',
  TROOP_MOVE: 'Moving Troops',
  SELECT_MANEUVER_SOURCE: 'Select Source Territory',
  SELECT_MANEUVER_TARGET: 'Select Destination',
  SET_MANEUVER_TROOPS: 'Choose Troops to Move',
};

// Contextual help text for each sub-phase
const SUB_PHASE_HELP: Record<Exclude<SubPhase, null>, string> = {
  SCAR_PLACEMENT: 'Place a scar on the board',
  ROLL_FOR_ORDER: 'Roll dice to determine turn order',
  FACTION_SELECTION: 'Choose your faction and starting power',
  HQ_PLACEMENT: 'Click a territory to place your HQ',
  PLACE_TROOPS: 'Click your territories, use +/- on map to deploy',
  IDLE: 'Click one of your territories with 2+ troops',
  SELECT_ATTACK: 'Click an adjacent enemy territory (green)',
  ATTACKER_DICE: 'Choose how many dice to roll (1-3)',
  DEFENDER_DICE: 'Waiting for defender to choose dice...',
  MISSILE_WINDOW: 'Decide whether to use missiles',
  RESOLVE: 'Combat resolving...',
  TROOP_MOVE: 'Choose how many troops to move in',
  SELECT_MANEUVER_SOURCE: 'Click a territory with 2+ troops to move from',
  SELECT_MANEUVER_TARGET: 'Click a connected friendly territory',
  SET_MANEUVER_TROOPS: 'Use slider to set troops, then execute',
};

export function PhaseIndicator({
  currentTurn,
  phase,
  subPhase,
  isYourTurn,
  activePlayerName,
  troopsRemaining,
}: PhaseIndicatorProps) {
  // Get the current phase index for progress display
  const currentPhaseIndex = MAIN_PHASES.indexOf(phase);
  const phaseColors = PHASE_COLORS[phase] || PHASE_COLORS.SETUP;

  // Build the sub-phase display text
  let subPhaseText = '';
  let helpText = '';
  if (subPhase) {
    subPhaseText = SUB_PHASE_DISPLAY_NAMES[subPhase];
    helpText = SUB_PHASE_HELP[subPhase];
    if (subPhase === 'PLACE_TROOPS' && troopsRemaining !== undefined) {
      subPhaseText += ` (${troopsRemaining} remaining)`;
    }
  }

  return (
    <div className="bg-board-border rounded-lg p-4 border-2 border-board-wood">
      {/* Turn and player indicator */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-lg text-board-parchment">
          TURN <span className="font-numbers text-yellow-400">{currentTurn}</span>
        </span>
        <span
          className={`font-body text-sm px-2 py-0.5 rounded ${
            isYourTurn
              ? 'bg-yellow-500/20 text-yellow-400 font-semibold'
              : 'text-board-parchment/60'
          }`}
        >
          {isYourTurn ? 'YOUR TURN' : `Waiting for ${activePlayerName || 'player'}...`}
        </span>
      </div>

      {/* Phase progress bar with labels */}
      <div className="flex items-center gap-1 mb-2">
        {MAIN_PHASES.map((p, index) => {
          const isCurrentPhase = phase === p;
          const isPastPhase = currentPhaseIndex > index;
          const isFuturePhase = currentPhaseIndex < index;
          const pColors = PHASE_COLORS[p];

          return (
            <div key={p} className="flex items-center gap-1 flex-1">
              {/* Phase indicator circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                    transition-all duration-200
                    ${isCurrentPhase ? `${pColors.bg} text-white ring-2 ${pColors.ring} ring-offset-1 ring-offset-board-border` : ''}
                    ${isPastPhase ? 'bg-green-600 text-white' : ''}
                    ${isFuturePhase ? 'bg-board-wood/50 text-board-parchment/40' : ''}
                  `}
                >
                  {isPastPhase ? '\u2713' : isCurrentPhase ? (index + 1) : (index + 1)}
                </div>
                <span
                  className={`
                    text-[10px] font-body mt-1 font-semibold uppercase tracking-wide
                    ${isCurrentPhase ? pColors.text : 'text-board-parchment/50'}
                  `}
                >
                  {PHASE_DISPLAY_NAMES[p]}
                </span>
              </div>

              {/* Connector line (except after last phase) */}
              {index < MAIN_PHASES.length - 1 && (
                <div
                  className={`
                    h-0.5 flex-1 -mt-4 rounded
                    ${isPastPhase ? 'bg-green-600' : 'bg-board-wood/30'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current sub-phase display with contextual help */}
      {subPhaseText && (
        <div className={`mt-3 pt-3 border-t border-board-wood/50 rounded-b ${phaseColors.bg}/10`}>
          <div className="flex items-start gap-2">
            <div className={`w-1 h-full ${phaseColors.bg} rounded-full self-stretch min-h-[2rem]`}></div>
            <div className="flex-1">
              <div className={`text-sm font-body font-semibold ${phaseColors.text}`}>
                {subPhaseText}
              </div>
              {helpText && (
                <div className="text-xs font-body text-board-parchment/60 mt-0.5">
                  {helpText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhaseIndicator;
