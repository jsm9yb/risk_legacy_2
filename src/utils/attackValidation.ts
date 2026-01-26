import { TerritoryId, TerritoryState } from '@/types/territory';
import { territoriesById } from '@/data/territories';

/**
 * Attack validation error codes matching spec section 8.1
 */
export type AttackErrorCode =
  | 'INVALID_TERRITORY'
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'INSUFFICIENT_TROOPS'
  | 'TERRITORY_NOT_OWNED'
  | 'NOT_ADJACENT'
  | 'CANNOT_ATTACK_OWN_TERRITORY';

export interface AttackValidationResult {
  valid: boolean;
  errorCode?: AttackErrorCode;
  errorMessage?: string;
}

interface AttackSourceContext {
  territoryId: TerritoryId;
  territoryStates: Record<TerritoryId, TerritoryState>;
  currentPlayerId: string;
  isPlayerTurn: boolean;
  isCorrectPhase: boolean;
}

interface AttackTargetContext {
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
): AttackValidationResult {
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
): AttackValidationResult {
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
function validatePlayerTurn(isPlayerTurn: boolean): AttackValidationResult {
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
 * Validates that the game is in the correct phase for attacking
 */
function validateAttackPhase(isCorrectPhase: boolean): AttackValidationResult {
  if (!isCorrectPhase) {
    return {
      valid: false,
      errorCode: 'INVALID_PHASE',
      errorMessage: 'Cannot attack in this phase',
    };
  }
  return { valid: true };
}

/**
 * Validates that the attacking territory has enough troops (>= 2)
 * Per spec section 4.3: Attacking territory must contain ≥2 troops
 */
function validateSufficientTroopsToAttack(
  territoryId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>
): AttackValidationResult {
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
      errorMessage: 'Need at least 2 troops to attack',
    };
  }
  return { valid: true };
}

/**
 * Validates that target is adjacent to source
 * Per spec section 4.3: Target must be adjacent to attacker
 */
function validateAdjacency(
  sourceId: TerritoryId,
  targetId: TerritoryId
): AttackValidationResult {
  const sourceData = territoriesById[sourceId];
  if (!sourceData) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Source territory does not exist',
    };
  }

  if (!sourceData.neighbors.includes(targetId)) {
    return {
      valid: false,
      errorCode: 'NOT_ADJACENT',
      errorMessage: 'Target territory is not adjacent',
    };
  }
  return { valid: true };
}

/**
 * Validates that the target is owned by an enemy (or unoccupied)
 * Per spec section 4.3: Target must be enemy-controlled OR unoccupied
 */
function validateEnemyTerritory(
  targetId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): AttackValidationResult {
  const territory = territoryStates[targetId];
  if (!territory) {
    return {
      valid: false,
      errorCode: 'INVALID_TERRITORY',
      errorMessage: 'Target territory does not exist',
    };
  }

  if (territory.ownerId === currentPlayerId) {
    return {
      valid: false,
      errorCode: 'CANNOT_ATTACK_OWN_TERRITORY',
      errorMessage: 'Cannot attack your own territory',
    };
  }
  return { valid: true };
}

/**
 * Validates selecting an attack source territory
 *
 * Per spec section 4.3:
 * - Attacking territory must contain ≥2 troops
 * - Must be owned by the current player
 */
export function validateSelectAttackSource(context: AttackSourceContext): AttackValidationResult {
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
  const phaseResult = validateAttackPhase(isCorrectPhase);
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

  // Check sufficient troops (>= 2)
  const troopsResult = validateSufficientTroopsToAttack(territoryId, territoryStates);
  if (!troopsResult.valid) return troopsResult;

  return { valid: true };
}

/**
 * Validates selecting an attack target territory
 *
 * Per spec section 4.3:
 * - Target must be adjacent to attacker
 * - Target must be enemy-controlled OR unoccupied
 */
export function validateSelectAttackTarget(context: AttackTargetContext): AttackValidationResult {
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
  const phaseResult = validateAttackPhase(isCorrectPhase);
  if (!phaseResult.valid) return phaseResult;

  // Check target exists
  const existsResult = validateTerritoryExists(targetId, territoryStates);
  if (!existsResult.valid) return existsResult;

  // Check adjacency
  const adjacencyResult = validateAdjacency(sourceId, targetId);
  if (!adjacencyResult.valid) return adjacencyResult;

  // Check it's an enemy territory
  const enemyResult = validateEnemyTerritory(targetId, territoryStates, currentPlayerId);
  if (!enemyResult.valid) return enemyResult;

  return { valid: true };
}

/**
 * Gets territories that can be used as attack sources
 *
 * Per spec section 4.3:
 * - Owned by current player
 * - Has >= 2 troops
 */
export function getAttackableTerritories(
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): TerritoryId[] {
  return Object.values(territoryStates)
    .filter((t) => t.ownerId === currentPlayerId && t.troopCount >= 2)
    .map((t) => t.id);
}

/**
 * Gets valid attack targets for a given source territory
 *
 * Per spec section 4.3:
 * - Must be adjacent to source
 * - Must be enemy-controlled or unoccupied
 */
export function getValidAttackTargets(
  sourceId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): TerritoryId[] {
  const sourceData = territoriesById[sourceId];
  if (!sourceData) return [];

  return sourceData.neighbors.filter((neighborId) => {
    const neighbor = territoryStates[neighborId as TerritoryId];
    // Target must be enemy-controlled or unoccupied
    return neighbor && neighbor.ownerId !== currentPlayerId;
  }) as TerritoryId[];
}
