import { Player } from '@/types/player';
import { TerritoryId, TerritoryState } from '@/types/territory';

/**
 * Victory condition types
 */
export type VictoryCondition = 'RED_STARS' | 'LAST_STANDING' | 'ELIMINATION';

/**
 * Victory result interface
 */
export interface VictoryResult {
  isVictory: boolean;
  winnerId: string | null;
  winnerName: string | null;
  condition: VictoryCondition | null;
  starCount?: number;
}

/**
 * Victory stats for display
 */
export interface VictoryStats {
  territoriesControlled: number;
  enemyHQsCaptured: number;
  cardsTradedForStars: number;
  totalTroops: number;
}

/**
 * Stars required for victory
 */
export const STARS_FOR_VICTORY = 4;

/**
 * Check if a player has achieved victory via red stars
 * Per spec section 4.6: Victory requires 4 Red Stars
 */
export function checkStarVictory(players: Player[]): VictoryResult {
  for (const player of players) {
    if (player.redStars >= STARS_FOR_VICTORY) {
      return {
        isVictory: true,
        winnerId: player.id,
        winnerName: player.name,
        condition: 'RED_STARS',
        starCount: player.redStars,
      };
    }
  }

  return {
    isVictory: false,
    winnerId: null,
    winnerName: null,
    condition: null,
  };
}

/**
 * Check if only one player remains (all others eliminated)
 * Per spec: If only 1 player remains: Victory
 */
export function checkLastStandingVictory(players: Player[]): VictoryResult {
  const activePlayers = players.filter((p) => !p.isEliminated);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    return {
      isVictory: true,
      winnerId: winner.id,
      winnerName: winner.name,
      condition: 'LAST_STANDING',
      starCount: winner.redStars,
    };
  }

  return {
    isVictory: false,
    winnerId: null,
    winnerName: null,
    condition: null,
  };
}

/**
 * Check all victory conditions
 * Per spec section 4.6: Victory triggers immediately when condition met
 */
export function checkVictory(players: Player[]): VictoryResult {
  // First check star victory (most common)
  const starVictory = checkStarVictory(players);
  if (starVictory.isVictory) {
    return starVictory;
  }

  // Then check last standing
  const lastStanding = checkLastStandingVictory(players);
  if (lastStanding.isVictory) {
    return lastStanding;
  }

  return {
    isVictory: false,
    winnerId: null,
    winnerName: null,
    condition: null,
  };
}

/**
 * Calculate victory stats for a player
 */
export function calculateVictoryStats(
  player: Player,
  players: Player[],
  territories: Record<TerritoryId, TerritoryState>
): VictoryStats {
  // Count territories controlled
  const territoriesControlled = Object.values(territories).filter(
    (t) => t.ownerId === player.id
  ).length;

  // Count enemy HQs captured (player controls territory that is another player's HQ)
  const enemyHQsCaptured = players.filter(
    (p) => p.id !== player.id && p.hqTerritory && territories[p.hqTerritory]?.ownerId === player.id
  ).length;

  // Calculate total troops
  const totalTroops = Object.values(territories)
    .filter((t) => t.ownerId === player.id)
    .reduce((sum, t) => sum + t.troopCount, 0);

  // Stars from card trades = total stars - 1 (own HQ) - enemy HQs
  // This is an approximation; in full implementation we'd track this separately
  const cardsTradedForStars = Math.max(0, player.redStars - 1 - enemyHQsCaptured);

  return {
    territoriesControlled,
    enemyHQsCaptured,
    cardsTradedForStars,
    totalTroops,
  };
}

/**
 * Check if a player should be eliminated
 * Per spec: If defender has 0 territories remaining: Eliminated
 */
export function checkElimination(
  playerId: string,
  territories: Record<TerritoryId, TerritoryState>
): boolean {
  const playerTerritories = Object.values(territories).filter(
    (t) => t.ownerId === playerId
  );
  return playerTerritories.length === 0;
}

/**
 * Get condition description for display
 */
export function getVictoryConditionDescription(condition: VictoryCondition): string {
  switch (condition) {
    case 'RED_STARS':
      return 'Achieved 4 Red Stars';
    case 'LAST_STANDING':
      return 'Last Player Standing';
    case 'ELIMINATION':
      return 'All Opponents Eliminated';
    default:
      return 'Victory';
  }
}
