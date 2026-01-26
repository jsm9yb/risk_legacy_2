import { useEffect, useCallback, useState } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { TerritoryTooltip } from './components/game/TerritoryTooltip';
import { PlayerSidebar } from './components/game/PlayerSidebar';
import { ActionBar, ValidationError } from './components/game/ActionBar';
import { CombatModal } from './components/game/CombatModal';
import { FactionSelect } from './components/setup/FactionSelect';
import { HQPlacement } from './components/setup/HQPlacement';
import { VictoryModal } from './components/game/VictoryModal';
import { GameLog } from './components/game/GameLog';
import { SoundToggle } from './components/ui/SoundSettings';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId } from './types/territory';
import { Player } from './types/player';
import { FactionId } from './types/game';
import { useGameStore } from './store/gameStore';

// Mock player data for demonstration
const mockPlayers: Player[] = [
  {
    id: 'player-1',
    name: 'Jordan',
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
    name: 'Alex',
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
    name: 'Sam',
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
    name: 'Jo',
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
    attackingTerritory,
    defendingTerritory,
    attackerDiceCount,
    defenderDiceCount,
    combatResult,
    conquestTroopsToMove,
    lastError,
    syncFromServer,
    setSelectedTerritory,
    setHoveredTerritory,
    addTroop,
    removeTroop,
    confirmDeployment,
    selectAttackSource,
    selectAttackTarget,
    selectAttackerDice,
    selectDefenderDice,
    resolveCombatResult,
    setConquestTroops,
    confirmConquest,
    cancelAttack,
    endAttackPhase,
    maneuverSourceTerritory,
    maneuverTargetTerritory,
    currentManeuverPath,
    maneuverTroopsToMove,
    selectManeuverSource,
    selectManeuverTarget,
    setManeuverTroops,
    confirmManeuver,
    cancelManeuver,
    skipManeuver,
    getValidManeuverTargets,
    getMaxManeuverTroops,
    getTroopsRemaining,
    getSelectableTerritories,
    getValidAttackTargets,
    getAvailableAttackerDice,
    getAvailableDefenderDice,
    getDefendingPlayer,
    getConquestTroopRange,
    clearError,
    selectFaction,
    getTakenFactions,
    getSetupCurrentPlayer,
    setupTurnIndex,
    placeHQ,
    getLegalHQTerritories,
    getPlacedHQs,
    victoryResult,
    getWinner,
    dismissVictory,
    status,
    gameLog,
  } = useGameStore();

  // Local state for tooltip position (UI-only, doesn't need to be in store)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Local state for validation error display with auto-clear
  const [displayError, setDisplayError] = useState<ValidationError | null>(null);

  // Local state for game log collapse
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);

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

  // Get available dice options for attacker
  const availableDice = getAvailableAttackerDice();

  // Get available dice options for defender
  const availableDefenderDice = getAvailableDefenderDice();

  // Get defending player
  const defendingPlayer = getDefendingPlayer();

  // Get conquest troop range
  const conquestTroopRange = getConquestTroopRange();

  // Get max maneuver troops
  const maxManeuverTroops = getMaxManeuverTroops();

  // Get setup phase data
  const takenFactions = getTakenFactions();
  const setupCurrentPlayer = getSetupCurrentPlayer();

  // Determine if faction select should be open
  const isFactionSelectOpen = phase === 'SETUP' && subPhase === 'FACTION_SELECTION';

  // Determine if HQ placement should be open
  const isHQPlacementOpen = phase === 'SETUP' && subPhase === 'HQ_PLACEMENT';

  // Get HQ placement data
  const legalHQTerritories = setupCurrentPlayer
    ? getLegalHQTerritories(setupCurrentPlayer.id)
    : [];
  const placedHQs = getPlacedHQs();

  // Check if selected territory is valid for HQ placement
  const isValidHQSelection = selectedTerritory
    ? legalHQTerritories.includes(selectedTerritory)
    : false;

  // Victory modal state
  const isVictoryModalOpen = status === 'finished' && victoryResult?.isVictory === true;
  const winner = getWinner();

  // Determine if combat modal should be open
  const isCombatModalOpen =
    phase === 'ATTACK' &&
    attackingTerritory !== null &&
    defendingTerritory !== null &&
    (subPhase === 'DEFENDER_DICE' || subPhase === 'RESOLVE' || subPhase === 'TROOP_MOVE');

  const handleTerritoryClick = useCallback((territoryId: TerritoryId) => {
    // During HQ placement, handle territory selection
    if (phase === 'SETUP' && subPhase === 'HQ_PLACEMENT') {
      // Just select the territory, validation happens in the modal
      setSelectedTerritory(territoryId);
      return;
    }

    // During attack phase, handle source/target selection
    if (phase === 'ATTACK') {
      if (subPhase === 'IDLE') {
        // Select attack source
        selectAttackSource(territoryId);
        return;
      }
      if (subPhase === 'SELECT_ATTACK') {
        // Select attack target
        selectAttackTarget(territoryId);
        return;
      }
    }

    // During maneuver phase, handle source/target selection
    if (phase === 'MANEUVER') {
      if (subPhase === 'SELECT_MANEUVER_SOURCE' || subPhase === null) {
        // Select maneuver source
        selectManeuverSource(territoryId);
        return;
      }
      if (subPhase === 'SELECT_MANEUVER_TARGET') {
        // Select maneuver target
        selectManeuverTarget(territoryId);
        return;
      }
    }

    // Default behavior: toggle selection
    setSelectedTerritory(selectedTerritory === territoryId ? null : territoryId);
  }, [phase, subPhase, selectedTerritory, setSelectedTerritory, selectAttackSource, selectAttackTarget, selectManeuverSource, selectManeuverTarget]);

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

  // Select attacker dice count
  const handleSelectDice = useCallback((diceCount: number) => {
    const result = selectAttackerDice(diceCount);
    if (result.valid) {
      console.log(`Selected ${diceCount} dice! Transitioning to DEFENDER_DICE phase...`);
    }
  }, [selectAttackerDice]);

  // Select defender dice count
  const handleSelectDefenderDice = useCallback((diceCount: number) => {
    const result = selectDefenderDice(diceCount);
    if (result.valid) {
      console.log(`Defender selected ${diceCount} dice! Rolling combat...`);
    }
  }, [selectDefenderDice]);

  // Continue attack after combat resolution
  const handleContinueAttack = useCallback(() => {
    console.log('Continuing attack phase...');
  }, []);

  // Handle faction selection during setup
  const handleSelectFaction = useCallback((factionId: FactionId, powerId: string) => {
    if (!setupCurrentPlayer) return;
    selectFaction(setupCurrentPlayer.id, factionId, powerId);
    console.log(`Player ${setupCurrentPlayer.id} selected faction ${factionId} with power ${powerId}`);
  }, [setupCurrentPlayer, selectFaction]);

  // Handle HQ placement confirmation
  const handlePlaceHQ = useCallback(() => {
    if (!setupCurrentPlayer || !selectedTerritory) return;
    placeHQ(setupCurrentPlayer.id, selectedTerritory);
    console.log(`Player ${setupCurrentPlayer.id} placed HQ at ${selectedTerritory}`);
    setSelectedTerritory(null);
  }, [setupCurrentPlayer, selectedTerritory, placeHQ, setSelectedTerritory]);

  // Calculate starting troops for HQ placement display
  const getStartingTroopsForDisplay = useCallback(() => {
    if (!setupCurrentPlayer) return 8;
    // Balkania's "Established" power gives 10 troops instead of 8
    if (setupCurrentPlayer.factionId === 'balkania' && setupCurrentPlayer.activePower === 'established') {
      return 10;
    }
    return 8;
  }, [setupCurrentPlayer]);

  // Get highlighted territories based on phase
  const highlightedTerritories = (() => {
    // During HQ placement, highlight legal territories
    if (phase === 'SETUP' && subPhase === 'HQ_PLACEMENT') {
      return legalHQTerritories;
    }
    // During attack phase SELECT_ATTACK, highlight valid attack targets
    if (phase === 'ATTACK' && subPhase === 'SELECT_ATTACK' && attackingTerritory) {
      return getValidAttackTargets();
    }
    // During maneuver phase SELECT_MANEUVER_TARGET, highlight valid maneuver targets
    if (phase === 'MANEUVER' && subPhase === 'SELECT_MANEUVER_TARGET' && maneuverSourceTerritory) {
      return getValidManeuverTargets();
    }
    // During maneuver phase SET_MANEUVER_TROOPS, highlight the path
    if (phase === 'MANEUVER' && subPhase === 'SET_MANEUVER_TROOPS' && currentManeuverPath) {
      return currentManeuverPath;
    }
    // Default: show neighbors of selected territory
    return selectedTerritory
      ? territories.find((t) => t.id === selectedTerritory)?.neighbors || []
      : [];
  })();

  // Determine selectable territories for current phase
  const effectiveSelectableTerritories = (() => {
    // During HQ placement, only legal territories are selectable
    if (phase === 'SETUP' && subPhase === 'HQ_PLACEMENT') {
      return legalHQTerritories;
    }
    // Otherwise use store's selectable territories
    return selectableTerritories;
  })();

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
          <SoundToggle />
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
              selectableTerritories={effectiveSelectableTerritories}
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
        attackingTerritory={attackingTerritory}
        defendingTerritory={defendingTerritory}
        availableDice={availableDice}
        onSelectDice={handleSelectDice}
        onCancelAttack={cancelAttack}
        onEndAttackPhase={endAttackPhase}
        maneuverSourceTerritory={maneuverSourceTerritory}
        maneuverTargetTerritory={maneuverTargetTerritory}
        currentManeuverPath={currentManeuverPath}
        maneuverTroopsToMove={maneuverTroopsToMove || 1}
        maxManeuverTroops={maxManeuverTroops}
        onSetManeuverTroops={setManeuverTroops}
        onConfirmManeuver={confirmManeuver}
        onCancelManeuver={cancelManeuver}
        onSkipManeuver={skipManeuver}
        validationError={displayError}
      />

      {/* Territory Tooltip */}
      {hoveredTerritory && territoryStates[hoveredTerritory] && (
        <TerritoryTooltip
          territory={territoryStates[hoveredTerritory]}
          position={tooltipPosition}
        />
      )}

      {/* Game Log */}
      {status === 'active' && (
        <GameLog
          entries={gameLog}
          currentTurn={currentTurn}
          isCollapsed={isLogCollapsed}
          onToggleCollapse={() => setIsLogCollapsed(!isLogCollapsed)}
        />
      )}

      {/* Combat Modal */}
      {isCombatModalOpen && attackingTerritory && defendingTerritory && (
        <CombatModal
          isOpen={isCombatModalOpen}
          subPhase={subPhase}
          attackingTerritory={attackingTerritory}
          defendingTerritory={defendingTerritory}
          territoryStates={territoryStates}
          attackingPlayer={currentPlayer}
          defendingPlayer={defendingPlayer}
          attackerDiceCount={attackerDiceCount}
          defenderDiceCount={defenderDiceCount}
          availableDefenderDice={availableDefenderDice}
          combatResult={combatResult}
          conquestTroopsToMove={conquestTroopsToMove}
          conquestTroopRange={conquestTroopRange}
          onSelectDefenderDice={handleSelectDefenderDice}
          onResolveCombat={resolveCombatResult}
          onSetConquestTroops={setConquestTroops}
          onConfirmConquest={confirmConquest}
          onContinueAttack={handleContinueAttack}
          onCancel={cancelAttack}
        />
      )}

      {/* Faction Select Modal */}
      {isFactionSelectOpen && setupCurrentPlayer && (
        <FactionSelect
          isOpen={isFactionSelectOpen}
          currentPlayerId={setupCurrentPlayer.id}
          currentPlayerName={`Player ${setupTurnIndex + 1}`}
          takenFactions={takenFactions}
          onSelectFaction={handleSelectFaction}
        />
      )}

      {/* HQ Placement Modal */}
      {isHQPlacementOpen && setupCurrentPlayer && (
        <HQPlacement
          isOpen={isHQPlacementOpen}
          currentPlayer={setupCurrentPlayer}
          selectedTerritory={selectedTerritory}
          selectedTerritoryName={selectedTerritory ? territoryStates[selectedTerritory]?.name || null : null}
          isValidSelection={isValidHQSelection}
          startingTroops={getStartingTroopsForDisplay()}
          onConfirmPlacement={handlePlaceHQ}
          errorMessage={lastError && !lastError.valid ? lastError.errorMessage || null : null}
          placedHQs={placedHQs}
        />
      )}

      {/* Victory Modal */}
      {isVictoryModalOpen && winner && victoryResult && (
        <VictoryModal
          isOpen={isVictoryModalOpen}
          winner={winner}
          condition={victoryResult.condition!}
          players={players}
          territories={territoryStates}
          onContinue={dismissVictory}
        />
      )}
    </div>
  );
}

export default App;
