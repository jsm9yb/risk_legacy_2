/**
 * Multiplayer Integration Tests
 * Tests for: turn enforcement, player interactions, elimination
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, createTestClient } from '../helpers/testServer';
import { waitFor, simulateCombat } from '../helpers/testUtils';

describe('Multiplayer Integration', () => {
  let server: any;
  let clients: any[];

  beforeEach(async () => {
    server = await createTestServer();
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map((c) => c?.disconnect()));
    await server?.close();
  });

  async function createClients(count: number) {
    for (let i = 0; i < count; i++) {
      clients.push(await createTestClient(server, { name: `Player ${i + 1}` }));
    }
    return clients;
  }

  // ============================================
  // TURN ENFORCEMENT
  // ============================================
  describe('Turn Enforcement', () => {
    it('should only allow active player to take turn actions', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const state = server.getGameState(gameId);
      const activePlayer = clients.find((c) => c.playerId === state.activePlayerId);
      const inactivePlayers = clients.filter((c) => c.playerId !== state.activePlayerId);

      // Active player can act
      const activeResult = await activePlayer.emit('skip_trade', {});
      expect(activeResult.error).toBeUndefined();

      // Inactive players cannot
      for (const inactive of inactivePlayers) {
        const result = await inactive.emit('deploy_troop', { territoryId: 1, count: 1 });
        expect(result.error).toBe('NOT_YOUR_TURN');
      }
    });

    it('should rotate turns correctly in 3-player game', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const turnOrder = server.getGameState(gameId).turnOrder;
      const seenOrder: number[] = [];

      // Complete 3 turns
      for (let i = 0; i < 3; i++) {
        const state = server.getGameState(gameId);
        seenOrder.push(state.activePlayerId);

        const activeClient = clients.find((c) => c.playerId === state.activePlayerId);
        await completeTurn(activeClient, server, gameId);
      }

      expect(seenOrder).toEqual(turnOrder);
    });

    it('should rotate turns correctly in 5-player game', async () => {
      await createClients(5);
      const { gameId } = await setupActiveGame(clients, server);

      const turnOrder = server.getGameState(gameId).turnOrder;
      expect(turnOrder).toHaveLength(5);

      // Complete full round
      for (let i = 0; i < 5; i++) {
        const state = server.getGameState(gameId);
        expect(state.activePlayerId).toBe(turnOrder[i]);

        const activeClient = clients.find((c) => c.playerId === state.activePlayerId);
        await completeTurn(activeClient, server, gameId);
      }

      // Should be back to first player
      expect(server.getGameState(gameId).activePlayerId).toBe(turnOrder[0]);
    });

    it('should skip eliminated players in turn order', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const turnOrder = server.getGameState(gameId).turnOrder;

      // Eliminate player at index 1
      await server.eliminatePlayer(gameId, turnOrder[1], { canRejoin: false });

      // Complete turn for player 0
      const client0 = clients.find((c) => c.playerId === turnOrder[0]);
      await completeTurn(client0, server, gameId);

      // Should skip to player 2, not player 1
      expect(server.getGameState(gameId).activePlayerId).toBe(turnOrder[2]);
    });

    it('should allow eliminated player turn if they can rejoin', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const turnOrder = server.getGameState(gameId).turnOrder;

      // Eliminate player at index 1 WITH rejoin possibility
      await server.eliminatePlayer(gameId, turnOrder[1], { canRejoin: true });

      // Complete turn for player 0
      const client0 = clients.find((c) => c.playerId === turnOrder[0]);
      await completeTurn(client0, server, gameId);

      // Should still be player 1's turn (for rejoin)
      expect(server.getGameState(gameId).activePlayerId).toBe(turnOrder[1]);
      expect(server.getGameState(gameId).subPhase).toBe('JOIN_WAR');
    });
  });

  // ============================================
  // PLAYER INTERACTIONS (Combat)
  // ============================================
  describe('Player Interactions', () => {
    it('should prompt defender during attack', async () => {
      await createClients(3);
      const { gameId } = await setupCombatScenario(clients, server);

      const state = server.getGameState(gameId);
      const attacker = clients.find((c) => c.playerId === state.activePlayerId);
      const defender = clients.find(
        (c) => c.playerId === state.territories.get(1).ownerId
      );

      // Set up promise before attack
      const promptPromise = defender.waitForEvent('prompt:defend', 5000);

      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 3 });

      const prompt = await promptPromise;
      expect(prompt.attackerId).toBe(attacker.playerId);
      expect(prompt.fromId).toBe(0);
      expect(prompt.toId).toBe(1);
    });

    it('should allow any player with missiles to use during window', async () => {
      await createClients(3);
      const { gameId } = await setupCombatScenario(clients, server);

      // Give all players missiles
      for (const client of clients) {
        await server.setPlayerMissiles(gameId, client.playerId, 2);
      }

      const state = server.getGameState(gameId);
      const attacker = clients.find((c) => c.playerId === state.activePlayerId);
      const defender = clients.find(
        (c) => c.playerId === state.territories.get(1).ownerId
      );
      const bystander = clients.find(
        (c) => c.playerId !== attacker.playerId && c.playerId !== defender.playerId
      );

      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 3 });
      await defender.emit('choose_defend_dice', { count: 2 });

      await waitFor(() => server.getGameState(gameId).subPhase === 'MISSILE_WINDOW');

      // Bystander (3rd player) can use missile
      const result = await bystander.emit('use_missile', { dieIndex: 0 });
      expect(result.error).toBeUndefined();
    });

    it('should broadcast combat results to all players', async () => {
      await createClients(3);
      const { gameId } = await setupCombatScenario(clients, server);

      const state = server.getGameState(gameId);
      const attacker = clients.find((c) => c.playerId === state.activePlayerId);
      const defender = clients.find(
        (c) => c.playerId === state.territories.get(1).ownerId
      );

      // All clients listen for result
      const resultPromises = clients.map((c) =>
        c.waitForEvent('event:combat_result', 15000)
      );

      await attacker.emit('declare_attack', { fromId: 0, toId: 1 });
      await attacker.emit('choose_attack_dice', { count: 3 });
      await defender.emit('choose_defend_dice', { count: 2 });

      // Wait for missile window to expire
      await waitFor(() => server.getGameState(gameId).subPhase === 'RESOLVE', 7000);

      const results = await Promise.all(resultPromises);

      // All should receive same result
      results.forEach((result) => {
        expect(result.attackerLosses).toBeDefined();
        expect(result.defenderLosses).toBeDefined();
      });
    });
  });

  // ============================================
  // ELIMINATION HANDLING
  // ============================================
  describe('Elimination Handling', () => {
    it('should eliminate player with 0 territories', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server, {
        territoryAssignments: {
          1: [0, 1, 2, 3, 4],
          2: [5], // Only one territory
          3: [6, 7, 8, 9],
        },
      });

      // Player 1 conquers player 2's only territory
      await server.forceConquest(gameId, 1, 5);

      const state = server.getGameState(gameId);
      const player2 = state.players.find((p) => p.id === 2);

      expect(player2.isEliminated).toBe(true);
    });

    it('should transfer cards from eliminated to eliminator', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      // Give player 2 cards
      await server.giveCards(gameId, 2, [
        { id: 100, coinValue: 3 },
        { id: 101, coinValue: 2 },
      ]);

      const cardsBefore = server.getGameState(gameId).players.find((p) => p.id === 1).cards.length;

      // Player 1 eliminates player 2
      await server.eliminatePlayerBy(gameId, 2, 1);

      const state = server.getGameState(gameId);
      const player1Cards = state.players.find((p) => p.id === 1).cards;

      expect(player1Cards).toContain(100);
      expect(player1Cards).toContain(101);
      expect(player1Cards.length).toBe(cardsBefore + 2);
    });

    it('should allow rejoining via Join the War when eligible', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      // Eliminate player 2 with rejoin enabled
      await server.eliminatePlayer(gameId, 2, { canRejoin: true });

      // Advance to player 2's turn
      const state = server.getGameState(gameId);
      await advanceToPlayerTurn(clients, server, gameId, 2);

      // Player 2 can rejoin
      const client2 = clients.find((c) => c.playerId === 2);
      const result = await client2.emit('place_respawn', { territoryId: 10 });

      expect(result.error).toBeUndefined();

      const newState = server.getGameState(gameId);
      expect(newState.players.find((p) => p.id === 2).isEliminated).toBe(false);
      expect(newState.territories.get(10).ownerId).toBe(2);
    });

    it('should end game when only one player remains', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      // Eliminate player 2 and 3
      await server.eliminatePlayer(gameId, 2, { canRejoin: false });
      await server.eliminatePlayer(gameId, 3, { canRejoin: false });

      const state = server.getGameState(gameId);

      expect(state.status).toBe('finished');
      expect(state.winnerId).toBe(1);
    });

    it('should emit elimination event to all players', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const eliminationPromises = clients.map((c) =>
        c.waitForEvent('event:elimination', 5000)
      );

      await server.eliminatePlayer(gameId, 2);

      const events = await Promise.all(eliminationPromises);

      events.forEach((event) => {
        expect(event.playerId).toBe(2);
      });
    });
  });

  // ============================================
  // SPECTATOR MODE
  // ============================================
  describe('Spectator Handling', () => {
    it('should allow eliminated player to spectate', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      await server.eliminatePlayer(gameId, 2, { canRejoin: false });

      const client2 = clients.find((c) => c.playerId === 2);

      // Should still receive state updates
      const statePromise = client2.waitForEvent('delta', 5000);

      // Trigger a state change
      const activeClient = clients.find(
        (c) => c.playerId === server.getGameState(gameId).activePlayerId
      );
      await activeClient.emit('skip_trade', {});

      const delta = await statePromise;
      expect(delta).toBeDefined();
    });

    it('should prevent eliminated player from taking actions', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      await server.eliminatePlayer(gameId, 2, { canRejoin: false });

      const client2 = clients.find((c) => c.playerId === 2);
      const result = await client2.emit('deploy_troop', { territoryId: 1, count: 1 });

      expect(result.error).toBe('PLAYER_ELIMINATED');
    });
  });

  // ============================================
  // PLAYER COUNT VARIATIONS
  // ============================================
  describe('Player Count Variations', () => {
    it('should handle 3-player game correctly', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      const state = server.getGameState(gameId);
      expect(state.players).toHaveLength(3);
      expect(state.turnOrder).toHaveLength(3);
    });

    it('should handle 4-player game correctly', async () => {
      await createClients(4);
      const { gameId } = await setupActiveGame(clients, server);

      const state = server.getGameState(gameId);
      expect(state.players).toHaveLength(4);
      expect(state.turnOrder).toHaveLength(4);
    });

    it('should handle 5-player game correctly', async () => {
      await createClients(5);
      const { gameId } = await setupActiveGame(clients, server);

      const state = server.getGameState(gameId);
      expect(state.players).toHaveLength(5);
      expect(state.turnOrder).toHaveLength(5);
    });

    it('should reject 6th player joining', async () => {
      await createClients(5);
      const gameId = await clients[0].emit('create_game', {});

      for (let i = 1; i < 5; i++) {
        await clients[i].emit('join_game', { gameId });
      }

      // Create 6th client and try to join
      const client6 = await createTestClient(server, { name: 'Player 6' });
      clients.push(client6);

      const result = await client6.emit('join_game', { gameId });

      expect(result.error).toBe('GAME_FULL');
    });

    it('should reject 2-player game start', async () => {
      await createClients(2);

      const gameId = await clients[0].emit('create_game', {});
      await clients[1].emit('join_game', { gameId });
      await clients[0].emit('ready_up', {});
      await clients[1].emit('ready_up', {});

      const result = await clients[0].emit('start_game', {});

      expect(result.error).toBe('NOT_ENOUGH_PLAYERS');
    });
  });

  // ============================================
  // ALLIANCE / TRADING (if applicable)
  // ============================================
  describe('Inter-Player Trading', () => {
    // Risk Legacy doesn't have formal trading, but future packets might add it
    it('should handle card transfer on elimination', async () => {
      await createClients(3);
      const { gameId } = await setupActiveGame(clients, server);

      // Give each player different cards
      await server.giveCards(gameId, 1, [{ id: 1, coinValue: 2 }]);
      await server.giveCards(gameId, 2, [{ id: 2, coinValue: 3 }, { id: 3, coinValue: 1 }]);

      // Eliminate player 2 by player 1
      await server.eliminatePlayerBy(gameId, 2, 1);

      const state = server.getGameState(gameId);
      const player1Cards = state.players.find((p) => p.id === 1).cards;

      // Player 1 should have their card plus player 2's cards
      expect(player1Cards).toContain(1);
      expect(player1Cards).toContain(2);
      expect(player1Cards).toContain(3);
    });
  });
});

// Helper functions
async function setupActiveGame(clients, server, options = {}) {
  const gameId = await clients[0].emit('create_game', { name: 'Test' });

  for (let i = 1; i < clients.length; i++) {
    await clients[i].emit('join_game', { gameId });
  }

  await Promise.all(clients.map((c) => c.emit('ready_up', {})));
  await clients[0].emit('start_game', {});

  await server.fastForwardToActive(gameId, options);

  return { gameId };
}

async function setupCombatScenario(clients, server) {
  const { gameId } = await setupActiveGame(clients, server, {
    phase: 'ATTACK',
    territoryAssignments: {
      [clients[0].playerId]: [0],
      [clients[1].playerId]: [1],
      [clients[2].playerId]: [2, 3, 4],
    },
    troops: { 0: 10, 1: 5, 2: 3, 3: 3, 4: 3 },
    adjacency: { 0: [1], 1: [0, 2], 2: [1, 3, 4] },
  });

  return { gameId };
}

async function completeTurn(client, server, gameId) {
  const state = server.getGameState(gameId);

  if (state.phase === 'RECRUIT') {
    await client.emit('skip_trade', {});
    // Deploy all troops to first territory
    const player = state.players.find((p) => p.id === client.playerId);
    if (player.territories.length > 0) {
      await client.emit('deploy_troop', {
        territoryId: player.territories[0],
        count: state.troopsToPlace,
      });
    }
  }

  if (state.phase === 'ATTACK' || state.subPhase === 'IDLE') {
    await client.emit('end_attack_phase', {});
  }

  await client.emit('skip_maneuver', {});
}

async function advanceToPlayerTurn(clients, server, gameId, targetPlayerId) {
  let maxIterations = 10;
  while (maxIterations-- > 0) {
    const state = server.getGameState(gameId);
    if (state.activePlayerId === targetPlayerId) return;

    const activeClient = clients.find((c) => c.playerId === state.activePlayerId);
    await completeTurn(activeClient, server, gameId);
  }
  throw new Error('Could not advance to target player turn');
}
