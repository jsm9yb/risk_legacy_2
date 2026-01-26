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
  onAddTroop,
  onRemoveTroop,
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
  const allTroopsPlaced = troopsRemaining === 0;

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
            ? `Selected: ${selectedTerritoryData?.name}`
            : 'Click a territory to deploy troops'}
        </div>
        {/* Validation error message */}
        {validationError && (
          <div className="text-sm text-red-400 font-body mt-1 animate-pulse">
            {validationError.message}
          </div>
        )}
      </div>

      {/* Center: +/- controls for selected territory */}
      <div className="flex items-center gap-4">
        {selectedTerritory && (
          <div className="flex items-center gap-3 bg-board-wood/50 rounded-lg px-4 py-2">
            <div className="text-board-parchment font-body text-sm">
              <div>{selectedTerritoryData?.name}</div>
              <div className="text-xs text-board-parchment/60">
                Current: {currentTroops} {pendingForSelected > 0 && `(+${pendingForSelected})`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onRemoveTroop(selectedTerritory)}
                disabled={pendingForSelected === 0}
                className={`
                  w-10 h-10 rounded-lg font-display text-xl font-bold
                  transition-all duration-150
                  ${
                    pendingForSelected > 0
                      ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                -1
              </button>

              <div className="w-12 text-center">
                <span className="font-numbers text-2xl text-yellow-400">
                  {pendingForSelected}
                </span>
              </div>

              <button
                onClick={() => onAddTroop(selectedTerritory)}
                disabled={troopsRemaining === 0}
                className={`
                  w-10 h-10 rounded-lg font-display text-xl font-bold
                  transition-all duration-150
                  ${
                    troopsRemaining > 0
                      ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                +1
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Done button */}
      <div className="flex flex-col items-end gap-2">
        {totalPending > 0 && (
          <div className="text-xs text-board-parchment/60 font-body">
            {totalPending} troop{totalPending !== 1 ? 's' : ''} staged
          </div>
        )}
        <button
          onClick={onConfirmDeployment}
          disabled={!allTroopsPlaced}
          className={`
            px-6 py-2 rounded-lg font-display text-lg font-semibold
            transition-all duration-150
            ${
              allTroopsPlaced
                ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          Done Placing
        </button>
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
  validationError?: ValidationError | null;
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
  validationError,
}: ActionBarProps) {
  // Only show ActionBar during active game phases
  if (phase === 'SETUP' || phase === 'END') {
    return null;
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
        <div className="flex items-center justify-between w-full">
          <div className="font-display text-board-parchment">
            Move troops between your territories
          </div>
          <div className="flex gap-3">
            <button
              className="px-6 py-2 rounded-lg font-display text-lg font-semibold
                bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
                transition-all duration-150"
            >
              Skip
            </button>
            <button
              className="px-6 py-2 rounded-lg font-display text-lg font-semibold
                bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
                transition-all duration-150"
            >
              Execute Maneuver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActionBar;
