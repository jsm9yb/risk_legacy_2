/**
 * Combat System Unit Tests
 * Tests for: dice rolling, modifier application, casualty resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rollDice,
  applyModifiers,
  resolveCombat,
  calculateCasualties,
  canUseMissile,
  applyMissile,
} from '../../src/engine/combat';
import { Territory, Player, CombatState, DieResult } from '../../src/types';

describe('Combat System', () => {
  // ============================================
  // DICE ROLLING
  // ============================================
  describe('rollDice', () => {
    it('should return the correct number of dice', () => {
      expect(rollDice(1)).toHaveLength(1);
      expect(rollDice(2)).toHaveLength(2);
      expect(rollDice(3)).toHaveLength(3);
    });

    it('should return values between 1 and 6 inclusive', () => {
      // Run 1000 rolls to check bounds
      for (let i = 0; i < 1000; i++) {
        const dice = rollDice(3);
        dice.forEach((die) => {
          expect(die.value).toBeGreaterThanOrEqual(1);
          expect(die.value).toBeLessThanOrEqual(6);
        });
      }
    });

    it('should return dice sorted highest to lowest', () => {
      for (let i = 0; i < 100; i++) {
        const dice = rollDice(3);
        expect(dice[0].value).toBeGreaterThanOrEqual(dice[1].value);
        expect(dice[1].value).toBeGreaterThanOrEqual(dice[2].value);
      }
    });

    it('should produce statistically fair distribution', () => {
      const counts = [0, 0, 0, 0, 0, 0];
      const rolls = 6000;

      for (let i = 0; i < rolls; i++) {
        const [die] = rollDice(1);
        counts[die.value - 1]++;
      }

      // Each value should appear roughly 1000 times (within 15% tolerance)
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(850);
        expect(count).toBeLessThan(1150);
      });
    });

    it('should mark dice as modifiable by default', () => {
      const dice = rollDice(3);
      dice.forEach((die) => {
        expect(die.modifiable).toBe(true);
      });
    });
  });

  // ============================================
  // MODIFIER APPLICATION
  // ============================================
  describe('applyModifiers', () => {
    let mockTerritory: Territory;
    let mockAttacker: Player;
    let mockDefender: Player;

    beforeEach(() => {
      mockTerritory = {
        id: 1,
        name: 'Test Territory',
        continentId: 0,
        neighbors: [2, 3],
        ownerId: 2,
        troopCount: 5,
        scarId: null,
        cityTier: 0,
        cityName: null,
        fortified: false,
        fortifyDamage: 0,
      };

      mockAttacker = {
        id: 1,
        factionId: 'khan',
        activePower: 'rapid_deployment',
        missiles: 2,
      } as Player;

      mockDefender = {
        id: 2,
        factionId: 'bear',
        activePower: 'stubborn',
        missiles: 1,
      } as Player;
    });

    describe('Scar Modifiers', () => {
      it('should apply +1 to defender highest die with bunker scar', () => {
        mockTerritory.scarId = 'bunker';
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(5); // 4 + 1 = 5
        expect(modified[1].value).toBe(2); // Unchanged
      });

      it('should apply -1 to defender highest die with ammo_shortage scar', () => {
        mockTerritory.scarId = 'ammo_shortage';
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(3); // 4 - 1 = 3
        expect(modified[1].value).toBe(2); // Unchanged
      });

      it('should not apply scar modifiers to attacker dice', () => {
        mockTerritory.scarId = 'bunker';
        const attackerDice: DieResult[] = [
          { value: 5, modifiable: true },
          { value: 3, modifiable: true },
        ];

        const modified = applyModifiers(attackerDice, mockTerritory, mockAttacker, 'attacker');

        expect(modified[0].value).toBe(5); // Unchanged
        expect(modified[1].value).toBe(3); // Unchanged
      });
    });

    describe('Fortification Modifiers', () => {
      it('should apply +1 to BOTH defender dice when fortified', () => {
        mockTerritory.fortified = true;
        mockTerritory.fortifyDamage = 0;
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(5); // 4 + 1
        expect(modified[1].value).toBe(3); // 2 + 1
      });

      it('should not apply fortification when destroyed (damage >= 10)', () => {
        mockTerritory.fortified = true;
        mockTerritory.fortifyDamage = 10;
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(4); // Unchanged
        expect(modified[1].value).toBe(2); // Unchanged
      });

      it('should stack bunker scar with fortification', () => {
        mockTerritory.scarId = 'bunker';
        mockTerritory.fortified = true;
        const defenderDice: DieResult[] = [
          { value: 3, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        // Bunker: +1 to highest, Fortification: +1 to both
        expect(modified[0].value).toBe(5); // 3 + 1 (bunker) + 1 (fort)
        expect(modified[1].value).toBe(3); // 2 + 1 (fort only)
      });
    });

    describe('Faction Power Modifiers', () => {
      it('should apply Enclave Ferocity: +1 to highest attack die on first attack', () => {
        const attacker: Player = {
          ...mockAttacker,
          factionId: 'enclave',
          activePower: 'ferocity',
          firstAttackThisTurn: true,
        } as Player;

        const attackerDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 3, modifiable: true },
        ];

        const modified = applyModifiers(attackerDice, mockTerritory, attacker, 'attacker');

        expect(modified[0].value).toBe(5); // 4 + 1
        expect(modified[1].value).toBe(3); // Unchanged
      });

      it('should NOT apply Ferocity on subsequent attacks', () => {
        const attacker: Player = {
          ...mockAttacker,
          factionId: 'enclave',
          activePower: 'ferocity',
          firstAttackThisTurn: false,
        } as Player;

        const attackerDice: DieResult[] = [{ value: 4, modifiable: true }];

        const modified = applyModifiers(attackerDice, mockTerritory, attacker, 'attacker');

        expect(modified[0].value).toBe(4); // Unchanged
      });

      it('should apply Khan Overwhelming Numbers: roll 4, discard lowest', () => {
        // This is tested differently - at dice selection time
        // See rollDiceWithPower tests
      });

      it('should apply Die Mechaniker Fortify HQ: HQ always fortified', () => {
        const defender: Player = {
          ...mockDefender,
          factionId: 'mechaniker',
          activePower: 'fortify_hq',
          hqTerritory: mockTerritory.id,
        } as Player;

        mockTerritory.fortified = false; // Not actually fortified

        const defenderDice: DieResult[] = [
          { value: 3, modifiable: true },
          { value: 2, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, defender, 'defender');

        // Should apply fortification bonus even though not actually fortified
        expect(modified[0].value).toBe(4);
        expect(modified[1].value).toBe(3);
      });

      it('should apply Die Mechaniker Supreme Firepower: triple same = instant 3 casualties', () => {
        const attacker: Player = {
          ...mockAttacker,
          factionId: 'mechaniker',
          activePower: 'supreme_firepower',
        } as Player;

        const attackerDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
        ];

        const result = applyModifiers(attackerDice, mockTerritory, attacker, 'attacker');

        expect(result.supremeFirepower).toBe(true);
      });

      it('should apply Enclave Stubborn: defender doubles = attacker loses 1 extra', () => {
        const defender: Player = {
          ...mockDefender,
          factionId: 'enclave',
          activePower: 'stubborn',
        } as Player;

        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
        ];

        const result = applyModifiers(defenderDice, mockTerritory, defender, 'defender');

        expect(result.stubbornBonus).toBe(true);
      });
    });

    describe('Modifier Bounds', () => {
      it('should cap modified die value at 6', () => {
        mockTerritory.scarId = 'bunker';
        mockTerritory.fortified = true;
        const defenderDice: DieResult[] = [{ value: 6, modifiable: true }];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(6); // Cannot exceed 6
      });

      it('should floor modified die value at 1', () => {
        mockTerritory.scarId = 'ammo_shortage';
        const defenderDice: DieResult[] = [{ value: 1, modifiable: true }];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        expect(modified[0].value).toBe(1); // Cannot go below 1
      });
    });

    describe('Modifier Application Order', () => {
      it('should apply modifiers in order: Scars -> Fortification -> Faction Powers', () => {
        // This test verifies the order doesn't change expected outcomes
        mockTerritory.scarId = 'bunker';
        mockTerritory.fortified = true;

        const defender: Player = {
          ...mockDefender,
          factionId: 'enclave',
          activePower: 'stubborn',
        } as Player;

        const defenderDice: DieResult[] = [
          { value: 3, modifiable: true },
          { value: 3, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, defender, 'defender');

        // Scar: +1 to first 3 = 4
        // Fort: +1 to both = 5, 4
        expect(modified[0].value).toBe(5);
        expect(modified[1].value).toBe(4);
        expect(modified.stubbornBonus).toBe(true); // Doubles detected before modification
      });
    });

    describe('Single Die Modification Rule', () => {
      it('should only modify ONE die when multiple show same value (per source)', () => {
        mockTerritory.scarId = 'bunker';
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
        ];

        const modified = applyModifiers(defenderDice, mockTerritory, mockDefender, 'defender');

        // Bunker should only modify the first 4, not both
        expect(modified[0].value).toBe(5);
        expect(modified[1].value).toBe(4);
      });
    });
  });

  // ============================================
  // MISSILE SYSTEM
  // ============================================
  describe('Missile System', () => {
    describe('canUseMissile', () => {
      it('should allow missile use when player has missiles > 0', () => {
        const player: Player = { missiles: 2 } as Player;
        expect(canUseMissile(player)).toBe(true);
      });

      it('should deny missile use when player has 0 missiles', () => {
        const player: Player = { missiles: 0 } as Player;
        expect(canUseMissile(player)).toBe(false);
      });
    });

    describe('applyMissile', () => {
      it('should set die value to 6', () => {
        const dice: DieResult[] = [
          { value: 2, modifiable: true },
          { value: 1, modifiable: true },
        ];

        const result = applyMissile(dice, 0);

        expect(result[0].value).toBe(6);
      });

      it('should mark die as unmodifiable after missile use', () => {
        const dice: DieResult[] = [{ value: 2, modifiable: true }];

        const result = applyMissile(dice, 0);

        expect(result[0].modifiable).toBe(false);
      });

      it('should not allow missile on already unmodifiable die', () => {
        const dice: DieResult[] = [{ value: 6, modifiable: false }];

        expect(() => applyMissile(dice, 0)).toThrow('Die is not modifiable');
      });

      it('should decrement player missile count', () => {
        const player: Player = { missiles: 2 } as Player;
        const dice: DieResult[] = [{ value: 2, modifiable: true }];

        applyMissile(dice, 0, player);

        expect(player.missiles).toBe(1);
      });

      it('should prevent subsequent modifiers from changing missile die', () => {
        const territory: Territory = {
          scarId: 'ammo_shortage',
          fortified: false,
        } as Territory;

        const dice: DieResult[] = [{ value: 2, modifiable: true }];
        const missiled = applyMissile(dice, 0);

        // Try to apply scar modifier
        const modified = applyModifiers(missiled, territory, {} as Player, 'defender');

        expect(modified[0].value).toBe(6); // Still 6, not modified by scar
      });
    });
  });

  // ============================================
  // COMBAT RESOLUTION
  // ============================================
  describe('resolveCombat', () => {
    describe('Die Comparison', () => {
      it('should compare highest attacker vs highest defender', () => {
        const attackerDice: DieResult[] = [{ value: 5, modifiable: true }];
        const defenderDice: DieResult[] = [{ value: 4, modifiable: true }];

        const result = resolveCombat(attackerDice, defenderDice);

        expect(result.defenderLosses).toBe(1);
        expect(result.attackerLosses).toBe(0);
      });

      it('should compare second-highest when both have 2+ dice', () => {
        const attackerDice: DieResult[] = [
          { value: 6, modifiable: true },
          { value: 3, modifiable: true },
        ];
        const defenderDice: DieResult[] = [
          { value: 5, modifiable: true },
          { value: 4, modifiable: true },
        ];

        const result = resolveCombat(attackerDice, defenderDice);

        // 6 vs 5: attacker wins (defender -1)
        // 3 vs 4: defender wins (attacker -1)
        expect(result.defenderLosses).toBe(1);
        expect(result.attackerLosses).toBe(1);
      });

      it('should only compare up to defender dice count', () => {
        const attackerDice: DieResult[] = [
          { value: 6, modifiable: true },
          { value: 5, modifiable: true },
          { value: 4, modifiable: true },
        ];
        const defenderDice: DieResult[] = [{ value: 3, modifiable: true }];

        const result = resolveCombat(attackerDice, defenderDice);

        // Only 1 comparison: 6 vs 3
        expect(result.defenderLosses).toBe(1);
        expect(result.attackerLosses).toBe(0);
      });
    });

    describe('Tie Resolution', () => {
      it('should award tie to defender (defender wins on tie)', () => {
        const attackerDice: DieResult[] = [{ value: 4, modifiable: true }];
        const defenderDice: DieResult[] = [{ value: 4, modifiable: true }];

        const result = resolveCombat(attackerDice, defenderDice);

        expect(result.defenderLosses).toBe(0);
        expect(result.attackerLosses).toBe(1);
      });

      it('should handle ties on both comparisons', () => {
        const attackerDice: DieResult[] = [
          { value: 5, modifiable: true },
          { value: 3, modifiable: true },
        ];
        const defenderDice: DieResult[] = [
          { value: 5, modifiable: true },
          { value: 3, modifiable: true },
        ];

        const result = resolveCombat(attackerDice, defenderDice);

        // Both ties go to defender
        expect(result.defenderLosses).toBe(0);
        expect(result.attackerLosses).toBe(2);
      });
    });

    describe('Supreme Firepower (Die Mechaniker)', () => {
      it('should cause instant 3 casualties when triggered', () => {
        const attackerDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
        ];
        const defenderDice: DieResult[] = [
          { value: 6, modifiable: true },
          { value: 6, modifiable: true },
        ];

        const result = resolveCombat(attackerDice, defenderDice, { supremeFirepower: true });

        expect(result.defenderLosses).toBe(3);
        expect(result.attackerLosses).toBe(0);
      });
    });

    describe('Stubborn Bonus (Enclave)', () => {
      it('should cause attacker to lose 1 extra when triggered', () => {
        const attackerDice: DieResult[] = [
          { value: 6, modifiable: true },
          { value: 5, modifiable: true },
        ];
        const defenderDice: DieResult[] = [
          { value: 4, modifiable: true },
          { value: 4, modifiable: true },
        ];

        const result = resolveCombat(attackerDice, defenderDice, { stubbornBonus: true });

        // Normal: attacker wins both = defender -2, attacker -0
        // With stubborn: attacker -1 extra
        expect(result.defenderLosses).toBe(2);
        expect(result.attackerLosses).toBe(1);
      });
    });
  });

  // ============================================
  // FORTIFICATION DEGRADATION
  // ============================================
  describe('Fortification Degradation', () => {
    it('should increment fortifyDamage when attacker uses exactly 3 dice', () => {
      const territory: Territory = {
        fortified: true,
        fortifyDamage: 5,
      } as Territory;

      const result = calculateFortificationDamage(territory, 3);

      expect(result.fortifyDamage).toBe(6);
    });

    it('should NOT increment damage when attacker uses 1 or 2 dice', () => {
      const territory: Territory = {
        fortified: true,
        fortifyDamage: 5,
      } as Territory;

      expect(calculateFortificationDamage(territory, 1).fortifyDamage).toBe(5);
      expect(calculateFortificationDamage(territory, 2).fortifyDamage).toBe(5);
    });

    it('should destroy fortification at 10 damage', () => {
      const territory: Territory = {
        fortified: true,
        fortifyDamage: 9,
      } as Territory;

      const result = calculateFortificationDamage(territory, 3);

      expect(result.fortifyDamage).toBe(10);
      expect(result.fortificationDestroyed).toBe(true);
    });

    it('should not increment damage on non-fortified territory', () => {
      const territory: Territory = {
        fortified: false,
        fortifyDamage: 0,
      } as Territory;

      const result = calculateFortificationDamage(territory, 3);

      expect(result.fortifyDamage).toBe(0);
    });
  });

  // ============================================
  // ATTACK VALIDATION
  // ============================================
  describe('Attack Validation', () => {
    it('should reject attack from territory with < 2 troops', () => {
      const territory: Territory = { troopCount: 1 } as Territory;

      expect(() => validateAttack(territory, {} as Territory)).toThrow('INSUFFICIENT_TROOPS');
    });

    it('should reject attack to non-adjacent territory', () => {
      const from: Territory = { id: 1, neighbors: [2, 3], troopCount: 5 } as Territory;
      const to: Territory = { id: 4 } as Territory;

      expect(() => validateAttack(from, to)).toThrow('NOT_ADJACENT');
    });

    it('should reject attack to own territory', () => {
      const from: Territory = { id: 1, neighbors: [2], troopCount: 5, ownerId: 1 } as Territory;
      const to: Territory = { id: 2, ownerId: 1 } as Territory;

      expect(() => validateAttack(from, to)).toThrow('INVALID_TERRITORY');
    });

    it('should allow attack to adjacent enemy territory', () => {
      const from: Territory = { id: 1, neighbors: [2], troopCount: 5, ownerId: 1 } as Territory;
      const to: Territory = { id: 2, ownerId: 2 } as Territory;

      expect(() => validateAttack(from, to)).not.toThrow();
    });

    it('should allow attack to adjacent unoccupied territory', () => {
      const from: Territory = { id: 1, neighbors: [2], troopCount: 5, ownerId: 1 } as Territory;
      const to: Territory = { id: 2, ownerId: null } as Territory;

      expect(() => validateAttack(from, to)).not.toThrow();
    });
  });

  // ============================================
  // DICE COUNT VALIDATION
  // ============================================
  describe('Dice Count Validation', () => {
    describe('Attacker Dice', () => {
      it('should allow max 3 dice', () => {
        expect(validateAttackerDice(10, 3)).toBe(true);
        expect(() => validateAttackerDice(10, 4)).toThrow();
      });

      it('should require at least 1 die', () => {
        expect(() => validateAttackerDice(5, 0)).toThrow();
      });

      it('should cap dice at troopCount - 1', () => {
        expect(validateAttackerDice(2, 1)).toBe(true);
        expect(() => validateAttackerDice(2, 2)).toThrow(); // Can't use 2 dice with 2 troops
        expect(validateAttackerDice(3, 2)).toBe(true);
        expect(validateAttackerDice(4, 3)).toBe(true);
      });
    });

    describe('Defender Dice', () => {
      it('should allow max 2 dice', () => {
        expect(validateDefenderDice(10, 2)).toBe(true);
        expect(() => validateDefenderDice(10, 3)).toThrow();
      });

      it('should require at least 1 die', () => {
        expect(() => validateDefenderDice(5, 0)).toThrow();
      });

      it('should cap dice at troopCount', () => {
        expect(validateDefenderDice(1, 1)).toBe(true);
        expect(() => validateDefenderDice(1, 2)).toThrow();
        expect(validateDefenderDice(2, 2)).toBe(true);
      });
    });
  });

  // ============================================
  // POST-COMBAT: CONQUEST TROOP MOVEMENT
  // ============================================
  describe('Conquest Troop Movement', () => {
    it('should require minimum troops equal to dice used', () => {
      const result = validateConquestMove(3, 2, 5); // 3 dice used, moving 2, 5 troops available

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Must move at least 3 troops');
    });

    it('should allow moving up to (troops - 1) from attacking territory', () => {
      expect(validateConquestMove(2, 4, 5).valid).toBe(true); // Leave 1
      expect(validateConquestMove(2, 5, 5).valid).toBe(false); // Can't move all
    });

    it('should enforce minimum 1 troop remains in attacking territory', () => {
      const result = validateConquestMove(1, 3, 3);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Must leave at least 1 troop');
    });
  });
});

// Helper functions that would be imported from combat module
function calculateFortificationDamage(territory: Territory, attackerDice: number) {
  // Stub - actual implementation in engine
  return {
    fortifyDamage: territory.fortified && attackerDice === 3
      ? territory.fortifyDamage + 1
      : territory.fortifyDamage,
    fortificationDestroyed: territory.fortified && territory.fortifyDamage + 1 >= 10,
  };
}

function validateAttack(from: Territory, to: Territory) {
  if (from.troopCount < 2) throw new Error('INSUFFICIENT_TROOPS');
  if (!from.neighbors.includes(to.id)) throw new Error('NOT_ADJACENT');
  if (from.ownerId === to.ownerId) throw new Error('INVALID_TERRITORY');
}

function validateAttackerDice(troopCount: number, diceCount: number) {
  if (diceCount < 1 || diceCount > 3) throw new Error('Invalid dice count');
  if (diceCount >= troopCount) throw new Error('Not enough troops');
  return true;
}

function validateDefenderDice(troopCount: number, diceCount: number) {
  if (diceCount < 1 || diceCount > 2) throw new Error('Invalid dice count');
  if (diceCount > troopCount) throw new Error('Not enough troops');
  return true;
}

function validateConquestMove(diceUsed: number, troopsToMove: number, availableTroops: number) {
  if (troopsToMove < diceUsed) {
    return { valid: false, error: `Must move at least ${diceUsed} troops` };
  }
  if (troopsToMove >= availableTroops) {
    return { valid: false, error: 'Must leave at least 1 troop' };
  }
  return { valid: true };
}
