/**
 * Reinforcement System Unit Tests
 * Tests for: troop calculation, continent bonuses, card trading
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBaseTroops,
  calculateContinentBonus,
  calculateTotalReinforcements,
  calculateCardTradeValue,
  validateCardTrade,
} from '../../src/engine/reinforcement';
import { Player, Territory, Continent, Card } from '../../src/types';

describe('Reinforcement System', () => {
  // ============================================
  // BASE TROOP CALCULATION
  // ============================================
  describe('calculateBaseTroops', () => {
    it('should calculate floor((territories + population) / 3)', () => {
      // 9 territories, 0 population = floor(9/3) = 3
      expect(calculateBaseTroops(9, 0)).toBe(3);

      // 10 territories, 0 population = floor(10/3) = 3
      expect(calculateBaseTroops(10, 0)).toBe(3);

      // 11 territories, 0 population = floor(11/3) = 3
      expect(calculateBaseTroops(11, 0)).toBe(3);

      // 12 territories, 0 population = floor(12/3) = 4
      expect(calculateBaseTroops(12, 0)).toBe(4);
    });

    it('should include city population in calculation', () => {
      // 9 territories, 3 population = floor(12/3) = 4
      expect(calculateBaseTroops(9, 3)).toBe(4);

      // 6 territories, 6 population = floor(12/3) = 4
      expect(calculateBaseTroops(6, 6)).toBe(4);
    });

    it('should enforce minimum of 3 troops', () => {
      // 3 territories = floor(3/3) = 1, but minimum is 3
      expect(calculateBaseTroops(3, 0)).toBe(3);

      // 1 territory = floor(1/3) = 0, but minimum is 3
      expect(calculateBaseTroops(1, 0)).toBe(3);

      // 6 territories = floor(6/3) = 2, but minimum is 3
      expect(calculateBaseTroops(6, 0)).toBe(3);
    });

    it('should handle edge case of 0 territories (eliminated player respawn)', () => {
      expect(calculateBaseTroops(0, 0)).toBe(3);
    });
  });

  // ============================================
  // CONTINENT BONUS CALCULATION
  // ============================================
  describe('calculateContinentBonus', () => {
    const continents: Continent[] = [
      { id: 0, name: 'North America', territoryIds: [0, 1, 2, 3, 4, 5, 6, 7, 8], bonus: 5 },
      { id: 1, name: 'South America', territoryIds: [9, 10, 11, 12], bonus: 2 },
      { id: 2, name: 'Europe', territoryIds: [13, 14, 15, 16, 17, 18, 19], bonus: 5 },
      { id: 3, name: 'Africa', territoryIds: [20, 21, 22, 23, 24, 25], bonus: 3 },
      { id: 4, name: 'Asia', territoryIds: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37], bonus: 7 },
      { id: 5, name: 'Australia', territoryIds: [38, 39, 40, 41], bonus: 2 },
    ];

    it('should return 0 when player controls no complete continent', () => {
      const controlledTerritories = [0, 1, 2]; // Partial North America

      expect(calculateContinentBonus(controlledTerritories, continents)).toBe(0);
    });

    it('should return bonus for single controlled continent', () => {
      // Control all of South America
      const controlledTerritories = [9, 10, 11, 12];

      expect(calculateContinentBonus(controlledTerritories, continents)).toBe(2);
    });

    it('should sum bonuses for multiple controlled continents', () => {
      // Control South America (2) and Australia (2)
      const controlledTerritories = [9, 10, 11, 12, 38, 39, 40, 41];

      expect(calculateContinentBonus(controlledTerritories, continents)).toBe(4);
    });

    it('should return correct bonus for each continent', () => {
      // Test each continent individually
      expect(calculateContinentBonus([0, 1, 2, 3, 4, 5, 6, 7, 8], continents)).toBe(5); // NA
      expect(calculateContinentBonus([9, 10, 11, 12], continents)).toBe(2); // SA
      expect(calculateContinentBonus([13, 14, 15, 16, 17, 18, 19], continents)).toBe(5); // EU
      expect(calculateContinentBonus([20, 21, 22, 23, 24, 25], continents)).toBe(3); // AF
      expect(calculateContinentBonus([26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37], continents)).toBe(7); // AS
      expect(calculateContinentBonus([38, 39, 40, 41], continents)).toBe(2); // AU
    });

    it('should not count continent if missing even one territory', () => {
      // Missing territory 12 from South America
      const controlledTerritories = [9, 10, 11];

      expect(calculateContinentBonus(controlledTerritories, continents)).toBe(0);
    });

    it('should handle controlling all continents (world domination)', () => {
      const allTerritories = Array.from({ length: 42 }, (_, i) => i);

      // 5 + 2 + 5 + 3 + 7 + 2 = 24
      expect(calculateContinentBonus(allTerritories, continents)).toBe(24);
    });
  });

  // ============================================
  // CARD TRADE VALUE
  // ============================================
  describe('calculateCardTradeValue', () => {
    it('should return correct troops for each coin total', () => {
      expect(calculateCardTradeValue(2)).toBe(1);
      expect(calculateCardTradeValue(3)).toBe(2);
      expect(calculateCardTradeValue(4)).toBe(3);
      expect(calculateCardTradeValue(5)).toBe(4);
      expect(calculateCardTradeValue(6)).toBe(5);
      expect(calculateCardTradeValue(7)).toBe(6);
      expect(calculateCardTradeValue(8)).toBe(7);
      expect(calculateCardTradeValue(9)).toBe(8);
    });

    it('should return 10 troops for 10+ coins', () => {
      expect(calculateCardTradeValue(10)).toBe(10);
      expect(calculateCardTradeValue(11)).toBe(10);
      expect(calculateCardTradeValue(15)).toBe(10);
      expect(calculateCardTradeValue(20)).toBe(10);
    });

    it('should return 0 for less than 2 coins', () => {
      expect(calculateCardTradeValue(0)).toBe(0);
      expect(calculateCardTradeValue(1)).toBe(0);
    });
  });

  // ============================================
  // CARD TRADE VALIDATION
  // ============================================
  describe('validateCardTrade', () => {
    describe('Trade for Troops', () => {
      it('should require minimum 2 coins to trade for troops', () => {
        const cards: Card[] = [{ id: 1, coinValue: 1 }];

        const result = validateCardTrade(cards, 'troops');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Minimum 2 coins required');
      });

      it('should allow trade with 2+ coins', () => {
        const cards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
        ];

        const result = validateCardTrade(cards, 'troops');

        expect(result.valid).toBe(true);
        expect(result.troopsReceived).toBe(1);
      });

      it('should calculate correct sum of card values', () => {
        const cards: Card[] = [
          { id: 1, coinValue: 3 },
          { id: 2, coinValue: 2 },
          { id: 3, coinValue: 1 },
        ];

        const result = validateCardTrade(cards, 'troops');

        expect(result.valid).toBe(true);
        expect(result.totalCoins).toBe(6);
        expect(result.troopsReceived).toBe(5);
      });
    });

    describe('Trade for Star', () => {
      it('should require exactly 4 cards to trade for star', () => {
        const threeCards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
          { id: 3, coinValue: 1 },
        ];

        const fiveCards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
          { id: 3, coinValue: 1 },
          { id: 4, coinValue: 1 },
          { id: 5, coinValue: 1 },
        ];

        expect(validateCardTrade(threeCards, 'star').valid).toBe(false);
        expect(validateCardTrade(threeCards, 'star').error).toBe('Exactly 4 cards required');
        expect(validateCardTrade(fiveCards, 'star').valid).toBe(false);
      });

      it('should allow trade with exactly 4 cards', () => {
        const fourCards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
          { id: 3, coinValue: 1 },
          { id: 4, coinValue: 1 },
        ];

        const result = validateCardTrade(fourCards, 'star');

        expect(result.valid).toBe(true);
        expect(result.starsReceived).toBe(1);
      });

      it('should ignore coin values when trading for star', () => {
        const fourHighValueCards: Card[] = [
          { id: 1, coinValue: 6 },
          { id: 2, coinValue: 6 },
          { id: 3, coinValue: 6 },
          { id: 4, coinValue: 6 },
        ];

        const result = validateCardTrade(fourHighValueCards, 'star');

        expect(result.valid).toBe(true);
        expect(result.starsReceived).toBe(1); // Still just 1 star
      });
    });

    describe('Invalid Trade Types', () => {
      it('should reject invalid trade types', () => {
        const cards: Card[] = [{ id: 1, coinValue: 5 }];

        expect(() => validateCardTrade(cards, 'invalid' as any)).toThrow();
      });
    });
  });

  // ============================================
  // TOTAL REINFORCEMENT CALCULATION
  // ============================================
  describe('calculateTotalReinforcements', () => {
    const continents: Continent[] = [
      { id: 0, name: 'North America', territoryIds: [0, 1, 2, 3, 4, 5, 6, 7, 8], bonus: 5 },
      { id: 1, name: 'South America', territoryIds: [9, 10, 11, 12], bonus: 2 },
    ];

    it('should sum base troops and continent bonuses', () => {
      const controlledTerritories = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // All NA = 9 territories
      const cityPopulation = 0;

      const result = calculateTotalReinforcements(
        controlledTerritories,
        cityPopulation,
        continents,
        0 // No card trade
      );

      // Base: floor(9/3) = 3, Continent: 5, Total: 8
      expect(result.base).toBe(3);
      expect(result.continentBonus).toBe(5);
      expect(result.cardBonus).toBe(0);
      expect(result.total).toBe(8);
    });

    it('should include card trade bonus', () => {
      const controlledTerritories = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const cityPopulation = 2;
      const cardTradeCoins = 5;

      const result = calculateTotalReinforcements(
        controlledTerritories,
        cityPopulation,
        continents,
        cardTradeCoins
      );

      // Base: floor((13+2)/3) = 5
      // Continent: 5 (NA) + 2 (SA) = 7
      // Card: 4 troops (for 5 coins)
      // Total: 16
      expect(result.base).toBe(5);
      expect(result.continentBonus).toBe(7);
      expect(result.cardBonus).toBe(4);
      expect(result.total).toBe(16);
    });

    it('should apply faction power bonuses (Imperial Balkania Recruitment Offices)', () => {
      const controlledTerritories = [0, 1, 2, 3]; // 4 territories
      const cityPopulation = 3; // 3 cities
      const factionPower = 'recruitment_offices';

      const result = calculateTotalReinforcements(
        controlledTerritories,
        cityPopulation,
        continents,
        0,
        factionPower,
        3 // 3 territories with cities
      );

      // Base: floor((4+3)/3) = 2, minimum 3
      // Continent: 0
      // Faction: +3 (one per city territory)
      expect(result.base).toBe(3);
      expect(result.factionBonus).toBe(3);
      expect(result.total).toBe(6);
    });

    it('should apply faction power (Imperial Balkania Established: start with 10)', () => {
      // This is tested at game start, not reinforcement
      // But we should ensure it doesn't affect normal reinforcement
      const result = calculateTotalReinforcements([0, 1, 2], 0, continents, 0, 'established');

      expect(result.factionBonus).toBe(0); // No ongoing bonus
    });
  });

  // ============================================
  // TROOP PLACEMENT VALIDATION
  // ============================================
  describe('Troop Placement Validation', () => {
    it('should only allow placement on controlled territories', () => {
      const controlledTerritories = [1, 2, 3];

      expect(validatePlacement(1, controlledTerritories)).toBe(true);
      expect(validatePlacement(4, controlledTerritories)).toBe(false);
    });

    it('should require placing all troops before ending phase', () => {
      const troopsRemaining = 5;
      const troopsPlaced = 3;

      expect(canEndReinforcementPhase(troopsRemaining, troopsPlaced)).toBe(false);
      expect(canEndReinforcementPhase(5, 5)).toBe(true);
    });

    it('should not allow placing more troops than available', () => {
      expect(validatePlacementCount(3, 5)).toBe(false);
      expect(validatePlacementCount(5, 5)).toBe(true);
      expect(validatePlacementCount(5, 3)).toBe(true);
    });

    describe('Khan Industries Rapid Deployment', () => {
      it('should allow placement on any controlled territory regardless of connectivity', () => {
        // Standard rule requires connectivity from HQ
        // Rapid Deployment ignores this
        const controlledTerritories = [1, 10, 25]; // Disconnected territories
        const factionPower = 'rapid_deployment';

        expect(validatePlacement(25, controlledTerritories, factionPower)).toBe(true);
      });
    });
  });
});

// Helper functions (stubs for actual implementation)
function validatePlacement(
  territoryId: number,
  controlledTerritories: number[],
  factionPower?: string
): boolean {
  return controlledTerritories.includes(territoryId);
}

function canEndReinforcementPhase(troopsRemaining: number, troopsPlaced: number): boolean {
  return troopsPlaced >= troopsRemaining;
}

function validatePlacementCount(available: number, toPlace: number): boolean {
  return toPlace <= available;
}
