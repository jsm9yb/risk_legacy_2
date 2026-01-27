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
}

export interface LobbyPlayer {
  socketId: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
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

interface LobbyState {
  // Connection state
  isConnected: boolean;
  socketId: string | null;
  connectionError: string | null;

  // Player identity
  playerName: string | null;
  showNamePrompt: boolean;
  pendingCampaignId: string | null; // Campaign to join after name is set

  // Campaign browser
  campaigns: Campaign[];

  // Current lobby
  currentLobby: Lobby | null;
  lobbyError: string | null;

  // Game state
  gameStarted: boolean;
  initialGameState: GameInitialState | null;
}

interface LobbyActions {
  // Connection actions
  setConnected: (connected: boolean, socketId?: string | null) => void;
  setConnectionError: (error: string | null) => void;

  // Player name actions
  setPlayerName: (name: string) => void;
  showNamePromptForCampaign: (campaignId: string | null) => void;
  closeNamePrompt: () => void;

  // Campaign actions
  setCampaigns: (campaigns: Campaign[]) => void;

  // Lobby actions
  setCurrentLobby: (lobby: Lobby | null) => void;
  updateLobbyPlayer: (player: LobbyPlayer) => void;
  removePlayerFromLobby: (socketId: string) => void;
  setLobbyError: (error: string | null) => void;
  leaveLobby: () => void;

  // Game actions
  setGameStarted: (started: boolean, initialState?: GameInitialState) => void;
  resetGameState: () => void;

  // Utility
  isHost: () => boolean;
  getLocalPlayer: () => LobbyPlayer | null;
}

export type LobbyStore = LobbyState & LobbyActions;

// Session storage key for player name
const PLAYER_NAME_KEY = 'risk_legacy_player_name';

// Load player name from session storage
function loadPlayerName(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(PLAYER_NAME_KEY);
  }
  return null;
}

// Save player name to session storage
function savePlayerName(name: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  }
}

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  // Initial state
  isConnected: false,
  socketId: null,
  connectionError: null,
  playerName: loadPlayerName(),
  showNamePrompt: false,
  pendingCampaignId: null,
  campaigns: [],
  currentLobby: null,
  lobbyError: null,
  gameStarted: false,
  initialGameState: null,

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

  showNamePromptForCampaign: (campaignId) => {
    set({
      showNamePrompt: true,
      pendingCampaignId: campaignId,
    });
  },

  closeNamePrompt: () => {
    set({
      showNamePrompt: false,
      pendingCampaignId: null,
    });
  },

  // Campaign actions
  setCampaigns: (campaigns) => {
    set({ campaigns });
  },

  // Lobby actions
  setCurrentLobby: (lobby) => {
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

  resetGameState: () => {
    set({
      gameStarted: false,
      initialGameState: null,
      currentLobby: null,
    });
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
