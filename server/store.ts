/**
 * In-memory data store for campaigns and lobbies
 */

import { CampaignSummary, Lobby, LobbyPlayer, CampaignFull } from './types';
import {
  loadCampaigns,
  saveCampaigns,
  loadCampaignFull,
  saveCampaignFull,
  createCampaignFull,
  deleteCampaignFull,
  hasActiveGame,
} from './persistence';
import { campaignHasActiveGame } from './gameState';
import { getOrLoadGameState } from './gameState';

// In-memory storage
export const campaigns = new Map<string, CampaignSummary>();
export const lobbies = new Map<string, Lobby>();

// Initialize campaigns from disk on startup
const persistedCampaigns = loadCampaigns();
for (const campaign of persistedCampaigns) {
  // Check if campaign has an active game
  const activeGame = hasActiveGame(campaign.id);

  campaigns.set(campaign.id, {
    ...campaign,
    playerCount: 0,
    hasActiveGame: activeGame,
  });

  // Create empty lobby for each persisted campaign
  // Set status to 'in_game' if there's an active game
  lobbies.set(campaign.id, {
    campaignId: campaign.id,
    campaignName: campaign.name,
    players: [],
    maxPlayers: 5,
    status: activeGame ? 'in_game' : 'waiting',
  });
}
console.log(`Loaded ${persistedCampaigns.length} campaigns from disk`);

/**
 * Persist all campaigns to disk
 */
function persistCampaigns(): void {
  saveCampaigns(Array.from(campaigns.values()));
}

// Track which campaign a socket is in
export const socketToCampaign = new Map<string, string>();

// Player identity tracking for persistent connections
// Maps odId (persistent player token) to socketId
const playerTokenToSocket = new Map<string, string>();
// Maps socketId to odId
const socketToPlayerToken = new Map<string, string>();

/**
 * Bind a player token (odId) to a socket
 */
export function bindPlayerToSocket(odId: string, socketId: string): void {
  // Clean up any old socket binding for this player
  const oldSocketId = playerTokenToSocket.get(odId);
  if (oldSocketId && oldSocketId !== socketId) {
    socketToPlayerToken.delete(oldSocketId);
  }

  playerTokenToSocket.set(odId, socketId);
  socketToPlayerToken.set(socketId, odId);
}

/**
 * Unbind a socket (but keep player identity for reconnection)
 */
export function unbindSocket(socketId: string): string | undefined {
  const odId = socketToPlayerToken.get(socketId);
  if (odId) {
    playerTokenToSocket.delete(odId);
    socketToPlayerToken.delete(socketId);
  }
  return odId;
}

/**
 * Get the socket ID for a player token
 */
export function getSocketForPlayer(odId: string): string | undefined {
  return playerTokenToSocket.get(odId);
}

/**
 * Get the player token for a socket ID
 */
export function getPlayerForSocket(socketId: string): string | undefined {
  return socketToPlayerToken.get(socketId);
}

/**
 * Create a new campaign
 */
export function createCampaign(id: string, name: string): CampaignSummary {
  const campaign: CampaignSummary = {
    id,
    name,
    createdAt: Date.now(),
    playerCount: 0,
    gamesPlayed: 0,
    hasActiveGame: false,
  };
  campaigns.set(id, campaign);
  persistCampaigns();

  // Create full campaign data on disk
  createCampaignFull(id, name);

  // Create associated lobby
  const lobby: Lobby = {
    campaignId: id,
    campaignName: name,
    players: [],
    maxPlayers: 5,
    status: 'waiting',
  };
  lobbies.set(id, lobby);

  return campaign;
}

/**
 * Get all campaigns as an array
 */
export function getAllCampaigns(): CampaignSummary[] {
  // Update hasActiveGame status before returning
  for (const [id, campaign] of campaigns) {
    campaign.hasActiveGame = hasActiveGame(id);

    // Also update gamesPlayed from full campaign if available
    const full = loadCampaignFull(id);
    if (full) {
      campaign.gamesPlayed = full.gamesPlayed;
    }
  }
  return Array.from(campaigns.values());
}

/**
 * Get full campaign data with history
 */
export function getCampaignFull(campaignId: string): CampaignFull | null {
  return loadCampaignFull(campaignId);
}

/**
 * Get a lobby by campaign ID
 */
export function getLobby(campaignId: string): Lobby | undefined {
  return lobbies.get(campaignId);
}

/**
 * Add a player to a lobby
 * @param playerToken - Optional existing player token (odId) for reconnection
 * @returns success flag, lobby state, and the assigned odId
 */
export function addPlayerToLobby(
  campaignId: string,
  socketId: string,
  playerName: string,
  playerToken?: string
): { success: boolean; lobby?: Lobby; error?: string; odId?: string } {
  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Campaign not found' };
  }
  const campaign = loadCampaignFull(campaignId);

  // For active games, ensure seat-holder rows exist in lobby even after server restarts
  if (lobby.status === 'in_game' && !lobby.players.some((p) => p.isSeatHolder)) {
    const gameState = getOrLoadGameState(campaignId);
    if (gameState) {
      gameState.players.forEach((gamePlayer, index) => {
        const seatOdId =
          campaign?.participants.find((p) => p.odId === gamePlayer.userId)?.odId ||
          campaign?.participants.find((p) => p.odId === gamePlayer.id)?.odId ||
          gamePlayer.userId ||
          gamePlayer.id;
        lobby.players.push({
          socketId: `offline-${gamePlayer.id}`,
          odId: seatOdId,
          name: gamePlayer.name,
          isReady: true,
          isHost: index === 0,
          isSeatHolder: true,
          joinedAt: Date.now(),
        });
      });
    }
  }

  if (lobby.status === 'waiting' && lobby.players.length >= lobby.maxPlayers) {
    return { success: false, error: 'Lobby is full' };
  }

  // Check if player is already in lobby by socket
  if (lobby.players.some(p => p.socketId === socketId)) {
    return { success: false, error: 'Already in lobby' };
  }

  let odId: string;

  // If a token was provided, validate it against campaign participants
  if (playerToken && campaign) {
    const existingParticipant = campaign.participants.find(p => p.odId === playerToken);
    if (existingParticipant) {
      odId = playerToken;
      // Check if this player is already in the lobby (reconnecting)
      const existingLobbyPlayer = lobby.players.find(p => p.odId === playerToken);
      if (existingLobbyPlayer) {
        // Update the socket ID for the existing player
        existingLobbyPlayer.socketId = socketId;
        existingLobbyPlayer.name = playerName;
        existingLobbyPlayer.isSeatHolder = true;
        bindPlayerToSocket(odId, socketId);
        socketToCampaign.set(socketId, campaignId);
        return { success: true, lobby, odId };
      }
    } else {
      // Token not found in participants, generate new one
      odId = `od-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  } else {
    // No token provided, generate new one
    odId = `od-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const isHost = lobby.players.length === 0;
  const player: LobbyPlayer = {
    socketId,
    odId,
    name: playerName,
    isReady: false,
    isHost,
    isSeatHolder: lobby.status === 'waiting',
    joinedAt: Date.now(),
  };

  lobby.players.push(player);

  // Bind player to socket
  bindPlayerToSocket(odId, socketId);

  // Update campaign player count
  const campaignSummary = campaigns.get(campaignId);
  if (campaignSummary) {
    campaignSummary.playerCount = lobby.players.length;
  }

  // Track socket to campaign mapping
  socketToCampaign.set(socketId, campaignId);

  return { success: true, lobby, odId };
}

/**
 * Remove a player from a lobby
 * @param keepIdentity - If true, don't remove player from lobby (for reconnection scenarios)
 */
export function removePlayerFromLobby(
  socketId: string,
  keepIdentity: boolean = false
): { campaignId?: string; lobby?: Lobby; wasHost: boolean; odId?: string } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { wasHost: false };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    socketToCampaign.delete(socketId);
    unbindSocket(socketId);
    return { wasHost: false };
  }

  const playerIndex = lobby.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    socketToCampaign.delete(socketId);
    unbindSocket(socketId);
    return { wasHost: false };
  }

  const player = lobby.players[playerIndex];
  const wasHost = player.isHost;
  const odId = player.odId;

  // If game is in progress, don't remove the player, just unbind socket
  // This allows reconnection during active games
  if ((lobby.status === 'in_game' || keepIdentity) && player.isSeatHolder) {
    // Keep player in lobby but clear socket binding
    unbindSocket(socketId);
    socketToCampaign.delete(socketId);
    return { campaignId, lobby, wasHost, odId };
  }

  // Normal case: remove player from lobby
  lobby.players.splice(playerIndex, 1);

  // Update campaign player count
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.playerCount = lobby.players.length;
  }

  // If host left and there are remaining players, transfer host
  if (wasHost && lobby.players.length > 0) {
    lobby.players[0].isHost = true;
  }

  // Clean up empty lobbies - but keep campaign persisted
  if (lobby.players.length === 0) {
    // Reset lobby status to waiting when all players leave
    lobby.status = 'waiting';
  }

  socketToCampaign.delete(socketId);
  unbindSocket(socketId);

  return { campaignId, lobby, wasHost, odId };
}

/**
 * Claim an existing in-game seat from the lobby
 */
export function claimSeatInLobby(
  campaignId: string,
  claimantSocketId: string,
  targetOdId: string,
  playerName: string
): { success: boolean; lobby?: Lobby; error?: string; claimedOdId?: string } {
  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Lobby not found' };
  }
  if (lobby.status !== 'in_game') {
    return { success: false, error: 'Seat claiming is only available while a game is active' };
  }

  const claimant = lobby.players.find((p) => p.socketId === claimantSocketId);
  if (!claimant) {
    return { success: false, error: 'You are not in this lobby' };
  }

  const seatPlayer = lobby.players.find((p) => p.odId === targetOdId && p.isSeatHolder);
  if (!seatPlayer) {
    return { success: false, error: 'Seat not found' };
  }

  const oldSeatSocketId = seatPlayer.socketId;

  // If claiming from a temporary/spectator identity, remove it from lobby first
  if (claimant.odId !== seatPlayer.odId && !claimant.isSeatHolder) {
    const claimantIndex = lobby.players.findIndex((p) => p.socketId === claimantSocketId);
    if (claimantIndex >= 0) {
      lobby.players.splice(claimantIndex, 1);
    }
  }

  // Rebind the target seat to the claimant socket
  seatPlayer.socketId = claimantSocketId;
  seatPlayer.name = playerName || seatPlayer.name;
  seatPlayer.isSeatHolder = true;
  seatPlayer.isReady = true;

  if (oldSeatSocketId && oldSeatSocketId !== claimantSocketId) {
    socketToCampaign.delete(oldSeatSocketId);
    unbindSocket(oldSeatSocketId);
  }
  bindPlayerToSocket(seatPlayer.odId, claimantSocketId);
  socketToCampaign.set(claimantSocketId, campaignId);

  return { success: true, lobby, claimedOdId: seatPlayer.odId };
}

/**
 * Find a player in a lobby by their odId
 */
export function findLobbyPlayerByOdId(
  campaignId: string,
  odId: string
): LobbyPlayer | undefined {
  const lobby = lobbies.get(campaignId);
  if (!lobby) return undefined;
  return lobby.players.find(p => p.odId === odId);
}

/**
 * Update a lobby player's socket ID (for reconnection)
 */
export function rebindLobbyPlayer(
  campaignId: string,
  odId: string,
  newSocketId: string
): { success: boolean; lobby?: Lobby } {
  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false };
  }

  const player = lobby.players.find(p => p.odId === odId);
  if (!player) {
    return { success: false };
  }

  // Unbind old socket if exists
  if (player.socketId) {
    socketToCampaign.delete(player.socketId);
    unbindSocket(player.socketId);
  }

  // Bind new socket
  player.socketId = newSocketId;
  bindPlayerToSocket(odId, newSocketId);
  socketToCampaign.set(newSocketId, campaignId);

  return { success: true, lobby };
}

/**
 * Set a player's ready status
 */
export function setPlayerReady(
  socketId: string,
  isReady: boolean
): { success: boolean; lobby?: Lobby } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { success: false };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false };
  }

  const player = lobby.players.find(p => p.socketId === socketId);
  if (!player) {
    return { success: false };
  }

  player.isReady = isReady;
  return { success: true, lobby };
}

/**
 * Transfer host to another player
 */
export function transferHost(
  socketId: string,
  targetSocketId: string
): { success: boolean; lobby?: Lobby; error?: string } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { success: false, error: 'Not in a lobby' };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Lobby not found' };
  }

  const currentHost = lobby.players.find(p => p.socketId === socketId);
  if (!currentHost || !currentHost.isHost) {
    return { success: false, error: 'Only the host can transfer host' };
  }

  const targetPlayer = lobby.players.find(p => p.socketId === targetSocketId);
  if (!targetPlayer) {
    return { success: false, error: 'Target player not found' };
  }

  currentHost.isHost = false;
  targetPlayer.isHost = true;

  return { success: true, lobby };
}

/**
 * Kick a player from the lobby
 */
export function kickPlayer(
  socketId: string,
  targetSocketId: string
): { success: boolean; lobby?: Lobby; error?: string } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { success: false, error: 'Not in a lobby' };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Lobby not found' };
  }

  const host = lobby.players.find(p => p.socketId === socketId);
  if (!host || !host.isHost) {
    return { success: false, error: 'Only the host can kick players' };
  }

  if (socketId === targetSocketId) {
    return { success: false, error: 'Cannot kick yourself' };
  }

  const targetIndex = lobby.players.findIndex(p => p.socketId === targetSocketId);
  if (targetIndex === -1) {
    return { success: false, error: 'Target player not found' };
  }

  lobby.players.splice(targetIndex, 1);

  // Update campaign player count
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.playerCount = lobby.players.length;
  }

  // Clean up kicked player's socket mapping
  socketToCampaign.delete(targetSocketId);

  return { success: true, lobby };
}

/**
 * Check if all players in a lobby are ready
 */
export function areAllPlayersReady(campaignId: string): boolean {
  const lobby = lobbies.get(campaignId);
  if (!lobby || lobby.players.length < 2) {
    return false;
  }

  return lobby.players.every(p => p.isReady || p.isHost);
}

/**
 * Start the game (mark lobby as starting)
 */
export function startGame(
  socketId: string
): { success: boolean; lobby?: Lobby; error?: string } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { success: false, error: 'Not in a lobby' };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Lobby not found' };
  }

  const host = lobby.players.find(p => p.socketId === socketId);
  if (!host || !host.isHost) {
    return { success: false, error: 'Only the host can start the game' };
  }

  if (lobby.players.length < 2) {
    return { success: false, error: 'Need at least 2 players to start' };
  }

  if (!areAllPlayersReady(campaignId)) {
    return { success: false, error: 'Not all players are ready' };
  }

  lobby.status = 'starting';

  return { success: true, lobby };
}

/**
 * Get campaign ID for a socket
 */
export function getCampaignForSocket(socketId: string): string | undefined {
  return socketToCampaign.get(socketId);
}

/**
 * Delete a campaign (only if no players in lobby)
 */
export function deleteCampaign(
  campaignId: string
): { success: boolean; error?: string } {
  const campaign = campaigns.get(campaignId);
  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }

  const lobby = lobbies.get(campaignId);
  if (lobby && lobby.players.length > 0) {
    return { success: false, error: 'Cannot delete campaign with players in lobby' };
  }

  // Delete full campaign data including game state
  deleteCampaignFull(campaignId);

  campaigns.delete(campaignId);
  lobbies.delete(campaignId);
  persistCampaigns();

  return { success: true };
}

/**
 * Mark a campaign as having an active game
 */
export function setCampaignActiveGame(campaignId: string, hasGame: boolean): void {
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.hasActiveGame = hasGame;
  }
  const lobby = lobbies.get(campaignId);
  if (lobby) {
    lobby.status = hasGame ? 'in_game' : 'waiting';
  }
}

/**
 * Update campaign's gamesPlayed count
 */
export function incrementCampaignGamesPlayed(campaignId: string): void {
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.gamesPlayed += 1;
  }
}
