/**
 * Security & Validation Tests
 * Tests for: input validation, authorization, injection prevention
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, createTestClient } from '../helpers/testServer';

describe('Security & Validation', () => {
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
  // AUTHENTICATION & AUTHORIZATION
  // ============================================
  describe('Authentication', () => {
    it('should reject requests without valid session', async () => {
      const unauthClient = await createTestClient(server, { skipAuth: true });

      const result = await unauthClient.emit('create_game', {});

      expect(result.error).toBe('UNAUTHORIZED');

      await unauthClient.disconnect();
    });

    it('should reject expired session tokens', async () => {
      const expiredClient = await createTestClient(server, {
        sessionToken: 'expired-token-123',
      });

      const result = await expiredClient.emit('join_game', { gameId: 'test' });

      expect(result.error).toBe('SESSION_EXPIRED');

      await expiredClient.disconnect();
    });

    it('should not allow impersonating another player', async () => {
      const gameId = await client1.emit('create_game', {});

      // Client 2 tries to act as client 1
      const result = await client2.emit('deploy_troop', {
        gameId,
        playerId: client1.playerId, // Trying to impersonate
        territoryId: 0,
        count: 1,
      });

      expect(result.error).toBe('UNAUTHORIZED');
    });
  });

  // ============================================
  // AUTHORIZATION (Game Actions)
  // ============================================
  describe('Authorization', () => {
    it('should reject action when not your turn', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      const state = server.getGameState(gameId);
      const inactiveClient = state.activePlayerId === client1.playerId ? client2 : client1;

      const result = await inactiveClient.emit('deploy_troop', {
        territoryId: 0,
        count: 1,
      });

      expect(result.error).toBe('NOT_YOUR_TURN');
    });

    it('should reject action on territory not owned', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server, {
        territoryAssignments: {
          [client1.playerId]: [0],
          [client2.playerId]: [1],
        },
      });

      // Make it client1's turn
      await server.setActivePlayer(gameId, client1.playerId);

      const result = await client1.emit('deploy_troop', {
        territoryId: 1, // Owned by client2
        count: 1,
      });

      expect(result.error).toBe('INVALID_TERRITORY');
    });

    it('should reject game actions after elimination', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      await server.eliminatePlayer(gameId, client1.playerId, { canRejoin: false });

      const result = await client1.emit('end_attack_phase', {});

      expect(result.error).toBe('PLAYER_ELIMINATED');
    });

    it('should reject joining full game', async () => {
      const gameId = await client1.emit('create_game', { maxPlayers: 3 });
      await client2.emit('join_game', { gameId });

      const client3 = await createTestClient(server, { name: 'Player 3' });
      await client3.emit('join_game', { gameId });

      const client4 = await createTestClient(server, { name: 'Player 4' });
      const result = await client4.emit('join_game', { gameId });

      expect(result.error).toBe('GAME_FULL');

      await client3.disconnect();
      await client4.disconnect();
    });

    it('should reject host-only actions from non-host', async () => {
      const gameId = await client1.emit('create_game', {});
      await client2.emit('join_game', { gameId });

      // Non-host tries to start game
      const result = await client2.emit('start_game', {});

      expect(result.error).toBe('NOT_HOST');
    });
  });

  // ============================================
  // INPUT VALIDATION
  // ============================================
  describe('Input Validation', () => {
    it('should reject invalid territory IDs', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      const invalidIds = [-1, 42, 100, 'alaska', null, undefined, {}, []];

      for (const invalidId of invalidIds) {
        const result = await client1.emit('deploy_troop', {
          territoryId: invalidId,
          count: 1,
        });

        expect(result.error).toMatch(/INVALID|TERRITORY/);
      }
    });

    it('should reject invalid troop counts', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      const invalidCounts = [-1, 0, 1000, 'five', null, 1.5, Infinity, NaN];

      for (const count of invalidCounts) {
        const result = await client1.emit('deploy_troop', {
          territoryId: 0,
          count,
        });

        expect(result.error).toBeDefined();
      }
    });

    it('should reject invalid dice counts', async () => {
      const { gameId } = await setupCombatScenario(client1, client2, server);

      await client1.emit('declare_attack', { fromId: 0, toId: 1 });

      const invalidCounts = [0, 4, -1, 'three', null];

      for (const count of invalidCounts) {
        const result = await client1.emit('choose_attack_dice', { count });
        expect(result.error).toBeDefined();
      }
    });

    it('should sanitize string inputs', async () => {
      // Campaign name with XSS attempt
      const maliciousName = '<script>alert("xss")</script>';

      const campaignId = await client1.emit('create_campaign', {
        name: maliciousName,
      });

      const state = server.getCampaignState(campaignId);

      // Name should be sanitized
      expect(state.name).not.toContain('<script>');
      expect(state.name).not.toContain('alert');
    });

    it('should reject overly long strings', async () => {
      const longName = 'A'.repeat(10000);

      const result = await client1.emit('create_campaign', {
        name: longName,
      });

      expect(result.error).toBe('NAME_TOO_LONG');
    });

    it('should validate JSON payload structure', async () => {
      // Send malformed payload
      const result = await client1.emit('deploy_troop', 'not an object');

      expect(result.error).toMatch(/INVALID|PAYLOAD/);
    });
  });

  // ============================================
  // SQL INJECTION PREVENTION
  // ============================================
  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempts in names', async () => {
      const injectionAttempts = [
        "'; DROP TABLE campaigns; --",
        "1' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const attempt of injectionAttempts) {
        const result = await client1.emit('create_campaign', { name: attempt });

        // Should either succeed (with sanitized name) or fail validation
        // Should NOT cause database errors
        expect(result.error).not.toMatch(/SQL|database|syntax/i);

        if (result.campaignId) {
          const state = server.getCampaignState(result.campaignId);
          // Name should be stored safely
          expect(state).toBeDefined();
        }
      }
    });

    it('should safely handle injection in city names', async () => {
      const { campaignId, gameId } = await setupWritePhase(client1, client2, server);

      const injection = "'; DELETE FROM territories; --";

      const result = await client1.emit('found_city', {
        territoryId: 10,
        name: injection,
        cityType: 'minor',
      });

      // Should not cause error
      expect(result.error).not.toMatch(/SQL|database/i);
    });
  });

  // ============================================
  // RATE LIMITING
  // ============================================
  describe('Rate Limiting', () => {
    it('should rate limit rapid-fire requests', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Send 100 requests rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(client1.emit('deploy_troop', { territoryId: 0, count: 1 }));
      }

      const results = await Promise.all(promises);
      const rateLimited = results.filter((r) => r.error === 'RATE_LIMITED');

      // Some requests should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should rate limit game creation', async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(client1.emit('create_game', { name: `Game ${i}` }));
      }

      const results = await Promise.all(promises);
      const rateLimited = results.filter((r) => r.error === 'RATE_LIMITED');

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // STATE MANIPULATION PREVENTION
  // ============================================
  describe('State Manipulation Prevention', () => {
    it('should reject direct state modification attempts', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Try to directly set stars
      const result = await client1.emit('set_state', {
        players: [{ id: client1.playerId, redStars: 4 }],
      });

      expect(result.error).toBe('INVALID_ACTION');

      // Verify state unchanged
      const state = server.getGameState(gameId);
      expect(state.players.find((p) => p.id === client1.playerId).redStars).not.toBe(4);
    });

    it('should reject forged card IDs in trade', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Player doesn't have these cards
      const result = await client1.emit('trade_cards_troops', {
        cardIds: [999, 998, 997],
      });

      expect(result.error).toBe('CARD_NOT_OWNED');
    });

    it('should reject invalid phase transitions', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      // Try to skip directly to victory
      const result = await client1.emit('claim_victory', {});

      expect(result.error).toMatch(/INVALID|PHASE/);
    });
  });

  // ============================================
  // TIMING ATTACK PREVENTION
  // ============================================
  describe('Timing Attack Prevention', () => {
    it('should not leak information via response timing', async () => {
      // Valid and invalid user lookups should take similar time
      const timings: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await client1.emit('join_game', { gameId: 'valid-game-id' });
        timings.push(Date.now() - start);
      }

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await client1.emit('join_game', { gameId: 'invalid-game-id-that-does-not-exist' });
        timings.push(Date.now() - start);
      }

      // Calculate variance - should be similar for valid vs invalid
      const validTimings = timings.slice(0, 10);
      const invalidTimings = timings.slice(10);

      const validAvg = validTimings.reduce((a, b) => a + b) / 10;
      const invalidAvg = invalidTimings.reduce((a, b) => a + b) / 10;

      // Difference should be small (within 50ms)
      expect(Math.abs(validAvg - invalidAvg)).toBeLessThan(50);
    });
  });

  // ============================================
  // RECONNECTION SECURITY
  // ============================================
  describe('Reconnection Security', () => {
    it('should require valid session for reconnection', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      const sessionToken = client1.sessionToken;
      await client1.disconnect();

      // Try to reconnect with modified token
      const fakeClient = await createTestClient(server, {
        sessionToken: sessionToken + '-modified',
      });

      const state = await fakeClient.emit('get_game_state', { gameId });
      expect(state.error).toMatch(/INVALID|SESSION/);

      await fakeClient.disconnect();
    });

    it('should invalidate old sessions on reconnect', async () => {
      const { gameId } = await setupActiveGame(client1, client2, server);

      const sessionToken = client1.sessionToken;

      // Reconnect (creates new session)
      const newClient = await createTestClient(server, {
        playerId: client1.playerId,
        forceNewSession: true,
      });

      // Old session should be invalid
      const oldClientResult = await client1.emit('deploy_troop', {
        territoryId: 0,
        count: 1,
      });

      expect(oldClientResult.error).toBe('SESSION_INVALIDATED');

      await newClient.disconnect();
    });
  });

  // ============================================
  // WEBSOCKET SECURITY
  // ============================================
  describe('WebSocket Security', () => {
    it('should validate origin headers', async () => {
      const maliciousClient = await createTestClient(server, {
        origin: 'https://malicious-site.com',
      });

      const result = await maliciousClient.emit('create_game', {});

      expect(result.error).toBe('INVALID_ORIGIN');

      await maliciousClient.disconnect();
    });

    it('should handle oversized messages', async () => {
      const largePayload = { data: 'A'.repeat(1000000) }; // 1MB

      const result = await client1.emit('create_game', largePayload);

      expect(result.error).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should handle malformed JSON gracefully', async () => {
      // This tests the raw socket handling
      client1.socket.send('{"invalid json');

      // Connection should remain stable
      await new Promise((r) => setTimeout(r, 100));
      expect(client1.isConnected()).toBe(true);
    });
  });
});

// Helper functions
async function setupActiveGame(client1, client2, server, options = {}) {
  const gameId = await client1.emit('create_game', {});
  await client2.emit('join_game', { gameId });
  await client1.emit('ready_up', {});
  await client2.emit('ready_up', {});
  await client1.emit('start_game', {});
  await server.fastForwardToActive(gameId, options);
  return { gameId };
}

async function setupCombatScenario(client1, client2, server) {
  const { gameId } = await setupActiveGame(client1, client2, server, {
    phase: 'ATTACK',
    territoryAssignments: {
      [client1.playerId]: [0],
      [client2.playerId]: [1],
    },
    troops: { 0: 5, 1: 3 },
  });
  return { gameId };
}

async function setupWritePhase(client1, client2, server) {
  const campaignId = await client1.emit('create_campaign', { name: 'Test' });
  await client2.emit('join_campaign', { campaignId });
  await server.fastForwardToWritePhase(campaignId);
  return { campaignId, gameId: server.getCampaignState(campaignId).currentGameId };
}
