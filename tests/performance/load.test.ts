/**
 * Performance & Load Tests
 * Tests for: concurrent connections, throughput, latency
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer, createTestClient } from '../helpers/testServer';

describe('Performance & Load Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = await createTestServer({
      enableMetrics: true,
      maxConnections: 1000,
    });
  });

  afterAll(async () => {
    await server?.close();
  });

  // ============================================
  // CONCURRENT CONNECTIONS
  // ============================================
  describe('Concurrent Connections', () => {
    it('should handle 50 simultaneous connections', async () => {
      const clients: any[] = [];

      // Create 50 clients simultaneously
      const connectionPromises = Array.from({ length: 50 }, (_, i) =>
        createTestClient(server, { name: `Player ${i}` })
      );

      const startTime = Date.now();
      clients.push(...await Promise.all(connectionPromises));
      const connectionTime = Date.now() - startTime;

      expect(clients.length).toBe(50);
      expect(connectionTime).toBeLessThan(5000); // All connected within 5s

      // Cleanup
      await Promise.all(clients.map((c) => c.disconnect()));
    });

    it('should handle 100 simultaneous connections', async () => {
      const clients: any[] = [];

      const connectionPromises = Array.from({ length: 100 }, (_, i) =>
        createTestClient(server, { name: `Player ${i}` })
      );

      clients.push(...await Promise.all(connectionPromises));

      expect(clients.length).toBe(100);

      // All should be connected
      const connectedCount = clients.filter((c) => c.isConnected()).length;
      expect(connectedCount).toBe(100);

      await Promise.all(clients.map((c) => c.disconnect()));
    });
  });

  // ============================================
  // GAME CREATION THROUGHPUT
  // ============================================
  describe('Game Creation Throughput', () => {
    it('should create 10 games concurrently', async () => {
      const clients = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          createTestClient(server, { name: `Host ${i}` })
        )
      );

      const startTime = Date.now();

      const gameIds = await Promise.all(
        clients.map((c) => c.emit('create_game', { name: 'Load Test Game' }))
      );

      const elapsed = Date.now() - startTime;

      expect(gameIds.every((id) => id && !id.error)).toBe(true);
      expect(elapsed).toBeLessThan(2000); // All games created within 2s

      await Promise.all(clients.map((c) => c.disconnect()));
    });
  });

  // ============================================
  // ACTION THROUGHPUT
  // ============================================
  describe('Action Throughput', () => {
    it('should process 100 actions per second', async () => {
      const client = await createTestClient(server, { name: 'Speed Test' });
      const gameId = await client.emit('create_game', {});

      // Setup game state
      await server.fastForwardToActive(gameId, {
        activePlayerId: client.playerId,
        troopsToPlace: 1000,
      });

      const actions = 100;
      const startTime = Date.now();

      // Fire 100 deploy actions
      const results = await Promise.all(
        Array.from({ length: actions }, () =>
          client.emit('deploy_troop', { territoryId: 0, count: 1 })
        )
      );

      const elapsed = Date.now() - startTime;
      const actionsPerSecond = (actions / elapsed) * 1000;

      console.log(`Processed ${actions} actions in ${elapsed}ms (${actionsPerSecond.toFixed(1)} actions/sec)`);

      expect(actionsPerSecond).toBeGreaterThan(100);

      // Most should succeed (some may be rate limited)
      const successes = results.filter((r) => !r.error).length;
      expect(successes).toBeGreaterThan(50);

      await client.disconnect();
    });

    it('should maintain low latency under load', async () => {
      const clients = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          createTestClient(server, { name: `Player ${i}` })
        )
      );

      // Create games for each pair
      const games: string[] = [];
      for (let i = 0; i < 10; i++) {
        const gameId = await clients[i * 2].emit('create_game', {});
        await clients[i * 2 + 1].emit('join_game', { gameId });
        games.push(gameId);
      }

      // All games start
      for (let i = 0; i < 10; i++) {
        await clients[i * 2].emit('ready_up', {});
        await clients[i * 2 + 1].emit('ready_up', {});
        await clients[i * 2].emit('start_game', {});
        await server.fastForwardToActive(games[i]);
      }

      // Measure latency during concurrent activity
      const latencies: number[] = [];

      await Promise.all(
        clients.map(async (client, idx) => {
          for (let j = 0; j < 10; j++) {
            const start = Date.now();
            await client.emit('ping', {});
            latencies.push(Date.now() - start);
          }
        })
      );

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      console.log(`Latency: avg=${avgLatency.toFixed(1)}ms, p95=${p95Latency}ms, max=${maxLatency}ms`);

      expect(avgLatency).toBeLessThan(50);
      expect(p95Latency).toBeLessThan(100);

      await Promise.all(clients.map((c) => c.disconnect()));
    });
  });

  // ============================================
  // BROADCAST PERFORMANCE
  // ============================================
  describe('Broadcast Performance', () => {
    it('should broadcast to 50 clients efficiently', async () => {
      const host = await createTestClient(server, { name: 'Host' });
      const gameId = await host.emit('create_game', {});

      // 49 more players join
      const players = await Promise.all(
        Array.from({ length: 49 }, (_, i) =>
          createTestClient(server, { name: `Player ${i}` })
        )
      );

      for (const player of players) {
        await player.emit('join_game', { gameId });
      }

      const allClients = [host, ...players];

      // Set up listeners on all clients
      const receivePromises = allClients.map((client) =>
        new Promise<number>((resolve) => {
          const start = Date.now();
          client.once('delta', () => resolve(Date.now() - start));
        })
      );

      // Trigger a broadcast (host takes action)
      const broadcastStart = Date.now();
      await host.emit('ready_up', {});

      const receiveTimes = await Promise.all(receivePromises);
      const broadcastTime = Date.now() - broadcastStart;

      const avgReceive = receiveTimes.reduce((a, b) => a + b) / receiveTimes.length;
      const maxReceive = Math.max(...receiveTimes);

      console.log(`Broadcast to 50 clients: total=${broadcastTime}ms, avg=${avgReceive.toFixed(1)}ms, max=${maxReceive}ms`);

      expect(broadcastTime).toBeLessThan(500);
      expect(avgReceive).toBeLessThan(100);

      await Promise.all(allClients.map((c) => c.disconnect()));
    });
  });

  // ============================================
  // DATABASE PERFORMANCE
  // ============================================
  describe('Database Performance', () => {
    it('should handle rapid state saves', async () => {
      const client = await createTestClient(server, { name: 'DB Test' });
      const gameId = await client.emit('create_game', {});
      await server.fastForwardToActive(gameId, { troopsToPlace: 100 });

      // Rapid fire actions that trigger DB writes
      const writes = 50;
      const startTime = Date.now();

      for (let i = 0; i < writes; i++) {
        await client.emit('deploy_troop', { territoryId: 0, count: 1 });
      }

      const elapsed = Date.now() - startTime;
      const writesPerSecond = (writes / elapsed) * 1000;

      console.log(`Database: ${writes} writes in ${elapsed}ms (${writesPerSecond.toFixed(1)} writes/sec)`);

      expect(writesPerSecond).toBeGreaterThan(10);

      await client.disconnect();
    });

    it('should efficiently query game history', async () => {
      const client = await createTestClient(server, { name: 'Query Test' });

      // Create campaign with history
      const campaignId = await client.emit('create_campaign', { name: 'History Test' });

      // Simulate multiple games worth of history
      await server.populateCampaignHistory(campaignId, 10);

      const startTime = Date.now();
      const history = await client.emit('get_campaign_history', { campaignId });
      const queryTime = Date.now() - startTime;

      console.log(`Campaign history query: ${queryTime}ms for ${history.games?.length || 0} games`);

      expect(queryTime).toBeLessThan(200);
      expect(history.games?.length).toBe(10);

      await client.disconnect();
    });
  });

  // ============================================
  // MEMORY USAGE
  // ============================================
  describe('Memory Usage', () => {
    it('should not leak memory with many games', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and finish 20 games
      for (let i = 0; i < 20; i++) {
        const clients = await Promise.all([
          createTestClient(server, { name: 'P1' }),
          createTestClient(server, { name: 'P2' }),
          createTestClient(server, { name: 'P3' }),
        ]);

        const gameId = await clients[0].emit('create_game', {});
        await clients[1].emit('join_game', { gameId });
        await clients[2].emit('join_game', { gameId });

        // Quick game flow
        await Promise.all(clients.map((c) => c.emit('ready_up', {})));
        await clients[0].emit('start_game', {});
        await server.fastForwardToVictory(gameId, clients[0].playerId);

        // Disconnect all
        await Promise.all(clients.map((c) => c.disconnect()));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory increase after 20 games: ${memoryIncrease.toFixed(2)} MB`);

      // Should not grow more than 50MB
      expect(memoryIncrease).toBeLessThan(50);
    });

    it('should clean up disconnected clients', async () => {
      const initialConnections = server.getConnectionCount();

      // Create and disconnect 50 clients
      for (let i = 0; i < 50; i++) {
        const client = await createTestClient(server, { name: `Temp ${i}` });
        await client.disconnect();
      }

      // Wait for cleanup
      await new Promise((r) => setTimeout(r, 1000));

      const finalConnections = server.getConnectionCount();

      expect(finalConnections).toBe(initialConnections);
    });
  });

  // ============================================
  // STRESS TESTING
  // ============================================
  describe('Stress Testing', () => {
    it('should survive rapid connect/disconnect cycles', async () => {
      const cycles = 100;
      let successfulCycles = 0;

      for (let i = 0; i < cycles; i++) {
        try {
          const client = await createTestClient(server, { name: `Stress ${i}` });
          await client.emit('ping', {});
          await client.disconnect();
          successfulCycles++;
        } catch (e) {
          // Count failures
        }
      }

      const successRate = (successfulCycles / cycles) * 100;
      console.log(`Connect/disconnect stress: ${successRate}% success rate`);

      expect(successRate).toBeGreaterThan(95);
    });

    it('should handle message flood gracefully', async () => {
      const client = await createTestClient(server, { name: 'Flood Test' });

      // Send 1000 messages as fast as possible
      const promises = Array.from({ length: 1000 }, () =>
        client.emit('ping', {}).catch(() => null)
      );

      await Promise.all(promises);

      // Connection should still be alive
      expect(client.isConnected()).toBe(true);

      // Server should still respond
      const response = await client.emit('ping', {});
      expect(response.pong).toBe(true);

      await client.disconnect();
    });
  });

  // ============================================
  // SCALABILITY METRICS
  // ============================================
  describe('Scalability Metrics', () => {
    it('should report server metrics', async () => {
      const metrics = await server.getMetrics();

      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('activeGames');
      expect(metrics).toHaveProperty('messagesPerSecond');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('memoryUsage');

      console.log('Server metrics:', JSON.stringify(metrics, null, 2));
    });
  });
});
