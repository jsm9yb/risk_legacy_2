/**
 * In-memory data store for campaigns and lobbies
 */

import { Campaign, Lobby, LobbyPlayer } from './types';

// In-memory storage
export const campaigns = new Map<string, Campaign>();
export const lobbies = new Map<string, Lobby>();

// Track which campaign a socket is in
export const socketToCampaign = new Map<string, string>();

/**
 * Create a new campaign
 */
export function createCampaign(id: string, name: string): Campaign {
  const campaign: Campaign = {
    id,
    name,
    createdAt: Date.now(),
    playerCount: 0,
  };
  campaigns.set(id, campaign);

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
export function getAllCampaigns(): Campaign[] {
  return Array.from(campaigns.values());
}

/**
 * Get a lobby by campaign ID
 */
export function getLobby(campaignId: string): Lobby | undefined {
  return lobbies.get(campaignId);
}

/**
 * Add a player to a lobby
 */
export function addPlayerToLobby(
  campaignId: string,
  socketId: string,
  playerName: string
): { success: boolean; lobby?: Lobby; error?: string } {
  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    return { success: false, error: 'Campaign not found' };
  }

  if (lobby.status !== 'waiting') {
    return { success: false, error: 'Game already in progress' };
  }

  if (lobby.players.length >= lobby.maxPlayers) {
    return { success: false, error: 'Lobby is full' };
  }

  // Check if player is already in lobby
  if (lobby.players.some(p => p.socketId === socketId)) {
    return { success: false, error: 'Already in lobby' };
  }

  const isHost = lobby.players.length === 0;
  const player: LobbyPlayer = {
    socketId,
    name: playerName,
    isReady: false,
    isHost,
    joinedAt: Date.now(),
  };

  lobby.players.push(player);

  // Update campaign player count
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.playerCount = lobby.players.length;
  }

  // Track socket to campaign mapping
  socketToCampaign.set(socketId, campaignId);

  return { success: true, lobby };
}

/**
 * Remove a player from a lobby
 */
export function removePlayerFromLobby(
  socketId: string
): { campaignId?: string; lobby?: Lobby; wasHost: boolean } {
  const campaignId = socketToCampaign.get(socketId);
  if (!campaignId) {
    return { wasHost: false };
  }

  const lobby = lobbies.get(campaignId);
  if (!lobby) {
    socketToCampaign.delete(socketId);
    return { wasHost: false };
  }

  const playerIndex = lobby.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    socketToCampaign.delete(socketId);
    return { wasHost: false };
  }

  const wasHost = lobby.players[playerIndex].isHost;
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

  // Clean up empty lobbies
  if (lobby.players.length === 0) {
    lobbies.delete(campaignId);
    campaigns.delete(campaignId);
  }

  socketToCampaign.delete(socketId);

  return { campaignId, lobby, wasHost };
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
