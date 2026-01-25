/**
 * Test Server & Client Helpers
 * Utilities for creating test servers and mock clients
 */

import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'http';
import { AddressInfo } from 'net';

interface TestServerOptions {
  enableMetrics?: boolean;
  maxConnections?: number;
}

interface TestClientOptions {
  name?: string;
  sessionToken?: string;
  playerId?: number;
  skipAuth?: boolean;
  forceNewSession?: boolean;
  origin?: string;
}

interface TestServer {
  io: Server;
  httpServer: HttpServer;
  port: number;
  close: () => Promise<void>;
  getGameState: (gameId: string) => any;
  getCampaignState: (campaignId: string) => any;
  fastForwardToActive: (gameId: string, options?: any) => Promise<void>;
  fastForwardToVictory: (gameId: string, winnerId: number) => Promise<void>;
  fastForwardToWritePhase: (campaignId: string) => Promise<void>;
  setActivePlayer: (gameId: string, playerId: number) => Promise<void>;
  setPlayerMissiles: (gameId: string, playerId: number, count: number) => Promise<void>;
  setPlayerStars: (gameId: string, playerId: number, count: number) => Promise<void>;
  giveCards: (gameId: string, playerId: number, cards: any[]) => Promise<void>;
  eliminatePlayer: (gameId: string, playerId: number, options?: any) => Promise<void>;
  eliminatePlayerBy: (gameId: string, eliminatedId: number, eliminatorId: number) => Promise<void>;
  forceConquest: (gameId: string, attackerId: number, territoryId: number) => Promise<void>;
  checkVictory: (gameId: string) => Promise<void>;
  recordVictory: (campaignId: string, playerId: number, factionId: string) => Promise<void>;
  populateCampaignHistory: (campaignId: string, gameCount: number) => Promise<void>;
  getConnectionCount: () => number;
  getMetrics: () => Promise<any>;
}

interface TestClient {
  socket: Socket;
  playerId: number;
  sessionToken: string;
  emit: (event: string, payload: any) => Promise<any>;
  waitForEvent: (event: string, timeout?: number) => Promise<any>;
  once: (event: string, callback: (data: any) => void) => void;
  getReceivedEvents: () => any[];
  isConnected: () => boolean;
  disconnect: () => Promise<void>;
}

// Game state storage for tests
const gameStates = new Map<string, any>();
const campaignStates = new Map<string, any>();

/**
 * Create a test server instance
 */
export async function createTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  // Set up basic event handlers
  io.on('connection', (socket) => {
    socket.on('create_game', (payload, callback) => {
      const gameId = `game-${Date.now()}`;
      gameStates.set(gameId, {
        id: gameId,
        status: 'lobby',
        players: [{ id: socket.data.playerId, name: payload.name || 'Host' }],
        ...payload,
      });
      callback?.({ gameId });
    });

    socket.on('join_game', (payload, callback) => {
      const game = gameStates.get(payload.gameId);
      if (!game) {
        callback?.({ error: 'GAME_NOT_FOUND' });
        return;
      }
      if (game.players.length >= (game.maxPlayers || 5)) {
        callback?.({ error: 'GAME_FULL' });
        return;
      }
      game.players.push({ id: socket.data.playerId, name: socket.data.name });
      callback?.({ success: true });
    });

    // Add more event handlers as needed...
    socket.on('ping', (_, callback) => {
      callback?.({ pong: true });
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const port = (httpServer.address() as AddressInfo).port;

  return {
    io,
    httpServer,
    port,
    close: async () => {
      io.close();
      httpServer.close();
      gameStates.clear();
      campaignStates.clear();
    },
    getGameState: (gameId) => gameStates.get(gameId),
    getCampaignState: (campaignId) => campaignStates.get(campaignId),
    fastForwardToActive: async (gameId, options = {}) => {
      const game = gameStates.get(gameId);
      if (game) {
        game.status = 'active';
        game.phase = options.phase || 'RECRUIT';
        game.activePlayerId = options.activePlayerId || game.players[0]?.id;
        game.troopsToPlace = options.troopsToPlace || 5;
        game.territories = new Map(Object.entries(options.territoryAssignments || {}));
      }
    },
    fastForwardToVictory: async (gameId, winnerId) => {
      const game = gameStates.get(gameId);
      if (game) {
        game.status = 'finished';
        game.winnerId = winnerId;
      }
    },
    fastForwardToWritePhase: async (campaignId) => {
      const campaign = campaignStates.get(campaignId);
      if (campaign) {
        campaign.phase = 'WRITE_PHASE';
      }
    },
    setActivePlayer: async (gameId, playerId) => {
      const game = gameStates.get(gameId);
      if (game) game.activePlayerId = playerId;
    },
    setPlayerMissiles: async (gameId, playerId, count) => {
      const game = gameStates.get(gameId);
      if (game) {
        const player = game.players.find((p: any) => p.id === playerId);
        if (player) player.missiles = count;
      }
    },
    setPlayerStars: async (gameId, playerId, count) => {
      const game = gameStates.get(gameId);
      if (game) {
        const player = game.players.find((p: any) => p.id === playerId);
        if (player) player.redStars = count;
      }
    },
    giveCards: async (gameId, playerId, cards) => {
      const game = gameStates.get(gameId);
      if (game) {
        const player = game.players.find((p: any) => p.id === playerId);
        if (player) player.cards = [...(player.cards || []), ...cards.map((c) => c.id)];
      }
    },
    eliminatePlayer: async (gameId, playerId, options = {}) => {
      const game = gameStates.get(gameId);
      if (game) {
        const player = game.players.find((p: any) => p.id === playerId);
        if (player) {
          player.isEliminated = true;
          player.canRejoin = options.canRejoin ?? false;
        }
      }
    },
    eliminatePlayerBy: async (gameId, eliminatedId, eliminatorId) => {
      const game = gameStates.get(gameId);
      if (game) {
        const eliminated = game.players.find((p: any) => p.id === eliminatedId);
        const eliminator = game.players.find((p: any) => p.id === eliminatorId);
        if (eliminated && eliminator) {
          eliminator.cards = [...(eliminator.cards || []), ...(eliminated.cards || [])];
          eliminated.cards = [];
          eliminated.isEliminated = true;
        }
      }
    },
    forceConquest: async (gameId, attackerId, territoryId) => {
      const game = gameStates.get(gameId);
      if (game) {
        const territory = game.territories?.get(territoryId);
        if (territory) territory.ownerId = attackerId;
      }
    },
    checkVictory: async (gameId) => {
      const game = gameStates.get(gameId);
      if (game) {
        const winner = game.players.find((p: any) => p.redStars >= 4);
        if (winner) {
          game.status = 'finished';
          game.winnerId = winner.id;
        }
      }
    },
    recordVictory: async (campaignId, playerId, factionId) => {
      const campaign = campaignStates.get(campaignId);
      if (campaign) {
        campaign.victors = campaign.victors || [];
        campaign.victors.push({ playerId, factionId, gameNumber: campaign.gameCount + 1 });
        campaign.gameCount++;
      }
    },
    populateCampaignHistory: async (campaignId, gameCount) => {
      const campaign = campaignStates.get(campaignId);
      if (campaign) {
        campaign.games = Array.from({ length: gameCount }, (_, i) => ({
          gameNumber: i + 1,
          winnerId: 1,
          duration: 3600000,
        }));
      }
    },
    getConnectionCount: () => io.sockets.sockets.size,
    getMetrics: async () => ({
      activeConnections: io.sockets.sockets.size,
      activeGames: gameStates.size,
      messagesPerSecond: 0,
      avgResponseTime: 0,
      memoryUsage: process.memoryUsage(),
    }),
  };
}

/**
 * Create a test client that connects to the test server
 */
export async function createTestClient(
  server: TestServer,
  options: TestClientOptions = {}
): Promise<TestClient> {
  const playerId = options.playerId || Math.floor(Math.random() * 100000);
  const sessionToken = options.sessionToken || `session-${playerId}-${Date.now()}`;

  const socket = io(`http://localhost:${server.port}`, {
    auth: {
      sessionToken: options.skipAuth ? undefined : sessionToken,
      playerId,
    },
    extraHeaders: options.origin ? { origin: options.origin } : undefined,
  });

  const receivedEvents: any[] = [];

  socket.onAny((event, data) => {
    receivedEvents.push({ type: event, data, timestamp: Date.now() });
  });

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      socket.data = { playerId, name: options.name };
      resolve();
    });
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });

  return {
    socket,
    playerId,
    sessionToken,
    emit: (event, payload) => {
      return new Promise((resolve) => {
        socket.emit(event, payload, (response: any) => {
          resolve(response || {});
        });
        // Timeout fallback
        setTimeout(() => resolve({ error: 'TIMEOUT' }), 5000);
      });
    },
    waitForEvent: (event, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const handler = (data: any) => {
          resolve(data);
        };
        socket.once(event, handler);
        setTimeout(() => {
          socket.off(event, handler);
          reject(new Error(`Timeout waiting for ${event}`));
        }, timeout);
      });
    },
    once: (event, callback) => {
      socket.once(event, callback);
    },
    getReceivedEvents: () => [...receivedEvents],
    isConnected: () => socket.connected,
    disconnect: async () => {
      socket.disconnect();
    },
  };
}
