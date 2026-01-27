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
} from './types';
import {
  createCampaign,
  getAllCampaigns,
  getLobby,
  addPlayerToLobby,
  removePlayerFromLobby,
  setPlayerReady,
  transferHost,
  kickPlayer,
  startGame,
  getCampaignForSocket,
} from './store';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

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

  // Lobby events
  socket.on('lobby:join', ({ campaignId, playerName }) => {
    const result = addPlayerToLobby(campaignId, socket.id, playerName.trim() || 'Anonymous');

    if (!result.success || !result.lobby) {
      socket.emit('lobby:error', { message: result.error || 'Failed to join lobby' });
      return;
    }

    // Join the socket room for this campaign
    socket.join(campaignId);

    // Send full lobby state to the joining player
    socket.emit('lobby:state', { lobby: result.lobby });

    // Notify other players in the lobby
    const newPlayer = result.lobby.players.find(p => p.socketId === socket.id);
    if (newPlayer) {
      socket.to(campaignId).emit('lobby:playerJoined', { player: newPlayer });
    }

    // Broadcast updated campaign list (player count changed)
    io.emit('campaign:list', { campaigns: getAllCampaigns() });

    console.log(`Player ${playerName} joined lobby ${campaignId}`);
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
      const gameId = `game-${Date.now()}`;

      // Create initial game state
      const initialState: GameInitialState = {
        gameId,
        campaignName: result.lobby.campaignName,
        players: result.lobby.players.map((p, index) => ({
          id: `player-${index + 1}`,
          name: p.name,
          socketId: p.socketId,
          seatIndex: index,
        })),
      };

      // Broadcast game start to all players in lobby
      io.to(result.lobby.campaignId).emit('game:started', { initialState });

      console.log(`Game started for campaign ${result.lobby.campaignId} with ${result.lobby.players.length} players`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    handlePlayerLeave(socket);
  });

  function handlePlayerLeave(socket: { id: string; leave: (room: string) => void; to: (room: string) => { emit: (event: string, data: unknown) => void } }) {
    const result = removePlayerFromLobby(socket.id);

    if (result.campaignId) {
      socket.leave(result.campaignId);

      if (result.lobby) {
        // Notify remaining players
        io.to(result.campaignId).emit('lobby:playerLeft', { socketId: socket.id });

        // If host changed, send updated lobby state
        if (result.wasHost && result.lobby.players.length > 0) {
          io.to(result.campaignId).emit('lobby:state', { lobby: result.lobby });
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
