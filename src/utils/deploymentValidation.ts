import { TerritoryId, TerritoryState } from '@/types/territory';

/**
 * Deployment validation error codes matching spec section 8.1
 */
export type DeploymentErrorCode =
  | 'INVALID_TERRITORY'
  | 'INVALID_PHASE'
  | 'NOT_YOUR_TURN'
  | 'INSUFFICIENT_TROOPS'
  | 'TERRITORY_NOT_OWNED';

export interface ValidationResult {
  valid: boolean;
  errorCode?: DeploymentErrorCode;
  errorMessage?: string;
}

interface DeploymentValidationContext {
  territoryId: TerritoryId;
  territoryStates: Record<TerritoryId, TerritoryState>;
  currentPlayerId: string;
  troopsRemaining: number;
  isPlayerTurn: boolean;
  isCorrectPhase: boolean;
}

/**
 * Validates that a territory exists in the game state
 */
function validateTerritoryExists(
  territoryId: TerritoryId,
  territoryStates: Record<TerritoryId, TerritoryState>
): ValidationResult {
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
): ValidationResult {
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
function validatePlayerTurn(isPlayerTurn: boolean): ValidationResult {
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
 * Validates that the game is in the correct phase for deployment
 */
function validatePhase(isCorrectPhase: boolean): ValidationResult {
  if (!isCorrectPhase) {
    return {
      valid: false,
      errorCode: 'INVALID_PHASE',
      errorMessage: 'Cannot deploy troops in this phase',
    };
  }
  return { valid: true };
}

/**
 * Validates that there are troops remaining to place
 */
function validateTroopsRemaining(troopsRemaining: number): ValidationResult {
  if (troopsRemaining <= 0) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: 'No troops remaining to place',
    };
  }
  return { valid: true };
}

/**
 * Validates adding a troop to a territory during the reinforcement phase
 *
 * Per spec section 4.2:
 * - May place on any controlled territory (unless faction power restricts/expands this)
 * - All reinforcements must be placed before proceeding
 */
export function validateAddTroop(context: DeploymentValidationContext): ValidationResult {
  const {
    territoryId,
    territoryStates,
    currentPlayerId,
    troopsRemaining,
    isPlayerTurn,
    isCorrectPhase,
  } = context;

  // Check turn
  const turnResult = validatePlayerTurn(isPlayerTurn);
  if (!turnResult.valid) return turnResult;

  // Check phase
  const phaseResult = validatePhase(isCorrectPhase);
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

  // Check troops remaining
  const troopsResult = validateTroopsRemaining(troopsRemaining);
  if (!troopsResult.valid) return troopsResult;

  return { valid: true };
}

/**
 * Validates removing a troop from pending deployments
 */
export function validateRemoveTroop(
  territoryId: TerritoryId,
  pendingDeployments: Record<TerritoryId, number>,
  isPlayerTurn: boolean,
  isCorrectPhase: boolean
): ValidationResult {
  // Check turn
  const turnResult = validatePlayerTurn(isPlayerTurn);
  if (!turnResult.valid) return turnResult;

  // Check phase
  const phaseResult = validatePhase(isCorrectPhase);
  if (!phaseResult.valid) return phaseResult;

  // Check if there are pending troops to remove
  const pendingCount = pendingDeployments[territoryId] || 0;
  if (pendingCount <= 0) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: 'No pending troops to remove from this territory',
    };
  }

  return { valid: true };
}

/**
 * Validates confirming deployment (finalizing troop placement)
 *
 * Per spec section 4.2:
 * - All reinforcements must be placed before proceeding
 */
export function validateConfirmDeployment(
  troopsRemaining: number,
  isPlayerTurn: boolean,
  isCorrectPhase: boolean
): ValidationResult {
  // Check turn
  const turnResult = validatePlayerTurn(isPlayerTurn);
  if (!turnResult.valid) return turnResult;

  // Check phase
  const phaseResult = validatePhase(isCorrectPhase);
  if (!phaseResult.valid) return phaseResult;

  // All troops must be placed
  if (troopsRemaining > 0) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_TROOPS',
      errorMessage: `Must place all troops before confirming (${troopsRemaining} remaining)`,
    };
  }

  return { valid: true };
}

/**
 * Gets the list of territories where a player can deploy troops
 *
 * Per spec section 4.2:
 * - May place on any controlled territory
 * - Khan Industries "Rapid Deployment" power: May place reinforcements on any
 *   controlled territory (ignores connectivity) - this is the default behavior
 */
export function getDeployableTerritories(
  territoryStates: Record<TerritoryId, TerritoryState>,
  currentPlayerId: string
): TerritoryId[] {
  return Object.values(territoryStates)
    .filter((t) => t.ownerId === currentPlayerId)
    .map((t) => t.id);
}
