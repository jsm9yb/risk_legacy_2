import { useState } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { TerritoryTooltip } from './components/game/TerritoryTooltip';
import { PlayerSidebar } from './components/game/PlayerSidebar';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId } from './types/territory';
import { Player } from './types/player';
import { GamePhase, SubPhase } from './types/game';

// Mock player data for demonstration
const mockPlayers: Player[] = [
  {
    id: 'player-1',
    gameId: 'game-1',
    userId: 'user-1',
    seatIndex: 0,
    factionId: 'khan',
    activePower: 'rapid_deployment',
    color: '#2F4F4F',
    hqTerritory: 'eastern_australia',
    redStars: 2,
    missiles: 2,
    cards: [1, 5, 12, 23],
    isEliminated: false,
    conqueredThisTurn: false,
  },
  {
    id: 'player-2',
    gameId: 'game-1',
    userId: 'user-2',
    seatIndex: 1,
    factionId: 'enclave',
    activePower: 'ferocity',
    color: '#8B4513',
    hqTerritory: 'ukraine',
    redStars: 1,
    missiles: 0,
    cards: [3, 8],
    isEliminated: false,
    conqueredThisTurn: false,
  },
  {
    id: 'player-3',
    gameId: 'game-1',
    userId: 'user-3',
    seatIndex: 2,
    factionId: 'mechaniker',
    activePower: 'supreme_firepower',
    color: '#4A90A4',
    hqTerritory: 'greenland',
    redStars: 3,
    missiles: 1,
    cards: [7, 15, 22, 30, 41],
    isEliminated: false,
    conqueredThisTurn: true,
  },
  {
    id: 'player-4',
    gameId: 'game-1',
    userId: 'user-4',
    seatIndex: 3,
    factionId: 'saharan',
    activePower: 'desert_nomads',
    color: '#DAA520',
    hqTerritory: 'north_africa',
    redStars: 1,
    missiles: 0,
    cards: [],
    isEliminated: false,
    conqueredThisTurn: false,
  },
];

// Assign territories to mock players for demonstration
function createPlaceholderTerritoryStates(): Record<TerritoryId, TerritoryState> {
  const states: Record<TerritoryId, TerritoryState> = {};
  const playerIds = mockPlayers.map((p) => p.id);

  territories.forEach((territory, index) => {
    // Distribute territories among players
    const ownerId = playerIds[index % playerIds.length];

    states[territory.id] = {
      id: territory.id,
      name: territory.name,
      continentId: territory.continentId,
      neighbors: territory.neighbors,
      ownerId: ownerId,
      troopCount: Math.floor(Math.random() * 10) + 1,
      scarId: null,
      cityTier: 0,
      cityName: null,
      fortified: false,
      fortifyDamage: 0,
    };
  });

  return states;
}

function App() {
  const [territoryStates] = useState<Record<TerritoryId, TerritoryState>>(
    createPlaceholderTerritoryStates
  );
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryId | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<TerritoryId | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mock game state
  const currentPlayer = mockPlayers[0];
  const activePlayerId = 'player-1';
  const currentTurn = 5;
  const phase: GamePhase = 'RECRUIT';
  const subPhase: SubPhase = 'PLACE_TROOPS';
  const troopsRemaining = 8;

  const handleTerritoryClick = (territoryId: TerritoryId) => {
    setSelectedTerritory((prev) => (prev === territoryId ? null : territoryId));
  };

  const handleTerritoryHover = (territoryId: TerritoryId | null, mousePosition?: { x: number; y: number }) => {
    setHoveredTerritory(territoryId);
    if (mousePosition) {
      setTooltipPosition(mousePosition);
    }
  };

  // Get neighbors of selected territory for highlighting
  const highlightedTerritories = selectedTerritory
    ? territories.find((t) => t.id === selectedTerritory)?.neighbors || []
    : [];

  // Compute selectable territories based on game phase
  // During RECRUIT phase, only current player's territories are selectable
  const selectableTerritories = (() => {
    if (phase === 'RECRUIT' && subPhase === 'PLACE_TROOPS') {
      // Only territories owned by the current player are selectable for troop placement
      return Object.values(territoryStates)
        .filter((t) => t.ownerId === currentPlayer.id)
        .map((t) => t.id);
    }
    // For other phases, return undefined to allow all territories to be selectable
    return undefined;
  })();

  return (
    <div className="flex flex-col h-screen bg-board-wood">
      {/* Header */}
      <header className="h-14 bg-board-border flex items-center justify-between px-4 border-b-2 border-board-wood">
        <h1 className="text-board-parchment font-display text-xl font-bold">
          Risk Legacy
        </h1>
        <div className="flex items-center gap-4">
          {hoveredTerritory && (
            <span className="text-board-parchment font-body">
              {territories.find((t) => t.id === hoveredTerritory)?.name}
            </span>
          )}
          <span className="text-board-parchment/60 font-body text-sm">
            Game: &quot;Friday Night Wars&quot;
          </span>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player Sidebar */}
        <PlayerSidebar
          currentPlayer={currentPlayer}
          players={mockPlayers}
          activePlayerId={activePlayerId}
          currentTurn={currentTurn}
          phase={phase}
          subPhase={subPhase}
          territories={territoryStates}
          troopsRemaining={troopsRemaining}
        />

        {/* Main game area */}
        <main className="flex-1 p-4 overflow-hidden">
          <div className="w-full h-full rounded-lg overflow-hidden border-4 border-board-border shadow-2xl">
            <GameBoard
              territoryStates={territoryStates}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryHover={handleTerritoryHover}
              selectedTerritory={selectedTerritory}
              highlightedTerritories={highlightedTerritories}
              selectableTerritories={selectableTerritories}
            />
          </div>
        </main>
      </div>

      {/* Footer with selected territory info */}
      {selectedTerritory && (
        <footer className="h-20 bg-board-border p-4 border-t-2 border-board-wood">
          <div className="text-board-parchment font-body">
            <span className="font-bold">Selected: </span>
            {territories.find((t) => t.id === selectedTerritory)?.name}
            <span className="ml-4">
              Troops: {territoryStates[selectedTerritory]?.troopCount}
            </span>
            <span className="ml-4">
              Neighbors: {highlightedTerritories.length}
            </span>
          </div>
        </footer>
      )}

      {/* Territory Tooltip */}
      {hoveredTerritory && territoryStates[hoveredTerritory] && (
        <TerritoryTooltip
          territory={territoryStates[hoveredTerritory]}
          position={tooltipPosition}
        />
      )}
    </div>
  );
}

export default App;
