import { useState, useCallback } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { TerritoryTooltip } from './components/game/TerritoryTooltip';
import { PlayerSidebar } from './components/game/PlayerSidebar';
import { ActionBar, ValidationError } from './components/game/ActionBar';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId } from './types/territory';
import { Player } from './types/player';
import { GamePhase, SubPhase } from './types/game';
import {
  validateAddTroop,
  validateRemoveTroop,
  validateConfirmDeployment,
} from './utils/deploymentValidation';

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
  const [territoryStates, setTerritoryStates] = useState<Record<TerritoryId, TerritoryState>>(
    createPlaceholderTerritoryStates
  );
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryId | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<TerritoryId | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pending deployments: tracks troops staged for placement but not yet confirmed
  const [pendingDeployments, setPendingDeployments] = useState<Record<TerritoryId, number>>({});

  // Validation error state for displaying feedback
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  // Mock game state
  const currentPlayer = mockPlayers[0];
  const activePlayerId = 'player-1';
  const currentTurn = 5;
  const phase: GamePhase = 'RECRUIT';
  const subPhase: SubPhase = 'PLACE_TROOPS';
  const initialTroops = 8;

  // Calculate remaining troops (initial minus pending)
  const totalPendingTroops = Object.values(pendingDeployments).reduce((sum, count) => sum + count, 0);
  const troopsRemaining = initialTroops - totalPendingTroops;

  const handleTerritoryClick = (territoryId: TerritoryId) => {
    setSelectedTerritory((prev) => (prev === territoryId ? null : territoryId));
  };

  const handleTerritoryHover = (territoryId: TerritoryId | null, mousePosition?: { x: number; y: number }) => {
    setHoveredTerritory(territoryId);
    if (mousePosition) {
      setTooltipPosition(mousePosition);
    }
  };

  // Check if it's the correct phase for deployment
  const isCorrectPhase = phase === 'RECRUIT' && subPhase === 'PLACE_TROOPS';
  const isPlayerTurn = activePlayerId === currentPlayer.id;

  // Add a troop to the selected territory's pending deployments
  const handleAddTroop = useCallback((territoryId: TerritoryId) => {
    // Clear any previous validation error
    setValidationError(null);

    // Validate the deployment action
    const validationResult = validateAddTroop({
      territoryId,
      territoryStates,
      currentPlayerId: currentPlayer.id,
      troopsRemaining,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      setValidationError({
        code: validationResult.errorCode || 'UNKNOWN',
        message: validationResult.errorMessage || 'Invalid action',
      });
      // Auto-clear error after 3 seconds
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    setPendingDeployments((prev) => ({
      ...prev,
      [territoryId]: (prev[territoryId] || 0) + 1,
    }));
  }, [troopsRemaining, territoryStates, currentPlayer.id, isPlayerTurn, isCorrectPhase]);

  // Remove a troop from the selected territory's pending deployments
  const handleRemoveTroop = useCallback((territoryId: TerritoryId) => {
    // Clear any previous validation error
    setValidationError(null);

    // Validate the removal action
    const validationResult = validateRemoveTroop(
      territoryId,
      pendingDeployments,
      isPlayerTurn,
      isCorrectPhase
    );

    if (!validationResult.valid) {
      setValidationError({
        code: validationResult.errorCode || 'UNKNOWN',
        message: validationResult.errorMessage || 'Invalid action',
      });
      // Auto-clear error after 3 seconds
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    setPendingDeployments((prev) => {
      const current = prev[territoryId] || 0;
      if (current <= 0) return prev;

      const newCount = current - 1;
      if (newCount === 0) {
        // Remove the key entirely if count is 0
        const { [territoryId]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [territoryId]: newCount,
      };
    });
  }, [pendingDeployments, isPlayerTurn, isCorrectPhase]);

  // Confirm deployment: apply pending deployments to territory states
  const handleConfirmDeployment = useCallback(() => {
    // Clear any previous validation error
    setValidationError(null);

    // Validate the confirmation action
    const validationResult = validateConfirmDeployment(
      troopsRemaining,
      isPlayerTurn,
      isCorrectPhase
    );

    if (!validationResult.valid) {
      setValidationError({
        code: validationResult.errorCode || 'UNKNOWN',
        message: validationResult.errorMessage || 'Invalid action',
      });
      // Auto-clear error after 3 seconds
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    setTerritoryStates((prev) => {
      const updated = { ...prev };
      Object.entries(pendingDeployments).forEach(([territoryId, count]) => {
        if (updated[territoryId as TerritoryId]) {
          updated[territoryId as TerritoryId] = {
            ...updated[territoryId as TerritoryId],
            troopCount: updated[territoryId as TerritoryId].troopCount + count,
          };
        }
      });
      return updated;
    });

    // Clear pending deployments after confirming
    setPendingDeployments({});

    // In a real implementation, this would transition to the next phase
    // For now, we just clear the deployments
    console.log('Deployment confirmed! Transitioning to ATTACK phase...');
  }, [troopsRemaining, pendingDeployments, isPlayerTurn, isCorrectPhase]);

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
              pendingDeployments={pendingDeployments}
            />
          </div>
        </main>
      </div>

      {/* Action Bar - context-sensitive controls based on phase */}
      <ActionBar
        phase={phase}
        subPhase={subPhase}
        troopsRemaining={troopsRemaining}
        selectedTerritory={selectedTerritory}
        territoryStates={territoryStates}
        pendingDeployments={pendingDeployments}
        onAddTroop={handleAddTroop}
        onRemoveTroop={handleRemoveTroop}
        onConfirmDeployment={handleConfirmDeployment}
        validationError={validationError}
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
