import { useState } from 'react';
import { FactionId } from '@/types/game';
import { factions, Faction } from '@/data/factions';
import { FactionEmblem } from '@/components/icons/FactionEmblems';
import { PowerSelect } from './PowerSelect';

interface FactionSelectProps {
  isOpen: boolean;
  currentPlayerId: string;
  currentPlayerName: string;
  /** Factions that have already been taken by other players */
  takenFactions: FactionId[];
  /** Callback when a faction and power are selected */
  onSelectFaction: (factionId: FactionId, powerId: string) => void;
  /** Callback to cancel selection (optional, for going back) */
  onCancel?: () => void;
}

/**
 * Faction card component showing a single faction option
 */
function FactionCard({
  faction,
  isSelected,
  isTaken,
  onSelect,
}: {
  faction: Faction;
  isSelected: boolean;
  isTaken: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={isTaken}
      className={`
        relative p-4 rounded-xl border-3 transition-all duration-200 text-center
        ${
          isSelected
            ? 'scale-105 shadow-2xl'
            : isTaken
            ? 'opacity-40 cursor-not-allowed scale-95'
            : 'hover:scale-102 hover:shadow-lg cursor-pointer'
        }
      `}
      style={{
        backgroundColor: isSelected ? `${faction.color}30` : isTaken ? '#333' : `${faction.color}15`,
        borderColor: isSelected ? faction.color : isTaken ? '#555' : `${faction.color}50`,
        borderWidth: isSelected ? '3px' : '2px',
      }}
    >
      {/* Taken badge */}
      {isTaken && (
        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
          TAKEN
        </div>
      )}

      {/* Faction emblem */}
      <div className="mb-3 flex justify-center">
        <FactionEmblem factionId={faction.id} size={56} />
      </div>

      {/* Faction name */}
      <h3
        className="font-display text-lg mb-1"
        style={{ color: isTaken ? '#777' : faction.color }}
      >
        {faction.name}
      </h3>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-board-wood" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

/**
 * FactionSelect screen component
 * Allows a player to select a faction and choose one of two starting powers.
 * Per spec section 4.1.1: At campaign start, ONE power is chosen and applied;
 * the other is marked destroyed.
 */
export function FactionSelect({
  isOpen,
  currentPlayerName,
  takenFactions,
  onSelectFaction,
  onCancel,
}: FactionSelectProps) {
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [selectedPowerId, setSelectedPowerId] = useState<string | null>(null);

  // Filter available factions
  const availableFactions = factions.filter((f) => !takenFactions.includes(f.id));

  // Handle faction selection
  const handleFactionSelect = (faction: Faction) => {
    if (takenFactions.includes(faction.id)) return;

    setSelectedFaction(faction);
    setSelectedPowerId(null); // Reset power selection when faction changes
  };

  // Handle power selection
  const handlePowerSelect = (powerId: string) => {
    setSelectedPowerId(powerId);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedFaction && selectedPowerId) {
      onSelectFaction(selectedFaction.id, selectedPowerId);
    }
  };

  // Can confirm if both faction and power are selected
  const canConfirm = selectedFaction !== null && selectedPowerId !== null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-board-border rounded-xl shadow-2xl border-4 border-board-wood max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-board-wood px-6 py-5 text-center border-b-2 border-board-border">
          <h2 className="font-display text-3xl text-board-parchment">CHOOSE YOUR FACTION</h2>
          <div className="text-board-parchment/70 font-body mt-2">
            {currentPlayerName}, select your faction and starting power
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Faction Selection Grid */}
          <div className="mb-8">
            <h3 className="font-display text-xl text-board-parchment mb-4">
              Select a Faction ({availableFactions.length} available)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {factions.map((faction) => (
                <FactionCard
                  key={faction.id}
                  faction={faction}
                  isSelected={selectedFaction?.id === faction.id}
                  isTaken={takenFactions.includes(faction.id)}
                  onSelect={() => handleFactionSelect(faction)}
                />
              ))}
            </div>
          </div>

          {/* Power Selection - only show when faction is selected */}
          {selectedFaction && (
            <div className="border-t-2 border-board-wood/50 pt-6">
              <PowerSelect
                faction={selectedFaction}
                selectedPowerId={selectedPowerId}
                onSelectPower={handlePowerSelect}
                showFactionHeader={true}
                showDestroyedWarning={true}
              />
            </div>
          )}

          {/* Empty state when no faction selected */}
          {!selectedFaction && (
            <div className="text-center py-8 text-board-parchment/50 font-body">
              Select a faction above to view and choose your starting power
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-board-wood/30 px-6 py-4 flex justify-between items-center border-t-2 border-board-wood/50">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg font-display text-sm font-semibold
                bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
                transition-all duration-150"
            >
              Cancel
            </button>
          )}
          {!onCancel && <div />}

          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`
              px-8 py-3 rounded-lg font-display text-lg font-semibold
              transition-all duration-200 shadow-lg
              ${
                canConfirm
                  ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer hover:scale-105'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}

export default FactionSelect;
