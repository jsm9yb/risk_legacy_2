import { describe, it, expect } from 'vitest';
import {
  isLegalHQTerritory,
  getLegalHQTerritories,
  validateHQPlacement,
  getStartingTroops,
} from '@/utils/hqValidation';
import { TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';

// Helper to create a mock territory
function createMockTerritory(overrides: Partial<TerritoryState> = {}): TerritoryState {
  return {
    id: 't1',
    name: 'Test Territory',
    continentId: 0,
    neighbors: [],
    ownerId: null,
    troopCount: 0,
    scarId: null,
    cityTier: 0,
    cityName: null,
    fortified: false,
    fortifyDamage: 0,
    ...overrides,
  };
}

// Helper to create a mock player
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Test Player',
    gameId: 'game-1',
    userId: 'user-1',
    seatIndex: 0,
    factionId: 'khan',
    activePower: 'rapid_deployment',
    color: '#2F4F4F',
    hqTerritory: '',
    redStars: 0,
    missiles: 0,
    cards: [],
    isEliminated: false,
    conqueredThisTurn: false,
    ...overrides,
  };
}

describe('HQ Validation', () => {
  describe('getStartingTroops', () => {
    it('should return 8 for normal factions', () => {
      const player = createMockPlayer({ factionId: 'khan' });
      expect(getStartingTroops(player)).toBe(8);
    });

    it('should return 10 for Balkania with Established power', () => {
      const player = createMockPlayer({
        factionId: 'balkania',
        activePower: 'established',
      });
      expect(getStartingTroops(player)).toBe(10);
    });

    it('should return 8 for Balkania with other power', () => {
      const player = createMockPlayer({
        factionId: 'balkania',
        activePower: 'other_power',
      });
      expect(getStartingTroops(player)).toBe(8);
    });
  });

  describe('isLegalHQTerritory', () => {
    it('should return true for unmarked, unoccupied territory not adjacent to HQ', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', neighbors: ['t2'] }),
        't2': createMockTerritory({ id: 't2', neighbors: ['t1'] }),
      };
      const players: Player[] = [];

      expect(isLegalHQTerritory('t1', territories, players, 'p1')).toBe(true);
    });

    it('should return false for occupied territory', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', ownerId: 'p2' }),
      };
      const players: Player[] = [];

      expect(isLegalHQTerritory('t1', territories, players, 'p1')).toBe(false);
    });

    it('should return false for territory with scar', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', scarId: 'bunker' }),
      };
      const players: Player[] = [];

      expect(isLegalHQTerritory('t1', territories, players, 'p1')).toBe(false);
    });

    it('should return false for territory adjacent to existing HQ', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', neighbors: ['t2'] }),
        't2': createMockTerritory({ id: 't2', neighbors: ['t1'] }),
      };
      const players = [
        createMockPlayer({ id: 'p2', hqTerritory: 't2' }),
      ];

      expect(isLegalHQTerritory('t1', territories, players, 'p1')).toBe(false);
    });

    it('should return false for non-existent territory', () => {
      const territories = {};
      const players: Player[] = [];

      expect(isLegalHQTerritory('t1', territories, players, 'p1')).toBe(false);
    });
  });

  describe('getLegalHQTerritories', () => {
    it('should return all legal territories', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1', neighbors: [] }),
        't2': createMockTerritory({ id: 't2', neighbors: [], scarId: 'bunker' }),
        't3': createMockTerritory({ id: 't3', neighbors: [] }),
      };
      const players: Player[] = [];

      const legal = getLegalHQTerritories(territories, players, 'p1');
      expect(legal).toContain('t1');
      expect(legal).not.toContain('t2'); // Has scar
      expect(legal).toContain('t3');
    });
  });

  describe('validateHQPlacement', () => {
    it('should return invalid when not in HQ_PLACEMENT phase', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1' }),
      };
      const players = [createMockPlayer({ id: 'p1' })];

      const result = validateHQPlacement('t1', territories, players, 'p1', 0, 'FACTION_SELECTION');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHASE');
    });

    it('should return invalid when not players turn', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1' }),
      };
      const players = [
        createMockPlayer({ id: 'p1' }),
        createMockPlayer({ id: 'p2' }),
      ];

      const result = validateHQPlacement('t1', territories, players, 'p2', 0, 'HQ_PLACEMENT');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NOT_YOUR_TURN');
    });

    it('should return valid for legal placement', () => {
      const territories = {
        't1': createMockTerritory({ id: 't1' }),
      };
      const players = [createMockPlayer({ id: 'p1' })];

      const result = validateHQPlacement('t1', territories, players, 'p1', 0, 'HQ_PLACEMENT');
      expect(result.valid).toBe(true);
    });
  });
});
