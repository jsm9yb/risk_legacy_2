/**
 * Game Store Unit Tests
 * Tests for: state mutations, action validation, selectors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore, createGameStore } from '../../../src/store/gameStore';

describe('Game Store', () => {
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    store = createGameStore();
  });

  // ============================================
  // INITIAL STATE
  // ============================================
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState();

      expect(state.gameId).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.phase).toBeNull();
      expect(state.territories).toEqual(new Map());
      expect(state.players).toEqual([]);
      expect(state.currentTurn).toBe(0);
    });
  });

  // ============================================
  // GAME INITIALIZATION
  // ============================================
  describe('Game Initialization', () => {
    it('should set game state from server sync', () => {
      const serverState = {
        gameId: 'game-123',
        status: 'active',
        phase: 'RECRUIT',
        currentTurn: 3,
        activePlayerId: 1,
        players: [
          { id: 1, name: 'Player 1', factionId: 'khan' },
          { id: 2, name: 'Player 2', factionId: 'bear' },
        ],
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 5 },
          1: { id: 1, ownerId: 2, troopCount: 3 },
        },
      };

      act(() => {
        store.getState().syncFromServer(serverState);
      });

      const state = store.getState();
      expect(state.gameId).toBe('game-123');
      expect(state.status).toBe('active');
      expect(state.players).toHaveLength(2);
      expect(state.territories.size).toBe(2);
    });

    it('should convert territory object to Map', () => {
      act(() => {
        store.getState().syncFromServer({
          territories: {
            0: { id: 0, ownerId: 1 },
            5: { id: 5, ownerId: 2 },
          },
        });
      });

      const state = store.getState();
      expect(state.territories instanceof Map).toBe(true);
      expect(state.territories.get(0)?.ownerId).toBe(1);
      expect(state.territories.get(5)?.ownerId).toBe(2);
    });
  });

  // ============================================
  // DELTA UPDATES
  // ============================================
  describe('Delta Updates', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        gameId: 'game-123',
        status: 'active',
        phase: 'ATTACK',
        players: [
          { id: 1, cards: [], redStars: 1 },
          { id: 2, cards: [], redStars: 1 },
        ],
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 5 },
          1: { id: 1, ownerId: 2, troopCount: 3 },
        },
      });
    });

    it('should apply partial territory update', () => {
      act(() => {
        store.getState().applyDelta({
          territories: {
            0: { troopCount: 3 }, // Only troop count changed
          },
        });
      });

      const state = store.getState();
      expect(state.territories.get(0)?.troopCount).toBe(3);
      expect(state.territories.get(0)?.ownerId).toBe(1); // Preserved
    });

    it('should apply player update', () => {
      act(() => {
        store.getState().applyDelta({
          players: [
            { id: 1, redStars: 2 },
          ],
        });
      });

      const state = store.getState();
      const player = state.players.find((p) => p.id === 1);
      expect(player?.redStars).toBe(2);
    });

    it('should apply phase change', () => {
      act(() => {
        store.getState().applyDelta({
          phase: 'MANEUVER',
        });
      });

      expect(store.getState().phase).toBe('MANEUVER');
    });
  });

  // ============================================
  // TROOP DEPLOYMENT
  // ============================================
  describe('Troop Deployment', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        phase: 'RECRUIT',
        subPhase: 'PLACE_TROOPS',
        troopsToPlace: 5,
        currentPlayerId: 1,
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 3 },
          1: { id: 1, ownerId: 2, troopCount: 2 },
        },
      });
    });

    it('should deploy troops to territory', () => {
      act(() => {
        store.getState().deployTroop(0, 2);
      });

      const state = store.getState();
      expect(state.territories.get(0)?.troopCount).toBe(5);
      expect(state.troopsToPlace).toBe(3);
    });

    it('should reject deployment to enemy territory', () => {
      expect(() => {
        act(() => {
          store.getState().deployTroop(1, 1); // Territory owned by player 2
        });
      }).toThrow('Cannot deploy to enemy territory');
    });

    it('should reject deployment exceeding available troops', () => {
      expect(() => {
        act(() => {
          store.getState().deployTroop(0, 10); // Only 5 available
        });
      }).toThrow('Not enough troops');
    });

    it('should track deployment for undo', () => {
      act(() => {
        store.getState().deployTroop(0, 2);
      });

      const state = store.getState();
      expect(state.deploymentHistory).toContainEqual({
        territoryId: 0,
        count: 2,
      });
    });
  });

  // ============================================
  // ATTACK ACTIONS
  // ============================================
  describe('Attack Actions', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        phase: 'ATTACK',
        subPhase: 'IDLE',
        currentPlayerId: 1,
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 5, neighbors: [1, 5] },
          1: { id: 1, ownerId: 2, troopCount: 3, neighbors: [0] },
          5: { id: 5, ownerId: 1, troopCount: 2, neighbors: [0] },
        },
      });
    });

    it('should set attack source', () => {
      act(() => {
        store.getState().setAttackSource(0);
      });

      expect(store.getState().attackSource).toBe(0);
    });

    it('should calculate valid targets', () => {
      act(() => {
        store.getState().setAttackSource(0);
      });

      const validTargets = store.getState().getValidAttackTargets();
      expect(validTargets).toContain(1); // Enemy territory
      expect(validTargets).not.toContain(5); // Own territory
    });

    it('should declare attack', () => {
      act(() => {
        store.getState().declareAttack(0, 1);
      });

      const state = store.getState();
      expect(state.attackSource).toBe(0);
      expect(state.attackTarget).toBe(1);
      expect(state.subPhase).toBe('ATTACKER_DICE');
    });

    it('should reject attack from territory with insufficient troops', () => {
      store.getState().syncFromServer({
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 1, neighbors: [1] },
          1: { id: 1, ownerId: 2, troopCount: 3, neighbors: [0] },
        },
      });

      expect(() => {
        act(() => {
          store.getState().declareAttack(0, 1);
        });
      }).toThrow('INSUFFICIENT_TROOPS');
    });

    it('should select attack dice', () => {
      act(() => {
        store.getState().declareAttack(0, 1);
        store.getState().selectAttackDice(3);
      });

      expect(store.getState().attackerDiceCount).toBe(3);
    });

    it('should cap dice at troops - 1', () => {
      store.getState().syncFromServer({
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 3, neighbors: [1] },
          1: { id: 1, ownerId: 2, troopCount: 3, neighbors: [0] },
        },
      });

      const maxDice = store.getState().getMaxAttackDice(0);
      expect(maxDice).toBe(2); // 3 troops - 1
    });
  });

  // ============================================
  // COMBAT STATE
  // ============================================
  describe('Combat State', () => {
    it('should store combat results', () => {
      act(() => {
        store.getState().setCombatResults({
          attackerDice: [6, 4, 2],
          defenderDice: [5, 3],
          attackerLosses: 1,
          defenderLosses: 1,
          conquered: false,
        });
      });

      const state = store.getState();
      expect(state.combatResult?.attackerLosses).toBe(1);
      expect(state.combatResult?.defenderLosses).toBe(1);
    });

    it('should clear combat state on new attack', () => {
      store.getState().setCombatResults({ attackerLosses: 1 });

      act(() => {
        store.getState().clearCombat();
      });

      expect(store.getState().combatResult).toBeNull();
      expect(store.getState().attackSource).toBeNull();
      expect(store.getState().attackTarget).toBeNull();
    });
  });

  // ============================================
  // MANEUVER ACTIONS
  // ============================================
  describe('Maneuver Actions', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        phase: 'MANEUVER',
        currentPlayerId: 1,
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 5, neighbors: [1] },
          1: { id: 1, ownerId: 1, troopCount: 3, neighbors: [0, 2] },
          2: { id: 2, ownerId: 1, troopCount: 2, neighbors: [1] },
          3: { id: 3, ownerId: 2, troopCount: 4, neighbors: [2] },
        },
      });
    });

    it('should get connected territories', () => {
      const connected = store.getState().getConnectedTerritories(0);

      expect(connected).toContain(0);
      expect(connected).toContain(1);
      expect(connected).toContain(2);
      expect(connected).not.toContain(3); // Enemy territory breaks chain
    });

    it('should execute maneuver', () => {
      act(() => {
        store.getState().executeManeuver(0, 2, 3);
      });

      const state = store.getState();
      expect(state.territories.get(0)?.troopCount).toBe(2); // 5 - 3
      expect(state.territories.get(2)?.troopCount).toBe(5); // 2 + 3
    });

    it('should reject maneuver leaving 0 troops', () => {
      expect(() => {
        act(() => {
          store.getState().executeManeuver(0, 2, 5); // Would leave 0
        });
      }).toThrow('INSUFFICIENT_TROOPS');
    });
  });

  // ============================================
  // CARD MANAGEMENT
  // ============================================
  describe('Card Management', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        currentPlayerId: 1,
        players: [
          { id: 1, cards: [1, 2, 3, 4, 5] },
        ],
      });
    });

    it('should get current player cards', () => {
      const cards = store.getState().getCurrentPlayerCards();
      expect(cards).toEqual([1, 2, 3, 4, 5]);
    });

    it('should calculate total coin value', () => {
      store.getState().syncFromServer({
        deck: {
          cards: [
            { id: 1, coinValue: 2 },
            { id: 2, coinValue: 3 },
            { id: 3, coinValue: 1 },
            { id: 4, coinValue: 1 },
            { id: 5, coinValue: 1 },
          ],
        },
      });

      const total = store.getState().getCardCoinTotal([1, 2, 3]);
      expect(total).toBe(6);
    });

    it('should select cards for trade', () => {
      act(() => {
        store.getState().selectCardForTrade(1);
        store.getState().selectCardForTrade(2);
      });

      expect(store.getState().selectedCards).toContain(1);
      expect(store.getState().selectedCards).toContain(2);
    });

    it('should deselect cards', () => {
      store.getState().selectCardForTrade(1);

      act(() => {
        store.getState().deselectCard(1);
      });

      expect(store.getState().selectedCards).not.toContain(1);
    });
  });

  // ============================================
  // SELECTORS
  // ============================================
  describe('Selectors', () => {
    beforeEach(() => {
      store.getState().syncFromServer({
        currentPlayerId: 1,
        activePlayerId: 1,
        players: [
          { id: 1, factionId: 'khan', redStars: 2, territories: [0, 1] },
          { id: 2, factionId: 'bear', redStars: 1, territories: [2] },
        ],
        territories: {
          0: { id: 0, ownerId: 1, troopCount: 5, continentId: 0 },
          1: { id: 1, ownerId: 1, troopCount: 3, continentId: 0 },
          2: { id: 2, ownerId: 2, troopCount: 4, continentId: 0 },
        },
      });
    });

    it('should get current player', () => {
      const player = store.getState().getCurrentPlayer();
      expect(player?.factionId).toBe('khan');
    });

    it('should get active player', () => {
      const player = store.getState().getActivePlayer();
      expect(player?.id).toBe(1);
    });

    it('should check if current player turn', () => {
      expect(store.getState().isMyTurn()).toBe(true);

      store.getState().syncFromServer({ activePlayerId: 2 });
      expect(store.getState().isMyTurn()).toBe(false);
    });

    it('should get player by id', () => {
      const player = store.getState().getPlayer(2);
      expect(player?.factionId).toBe('bear');
    });

    it('should get territory owner', () => {
      const owner = store.getState().getTerritoryOwner(0);
      expect(owner?.id).toBe(1);
    });

    it('should get player territories', () => {
      const territories = store.getState().getPlayerTerritories(1);
      expect(territories).toHaveLength(2);
      expect(territories.map((t) => t.id)).toContain(0);
      expect(territories.map((t) => t.id)).toContain(1);
    });

    it('should calculate reinforcement preview', () => {
      const preview = store.getState().getReinforcementPreview();

      expect(preview.base).toBeGreaterThanOrEqual(3);
      expect(preview.continentBonus).toBeDefined();
    });
  });

  // ============================================
  // UI STATE
  // ============================================
  describe('UI State', () => {
    it('should track hovered territory', () => {
      act(() => {
        store.getState().setHoveredTerritory(5);
      });

      expect(store.getState().hoveredTerritory).toBe(5);
    });

    it('should track selected territory', () => {
      act(() => {
        store.getState().setSelectedTerritory(10);
      });

      expect(store.getState().selectedTerritory).toBe(10);
    });

    it('should manage modal state', () => {
      act(() => {
        store.getState().openModal('combat');
      });

      expect(store.getState().activeModal).toBe('combat');

      act(() => {
        store.getState().closeModal();
      });

      expect(store.getState().activeModal).toBeNull();
    });

    it('should toggle game log visibility', () => {
      expect(store.getState().showGameLog).toBe(false);

      act(() => {
        store.getState().toggleGameLog();
      });

      expect(store.getState().showGameLog).toBe(true);
    });
  });

  // ============================================
  // PERSISTENCE
  // ============================================
  describe('Persistence', () => {
    it('should persist UI preferences', () => {
      act(() => {
        store.getState().setZoomLevel(1.5);
        store.getState().setPanPosition({ x: 100, y: 50 });
      });

      // Simulate page reload by creating new store with hydration
      const persisted = store.getState().getPersistedState();

      const newStore = createGameStore();
      newStore.getState().hydrate(persisted);

      expect(newStore.getState().zoomLevel).toBe(1.5);
    });
  });
});
