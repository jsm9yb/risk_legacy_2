/**
 * Map System Unit Tests
 * Tests for: adjacency, pathfinding, continent control
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAdjacent,
  findPath,
  getControlledContinents,
  getConnectedTerritories,
  validateManeuver,
} from '../../src/engine/map';
import { Territory, Continent } from '../../src/types';

// Standard Risk map data for testing
const territories: Territory[] = [
  // North America (0-8)
  { id: 0, name: 'Alaska', continentId: 0, neighbors: [1, 5, 31], ownerId: null, troopCount: 0 },
  { id: 1, name: 'Northwest Territory', continentId: 0, neighbors: [0, 2, 3, 5], ownerId: null, troopCount: 0 },
  { id: 2, name: 'Greenland', continentId: 0, neighbors: [1, 3, 4, 13], ownerId: null, troopCount: 0 },
  { id: 3, name: 'Alberta', continentId: 0, neighbors: [1, 5, 6], ownerId: null, troopCount: 0 },
  { id: 4, name: 'Ontario', continentId: 0, neighbors: [2, 3, 5, 6, 7], ownerId: null, troopCount: 0 },
  { id: 5, name: 'Quebec', continentId: 0, neighbors: [2, 4, 7], ownerId: null, troopCount: 0 },
  { id: 6, name: 'Western United States', continentId: 0, neighbors: [3, 4, 7, 8], ownerId: null, troopCount: 0 },
  { id: 7, name: 'Eastern United States', continentId: 0, neighbors: [4, 5, 6, 8], ownerId: null, troopCount: 0 },
  { id: 8, name: 'Central America', continentId: 0, neighbors: [6, 7, 9], ownerId: null, troopCount: 0 },

  // South America (9-12)
  { id: 9, name: 'Venezuela', continentId: 1, neighbors: [8, 10, 11], ownerId: null, troopCount: 0 },
  { id: 10, name: 'Peru', continentId: 1, neighbors: [9, 11, 12], ownerId: null, troopCount: 0 },
  { id: 11, name: 'Brazil', continentId: 1, neighbors: [9, 10, 12, 20], ownerId: null, troopCount: 0 },
  { id: 12, name: 'Argentina', continentId: 1, neighbors: [10, 11], ownerId: null, troopCount: 0 },

  // Europe (13-19)
  { id: 13, name: 'Iceland', continentId: 2, neighbors: [2, 14, 15], ownerId: null, troopCount: 0 },
  { id: 14, name: 'Scandinavia', continentId: 2, neighbors: [13, 15, 16, 26], ownerId: null, troopCount: 0 },
  { id: 15, name: 'Great Britain', continentId: 2, neighbors: [13, 14, 16, 17], ownerId: null, troopCount: 0 },
  { id: 16, name: 'Northern Europe', continentId: 2, neighbors: [14, 15, 17, 18, 19, 26], ownerId: null, troopCount: 0 },
  { id: 17, name: 'Western Europe', continentId: 2, neighbors: [15, 16, 18, 20], ownerId: null, troopCount: 0 },
  { id: 18, name: 'Southern Europe', continentId: 2, neighbors: [16, 17, 19, 20, 21, 27], ownerId: null, troopCount: 0 },
  { id: 19, name: 'Ukraine', continentId: 2, neighbors: [14, 16, 18, 26, 27, 30], ownerId: null, troopCount: 0 },

  // Africa (20-25)
  { id: 20, name: 'North Africa', continentId: 3, neighbors: [11, 17, 18, 21, 22, 23], ownerId: null, troopCount: 0 },
  { id: 21, name: 'Egypt', continentId: 3, neighbors: [18, 20, 22, 27], ownerId: null, troopCount: 0 },
  { id: 22, name: 'East Africa', continentId: 3, neighbors: [20, 21, 23, 24, 25, 27], ownerId: null, troopCount: 0 },
  { id: 23, name: 'Congo', continentId: 3, neighbors: [20, 22, 24], ownerId: null, troopCount: 0 },
  { id: 24, name: 'South Africa', continentId: 3, neighbors: [22, 23, 25], ownerId: null, troopCount: 0 },
  { id: 25, name: 'Madagascar', continentId: 3, neighbors: [22, 24], ownerId: null, troopCount: 0 },

  // Asia (26-37)
  { id: 26, name: 'Ural', continentId: 4, neighbors: [14, 16, 19, 27, 30, 32], ownerId: null, troopCount: 0 },
  { id: 27, name: 'Middle East', continentId: 4, neighbors: [18, 19, 21, 22, 26, 28], ownerId: null, troopCount: 0 },
  { id: 28, name: 'Afghanistan', continentId: 4, neighbors: [26, 27, 29, 30], ownerId: null, troopCount: 0 },
  { id: 29, name: 'India', continentId: 4, neighbors: [27, 28, 30, 35], ownerId: null, troopCount: 0 },
  { id: 30, name: 'China', continentId: 4, neighbors: [26, 28, 29, 31, 32, 35], ownerId: null, troopCount: 0 },
  { id: 31, name: 'Kamchatka', continentId: 4, neighbors: [0, 30, 32, 33, 34], ownerId: null, troopCount: 0 },
  { id: 32, name: 'Siberia', continentId: 4, neighbors: [26, 30, 31, 33, 34], ownerId: null, troopCount: 0 },
  { id: 33, name: 'Irkutsk', continentId: 4, neighbors: [31, 32, 34], ownerId: null, troopCount: 0 },
  { id: 34, name: 'Yakutsk', continentId: 4, neighbors: [31, 32, 33], ownerId: null, troopCount: 0 },
  { id: 35, name: 'Siam', continentId: 4, neighbors: [29, 30, 38], ownerId: null, troopCount: 0 },
  { id: 36, name: 'Japan', continentId: 4, neighbors: [31, 30], ownerId: null, troopCount: 0 },
  { id: 37, name: 'Mongolia', continentId: 4, neighbors: [30, 31, 32, 33, 36], ownerId: null, troopCount: 0 },

  // Australia (38-41)
  { id: 38, name: 'Indonesia', continentId: 5, neighbors: [35, 39, 40], ownerId: null, troopCount: 0 },
  { id: 39, name: 'New Guinea', continentId: 5, neighbors: [38, 40, 41], ownerId: null, troopCount: 0 },
  { id: 40, name: 'Western Australia', continentId: 5, neighbors: [38, 39, 41], ownerId: null, troopCount: 0 },
  { id: 41, name: 'Eastern Australia', continentId: 5, neighbors: [39, 40], ownerId: null, troopCount: 0 },
];

const continents: Continent[] = [
  { id: 0, name: 'North America', territoryIds: [0, 1, 2, 3, 4, 5, 6, 7, 8], bonus: 5 },
  { id: 1, name: 'South America', territoryIds: [9, 10, 11, 12], bonus: 2 },
  { id: 2, name: 'Europe', territoryIds: [13, 14, 15, 16, 17, 18, 19], bonus: 5 },
  { id: 3, name: 'Africa', territoryIds: [20, 21, 22, 23, 24, 25], bonus: 3 },
  { id: 4, name: 'Asia', territoryIds: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37], bonus: 7 },
  { id: 5, name: 'Australia', territoryIds: [38, 39, 40, 41], bonus: 2 },
];

describe('Map System', () => {
  // ============================================
  // ADJACENCY CHECKS
  // ============================================
  describe('isAdjacent', () => {
    it('should return true for adjacent territories', () => {
      expect(isAdjacent(0, 1, territories)).toBe(true); // Alaska - NW Territory
      expect(isAdjacent(1, 0, territories)).toBe(true); // Bidirectional
    });

    it('should return false for non-adjacent territories', () => {
      expect(isAdjacent(0, 2, territories)).toBe(false); // Alaska - Greenland
      expect(isAdjacent(9, 41, territories)).toBe(false); // Venezuela - E. Australia
    });

    it('should handle cross-continent sea connections', () => {
      expect(isAdjacent(0, 31, territories)).toBe(true); // Alaska - Kamchatka
      expect(isAdjacent(2, 13, territories)).toBe(true); // Greenland - Iceland
      expect(isAdjacent(11, 20, territories)).toBe(true); // Brazil - North Africa
      expect(isAdjacent(35, 38, territories)).toBe(true); // Siam - Indonesia
    });

    it('should verify all 42 territories have valid neighbor references', () => {
      territories.forEach((territory) => {
        territory.neighbors.forEach((neighborId) => {
          // Neighbor exists
          expect(territories.find((t) => t.id === neighborId)).toBeDefined();

          // Relationship is bidirectional
          const neighbor = territories.find((t) => t.id === neighborId)!;
          expect(neighbor.neighbors).toContain(territory.id);
        });
      });
    });
  });

  // ============================================
  // PATHFINDING
  // ============================================
  describe('findPath', () => {
    let mapState: Map<number, { ownerId: number | null }>;

    beforeEach(() => {
      mapState = new Map();
      territories.forEach((t) => mapState.set(t.id, { ownerId: null }));
    });

    it('should find direct path between adjacent territories', () => {
      mapState.set(0, { ownerId: 1 });
      mapState.set(1, { ownerId: 1 });

      const path = findPath(0, 1, 1, territories, mapState);

      expect(path).toEqual([0, 1]);
    });

    it('should find path through connected controlled territories', () => {
      // Player 1 controls a chain in North America
      [0, 1, 3, 6].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const path = findPath(0, 6, 1, territories, mapState);

      expect(path).not.toBeNull();
      expect(path![0]).toBe(0);
      expect(path![path!.length - 1]).toBe(6);

      // Verify all path segments are valid adjacencies
      for (let i = 0; i < path!.length - 1; i++) {
        expect(isAdjacent(path![i], path![i + 1], territories)).toBe(true);
      }
    });

    it('should return null when no path exists through controlled territories', () => {
      mapState.set(0, { ownerId: 1 }); // Alaska
      mapState.set(6, { ownerId: 1 }); // Western US
      // No connection - player doesn't control middle territories

      const path = findPath(0, 6, 1, territories, mapState);

      expect(path).toBeNull();
    });

    it('should not path through enemy territories', () => {
      mapState.set(0, { ownerId: 1 });
      mapState.set(1, { ownerId: 2 }); // Enemy controls NW Territory
      mapState.set(3, { ownerId: 1 });

      const path = findPath(0, 3, 1, territories, mapState);

      expect(path).toBeNull();
    });

    it('should not path through unoccupied territories', () => {
      mapState.set(0, { ownerId: 1 });
      mapState.set(1, { ownerId: null }); // Unoccupied
      mapState.set(3, { ownerId: 1 });

      const path = findPath(0, 3, 1, territories, mapState);

      expect(path).toBeNull();
    });

    it('should handle cross-continent paths', () => {
      // Control path from Alaska to Kamchatka to Siberia
      [0, 31, 32].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const path = findPath(0, 32, 1, territories, mapState);

      expect(path).toEqual([0, 31, 32]);
    });

    it('should find shortest path when multiple exist', () => {
      // Create two paths: Alaska -> NW -> Alberta (length 3) or longer route
      [0, 1, 3, 5, 2].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const path = findPath(0, 3, 1, territories, mapState);

      // Should be the direct path
      expect(path?.length).toBeLessThanOrEqual(3);
    });
  });

  // ============================================
  // CONNECTED TERRITORIES
  // ============================================
  describe('getConnectedTerritories', () => {
    let mapState: Map<number, { ownerId: number | null }>;

    beforeEach(() => {
      mapState = new Map();
      territories.forEach((t) => mapState.set(t.id, { ownerId: null }));
    });

    it('should return all territories connected to starting territory', () => {
      // Player controls small connected region
      [0, 1, 5, 31].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const connected = getConnectedTerritories(0, 1, territories, mapState);

      expect(connected).toContain(0);
      expect(connected).toContain(1);
      expect(connected).toContain(5);
      expect(connected).toContain(31);
      expect(connected.length).toBe(4);
    });

    it('should not include disconnected territories', () => {
      mapState.set(0, { ownerId: 1 }); // Alaska
      mapState.set(41, { ownerId: 1 }); // Eastern Australia - not connected

      const connected = getConnectedTerritories(0, 1, territories, mapState);

      expect(connected).toContain(0);
      expect(connected).not.toContain(41);
    });

    it('should handle single territory', () => {
      mapState.set(0, { ownerId: 1 });

      const connected = getConnectedTerritories(0, 1, territories, mapState);

      expect(connected).toEqual([0]);
    });
  });

  // ============================================
  // CONTINENT CONTROL
  // ============================================
  describe('getControlledContinents', () => {
    let mapState: Map<number, { ownerId: number | null }>;

    beforeEach(() => {
      mapState = new Map();
      territories.forEach((t) => mapState.set(t.id, { ownerId: null }));
    });

    it('should detect single continent control', () => {
      // Player 1 controls all of Australia
      [38, 39, 40, 41].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const controlled = getControlledContinents(1, territories, continents, mapState);

      expect(controlled).toContain(5); // Australia
      expect(controlled.length).toBe(1);
    });

    it('should detect multiple continent control', () => {
      // Player 1 controls South America and Australia
      [9, 10, 11, 12, 38, 39, 40, 41].forEach((id) => mapState.set(id, { ownerId: 1 }));

      const controlled = getControlledContinents(1, territories, continents, mapState);

      expect(controlled).toContain(1); // South America
      expect(controlled).toContain(5); // Australia
      expect(controlled.length).toBe(2);
    });

    it('should not count partial continent control', () => {
      // Player 1 controls 3 of 4 Australian territories
      [38, 39, 40].forEach((id) => mapState.set(id, { ownerId: 1 }));
      mapState.set(41, { ownerId: 2 }); // Enemy controls Eastern Australia

      const controlled = getControlledContinents(1, territories, continents, mapState);

      expect(controlled).not.toContain(5);
      expect(controlled.length).toBe(0);
    });

    it('should not count if territory is unoccupied', () => {
      [38, 39, 40].forEach((id) => mapState.set(id, { ownerId: 1 }));
      mapState.set(41, { ownerId: null }); // Unoccupied

      const controlled = getControlledContinents(1, territories, continents, mapState);

      expect(controlled.length).toBe(0);
    });

    it('should correctly identify all continents when all controlled', () => {
      territories.forEach((t) => mapState.set(t.id, { ownerId: 1 }));

      const controlled = getControlledContinents(1, territories, continents, mapState);

      expect(controlled.length).toBe(6);
      expect(controlled).toContain(0);
      expect(controlled).toContain(1);
      expect(controlled).toContain(2);
      expect(controlled).toContain(3);
      expect(controlled).toContain(4);
      expect(controlled).toContain(5);
    });
  });

  // ============================================
  // MANEUVER VALIDATION
  // ============================================
  describe('validateManeuver', () => {
    let mapState: Map<number, { ownerId: number | null; troopCount: number }>;

    beforeEach(() => {
      mapState = new Map();
      territories.forEach((t) =>
        mapState.set(t.id, { ownerId: null, troopCount: 0 })
      );
    });

    it('should allow valid maneuver between connected territories', () => {
      [0, 1, 3].forEach((id) => mapState.set(id, { ownerId: 1, troopCount: 5 }));

      const result = validateManeuver(0, 3, 3, 1, territories, mapState);

      expect(result.valid).toBe(true);
    });

    it('should reject maneuver from territory not owned by player', () => {
      mapState.set(0, { ownerId: 2, troopCount: 5 });
      mapState.set(1, { ownerId: 1, troopCount: 5 });

      const result = validateManeuver(0, 1, 2, 1, territories, mapState);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_TERRITORY');
    });

    it('should reject maneuver to territory not owned by player', () => {
      mapState.set(0, { ownerId: 1, troopCount: 5 });
      mapState.set(1, { ownerId: 2, troopCount: 5 });

      const result = validateManeuver(0, 1, 2, 1, territories, mapState);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_TERRITORY');
    });

    it('should reject maneuver if no path exists', () => {
      mapState.set(0, { ownerId: 1, troopCount: 5 });
      mapState.set(41, { ownerId: 1, troopCount: 5 }); // Not connected

      const result = validateManeuver(0, 41, 2, 1, territories, mapState);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('NO_PATH');
    });

    it('should reject maneuver leaving less than 1 troop', () => {
      [0, 1].forEach((id) => mapState.set(id, { ownerId: 1, troopCount: 3 }));

      const result = validateManeuver(0, 1, 3, 1, territories, mapState);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_TROOPS');
    });

    it('should allow moving all but one troop', () => {
      mapState.set(0, { ownerId: 1, troopCount: 5 });
      mapState.set(1, { ownerId: 1, troopCount: 1 });

      const result = validateManeuver(0, 1, 4, 1, territories, mapState);

      expect(result.valid).toBe(true);
    });

    describe('Saharan Republic Desert Nomads Power', () => {
      it('should allow path through ONE enemy territory', () => {
        mapState.set(0, { ownerId: 1, troopCount: 5 }); // Alaska
        mapState.set(1, { ownerId: 2, troopCount: 3 }); // NW Territory (enemy)
        mapState.set(3, { ownerId: 1, troopCount: 1 }); // Alberta

        const result = validateManeuver(0, 3, 2, 1, territories, mapState, 'desert_nomads');

        expect(result.valid).toBe(true);
      });

      it('should NOT allow path through TWO enemy territories', () => {
        mapState.set(0, { ownerId: 1, troopCount: 5 });
        mapState.set(1, { ownerId: 2, troopCount: 3 }); // Enemy
        mapState.set(3, { ownerId: 2, troopCount: 3 }); // Enemy
        mapState.set(6, { ownerId: 1, troopCount: 1 });

        const result = validateManeuver(0, 6, 2, 1, territories, mapState, 'desert_nomads');

        expect(result.valid).toBe(false);
      });
    });
  });

  // ============================================
  // EXPANSION INTO UNOCCUPIED TERRITORY
  // ============================================
  describe('Expansion (Attack on Unoccupied)', () => {
    it('should allow expansion into adjacent unoccupied territory', () => {
      const from = { ...territories[0], ownerId: 1, troopCount: 5 };
      const to = { ...territories[1], ownerId: null, troopCount: 0 };

      const result = validateExpansion(from, to, territories);

      expect(result.valid).toBe(true);
    });

    it('should require at least 2 troops in source territory', () => {
      const from = { ...territories[0], ownerId: 1, troopCount: 1 };
      const to = { ...territories[1], ownerId: null, troopCount: 0 };

      const result = validateExpansion(from, to, territories);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_TROOPS');
    });

    it('should calculate troop loss based on city population', () => {
      const from = { ...territories[0], ownerId: 1, troopCount: 5 };
      const to = { ...territories[1], ownerId: null, cityTier: 2, troopCount: 0 }; // Major city (pop 2)

      const result = calculateExpansionCost(from, to);

      expect(result.troopLoss).toBe(2);
    });

    it('should prevent expansion if troop loss would leave no troops', () => {
      const from = { ...territories[0], ownerId: 1, troopCount: 3 };
      const to = { ...territories[1], ownerId: null, cityTier: 3, troopCount: 0 }; // Capital (pop 3)

      const result = validateExpansion(from, to, territories);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Would not retain control');
    });

    it('should NOT grant card draw for expansion', () => {
      // This is a rule verification - expansion doesn't trigger conqueredThisTurn
      const isConquest = false; // Expansion is not combat
      expect(shouldDrawCard(isConquest)).toBe(false);
    });
  });
});

// Helper functions (stubs for actual implementation)
function validateExpansion(from: Territory, to: Territory, allTerritories: Territory[]) {
  if (from.troopCount < 2) {
    return { valid: false, error: 'INSUFFICIENT_TROOPS' };
  }
  if (!from.neighbors.includes(to.id)) {
    return { valid: false, error: 'NOT_ADJACENT' };
  }
  if (to.ownerId !== null) {
    return { valid: false, error: 'TERRITORY_OCCUPIED' };
  }

  const cityPop = to.cityTier || 0;
  if (from.troopCount - cityPop < 1) {
    return { valid: false, error: 'Would not retain control' };
  }

  return { valid: true };
}

function calculateExpansionCost(from: Territory, to: Territory) {
  const cityPop = to.cityTier || 0;
  return { troopLoss: cityPop };
}

function shouldDrawCard(isConquest: boolean): boolean {
  return isConquest; // Only combat conquest grants card draw
}
