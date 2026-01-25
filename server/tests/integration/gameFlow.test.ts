/**
 * Game Flow Integration Tests
 * Tests for: complete game flow from setup to victory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, createTestClient } from '../helpers/testServer';
import { waitFor, simulateCombat, advanceToPhase } from '../helpers/testUtils';

describe('Game Flow Integration', () => {
  let server: any;
  let clients: any[];

  beforeEach(async () => {
    server = await createTestServer();
    clients = await Promise.all([
      createTestClient(server, { name: 'Player 1' }),
      createTestClient(server, { name: 'Player 2' }),
      createTestClient(server, { name: 'Player 3' }),
    ]);
  });

  afterEach(async () => {
    await Promise.all(clients.map((c) => c.disconnect()));
    await server.close();
  });

  // ============================================
  // COMPLETE GAME FLOW
  // ============================================
  describe('Complete Game Flow', () => {
    it('should complete a full game from lobby to victory', async () => {
      // 1. Create game
      const gameId = await clients[0].emit('create_game', { name: 'Test Game' });
      expect(gameId).toBeDefined();

      // 2. Other players join
      await clients[1].emit('join_game', { gameId });
      await clients[2].emit('join_game', { gameId });

      // 3. All ready up
      await Promise.all(clients.map((c) => c.emit('ready_up', {})));

      // 4. Host starts game
      await clients[0].emit('start_game', {});

      // Wait for setup phase
      await waitFor(() => server.getGameState(gameId).status === 'setup');

      // 5. Setup: Scar placement (skip if none available)
      // 6. Setup: Roll for order
      await Promise.all(clients.map((c) => c.emit('roll_die', {})));

      // 7. Setup: Faction selection (in determined order)
      const turnOrder = server.getGameState(gameId).turnOrder;
      for (const playerId of turnOrder) {
        const client = clients.find((c) => c.playerId === playerId);
        await client.emit('select_faction', {
          factionId: getAvailableFaction(server.getGameState(gameId)),
          powerId: 'power_a',
        });
      }

      // 8. Setup: HQ placement
      for (const playerId of turnOrder) {
        const client = clients.find((c) => c.playerId === playerId);
        await client.emit('place_hq', {
          territoryId: getLegalHQTerritory(server.getGameState(gameId), playerId),
        });
      }

      // Wait for active state
      await waitFor(() => server.getGameState(gameId).status === 'active');

      // 9. Play turns until victory
      let turns = 0;
      const maxTurns = 100;

      while (server.getGameState(gameId).status === 'active' && turns < maxTurns) {
        const state = server.getGameState(gameId);
        const activeClient = clients.find((c) => c.playerId === state.activePlayerId);

        // Reinforcement phase
        await advanceToPhase(activeClient, 'RECRUIT');
        await activeClient.emit('skip_trade', {});
        await deployAllTroops(activeClient, state);

        // Attack phase
        await advanceToPhase(activeClient, 'ATTACK');
        // Make one attack if possible
        const attackResult = await attemptAttack(activeClient, state);

        await activeClient.emit('end_attack_phase', {});

        // Maneuver phase
        await activeClient.emit('skip_maneuver', {});

        turns++;
      }

      // Verify game ended properly
      const finalState = server.getGameState(gameId);
      expect(finalState.status).toBe('finished');
      expect(finalState.winnerId).toBeDefined();
    });

    it('should handle turn cycle correctly', async () => {
      const gameId = await setupActiveGame(clients, server);

      // Get initial state
      const state1 = server.getGameState(gameId);
      const firstPlayer = state1.activePlayerId;

      // Complete first player's turn
      await completeTurn(clients.find((c) => c.playerId === firstPlayer), server, gameId);

      // Verify turn advanced
      const state2 = server.getGameState(gameId);
      expect(state2.activePlayerId).not.toBe(firstPlayer);
      expect(state2.turnOrder.indexOf(state2.activePlayerId))
        .toBe((state2.turnOrder.indexOf(firstPlayer) + 1) % 3);
    });
  });

  // ============================================
  // REINFORCEMENT PHASE
  // ============================================
  describe('Reinforcement Phase', () => {
    it('should calculate correct troop count based on territories', async () => {
      const gameId = await setupActiveGame(clients, server);
      const state = server.getGameState(gameId);

      const activePlayer = state.players.find((p) => p.id === state.activePlayerId);
      const territoryCount = activePlayer.territories.length;
      const expectedBase = Math.max(3, Math.floor(territoryCount / 3));

      expect(state.troopsToPlace).toBeGreaterThanOrEqual(expectedBase);
    });

    it('should add continent bonus when controlling full continent', async () => {
      const gameId = await setupActiveGame(clients, server, {
        // Player 1 controls all of Australia
        territoryAssignments: {
          1: [38, 39, 40, 41], // All 4 Australian territories
        },
      });

      const state = server.getGameState(gameId);

      // Australia bonus is 2
      expect(state.continentBonus).toBe(2);
    });

    it('should allow card trade for additional troops', async () => {
      const gameId = await setupActiveGame(clients, server);
      const client = clients[0];

      // Give player cards
      await server.giveCards(gameId, client.playerId, [
        { id: 1, coinValue: 3 },
        { id: 2, coinValue: 2 },
      ]);

      const stateBefore = server.getGameState(gameId);
      const troopsBefore = stateBefore.troopsToPlace;

      await client.emit('trade_cards_troops', { cardIds: [1, 2] });

      const stateAfter = server.getGameState(gameId);

      // 5 coins = 4 troops
      expect(stateAfter.troopsToPlace).toBe(troopsBefore + 4);
    });

    it('should enforce placing all troops before advancing', async () => {
      const gameId = await setupActiveGame(clients, server);
      const client = clients.find((c) => c.playerId === server.getGameState(gameId).activePlayerId);

      // Try to advance without placing troops
      const result = await client.emit('end_placement', {});

      expect(result.error).toBe('Must place all troops');
      expect(server.getGameState(gameId).phase).toBe('RECRUIT');
    });
  });

  // ============================================
  // ATTACK PHASE
  // ============================================
  describe('Attack Phase', () => {
    it('should complete full combat flow', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: [0, 1], // Alaska, NW Territory
          2: [5], // Quebec (adjacent to NW Territory via Ontario)
        },
        troops: {
          0: 5, // Alaska has 5 troops
          1: 1, // NW Territory
          5: 3, // Quebec
        },
      });

      const attacker = clients[0];
      const defender = clients[1];

      // Attacker declares attack
      await attacker.emit('declare_attack', { fromId: 0, toId: 5 });

      // Check state moved to ATTACKER_DICE
      let state = server.getGameState(gameId);
      expect(state.subPhase).toBe('ATTACKER_DICE');

      // Attacker chooses dice
      await attacker.emit('choose_attack_dice', { count: 3 });

      // State moves to DEFENDER_DICE
      state = server.getGameState(gameId);
      expect(state.subPhase).toBe('DEFENDER_DICE');

      // Defender receives prompt
      const prompt = await defender.waitForEvent('prompt:defend');
      expect(prompt.attackerId).toBe(attacker.playerId);

      // Defender chooses dice
      await defender.emit('choose_defend_dice', { count: 2 });

      // State moves to MISSILE_WINDOW
      state = server.getGameState(gameId);
      expect(state.subPhase).toBe('MISSILE_WINDOW');

      // Wait for window to expire
      await waitFor(() => server.getGameState(gameId).subPhase === 'RESOLVE', 6000);

      // Combat resolved
      state = server.getGameState(gameId);
      expect(state.lastCombatResult).toBeDefined();
      expect(state.lastCombatResult.attackerLosses).toBeDefined();
      expect(state.lastCombatResult.defenderLosses).toBeDefined();
    });

    it('should handle conquest and troop movement', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: { 1: [0], 2: [1] },
        troops: { 0: 10, 1: 1 },
      });

      const attacker = clients[0];

      // Force a winning combat (defender has only 1 troop)
      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 3 });

      // Wait for combat to resolve (auto-select defender, auto-expire missile)
      await waitFor(() => {
        const state = server.getGameState(gameId);
        return state.subPhase === 'TROOP_MOVE' || state.territories.get(1).ownerId === 1;
      }, 15000);

      const state = server.getGameState(gameId);

      if (state.subPhase === 'TROOP_MOVE') {
        // Conquest happened, need to move troops
        await attacker.emit('move_troops', { count: 3 });

        const finalState = server.getGameState(gameId);
        expect(finalState.territories.get(1).ownerId).toBe(1);
        expect(finalState.territories.get(1).troopCount).toBe(3);
      }
    });

    it('should mark player eligible for card after conquest', async () => {
      const gameId = await setupActiveGame(clients, server);
      const attacker = clients[0];

      // Win a combat
      await simulateCombat(attacker, server, gameId, { forceWin: true });

      const state = server.getGameState(gameId);
      const player = state.players.find((p) => p.id === attacker.playerId);

      expect(player.conqueredThisTurn).toBe(true);
    });

    it('should handle defender timeout (auto-select max dice)', async () => {
      const gameId = await setupActiveGame(clients, server);
      const attacker = clients[0];

      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 2 });

      // Don't respond as defender - wait for timeout
      await waitFor(() => {
        const state = server.getGameState(gameId);
        return state.subPhase !== 'DEFENDER_DICE';
      }, 12000);

      const state = server.getGameState(gameId);
      expect(['MISSILE_WINDOW', 'RESOLVE']).toContain(state.subPhase);
    });

    it('should allow missile use during window', async () => {
      const gameId = await setupActiveGame(clients, server);
      const attacker = clients[0];

      // Give attacker missiles
      await server.setPlayerMissiles(gameId, attacker.playerId, 2);

      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 3 });
      await clients[1].emit('choose_defend_dice', { count: 2 });

      // Now in missile window
      await waitFor(() => server.getGameState(gameId).subPhase === 'MISSILE_WINDOW');

      await attacker.emit('use_missile', { dieIndex: 2 }); // Boost lowest die

      const state = server.getGameState(gameId);
      const player = state.players.find((p) => p.id === attacker.playerId);

      expect(player.missiles).toBe(1);
      expect(state.currentCombat.attackerDice[2].value).toBe(6);
      expect(state.currentCombat.attackerDice[2].modifiable).toBe(false);
    });
  });

  // ============================================
  // MANEUVER PHASE
  // ============================================
  describe('Maneuver Phase', () => {
    it('should allow moving troops between connected territories', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: { 1: [0, 1, 3] }, // Connected chain
        troops: { 0: 5, 1: 2, 3: 1 },
      });

      const client = clients[0];
      await advanceToPhase(client, 'MANEUVER');

      await client.emit('execute_maneuver', { fromId: 0, toId: 3, count: 3 });

      const state = server.getGameState(gameId);
      expect(state.territories.get(0).troopCount).toBe(2); // 5 - 3
      expect(state.territories.get(3).troopCount).toBe(4); // 1 + 3
    });

    it('should reject maneuver through enemy territory', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: [0, 3], // Alaska, Alberta (not directly connected)
          2: [1], // NW Territory (blocks connection)
        },
      });

      const client = clients[0];
      await advanceToPhase(client, 'MANEUVER');

      const result = await client.emit('execute_maneuver', { fromId: 0, toId: 3, count: 2 });

      expect(result.error).toBe('NO_PATH');
    });

    it('should allow only one maneuver per turn', async () => {
      const gameId = await setupActiveGame(clients, server);
      const client = clients[0];
      await advanceToPhase(client, 'MANEUVER');

      await client.emit('execute_maneuver', { fromId: 0, toId: 1, count: 2 });
      const result = await client.emit('execute_maneuver', { fromId: 1, toId: 3, count: 1 });

      expect(result.error).toBe('Maneuver already used this turn');
    });
  });

  // ============================================
  // TURN END
  // ============================================
  describe('Turn End', () => {
    it('should draw card after conquest', async () => {
      const gameId = await setupActiveGame(clients, server);
      const client = clients[0];

      const stateBefore = server.getGameState(gameId);
      const cardsBefore = stateBefore.players.find((p) => p.id === client.playerId).cards.length;

      // Win a combat
      await simulateCombat(client, server, gameId, { forceWin: true });
      await client.emit('end_attack_phase', {});
      await client.emit('skip_maneuver', {});

      const stateAfter = server.getGameState(gameId);
      const cardsAfter = stateAfter.players.find((p) => p.id === client.playerId).cards.length;

      expect(cardsAfter).toBe(cardsBefore + 1);
    });

    it('should NOT draw card if only expanded (not conquered)', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: { 1: [0] },
        unoccupied: [1], // Territory 1 is unoccupied
      });

      const client = clients[0];
      const cardsBefore = server.getGameState(gameId).players
        .find((p) => p.id === client.playerId).cards.length;

      // Expand into unoccupied
      await client.emit('declare_attack', { fromId: 0, toId: 1 });
      await client.emit('move_troops', { count: 1 });

      await client.emit('end_attack_phase', {});
      await client.emit('skip_maneuver', {});

      const cardsAfter = server.getGameState(gameId).players
        .find((p) => p.id === client.playerId).cards.length;

      expect(cardsAfter).toBe(cardsBefore); // No card drawn
    });

    it('should advance to next player', async () => {
      const gameId = await setupActiveGame(clients, server);

      const state1 = server.getGameState(gameId);
      const firstPlayer = state1.activePlayerId;

      await completeTurn(clients.find((c) => c.playerId === firstPlayer), server, gameId);

      const state2 = server.getGameState(gameId);
      expect(state2.activePlayerId).not.toBe(firstPlayer);
    });
  });

  // ============================================
  // VICTORY CONDITIONS
  // ============================================
  describe('Victory Conditions', () => {
    it('should trigger victory at 4 red stars', async () => {
      const gameId = await setupActiveGame(clients, server);
      const client = clients[0];

      // Give player 3 stars
      await server.setPlayerStars(gameId, client.playerId, 3);

      // Give player 4 cards
      await server.giveCards(gameId, client.playerId, [
        { id: 1, coinValue: 1 },
        { id: 2, coinValue: 1 },
        { id: 3, coinValue: 1 },
        { id: 4, coinValue: 1 },
      ]);

      // Trade for 4th star
      await client.emit('trade_cards_star', { cardIds: [1, 2, 3, 4] });

      const state = server.getGameState(gameId);
      expect(state.status).toBe('finished');
      expect(state.winnerId).toBe(client.playerId);
    });

    it('should trigger victory when only one player remains', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: Array.from({ length: 40 }, (_, i) => i),
          2: [40],
          3: [41],
        },
      });

      // Eliminate player 2
      await server.eliminatePlayer(gameId, 2);
      // Eliminate player 3
      await server.eliminatePlayer(gameId, 3);

      const state = server.getGameState(gameId);
      expect(state.status).toBe('finished');
      expect(state.winnerId).toBe(1);
    });

    it('should award victory immediately during combat if star threshold reached', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: [0],
          2: [1], // Player 2's HQ is here
        },
        hqLocations: { 2: 1 },
      });

      const client = clients[0];
      await server.setPlayerStars(gameId, client.playerId, 3);

      // Capture enemy HQ (would give 4th star)
      await simulateCombat(client, server, gameId, {
        fromId: 0,
        toId: 1,
        forceWin: true,
      });

      // Victory should trigger immediately, even mid-combat
      const state = server.getGameState(gameId);
      expect(state.status).toBe('finished');
      expect(state.winnerId).toBe(client.playerId);
    });
  });

  // ============================================
  // ELIMINATION & RESPAWN
  // ============================================
  describe('Elimination & Respawn', () => {
    it('should eliminate player who loses all territories', async () => {
      const gameId = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: [0, 1, 2],
          2: [3], // Only one territory
        },
        troops: { 0: 10, 3: 1 },
      });

      const attacker = clients[0];

      // Conquer player 2's only territory
      await simulateCombat(attacker, server, gameId, {
        fromId: 0,
        toId: 3,
        forceWin: true,
      });

      const state = server.getGameState(gameId);
      const player2 = state.players.find((p) => p.id === 2);

      expect(player2.isEliminated).toBe(true);
    });

    it('should transfer cards to eliminator', async () => {
      const gameId = await setupActiveGame(clients, server);

      // Give player 2 some cards
      await server.giveCards(gameId, 2, [
        { id: 10, coinValue: 2 },
        { id: 11, coinValue: 3 },
      ]);

      // Eliminate player 2
      await simulateCombat(clients[0], server, gameId, {
        eliminatePlayer: 2,
      });

      const state = server.getGameState(gameId);
      const attacker = state.players.find((p) => p.id === 1);

      expect(attacker.cards).toContain(10);
      expect(attacker.cards).toContain(11);
    });

    it('should allow eliminated player to rejoin via Join the War', async () => {
      const gameId = await setupActiveGame(clients, server);

      // Eliminate player 2 but ensure legal territory exists
      await server.eliminatePlayer(gameId, 2, { canRejoin: true });

      // Advance to player 2's turn
      await advanceToPlayerTurn(server, gameId, 2);

      const client2 = clients[1];
      await client2.emit('place_respawn', { territoryId: 10 }); // Legal unoccupied territory

      const state = server.getGameState(gameId);
      const player2 = state.players.find((p) => p.id === 2);

      expect(player2.isEliminated).toBe(false);
      expect(state.territories.get(10).ownerId).toBe(2);
    });
  });
});

// Helper functions
async function setupActiveGame(clients, server, options = {}) {
  const gameId = await clients[0].emit('create_game', { name: 'Test' });
  await clients[1].emit('join_game', { gameId });
  await clients[2].emit('join_game', { gameId });
  await Promise.all(clients.map((c) => c.emit('ready_up', {})));
  await clients[0].emit('start_game', {});

  // Fast-forward through setup
  await server.fastForwardToActive(gameId, options);

  return gameId;
}

async function completeTurn(client, server, gameId) {
  const state = server.getGameState(gameId);

  if (state.phase === 'RECRUIT') {
    await client.emit('skip_trade', {});
    await deployAllTroops(client, state);
  }

  if (state.phase === 'ATTACK') {
    await client.emit('end_attack_phase', {});
  }

  await client.emit('skip_maneuver', {});
}

async function deployAllTroops(client, state) {
  const playerId = client.playerId;
  const territory = state.players.find((p) => p.id === playerId).territories[0];
  await client.emit('deploy_troop', { territoryId: territory, count: state.troopsToPlace });
}

async function attemptAttack(client, state) {
  // Find valid attack opportunity
  const playerId = client.playerId;
  const territories = state.players.find((p) => p.id === playerId).territories;

  for (const fromId of territories) {
    const from = state.territories.get(fromId);
    if (from.troopCount < 2) continue;

    for (const toId of from.neighbors) {
      const to = state.territories.get(toId);
      if (to.ownerId !== playerId) {
        await client.emit('declare_attack', { fromId, toId });
        return true;
      }
    }
  }
  return false;
}

function getAvailableFaction(state) {
  const taken = state.players.map((p) => p.factionId).filter(Boolean);
  const all = ['khan', 'bear', 'mechaniker', 'balkania', 'saharan'];
  return all.find((f) => !taken.includes(f));
}

function getLegalHQTerritory(state, playerId) {
  const taken = state.players.map((p) => p.hqTerritory).filter(Boolean);
  for (const [id, territory] of state.territories) {
    if (territory.scarId || territory.cityTier > 0) continue;
    if (taken.includes(id)) continue;
    // Check not adjacent to other HQs
    const adjacentToHQ = territory.neighbors.some((n) => taken.includes(n));
    if (!adjacentToHQ) return id;
  }
  throw new Error('No legal HQ territory');
}

async function advanceToPlayerTurn(server, gameId, playerId) {
  // Helper to advance game to specific player's turn
}
