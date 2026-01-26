import { Faction, FactionPower } from '@/data/factions';
import { FactionEmblem } from '@/components/icons/FactionEmblems';

interface PowerSelectProps {
  /** The faction whose powers are being displayed */
  faction: Faction;
  /** Currently selected power ID (if any) */
  selectedPowerId: string | null;
  /** Callback when a power is selected */
  onSelectPower: (powerId: string) => void;
  /** Whether power selection is disabled */
  disabled?: boolean;
  /** Whether to show the faction header with emblem */
  showFactionHeader?: boolean;
  /** Whether to show the destroyed power warning */
  showDestroyedWarning?: boolean;
}

/**
 * Power card component showing a single faction power option
 */
function PowerCard({
  power,
  isSelected,
  isDisabled,
  onSelect,
}: {
  power: FactionPower;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  // Map power type to badge color
  const typeColors: Record<FactionPower['type'], string> = {
    attack: 'bg-red-600',
    defense: 'bg-blue-600',
    recruitment: 'bg-green-600',
    movement: 'bg-purple-600',
    setup: 'bg-yellow-600',
  };

  return (
    <button
      onClick={onSelect}
      disabled={isDisabled}
      className={`
        w-full p-4 rounded-lg border-2 text-left transition-all duration-200
        ${
          isSelected
            ? 'bg-yellow-500/20 border-yellow-400 shadow-lg scale-105'
            : isDisabled
            ? 'bg-gray-800/50 border-gray-600 opacity-50 cursor-not-allowed'
            : 'bg-board-wood/30 border-board-wood hover:border-yellow-400/50 hover:bg-board-wood/50 cursor-pointer'
        }
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Selection indicator */}
        <div
          className={`
            w-5 h-5 rounded-full border-2 flex items-center justify-center
            ${isSelected ? 'border-yellow-400 bg-yellow-400' : 'border-board-parchment/50'}
          `}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-board-wood" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Power name */}
        <span className="font-display text-lg text-board-parchment">{power.name}</span>

        {/* Type badge */}
        <span
          className={`ml-auto px-2 py-0.5 rounded text-xs font-body text-white uppercase ${typeColors[power.type]}`}
        >
          {power.type}
        </span>
      </div>

      {/* Power description */}
      <p className="text-sm text-board-parchment/70 font-body pl-7">{power.description}</p>
    </button>
  );
}

/**
 * PowerSelect component for choosing a faction's starting power
 * Can be used standalone or integrated into FactionSelect.
 *
 * Per spec section 4.1.1: At campaign start, ONE power is chosen and applied;
 * the other is marked destroyed.
 */
export function PowerSelect({
  faction,
  selectedPowerId,
  onSelectPower,
  disabled = false,
  showFactionHeader = true,
  showDestroyedWarning = true,
}: PowerSelectProps) {
  // Get the destroyed power (the one not selected)
  const destroyedPower = selectedPowerId
    ? faction.powers.find((p) => p.id !== selectedPowerId)
    : null;

  return (
    <div className="w-full">
      {/* Faction header with emblem */}
      {showFactionHeader && (
        <div className="flex items-center gap-3 mb-4">
          <FactionEmblem factionId={faction.id} size={40} />
          <div>
            <h3
              className="font-display text-2xl"
              style={{ color: faction.color }}
            >
              {faction.name}
            </h3>
            <p className="text-board-parchment/60 font-body text-sm">
              Choose ONE starting power (the other will be destroyed)
            </p>
          </div>
        </div>
      )}

      {/* Power selection grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {faction.powers.map((power) => (
          <PowerCard
            key={power.id}
            power={power}
            isSelected={selectedPowerId === power.id}
            isDisabled={disabled}
            onSelect={() => onSelectPower(power.id)}
          />
        ))}
      </div>

      {/* Destroyed power warning */}
      {showDestroyedWarning && destroyedPower && (
        <div className="mt-4 bg-red-900/30 border border-red-600/50 rounded-lg p-4 text-center">
          <div className="text-red-400 font-display text-sm mb-1">
            WARNING: This choice is permanent
          </div>
          <div className="text-board-parchment/70 font-body text-sm">
            &quot;{destroyedPower.name}&quot; will be{' '}
            <span className="text-red-400 font-bold">destroyed</span> and unavailable
            for the rest of the campaign
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Read-only display of a faction's power (for showing active power during game)
 */
export function PowerDisplay({
  faction,
  activePowerId,
}: {
  faction: Faction;
  activePowerId: string;
}) {
  const activePower = faction.powers.find((p) => p.id === activePowerId);
  const destroyedPower = faction.powers.find((p) => p.id !== activePowerId);

  if (!activePower) return null;

  const typeColors: Record<FactionPower['type'], string> = {
    attack: 'bg-red-600',
    defense: 'bg-blue-600',
    recruitment: 'bg-green-600',
    movement: 'bg-purple-600',
    setup: 'bg-yellow-600',
  };

  return (
    <div className="w-full">
      {/* Active power */}
      <div className="p-4 rounded-lg border-2 bg-board-wood/30 border-board-wood">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="font-display text-lg text-board-parchment">{activePower.name}</span>
          <span className="text-green-400 text-xs font-body uppercase ml-1">Active</span>
          <span
            className={`ml-auto px-2 py-0.5 rounded text-xs font-body text-white uppercase ${typeColors[activePower.type]}`}
          >
            {activePower.type}
          </span>
        </div>
        <p className="text-sm text-board-parchment/70 font-body pl-7">{activePower.description}</p>
      </div>

      {/* Destroyed power (grayed out) */}
      {destroyedPower && (
        <div className="mt-3 p-3 rounded-lg border border-gray-600/50 bg-gray-800/30 opacity-50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-red-900 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="font-display text-sm text-gray-400 line-through">{destroyedPower.name}</span>
            <span className="text-red-400/70 text-xs font-body uppercase ml-1">Destroyed</span>
          </div>
          <p className="text-xs text-gray-500 font-body pl-6">{destroyedPower.description}</p>
        </div>
      )}
    </div>
  );
}

export default PowerSelect;
