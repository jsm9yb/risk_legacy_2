import { TerritoryId, TerritoryState } from '@/types/territory';
import { GamePhase, SubPhase } from '@/types/game';
import { territories, territoriesById } from '@/data/territories';

export interface ValidationError {
  code: string;
  message: string;
}

interface AttackControlsProps {
  subPhase: SubPhase;
  attackingTerritory: TerritoryId | null;
  defendingTerritory: TerritoryId | null;
  territoryStates: Record<TerritoryId, TerritoryState>;
  availableDice: number[];
  onSelectDice: (diceCount: number) => void;
  onCancelAttack: () => void;
  onEndAttackPhase: () => void;
  validationError?: ValidationError | null;
}

function AttackControls({
  subPhase,
  attackingTerritory,
  defendingTerritory,
  territoryStates,
  availableDice,
  onSelectDice,
  onCancelAttack,
  onEndAttackPhase,
  validationError,
}: AttackControlsProps) {
  const attackingTerritoryData = attackingTerritory
    ? territoriesById[attackingTerritory]
    : null;

  const defendingTerritoryData = defendingTerritory
    ? territoriesById[defendingTerritory]
    : null;

  const attackingTroops = attackingTerritory
    ? territoryStates[attackingTerritory]?.troopCount || 0
    : 0;

  const defendingTroops = defendingTerritory
    ? territoryStates[defendingTerritory]?.troopCount || 0
    : 0;

  // IDLE state: waiting to select attack source
  if (subPhase === 'IDLE') {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-display text-board-parchment">
            Select a territory to attack from
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            Choose a territory with at least 2 troops
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>
        <button
          onClick={onEndAttackPhase}
          className="px-6 py-2 rounded-lg font-display text-lg font-semibold
            bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg
            transition-all duration-150"
        >
          End Attack Phase &rarr;
        </button>
      </div>
    );
  }

  // SELECT_ATTACK state: selecting attack target
  if (subPhase === 'SELECT_ATTACK' && attackingTerritory) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-display text-board-parchment">
            <span className="text-lg">Attacking from: </span>
            <span className="text-yellow-400 font-semibold">
              {attackingTerritoryData?.name}
            </span>
            <span className="font-numbers text-board-parchment/70 ml-2">
              ({attackingTroops} troops)
            </span>
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            Select an adjacent enemy territory to attack
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancelAttack}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onEndAttackPhase}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg
              transition-all duration-150"
          >
            End Attack Phase &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ATTACKER_DICE state: attack target selected, choose dice count
  if (subPhase === 'ATTACKER_DICE' && attackingTerritory && defendingTerritory) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-display text-board-parchment text-lg">
            <span className="text-yellow-400 font-semibold">
              {attackingTerritoryData?.name}
            </span>
            <span className="font-numbers text-board-parchment/70 ml-1">
              ({attackingTroops})
            </span>
            <span className="mx-3 text-red-400">⚔️</span>
            <span className="text-red-400 font-semibold">
              {defendingTerritoryData?.name}
            </span>
            <span className="font-numbers text-board-parchment/70 ml-1">
              ({defendingTroops})
            </span>
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            Select number of attack dice (max: {availableDice.length > 0 ? Math.max(...availableDice) : 0})
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>

        {/* Dice selector buttons */}
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((diceCount) => {
              const isAvailable = availableDice.includes(diceCount);
              return (
                <button
                  key={diceCount}
                  onClick={() => isAvailable && onSelectDice(diceCount)}
                  disabled={!isAvailable}
                  className={`
                    w-14 h-14 rounded-lg font-display text-xl font-bold
                    flex flex-col items-center justify-center gap-0.5
                    transition-all duration-150 border-2
                    ${
                      isAvailable
                        ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer border-red-400 shadow-lg hover:scale-105'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'
                    }
                  `}
                  title={isAvailable ? `Attack with ${diceCount} dice` : 'Not enough troops'}
                >
                  <span className="font-numbers text-2xl">{diceCount}</span>
                  <span className="text-[10px] font-body opacity-80">
                    {diceCount === 1 ? 'die' : 'dice'}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onCancelAttack}
            className="px-4 py-2 rounded-lg font-display text-sm font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Fallback for other attack sub-phases
  return (
    <div className="flex items-center justify-between w-full">
      <div className="font-display text-board-parchment">
        Attack in progress...
      </div>
    </div>
  );
}

interface ReinforcementControlsProps {
  troopsRemaining: number;
  selectedTerritory: TerritoryId | null;
  territoryStates: Record<TerritoryId, TerritoryState>;
  pendingDeployments: Record<TerritoryId, number>;
  onAddTroop: (territoryId: TerritoryId) => void;
  onRemoveTroop: (territoryId: TerritoryId) => void;
  onConfirmDeployment: () => void;
  validationError?: ValidationError | null;
}

function ReinforcementControls({
  troopsRemaining,
  selectedTerritory,
  territoryStates,
  pendingDeployments,
  onConfirmDeployment,
  validationError,
}: ReinforcementControlsProps) {
  const selectedTerritoryData = selectedTerritory
    ? territories.find((t) => t.id === selectedTerritory)
    : null;

  const currentTroops = selectedTerritory
    ? territoryStates[selectedTerritory]?.troopCount || 0
    : 0;

  const pendingForSelected = selectedTerritory
    ? pendingDeployments[selectedTerritory] || 0
    : 0;

  const totalPending = Object.values(pendingDeployments).reduce((sum, count) => sum + count, 0);
  const canConfirmDeployment = troopsRemaining === 0 || totalPending > 0;

  return (
    <div className="flex items-center justify-between w-full">
      {/* Left side: Troop count and instructions */}
      <div className="flex flex-col">
        <div className="font-display text-board-parchment">
          <span className="text-lg">Troops to place: </span>
          <span className="font-numbers text-2xl text-yellow-400">{troopsRemaining}</span>
        </div>
        <div className="text-sm text-board-parchment/70 font-body">
          {selectedTerritory
            ? <>Selected: <span className="text-yellow-400">{selectedTerritoryData?.name}</span> ({currentTroops}{pendingForSelected > 0 && <span className="text-green-400"> +{pendingForSelected}</span>})</>
            : 'Click a territory to deploy troops, use +/- buttons on map'}
        </div>
        {/* Validation error message */}
        {validationError && (
          <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
            {validationError.message}
          </div>
        )}
      </div>

      {/* Center: Summary of deployments */}
      <div className="flex items-center gap-4">
        {totalPending > 0 && (
          <div className="bg-board-wood/50 rounded-lg px-4 py-2">
            <div className="text-board-parchment font-body text-sm">
              <span className="font-numbers text-lg text-green-400">{totalPending}</span>
              <span className="text-board-parchment/70 ml-2">troop{totalPending !== 1 ? 's' : ''} staged</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Done button */}
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={onConfirmDeployment}
          disabled={!canConfirmDeployment}
          className={`
            px-6 py-2 rounded-lg font-display text-lg font-semibold
            transition-all duration-150
            ${
              canConfirmDeployment
                ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Confirm Deployment
        </button>
        {troopsRemaining > 0 && totalPending > 0 && (
          <div className="text-xs text-board-parchment/70 font-body">
            {troopsRemaining} unplaced troop{troopsRemaining !== 1 ? 's' : ''} will be forfeited
          </div>
        )}
      </div>
    </div>
  );
}

interface ManeuverControlsProps {
  subPhase: SubPhase;
  maneuverSourceTerritory: TerritoryId | null;
  maneuverTargetTerritory: TerritoryId | null;
  currentManeuverPath: TerritoryId[] | null;
  territoryStates: Record<TerritoryId, TerritoryState>;
  maneuverTroopsToMove: number;
  maxManeuverTroops: number;
  onSetManeuverTroops: (troops: number) => void;
  onConfirmManeuver: () => void;
  onCancelManeuver: () => void;
  onSkipManeuver: () => void;
  onBackToAttack?: () => void;
  validationError?: ValidationError | null;
}

function ManeuverControls({
  subPhase,
  maneuverSourceTerritory,
  maneuverTargetTerritory,
  currentManeuverPath,
  territoryStates,
  maneuverTroopsToMove,
  maxManeuverTroops,
  onSetManeuverTroops,
  onConfirmManeuver,
  onCancelManeuver,
  onSkipManeuver,
  onBackToAttack,
  validationError,
}: ManeuverControlsProps) {
  const sourceTerritoryData = maneuverSourceTerritory
    ? territoriesById[maneuverSourceTerritory]
    : null;

  const targetTerritoryData = maneuverTargetTerritory
    ? territoriesById[maneuverTargetTerritory]
    : null;

  const sourceTroops = maneuverSourceTerritory
    ? territoryStates[maneuverSourceTerritory]?.troopCount || 0
    : 0;

  // SELECT_MANEUVER_SOURCE state: waiting to select maneuver source
  if (subPhase === 'SELECT_MANEUVER_SOURCE' || subPhase === null) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-display text-board-parchment">
            Select a territory to move troops from
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            Choose a territory with at least 2 troops (must leave 1 behind)
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {onBackToAttack && (
            <button
              onClick={onBackToAttack}
              className="px-6 py-2 rounded-lg font-display text-lg font-semibold
                bg-red-600 hover:bg-red-500 text-white cursor-pointer
                transition-all duration-150"
            >
              &larr; Back to Attack
            </button>
          )}
          <button
            onClick={onSkipManeuver}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Skip &amp; End Turn
          </button>
        </div>
      </div>
    );
  }

  // SELECT_MANEUVER_TARGET state: selecting destination territory
  if (subPhase === 'SELECT_MANEUVER_TARGET' && maneuverSourceTerritory) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <div className="font-display text-board-parchment">
            <span className="text-lg">Moving from: </span>
            <span className="text-yellow-400 font-semibold">
              {sourceTerritoryData?.name}
            </span>
            <span className="font-numbers text-board-parchment/70 ml-2">
              ({sourceTroops} troops)
            </span>
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            Select a destination territory (highlighted in green)
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancelManeuver}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onSkipManeuver}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Skip Maneuver
          </button>
        </div>
      </div>
    );
  }

  // SET_MANEUVER_TROOPS state: troop selection slider and execute button
  if (subPhase === 'SET_MANEUVER_TROOPS' && maneuverSourceTerritory && maneuverTargetTerritory) {
    const pathLength = currentManeuverPath ? currentManeuverPath.length : 0;
    const targetTroops = maneuverTargetTerritory
      ? territoryStates[maneuverTargetTerritory]?.troopCount || 0
      : 0;

    return (
      <div className="flex items-center justify-between w-full">
        {/* Left side: Route info */}
        <div className="flex flex-col">
          <div className="font-display text-board-parchment">
            Move troops between your territories
          </div>
          <div className="text-sm text-board-parchment/70 font-body">
            <span className="text-yellow-400 font-semibold">{sourceTerritoryData?.name}</span>
            <span className="mx-2">→</span>
            <span className="text-green-400 font-semibold">{targetTerritoryData?.name}</span>
            <span className="ml-2 text-board-parchment/50">
              ({pathLength} {pathLength === 1 ? 'territory' : 'territories'})
            </span>
          </div>
          {validationError && (
            <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
              {validationError.message}
            </div>
          )}
        </div>

        {/* Center: Troop slider */}
        <div className="flex items-center gap-4 bg-board-wood/50 rounded-lg px-4 py-2">
          <div className="text-board-parchment font-body text-sm">
            <div className="text-center">Troops</div>
          </div>

          <div className="flex items-center gap-3">
            {/* Minus button */}
            <button
              onClick={() => onSetManeuverTroops(maneuverTroopsToMove - 1)}
              disabled={maneuverTroopsToMove <= 1}
              className={`
                w-8 h-8 rounded-lg font-display text-lg font-bold
                transition-all duration-150 flex items-center justify-center
                ${
                  maneuverTroopsToMove > 1
                    ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              -
            </button>

            {/* Slider and value display */}
            <div className="flex flex-col items-center gap-1">
              <input
                type="range"
                min={1}
                max={maxManeuverTroops}
                value={maneuverTroopsToMove}
                onChange={(e) => onSetManeuverTroops(parseInt(e.target.value, 10))}
                disabled={maxManeuverTroops <= 1}
                className="w-32 h-2 bg-board-border rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:bg-yellow-400
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-md
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:bg-yellow-400
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between w-32 text-xs text-board-parchment/50 font-numbers">
                <span>1</span>
                <span>{maxManeuverTroops}</span>
              </div>
            </div>

            {/* Current value display */}
            <div className="w-10 text-center">
              <span className="font-numbers text-2xl text-yellow-400">{maneuverTroopsToMove}</span>
            </div>

            {/* Plus button */}
            <button
              onClick={() => onSetManeuverTroops(maneuverTroopsToMove + 1)}
              disabled={maneuverTroopsToMove >= maxManeuverTroops}
              className={`
                w-8 h-8 rounded-lg font-display text-lg font-bold
                transition-all duration-150 flex items-center justify-center
                ${
                  maneuverTroopsToMove < maxManeuverTroops
                    ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              +
            </button>
          </div>

          {/* Troop preview */}
          <div className="text-xs text-board-parchment/60 font-body ml-2 border-l border-board-parchment/20 pl-3">
            <div>
              <span className="text-yellow-400">{sourceTerritoryData?.name?.split(' ')[0]}</span>
              <span className="text-red-400 ml-1">{sourceTroops - maneuverTroopsToMove}</span>
            </div>
            <div>
              <span className="text-green-400">{targetTerritoryData?.name?.split(' ')[0]}</span>
              <span className="text-green-400 ml-1">{targetTroops + maneuverTroopsToMove}</span>
            </div>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancelManeuver}
            className="px-4 py-2 rounded-lg font-display text-sm font-semibold
              bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
              transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmManeuver}
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
              transition-all duration-150 hover:scale-105"
          >
            Execute Maneuver
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-between w-full">
      <div className="font-display text-board-parchment">
        Maneuver phase...
      </div>
    </div>
  );
}

interface ActionBarProps {
  phase: GamePhase;
  subPhase: SubPhase;
  troopsRemaining: number;
  selectedTerritory: TerritoryId | null;
  territoryStates: Record<TerritoryId, TerritoryState>;
  pendingDeployments: Record<TerritoryId, number>;
  onAddTroop: (territoryId: TerritoryId) => void;
  onRemoveTroop: (territoryId: TerritoryId) => void;
  onConfirmDeployment: () => void;
  // Attack phase props
  attackingTerritory?: TerritoryId | null;
  defendingTerritory?: TerritoryId | null;
  availableDice?: number[];
  onSelectDice?: (diceCount: number) => void;
  onCancelAttack?: () => void;
  onEndAttackPhase?: () => void;
  // Maneuver phase props
  maneuverSourceTerritory?: TerritoryId | null;
  maneuverTargetTerritory?: TerritoryId | null;
  currentManeuverPath?: TerritoryId[] | null;
  maneuverTroopsToMove?: number;
  maxManeuverTroops?: number;
  onSetManeuverTroops?: (troops: number) => void;
  onConfirmManeuver?: () => void;
  onCancelManeuver?: () => void;
  onSkipManeuver?: () => void;
  onBackToAttack?: () => void;
  validationError?: ValidationError | null;
  // Turn enforcement
  isLocalPlayerTurn?: boolean;
  activePlayerName?: string;
}

export function ActionBar({
  phase,
  subPhase,
  troopsRemaining,
  selectedTerritory,
  territoryStates,
  pendingDeployments,
  onAddTroop,
  onRemoveTroop,
  onConfirmDeployment,
  attackingTerritory,
  defendingTerritory,
  availableDice,
  onSelectDice,
  onCancelAttack,
  onEndAttackPhase,
  maneuverSourceTerritory,
  maneuverTargetTerritory,
  currentManeuverPath,
  maneuverTroopsToMove,
  maxManeuverTroops,
  onSetManeuverTroops,
  onConfirmManeuver,
  onCancelManeuver,
  onSkipManeuver,
  onBackToAttack,
  validationError,
  isLocalPlayerTurn = true, // Default to true for hotseat mode
  activePlayerName,
}: ActionBarProps) {
  // Only show ActionBar during active game phases
  if (phase === 'SETUP' || phase === 'END') {
    return null;
  }

  // Show waiting message if it's not the local player's turn
  if (!isLocalPlayerTurn) {
    return (
      <div className="h-20 bg-board-border p-4 border-t-2 border-board-wood">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="font-display text-lg text-board-parchment/70">
              Waiting for {activePlayerName || 'opponent'}...
            </div>
            <div className="text-sm text-board-parchment/50 font-body mt-1">
              It's not your turn
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 bg-board-border p-4 border-t-2 border-board-wood">
      {phase === 'RECRUIT' && subPhase === 'PLACE_TROOPS' && (
        <ReinforcementControls
          troopsRemaining={troopsRemaining}
          selectedTerritory={selectedTerritory}
          territoryStates={territoryStates}
          pendingDeployments={pendingDeployments}
          onAddTroop={onAddTroop}
          onRemoveTroop={onRemoveTroop}
          onConfirmDeployment={onConfirmDeployment}
          validationError={validationError}
        />
      )}

      {phase === 'ATTACK' && (
        <AttackControls
          subPhase={subPhase}
          attackingTerritory={attackingTerritory || null}
          defendingTerritory={defendingTerritory || null}
          territoryStates={territoryStates}
          availableDice={availableDice || []}
          onSelectDice={onSelectDice || (() => {})}
          onCancelAttack={onCancelAttack || (() => {})}
          onEndAttackPhase={onEndAttackPhase || (() => {})}
          validationError={validationError}
        />
      )}

      {phase === 'MANEUVER' && (
        <ManeuverControls
          subPhase={subPhase}
          maneuverSourceTerritory={maneuverSourceTerritory || null}
          maneuverTargetTerritory={maneuverTargetTerritory || null}
          currentManeuverPath={currentManeuverPath || null}
          territoryStates={territoryStates}
          maneuverTroopsToMove={maneuverTroopsToMove || 1}
          maxManeuverTroops={maxManeuverTroops || 1}
          onSetManeuverTroops={onSetManeuverTroops || (() => {})}
          onConfirmManeuver={onConfirmManeuver || (() => {})}
          onCancelManeuver={onCancelManeuver || (() => {})}
          onSkipManeuver={onSkipManeuver || (() => {})}
          onBackToAttack={onBackToAttack}
          validationError={validationError}
        />
      )}
    </div>
  );
}

export default ActionBar;
