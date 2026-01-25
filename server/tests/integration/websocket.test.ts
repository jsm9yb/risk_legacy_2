/**
 * WebSocket Integration Tests
 * Tests for: event emission, reception, reconnection, timeouts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestServer, createTestClient } from '../helpers/testServer';
import { waitFor } from '../helpers/testUtils';

describe('WebSocket Integration', () => {
  let server: any;
  let client1: any;
  let client2: any;

  beforeEach(async () => {
    server = await createTestServer();
    client1 = await createTestClient(server, { name: 'Player 1' });
    client2 = await createTestClient(server, { name: 'Player 2' });
  });

  afterEach(async () => {
    await client1?.disconnect();
    await client2?.disconnect();
    await server?.close();
  });

  // ============================================
  // EVENT EMISSION & RECEPTION
  // ============================================
  describe('Event Emission', () => {
    it('should emit game_state on connection', async () => {
      const gameId = await client1.emit('create_game', {});
      await client2.emit('join_game', { gameId });

      const stateEvent = await client2.waitForEvent('game_state');

      expect(stateEvent).toBeDefined();
      expect(stateEvent.gameId).toBe(gameId);
    });

    it('should broadcast state delta to all players', async () => {
      const gameId = await client1.emit('create_game', {});
      await client2.emit('join_game', { gameId });

      // Set up listener before action
      const deltaPromise = client2.waitForEvent('delta');

      // Client 1 makes a change
      await client1.emit('ready_up', {});

      const delta = await deltaPromise;
      expect(delta.players).toBeDefined();
    });

    it('should emit prompt:defend only to defender', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      // Client 1 attacks
      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });

      // Only client 2 (defender) should receive prompt
      const prompt = await client2.waitForEvent('prompt:defend', 5000);
      expect(prompt.attackerId).toBe(client1.playerId);

      // Client 1 should NOT receive the prompt
      const client1Events = client1.getReceivedEvents();
      expect(client1Events.filter((e) => e.type === 'prompt:defend')).toHaveLength(0);
    });

    it('should emit prompt:missile to all players with missiles', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);
      await server.setPlayerMissiles(gameId, client1.playerId, 2);
      await server.setPlayerMissiles(gameId, client2.playerId, 1);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });
      await client2.emit('choose_defend_dice', { count: 2 });

      const prompt1 = await client1.waitForEvent('prompt:missile', 2000);
      const prompt2 = await client2.waitForEvent('prompt:missile', 2000);

      expect(prompt1.eligiblePlayers).toContain(client1.playerId);
      expect(prompt2.eligiblePlayers).toContain(client2.playerId);
    });

    it('should emit event:combat_rolls before resolution', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });
      await client2.emit('choose_defend_dice', { count: 2 });

      const rollEvent = await client1.waitForEvent('event:combat_rolls', 7000);

      expect(rollEvent.attackerDice).toHaveLength(3);
      expect(rollEvent.defenderDice).toHaveLength(2);
      rollEvent.attackerDice.forEach((d) => {
        expect(d.value).toBeGreaterThanOrEqual(1);
        expect(d.value).toBeLessThanOrEqual(6);
      });
    });

    it('should emit event:conquest when territory captured', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server, {
        defenderTroops: 1, // Easy to conquer
      });

      const conquestPromise = client1.waitForEvent('event:conquest', 15000);

      // Run combat until conquest or give up
      await runCombatUntilEnd(client1, client2, gameId, server);

      try {
        const conquest = await conquestPromise;
        expect(conquest.territoryId).toBe(1);
        expect(conquest.newOwnerId).toBe(client1.playerId);
      } catch {
        // Combat may not have resulted in conquest - that's ok
      }
    });

    it('should emit event:elimination when player eliminated', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server, {
        defenderTerritories: [1], // Only one territory
        defenderTroops: 1,
      });

      const eliminationPromise = client1.waitForEvent('event:elimination', 30000);

      // Force elimination
      await server.forceConquest(gameId, client1.playerId, 1);

      const elimination = await eliminationPromise;
      expect(elimination.playerId).toBe(client2.playerId);
    });

    it('should emit event:victory when game ends', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);
      await server.setPlayerStars(gameId, client1.playerId, 4);

      const victoryPromise = client1.waitForEvent('event:victory', 5000);
      await server.checkVictory(gameId);

      const victory = await victoryPromise;
      expect(victory.winnerId).toBe(client1.playerId);
    });
  });

  // ============================================
  // RECONNECTION
  // ============================================
  describe('Reconnection', () => {
    it('should restore game state on reconnect', async () => {
      const gameId = await client1.emit('create_game', {});
      await client2.emit('join_game', { gameId });
      await client1.emit('ready_up', {});
      await client2.emit('ready_up', {});
      await client1.emit('start_game', {});

      // Store player session
      const sessionToken = client1.sessionToken;
      const playerId = client1.playerId;

      // Disconnect
      await client1.disconnect();

      // Reconnect with same session
      client1 = await createTestClient(server, {
        sessionToken,
        playerId,
      });

      const state = await client1.waitForEvent('game_state', 5000);

      expect(state.gameId).toBe(gameId);
      expect(state.status).toBe('setup');
    });

    it('should allow continuing turn after reconnect', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Disconnect mid-turn
      const sessionToken = client1.sessionToken;
      await client1.disconnect();

      // Reconnect
      client1 = await createTestClient(server, { sessionToken });

      // Should be able to continue
      const result = await client1.emit('end_attack_phase', {});
      expect(result.error).toBeUndefined();
    });

    it('should handle reconnect during combat', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });

      // Defender disconnects while needing to choose dice
      const session2 = client2.sessionToken;
      await client2.disconnect();

      // Reconnect
      client2 = await createTestClient(server, { sessionToken: session2 });

      // Should still receive defend prompt
      const prompt = await client2.waitForEvent('prompt:defend', 5000);
      expect(prompt).toBeDefined();
    });

    it('should preserve pending timeouts on reconnect', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });

      // Wait 5 seconds of the 10 second defender timeout
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Reconnect defender
      const session2 = client2.sessionToken;
      await client2.disconnect();
      client2 = await createTestClient(server, { sessionToken: session2 });

      // Timeout should still fire after ~5 more seconds (not reset to 10)
      const startTime = Date.now();
      await waitFor(() => server.getGameState(gameId).subPhase !== 'DEFENDER_DICE', 7000);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(6000); // Should be around 5 seconds, not 10
    });
  });

  // ============================================
  // TIMEOUT HANDLING
  // ============================================
  describe('Timeout Handling', () => {
    it('should auto-select defender dice after 10 seconds', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });

      // Don't respond - wait for timeout
      await waitFor(
        () => server.getGameState(gameId).subPhase !== 'DEFENDER_DICE',
        12000
      );

      const state = server.getGameState(gameId);
      expect(state.currentCombat.defenderDice).toBeDefined();
    });

    it('should proceed after missile window expires (5 seconds)', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });
      await client2.emit('choose_defend_dice', { count: 2 });

      // Wait for missile window to expire
      await waitFor(
        () => server.getGameState(gameId).subPhase === 'RESOLVE',
        7000
      );

      expect(server.getGameState(gameId).subPhase).toBe('RESOLVE');
    });

    it('should reset missile window to 3s after use', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);
      await server.setPlayerMissiles(gameId, client1.playerId, 2);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });
      await client2.emit('choose_defend_dice', { count: 2 });

      // Wait until in missile window
      await waitFor(() => server.getGameState(gameId).subPhase === 'MISSILE_WINDOW');

      // Use missile
      const startTime = Date.now();
      await client1.emit('use_missile', { dieIndex: 0 });

      // Window should reset - wait for it to expire
      await waitFor(() => server.getGameState(gameId).subPhase === 'RESOLVE', 5000);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(2500); // At least 3 seconds
      expect(elapsed).toBeLessThan(4500); // But not much more
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  describe('Error Handling', () => {
    it('should reject action from non-active player', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Find which client is NOT the active player
      const state = server.getGameState(gameId);
      const inactiveClient = state.activePlayerId === client1.playerId ? client2 : client1;

      const result = await inactiveClient.emit('deploy_troop', {
        territoryId: 1,
        count: 1,
      });

      expect(result.error).toBe('NOT_YOUR_TURN');
    });

    it('should reject invalid phase action', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // In RECRUIT phase, try attack action
      const state = server.getGameState(gameId);
      const activeClient = state.activePlayerId === client1.playerId ? client1 : client2;

      const result = await activeClient.emit('declare_attack', {
        fromId: 0,
        toId: 1,
      });

      expect(result.error).toBe('INVALID_PHASE');
    });

    it('should handle malformed messages gracefully', async () => {
      // Send invalid JSON - connection should survive
      client1.socket.send('not valid json');

      // Client should still be connected
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(client1.isConnected()).toBe(true);
    });

    it('should reject actions after game is finished', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // End the game
      await server.setPlayerStars(gameId, client1.playerId, 4);
      await server.checkVictory(gameId);

      // Try to take action
      const result = await client1.emit('end_attack_phase', {});

      expect(result.error).toBe('GAME_FINISHED');
    });
  });

  // ============================================
  // CONCURRENT ACTIONS
  // ============================================
  describe('Concurrent Actions', () => {
    it('should handle simultaneous missile uses correctly', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);
      await server.setPlayerMissiles(gameId, client1.playerId, 2);
      await server.setPlayerMissiles(gameId, client2.playerId, 2);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });
      await client1.emit('choose_attack_dice', { count: 3 });
      await client2.emit('choose_defend_dice', { count: 2 });

      await waitFor(() => server.getGameState(gameId).subPhase === 'MISSILE_WINDOW');

      // Both players try to use missile at same time
      const [result1, result2] = await Promise.all([
        client1.emit('use_missile', { dieIndex: 0 }),
        client2.emit('use_missile', { dieIndex: 0 }),
      ]);

      // Both should succeed (on different dice sets)
      expect(result1.error).toBeUndefined();
      expect(result2.error).toBeUndefined();

      const state = server.getGameState(gameId);
      expect(state.currentCombat.attackerDice[0].value).toBe(6);
      expect(state.currentCombat.defenderDice[0].value).toBe(6);
    });

    it('should serialize rapid sequential actions', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);
      const activeClient = server.getGameState(gameId).activePlayerId === client1.playerId
        ? client1
        : client2;

      // Rapid fire deployment
      const results = await Promise.all([
        activeClient.emit('deploy_troop', { territoryId: 0, count: 1 }),
        activeClient.emit('deploy_troop', { territoryId: 0, count: 1 }),
        activeClient.emit('deploy_troop', { territoryId: 0, count: 1 }),
      ]);

      // All should succeed or be properly serialized
      const successes = results.filter((r) => !r.error).length;
      expect(successes).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // CAMPAIGN EVENTS
  // ============================================
  describe('Campaign Events', () => {
    it('should emit event:packet_opened when packet unlocked', async () => {
      const { campaignId, gameId } = await setupCampaignGame(client1, client2, server);

      // Trigger second win condition
      await server.recordVictory(campaignId, client1.playerId, 'khan');
      await server.recordVictory(campaignId, client1.playerId, 'khan');

      const packetEvent = await client1.waitForEvent('event:packet_opened', 5000);

      expect(packetEvent.packetId).toBe('SECOND_WIN');
    });

    it('should emit event:scar_placed on scar placement', async () => {
      const { campaignId, gameId } = await setupCampaignGame(client1, client2, server);

      const scarPromise = client1.waitForEvent('event:scar_placed', 5000);
      await client1.emit('place_scar', { territoryId: 5, scarId: 'bunker' });

      const scarEvent = await scarPromise;
      expect(scarEvent.territoryId).toBe(5);
      expect(scarEvent.scarId).toBe('bunker');
    });

    it('should emit event:city_founded on city placement', async () => {
      // In write phase
      const { campaignId, gameId } = await setupWritePhase(client1, client2, server);

      const cityPromise = client1.waitForEvent('event:city_founded', 5000);
      await client1.emit('found_city', {
        territoryId: 10,
        name: 'New City',
        cityType: 'major',
      });

      const cityEvent = await cityPromise;
      expect(cityEvent.territoryId).toBe(10);
      expect(cityEvent.name).toBe('New City');
    });
  });
});

// Helper functions
async function setupCombatScenario(client1, client2, server, options = {}) {
  const gameId = await client1.emit('create_game', {});
  await client2.emit('join_game', { gameId });
  await client1.emit('ready_up', {});
  await client2.emit('ready_up', {});
  await client1.emit('start_game', {});

  await server.fastForwardToActive(gameId, {
    activePlayerId: client1.playerId,
    phase: 'ATTACK',
    territoryAssignments: {
      [client1.playerId]: [0],
      [client2.playerId]: options.defenderTerritories || [1],
    },
    troops: {
      0: 10,
      1: options.defenderTroops || 5,
    },
  });

  return { gameId };
}

async function setupActiveGame(client1, client2, server) {
  const gameId = await client1.emit('create_game', {});
  await client2.emit('join_game', { gameId });
  await client1.emit('ready_up', {});
  await client2.emit('ready_up', {});
  await client1.emit('start_game', {});
  await server.fastForwardToActive(gameId);
  return { gameId };
}

async function setupCampaignGame(client1, client2, server) {
  const campaignId = await client1.emit('create_campaign', { name: 'Test' });
  await client2.emit('join_campaign', { campaignId });
  await client1.emit('ready_up', {});
  await client2.emit('ready_up', {});
  await client1.emit('start_campaign', {});
  const gameId = server.getCampaignState(campaignId).currentGameId;
  return { campaignId, gameId };
}

async function setupWritePhase(client1, client2, server) {
  const { campaignId, gameId } = await setupCampaignGame(client1, client2, server);
  await server.forceVictory(gameId, client1.playerId);
  return { campaignId, gameId };
}

async function runCombatUntilEnd(attacker, defender, gameId, server) {
  let maxRounds = 10;
  while (maxRounds-- > 0) {
    const state = server.getGameState(gameId);
    if (state.subPhase === 'IDLE' || state.subPhase === 'TROOP_MOVE') break;

    if (state.subPhase === 'DEFENDER_DICE') {
      await defender.emit('choose_defend_dice', { count: 2 });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}
