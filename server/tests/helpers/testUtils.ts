/**
 * Test Utilities
 * Helper functions for testing game flow
 */

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Simulate a complete combat sequence
 */
export async function simulateCombat(
  attacker: any,
  server: any,
  gameId: string,
  options: {
    fromId?: number;
    toId?: number;
    forceWin?: boolean;
    eliminatePlayer?: number;
  } = {}
): Promise<any> {
  const state = server.getGameState(gameId);
  const fromId = options.fromId ?? findAttackSource(state, attacker.playerId);
  const toId = options.toId ?? findAttackTarget(state, fromId);

  await attacker.emit('declare_attack', { fromId, toId });
  await attacker.emit('choose_attack_dice', { count: 3 });

  // Wait for combat to resolve
  await waitFor(() => {
    const currentState = server.getGameState(gameId);
    return currentState.subPhase === 'IDLE' || currentState.subPhase === 'TROOP_MOVE';
  }, 15000);

  if (options.forceWin) {
    // Force the conquest if needed
    await server.forceConquest(gameId, attacker.playerId, toId);
  }

  return server.getGameState(gameId);
}

/**
 * Advance the game to a specific phase
 */
export async function advanceToPhase(
  client: any,
  targetPhase: string
): Promise<void> {
  const phaseOrder = ['RECRUIT', 'ATTACK', 'MANEUVER', 'TURN_END'];

  // Simple phase advancement logic
  while (true) {
    // This would check current phase and advance appropriately
    // Simplified for test helper
    break;
  }
}

/**
 * Find a valid attack source for a player
 */
function findAttackSource(state: any, playerId: number): number {
  for (const [id, territory] of state.territories || new Map()) {
    if (territory.ownerId === playerId && territory.troopCount >= 2) {
      return id;
    }
  }
  return 0;
}

/**
 * Find a valid attack target adjacent to the source
 */
function findAttackTarget(state: any, sourceId: number): number {
  const source = state.territories?.get(sourceId);
  if (!source) return 1;

  for (const neighborId of source.neighbors || []) {
    const neighbor = state.territories?.get(neighborId);
    if (neighbor && neighbor.ownerId !== source.ownerId) {
      return neighborId;
    }
  }
  return 1;
}

/**
 * Create mock territory data
 */
export function createMockTerritories(assignments: Record<number, number[]>): Map<number, any> {
  const territories = new Map();

  for (const [playerId, territoryIds] of Object.entries(assignments)) {
    for (const id of territoryIds) {
      territories.set(id, {
        id,
        ownerId: parseInt(playerId),
        troopCount: 3,
        scarId: null,
        cityTier: 0,
        neighbors: [],
      });
    }
  }

  return territories;
}

/**
 * Create mock player data
 */
export function createMockPlayers(count: number): any[] {
  const factions = ['khan', 'bear', 'mechaniker', 'balkania', 'saharan'];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    factionId: factions[i % factions.length],
    redStars: 1,
    missiles: 0,
    cards: [],
    isEliminated: false,
    conqueredThisTurn: false,
  }));
}

/**
 * Generate random dice rolls for testing
 */
export function generateDiceRolls(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1).sort(
    (a, b) => b - a
  );
}

/**
 * Calculate expected combat result
 */
export function calculateCombatResult(
  attackerDice: number[],
  defenderDice: number[]
): { attackerLosses: number; defenderLosses: number } {
  let attackerLosses = 0;
  let defenderLosses = 0;

  const comparisons = Math.min(attackerDice.length, defenderDice.length);

  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  return { attackerLosses, defenderLosses };
}
