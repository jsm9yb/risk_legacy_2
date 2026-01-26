import { Player } from '@/types/player';
import { TerritoryId, TerritoryState } from '@/types/territory';
import { FactionEmblem } from '@/components/icons/FactionEmblems';
import { factionsById } from '@/data/factions';
import {
  VictoryCondition,
  VictoryStats,
  getVictoryConditionDescription,
  calculateVictoryStats,
} from '@/utils/victoryDetection';

interface VictoryModalProps {
  isOpen: boolean;
  winner: Player;
  condition: VictoryCondition;
  players: Player[];
  territories: Record<TerritoryId, TerritoryState>;
  onContinue?: () => void;
}

/**
 * Star display component
 */
function StarDisplay({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`w-8 h-8 ${i < count ? 'text-yellow-400' : 'text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Stat row component
 */
function StatRow({ label, value, icon }: { label: string; value: string | number; icon?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-board-wood/30 last:border-b-0">
      <span className="text-board-parchment/70 font-body flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className="text-board-parchment font-display text-lg">{value}</span>
    </div>
  );
}

/**
 * Player ranking row
 */
function PlayerRankRow({
  rank,
  player,
  territories,
  isWinner,
}: {
  rank: number;
  player: Player;
  territories: Record<TerritoryId, TerritoryState>;
  isWinner: boolean;
}) {
  const faction = player.factionId ? factionsById[player.factionId] : null;
  const territoryCount = Object.values(territories).filter((t) => t.ownerId === player.id).length;

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isWinner ? 'bg-yellow-500/20 border border-yellow-400/50' : 'bg-board-wood/20'}
        ${player.isEliminated ? 'opacity-50' : ''}
      `}
    >
      <span className="text-2xl font-display text-board-parchment/60 w-8">
        {rank}.
      </span>
      {faction && <FactionEmblem factionId={faction.id} size={32} />}
      <div className="flex-1">
        <div className="font-display text-board-parchment">
          {player.name}
          {isWinner && <span className="ml-2 text-yellow-400 text-sm">WINNER</span>}
          {player.isEliminated && <span className="ml-2 text-red-400 text-sm">ELIMINATED</span>}
        </div>
        <div className="text-board-parchment/60 text-sm font-body">
          {faction?.name || 'No faction'}
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          {Array.from({ length: player.redStars }).map((_, i) => (
            <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <div className="text-board-parchment/60 text-xs font-body">
          {territoryCount} territories
        </div>
      </div>
    </div>
  );
}

/**
 * VictoryModal component
 * Displays when a player wins the game.
 *
 * Per spec section 4.6:
 * - Victory requires 4 Red Stars
 * - Or last player standing
 * - Game ends instantly when condition met
 */
export function VictoryModal({
  isOpen,
  winner,
  condition,
  players,
  territories,
  onContinue,
}: VictoryModalProps) {
  if (!isOpen) return null;

  const faction = winner.factionId ? factionsById[winner.factionId] : null;
  const factionColor = faction?.color || '#DAA520';
  const stats: VictoryStats = calculateVictoryStats(winner, players, territories);

  // Sort players by stars (descending), then territories (descending)
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.redStars !== a.redStars) return b.redStars - a.redStars;
    const aTerritories = Object.values(territories).filter((t) => t.ownerId === a.id).length;
    const bTerritories = Object.values(territories).filter((t) => t.ownerId === b.id).length;
    return bTerritories - aTerritories;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with animated gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/90 via-board-wood/80 to-black/90"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 30%, ${factionColor}30 0%, transparent 50%)`,
        }}
      />

      {/* Confetti-like decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-pulse"
            style={{
              backgroundColor: i % 2 === 0 ? factionColor : '#FFD700',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* Modal content */}
      <div className="relative bg-board-border rounded-2xl shadow-2xl border-4 border-board-wood max-w-2xl w-full mx-4 overflow-hidden">
        {/* Trophy header */}
        <div
          className="relative px-8 py-8 text-center overflow-hidden"
          style={{ backgroundColor: factionColor }}
        >
          {/* Trophy icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <svg
                className="w-24 h-24 text-yellow-300 drop-shadow-lg animate-bounce"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{ animationDuration: '2s' }}
              >
                <path d="M5 3h14a1 1 0 011 1v2a6 6 0 01-6 6 6 6 0 01-6-6V4a1 1 0 011-1zm1 2v1a4 4 0 004 4 4 4 0 004-4V5H6zm2 10h8v2H8v-2zm2 4h4v4h-4v-4z" />
              </svg>
              {faction && (
                <div className="absolute -bottom-2 -right-2">
                  <FactionEmblem factionId={faction.id} size={40} />
                </div>
              )}
            </div>
          </div>

          <h2 className="font-display text-4xl text-white drop-shadow-lg mb-2">VICTORY!</h2>
          <div className="font-display text-2xl text-white/90">
            {faction?.name || 'Unknown Faction'} Wins
          </div>
          <div className="font-body text-white/70 mt-2">
            {getVictoryConditionDescription(condition)}
          </div>
        </div>

        {/* Winner info */}
        <div className="px-8 py-6 bg-board-wood/20 border-b-2 border-board-wood/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {faction && <FactionEmblem factionId={faction.id} size={64} />}
              <div>
                <div className="font-display text-2xl text-board-parchment">{winner.name}</div>
                <div className="text-board-parchment/60 font-body">
                  {faction?.name || 'Unknown Faction'}
                </div>
              </div>
            </div>
            <StarDisplay count={winner.redStars} />
          </div>
        </div>

        {/* Stats section */}
        <div className="px-8 py-6 border-b-2 border-board-wood/30">
          <h3 className="font-display text-lg text-board-parchment mb-4">Final Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <StatRow label="Territories Controlled" value={stats.territoriesControlled} icon="🗺️" />
            <StatRow label="Total Troops" value={stats.totalTroops} icon="⚔️" />
            <StatRow label="Enemy HQs Captured" value={stats.enemyHQsCaptured} icon="🏰" />
            <StatRow label="Stars from Cards" value={stats.cardsTradedForStars} icon="🃏" />
          </div>
        </div>

        {/* Final standings */}
        <div className="px-8 py-6 max-h-64 overflow-y-auto">
          <h3 className="font-display text-lg text-board-parchment mb-4">Final Standings</h3>
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => (
              <PlayerRankRow
                key={player.id}
                rank={index + 1}
                player={player}
                territories={territories}
                isWinner={player.id === winner.id}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-board-wood/30 flex justify-center">
          <button
            onClick={onContinue}
            className="px-8 py-3 rounded-lg font-display text-lg font-semibold
              bg-yellow-500 hover:bg-yellow-400 text-board-wood cursor-pointer
              transition-all duration-200 shadow-lg hover:scale-105"
          >
            Continue to Write Phase
          </button>
        </div>
      </div>
    </div>
  );
}

export default VictoryModal;
