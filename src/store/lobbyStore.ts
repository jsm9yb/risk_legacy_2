/**
 * Lobby store for multiplayer state management
 */

import { create } from 'zustand';

// Re-export types from server for client use
export interface Campaign {
  id: string;
  name: string;
  createdAt: number;
  playerCount: number;
  gamesPlayed: number;
  hasActiveGame: boolean;
}

export interface LobbyPlayer {
  socketId: string;
  odId: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isSeatHolder: boolean;
  joinedAt: number;
}

export interface Lobby {
  campaignId: string;
  campaignName: string;
  players: LobbyPlayer[];
  maxPlayers: 5;
  status: 'waiting' | 'starting' | 'in_game';
}

export interface GameInitialState {
  gameId: string;
  campaignName: string;
  players: Array<{
    id: string;
    name: string;
    socketId: string;
    seatIndex: number;
  }>;
}

// Campaign with full history (from server)
export interface CampaignFull {
  id: string;
  name: string;
  createdAt: number;
  gamesPlayed: number;
  currentGameId: string | null;
  persistentTerritories: Record<string, {
    scarId: string | null;
    cityTier: number;
    cityName: string | null;
  }>;
  completedGames: Array<{
    gameNumber: number;
    gameId: string;
    startedAt: number;
    endedAt: number;
    winnerId: string;
    winnerName: string;
    winnerFaction: string;
    winCondition: string;
    placements: Array<{
      playerId: string;
      playerName: string;
      factionId: string;
      placement: number;
      territoriesHeld: number;
      redStars: number;
      wasEliminated: boolean;
    }>;
    scarsPlaced: Array<{
      territoryId: string;
      territoryName: string;
      scarType: string | null;
      placedByPlayerId: string;
      placedByPlayerName: string;
    }>;
    citiesBuilt: Array<{
      territoryId: string;
      territoryName: string;
      cityTier: number;
      cityName: string | null;
      builtByPlayerId: string;
      builtByPlayerName: string;
    }>;
    packetsOpened: string[];
  }>;
  packetsOpened: Array<{
    packetId: string;
    openedInGame: number;
    openedBy: string;
    openedByName: string;
    reason: string;
    timestamp: number;
  }>;
  participants: Array<{
    odId: string;
    name: string;
    gamesPlayed: number;
    wins: number;
    lastPlayedAt: number;
  }>;
}

interface LobbyState {
  // Connection state
  isConnected: boolean;
  socketId: string | null;
  connectionError: string | null;

  // Player identity
  playerName: string | null;
  authType: 'google' | 'guest' | null;
  authEmail: string | null;
  authSub: string | null;
  localPlayerOdId: string | null; // Persistent player identity for current campaign
  showNamePrompt: boolean;
  pendingCampaignId: string | null; // Campaign to join after name is set
  pendingCampaignParticipants: Array<{ odId: string; name: string }>;
  pendingSelectedOdId: string | null;
  pendingRequireSeatClaim: boolean;

  // Campaign browser
  campaigns: Campaign[];

  // Current lobby
  currentLobby: Lobby | null;
  lobbyError: string | null;

  // Game state
  gameStarted: boolean;
  initialGameState: GameInitialState | null;
  isResuming: boolean;

  // Campaign history (for viewing history modal)
  campaignHistory: CampaignFull | null;
  showHistoryModal: boolean;

  // Post-game state
  postGameWinner: {
    winnerId: string;
    winnerName: string;
    winCondition: 'stars' | 'elimination' | 'domination';
  } | null;
}

interface LobbyActions {
  // Connection actions
  setConnected: (connected: boolean, socketId?: string | null) => void;
  setConnectionError: (error: string | null) => void;

  // Player name actions
  setPlayerName: (name: string) => void;
  setGuestIdentity: (name: string) => void;
  setGoogleIdentity: (name: string, email: string, sub: string) => void;
  showNamePromptForCampaign: (campaignId: string | null, requireSeatClaim?: boolean) => void;
  closeNamePrompt: () => void;
  setPendingCampaignParticipants: (campaignId: string, participants: Array<{ odId: string; name: string }>) => void;
  setPendingSelectedOdId: (odId: string | null) => void;

  // Player token actions
  setLocalPlayerOdId: (odId: string | null) => void;
  saveTokenForCampaign: (campaignId: string, odId: string) => void;
  loadTokenForCampaign: (campaignId: string) => string | null;
  getAllStoredTokens: () => Array<{ campaignId: string; token: string }>;

  // Campaign actions
  setCampaigns: (campaigns: Campaign[]) => void;
  setCampaignHistory: (campaign: CampaignFull) => void;
  showHistory: (show: boolean) => void;

  // Lobby actions
  setCurrentLobby: (lobby: Lobby | null) => void;
  updateLobbyPlayer: (player: LobbyPlayer) => void;
  removePlayerFromLobby: (socketId: string) => void;
  setLobbyError: (error: string | null) => void;
  leaveLobby: () => void;

  // Game actions
  setGameStarted: (started: boolean, initialState?: GameInitialState) => void;
  setResuming: (isResuming: boolean) => void;
  resetGameState: () => void;

  // Post-game actions
  setPostGameWinner: (winnerId: string, winnerName: string, winCondition: 'stars' | 'elimination' | 'domination') => void;
  clearPostGameWinner: () => void;

  // Utility
  isHost: () => boolean;
  getLocalPlayer: () => LobbyPlayer | null;
}

export type LobbyStore = LobbyState & LobbyActions;

// Session storage key for player name
const PLAYER_NAME_KEY = 'risk_legacy_player_name';
const AUTH_TYPE_KEY = 'risk_legacy_auth_type';
const AUTH_EMAIL_KEY = 'risk_legacy_auth_email';
const AUTH_SUB_KEY = 'risk_legacy_auth_sub';
const LAST_CAMPAIGN_ID_KEY = 'risk_legacy_last_campaign_id';

// Load player name from session storage
function loadPlayerName(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(PLAYER_NAME_KEY);
  }
  return null;
}

function loadAuthType(): 'google' | 'guest' | null {
  if (typeof window !== 'undefined') {
    const value = localStorage.getItem(AUTH_TYPE_KEY);
    if (value === 'google' || value === 'guest') {
      return value;
    }
  }
  return null;
}

function loadAuthEmail(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_EMAIL_KEY);
  }
  return null;
}

function loadAuthSub(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_SUB_KEY);
  }
  return null;
}

// Save player name to session storage
function savePlayerName(name: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  }
}

function saveAuth(type: 'google' | 'guest', email: string | null, sub: string | null): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_TYPE_KEY, type);
    if (email) {
      localStorage.setItem(AUTH_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(AUTH_EMAIL_KEY);
    }
    if (sub) {
      localStorage.setItem(AUTH_SUB_KEY, sub);
    } else {
      localStorage.removeItem(AUTH_SUB_KEY);
    }
  }
}

// Token storage helpers for persistent player identity
function getTokenKey(campaignId: string): string {
  return `risk_legacy_token_${campaignId}`;
}

function loadPlayerToken(campaignId: string): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(getTokenKey(campaignId));
  }
  return null;
}

function savePlayerToken(campaignId: string, token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(getTokenKey(campaignId), token);
  }
}

// Clear player token - exported for potential future use
export function clearPlayerToken(campaignId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(getTokenKey(campaignId));
  }
}

// Get all stored campaign tokens (for rejoin detection)
function getAllStoredTokens(): Array<{ campaignId: string; token: string }> {
  if (typeof window === 'undefined') return [];

  const tokens: Array<{ campaignId: string; token: string }> = [];
  const prefix = 'risk_legacy_token_';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const campaignId = key.slice(prefix.length);
      const token = localStorage.getItem(key);
      if (token) {
        tokens.push({ campaignId, token });
      }
    }
  }

  return tokens;
}

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  // Initial state
  isConnected: false,
  socketId: null,
  connectionError: null,
  playerName: loadPlayerName(),
  authType: loadAuthType(),
  authEmail: loadAuthEmail(),
  authSub: loadAuthSub(),
  localPlayerOdId: null,
  showNamePrompt: false,
  pendingCampaignId: null,
  pendingCampaignParticipants: [],
  pendingSelectedOdId: null,
  pendingRequireSeatClaim: false,
  campaigns: [],
  currentLobby: null,
  lobbyError: null,
  gameStarted: false,
  initialGameState: null,
  isResuming: false,
  campaignHistory: null,
  showHistoryModal: false,
  postGameWinner: null,

  // Connection actions
  setConnected: (connected, socketId = null) => {
    set({
      isConnected: connected,
      socketId: connected ? socketId : null,
      connectionError: connected ? null : get().connectionError,
    });
  },

  setConnectionError: (error) => {
    set({ connectionError: error });
  },

  // Player name actions
  setPlayerName: (name) => {
    savePlayerName(name);
    set({ playerName: name });
  },

  setGuestIdentity: (name) => {
    const trimmed = name.trim();
    savePlayerName(trimmed);
    saveAuth('guest', null, null);
    set({
      playerName: trimmed,
      authType: 'guest',
      authEmail: null,
      authSub: null,
    });
  },

  setGoogleIdentity: (name, email, sub) => {
    savePlayerName(name);
    saveAuth('google', email, sub);
    set({
      playerName: name,
      authType: 'google',
      authEmail: email,
      authSub: sub,
    });
  },

  showNamePromptForCampaign: (campaignId, requireSeatClaim = false) => {
    set({
      showNamePrompt: true,
      pendingCampaignId: campaignId,
      pendingCampaignParticipants: [],
      pendingSelectedOdId: null,
      pendingRequireSeatClaim: requireSeatClaim,
    });
  },

  closeNamePrompt: () => {
    set({
      showNamePrompt: false,
      pendingCampaignId: null,
      pendingCampaignParticipants: [],
      pendingSelectedOdId: null,
      pendingRequireSeatClaim: false,
    });
  },

  setPendingCampaignParticipants: (_campaignId, participants) => {
    set((state) => ({
      pendingCampaignParticipants: participants,
      pendingSelectedOdId:
        state.pendingSelectedOdId && participants.some((p) => p.odId === state.pendingSelectedOdId)
          ? state.pendingSelectedOdId
          : participants[0]?.odId || null,
    }));
  },

  setPendingSelectedOdId: (odId) => {
    set({ pendingSelectedOdId: odId });
  },

  // Player token actions
  setLocalPlayerOdId: (odId) => {
    set({ localPlayerOdId: odId });
  },

  saveTokenForCampaign: (campaignId, odId) => {
    savePlayerToken(campaignId, odId);
    set({ localPlayerOdId: odId });
  },

  loadTokenForCampaign: (campaignId) => {
    return loadPlayerToken(campaignId);
  },

  getAllStoredTokens: () => {
    return getAllStoredTokens();
  },

  // Campaign actions
  setCampaigns: (campaigns) => {
    set({ campaigns });
  },

  setCampaignHistory: (campaign) => {
    set({ campaignHistory: campaign, showHistoryModal: true });
  },

  showHistory: (show) => {
    set({ showHistoryModal: show });
    if (!show) {
      set({ campaignHistory: null });
    }
  },

  // Lobby actions
  setCurrentLobby: (lobby) => {
    if (typeof window !== 'undefined' && lobby?.campaignId) {
      localStorage.setItem(LAST_CAMPAIGN_ID_KEY, lobby.campaignId);
    }
    set({
      currentLobby: lobby,
      lobbyError: null,
    });
  },

  updateLobbyPlayer: (player) => {
    set((state) => {
      if (!state.currentLobby) return state;

      const existingIndex = state.currentLobby.players.findIndex(
        (p) => p.socketId === player.socketId
      );

      if (existingIndex >= 0) {
        // Update existing player
        const updatedPlayers = [...state.currentLobby.players];
        updatedPlayers[existingIndex] = player;
        return {
          currentLobby: {
            ...state.currentLobby,
            players: updatedPlayers,
          },
        };
      } else {
        // Add new player
        return {
          currentLobby: {
            ...state.currentLobby,
            players: [...state.currentLobby.players, player],
          },
        };
      }
    });
  },

  removePlayerFromLobby: (socketId) => {
    set((state) => {
      if (!state.currentLobby) return state;

      return {
        currentLobby: {
          ...state.currentLobby,
          players: state.currentLobby.players.filter(
            (p) => p.socketId !== socketId
          ),
        },
      };
    });
  },

  setLobbyError: (error) => {
    set({ lobbyError: error });
  },

  leaveLobby: () => {
    set({
      currentLobby: null,
      lobbyError: null,
    });
  },

  // Game actions
  setGameStarted: (started, initialState) => {
    set({
      gameStarted: started,
      initialGameState: initialState || null,
    });
  },

  setResuming: (isResuming) => {
    set({ isResuming });
  },

  resetGameState: () => {
    set({
      gameStarted: false,
      initialGameState: null,
      currentLobby: null,
      isResuming: false,
      postGameWinner: null,
      localPlayerOdId: null,
    });
  },

  // Post-game actions
  setPostGameWinner: (winnerId, winnerName, winCondition) => {
    set({ postGameWinner: { winnerId, winnerName, winCondition } });
  },

  clearPostGameWinner: () => {
    set({ postGameWinner: null });
  },

  // Utility functions
  isHost: () => {
    const state = get();
    if (!state.currentLobby || !state.socketId) return false;
    const player = state.currentLobby.players.find(
      (p) => p.socketId === state.socketId
    );
    return player?.isHost ?? false;
  },

  getLocalPlayer: () => {
    const state = get();
    if (!state.currentLobby || !state.socketId) return null;
    return (
      state.currentLobby.players.find((p) => p.socketId === state.socketId) ||
      null
    );
  },
}));
