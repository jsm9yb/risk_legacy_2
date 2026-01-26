import { useEffect, useCallback, useState } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { TerritoryTooltip } from './components/game/TerritoryTooltip';
import { PlayerSidebar } from './components/game/PlayerSidebar';
import { ActionBar, ValidationError } from './components/game/ActionBar';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId } from './types/territory';
import { Player } from './types/player';
import { useGameStore } from './store/gameStore';

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

// Create initial territory states distributed among players
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
  // Use Zustand store for game state
  const {
    territories: territoryStates,
    selectedTerritory,
    hoveredTerritory,
    phase,
    subPhase,
    currentTurn,
    activePlayerId,
    players,
    pendingDeployments,
    lastError,
    syncFromServer,
    setSelectedTerritory,
    setHoveredTerritory,
    addTroop,
    removeTroop,
    confirmDeployment,
    getTroopsRemaining,
    getSelectableTerritories,
    clearError,
  } = useGameStore();

  // Local state for tooltip position (UI-only, doesn't need to be in store)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Local state for validation error display with auto-clear
  const [displayError, setDisplayError] = useState<ValidationError | null>(null);

  // Initialize store with mock data on mount
  useEffect(() => {
    syncFromServer({
      gameId: 'game-1',
      status: 'active',
      currentTurn: 5,
      activePlayerId: 'player-1',
      phase: 'RECRUIT',
      subPhase: 'PLACE_TROOPS',
      territories: createPlaceholderTerritoryStates(),
      players: mockPlayers,
      troopsToPlace: 8,
      pendingDeployments: {},
    });
  }, [syncFromServer]);

  // Sync validation errors from store to local display state with auto-clear
  useEffect(() => {
    if (lastError && !lastError.valid) {
      setDisplayError({
        code: lastError.errorCode || 'UNKNOWN',
        message: lastError.errorMessage || 'Invalid action',
      });
      const timer = setTimeout(() => {
        setDisplayError(null);
        clearError();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastError, clearError]);

  // Get current player from store
  const currentPlayer = players[0] || null;

  // Calculate remaining troops using store method
  const troopsRemaining = getTroopsRemaining();

  // Get selectable territories using store method
  const selectableTerritories = getSelectableTerritories();

  const handleTerritoryClick = useCallback((territoryId: TerritoryId) => {
    setSelectedTerritory(selectedTerritory === territoryId ? null : territoryId);
  }, [selectedTerritory, setSelectedTerritory]);

  const handleTerritoryHover = useCallback((territoryId: TerritoryId | null, mousePosition?: { x: number; y: number }) => {
    setHoveredTerritory(territoryId);
    if (mousePosition) {
      setTooltipPosition(mousePosition);
    }
  }, [setHoveredTerritory]);

  // Add a troop to the selected territory's pending deployments
  const handleAddTroop = useCallback((territoryId: TerritoryId) => {
    addTroop(territoryId);
  }, [addTroop]);

  // Remove a troop from the selected territory's pending deployments
  const handleRemoveTroop = useCallback((territoryId: TerritoryId) => {
    removeTroop(territoryId);
  }, [removeTroop]);

  // Confirm deployment: apply pending deployments to territory states
  const handleConfirmDeployment = useCallback(() => {
    const result = confirmDeployment();
    if (result.valid) {
      console.log('Deployment confirmed! Transitioning to ATTACK phase...');
    }
  }, [confirmDeployment]);

  // Get neighbors of selected territory for highlighting
  const highlightedTerritories = selectedTerritory
    ? territories.find((t) => t.id === selectedTerritory)?.neighbors || []
    : [];

  // Don't render until store is initialized
  if (!currentPlayer || Object.keys(territoryStates).length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-board-wood">
        <div className="text-board-parchment font-display text-2xl">Loading...</div>
      </div>
    );
  }

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
          players={players}
          activePlayerId={activePlayerId || ''}
          currentTurn={currentTurn}
          phase={phase || 'SETUP'}
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
              pendingDeployments={pendingDeployments}
            />
          </div>
        </main>
      </div>

      {/* Action Bar - context-sensitive controls based on phase */}
      <ActionBar
        phase={phase || 'SETUP'}
        subPhase={subPhase}
        troopsRemaining={troopsRemaining}
        selectedTerritory={selectedTerritory}
        territoryStates={territoryStates}
        pendingDeployments={pendingDeployments}
        onAddTroop={handleAddTroop}
        onRemoveTroop={handleRemoveTroop}
        onConfirmDeployment={handleConfirmDeployment}
        validationError={displayError}
      />

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
