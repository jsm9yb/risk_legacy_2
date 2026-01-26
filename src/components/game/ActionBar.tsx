import { TerritoryId, TerritoryState } from '@/types/territory';
import { GamePhase, SubPhase } from '@/types/game';
import { territories } from '@/data/territories';

export interface ValidationError {
  code: string;
  message: string;
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

      {phase === 'ATTACK' && subPhase === 'IDLE' && (
        <div className="flex items-center justify-between w-full">
          <div className="font-display text-board-parchment">
            Select a territory to attack from
          </div>
          <button
            className="px-6 py-2 rounded-lg font-display text-lg font-semibold
              bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg
              transition-all duration-150"
          >
            End Attack Phase &rarr;
          </button>
        </div>
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
