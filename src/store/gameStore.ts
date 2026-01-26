import { create } from 'zustand';
import { TerritoryId, TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';
import { GamePhase, SubPhase } from '@/types/game';
import {
  validateAddTroop,
  validateRemoveTroop,
  validateConfirmDeployment,
  ValidationResult,
} from '@/utils/deploymentValidation';

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
  status: 'idle' | 'lobby' | 'setup' | 'active' | 'finished';

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

  // UI state
  selectedTerritory: TerritoryId | null;
  hoveredTerritory: TerritoryId | null;

  // Validation error
  lastError: ValidationResult | null;
}

/**
 * Game store actions interface
 */
export interface GameStoreActions {
  // State sync
  syncFromServer: (state: Partial<GameStoreState>) => void;

  // Territory selection
  setSelectedTerritory: (territoryId: TerritoryId | null) => void;
  setHoveredTerritory: (territoryId: TerritoryId | null) => void;

  // Reinforcement phase actions
  addTroop: (territoryId: TerritoryId) => ValidationResult;
  removeTroop: (territoryId: TerritoryId) => ValidationResult;
  confirmDeployment: () => ValidationResult;

  // Selectors
  getCurrentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getPlayerTerritories: (playerId: string) => TerritoryId[];
  getTroopsRemaining: () => number;
  getSelectableTerritories: () => TerritoryId[] | undefined;

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
  status: 'idle',
  currentTurn: 0,
  activePlayerId: null,
  phase: null,
  subPhase: null,
  territories: {},
  players: [],
  troopsToPlace: 0,
  pendingDeployments: {},
  selectedTerritory: null,
  hoveredTerritory: null,
  lastError: null,

  // Sync state from server (or initialize with mock data)
  syncFromServer: (newState) => {
    set((state) => ({
      ...state,
      ...newState,
      // Reset pending deployments when syncing new state
      pendingDeployments: {},
    }));
  },

  // Territory selection
  setSelectedTerritory: (territoryId) => {
    set({ selectedTerritory: territoryId });
  },

  setHoveredTerritory: (territoryId) => {
    set({ hoveredTerritory: territoryId });
  },

  // Get current player (the player at the local client)
  getCurrentPlayer: () => {
    const state = get();
    // For now, return the first player (in real implementation, would be based on userId)
    return state.players[0] || null;
  },

  // Check if it's the current player's turn
  isMyTurn: () => {
    const state = get();
    const currentPlayer = state.players[0];
    return currentPlayer ? state.activePlayerId === currentPlayer.id : false;
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
    const currentPlayer = state.players[0];

    if (state.phase === 'RECRUIT' && state.subPhase === 'PLACE_TROOPS' && currentPlayer) {
      return Object.values(state.territories)
        .filter((t) => t.ownerId === currentPlayer.id)
        .map((t) => t.id);
    }

    // For other phases, all territories are selectable
    return undefined;
  },

  // Add a troop to pending deployments
  addTroop: (territoryId) => {
    const state = get();
    const currentPlayer = state.players[0];

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
    const currentPlayer = state.players[0];

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
    const currentPlayer = state.players[0];

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

  // Clear error
  clearError: () => {
    set({ lastError: null });
  },
}));
