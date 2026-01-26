import { useState, useRef, useEffect } from 'react';
import { GameLogEntry, LogEntryType } from '@/types/gameLog';

interface GameLogProps {
  entries: GameLogEntry[];
  currentTurn: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * Icon for each log entry type
 */
function getEntryIcon(type: LogEntryType): string {
  switch (type) {
    case 'DEPLOY':
      return '🎯';
    case 'ATTACK_DECLARE':
      return '⚔️';
    case 'COMBAT_RESULT':
      return '🎲';
    case 'CONQUEST':
      return '🏴';
    case 'MANEUVER':
      return '🚶';
    case 'CARD_DRAW':
      return '🃏';
    case 'CARD_TRADE':
      return '💰';
    case 'ELIMINATION':
      return '💀';
    case 'VICTORY':
      return '🏆';
    case 'PHASE_CHANGE':
      return '📋';
    case 'TURN_START':
      return '▶️';
    case 'HQ_PLACED':
      return '🏰';
    case 'FACTION_SELECTED':
      return '🛡️';
    default:
      return '•';
  }
}

/**
 * Color for each log entry type
 */
function getEntryColor(type: LogEntryType): string {
  switch (type) {
    case 'DEPLOY':
      return 'text-green-400';
    case 'ATTACK_DECLARE':
      return 'text-red-400';
    case 'COMBAT_RESULT':
      return 'text-yellow-400';
    case 'CONQUEST':
      return 'text-purple-400';
    case 'MANEUVER':
      return 'text-blue-400';
    case 'CARD_DRAW':
    case 'CARD_TRADE':
      return 'text-orange-400';
    case 'ELIMINATION':
      return 'text-red-500';
    case 'VICTORY':
      return 'text-yellow-300';
    case 'PHASE_CHANGE':
    case 'TURN_START':
      return 'text-board-parchment/60';
    default:
      return 'text-board-parchment/80';
  }
}

/**
 * Single log entry component
 */
function LogEntry({ entry }: { entry: GameLogEntry }) {
  const icon = getEntryIcon(entry.type);
  const colorClass = getEntryColor(entry.type);
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex gap-2 py-1 px-2 hover:bg-board-wood/20 rounded text-sm">
      <span className="flex-shrink-0">{icon}</span>
      <span className={`flex-1 ${colorClass}`}>{entry.message}</span>
      <span className="text-board-parchment/40 text-xs flex-shrink-0">{time}</span>
    </div>
  );
}

/**
 * Turn separator component
 */
function TurnSeparator({ turn }: { turn: number }) {
  return (
    <div className="flex items-center gap-2 py-2 px-2">
      <div className="flex-1 h-px bg-board-wood/50" />
      <span className="text-xs font-display text-board-parchment/60 uppercase">Turn {turn}</span>
      <div className="flex-1 h-px bg-board-wood/50" />
    </div>
  );
}

/**
 * Filter button component
 */
function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1 rounded text-xs font-body transition-colors
        ${active
          ? 'bg-board-wood text-board-parchment'
          : 'bg-board-wood/30 text-board-parchment/60 hover:bg-board-wood/50'}
      `}
    >
      {label}
    </button>
  );
}

/**
 * GameLog component
 * Displays a collapsible log of game events grouped by turn.
 *
 * Per spec section 13.7:
 * - Shows turn-grouped entries
 * - Filter options by event type
 * - Auto-scroll to latest
 */
export function GameLog({
  entries,
  currentTurn,
  isCollapsed = false,
  onToggleCollapse,
}: GameLogProps) {
  const [filter, setFilter] = useState<LogEntryType | 'ALL'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, isCollapsed]);

  // Filter entries
  const filteredEntries = filter === 'ALL'
    ? entries
    : entries.filter((e) => e.type === filter);

  // Group entries by turn
  const groupedEntries = filteredEntries.reduce<Record<number, GameLogEntry[]>>((acc, entry) => {
    if (!acc[entry.turn]) {
      acc[entry.turn] = [];
    }
    acc[entry.turn].push(entry);
    return acc;
  }, {});

  const turns = Object.keys(groupedEntries)
    .map(Number)
    .sort((a, b) => a - b);

  if (isCollapsed) {
    return (
      <div
        className="absolute bottom-4 right-4 bg-board-border rounded-lg shadow-lg border-2 border-board-wood cursor-pointer hover:bg-board-border/90 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="text-board-parchment/80 font-body text-sm">Game Log</span>
          <span className="bg-board-wood text-board-parchment text-xs px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
          <svg
            className="w-4 h-4 text-board-parchment/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-board-border rounded-lg shadow-lg border-2 border-board-wood overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-2 bg-board-wood flex items-center justify-between cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-board-parchment">GAME LOG</span>
          <span className="bg-board-border text-board-parchment text-xs px-2 py-0.5 rounded-full">
            Turn {currentTurn}
          </span>
        </div>
        <svg
          className="w-4 h-4 text-board-parchment/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-board-wood/30 flex gap-1 flex-wrap">
        <FilterButton label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <FilterButton
          label="Combat"
          active={filter === 'COMBAT_RESULT'}
          onClick={() => setFilter('COMBAT_RESULT')}
        />
        <FilterButton
          label="Conquests"
          active={filter === 'CONQUEST'}
          onClick={() => setFilter('CONQUEST')}
        />
        <FilterButton
          label="Deploy"
          active={filter === 'DEPLOY'}
          onClick={() => setFilter('DEPLOY')}
        />
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-board-wood scrollbar-track-transparent"
      >
        {entries.length === 0 ? (
          <div className="p-4 text-center text-board-parchment/50 font-body text-sm">
            No events yet
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-4 text-center text-board-parchment/50 font-body text-sm">
            No {filter.toLowerCase().replace('_', ' ')} events
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn}>
              <TurnSeparator turn={turn} />
              {groupedEntries[turn].map((entry) => (
                <LogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer with entry count */}
      <div className="px-3 py-2 bg-board-wood/20 border-t border-board-wood/30 text-xs text-board-parchment/50 text-center">
        {filteredEntries.length} of {entries.length} events
      </div>
    </div>
  );
}

export default GameLog;
