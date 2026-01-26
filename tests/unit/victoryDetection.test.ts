import { describe, it, expect } from 'vitest';
import {
  checkVictory,
  checkStarVictory,
  checkLastStandingVictory,
  checkElimination,
  STARS_FOR_VICTORY,
} from '@/utils/victoryDetection';
import { Player } from '@/types/player';

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
    hqTerritory: 'eastern_australia',
    redStars: 1,
    missiles: 0,
    cards: [],
    isEliminated: false,
    conqueredThisTurn: false,
    ...overrides,
  };
}

describe('Victory Detection', () => {
  describe('STARS_FOR_VICTORY constant', () => {
    it('should be 4', () => {
      expect(STARS_FOR_VICTORY).toBe(4);
    });
  });

  describe('checkStarVictory', () => {
    it('should return no victory when no player has 4 stars', () => {
      const players = [
        createMockPlayer({ id: 'p1', redStars: 2 }),
        createMockPlayer({ id: 'p2', redStars: 3 }),
      ];

      const result = checkStarVictory(players);
      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return victory when a player has exactly 4 stars', () => {
      const players = [
        createMockPlayer({ id: 'p1', name: 'Winner', redStars: 4 }),
        createMockPlayer({ id: 'p2', redStars: 2 }),
      ];

      const result = checkStarVictory(players);
      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.winnerName).toBe('Winner');
      expect(result.condition).toBe('RED_STARS');
      expect(result.starCount).toBe(4);
    });

    it('should return victory when a player has more than 4 stars', () => {
      const players = [
        createMockPlayer({ id: 'p1', redStars: 1 }),
        createMockPlayer({ id: 'p2', name: 'Big Winner', redStars: 5 }),
      ];

      const result = checkStarVictory(players);
      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
      expect(result.starCount).toBe(5);
    });
  });

  describe('checkLastStandingVictory', () => {
    it('should return no victory when multiple players are active', () => {
      const players = [
        createMockPlayer({ id: 'p1', isEliminated: false }),
        createMockPlayer({ id: 'p2', isEliminated: false }),
      ];

      const result = checkLastStandingVictory(players);
      expect(result.isVictory).toBe(false);
    });

    it('should return victory when only one player remains', () => {
      const players = [
        createMockPlayer({ id: 'p1', name: 'Survivor', isEliminated: false, redStars: 2 }),
        createMockPlayer({ id: 'p2', isEliminated: true }),
        createMockPlayer({ id: 'p3', isEliminated: true }),
      ];

      const result = checkLastStandingVictory(players);
      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.winnerName).toBe('Survivor');
      expect(result.condition).toBe('LAST_STANDING');
    });
  });

  describe('checkVictory', () => {
    it('should prioritize star victory over last standing', () => {
      const players = [
        createMockPlayer({ id: 'p1', name: 'Star Winner', redStars: 4, isEliminated: false }),
        createMockPlayer({ id: 'p2', isEliminated: true }),
      ];

      const result = checkVictory(players);
      expect(result.condition).toBe('RED_STARS');
    });

    it('should return last standing when no star victory', () => {
      const players = [
        createMockPlayer({ id: 'p1', redStars: 2, isEliminated: false }),
        createMockPlayer({ id: 'p2', isEliminated: true }),
      ];

      const result = checkVictory(players);
      expect(result.isVictory).toBe(true);
      expect(result.condition).toBe('LAST_STANDING');
    });

    it('should return no victory when game is ongoing', () => {
      const players = [
        createMockPlayer({ id: 'p1', redStars: 2, isEliminated: false }),
        createMockPlayer({ id: 'p2', redStars: 3, isEliminated: false }),
      ];

      const result = checkVictory(players);
      expect(result.isVictory).toBe(false);
    });
  });

  describe('checkElimination', () => {
    it('should return true when player has no territories', () => {
      const territories = {
        't1': { id: 't1', name: 'T1', continentId: 0, neighbors: [], ownerId: 'p2', troopCount: 5, scarId: null, cityTier: 0, cityName: null, fortified: false, fortifyDamage: 0 },
      };

      const result = checkElimination('p1', territories);
      expect(result).toBe(true);
    });

    it('should return false when player has territories', () => {
      const territories = {
        't1': { id: 't1', name: 'T1', continentId: 0, neighbors: [], ownerId: 'p1', troopCount: 5, scarId: null, cityTier: 0, cityName: null, fortified: false, fortifyDamage: 0 },
      };

      const result = checkElimination('p1', territories);
      expect(result).toBe(false);
    });
  });
});
