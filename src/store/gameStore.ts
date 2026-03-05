import { create } from 'zustand';
import { TerritoryId, TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';
import { GamePhase, SubPhase, FactionId } from '@/types/game';
import { factionsById } from '@/data/factions';
import {
  validateAddTroop,
  validateRemoveTroop,
  validateConfirmDeployment,
  ValidationResult,
} from '@/utils/deploymentValidation';
import {
  validateSelectAttackSource,
  validateSelectAttackTarget,
  validateSelectAttackerDice,
  getAttackableTerritories,
  getValidAttackTargets,
  getMaxAttackerDice,
  getAvailableAttackerDice,
  AttackValidationResult,
} from '@/utils/attackValidation';
import {
  CombatResult,
  rollDice,
  applyModifiers,
  resolveCombat,
  checkSupremeFirepower,
  getMaxDefenderDice,
  getAvailableDefenderDice,
  getConquestTroopRange,
  validateSelectDefenderDice,
  DefenderDiceValidationResult,
} from '@/utils/combatResolution';
import {
  validateSelectManeuverSource,
  validateSelectManeuverTarget,
  getManeuverableTerritories,
  getValidManeuverTargets,
  findPath,
  getMaxManeuverTroops,
  ManeuverValidationResult,
} from '@/utils/maneuverValidation';
import {
  validateHQPlacement,
  getLegalHQTerritories as getValidHQTerritories,
  getStartingTroops,
  HQValidationResult,
} from '@/utils/hqValidation';
import { continents } from '@/data/continents';
import {
  checkVictory,
  VictoryResult,
} from '@/utils/victoryDetection';
import { GameLogEntry, createLogEntryId } from '@/types/gameLog';

/**
 * Deployment history entry for tracking troop placements
 */
export interface DeploymentEntry {
  territoryId: TerritoryId;
  count: number;
}

/**
 * Game store state interface matching spec section 16
 */
export interface GameStoreState {
  // Game metadata
  gameId: string | null;
  campaignId: string | null;
  gameNumber: number;
  status: 'idle' | 'lobby' | 'setup' | 'active' | 'post_game' | 'finished';

  // Server sync
  serverVersion: number;
  isSyncing: boolean;
  lastSyncError: string | null;

  // Local player identity (persistent across reconnections)
  localPlayerOdId: string | null;

  // Turn state
  currentTurn: number;
  activePlayerId: string | null;
  phase: GamePhase | null;
  subPhase: SubPhase;

  // Map state
  territories: Record<TerritoryId, TerritoryState>;

  // Players
  players: Player[];

  // Reinforcement phase state
  troopsToPlace: number;
  pendingDeployments: Record<TerritoryId, number>;

  // Attack phase state
  attackingTerritory: TerritoryId | null;
  defendingTerritory: TerritoryId | null;
  attackerDiceCount: number | null;
  defenderDiceCount: number | null;
  missileWindowEndsAt: number | null;

  // Combat state
  combatResult: CombatResult | null;
  attackerRawRolls: number[] | null;
  defenderRawRolls: number[] | null;
  conquestTroopsToMove: number | null;
  isFirstAttackOfTurn: boolean;

  // Maneuver phase state
  maneuverSourceTerritory: TerritoryId | null;
  maneuverTargetTerritory: TerritoryId | null;
  maneuverTroopsToMove: number | null;
  currentManeuverPath: TerritoryId[] | null;

  // Setup phase state
  setupTurnIndex: number; // Which player is currently selecting (0-indexed)

  // Victory state
  victoryResult: VictoryResult | null;
  winnerId: string | null;

  // Game log state
  gameLog: GameLogEntry[];

  // UI state
  selectedTerritory: TerritoryId | null;
  hoveredTerritory: TerritoryId | null;

  // Validation error
  lastError: ValidationResult | AttackValidationResult | HQValidationResult | null;
}

/**
 * Game store actions interface
 */
/**
 * Persisted game state from server (for sync)
 */
export interface PersistedGameState {
  gameId: string;
  campaignId: string;
  gameNumber: number;
  status: 'setup' | 'active' | 'post_game' | 'finished';
  currentTurn: number;
  activePlayerId: string | null;
  phase: GamePhase;
  subPhase: SubPhase;
  territories: Record<TerritoryId, TerritoryState>;
  players: Player[];
  troopsToPlace: number;
  pendingDeployments: Record<TerritoryId, number>;
  attackingTerritory: TerritoryId | null;
  defendingTerritory: TerritoryId | null;
  attackerDiceCount: number | null;
  defenderDiceCount: number | null;
  missileWindowEndsAt: number | null;
  combatResult: CombatResult | null;
  conquestTroopsToMove: number | null;
  maneuverSourceTerritory: TerritoryId | null;
  maneuverTargetTerritory: TerritoryId | null;
  maneuverTroopsToMove: number | null;
  currentManeuverPath: TerritoryId[] | null;
  isFirstAttackOfTurn: boolean;
  setupTurnIndex: number;
  lastUpdatedAt: number;
  version: number;
  winnerId?: string | null;
}

export interface SetupTurnEvent {
  setupTurnIndex: number;
  currentSetupPlayerId: string | null;
  currentSetupPlayerName: string | null;
  subPhase: SubPhase;
  version: number;
}

export interface GameStoreActions {
  // State sync
  syncFromServer: (state: Partial<GameStoreState>) => void;
  applyServerState: (state: PersistedGameState) => void;
  applyServerPatch: (patch: Partial<PersistedGameState>, version: number) => void;
  applySetupTurn: (setupTurn: SetupTurnEvent) => void;
  setSyncing: (isSyncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  getClientVersion: () => number;

  // Local player identity
  setLocalPlayerOdId: (odId: string | null) => void;
  isLocalPlayerTurn: () => boolean;
  getLocalPlayer: () => Player | null;
  isLocalPlayerSetupTurn: () => boolean;

  // Territory selection
  setSelectedTerritory: (territoryId: TerritoryId | null) => void;
  setHoveredTerritory: (territoryId: TerritoryId | null) => void;

  // Reinforcement phase actions
  addTroop: (territoryId: TerritoryId) => ValidationResult;
  removeTroop: (territoryId: TerritoryId) => ValidationResult;
  confirmDeployment: () => ValidationResult;

  // Attack phase actions
  selectAttackSource: (territoryId: TerritoryId) => AttackValidationResult;
  selectAttackTarget: (territoryId: TerritoryId) => AttackValidationResult;
  selectAttackerDice: (diceCount: number) => AttackValidationResult;
  selectDefenderDice: (diceCount: number) => DefenderDiceValidationResult;
  rollCombatDice: () => void;
  resolveCombatResult: () => void;
  setConquestTroops: (troops: number) => void;
  confirmConquest: () => void;
  cancelAttack: () => void;
  endAttackPhase: () => void;
  attackAgain: () => void;
  selectNewTarget: () => void;

  // Maneuver phase actions
  selectManeuverSource: (territoryId: TerritoryId) => ManeuverValidationResult;
  selectManeuverTarget: (territoryId: TerritoryId) => ManeuverValidationResult;
  setManeuverTroops: (troops: number) => void;
  confirmManeuver: () => void;
  cancelManeuver: () => void;
  skipManeuver: () => void;
  returnToAttackPhase: () => void;

  // Turn management
  endTurn: () => void;

  // Attack phase selectors
  getMaxAttackerDice: () => number;
  getAvailableAttackerDice: () => number[];
  getMaxDefenderDice: () => number;
  getAvailableDefenderDice: () => number[];
  getConquestTroopRange: () => { min: number; max: number };
  getDefendingPlayer: () => Player | null;

  // Selectors
  getCurrentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getPlayerTerritories: (playerId: string) => TerritoryId[];
  getTroopsRemaining: () => number;
  getSelectableTerritories: () => TerritoryId[] | undefined;
  getAttackableTerritories: () => TerritoryId[];
  getValidAttackTargets: () => TerritoryId[];

  // Maneuver phase selectors
  getManeuverableTerritories: () => TerritoryId[];
  getValidManeuverTargets: () => TerritoryId[];
  getCurrentManeuverPath: () => TerritoryId[] | null;
  getMaxManeuverTroops: () => number;

  // Setup phase actions
  selectFaction: (playerId: string, factionId: FactionId, powerId: string) => void;
  getTakenFactions: () => FactionId[];
  getSetupCurrentPlayer: () => Player | null;
  placeHQ: (playerId: string, territoryId: TerritoryId) => void;
  getLegalHQTerritories: (playerId: string) => TerritoryId[];
  getPlacedHQs: () => Array<{ playerName: string; factionId: string; territoryName: string }>;

  // Victory actions
  checkForVictory: () => VictoryResult;
  getWinner: () => Player | null;
  dismissVictory: () => void;

  // Game log actions
  addLogEntry: (entry: Omit<GameLogEntry, 'id' | 'timestamp' | 'turn'>) => void;
  clearLog: () => void;

  // Error handling
  clearError: () => void;
}

export type GameStore = GameStoreState & GameStoreActions;

/**
 * Create the game store with Zustand
 */
export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameId: null,
  campaignId: null,
  gameNumber: 0,
  status: 'idle',
  serverVersion: 0,
  isSyncing: false,
  lastSyncError: null,
  localPlayerOdId: null,
  currentTurn: 0,
  activePlayerId: null,
  phase: null,
  subPhase: null,
  territories: {},
  players: [],
  troopsToPlace: 0,
  pendingDeployments: {},
  attackingTerritory: null,
  defendingTerritory: null,
  attackerDiceCount: null,
  defenderDiceCount: null,
  missileWindowEndsAt: null,
  combatResult: null,
  attackerRawRolls: null,
  defenderRawRolls: null,
  conquestTroopsToMove: null,
  isFirstAttackOfTurn: true,
  maneuverSourceTerritory: null,
  maneuverTargetTerritory: null,
  maneuverTroopsToMove: null,
  currentManeuverPath: null,
  setupTurnIndex: 0,
  victoryResult: null,
  winnerId: null,
  gameLog: [],
  selectedTerritory: null,
  hoveredTerritory: null,
  lastError: null,

  // Sync state from server (or initialize with mock data)
  syncFromServer: (newState) => {
    set((state) => ({
      ...state,
      ...newState,
      // Reset pending deployments and attack state when syncing new state
      pendingDeployments: {},
      attackingTerritory: null,
      defendingTerritory: null,
      attackerDiceCount: null,
      defenderDiceCount: null,
      missileWindowEndsAt: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      conquestTroopsToMove: null,
      isFirstAttackOfTurn: true,
      // Reset maneuver state
      maneuverSourceTerritory: null,
      maneuverTargetTerritory: null,
      maneuverTroopsToMove: null,
      currentManeuverPath: null,
    }));
  },

  // Apply full state from server (used on reconnect/refresh)
  applyServerState: (serverState) => {
    set({
      gameId: serverState.gameId,
      campaignId: serverState.campaignId,
      gameNumber: serverState.gameNumber,
      status: serverState.status,
      currentTurn: serverState.currentTurn,
      activePlayerId: serverState.activePlayerId,
      phase: serverState.phase,
      subPhase: serverState.subPhase,
      territories: serverState.territories,
      players: serverState.players,
      troopsToPlace: serverState.troopsToPlace,
      pendingDeployments: serverState.pendingDeployments,
      attackingTerritory: serverState.attackingTerritory,
      defendingTerritory: serverState.defendingTerritory,
      attackerDiceCount: serverState.attackerDiceCount,
      defenderDiceCount: serverState.defenderDiceCount,
      missileWindowEndsAt: serverState.missileWindowEndsAt,
      combatResult: serverState.combatResult,
      conquestTroopsToMove: serverState.conquestTroopsToMove,
      maneuverSourceTerritory: serverState.maneuverSourceTerritory,
      maneuverTargetTerritory: serverState.maneuverTargetTerritory,
      maneuverTroopsToMove: serverState.maneuverTroopsToMove,
      currentManeuverPath: serverState.currentManeuverPath,
      isFirstAttackOfTurn: serverState.isFirstAttackOfTurn,
      setupTurnIndex: serverState.setupTurnIndex,
      serverVersion: serverState.version,
      isSyncing: false,
      lastSyncError: null,
      // Reset UI-only state
      attackerRawRolls: null,
      defenderRawRolls: null,
      selectedTerritory: null,
      hoveredTerritory: null,
      lastError: null,
    });
  },

  // Apply incremental state update from server
  applyServerPatch: (patch, version) => {
    set((state) => {
      // Only apply if this is a newer version
      if (version <= state.serverVersion) {
        console.warn(`Ignoring stale patch (version ${version} <= ${state.serverVersion})`);
        return state;
      }

      return {
        ...state,
        ...patch,
        serverVersion: version,
        isSyncing: false,
      };
    });
  },

  // Apply setup turn context signal from server to keep setup UI deterministic.
  applySetupTurn: (setupTurn) => {
    set((state) => {
      if (state.phase !== 'SETUP' && state.status !== 'setup') {
        return state;
      }

      return {
        setupTurnIndex: setupTurn.setupTurnIndex,
        subPhase: setupTurn.subPhase,
        activePlayerId: setupTurn.currentSetupPlayerId,
        selectedTerritory: null,
        lastError: null,
      };
    });
  },

  // Set syncing state
  setSyncing: (isSyncing) => {
    set({ isSyncing });
  },

  // Set sync error
  setSyncError: (error) => {
    set({ lastSyncError: error, isSyncing: false });
  },

  // Get current client version for optimistic concurrency
  getClientVersion: () => {
    return get().serverVersion;
  },

  // Set local player identity
  setLocalPlayerOdId: (odId) => {
    set({ localPlayerOdId: odId });
  },

  // Check if it's the local player's turn
  isLocalPlayerTurn: () => {
    const state = get();
    const { localPlayerOdId, activePlayerId, players } = state;

    // Without a resolved local identity, never claim turn ownership.
    if (!localPlayerOdId) {
      return false;
    }

    // Find the local player by their odId (stored as userId)
    const localPlayer = players.find(
      (p) => p.userId === localPlayerOdId || p.id === localPlayerOdId
    );
    if (!localPlayer) {
      return false;
    }

    return localPlayer.id === activePlayerId;
  },

  // Get the local player object
  getLocalPlayer: () => {
    const state = get();
    const { localPlayerOdId, players } = state;

    // If no local player ID set, return null
    if (!localPlayerOdId) {
      return null;
    }

    // Find the local player by their odId (stored as userId)
    return players.find((p) => p.userId === localPlayerOdId || p.id === localPlayerOdId) || null;
  },

  // Check if it's the local player's turn during setup phase
  isLocalPlayerSetupTurn: () => {
    const state = get();
    const { localPlayerOdId, players, setupTurnIndex, status } = state;

    // Without a resolved local identity, never claim setup turn ownership.
    if (!localPlayerOdId) {
      return false;
    }

    // Only relevant during setup
    if (status !== 'setup') {
      return false;
    }

    // Find the local player by their odId
    const localPlayer = players.find(
      (p) => p.userId === localPlayerOdId || p.id === localPlayerOdId
    );
    if (!localPlayer) {
      return false;
    }

    // Check if the current setup index points to the local player
    const setupPlayer = players[setupTurnIndex];
    return setupPlayer?.id === localPlayer.id;
  },

  // Territory selection
  setSelectedTerritory: (territoryId) => {
    set({ selectedTerritory: territoryId });
  },

  setHoveredTerritory: (territoryId) => {
    set({ hoveredTerritory: territoryId });
  },

  // Get current player (the active player whose turn it is)
  getCurrentPlayer: () => {
    const state = get();
    // Return the active player for hotseat play
    return state.players.find((p) => p.id === state.activePlayerId) || state.players[0] || null;
  },

  // Check if it's the current player's turn (always true for hotseat)
  isMyTurn: () => {
    const state = get();
    return state.activePlayerId !== null;
  },

  // Get territories owned by a player
  getPlayerTerritories: (playerId) => {
    const state = get();
    return Object.values(state.territories)
      .filter((t) => t.ownerId === playerId)
      .map((t) => t.id);
  },

  // Get remaining troops to place
  getTroopsRemaining: () => {
    const state = get();
    const totalPending = Object.values(state.pendingDeployments).reduce(
      (sum, count) => sum + count,
      0
    );
    return state.troopsToPlace - totalPending;
  },

  // Get selectable territories based on current phase
  getSelectableTerritories: () => {
    const state = get();
    const currentPlayerId = state.activePlayerId;

    if (state.phase === 'RECRUIT' && state.subPhase === 'PLACE_TROOPS' && currentPlayerId) {
      return Object.values(state.territories)
        .filter((t) => t.ownerId === currentPlayerId)
        .map((t) => t.id);
    }

    // Attack phase: IDLE = select source, SELECT_ATTACK = select target
    const currentPlayer = state.players.find((p) => p.id === currentPlayerId) || null;
    if (state.phase === 'ATTACK' && currentPlayer) {
      if (state.subPhase === 'IDLE') {
        // Select attack source: player's territories with >= 2 troops
        return getAttackableTerritories(state.territories, currentPlayer.id);
      }
      if (state.subPhase === 'SELECT_ATTACK' && state.attackingTerritory) {
        // Select attack target: adjacent enemy territories
        return getValidAttackTargets(
          state.attackingTerritory,
          state.territories,
          currentPlayer.id
        );
      }
    }

    // Maneuver phase: SELECT_MANEUVER_SOURCE = select source, SELECT_MANEUVER_TARGET = select target
    if (state.phase === 'MANEUVER' && currentPlayer) {
      if (state.subPhase === 'SELECT_MANEUVER_SOURCE' || state.subPhase === null) {
        // Select maneuver source: player's territories with >= 2 troops
        return getManeuverableTerritories(state.territories, currentPlayer.id);
      }
      if (state.subPhase === 'SELECT_MANEUVER_TARGET' && state.maneuverSourceTerritory) {
        // Select maneuver target: owned territories reachable through owned territories
        return getValidManeuverTargets(
          state.maneuverSourceTerritory,
          state.territories,
          currentPlayer.id
        );
      }
    }

    // For other phases, all territories are selectable
    return undefined;
  },

  // Get territories that can attack (owned by current player, >= 2 troops)
  getAttackableTerritories: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer) return [];
    return getAttackableTerritories(state.territories, currentPlayer.id);
  },

  // Get valid attack targets for the currently selected attacking territory
  getValidAttackTargets: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer || !state.attackingTerritory) return [];
    return getValidAttackTargets(
      state.attackingTerritory,
      state.territories,
      currentPlayer.id
    );
  },

  // Add a troop to pending deployments
  addTroop: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: ValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'RECRUIT' && state.subPhase === 'PLACE_TROOPS';
    const troopsRemaining = state.troopsToPlace -
      Object.values(state.pendingDeployments).reduce((sum, count) => sum + count, 0);

    const validationResult = validateAddTroop({
      territoryId,
      territoryStates: state.territories,
      currentPlayerId: currentPlayer.id,
      troopsRemaining,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    set((prev) => ({
      pendingDeployments: {
        ...prev.pendingDeployments,
        [territoryId]: (prev.pendingDeployments[territoryId] || 0) + 1,
      },
      lastError: null,
    }));

    return { valid: true };
  },

  // Remove a troop from pending deployments
  removeTroop: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: ValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'RECRUIT' && state.subPhase === 'PLACE_TROOPS';

    const validationResult = validateRemoveTroop(
      territoryId,
      state.pendingDeployments,
      isPlayerTurn,
      isCorrectPhase
    );

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    set((prev) => {
      const current = prev.pendingDeployments[territoryId] || 0;
      const newCount = current - 1;

      if (newCount <= 0) {
        // Remove the key entirely
        const { [territoryId]: _, ...rest } = prev.pendingDeployments;
        return { pendingDeployments: rest, lastError: null };
      }

      return {
        pendingDeployments: {
          ...prev.pendingDeployments,
          [territoryId]: newCount,
        },
        lastError: null,
      };
    });

    return { valid: true };
  },

  // Confirm deployment: apply pending deployments to territory states
  confirmDeployment: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: ValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'RECRUIT' && state.subPhase === 'PLACE_TROOPS';
    const troopsRemaining = state.troopsToPlace -
      Object.values(state.pendingDeployments).reduce((sum, count) => sum + count, 0);

    const validationResult = validateConfirmDeployment(
      troopsRemaining,
      isPlayerTurn,
      isCorrectPhase
    );

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    // Apply pending deployments to territories
    set((prev) => {
      const updatedTerritories = { ...prev.territories };

      Object.entries(prev.pendingDeployments).forEach(([tid, count]) => {
        const territoryId = tid as TerritoryId;
        if (updatedTerritories[territoryId]) {
          updatedTerritories[territoryId] = {
            ...updatedTerritories[territoryId],
            troopCount: updatedTerritories[territoryId].troopCount + count,
          };
        }
      });

      return {
        territories: updatedTerritories,
        pendingDeployments: {},
        troopsToPlace: 0,
        // Transition to ATTACK phase
        phase: 'ATTACK' as GamePhase,
        subPhase: 'IDLE' as SubPhase,
        lastError: null,
      };
    });

    return { valid: true };
  },

  // Select a territory to attack from
  selectAttackSource: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: AttackValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'ATTACK' && state.subPhase === 'IDLE';

    const validationResult = validateSelectAttackSource({
      territoryId,
      territoryStates: state.territories,
      currentPlayerId: currentPlayer.id,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    // Set attacking territory and transition to SELECT_ATTACK subphase
    set({
      attackingTerritory: territoryId,
      defendingTerritory: null,
      selectedTerritory: territoryId,
      subPhase: 'SELECT_ATTACK' as SubPhase,
      lastError: null,
    });

    return { valid: true };
  },

  // Select a territory to attack
  selectAttackTarget: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: AttackValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    if (!state.attackingTerritory) {
      const result: AttackValidationResult = {
        valid: false,
        errorCode: 'INVALID_PHASE',
        errorMessage: 'Select an attacking territory first',
      };
      set({ lastError: result });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'ATTACK' && state.subPhase === 'SELECT_ATTACK';

    const validationResult = validateSelectAttackTarget({
      sourceId: state.attackingTerritory,
      targetId: territoryId,
      territoryStates: state.territories,
      currentPlayerId: currentPlayer.id,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    // Check if territory is unoccupied (no defender, no troops)
    const targetTerritory = state.territories[territoryId];
    const isUnoccupied = targetTerritory && targetTerritory.troopCount === 0;

    if (isUnoccupied) {
      // Unoccupied territory - automatic capture, skip dice selection
      // Go directly to TROOP_MOVE phase with min=1 troop to move
      set({
        defendingTerritory: territoryId,
        attackerDiceCount: 1, // Set to 1 so conquest troop range has min=1
        defenderDiceCount: 0,
        subPhase: 'TROOP_MOVE' as SubPhase,
        conquestTroopsToMove: 1, // Default to minimum
        lastError: null,
      });
    } else {
      // Occupied territory - proceed with normal combat
      set({
        defendingTerritory: territoryId,
        subPhase: 'ATTACKER_DICE' as SubPhase,
        lastError: null,
      });
    }

    return { valid: true };
  },

  // Select attacker dice count
  selectAttackerDice: (diceCount) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: AttackValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result });
      return result;
    }

    if (!state.attackingTerritory) {
      const result: AttackValidationResult = {
        valid: false,
        errorCode: 'INVALID_PHASE',
        errorMessage: 'Select an attacking territory first',
      };
      set({ lastError: result });
      return result;
    }

    const attackingTroops = state.territories[state.attackingTerritory]?.troopCount || 0;
    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'ATTACK' && state.subPhase === 'ATTACKER_DICE';

    const validationResult = validateSelectAttackerDice({
      diceCount,
      attackingTroops,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult });
      return validationResult;
    }

    // Set dice count and transition to DEFENDER_DICE subphase
    set({
      attackerDiceCount: diceCount,
      subPhase: 'DEFENDER_DICE' as SubPhase,
      lastError: null,
    });

    return { valid: true };
  },

  // Get maximum attacker dice based on current attacking territory
  getMaxAttackerDice: () => {
    const state = get();
    if (!state.attackingTerritory) return 0;
    const attackingTroops = state.territories[state.attackingTerritory]?.troopCount || 0;
    return getMaxAttackerDice(attackingTroops);
  },

  // Get available dice options for attacker
  getAvailableAttackerDice: () => {
    const state = get();
    if (!state.attackingTerritory) return [];
    const attackingTroops = state.territories[state.attackingTerritory]?.troopCount || 0;
    return getAvailableAttackerDice(attackingTroops);
  },

  // Get maximum defender dice based on defending territory
  getMaxDefenderDice: () => {
    const state = get();
    if (!state.defendingTerritory) return 0;
    const defendingTroops = state.territories[state.defendingTerritory]?.troopCount || 0;
    return getMaxDefenderDice(defendingTroops);
  },

  // Get available dice options for defender
  getAvailableDefenderDice: () => {
    const state = get();
    if (!state.defendingTerritory) return [];
    const defendingTroops = state.territories[state.defendingTerritory]?.troopCount || 0;
    return getAvailableDefenderDice(defendingTroops);
  },

  // Get defending player based on defending territory owner
  getDefendingPlayer: () => {
    const state = get();
    if (!state.defendingTerritory) return null;
    const defendingOwnerId = state.territories[state.defendingTerritory]?.ownerId;
    if (!defendingOwnerId) return null;
    return state.players.find((p) => p.id === defendingOwnerId) || null;
  },

  // Get conquest troop range (min/max troops to move after winning)
  getConquestTroopRange: () => {
    const state = get();
    if (!state.attackingTerritory || !state.attackerDiceCount) {
      return { min: 0, max: 0 };
    }
    const attackingTroops = state.territories[state.attackingTerritory]?.troopCount || 0;
    return getConquestTroopRange(state.attackerDiceCount, attackingTroops);
  },

  // Select defender dice count
  selectDefenderDice: (diceCount) => {
    const state = get();

    if (!state.defendingTerritory) {
      const result: DefenderDiceValidationResult = {
        valid: false,
        errorCode: 'INVALID_PHASE',
        errorMessage: 'No defending territory selected',
      };
      set({ lastError: result as AttackValidationResult });
      return result;
    }

    const defendingTroops = state.territories[state.defendingTerritory]?.troopCount || 0;
    const isCorrectPhase = state.phase === 'ATTACK' && state.subPhase === 'DEFENDER_DICE';

    const validationResult = validateSelectDefenderDice(
      diceCount,
      defendingTroops,
      true, // Defender is always allowed to choose
      isCorrectPhase
    );

    if (!validationResult.valid) {
      set({ lastError: validationResult as AttackValidationResult });
      return validationResult;
    }

    // Set defender dice count and transition to rolling
    set({
      defenderDiceCount: diceCount,
      subPhase: 'RESOLVE' as SubPhase,
      lastError: null,
    });

    // Automatically roll dice after defender selects
    get().rollCombatDice();

    return { valid: true };
  },

  // Roll combat dice and apply modifiers
  rollCombatDice: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!state.attackingTerritory || !state.defendingTerritory) return;
    if (!state.attackerDiceCount || !state.defenderDiceCount) return;

    const attackingTerritory = state.territories[state.attackingTerritory];
    const defendingTerritory = state.territories[state.defendingTerritory];
    const defendingPlayer = state.players.find((p) => p.id === defendingTerritory?.ownerId) || null;

    // Roll dice
    const attackerRolls = rollDice(state.attackerDiceCount);
    const defenderRolls = rollDice(state.defenderDiceCount);

    // Check for Supreme Firepower before applying modifiers
    const hasSupremeFirepower =
      currentPlayer?.activePower === 'supreme_firepower' && checkSupremeFirepower(attackerRolls);

    // Apply modifiers
    const attackerDice = applyModifiers(
      attackerRolls,
      true,
      attackingTerritory,
      currentPlayer,
      state.isFirstAttackOfTurn
    );

    const defenderDice = applyModifiers(
      defenderRolls,
      false,
      defendingTerritory,
      defendingPlayer,
      false
    );

    // Resolve combat
    let result: CombatResult;

    if (hasSupremeFirepower) {
      // Supreme Firepower: Defender loses 3 troops immediately
      result = {
        attackerRolls: attackerDice,
        defenderRolls: defenderDice,
        comparisons: [],
        attackerLosses: 0,
        defenderLosses: 3,
        defenderEliminated: defendingTerritory.troopCount <= 3,
        conquestRequired: defendingTerritory.troopCount <= 3,
      };
    } else {
      result = resolveCombat(
        attackerDice,
        defenderDice,
        defendingTerritory.troopCount,
        currentPlayer,
        defendingPlayer
      );
    }

    set({
      attackerRawRolls: attackerRolls,
      defenderRawRolls: defenderRolls,
      combatResult: result,
    });
  },

  // Apply combat result to territories
  resolveCombatResult: () => {
    const state = get();

    if (!state.combatResult || !state.attackingTerritory || !state.defendingTerritory) return;

    const { attackerLosses, defenderLosses, conquestRequired } = state.combatResult;

    // Update territory troop counts
    set((prev) => {
      const updatedTerritories = { ...prev.territories };

      // Apply attacker losses
      if (prev.attackingTerritory && updatedTerritories[prev.attackingTerritory]) {
        updatedTerritories[prev.attackingTerritory] = {
          ...updatedTerritories[prev.attackingTerritory],
          troopCount: Math.max(1, updatedTerritories[prev.attackingTerritory].troopCount - attackerLosses),
        };
      }

      // Apply defender losses
      if (prev.defendingTerritory && updatedTerritories[prev.defendingTerritory]) {
        updatedTerritories[prev.defendingTerritory] = {
          ...updatedTerritories[prev.defendingTerritory],
          troopCount: Math.max(0, updatedTerritories[prev.defendingTerritory].troopCount - defenderLosses),
        };
      }

      // If conquest required, transition to TROOP_MOVE phase
      if (conquestRequired) {
        const minTroops = prev.attackerDiceCount || 1;
        return {
          territories: updatedTerritories,
          subPhase: 'TROOP_MOVE' as SubPhase,
          conquestTroopsToMove: minTroops,
          isFirstAttackOfTurn: false, // No longer first attack
        };
      }

      // Otherwise, go back to IDLE for next attack
      return {
        territories: updatedTerritories,
        subPhase: 'IDLE' as SubPhase,
        attackingTerritory: null,
        defendingTerritory: null,
        attackerDiceCount: null,
        defenderDiceCount: null,
        combatResult: null,
        attackerRawRolls: null,
        defenderRawRolls: null,
        isFirstAttackOfTurn: false, // No longer first attack
      };
    });
  },

  // Set conquest troop count
  setConquestTroops: (troops) => {
    const state = get();
    const range = state.getConquestTroopRange();

    if (troops >= range.min && troops <= range.max) {
      set({ conquestTroopsToMove: troops });
    }
  },

  // Confirm conquest and move troops
  confirmConquest: () => {
    const state = get();

    if (!state.attackingTerritory || !state.defendingTerritory || !state.conquestTroopsToMove) {
      return;
    }

    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer) return;

    // Check if conquering an enemy HQ
    const defendingTerritoryId = state.defendingTerritory;
    const enemyHQOwner = state.players.find(
      (p) => p.id !== currentPlayer.id && p.hqTerritory === defendingTerritoryId
    );

    set((prev) => {
      const updatedTerritories = { ...prev.territories };
      const troopsToMove = prev.conquestTroopsToMove || 1;

      // Move troops from attacking to defending territory
      if (prev.attackingTerritory && updatedTerritories[prev.attackingTerritory]) {
        updatedTerritories[prev.attackingTerritory] = {
          ...updatedTerritories[prev.attackingTerritory],
          troopCount: updatedTerritories[prev.attackingTerritory].troopCount - troopsToMove,
        };
      }

      // Transfer ownership and place troops in conquered territory
      if (prev.defendingTerritory && updatedTerritories[prev.defendingTerritory]) {
        updatedTerritories[prev.defendingTerritory] = {
          ...updatedTerritories[prev.defendingTerritory],
          ownerId: currentPlayer.id,
          troopCount: troopsToMove,
        };
      }

      // Update players
      let updatedPlayers = prev.players.map((p) => {
        if (p.id === currentPlayer.id) {
          // Award a red star if capturing enemy HQ
          const newStars = enemyHQOwner ? p.redStars + 1 : p.redStars;
          return { ...p, conqueredThisTurn: true, redStars: newStars };
        }
        // Remove star from player who lost their HQ
        if (enemyHQOwner && p.id === enemyHQOwner.id) {
          return { ...p, redStars: Math.max(0, p.redStars - 1) };
        }
        return p;
      });

      // Check if defender is eliminated (no territories left)
      const defendingPlayer = prev.players.find(
        (p) => p.id !== currentPlayer.id && updatedTerritories[prev.defendingTerritory!]
      );
      if (defendingPlayer) {
        const defenderTerritoryCount = Object.values(updatedTerritories).filter(
          (t) => t.ownerId === defendingPlayer.id
        ).length;
        if (defenderTerritoryCount === 0) {
          updatedPlayers = updatedPlayers.map((p) =>
            p.id === defendingPlayer.id ? { ...p, isEliminated: true } : p
          );
        }
      }

      return {
        territories: updatedTerritories,
        players: updatedPlayers,
        subPhase: 'IDLE' as SubPhase,
        attackingTerritory: null,
        defendingTerritory: null,
        attackerDiceCount: null,
        defenderDiceCount: null,
        combatResult: null,
        attackerRawRolls: null,
        defenderRawRolls: null,
        conquestTroopsToMove: null,
      };
    });

    // Check for victory after conquest
    get().checkForVictory();
  },

  // Cancel the current attack (go back to IDLE)
  cancelAttack: () => {
    set({
      attackingTerritory: null,
      defendingTerritory: null,
      attackerDiceCount: null,
      defenderDiceCount: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      conquestTroopsToMove: null,
      selectedTerritory: null,
      subPhase: 'IDLE' as SubPhase,
      lastError: null,
    });
  },

  // End the attack phase and move to maneuver
  endAttackPhase: () => {
    set({
      attackingTerritory: null,
      defendingTerritory: null,
      attackerDiceCount: null,
      defenderDiceCount: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      conquestTroopsToMove: null,
      isFirstAttackOfTurn: true, // Reset for next turn
      selectedTerritory: null,
      phase: 'MANEUVER' as GamePhase,
      subPhase: 'SELECT_MANEUVER_SOURCE' as SubPhase,
      lastError: null,
    });
  },

  // Attack again from the same source territory to the same target
  attackAgain: () => {
    // Keep the same attacking and defending territories, reset to ATTACKER_DICE
    set({
      attackerDiceCount: null,
      defenderDiceCount: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      subPhase: 'ATTACKER_DICE' as SubPhase,
      lastError: null,
    });
  },

  // Select a new target (go back to SELECT_ATTACK with same source)
  selectNewTarget: () => {
    set({
      defendingTerritory: null,
      attackerDiceCount: null,
      defenderDiceCount: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      subPhase: 'SELECT_ATTACK' as SubPhase,
      lastError: null,
    });
  },

  // Select a territory to maneuver from
  selectManeuverSource: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: ManeuverValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result as AttackValidationResult });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase =
      state.phase === 'MANEUVER' &&
      (state.subPhase === 'SELECT_MANEUVER_SOURCE' || state.subPhase === null);

    const validationResult = validateSelectManeuverSource({
      territoryId,
      territoryStates: state.territories,
      currentPlayerId: currentPlayer.id,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult as AttackValidationResult });
      return validationResult;
    }

    // Set maneuver source and transition to SELECT_MANEUVER_TARGET subphase
    set({
      maneuverSourceTerritory: territoryId,
      maneuverTargetTerritory: null,
      currentManeuverPath: null,
      selectedTerritory: territoryId,
      subPhase: 'SELECT_MANEUVER_TARGET' as SubPhase,
      lastError: null,
    });

    return { valid: true };
  },

  // Select a territory to maneuver to
  selectManeuverTarget: (territoryId) => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;

    if (!currentPlayer) {
      const result: ManeuverValidationResult = {
        valid: false,
        errorCode: 'NOT_YOUR_TURN',
        errorMessage: 'No current player',
      };
      set({ lastError: result as AttackValidationResult });
      return result;
    }

    if (!state.maneuverSourceTerritory) {
      const result: ManeuverValidationResult = {
        valid: false,
        errorCode: 'INVALID_PHASE',
        errorMessage: 'Select a source territory first',
      };
      set({ lastError: result as AttackValidationResult });
      return result;
    }

    const isPlayerTurn = state.activePlayerId === currentPlayer.id;
    const isCorrectPhase = state.phase === 'MANEUVER' && state.subPhase === 'SELECT_MANEUVER_TARGET';

    const validationResult = validateSelectManeuverTarget({
      sourceId: state.maneuverSourceTerritory,
      targetId: territoryId,
      territoryStates: state.territories,
      currentPlayerId: currentPlayer.id,
      isPlayerTurn,
      isCorrectPhase,
    });

    if (!validationResult.valid) {
      set({ lastError: validationResult as AttackValidationResult });
      return validationResult;
    }

    // Find and store the path for display
    const path = findPath(
      state.maneuverSourceTerritory,
      territoryId,
      state.territories,
      currentPlayer.id
    );

    // Default troop count to 1
    set({
      maneuverTargetTerritory: territoryId,
      currentManeuverPath: path,
      maneuverTroopsToMove: 1,
      subPhase: 'SET_MANEUVER_TROOPS' as SubPhase,
      lastError: null,
    });

    return { valid: true };
  },

  // Set the number of troops to maneuver
  setManeuverTroops: (troops) => {
    const state = get();
    if (!state.maneuverSourceTerritory) return;

    const maxTroops = getMaxManeuverTroops(state.maneuverSourceTerritory, state.territories);
    const validTroops = Math.max(1, Math.min(troops, maxTroops));
    set({ maneuverTroopsToMove: validTroops });
  },

  // Confirm maneuver and move troops
  confirmManeuver: () => {
    const state = get();

    if (
      !state.maneuverSourceTerritory ||
      !state.maneuverTargetTerritory ||
      !state.maneuverTroopsToMove
    ) {
      return;
    }

    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer) return;

    set((prev) => {
      const updatedTerritories = { ...prev.territories };
      const troopsToMove = prev.maneuverTroopsToMove || 1;

      // Remove troops from source
      if (prev.maneuverSourceTerritory && updatedTerritories[prev.maneuverSourceTerritory]) {
        updatedTerritories[prev.maneuverSourceTerritory] = {
          ...updatedTerritories[prev.maneuverSourceTerritory],
          troopCount: updatedTerritories[prev.maneuverSourceTerritory].troopCount - troopsToMove,
        };
      }

      // Add troops to target
      if (prev.maneuverTargetTerritory && updatedTerritories[prev.maneuverTargetTerritory]) {
        updatedTerritories[prev.maneuverTargetTerritory] = {
          ...updatedTerritories[prev.maneuverTargetTerritory],
          troopCount: updatedTerritories[prev.maneuverTargetTerritory].troopCount + troopsToMove,
        };
      }

      // Clear maneuver state (endTurn will handle phase transition)
      return {
        territories: updatedTerritories,
        maneuverSourceTerritory: null,
        maneuverTargetTerritory: null,
        maneuverTroopsToMove: null,
        currentManeuverPath: null,
        selectedTerritory: null,
        lastError: null,
      };
    });

    // End the turn and advance to next player
    get().endTurn();
  },

  // Cancel the current maneuver selection (go back to source selection)
  cancelManeuver: () => {
    set({
      maneuverSourceTerritory: null,
      maneuverTargetTerritory: null,
      maneuverTroopsToMove: null,
      currentManeuverPath: null,
      selectedTerritory: null,
      subPhase: 'SELECT_MANEUVER_SOURCE' as SubPhase,
      lastError: null,
    });
  },

  // Skip the maneuver phase entirely
  skipManeuver: () => {
    set({
      maneuverSourceTerritory: null,
      maneuverTargetTerritory: null,
      maneuverTroopsToMove: null,
      currentManeuverPath: null,
      selectedTerritory: null,
      lastError: null,
    });
    // End the turn and advance to next player
    get().endTurn();
  },

  // Return to attack phase from maneuver (only if no maneuver has been executed)
  returnToAttackPhase: () => {
    set({
      maneuverSourceTerritory: null,
      maneuverTargetTerritory: null,
      maneuverTroopsToMove: null,
      currentManeuverPath: null,
      selectedTerritory: null,
      phase: 'ATTACK' as GamePhase,
      subPhase: 'IDLE' as SubPhase,
      lastError: null,
    });
  },

  // End the current turn and advance to the next player
  endTurn: () => {
    const state = get();
    const activePlayers = state.players.filter((p) => !p.isEliminated);

    if (activePlayers.length === 0) return;

    // Find current player index among active players
    const currentIndex = activePlayers.findIndex((p) => p.id === state.activePlayerId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[nextIndex];

    // Increment turn number when cycling back to first player
    const newTurn = nextIndex <= currentIndex ? state.currentTurn + 1 : state.currentTurn;

    // Calculate reinforcements for next player
    let controlledTerritories = 0;
    let totalCityPopulation = 0;

    Object.values(state.territories).forEach((territory) => {
      if (territory.ownerId === nextPlayer.id) {
        controlledTerritories++;
        totalCityPopulation += territory.cityTier;
      }
    });

    // Base troops: floor((territories + population) / 3), minimum 3
    const baseReinforcements = Math.max(3, Math.floor((controlledTerritories + totalCityPopulation) / 3));

    // Continent bonuses
    const continentBonus = continents
      .filter((continent) =>
        continent.territoryIds.every((tid) => state.territories[tid]?.ownerId === nextPlayer.id)
      )
      .reduce((sum, continent) => sum + continent.bonus, 0);

    const totalReinforcements = baseReinforcements + continentBonus;

    // Reset conquered this turn flag for previous player, set up next turn
    set((prev) => ({
      activePlayerId: nextPlayer.id,
      currentTurn: newTurn,
      phase: 'RECRUIT' as GamePhase,
      subPhase: 'PLACE_TROOPS' as SubPhase,
      troopsToPlace: totalReinforcements,
      pendingDeployments: {},
      isFirstAttackOfTurn: true,
      selectedTerritory: null,
      // Reset any attack/maneuver state
      attackingTerritory: null,
      defendingTerritory: null,
      attackerDiceCount: null,
      defenderDiceCount: null,
      combatResult: null,
      attackerRawRolls: null,
      defenderRawRolls: null,
      conquestTroopsToMove: null,
      maneuverSourceTerritory: null,
      maneuverTargetTerritory: null,
      maneuverTroopsToMove: null,
      currentManeuverPath: null,
      lastError: null,
      // Reset conqueredThisTurn for all players at start of their turn
      players: prev.players.map((p) =>
        p.id === nextPlayer.id ? { ...p, conqueredThisTurn: false } : p
      ),
    }));
  },

  // Get territories that can be used as maneuver sources
  getManeuverableTerritories: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer) return [];
    return getManeuverableTerritories(state.territories, currentPlayer.id);
  },

  // Get valid maneuver targets for the currently selected source
  getValidManeuverTargets: () => {
    const state = get();
    const currentPlayer = state.players.find((p) => p.id === state.activePlayerId) || null;
    if (!currentPlayer || !state.maneuverSourceTerritory) return [];
    return getValidManeuverTargets(
      state.maneuverSourceTerritory,
      state.territories,
      currentPlayer.id
    );
  },

  // Get the current maneuver path for highlighting
  getCurrentManeuverPath: () => {
    const state = get();
    return state.currentManeuverPath;
  },

  // Get maximum troops that can be moved
  getMaxManeuverTroops: () => {
    const state = get();
    if (!state.maneuverSourceTerritory) return 0;
    return getMaxManeuverTroops(state.maneuverSourceTerritory, state.territories);
  },

  // Clear error
  clearError: () => {
    set({ lastError: null });
  },

  // Select a faction and power for a player during setup
  selectFaction: (playerId, factionId, powerId) => {
    const state = get();

    // Validate the faction exists
    const faction = factionsById[factionId];
    if (!faction) {
      set({
        lastError: {
          valid: false,
          errorCode: 'INVALID_FACTION',
          errorMessage: 'Invalid faction selected',
        },
      });
      return;
    }

    // Validate the power exists for this faction
    const power = faction.powers.find((p) => p.id === powerId);
    if (!power) {
      set({
        lastError: {
          valid: false,
          errorCode: 'INVALID_POWER',
          errorMessage: 'Invalid power selected for this faction',
        },
      });
      return;
    }

    // Validate the faction is not already taken
    const takenFactions = state.players
      .filter((p) => p.factionId && p.id !== playerId)
      .map((p) => p.factionId);

    if (takenFactions.includes(factionId)) {
      set({
        lastError: {
          valid: false,
          errorCode: 'FACTION_TAKEN',
          errorMessage: 'This faction has already been selected by another player',
        },
      });
      return;
    }

    // Update the player's faction and power
    set((prev) => {
      const updatedPlayers = prev.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              factionId,
              activePower: powerId,
              color: faction.color,
            }
          : p
      );

      // Check if all players have selected factions
      const allSelected = updatedPlayers.every((p) => p.factionId && p.activePower);
      const nextTurnIndex = prev.setupTurnIndex + 1;

      // If all players have selected, move to HQ_PLACEMENT
      if (allSelected || nextTurnIndex >= prev.players.length) {
        return {
          players: updatedPlayers,
          setupTurnIndex: 0, // Reset for HQ placement
          subPhase: 'HQ_PLACEMENT' as SubPhase,
          lastError: null,
        };
      }

      // Otherwise, move to next player's faction selection
      return {
        players: updatedPlayers,
        setupTurnIndex: nextTurnIndex,
        lastError: null,
      };
    });
  },

  // Get list of factions that have been taken by players
  getTakenFactions: () => {
    const state = get();
    return state.players
      .filter((p) => p.factionId)
      .map((p) => p.factionId);
  },

  // Get the current player for setup phase (based on setupTurnIndex)
  getSetupCurrentPlayer: () => {
    const state = get();
    if (state.phase !== 'SETUP') return null;
    return state.players[state.setupTurnIndex] || null;
  },

  // Place HQ on a territory
  placeHQ: (playerId, territoryId) => {
    const state = get();

    // Validate HQ placement
    const validation = validateHQPlacement(
      territoryId,
      state.territories,
      state.players,
      playerId,
      state.setupTurnIndex,
      state.subPhase
    );

    if (!validation.valid) {
      set({ lastError: validation });
      return;
    }

    // Get the player
    const player = state.players.find((p) => p.id === playerId);
    if (!player) {
      set({
        lastError: {
          valid: false,
          errorCode: 'INVALID_TERRITORY',
          errorMessage: 'Player not found',
        },
      });
      return;
    }

    // Calculate starting troops
    const startingTroops = getStartingTroops(player);

    set((prev) => {
      // Update territory ownership and troops
      const updatedTerritories = {
        ...prev.territories,
        [territoryId]: {
          ...prev.territories[territoryId],
          ownerId: playerId,
          troopCount: startingTroops,
        },
      };

      // Update player's HQ territory and add starting red star
      const updatedPlayers = prev.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              hqTerritory: territoryId,
              redStars: 1, // Own HQ gives 1 star
            }
          : p
      );

      // Check if all players have placed HQs
      const allPlaced = updatedPlayers.every((p) => p.hqTerritory);
      const nextTurnIndex = prev.setupTurnIndex + 1;

      if (allPlaced || nextTurnIndex >= prev.players.length) {
        // Transition to active game phase
        return {
          territories: updatedTerritories,
          players: updatedPlayers,
          setupTurnIndex: 0,
          phase: 'RECRUIT' as GamePhase,
          subPhase: 'PLACE_TROOPS' as SubPhase,
          status: 'active',
          currentTurn: 1,
          activePlayerId: updatedPlayers[0]?.id || null,
          troopsToPlace: 0, // Will be calculated when reinforcement phase starts
          lastError: null,
        };
      }

      // Move to next player's HQ placement
      return {
        territories: updatedTerritories,
        players: updatedPlayers,
        setupTurnIndex: nextTurnIndex,
        lastError: null,
      };
    });
  },

  // Get list of legal territories for HQ placement
  getLegalHQTerritories: (playerId) => {
    const state = get();
    return getValidHQTerritories(state.territories, state.players, playerId);
  },

  // Get list of players who have already placed HQs
  getPlacedHQs: () => {
    const state = get();
    return state.players
      .filter((p) => p.hqTerritory)
      .map((p) => ({
        playerName: p.name,
        factionId: p.factionId,
        territoryName: state.territories[p.hqTerritory]?.name || p.hqTerritory,
      }));
  },

  // Check for victory conditions and update state if victory achieved
  checkForVictory: () => {
    const state = get();
    const result = checkVictory(state.players);

    if (result.isVictory) {
      set({
        victoryResult: result,
        winnerId: result.winnerId,
        status: 'finished',
      });
    }

    return result;
  },

  // Get the winning player
  getWinner: () => {
    const state = get();
    if (!state.winnerId) return null;
    return state.players.find((p) => p.id === state.winnerId) || null;
  },

  // Dismiss victory modal (for moving to write phase)
  dismissVictory: () => {
    // In a full implementation, this would transition to write phase
    // For now, just keep the victory state for display
    console.log('Victory acknowledged. Transitioning to Write Phase...');
  },

  // Add a new entry to the game log
  addLogEntry: (entry) => {
    const state = get();
    const newEntry: GameLogEntry = {
      ...entry,
      id: createLogEntryId(),
      timestamp: Date.now(),
      turn: state.currentTurn,
    };
    set((prev) => ({
      gameLog: [...prev.gameLog, newEntry],
    }));
  },

  // Clear the game log
  clearLog: () => {
    set({ gameLog: [] });
  },
}));
