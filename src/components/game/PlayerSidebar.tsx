import { Player } from '@/types/player';
import { GamePhase } from '@/types/game';
import { factionsById } from '@/data/factions';
import { continents } from '@/data/continents';
import { TerritoryState, TerritoryId } from '@/types/territory';

interface PlayerSidebarProps {
  currentPlayer: Player;
  players: Player[];
  activePlayerId: string;
  currentTurn: number;
  phase: GamePhase;
  territories: Record<TerritoryId, TerritoryState>;
}

// Calculate reinforcement preview for a player
function calculateReinforcements(
  player: Player,
  territories: Record<TerritoryId, TerritoryState>
): { base: number; continentBonus: number; breakdown: string[] } {
  // Count controlled territories and city population
  let controlledTerritories = 0;
  let totalCityPopulation = 0;
  const controlledContinents: string[] = [];

  Object.values(territories).forEach((territory) => {
    if (territory.ownerId === player.id) {
      controlledTerritories++;
      totalCityPopulation += territory.cityTier;
    }
  });

  // Check continent control
  continents.forEach((continent) => {
    const controlsAll = continent.territoryIds.every(
      (tid) => territories[tid]?.ownerId === player.id
    );
    if (controlsAll) {
      controlledContinents.push(continent.name);
    }
  });

  // Base troops: floor((territories + population) / 3), minimum 3
  const rawBase = Math.floor((controlledTerritories + totalCityPopulation) / 3);
  const base = Math.max(3, rawBase);

  // Continent bonuses
  const continentBonus = continents
    .filter((c) => controlledContinents.includes(c.name))
    .reduce((sum, c) => sum + c.bonus, 0);

  const breakdown: string[] = [];
  breakdown.push(`base ${base}`);
  if (continentBonus > 0) {
    breakdown.push(`+${continentBonus} continent bonus`);
  }

  return { base, continentBonus, breakdown };
}

// Render star icons
function StarDisplay({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <span className="font-numbers">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'text-yellow-400' : 'text-gray-600'}>
          {i < count ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}

// Render missile icons
function MissileDisplay({ count }: { count: number }) {
  if (count === 0) return <span className="text-gray-500">None</span>;
  return (
    <span className="font-numbers">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="text-red-500 mr-0.5">
          {'\u{1F680}'}
        </span>
      ))}
      <span className="ml-1 text-board-parchment">({count})</span>
    </span>
  );
}

export function PlayerSidebar({
  currentPlayer,
  players,
  activePlayerId,
  currentTurn,
  phase,
  territories,
}: PlayerSidebarProps) {
  const faction = factionsById[currentPlayer.factionId];
  const power = faction?.powers.find((p) => p.id === currentPlayer.activePower);
  const reinforcements = calculateReinforcements(currentPlayer, territories);
  const totalReinforcements = reinforcements.base + reinforcements.continentBonus;

  // Count controlled territories for current player
  const controlledTerritoryCount = Object.values(territories).filter(
    (t) => t.ownerId === currentPlayer.id
  ).length;

  return (
    <aside className="w-64 bg-board-border flex flex-col h-full border-r-2 border-board-wood">
      {/* Current Player Status */}
      <div className="p-4 border-b border-board-wood">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/60 mb-2 font-body">
          Your Status
        </h2>
        <div
          className="rounded-lg p-3 border-2"
          style={{
            backgroundColor: faction?.color + '20',
            borderColor: faction?.color,
          }}
        >
          {/* Faction Emblem placeholder + Name */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white"
              style={{ backgroundColor: faction?.color }}
            >
              {faction?.name.charAt(0)}
            </div>
            <div>
              <div className="font-display text-board-parchment font-semibold text-sm">
                {faction?.name}
              </div>
              <div className="text-xs text-board-parchment/70 font-body italic">
                &quot;{power?.name}&quot;
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between items-center text-board-parchment">
            <span className="font-body">Red Stars:</span>
            <StarDisplay count={currentPlayer.redStars} />
            <span className="text-xs text-board-parchment/60">
              ({currentPlayer.redStars}/4)
            </span>
          </div>
          <div className="flex justify-between items-center text-board-parchment">
            <span className="font-body">Missiles:</span>
            <MissileDisplay count={currentPlayer.missiles} />
          </div>
          <div className="flex justify-between items-center text-board-parchment">
            <span className="font-body">Territories:</span>
            <span className="font-numbers">{controlledTerritoryCount}</span>
          </div>
          <div className="flex justify-between items-center text-board-parchment">
            <span className="font-body">Reinforcements:</span>
            <span className="font-numbers">+{totalReinforcements}</span>
          </div>
          <div className="text-xs text-board-parchment/60 pl-2 font-body">
            ({reinforcements.breakdown.join(' ')})
          </div>
        </div>
      </div>

      {/* All Players List */}
      <div className="p-4 border-b border-board-wood flex-1">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/60 mb-2 font-body">
          All Players
        </h2>
        <div className="space-y-2">
          {players.map((player, index) => {
            const playerFaction = factionsById[player.factionId];
            const isActive = player.id === activePlayerId;
            const isCurrentUser = player.id === currentPlayer.id;

            return (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-2 rounded
                  ${isActive ? 'bg-board-wood/50 ring-1 ring-yellow-500' : ''}
                  ${player.isEliminated ? 'opacity-50' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="font-numbers text-board-parchment/60 text-sm w-4">
                    {index + 1}.
                  </span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: playerFaction?.color }}
                  />
                  <span className="font-body text-board-parchment text-sm">
                    {isCurrentUser ? 'You' : `Player ${index + 1}`}
                    <span className="text-board-parchment/60 text-xs ml-1">
                      ({playerFaction?.name.split(' ').pop()})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <StarDisplay count={player.redStars} max={player.redStars} />
                  {isActive && (
                    <span className="ml-1 text-xs text-yellow-400 animate-pulse">
                      {'\u25C0'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Indicator */}
      <div className="p-4 border-b border-board-wood">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/60 mb-2 font-body">
          Phase Indicator
        </h2>
        <div className="text-board-parchment font-display text-lg">
          Turn {currentTurn}
        </div>
        <div className="text-board-parchment/80 font-body text-sm">
          {activePlayerId === currentPlayer.id ? 'Your turn' : 'Waiting...'}
        </div>
        <div className="mt-2 flex gap-1">
          {(['SETUP', 'RECRUIT', 'ATTACK', 'MANEUVER'] as const).map((p) => (
            <div
              key={p}
              className={`
                flex-1 h-2 rounded-full
                ${phase === p ? 'bg-yellow-500' : 'bg-board-wood'}
              `}
              title={p}
            />
          ))}
        </div>
        <div className="mt-1 text-xs text-board-parchment/60 font-body uppercase">
          {phase}
        </div>
      </div>

      {/* Card Hand Preview */}
      <div className="p-4">
        <h2 className="text-xs uppercase tracking-wider text-board-parchment/60 mb-2 font-body">
          Your Cards ({currentPlayer.cards.length})
        </h2>
        <div className="flex gap-1 flex-wrap">
          {currentPlayer.cards.length === 0 ? (
            <span className="text-sm text-board-parchment/50 font-body italic">
              No cards
            </span>
          ) : (
            currentPlayer.cards.slice(0, 6).map((cardId, i) => (
              <div
                key={i}
                className="w-8 h-10 bg-board-parchment rounded border border-board-wood flex items-center justify-center"
              >
                <span className="text-xs font-numbers text-board-wood">
                  {cardId}
                </span>
              </div>
            ))
          )}
          {currentPlayer.cards.length > 6 && (
            <div className="w-8 h-10 bg-board-wood/50 rounded border border-board-wood flex items-center justify-center">
              <span className="text-xs font-body text-board-parchment">
                +{currentPlayer.cards.length - 6}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default PlayerSidebar;
