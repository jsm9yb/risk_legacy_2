/**
 * Socket.io server for multiplayer lobby system
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameInitialState,
  PersistedGameState,
  TerritoryState,
  ScarPlacement,
  CityPlacement,
  GameAction,
  SetupTurnContext,
} from './types';
import {
  createCampaign,
  deleteCampaign,
  getAllCampaigns,
  getCampaignFull,
  getLobby,
  addPlayerToLobby,
  removePlayerFromLobby,
  setPlayerReady,
  transferHost,
  kickPlayer,
  startGame,
  getCampaignForSocket,
  setCampaignActiveGame,
  getPlayerForSocket,
  bindPlayerToSocket,
  findLobbyPlayerByOdId,
  rebindLobbyPlayer,
  claimSeatInLobby,
} from './store';
import {
  createNewGameInCampaign,
  getOrLoadGameState,
  applyGameAction,
  persistGameState,
  expireMissileWindow,
  finishGame,
  completePostGame,
} from './gameState';
import { gameActionSchema } from './gameActionSchema';

// Territory data - same as client-side territories
// We define it here to avoid import issues with client-side path aliases
const defaultTerritories = [
  // North America (continentId: 0)
  { id: 'alaska', name: 'Alaska', continentId: 0, neighbors: ['northwest_territory', 'alberta', 'kamchatka'] },
  { id: 'northwest_territory', name: 'Northwest Territory', continentId: 0, neighbors: ['alaska', 'alberta', 'ontario', 'greenland'] },
  { id: 'greenland', name: 'Greenland', continentId: 0, neighbors: ['northwest_territory', 'ontario', 'quebec', 'iceland'] },
  { id: 'alberta', name: 'Alberta', continentId: 0, neighbors: ['alaska', 'northwest_territory', 'ontario', 'western_united_states'] },
  { id: 'ontario', name: 'Ontario', continentId: 0, neighbors: ['northwest_territory', 'alberta', 'greenland', 'quebec', 'western_united_states', 'eastern_united_states'] },
  { id: 'quebec', name: 'Quebec', continentId: 0, neighbors: ['greenland', 'ontario', 'eastern_united_states'] },
  { id: 'western_united_states', name: 'Western United States', continentId: 0, neighbors: ['alberta', 'ontario', 'eastern_united_states', 'central_america'] },
  { id: 'eastern_united_states', name: 'Eastern United States', continentId: 0, neighbors: ['ontario', 'quebec', 'western_united_states', 'central_america'] },
  { id: 'central_america', name: 'Central America', continentId: 0, neighbors: ['western_united_states', 'eastern_united_states', 'venezuela'] },
  // South America (continentId: 1)
  { id: 'venezuela', name: 'Venezuela', continentId: 1, neighbors: ['central_america', 'brazil', 'peru'] },
  { id: 'brazil', name: 'Brazil', continentId: 1, neighbors: ['venezuela', 'peru', 'argentina', 'north_africa'] },
  { id: 'peru', name: 'Peru', continentId: 1, neighbors: ['venezuela', 'brazil', 'argentina'] },
  { id: 'argentina', name: 'Argentina', continentId: 1, neighbors: ['peru', 'brazil'] },
  // Europe (continentId: 2)
  { id: 'iceland', name: 'Iceland', continentId: 2, neighbors: ['greenland', 'great_britain', 'scandinavia'] },
  { id: 'great_britain', name: 'Great Britain', continentId: 2, neighbors: ['iceland', 'scandinavia', 'northern_europe', 'western_europe'] },
  { id: 'scandinavia', name: 'Scandinavia', continentId: 2, neighbors: ['iceland', 'great_britain', 'northern_europe', 'ukraine'] },
  { id: 'northern_europe', name: 'Northern Europe', continentId: 2, neighbors: ['great_britain', 'scandinavia', 'western_europe', 'southern_europe', 'ukraine'] },
  { id: 'western_europe', name: 'Western Europe', continentId: 2, neighbors: ['great_britain', 'northern_europe', 'southern_europe', 'north_africa'] },
  { id: 'southern_europe', name: 'Southern Europe', continentId: 2, neighbors: ['northern_europe', 'western_europe', 'ukraine', 'north_africa', 'egypt', 'middle_east'] },
  { id: 'ukraine', name: 'Ukraine', continentId: 2, neighbors: ['scandinavia', 'northern_europe', 'southern_europe', 'ural', 'afghanistan', 'middle_east'] },
  // Africa (continentId: 3)
  { id: 'north_africa', name: 'North Africa', continentId: 3, neighbors: ['brazil', 'western_europe', 'southern_europe', 'egypt', 'east_africa', 'congo'] },
  { id: 'egypt', name: 'Egypt', continentId: 3, neighbors: ['southern_europe', 'north_africa', 'east_africa', 'middle_east'] },
  { id: 'east_africa', name: 'East Africa', continentId: 3, neighbors: ['north_africa', 'egypt', 'congo', 'south_africa', 'madagascar', 'middle_east'] },
  { id: 'congo', name: 'Congo', continentId: 3, neighbors: ['north_africa', 'east_africa', 'south_africa'] },
  { id: 'south_africa', name: 'South Africa', continentId: 3, neighbors: ['congo', 'east_africa', 'madagascar'] },
  { id: 'madagascar', name: 'Madagascar', continentId: 3, neighbors: ['east_africa', 'south_africa'] },
  // Asia (continentId: 4)
  { id: 'ural', name: 'Ural', continentId: 4, neighbors: ['ukraine', 'siberia', 'afghanistan', 'china'] },
  { id: 'siberia', name: 'Siberia', continentId: 4, neighbors: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'] },
  { id: 'yakutsk', name: 'Yakutsk', continentId: 4, neighbors: ['siberia', 'kamchatka', 'irkutsk'] },
  { id: 'kamchatka', name: 'Kamchatka', continentId: 4, neighbors: ['alaska', 'yakutsk', 'irkutsk', 'mongolia', 'japan'] },
  { id: 'irkutsk', name: 'Irkutsk', continentId: 4, neighbors: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'] },
  { id: 'mongolia', name: 'Mongolia', continentId: 4, neighbors: ['siberia', 'irkutsk', 'kamchatka', 'china', 'japan'] },
  { id: 'japan', name: 'Japan', continentId: 4, neighbors: ['kamchatka', 'mongolia'] },
  { id: 'afghanistan', name: 'Afghanistan', continentId: 4, neighbors: ['ukraine', 'ural', 'china', 'india', 'middle_east'] },
  { id: 'china', name: 'China', continentId: 4, neighbors: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'] },
  { id: 'india', name: 'India', continentId: 4, neighbors: ['afghanistan', 'china', 'siam', 'middle_east'] },
  { id: 'siam', name: 'Siam', continentId: 4, neighbors: ['china', 'india', 'indonesia'] },
  { id: 'middle_east', name: 'Middle East', continentId: 4, neighbors: ['ukraine', 'southern_europe', 'egypt', 'east_africa', 'afghanistan', 'india'] },
  // Australia (continentId: 5)
  { id: 'indonesia', name: 'Indonesia', continentId: 5, neighbors: ['siam', 'new_guinea', 'western_australia'] },
  { id: 'new_guinea', name: 'New Guinea', continentId: 5, neighbors: ['indonesia', 'eastern_australia', 'western_australia'] },
  { id: 'western_australia', name: 'Western Australia', continentId: 5, neighbors: ['indonesia', 'new_guinea', 'eastern_australia'] },
  { id: 'eastern_australia', name: 'Eastern Australia', continentId: 5, neighbors: ['new_guinea', 'western_australia'] },
];

const app = express();
const httpServer = createServer(app);
const isDevelopment = process.env.NODE_ENV !== 'production';

function buildSetupTurnContext(state: PersistedGameState): SetupTurnContext {
  const setupPlayer = state.players[state.setupTurnIndex] ?? null;
  return {
    setupTurnIndex: state.setupTurnIndex,
    currentSetupPlayerId: setupPlayer?.id ?? null,
    currentSetupPlayerName: setupPlayer?.name ?? null,
    subPhase: state.subPhase,
    version: state.version,
  };
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://127.0.0.1:5176',
    ],
    methods: ['GET', 'POST'],
  },
});

const missileWindowTimers = new Map<string, NodeJS.Timeout>();

function clearMissileWindowTimer(campaignId: string): void {
  const timer = missileWindowTimers.get(campaignId);
  if (timer) {
    clearTimeout(timer);
    missileWindowTimers.delete(campaignId);
  }
}

function scheduleMissileWindowTimer(campaignId: string, endsAt: number): void {
  clearMissileWindowTimer(campaignId);
  const delay = Math.max(0, endsAt - Date.now());

  const timer = setTimeout(() => {
    missileWindowTimers.delete(campaignId);

    const state = getOrLoadGameState(campaignId);
    if (!state || state.subPhase !== 'MISSILE_WINDOW') {
      return;
    }
    if (state.missileWindowEndsAt && state.missileWindowEndsAt > Date.now()) {
      scheduleMissileWindowTimer(campaignId, state.missileWindowEndsAt);
      return;
    }

    const expireResult = expireMissileWindow(campaignId);
    if (expireResult.success && expireResult.statePatch) {
      io.to(campaignId).emit('game:stateUpdate', {
        patch: expireResult.statePatch,
        version: expireResult.newVersion,
      });
    }
  }, delay);

  missileWindowTimers.set(campaignId, timer);
}

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current campaign list on connect
  socket.emit('campaign:list', { campaigns: getAllCampaigns() });

  // Campaign events
  socket.on('campaign:create', ({ name }) => {
    const id = uuidv4();
    const campaign = createCampaign(id, name.trim() || 'New Campaign');
    console.log(`Campaign created: ${campaign.name} (${campaign.id})`);

    // Broadcast updated campaign list to all clients
    io.emit('campaign:list', { campaigns: getAllCampaigns() });
  });

  socket.on('campaign:list', () => {
    socket.emit('campaign:list', { campaigns: getAllCampaigns() });
  });

  socket.on('campaign:delete', ({ campaignId }) => {
    const result = deleteCampaign(campaignId);

    if (!result.success) {
      socket.emit('campaign:deleteError', { message: result.error || 'Failed to delete campaign' });
      return;
    }

    console.log(`Campaign deleted: ${campaignId}`);

    // Broadcast updated campaign list to all clients
    io.emit('campaign:list', { campaigns: getAllCampaigns() });
  });

  // Lobby events
  socket.on('lobby:join', ({ campaignId, playerName, playerToken }) => {
    const result = addPlayerToLobby(
      campaignId,
      socket.id,
      playerName.trim() || 'Anonymous',
      playerToken
    );

    if (!result.success || !result.lobby) {
      socket.emit('lobby:error', { message: result.error || 'Failed to join lobby' });
      return;
    }

    // Join the socket room for this campaign
    socket.join(campaignId);

    // Send full lobby state to the joining player
    socket.emit('lobby:state', { lobby: result.lobby });

    // Send the assigned token to the client for persistence
    if (result.odId) {
      socket.emit('lobby:tokenAssigned', { odId: result.odId, campaignId });
    }

    // Notify other players in the lobby
    const newPlayer = result.lobby.players.find(p => p.socketId === socket.id);
    if (newPlayer) {
      socket.to(campaignId).emit('lobby:playerJoined', { player: newPlayer });
    }

    // Broadcast updated campaign list (player count changed)
    io.emit('campaign:list', { campaigns: getAllCampaigns() });

    console.log(`Player ${playerName} joined lobby ${campaignId} with odId ${result.odId}`);
  });

  socket.on('lobby:claimSeat', ({ campaignId, targetOdId, playerName }) => {
    const result = claimSeatInLobby(campaignId, socket.id, targetOdId, playerName.trim() || 'Player');
    if (!result.success || !result.lobby || !result.claimedOdId) {
      socket.emit('lobby:claimSeatResult', {
        success: false,
        error: result.error || 'Failed to claim seat',
      });
      return;
    }

    socket.emit('lobby:tokenAssigned', { odId: result.claimedOdId, campaignId });
    socket.emit('lobby:claimSeatResult', { success: true, claimedOdId: result.claimedOdId });
    io.to(campaignId).emit('lobby:state', { lobby: result.lobby });
  });

  socket.on('lobby:leave', () => {
    handlePlayerLeave(socket);
  });

  socket.on('lobby:ready', ({ isReady }) => {
    const result = setPlayerReady(socket.id, isReady);

    if (result.success && result.lobby) {
      // Broadcast updated lobby state to all players in the room
      io.to(result.lobby.campaignId).emit('lobby:state', { lobby: result.lobby });
    }
  });

  socket.on('lobby:transferHost', ({ targetSocketId }) => {
    const result = transferHost(socket.id, targetSocketId);

    if (!result.success) {
      socket.emit('lobby:error', { message: result.error || 'Failed to transfer host' });
      return;
    }

    if (result.lobby) {
      // Broadcast updated lobby state to all players
      io.to(result.lobby.campaignId).emit('lobby:state', { lobby: result.lobby });
    }
  });

  socket.on('lobby:kick', ({ targetSocketId }) => {
    const campaignId = getCampaignForSocket(socket.id);
    if (!campaignId) return;

    const result = kickPlayer(socket.id, targetSocketId);

    if (!result.success) {
      socket.emit('lobby:error', { message: result.error || 'Failed to kick player' });
      return;
    }

    // Notify kicked player
    io.to(targetSocketId).emit('lobby:kicked');

    // Remove kicked player from room
    const kickedSocket = io.sockets.sockets.get(targetSocketId);
    if (kickedSocket) {
      kickedSocket.leave(campaignId);
    }

    if (result.lobby) {
      // Broadcast updated lobby state to remaining players
      io.to(result.lobby.campaignId).emit('lobby:state', { lobby: result.lobby });
    }

    // Broadcast updated campaign list (player count changed)
    io.emit('campaign:list', { campaigns: getAllCampaigns() });
  });

  socket.on('lobby:start', () => {
    const result = startGame(socket.id);

    if (!result.success) {
      socket.emit('lobby:error', { message: result.error || 'Failed to start game' });
      return;
    }

    if (result.lobby) {
      // Create player list for game - use odId as the persistent userId
      const players = result.lobby.players.map((p, index) => ({
        id: `player-${index + 1}`,
        name: p.name,
        odId: p.odId, // Persistent identity
        socketId: p.socketId,
        seatIndex: index,
      }));

      // Initialize territories with default state
      const initialTerritories: Record<string, TerritoryState> = {};
      for (const t of defaultTerritories) {
        initialTerritories[t.id] = {
          id: t.id,
          name: t.name,
          continentId: t.continentId,
          neighbors: t.neighbors,
          ownerId: null,
          troopCount: 0,
          scarId: null,
          cityTier: 0,
          cityName: null,
          fortified: false,
          fortifyDamage: 0,
        };
      }

      // Create persisted game state on server
      const gameState = createNewGameInCampaign(
        result.lobby.campaignId,
        result.lobby.campaignName,
        players,
        initialTerritories
      );

      // Mark campaign as having active game
      setCampaignActiveGame(result.lobby.campaignId, true);

      // Create initial game state for clients
      const initialState: GameInitialState = {
        gameId: gameState.gameId,
        campaignName: result.lobby.campaignName,
        players,
      };

      // Broadcast game start to all players in lobby
      io.to(result.lobby.campaignId).emit('game:started', { initialState });

      // Also send full game state to all players
      io.to(result.lobby.campaignId).emit('game:fullState', { state: gameState });
      io.to(result.lobby.campaignId).emit('game:setupTurn', buildSetupTurnContext(gameState));

      // Broadcast updated campaign list (now has active game)
      io.emit('campaign:list', { campaigns: getAllCampaigns() });

      console.log(`Game started for campaign ${result.lobby.campaignId} with ${result.lobby.players.length} players`);
    }
  });

  // Campaign history request
  socket.on('campaign:getHistory', ({ campaignId }) => {
    const campaign = getCampaignFull(campaignId);
    if (campaign) {
      socket.emit('campaign:history', { campaign });
    }
  });

  socket.on('campaign:getParticipants', ({ campaignId }) => {
    const campaign = getCampaignFull(campaignId);
    if (!campaign) {
      socket.emit('campaign:participants', { campaignId, participants: [] });
      return;
    }
    socket.emit('campaign:participants', {
      campaignId,
      participants: campaign.participants.map((p) => ({ odId: p.odId, name: p.name })),
    });
  });

  // Game state request (for reconnection/refresh)
  socket.on('game:requestState', ({ campaignId }) => {
    const gameState = getOrLoadGameState(campaignId);
    if (gameState) {
      socket.emit('game:fullState', { state: gameState });
      if (gameState.status === 'setup') {
        socket.emit('game:setupTurn', buildSetupTurnContext(gameState));
      }
    } else {
      socket.emit('lobby:error', { message: 'No active game found' });
    }
  });

  // Game rejoin handler - for reconnecting to an active game
  socket.on('game:rejoin', ({ campaignId, playerToken }) => {
    console.log(`Player attempting rejoin with token ${playerToken} to campaign ${campaignId}`);

    // Validate the token exists in campaign participants
    const campaign = getCampaignFull(campaignId);
    if (!campaign) {
      socket.emit('game:rejoinResult', {
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    const gameState = getOrLoadGameState(campaignId);
    if (!gameState) {
      socket.emit('game:rejoinResult', {
        success: false,
        error: 'No active game found',
      });
      return;
    }
    let resolvedToken = playerToken;
    let participant = campaign.participants.find(p => p.odId === resolvedToken);
    if (!participant) {
      // Legacy compatibility: token may be an old game userId (socket-based)
      const legacyGamePlayer = gameState.players.find(p => p.userId === playerToken);
      if (legacyGamePlayer) {
        const mappedParticipant = campaign.participants.find(p => p.odId === legacyGamePlayer.id);
        if (mappedParticipant) {
          participant = mappedParticipant;
          resolvedToken = mappedParticipant.odId;
        }
      }
    }
    if (!participant) {
      socket.emit('game:rejoinResult', {
        success: false,
        error: 'Player not found in campaign',
      });
      return;
    }

    // Find the player in the game by odId, or fallback to legacy id/userId mapping
    const gamePlayer = gameState.players.find(
      (p) => p.userId === resolvedToken || p.id === resolvedToken || p.userId === playerToken
    );
    if (!gamePlayer) {
      socket.emit('game:rejoinResult', {
        success: false,
        error: 'Player not found in game',
      });
      return;
    }

    // Rebind the player to this socket in the lobby
    const rebindResult = rebindLobbyPlayer(campaignId, resolvedToken, socket.id);
    if (!rebindResult.success) {
      // Player might not be in lobby, add them
      const lobby = getLobby(campaignId);
      if (lobby) {
        bindPlayerToSocket(resolvedToken, socket.id);
      }
    }

    // Join the socket room for this campaign
    socket.join(campaignId);

    // Send success with full game state and local player ID
    socket.emit('game:rejoinResult', {
      success: true,
      state: gameState,
      localPlayerId: gamePlayer.id,
    });

    console.log(`Player ${participant.name} rejoined game in campaign ${campaignId}`);
  });

  // Game action from client
  socket.on('game:action', ({ campaignId, action }) => {
    const parsedAction = gameActionSchema.safeParse(action);
    if (!parsedAction.success) {
      console.warn('[game:action] invalid payload', {
        campaignId,
        errors: parsedAction.error.issues.map((issue) => issue.message),
      });
      socket.emit('game:actionResult', {
        success: false,
        newVersion: 0,
        error: 'Invalid game action payload',
        reasonCode: 'INVALID_PAYLOAD',
      });
      return;
    }

    // Find player by persistent odId (from socket binding)
    const playerOdId = getPlayerForSocket(socket.id);
    const lobby = getLobby(campaignId);
    const lobbyPlayer = lobby?.players.find(p => p.socketId === socket.id);

    if (!playerOdId && !lobbyPlayer) {
      socket.emit('game:actionResult', {
        success: false,
        newVersion: 0,
        error: 'Player not found in game',
        reasonCode: 'PLAYER_NOT_IN_GAME',
      });
      return;
    }

    // Find the player ID in the game state
    const gameState = getOrLoadGameState(campaignId);
    if (!gameState) {
      socket.emit('game:actionResult', {
        success: false,
        newVersion: 0,
        error: 'No active game found',
        reasonCode: 'NO_ACTIVE_GAME',
      });
      return;
    }

    // Find player by matching odId to the stored userId (which is now odId)
    const odIdToMatch = playerOdId || lobbyPlayer?.odId;
    const gamePlayer = gameState.players.find(
      (p) => p.userId === odIdToMatch || p.id === odIdToMatch
    );
    const playerId = gamePlayer?.id || '';

    if (!playerId) {
      socket.emit('game:actionResult', {
        success: false,
        newVersion: 0,
        error: 'Player not found in game state',
        reasonCode: 'PLAYER_NOT_IN_GAME',
        phase: gameState.phase,
        subPhase: gameState.subPhase,
        setupTurnIndex: gameState.setupTurnIndex,
        activePlayerId: gameState.activePlayerId,
        serverVersion: gameState.version,
      });
      return;
    }

    // Apply the action
    const validatedAction = parsedAction.data as GameAction;
    if (isDevelopment) {
      console.debug('[game:action] recv', {
        campaignId,
        actionType: validatedAction.type,
        actorPlayerId: playerId,
        clientVersion: validatedAction.clientVersion,
        serverVersion: gameState.version,
        phase: gameState.phase,
        subPhase: gameState.subPhase,
        setupTurnIndex: gameState.setupTurnIndex,
      });
    }
    const result = applyGameAction(campaignId, validatedAction, playerId);
    const updatedState = getOrLoadGameState(campaignId);

    if (result.success && updatedState) {
      if (updatedState.subPhase === 'MISSILE_WINDOW' && updatedState.missileWindowEndsAt) {
        scheduleMissileWindowTimer(campaignId, updatedState.missileWindowEndsAt);
      } else {
        clearMissileWindowTimer(campaignId);
      }
    }

    if (!result.success) {
      console.warn(
        '[game:action] rejected',
        {
          campaignId,
          actionType: validatedAction.type,
          actorPlayerId: playerId,
          phase: result.phase ?? updatedState?.phase ?? 'unknown',
          subPhase: result.subPhase ?? updatedState?.subPhase ?? 'unknown',
          setupTurnIndex: result.setupTurnIndex ?? updatedState?.setupTurnIndex,
          serverVersion: result.serverVersion ?? updatedState?.version,
          reasonCode: result.reasonCode ?? 'unknown',
          reason: result.error ?? 'unknown',
        }
      );

      if (updatedState?.status === 'setup') {
        io.to(campaignId).emit('game:setupTurn', buildSetupTurnContext(updatedState));
      }
    } else if (isDevelopment) {
      console.debug('[game:action] accepted', {
        campaignId,
        actionType: validatedAction.type,
        actorPlayerId: playerId,
        newVersion: result.newVersion,
        phase: updatedState?.phase,
        subPhase: updatedState?.subPhase,
        setupTurnIndex: updatedState?.setupTurnIndex,
      });
    }

    // Send result back to the acting player
    socket.emit('game:actionResult', result);

    // If successful, broadcast state update to all players
    if (result.success && result.statePatch) {
      io.to(campaignId).emit('game:stateUpdate', {
        patch: result.statePatch,
        version: result.newVersion,
      });

      if (
        updatedState &&
        (validatedAction.type === 'selectFaction' || validatedAction.type === 'placeHQ')
      ) {
        // Migration note: setup now sends full authoritative snapshots while persistence remains JSON-file based.
        io.to(campaignId).emit('game:fullState', { state: updatedState });
      }

      if (updatedState?.status === 'setup') {
        io.to(campaignId).emit('game:setupTurn', buildSetupTurnContext(updatedState));
      }

      // Note: Victory is now handled via game:declareVictory event from client
      // after the VictoryModal is acknowledged
    }
  });

  // Handle victory declaration from client
  socket.on('game:declareVictory', ({ campaignId, winnerId, winCondition }) => {
    console.log(`Victory declared for campaign ${campaignId}: ${winnerId} by ${winCondition}`);

    // Record the completed game
    const completedGame = finishGame(campaignId, winnerId, winCondition);

    if (!completedGame) {
      socket.emit('lobby:error', { message: 'Failed to record victory' });
      return;
    }

    // Get winner info
    const gameState = getOrLoadGameState(campaignId);
    const winner = gameState?.players.find((p) => p.id === winnerId);

    if (winner) {
      // Notify all players to show post-game screen
      io.to(campaignId).emit('game:postGame', {
        winnerId: winner.id,
        winnerName: winner.name,
        winCondition,
      });
    }

    console.log(`Game recorded for campaign ${campaignId}, entering post-game phase`);
  });

  // Handle post-game completion (winner confirmed their rewards)
  socket.on('game:completePostGame', ({ campaignId, scarsPlaced, citiesBuilt }) => {
    console.log(`Completing post-game for campaign ${campaignId}`);

    // Get territory names for the placements
    const gameState = getOrLoadGameState(campaignId);
    const lobby = getLobby(campaignId);

    if (!gameState || !lobby) {
      socket.emit('lobby:error', { message: 'No active game found' });
      return;
    }

    // Build full scar placements with territory names and player info
    const fullScarsPlaced: ScarPlacement[] = scarsPlaced.map((scar) => {
      const territory = gameState.territories[scar.territoryId];
      const player = gameState.players.find((p) => p.id === gameState.winnerId);
      return {
        territoryId: scar.territoryId,
        territoryName: territory?.name || scar.territoryId,
        scarType: scar.scarType,
        placedByPlayerId: player?.id || '',
        placedByPlayerName: player?.name || '',
      };
    });

    // Build full city placements with territory names and player info
    const fullCitiesBuilt: CityPlacement[] = citiesBuilt.map((city) => {
      const territory = gameState.territories[city.territoryId];
      const player = gameState.players.find((p) => p.id === gameState.winnerId);
      return {
        territoryId: city.territoryId,
        territoryName: territory?.name || city.territoryId,
        cityTier: city.cityTier,
        cityName: city.cityName,
        builtByPlayerId: player?.id || '',
        builtByPlayerName: player?.name || '',
      };
    });

    // Complete the post-game phase
    completePostGame(campaignId, fullScarsPlaced, fullCitiesBuilt);
    clearMissileWindowTimer(campaignId);

    // Reset lobby status back to waiting
    setCampaignActiveGame(campaignId, false);

    // Notify all players that the game is complete
    io.to(campaignId).emit('game:gameComplete', { campaignId });

    // Broadcast updated campaign list
    io.emit('campaign:list', { campaigns: getAllCampaigns() });

    console.log(`Game complete for campaign ${campaignId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    handlePlayerLeave(socket, true); // Keep identity during disconnect for potential rejoin
  });

  function handlePlayerLeave(
    socket: { id: string; leave: (room: string) => void },
    isDisconnect: boolean = false
  ) {
    // Check if there's an active game for this player's campaign
    const campaignId = getCampaignForSocket(socket.id);
    const lobby = campaignId ? getLobby(campaignId) : null;
    const keepIdentity = isDisconnect && lobby?.status === 'in_game';

    const result = removePlayerFromLobby(socket.id, keepIdentity);

    if (result.campaignId) {
      socket.leave(result.campaignId);

      if (result.lobby) {
        // Only notify if player was actually removed (not during active game disconnect)
        if (!keepIdentity) {
          // Notify remaining players
          io.to(result.campaignId).emit('lobby:playerLeft', { socketId: socket.id });

          // If host changed, send updated lobby state
          if (result.wasHost && result.lobby.players.length > 0) {
            io.to(result.campaignId).emit('lobby:state', { lobby: result.lobby });
          }
        }
      }

      // Broadcast updated campaign list (player count changed)
      io.emit('campaign:list', { campaigns: getAllCampaigns() });
    }
  }
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
