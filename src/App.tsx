import { useEffect, useCallback, useState, useRef } from 'react';
import { GameBoard } from './components/game/GameBoard';
import { TerritoryTooltip } from './components/game/TerritoryTooltip';
import { PlayerSidebar } from './components/game/PlayerSidebar';
import { ActionBar, ValidationError } from './components/game/ActionBar';
import { CombatModal } from './components/game/CombatModal';
import { TurnIndicatorOverlay } from './components/game/TurnIndicatorOverlay';
import { ManeuverAnimationEvent } from './components/game/territory-units/types';
import { FactionSelect } from './components/setup/FactionSelect';
import { HQPlacement } from './components/setup/HQPlacement';
import { VictoryModal } from './components/game/VictoryModal';
import { PostGameScreen } from './components/game/PostGameScreen';
import { SoundToggle } from './components/ui/SoundSettings';
import {
  CampaignBrowser,
  PlayerNamePrompt,
  LobbyScreen,
} from './components/lobby';
import { useSocket } from './hooks/useSocket';
import { useSetupPhaseActions } from './hooks/useSetupPhaseActions';
import { territories } from './data/territories';
import { TerritoryState, TerritoryId, ScarType, CityTier } from './types/territory';
import { Player } from './types/player';
import { FactionId } from './types/game';
import { useGameStore } from './store/gameStore';
import { useLobbyStore } from './store/lobbyStore';

declare global {
  interface Window {
    __RISK_LEGACY_E2E__?: {
      declareVictory: (winnerId: string, winCondition: 'stars' | 'elimination' | 'domination') => void;
      getGameState: () => ReturnType<typeof useGameStore.getState>;
    };
  }
}

// Helper to create players from multiplayer lobby
function createPlayersFromLobby(
  gameId: string,
  lobbyPlayers: Array<{ id: string; name: string; socketId: string; seatIndex: number }>,
  localSocketId: string | null
): { players: Player[]; localPlayerId: string | null } {
  let localPlayerId: string | null = null;

  const players = lobbyPlayers.map((lobbyPlayer) => {
    if (lobbyPlayer.socketId === localSocketId) {
      localPlayerId = lobbyPlayer.id;
    }

    return {
      id: lobbyPlayer.id,
      name: lobbyPlayer.name,
      gameId,
      userId: lobbyPlayer.socketId,
      seatIndex: lobbyPlayer.seatIndex,
      factionId: '' as FactionId,
      activePower: '',
      color: '#888888',
      hqTerritory: '',
      redStars: 0,
      missiles: 0,
      cards: [],
      isEliminated: false,
      conqueredThisTurn: false,
    };
  });

  return { players, localPlayerId };
}

// Create empty territory states for setup phase (no owners yet)
function createEmptyTerritoryStates(): Record<TerritoryId, TerritoryState> {
  const states: Record<TerritoryId, TerritoryState> = {};

  territories.forEach((territory) => {
    states[territory.id] = {
      id: territory.id,
      name: territory.name,
      continentId: territory.continentId,
      neighbors: territory.neighbors,
      ownerId: null, // No owner during setup
      troopCount: 0,
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
  // Initialize socket connection
  const {
    completePostGame,
    declareVictory,
    sendGameAction,
    createCampaign,
    deleteCampaign,
    refreshCampaigns,
    joinLobby,
    getCampaignHistory,
    getCampaignParticipants,
    leaveLobby,
    setReady,
    transferHost,
    kickPlayer,
    startGame,
    rejoinGame,
    claimSeat,
  } = useSocket();

  // Lobby store state
  const {
    currentLobby,
    gameStarted,
    initialGameState,
    socketId,
    isResuming,
    postGameWinner,
    resetGameState: resetLobbyGameState,
    localPlayerOdId: lobbyLocalPlayerOdId,
  } = useLobbyStore();

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
    missileWindowEndsAt,
    combatResult,
    conquestTroopsToMove,
    lastError,
    syncFromServer,
    setSelectedTerritory,
    setHoveredTerritory,
    setConquestTroops,
    cancelAttack,
    maneuverSourceTerritory,
    maneuverTargetTerritory,
    currentManeuverPath,
    maneuverTroopsToMove,
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
    getTakenFactions,
    getSetupCurrentPlayer,
    getLegalHQTerritories,
    getPlacedHQs,
    victoryResult,
    getWinner,
    dismissVictory,
    status,
    gameLog,
    localPlayerOdId,
    isLocalPlayerTurn,
    isLocalPlayerSetupTurn,
    setLocalPlayerOdId,
    getLocalPlayer,
  } = useGameStore();

  // Local state for campaign name (from multiplayer)
  const [campaignName, setCampaignName] = useState('');

  // Local state for tooltip position (UI-only, doesn't need to be in store)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Local state for validation error display with auto-clear
  const [displayError, setDisplayError] = useState<ValidationError | null>(null);

  // Local state for game log collapse
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);

  // Track turn changes for turn indicator overlay
  const [showTurnIndicator, setShowTurnIndicator] = useState(false);
  const prevTurnRef = useRef<{ turn: number; playerId: string | null }>({ turn: 0, playerId: null });
  const [pendingManeuverTroops, setPendingManeuverTroops] = useState(1);
  const [maneuverAnimation, setManeuverAnimation] = useState<ManeuverAnimationEvent | null>(null);

  // Handle game start from multiplayer lobby
  useEffect(() => {
    if (isResuming) {
      // Skip setup initialization - server state will be applied via game:fullState
      // But do set the local player odId if we have one
      if (lobbyLocalPlayerOdId) {
        setLocalPlayerOdId(lobbyLocalPlayerOdId);
      }
      return;
    }

    if (gameStarted && initialGameState) {
      const { players: gamePlayers, localPlayerId } = createPlayersFromLobby(
        initialGameState.gameId,
        initialGameState.players,
        socketId
      );

      setCampaignName(initialGameState.campaignName);

      // Store local player ID for identifying whose turn it is
      // For now, we'll use the first player as active
      const firstPlayerId = gamePlayers[0]?.id || null;

      syncFromServer({
        gameId: initialGameState.gameId,
        status: 'setup',
        currentTurn: 0,
        activePlayerId: firstPlayerId,
        phase: 'SETUP',
        subPhase: 'FACTION_SELECTION',
        territories: createEmptyTerritoryStates(),
        players: gamePlayers,
        troopsToPlace: 0,
        pendingDeployments: {},
      });

      // Set the local player's persistent identity (odId) if we have one from the lobby
      if (lobbyLocalPlayerOdId) {
        setLocalPlayerOdId(lobbyLocalPlayerOdId);
        console.log('Game started! Local player odId:', lobbyLocalPlayerOdId);
      } else {
        console.log('Game started! Local player ID:', localPlayerId);
      }
    }
  }, [gameStarted, initialGameState, socketId, syncFromServer, isResuming, lobbyLocalPlayerOdId, setLocalPlayerOdId]);

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

  useEffect(() => {
    if (!localPlayerOdId && lobbyLocalPlayerOdId) {
      setLocalPlayerOdId(lobbyLocalPlayerOdId);
    }
  }, [localPlayerOdId, lobbyLocalPlayerOdId, setLocalPlayerOdId]);

  // Get turn enforcement data
  const isMyTurn = isLocalPlayerTurn();
  const isMySetupTurn = isLocalPlayerSetupTurn();

  // Detect turn changes and show turn indicator
  useEffect(() => {
    const prev = prevTurnRef.current;
    // Show indicator when turn changes or active player changes (and game is active)
    if (
      isMyTurn &&
      status === 'active' &&
      phase === 'RECRUIT' &&
      subPhase === 'PLACE_TROOPS' &&
      (currentTurn !== prev.turn || activePlayerId !== prev.playerId) &&
      currentTurn > 0
    ) {
      setShowTurnIndicator(true);
    }
    prevTurnRef.current = { turn: currentTurn, playerId: activePlayerId };
  }, [currentTurn, activePlayerId, status, phase, subPhase, isMyTurn]);

  // Get current player (active player for hotseat)
  const activePlayer = players.find((p) => p.id === activePlayerId) || players[0] || null;
  const localPlayer =
    getLocalPlayer() ||
    (lobbyLocalPlayerOdId
      ? players.find((p) => p.userId === lobbyLocalPlayerOdId || p.id === lobbyLocalPlayerOdId) || null
      : null);

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

  // Keep maneuver troop slider value local until confirm action
  useEffect(() => {
    if (phase === 'MANEUVER' && subPhase === 'SET_MANEUVER_TROOPS') {
      const nextTroops = maneuverTroopsToMove ?? 1;
      setPendingManeuverTroops(nextTroops);
      return;
    }
    setPendingManeuverTroops(1);
  }, [phase, subPhase, maneuverTroopsToMove]);

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

  // Determine if combat modal should be open (now includes ATTACKER_DICE)
  const isCombatModalOpen =
    phase === 'ATTACK' &&
    attackingTerritory !== null &&
    defendingTerritory !== null &&
    (subPhase === 'ATTACKER_DICE' || subPhase === 'DEFENDER_DICE' || subPhase === 'MISSILE_WINDOW' || subPhase === 'RESOLVE' || subPhase === 'TROOP_MOVE');

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
        if (!isMyTurn) return;
        setSelectedTerritory(territoryId);
        sendGameAction('selectAttackSource', { territoryId });
        return;
      }
      if (subPhase === 'SELECT_ATTACK') {
        if (!isMyTurn) return;
        sendGameAction('selectAttackTarget', { territoryId });
        return;
      }
    }

    // During maneuver phase, handle source/target selection
    if (phase === 'MANEUVER') {
      if (subPhase === 'SELECT_MANEUVER_SOURCE' || subPhase === null) {
        if (!isMyTurn) return;
        sendGameAction('selectManeuverSource', { territoryId });
        return;
      }
      if (subPhase === 'SELECT_MANEUVER_TARGET') {
        if (!isMyTurn) return;
        sendGameAction('selectManeuverTarget', { territoryId });
        return;
      }
    }

    // Default behavior: toggle selection
    setSelectedTerritory(selectedTerritory === territoryId ? null : territoryId);
  }, [phase, subPhase, selectedTerritory, isMyTurn, setSelectedTerritory, sendGameAction]);

  const handleTerritoryHover = useCallback((territoryId: TerritoryId | null, mousePosition?: { x: number; y: number }) => {
    setHoveredTerritory(territoryId);
    if (mousePosition) {
      setTooltipPosition(mousePosition);
    }
  }, [setHoveredTerritory]);

  // Add a troop to the selected territory's pending deployments
  const handleAddTroop = useCallback((territoryId: TerritoryId) => {
    if (!isMyTurn || phase !== 'RECRUIT' || subPhase !== 'PLACE_TROOPS') return;
    sendGameAction('addTroop', { territoryId });
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  // Remove a troop from the selected territory's pending deployments
  const handleRemoveTroop = useCallback((territoryId: TerritoryId) => {
    if (!isMyTurn || phase !== 'RECRUIT' || subPhase !== 'PLACE_TROOPS') return;
    sendGameAction('removeTroop', { territoryId });
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  // Confirm deployment: apply pending deployments to territory states
  const handleConfirmDeployment = useCallback(() => {
    if (!isMyTurn || phase !== 'RECRUIT' || subPhase !== 'PLACE_TROOPS') return;
    sendGameAction('confirmDeployment', {});
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  // Select attacker dice count
  const handleSelectDice = useCallback((diceCount: number) => {
    if (!isMyTurn || phase !== 'ATTACK' || subPhase !== 'ATTACKER_DICE') return;
    sendGameAction('selectAttackerDice', { diceCount });
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  // Select defender dice count
  const handleSelectDefenderDice = useCallback((diceCount: number) => {
    if (phase !== 'ATTACK' || subPhase !== 'DEFENDER_DICE') return;
    sendGameAction('selectDefenderDice', { diceCount });
  }, [phase, subPhase, sendGameAction]);

  const handleResolveCombat = useCallback(() => {
    if (phase !== 'ATTACK' || subPhase !== 'RESOLVE') return;
    sendGameAction('resolveCombat', {});
  }, [phase, subPhase, sendGameAction]);

  const handleAttackAgain = useCallback(() => {
    if (!isMyTurn || phase !== 'ATTACK' || subPhase !== 'RESOLVE') return;
    sendGameAction('attackAgain', {});
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  const handleSelectNewTarget = useCallback(() => {
    if (!isMyTurn || phase !== 'ATTACK' || subPhase !== 'RESOLVE') return;
    sendGameAction('selectNewTarget', {});
  }, [isMyTurn, phase, subPhase, sendGameAction]);

  const handleUseMissile = useCallback((side: 'attacker' | 'defender', dieIndex: number) => {
    if (phase !== 'ATTACK' || (subPhase !== 'MISSILE_WINDOW' && subPhase !== 'RESOLVE')) return;
    sendGameAction('useMissile', { side, dieIndex });
  }, [phase, subPhase, sendGameAction]);

  const handleConfirmConquest = useCallback(() => {
    if (phase !== 'ATTACK' || subPhase !== 'TROOP_MOVE') return;
    const troopsToMove = conquestTroopsToMove ?? conquestTroopRange.min;
    if (!Number.isInteger(troopsToMove)) return;
    sendGameAction('confirmConquest', { troops: troopsToMove });
  }, [phase, subPhase, conquestTroopsToMove, conquestTroopRange.min, sendGameAction]);

  const handleEndAttackPhase = useCallback(() => {
    if (!isMyTurn || phase !== 'ATTACK') return;
    sendGameAction('endAttackPhase', {});
  }, [isMyTurn, phase, sendGameAction]);

  const handleConfirmManeuver = useCallback(() => {
    if (!isMyTurn || phase !== 'MANEUVER' || subPhase !== 'SET_MANEUVER_TROOPS') return;

    if (maneuverSourceTerritory && maneuverTargetTerritory && currentManeuverPath && currentManeuverPath.length >= 2) {
      const sourceOwnerId = territoryStates[maneuverSourceTerritory]?.ownerId;
      const sourceOwner = sourceOwnerId ? players.find((player) => player.id === sourceOwnerId) : null;

      setManeuverAnimation({
        factionId: sourceOwner?.factionId ?? null,
        sourceTerritoryId: maneuverSourceTerritory,
        targetTerritoryId: maneuverTargetTerritory,
        path: [...currentManeuverPath],
        troopsMoved: pendingManeuverTroops,
        timestamp: Date.now(),
      });
    }

    sendGameAction('confirmManeuver', { troops: pendingManeuverTroops });
  }, [
    isMyTurn,
    phase,
    subPhase,
    pendingManeuverTroops,
    sendGameAction,
    maneuverSourceTerritory,
    maneuverTargetTerritory,
    currentManeuverPath,
    territoryStates,
    players,
  ]);

  const handleSkipManeuver = useCallback(() => {
    if (!isMyTurn || phase !== 'MANEUVER') return;
    sendGameAction('skipManeuver', {});
  }, [isMyTurn, phase, sendGameAction]);

  const handleCancelManeuver = useCallback(() => {
    if (!isMyTurn || phase !== 'MANEUVER') return;
    sendGameAction('cancelManeuver', {});
  }, [isMyTurn, phase, sendGameAction]);

  const handleReturnToAttackPhase = useCallback(() => {
    if (!isMyTurn || phase !== 'MANEUVER') return;
    sendGameAction('returnToAttackPhase', {});
  }, [isMyTurn, phase, sendGameAction]);


  const {
    handleSelectFaction,
    handlePlaceHQ,
    getStartingTroopsForDisplay,
  } = useSetupPhaseActions({
    setupCurrentPlayer,
    selectedTerritory,
    isMySetupTurn,
    isValidHQSelection,
    setSelectedTerritory,
    sendGameAction,
  });

  // Handle going back to the campaign menu
  const handleBackToMenu = useCallback(() => {
    // Reset lobby and game state
    resetLobbyGameState();
    // Reset game store to initial state
    syncFromServer({
      gameId: null,
      status: 'idle',
      currentTurn: 0,
      activePlayerId: null,
      phase: null,
      subPhase: null,
      territories: {},
      players: [],
      troopsToPlace: 0,
      pendingDeployments: {},
    });
    setCampaignName('');
  }, [resetLobbyGameState, syncFromServer]);

  // Handle post-game completion (winner confirmed their rewards)
  const handlePostGameComplete = useCallback((
    scarsPlaced: Array<{ territoryId: string; scarType: ScarType }>,
    citiesBuilt: Array<{ territoryId: string; cityTier: CityTier; cityName: string | null }>
  ) => {
    completePostGame(scarsPlaced, citiesBuilt);
  }, [completePostGame]);

  useEffect(() => {
    const isE2EEnabled =
      Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV) ||
      (typeof window !== 'undefined' && window.location.search.includes('e2e=1'));

    if (!isE2EEnabled) {
      return;
    }

    window.__RISK_LEGACY_E2E__ = {
      declareVictory,
      getGameState: () => useGameStore.getState(),
    };

    return () => {
      delete window.__RISK_LEGACY_E2E__;
    };
  }, [declareVictory]);

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

  // Clear stale selection when entering deploy if selected territory isn't currently deployable
  useEffect(() => {
    if (phase !== 'RECRUIT' || subPhase !== 'PLACE_TROOPS') return;
    if (!selectedTerritory || !effectiveSelectableTerritories) return;
    if (!effectiveSelectableTerritories.includes(selectedTerritory)) {
      setSelectedTerritory(null);
    }
  }, [phase, subPhase, selectedTerritory, effectiveSelectableTerritories, setSelectedTerritory]);

  // Show campaign browser when not in a lobby and game hasn't started
  if (!currentLobby && !gameStarted) {
    return (
      <>
        <CampaignBrowser
          createCampaign={createCampaign}
          deleteCampaign={deleteCampaign}
          refreshCampaigns={refreshCampaigns}
          joinLobby={joinLobby}
          getCampaignHistory={getCampaignHistory}
          getCampaignParticipants={getCampaignParticipants}
        />
        <PlayerNamePrompt
          joinLobby={joinLobby}
          getCampaignParticipants={getCampaignParticipants}
        />
      </>
    );
  }

  // Show lobby screen when in a lobby but game hasn't started
  if (currentLobby && !gameStarted) {
    return (
      <>
        <LobbyScreen
          leaveLobby={leaveLobby}
          setReady={setReady}
          transferHost={transferHost}
          kickPlayer={kickPlayer}
          startGame={startGame}
          rejoinGame={rejoinGame}
          claimSeat={claimSeat}
        />
        <PlayerNamePrompt
          joinLobby={joinLobby}
          getCampaignParticipants={getCampaignParticipants}
        />
      </>
    );
  }

  // Don't render game until store is initialized
  if (!activePlayer || !localPlayer || Object.keys(territoryStates).length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-board-wood">
        <div className="text-board-parchment font-display text-2xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-board-wood">
      {/* Header */}
      <header className="h-14 bg-board-border flex items-center justify-between px-4 border-b-2 border-board-wood">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToMenu}
            className="flex items-center gap-1 px-3 py-1.5 bg-board-dark text-board-parchment/80 font-body text-sm rounded border border-board-wood hover:bg-board-wood hover:text-board-parchment transition-colors"
            title="Back to Campaign Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Menu
          </button>
          <h1 className="text-board-parchment font-display text-xl font-bold">
            Risk Legacy
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {hoveredTerritory && (
            <span className="text-board-parchment font-body">
              {territories.find((t) => t.id === hoveredTerritory)?.name}
            </span>
          )}
          <span className="text-board-parchment/60 font-body text-sm">
            Campaign: &quot;{campaignName}&quot;
          </span>
          <SoundToggle />
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player Sidebar */}
        <PlayerSidebar
          localPlayer={localPlayer}
          players={players}
          activePlayerId={activePlayerId || ''}
          currentTurn={currentTurn}
          phase={phase || 'SETUP'}
          subPhase={subPhase}
          territories={territoryStates}
          troopsRemaining={troopsRemaining}
          gameLog={gameLog}
          isLogCollapsed={isLogCollapsed}
          onToggleLogCollapse={() => setIsLogCollapsed(!isLogCollapsed)}
          isLocalPlayerTurn={isMyTurn}
          activePlayerName={activePlayer?.name}
        />

        {/* Main game area */}
        <main className="flex-1 p-4 overflow-hidden relative">
          <div className="w-full h-full rounded-lg overflow-hidden border-4 border-board-border shadow-2xl relative">
            <GameBoard
              territoryStates={territoryStates}
              players={players}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryHover={handleTerritoryHover}
              selectedTerritory={selectedTerritory}
              highlightedTerritories={highlightedTerritories}
              selectableTerritories={effectiveSelectableTerritories}
              pendingDeployments={pendingDeployments}
              showTroopControls={isMyTurn && phase === 'RECRUIT' && subPhase === 'PLACE_TROOPS'}
              troopsRemaining={troopsRemaining}
              onAddTroop={handleAddTroop}
              onRemoveTroop={handleRemoveTroop}
              currentManeuverPath={currentManeuverPath}
              maneuverAnimation={maneuverAnimation}
            />

            {/* Turn Change Indicator */}
            {activePlayer && (
              <TurnIndicatorOverlay
                player={activePlayer}
                turn={currentTurn}
                isVisible={showTurnIndicator}
                onDismiss={() => setShowTurnIndicator(false)}
              />
            )}
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
        onEndAttackPhase={handleEndAttackPhase}
        maneuverSourceTerritory={maneuverSourceTerritory}
        maneuverTargetTerritory={maneuverTargetTerritory}
        currentManeuverPath={currentManeuverPath}
        maneuverTroopsToMove={pendingManeuverTroops}
        maxManeuverTroops={maxManeuverTroops}
        onSetManeuverTroops={setPendingManeuverTroops}
        onConfirmManeuver={handleConfirmManeuver}
        onCancelManeuver={handleCancelManeuver}
        onSkipManeuver={handleSkipManeuver}
        onBackToAttack={handleReturnToAttackPhase}
        validationError={displayError}
        isLocalPlayerTurn={isMyTurn}
        activePlayerName={activePlayer?.name}
      />

      {/* Territory Tooltip */}
      {hoveredTerritory && territoryStates[hoveredTerritory] && (
        <TerritoryTooltip
          territory={territoryStates[hoveredTerritory]}
          position={tooltipPosition}
          ownerName={
            territoryStates[hoveredTerritory].ownerId
              ? players.find((p) => p.id === territoryStates[hoveredTerritory].ownerId)?.name
              : undefined
          }
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
          attackingPlayer={activePlayer}
          defendingPlayer={defendingPlayer}
          attackerDiceCount={attackerDiceCount}
          defenderDiceCount={defenderDiceCount}
          missileWindowEndsAt={missileWindowEndsAt}
          availableAttackerDice={availableDice}
          availableDefenderDice={availableDefenderDice}
          combatResult={combatResult}
          conquestTroopsToMove={conquestTroopsToMove}
          conquestTroopRange={conquestTroopRange}
          onSelectAttackerDice={handleSelectDice}
          onSelectDefenderDice={handleSelectDefenderDice}
          onUseMissile={handleUseMissile}
          onResolveCombat={handleResolveCombat}
          onSetConquestTroops={setConquestTroops}
          onConfirmConquest={handleConfirmConquest}
          onAttackAgain={handleAttackAgain}
          onSelectNewTarget={handleSelectNewTarget}
          onEndAttacks={handleEndAttackPhase}
          onCancel={cancelAttack}
          localPlayerOdId={localPlayerOdId}
          localPlayerMissiles={localPlayer.missiles}
        />
      )}

      {/* Faction Select Modal */}
      {isFactionSelectOpen && setupCurrentPlayer && (
        <FactionSelect
          isOpen={isFactionSelectOpen}
          currentPlayerId={setupCurrentPlayer.id}
          currentPlayerName={setupCurrentPlayer.name}
          takenFactions={takenFactions}
          onSelectFaction={handleSelectFaction}
          isLocalPlayerTurn={isMySetupTurn}
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
          isLocalPlayerTurn={isMySetupTurn}
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
          onContinue={() => {
            // Map client VictoryCondition to server win condition type
            const conditionMap: Record<string, 'stars' | 'elimination' | 'domination'> = {
              'RED_STARS': 'stars',
              'LAST_STANDING': 'elimination',
              'ELIMINATION': 'elimination',
            };
            const winCondition = conditionMap[victoryResult.condition!] || 'stars';

            // Notify server of victory to transition to post-game phase
            declareVictory(winner.id, winCondition);
            // Dismiss the local victory modal
            dismissVictory();
          }}
        />
      )}

      {/* Post-Game Screen (Write Phase) */}
      {postGameWinner && (
        <PostGameScreen
          winnerId={postGameWinner.winnerId}
          winnerName={postGameWinner.winnerName}
          onComplete={handlePostGameComplete}
        />
      )}
    </div>
  );
}

export default App;
