import { TerritoryId, TerritoryState } from '@/types/territory';
import { territoriesById } from '@/data/territories';

/**
 * Maneuver validation error codes matching spec section 8.1
 */
export type ManeuverErrorCode =
  | 'INVALID_TERRITORY'
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'INSUFFICIENT_TROOPS'
  | 'TERRITORY_NOT_OWNED'
  | 'NO_PATH'
  | 'SAME_TERRITORY';

export interface ManeuverValidationResult {
  valid: boolean;
  errorCode?: ManeuverErrorCode;
  errorMessage?: string;
}

interface ManeuverSourceContext {
  territoryId: TerritoryId;
  territoryStates: Record<TerritoryId, TerritoryState>;
  currentPlayerId: string;
  isPlayerTurn: boolean;
  isCorrectPhase: boolean;
}

interface ManeuverTargetContext {
  sourceId: TerritoryId;
  targetId: TerritoryId;
  territoryStates: Record<TerritoryId, TerritoryState>;
  currentPlayerId: string;
  isPlayerTurn: boolean;
  isCorrectPhase: boolean;
}

/**
 * Validates that a territory exists in the game state
 */
function validateTerritoryExists(
  territoryId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>
): ManeuverValidationResult {
  if (!territoryStates[territoryId]) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Territory does not exist',
    };
  }
  return { valid: true };
}

/**
 * Validates that the territory is owned by the current player
 */
function validateTerritoryOwnership(
  territoryId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): ManeuverValidationResult {
  const territory = territoryStates[territoryId];
  if (!territory) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Territory does not exist',
    };
  }

  if (territory.ownerId !== currentPlayerId) {
    return {
      valid: false,
      errorCode: 'TERRITORY_NOT_OWNED',
      errorMessage: 'You do not control this territory',
    };
  }
  return { valid: true };
}

/**
 * Validates that it's the player's turn
 */
function validatePlayerTurn(isPlayerTurn: boolean): ManeuverValidationResult {
  if (!isPlayerTurn) {
    return {
      valid: false,
      errorCode: 'NOT_YOUR_TURN',
      errorMessage: 'It is not your turn',
    };
  }
  return { valid: true };
}

/**
 * Validates that the game is in the correct phase for maneuvering
 */
function validateManeuverPhase(isCorrectPhase: boolean): ManeuverValidationResult {
  if (!isCorrectPhase) {
    return {
      valid: false,
      errorCode: 'INVALID_PHASE',
      errorMessage: 'Cannot maneuver in this phase',
    };
  }
  return { valid: true };
}

/**
 * Validates that the source territory has enough troops (>= 2)
 * Per spec section 4.4: Leave ≥1 troop in origin territory
 */
function validateSufficientTroopsToManeuver(
  territoryId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>
): ManeuverValidationResult {
  const territory = territoryStates[territoryId];
  if (!territory) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Territory does not exist',
    };
  }

  if (territory.troopCount < 2) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: 'Need at least 2 troops to maneuver (must leave 1 behind)',
    };
  }
  return { valid: true };
}

/**
 * Find a path between two territories through owned territories only
 * Uses BFS (Breadth-First Search) to find the shortest path
 *
 * Per spec section 4.4:
 * - Path must be entirely through controlled territories
 * - Cannot pass through enemy or unoccupied territories
 *
 * @returns Array of territory IDs representing the path (including source and target),
 *          or null if no valid path exists
 */
export function findPath(
  sourceId: TerritoryId,
  targetId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  playerId: string
): TerritoryId[] | null {
  // Same territory check
  if (sourceId === targetId) {
    return null;
  }

  // Verify both territories are owned by the player
  const sourceTerritory = territoryStates[sourceId];
  const targetTerritory = territoryStates[targetId];

  if (!sourceTerritory || sourceTerritory.ownerId !== playerId) {
    return null;
  }
  if (!targetTerritory || targetTerritory.ownerId !== playerId) {
    return null;
  }

  // BFS to find shortest path
  const queue: TerritoryId[][] = [[sourceId]];
  const visited = new Set<TerritoryId>([sourceId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    // Get neighbors from static territory data
    const territoryData = territoriesById[current];
    if (!territoryData) continue;

    for (const neighborId of territoryData.neighbors) {
      // Skip if already visited
      if (visited.has(neighborId)) continue;

      // Check if neighbor is owned by the player (path through controlled territories only)
      const neighborState = territoryStates[neighborId];
      if (!neighborState || neighborState.ownerId !== playerId) continue;

      const newPath = [...path, neighborId];

      // Found target
      if (neighborId === targetId) {
        return newPath;
      }

      // Continue searching
      visited.add(neighborId);
      queue.push(newPath);
    }
  }

  // No path found
  return null;
}

/**
 * Get all territories reachable from a source territory through owned territories
 * Returns a map of territory ID to the path needed to reach it
 */
export function getReachableTerritories(
  sourceId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  playerId: string
): Map<TerritoryId, TerritoryId[]> {
  const reachable = new Map<TerritoryId, TerritoryId[]>();

  // Verify source is owned by the player
  const sourceTerritory = territoryStates[sourceId];
  if (!sourceTerritory || sourceTerritory.ownerId !== playerId) {
    return reachable;
  }

  // BFS to find all reachable territories
  const queue: TerritoryId[][] = [[sourceId]];
  const visited = new Set<TerritoryId>([sourceId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    // Get neighbors from static territory data
    const territoryData = territoriesById[current];
    if (!territoryData) continue;

    for (const neighborId of territoryData.neighbors) {
      // Skip if already visited
      if (visited.has(neighborId)) continue;

      // Check if neighbor is owned by the player
      const neighborState = territoryStates[neighborId];
      if (!neighborState || neighborState.ownerId !== playerId) continue;

      const newPath = [...path, neighborId];

      // Add to reachable map
      reachable.set(neighborId, newPath);

      // Continue BFS
      visited.add(neighborId);
      queue.push(newPath);
    }
  }

  return reachable;
}

/**
 * Validates selecting a maneuver source territory
 *
 * Per spec section 4.4:
 * - Must own the territory
 * - Must have >= 2 troops (must leave 1 behind)
 */
export function validateSelectManeuverSource(context: ManeuverSourceContext): ManeuverValidationResult {
  const {
    territoryId,
    territoryStates,
    currentPlayerId,
    isPlayerTurn,
    isCorrectPhase,
  } = context;

  // Check turn
  const turnResult = validatePlayerTurn(isPlayerTurn);
  if (!turnResult.valid) return turnResult;

  // Check phase
  const phaseResult = validateManeuverPhase(isCorrectPhase);
  if (!phaseResult.valid) return phaseResult;

  // Check territory exists
  const existsResult = validateTerritoryExists(territoryId, territoryStates);
  if (!existsResult.valid) return existsResult;

  // Check ownership
  const ownershipResult = validateTerritoryOwnership(
    territoryId,
    territoryStates,
    currentPlayerId
  );
  if (!ownershipResult.valid) return ownershipResult;

  // Check sufficient troops (>= 2 to leave at least 1 behind)
  const troopsResult = validateSufficientTroopsToManeuver(territoryId, territoryStates);
  if (!troopsResult.valid) return troopsResult;

  return { valid: true };
}

/**
 * Validates selecting a maneuver target territory
 *
 * Per spec section 4.4:
 * - Must own the territory
 * - Path must exist through owned territories
 */
export function validateSelectManeuverTarget(context: ManeuverTargetContext): ManeuverValidationResult {
  const {
    sourceId,
    targetId,
    territoryStates,
    currentPlayerId,
    isPlayerTurn,
    isCorrectPhase,
  } = context;

  // Check turn
  const turnResult = validatePlayerTurn(isPlayerTurn);
  if (!turnResult.valid) return turnResult;

  // Check phase
  const phaseResult = validateManeuverPhase(isCorrectPhase);
  if (!phaseResult.valid) return phaseResult;

  // Check target exists
  const existsResult = validateTerritoryExists(targetId, territoryStates);
  if (!existsResult.valid) return existsResult;

  // Check same territory
  if (sourceId === targetId) {
    return {
      valid: false,
      errorCode: 'SAME_TERRITORY',
      errorMessage: 'Cannot maneuver to the same territory',
    };
  }

  // Check ownership
  const ownershipResult = validateTerritoryOwnership(
    targetId,
    territoryStates,
    currentPlayerId
  );
  if (!ownershipResult.valid) return ownershipResult;

  // Check path exists
  const path = findPath(sourceId, targetId, territoryStates, currentPlayerId);
  if (!path) {
    return {
      valid: false,
      errorCode: 'NO_PATH',
      errorMessage: 'No path exists through your territories',
    };
  }

  return { valid: true };
}

/**
 * Gets territories that can be used as maneuver sources
 *
 * Per spec section 4.4:
 * - Owned by current player
 * - Has >= 2 troops (must leave 1 behind)
 */
export function getManeuverableTerritories(
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): TerritoryId[] {
  return Object.values(territoryStates)
    .filter((t) => t.ownerId === currentPlayerId && t.troopCount >= 2)
    .map((t) => t.id);
}

/**
 * Gets valid maneuver targets for a given source territory
 *
 * Per spec section 4.4:
 * - Must be owned by current player
 * - Must have a valid path through owned territories
 * - Cannot be the same territory
 */
export function getValidManeuverTargets(
  sourceId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): TerritoryId[] {
  const reachable = getReachableTerritories(sourceId, territoryStates, currentPlayerId);
  return Array.from(reachable.keys());
}

/**
 * Calculate maximum troops that can be moved from a territory
 * Per spec section 4.4: Leave ≥1 troop in origin territory
 */
export function getMaxManeuverTroops(
  sourceId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>
): number {
  const territory = territoryStates[sourceId];
  if (!territory) return 0;
  return Math.max(0, territory.troopCount - 1);
}

/**
 * Validate troop count for maneuver
 */
export function validateManeuverTroops(
  troops: number,
  maxTroops: number
): ManeuverValidationResult {
  if (troops < 1) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: 'Must move at least 1 troop',
    };
  }
  if (troops > maxTroops) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: `Cannot move more than ${maxTroops} troops`,
    };
  }
  return { valid: true };
}
