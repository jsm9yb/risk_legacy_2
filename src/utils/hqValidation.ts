import { TerritoryId, TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';

/**
 * Error codes for HQ placement validation
 */
export type HQValidationErrorCode =
  | 'INVALID_TERRITORY'
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'TERRITORY_HAS_SCAR'
  | 'TERRITORY_OCCUPIED'
  | 'ADJACENT_TO_HQ'
  | 'TERRITORY_NOT_OWNED_BY_PLAYER'; // For major city requirement

/**
 * Result of HQ placement validation
 */
export interface HQValidationResult {
  valid: boolean;
  errorCode?: HQValidationErrorCode;
  errorMessage?: string;
}

/**
 * Check if a territory is adjacent to any player's HQ
 */
function isAdjacentToAnyHQ(
  territoryId: TerritoryId,
  territories: Record<TerritoryId, TerritoryState>,
  players: Player[]
): boolean {
  const territory = territories[territoryId];
  if (!territory) return false;

  // Get all placed HQs
  const placedHQs = players
    .filter((p) => p.hqTerritory)
    .map((p) => p.hqTerritory);

  // Check if any neighbor is an HQ
  return territory.neighbors.some((neighborId) => placedHQs.includes(neighborId));
}

/**
 * Check if a territory is a major city founded by the player
 * Per spec: Major Cities founded by a player count as legal starting territories
 */
function isPlayersMajorCity(
  _territoryId: TerritoryId,
  territory: TerritoryState,
  playerId: string
): boolean {
  // A major city (tier 2) or capital (tier 3) can be used if founded by the player
  // For simplicity, we check if the territory has a city tier >= 2 and is owned by the player
  // In a full implementation, we'd track the founding player separately
  return territory.cityTier >= 2 && territory.ownerId === playerId;
}

/**
 * Check if a territory is legal for HQ placement
 *
 * Per spec section 4.1.1:
 * - Legal territory: Unmarked (no stickers/scars) OR Major City founded by this player
 * - AND NOT adjacent to another player's HQ
 */
export function isLegalHQTerritory(
  territoryId: TerritoryId,
  territories: Record<TerritoryId, TerritoryState>,
  players: Player[],
  playerId: string
): boolean {
  const territory = territories[territoryId];
  if (!territory) return false;

  // Territory must not be occupied
  if (territory.ownerId !== null) {
    return false;
  }

  // Check if adjacent to any existing HQ
  if (isAdjacentToAnyHQ(territoryId, territories, players)) {
    return false;
  }

  // Check if unmarked (no scars) or is player's major city
  const isUnmarked = territory.scarId === null && territory.cityTier === 0 && !territory.fortified;
  const isMajorCity = isPlayersMajorCity(territoryId, territory, playerId);

  return isUnmarked || isMajorCity;
}

/**
 * Get all legal territories for HQ placement
 */
export function getLegalHQTerritories(
  territories: Record<TerritoryId, TerritoryState>,
  players: Player[],
  playerId: string
): TerritoryId[] {
  return Object.keys(territories).filter((territoryId) =>
    isLegalHQTerritory(territoryId, territories, players, playerId)
  );
}

/**
 * Validate HQ placement selection
 */
export function validateHQPlacement(
  territoryId: TerritoryId,
  territories: Record<TerritoryId, TerritoryState>,
  players: Player[],
  currentPlayerId: string,
  setupTurnIndex: number,
  subPhase: string | null
): HQValidationResult {
  // Check phase
  if (subPhase !== 'HQ_PLACEMENT') {
    return {
      valid: false,
      errorCode: 'INVALID_PHASE',
      errorMessage: 'HQ placement is only valid during HQ_PLACEMENT phase',
    };
  }

  // Check if it's the current player's turn
  const currentSetupPlayer = players[setupTurnIndex];
  if (!currentSetupPlayer || currentSetupPlayer.id !== currentPlayerId) {
    return {
      valid: false,
      errorCode: 'NOT_YOUR_TURN',
      errorMessage: 'It is not your turn to place your HQ',
    };
  }

  const territory = territories[territoryId];
  if (!territory) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Invalid territory selected',
    };
  }

  // Check if territory is already occupied
  if (territory.ownerId !== null) {
    return {
      valid: false,
      errorCode: 'TERRITORY_OCCUPIED',
      errorMessage: 'This territory is already occupied',
    };
  }

  // Check if adjacent to another player's HQ
  if (isAdjacentToAnyHQ(territoryId, territories, players)) {
    return {
      valid: false,
      errorCode: 'ADJACENT_TO_HQ',
      errorMessage: 'Cannot place HQ adjacent to another player\'s headquarters',
    };
  }

  // Check if territory is legal (unmarked or player's major city)
  const isUnmarked = territory.scarId === null && territory.cityTier === 0 && !territory.fortified;
  const isMajorCity = isPlayersMajorCity(territoryId, territory, currentPlayerId);

  if (!isUnmarked && !isMajorCity) {
    return {
      valid: false,
      errorCode: 'TERRITORY_HAS_SCAR',
      errorMessage: 'Cannot place HQ on a territory with scars, cities, or fortifications (unless it is your major city)',
    };
  }

  return { valid: true };
}

/**
 * Get the starting troop count for a player
 * Default is 8, but can be modified by the "Established" faction power
 */
export function getStartingTroops(player: Player): number {
  // Balkania's "Established" power gives 10 troops instead of 8
  if (player.factionId === 'balkania' && player.activePower === 'established') {
    return 10;
  }
  return 8;
}
