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
  defenderDiceCount: number | null;

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
  selectDefenderDice: (diceCount: number) => DefenderDiceValidationResult;
  rollCombatDice: () => void;
  resolveCombatResult: () => void;
  setConquestTroops: (troops: number) => void;
  confirmConquest: () => void;
  cancelAttack: () => void;
  endAttackPhase: () => void;

  // Maneuver phase actions
  selectManeuverSource: (territoryId: TerritoryId) => ManeuverValidationResult;
  selectManeuverTarget: (territoryId: TerritoryId) => ManeuverValidationResult;
  setManeuverTroops: (troops: number) => void;
  confirmManeuver: () => void;
  cancelManeuver: () => void;
  skipManeuver: () => void;

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
  defenderDiceCount: null,
  combatResult: null,
  attackerRawRolls: null,
  defenderRawRolls: null,
  conquestTroopsToMove: null,
  isFirstAttackOfTurn: true,
  maneuverSourceTerritory: null,
  maneuverTargetTerritory: null,
  maneuverTroopsToMove: null,
  currentManeuverPath: null,
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
    const currentPlayer = state.players[0];

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

    const currentPlayer = state.players[0];
    if (!currentPlayer) return;

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

      // Update conqueredThisTurn for card draw eligibility
      const updatedPlayers = prev.players.map((p) =>
        p.id === currentPlayer.id ? { ...p, conqueredThisTurn: true } : p
      );

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

  // Select a territory to maneuver from
  selectManeuverSource: (territoryId) => {
    const state = get();
    const currentPlayer = state.players[0];

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
    const currentPlayer = state.players[0];

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

    const currentPlayer = state.players[0];
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

      // Transition to END phase (or next turn in a real game)
      return {
        territories: updatedTerritories,
        maneuverSourceTerritory: null,
        maneuverTargetTerritory: null,
        maneuverTroopsToMove: null,
        currentManeuverPath: null,
        selectedTerritory: null,
        phase: 'END' as GamePhase,
        subPhase: null,
        lastError: null,
      };
    });
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
      phase: 'END' as GamePhase,
      subPhase: null,
      lastError: null,
    });
  },

  // Get territories that can be used as maneuver sources
  getManeuverableTerritories: () => {
    const state = get();
    const currentPlayer = state.players[0];
    if (!currentPlayer) return [];
    return getManeuverableTerritories(state.territories, currentPlayer.id);
  },

  // Get valid maneuver targets for the currently selected source
  getValidManeuverTargets: () => {
    const state = get();
    const currentPlayer = state.players[0];
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
}));
