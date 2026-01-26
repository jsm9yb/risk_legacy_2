import { TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';

/**
 * Combat resolution utilities matching spec sections 4.3 and 5
 */

/**
 * Dice roll result for a single die
 */
export interface DieResult {
  originalValue: number;
  modifiedValue: number;
  modifiers: DieModifier[];
  isUnmodifiable: boolean; // True if missile was used
}

/**
 * Modifier applied to a die
 */
export interface DieModifier {
  source: 'scar' | 'fortification' | 'faction' | 'missile';
  name: string;
  delta: number;
}

/**
 * Complete combat result
 */
export interface CombatResult {
  attackerRolls: DieResult[];
  defenderRolls: DieResult[];
  comparisons: DieComparison[];
  attackerLosses: number;
  defenderLosses: number;
  defenderEliminated: boolean;
  conquestRequired: boolean;
}

/**
 * Individual die comparison result
 */
export interface DieComparison {
  attackerValue: number;
  defenderValue: number;
  attackerWins: boolean;
}

/**
 * Calculate maximum defender dice based on troop count
 * Per spec section 4.3: Defender selects 1 or 2 dice (max = min(troopCount, 2))
 */
export function getMaxDefenderDice(troopCount: number): number {
  return Math.min(troopCount, 2);
}

/**
 * Get available dice options for defender
 * Returns array of valid dice counts (1 or 2) based on troop count
 */
export function getAvailableDefenderDice(troopCount: number): number[] {
  const maxDice = getMaxDefenderDice(troopCount);
  const options: number[] = [];
  for (let i = 1; i <= maxDice; i++) {
    options.push(i);
  }
  return options;
}

/**
 * Roll dice - generates random values 1-6
 */
export function rollDice(count: number): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * 6) + 1);
  }
  return rolls;
}

/**
 * Apply modifiers to dice rolls per spec section 5
 * Order: Scars → Fortifications → Faction Powers → Missiles
 * Bounds: Modified value cannot exceed 6 or drop below 1
 */
export function applyModifiers(
  rolls: number[],
  isAttacker: boolean,
  territory: TerritoryState,
  player: Player | null,
  isFirstAttackOfTurn: boolean = false
): DieResult[] {
  // Sort dice highest to lowest for proper modifier application
  const sortedRolls = [...rolls].sort((a, b) => b - a);

  const results: DieResult[] = sortedRolls.map((value) => ({
    originalValue: value,
    modifiedValue: value,
    modifiers: [],
    isUnmodifiable: false,
  }));

  // Only apply modifiers to defender's dice based on territory
  if (!isAttacker) {
    // 1. Apply scar modifiers (only to highest die)
    if (territory.scarId === 'bunker') {
      // Bunker: +1 to defender's highest die
      results[0].modifiedValue = Math.min(6, results[0].modifiedValue + 1);
      results[0].modifiers.push({
        source: 'scar',
        name: 'Bunker',
        delta: 1,
      });
    } else if (territory.scarId === 'ammo_shortage') {
      // Ammo Shortage: -1 to defender's highest die
      results[0].modifiedValue = Math.max(1, results[0].modifiedValue - 1);
      results[0].modifiers.push({
        source: 'scar',
        name: 'Ammo Shortage',
        delta: -1,
      });
    }

    // 2. Apply fortification modifier (+1 to BOTH defender dice)
    if (territory.fortified && territory.fortifyDamage < 10) {
      results.forEach((die) => {
        die.modifiedValue = Math.min(6, die.modifiedValue + 1);
        die.modifiers.push({
          source: 'fortification',
          name: 'Fortification',
          delta: 1,
        });
      });
    }

    // 3. Apply defender faction powers - Stubborn (doubles bonus) handled in resolution
  }

  // Apply attacker faction powers
  if (isAttacker && player) {
    // Ferocity: +1 to highest attack die on first attack of turn
    if (player.activePower === 'ferocity' && isFirstAttackOfTurn) {
      results[0].modifiedValue = Math.min(6, results[0].modifiedValue + 1);
      results[0].modifiers.push({
        source: 'faction',
        name: 'Ferocity',
        delta: 1,
      });
    }
  }

  return results;
}

/**
 * Resolve combat per spec section 4.3 step 6
 * - Sort attacker dice highest to lowest
 * - Sort defender dice highest to lowest
 * - Compare highest vs highest: Higher wins (ties → defender wins)
 * - Compare second-highest vs second-highest (if both exist)
 * - Loser of each comparison loses 1 troop
 */
export function resolveCombat(
  attackerDice: DieResult[],
  defenderDice: DieResult[],
  defenderTroops: number,
  _attackerPlayer: Player | null,
  defenderPlayer: Player | null
): CombatResult {
  // Sort both by modified value, highest first
  const sortedAttacker = [...attackerDice].sort((a, b) => b.modifiedValue - a.modifiedValue);
  const sortedDefender = [...defenderDice].sort((a, b) => b.modifiedValue - a.modifiedValue);

  // Number of comparisons = minimum of dice counts
  const numComparisons = Math.min(sortedAttacker.length, sortedDefender.length);

  const comparisons: DieComparison[] = [];
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < numComparisons; i++) {
    const attackerValue = sortedAttacker[i].modifiedValue;
    const defenderValue = sortedDefender[i].modifiedValue;

    // Higher wins, ties go to defender
    const attackerWins = attackerValue > defenderValue;

    comparisons.push({
      attackerValue,
      defenderValue,
      attackerWins,
    });

    if (attackerWins) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  // Check for Stubborn power (defender rolls doubles = attacker loses 1 additional)
  if (defenderPlayer?.activePower === 'stubborn' && sortedDefender.length >= 2) {
    if (sortedDefender[0].originalValue === sortedDefender[1].originalValue) {
      attackerLosses++;
    }
  }

  // Check if defender is eliminated (will have 0 troops after losses)
  const defenderEliminated = defenderTroops - defenderLosses <= 0;

  return {
    attackerRolls: sortedAttacker,
    defenderRolls: sortedDefender,
    comparisons,
    attackerLosses,
    defenderLosses,
    defenderEliminated,
    conquestRequired: defenderEliminated,
  };
}

/**
 * Check for Supreme Firepower trigger (all 3 dice show same value)
 * Per spec: When attacking with 3 dice, if all show same number, defender loses 3 troops immediately
 */
export function checkSupremeFirepower(attackerRolls: number[]): boolean {
  if (attackerRolls.length !== 3) return false;
  return attackerRolls[0] === attackerRolls[1] && attackerRolls[1] === attackerRolls[2];
}

/**
 * Calculate minimum and maximum troops that can be moved after conquest
 * Per spec section 4.3 step 7:
 * - Movement minimum: Number of attack dice used
 * - Movement maximum: All but 1 troop from attacking territory
 */
export function getConquestTroopRange(
  attackerDiceUsed: number,
  attackingTerritoryTroops: number
): { min: number; max: number } {
  return {
    min: attackerDiceUsed,
    max: attackingTerritoryTroops - 1,
  };
}

/**
 * Validate defender dice selection
 */
export interface DefenderDiceValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export function validateSelectDefenderDice(
  diceCount: number,
  defendingTroops: number,
  _isDefenderTurn: boolean,
  isCorrectPhase: boolean
): DefenderDiceValidationResult {
  if (!isCorrectPhase) {
    return {
      valid: false,
      errorCode: 'INVALID_PHASE',
      errorMessage: 'Cannot select defender dice in this phase',
    };
  }

  // Validate dice count is 1 or 2
  if (diceCount < 1 || diceCount > 2) {
    return {
      valid: false,
      errorCode: 'INVALID_DICE',
      errorMessage: 'Dice count must be 1 or 2',
    };
  }

  // Validate dice count doesn't exceed maximum
  const maxDice = getMaxDefenderDice(defendingTroops);
  if (diceCount > maxDice) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: `Cannot use ${diceCount} dice with only ${defendingTroops} troops (max: ${maxDice})`,
    };
  }

  return { valid: true };
}
