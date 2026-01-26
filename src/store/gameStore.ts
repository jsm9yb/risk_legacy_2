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

  // Attack phase state
  attackingTerritory: TerritoryId | null;
  defendingTerritory: TerritoryId | null;
  attackerDiceCount: number | null;

  // UI state
  selectedTerritory: TerritoryId | null;
  hoveredTerritory: TerritoryId | null;

  // Validation error
  lastError: ValidationResult | AttackValidationResult | null;
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

  // Attack phase actions
  selectAttackSource: (territoryId: TerritoryId) => AttackValidationResult;
  selectAttackTarget: (territoryId: TerritoryId) => AttackValidationResult;
  selectAttackerDice: (diceCount: number) => AttackValidationResult;
  cancelAttack: () => void;
  endAttackPhase: () => void;

  // Attack phase selectors
  getMaxAttackerDice: () => number;
  getAvailableAttackerDice: () => number[];

  // Selectors
  getCurrentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getPlayerTerritories: (playerId: string) => TerritoryId[];
  getTroopsRemaining: () => number;
  getSelectableTerritories: () => TerritoryId[] | undefined;
  getAttackableTerritories: () => TerritoryId[];
  getValidAttackTargets: () => TerritoryId[];

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
  attackingTerritory: null,
  defendingTerritory: null,
  attackerDiceCount: null,
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

    // Attack phase: IDLE = select source, SELECT_ATTACK = select target
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

    // For other phases, all territories are selectable
    return undefined;
  },

  // Get territories that can attack (owned by current player, >= 2 troops)
  getAttackableTerritories: () => {
    const state = get();
    const currentPlayer = state.players[0];
    if (!currentPlayer) return [];
    return getAttackableTerritories(state.territories, currentPlayer.id);
  },

  // Get valid attack targets for the currently selected attacking territory
  getValidAttackTargets: () => {
    const state = get();
    const currentPlayer = state.players[0];
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

  // Select a territory to attack from
  selectAttackSource: (territoryId) => {
    const state = get();
    const currentPlayer = state.players[0];

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
    const currentPlayer = state.players[0];

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

    // Set defending territory and transition to ATTACKER_DICE subphase
    set({
      defendingTerritory: territoryId,
      subPhase: 'ATTACKER_DICE' as SubPhase,
      lastError: null,
    });

    return { valid: true };
  },

  // Select attacker dice count
  selectAttackerDice: (diceCount) => {
    const state = get();
    const currentPlayer = state.players[0];

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

  // Cancel the current attack (go back to IDLE)
  cancelAttack: () => {
    set({
      attackingTerritory: null,
      defendingTerritory: null,
      attackerDiceCount: null,
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
      selectedTerritory: null,
      phase: 'MANEUVER' as GamePhase,
      subPhase: null,
      lastError: null,
    });
  },

  // Clear error
  clearError: () => {
    set({ lastError: null });
  },
}));
