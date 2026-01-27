/**
 * Shared types for the multiplayer lobby system
 */

export interface Campaign {
  id: string;
  name: string;
  createdAt: number;
  playerCount: number; // Current players in lobby
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

// Client -> Server events
export interface ClientToServerEvents {
  'campaign:create': (data: { name: string }) => void;
  'campaign:list': () => void;
  'lobby:join': (data: { campaignId: string; playerName: string }) => void;
  'lobby:leave': () => void;
  'lobby:ready': (data: { isReady: boolean }) => void;
  'lobby:transferHost': (data: { targetSocketId: string }) => void;
  'lobby:kick': (data: { targetSocketId: string }) => void;
  'lobby:start': () => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'campaign:list': (data: { campaigns: Campaign[] }) => void;
  'lobby:state': (data: { lobby: Lobby }) => void;
  'lobby:playerJoined': (data: { player: LobbyPlayer }) => void;
  'lobby:playerLeft': (data: { socketId: string }) => void;
  'lobby:kicked': () => void;
  'lobby:error': (data: { message: string }) => void;
  'game:started': (data: { initialState: GameInitialState }) => void;
}

// Initial game state sent when host starts the game
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
