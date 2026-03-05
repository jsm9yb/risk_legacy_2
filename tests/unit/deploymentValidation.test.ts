import { describe, it, expect } from 'vitest';
import {
  validateAddTroop,
  validateRemoveTroop,
  validateConfirmDeployment,
  getDeployableTerritories,
} from '@/utils/deploymentValidation';
import { TerritoryState } from '@/types/territory';

// Helper to create a mock territory
function createMockTerritory(overrides: Partial<TerritoryState> = {}): TerritoryState {
  return {
    id: 't1',
    name: 'Test Territory',
    continentId: 0,
    neighbors: [],
    ownerId: null,
    troopCount: 5,
    scarId: null,
    cityTier: 0,
    cityName: null,
    fortified: false,
    fortifyDamage: 0,
    ...overrides,
  };
}

describe('Deployment Validation', () => {
  describe('validateAddTroop', () => {
    it('should allow adding troops to owned territory', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p1' }),
      };

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 5,
        isPlayerTurn: true,
        isCorrectPhase: true,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject adding troops when none remaining', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p1' }),
      };

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 0, // No troops remaining
        isPlayerTurn: true,
        isCorrectPhase: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('should reject adding troops to enemy territory', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p2' }),
      };

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 5,
        isPlayerTurn: true,
        isCorrectPhase: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TERRITORY_NOT_OWNED');
    });

    it('should reject adding troops in wrong phase', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p1' }),
      };

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 5,
        isPlayerTurn: true,
        isCorrectPhase: false, // Wrong phase
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHASE');
    });

    it('should reject adding troops when not player turn', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p1' }),
      };

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 5,
        isPlayerTurn: false, // Not player's turn
        isCorrectPhase: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NOT_YOUR_TURN');
    });

    it('should reject adding troops to non-existent territory', () => {
      const territories = {};

      const result = validateAddTroop({
        territoryId: 't1',
        territoryStates: territories,
        currentPlayerId: 'p1',
        troopsRemaining: 5,
        isPlayerTurn: true,
        isCorrectPhase: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_TERRITORY');
    });
  });

  describe('validateRemoveTroop', () => {
    it('should allow removing pending troops', () => {
      const pendingDeployments = { 't1': 3 };

      const result = validateRemoveTroop('t1', pendingDeployments, true, true);
      expect(result.valid).toBe(true);
    });

    it('should reject removing when no pending deployments', () => {
      const pendingDeployments = {};

      const result = validateRemoveTroop('t1', pendingDeployments, true, true);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('should reject removing when not player turn', () => {
      const pendingDeployments = { 't1': 3 };

      const result = validateRemoveTroop('t1', pendingDeployments, false, true);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NOT_YOUR_TURN');
    });
  });

  describe('validateConfirmDeployment', () => {
    it('should allow confirming when all troops placed', () => {
      const result = validateConfirmDeployment(0, true, true);
      expect(result.valid).toBe(true);
    });

    it('should allow confirming with troops remaining', () => {
      const result = validateConfirmDeployment(3, true, true);
      expect(result.valid).toBe(true);
    });

    it('should reject in wrong phase', () => {
      const result = validateConfirmDeployment(0, true, false);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHASE');
    });
  });

  describe('getDeployableTerritories', () => {
    it('should return only territories owned by player', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p1' }),
        't2': createMockTerritory({ id: 't2', ownerId: 'p2' }),
        't3': createMockTerritory({ id: 't3', ownerId: 'p1' }),
      };

      const deployable = getDeployableTerritories(territories, 'p1');
      expect(deployable).toContain('t1');
      expect(deployable).not.toContain('t2');
      expect(deployable).toContain('t3');
      expect(deployable).toHaveLength(2);
    });

    it('should return empty array when player owns no territories', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p2' }),
      };

      const deployable = getDeployableTerritories(territories, 'p1');
      expect(deployable).toHaveLength(0);
    });
  });
});
