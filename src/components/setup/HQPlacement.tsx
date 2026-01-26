import { TerritoryId } from '@/types/territory';
import { FactionEmblem } from '@/components/icons/FactionEmblems';
import { factionsById } from '@/data/factions';
import { Player } from '@/types/player';

interface HQPlacementProps {
  isOpen: boolean;
  /** The player who is currently placing their HQ */
  currentPlayer: Player;
  /** Currently selected territory (if any) */
  selectedTerritory: TerritoryId | null;
  /** Territory name for display */
  selectedTerritoryName: string | null;
  /** Whether the selected territory is valid for HQ placement */
  isValidSelection: boolean;
  /** Number of starting troops to be placed */
  startingTroops: number;
  /** Callback when user confirms HQ placement */
  onConfirmPlacement: () => void;
  /** Error message to display (if any) */
  errorMessage: string | null;
  /** List of players who have already placed HQs (for display) */
  placedHQs: Array<{
    playerName: string;
    factionId: string;
    territoryName: string;
  }>;
}

/**
 * HQ Placement modal component
 * Shows during SETUP/HQ_PLACEMENT sub-phase.
 *
 * Per spec section 4.1.1:
 * - Places HQ marker + starting troops (usually 8) on a legal starting territory
 * - Legal territory: Unmarked (no stickers) OR Major City founded by this player
 * - NOT adjacent to another player's HQ
 */
export function HQPlacement({
  isOpen,
  currentPlayer,
  selectedTerritory,
  selectedTerritoryName,
  isValidSelection,
  startingTroops,
  onConfirmPlacement,
  errorMessage,
  placedHQs,
}: HQPlacementProps) {
  if (!isOpen) return null;

  const faction = currentPlayer.factionId ? factionsById[currentPlayer.factionId] : null;
  const factionColor = faction?.color || '#666';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Semi-transparent backdrop - but don't block map interactions */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Floating instruction panel - positioned at top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-board-border rounded-xl shadow-2xl border-4 border-board-wood max-w-xl w-full overflow-hidden">
          {/* Header */}
          <div
            className="px-6 py-4 text-center border-b-2 border-board-border"
            style={{ backgroundColor: factionColor }}
          >
            <div className="flex items-center justify-center gap-3">
              {faction && (
                <FactionEmblem factionId={faction.id} size={40} />
              )}
              <div>
                <h2 className="font-display text-2xl text-white drop-shadow-lg">
                  PLACE YOUR HEADQUARTERS
                </h2>
                <div className="text-white/80 font-body text-sm">
                  {currentPlayer.name}, select your starting territory
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 bg-board-border">
            {/* Instructions */}
            <div className="bg-board-wood/30 rounded-lg p-3 mb-4">
              <div className="text-board-parchment/90 font-body text-sm space-y-1">
                <p>Click on a <span className="text-green-400 font-semibold">highlighted territory</span> on the map to place your headquarters.</p>
                <p className="text-board-parchment/60 text-xs mt-2">
                  Legal territories: Unmarked (no scars/cities) and not adjacent to another HQ
                </p>
              </div>
            </div>

            {/* Selected territory display */}
            {selectedTerritory && (
              <div className={`
                rounded-lg p-4 mb-4 border-2
                ${isValidSelection
                  ? 'bg-green-900/30 border-green-600/50'
                  : 'bg-red-900/30 border-red-600/50'}
              `}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-board-parchment/60 text-xs font-body uppercase">
                      Selected Territory
                    </div>
                    <div className={`font-display text-xl ${isValidSelection ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedTerritoryName || selectedTerritory}
                    </div>
                  </div>
                  {isValidSelection && (
                    <div className="flex items-center gap-2">
                      <div className="text-board-parchment/60 text-xs font-body">
                        Starting with
                      </div>
                      <div className="bg-green-600 text-white font-display text-lg px-3 py-1 rounded">
                        {startingTroops} troops
                      </div>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {errorMessage && (
                  <div className="mt-2 text-red-400 text-sm font-body">
                    {errorMessage}
                  </div>
                )}
              </div>
            )}

            {/* No selection prompt */}
            {!selectedTerritory && (
              <div className="text-center py-4 text-board-parchment/50 font-body">
                Click a highlighted territory on the map
              </div>
            )}

            {/* Already placed HQs */}
            {placedHQs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-board-wood/30">
                <div className="text-board-parchment/60 text-xs font-body uppercase mb-2">
                  Headquarters Already Placed
                </div>
                <div className="space-y-2">
                  {placedHQs.map((hq) => {
                    const hqFaction = factionsById[hq.factionId as keyof typeof factionsById];
                    return (
                      <div key={hq.playerName} className="flex items-center gap-2">
                        {hqFaction && <FactionEmblem factionId={hqFaction.id} size={20} />}
                        <span className="text-board-parchment/80 text-sm font-body">
                          {hq.playerName}
                        </span>
                        <span className="text-board-parchment/50 text-sm font-body">
                          &mdash;
                        </span>
                        <span className="text-board-parchment/70 text-sm font-body">
                          {hq.territoryName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirm button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={onConfirmPlacement}
                disabled={!isValidSelection || !selectedTerritory}
                className={`
                  px-6 py-3 rounded-lg font-display text-lg font-semibold
                  transition-all duration-200 shadow-lg
                  ${
                    isValidSelection && selectedTerritory
                      ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer hover:scale-105'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Place Headquarters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HQPlacement;
