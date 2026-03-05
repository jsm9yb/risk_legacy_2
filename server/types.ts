/**
 * Shared types for the multiplayer lobby system
 */

import type { TerritoryState, ScarType, CityTier } from '../src/types/territory';
import type { GamePhase, SubPhase, FactionId } from '../src/types/game';
import type { Player } from '../src/types/player';
import type { GameActionType } from '../src/types/actions';

// Re-export types for convenience
export type { TerritoryState, ScarType, CityTier, GamePhase, SubPhase, FactionId, Player };

// ============================================
// Campaign Types (Extended with persistence)
// ============================================

/**
 * Basic campaign info shown in browser list
 */
export interface CampaignSummary {
  id: string;
  name: string;
  createdAt: number;
  playerCount: number; // Current players in lobby
  gamesPlayed: number;
  hasActiveGame: boolean;
}

/**
 * Legacy alias for backward compatibility
 */
export type Campaign = CampaignSummary;

/**
 * Persistent territory state that carries across games
 */
export interface PersistentTerritoryState {
  scarId: ScarType;
  cityTier: CityTier;
  cityName: string | null;
}

/**
 * Participant who has played in this campaign
 */
export interface CampaignParticipant {
  odId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  lastPlayedAt: number;
}

/**
 * Record of a scar placed on the map
 */
export interface ScarPlacement {
  territoryId: string;
  territoryName: string;
  scarType: ScarType;
  placedByPlayerId: string;
  placedByPlayerName: string;
}

/**
 * Record of a city built on the map
 */
export interface CityPlacement {
  territoryId: string;
  territoryName: string;
  cityTier: CityTier;
  cityName: string | null;
  builtByPlayerId: string;
  builtByPlayerName: string;
}

/**
 * Player placement/standing at end of game
 */
export interface PlayerPlacement {
  playerId: string;
  playerName: string;
  factionId: FactionId;
  placement: number; // 1 = winner, 2 = second, etc.
  territoriesHeld: number;
  redStars: number;
  wasEliminated: boolean;
}

/**
 * Record of a completed game in campaign history
 */
export interface CompletedGame {
  gameNumber: number;
  gameId: string;
  startedAt: number;
  endedAt: number;
  winnerId: string;
  winnerName: string;
  winnerFaction: FactionId;
  winCondition: 'stars' | 'elimination' | 'domination';
  placements: PlayerPlacement[];
  scarsPlaced: ScarPlacement[];
  citiesBuilt: CityPlacement[];
  packetsOpened: string[];
}

/**
 * Record of when a packet was opened
 */
export interface PacketRecord {
  packetId: string;  // 'SECOND_WIN' | 'MINOR_CITIES_9' | etc.
  openedInGame: number;
  openedBy: string;
  openedByName: string;
  reason: string;
  timestamp: number;
}

/**
 * Full campaign data with history (stored on disk)
 */
export interface CampaignFull {
  id: string;
  name: string;
  createdAt: number;
  gamesPlayed: number;
  currentGameId: string | null;

  // Persistent map state (survives across games)
  persistentTerritories: Record<string, PersistentTerritoryState>;

  // Campaign history
  completedGames: CompletedGame[];
  packetsOpened: PacketRecord[];
  participants: CampaignParticipant[];
}

// ============================================
// Game State Types (for persistence)
// ============================================

/**
 * Persisted game state - subset of client GameStoreState
 * This is the authoritative state stored on the server
 */
export interface PersistedGameState {
  gameId: string;
  campaignId: string;
  gameNumber: number;
  status: 'setup' | 'active' | 'post_game' | 'finished';
  currentTurn: number;
  activePlayerId: string | null;
  phase: GamePhase;
  subPhase: SubPhase;
  territories: Record<string, TerritoryState>;
  players: Player[];
  troopsToPlace: number;
  pendingDeployments: Record<string, number>;
  attackingTerritory: string | null;
  defendingTerritory: string | null;
  attackerDiceCount: number | null;
  defenderDiceCount: number | null;
  missileWindowEndsAt: number | null;
  combatResult: {
    attackerRolls: Array<{
      originalValue: number;
      modifiedValue: number;
      modifiers: Array<{ source: 'scar' | 'fortification' | 'faction' | 'missile'; name: string; delta: number }>;
      isUnmodifiable: boolean;
    }>;
    defenderRolls: Array<{
      originalValue: number;
      modifiedValue: number;
      modifiers: Array<{ source: 'scar' | 'fortification' | 'faction' | 'missile'; name: string; delta: number }>;
      isUnmodifiable: boolean;
    }>;
    comparisons: Array<{ attackerValue: number; defenderValue: number; attackerWins: boolean }>;
    attackerLosses: number;
    defenderLosses: number;
    defenderEliminated: boolean;
    conquestRequired: boolean;
  } | null;
  conquestTroopsToMove: number | null;
  maneuverSourceTerritory: string | null;
  maneuverTargetTerritory: string | null;
  maneuverTroopsToMove: number | null;
  currentManeuverPath: string[] | null;
  isFirstAttackOfTurn: boolean;
  setupTurnIndex: number;
  lastUpdatedAt: number;
  version: number; // For optimistic concurrency control
  winnerId?: string | null; // Set when game is won
}

interface BaseGameAction<T extends GameActionType, P> {
  type: T;
  payload: P;
  clientVersion: number;
  timestamp: number;
}

/**
 * Game action sent from client to server
 */
export type GameAction =
  | BaseGameAction<'selectFaction', { factionId: FactionId; powerId: string; color?: string }>
  | BaseGameAction<'placeHQ', { territoryId: string }>
  | BaseGameAction<'addTroop', { territoryId: string }>
  | BaseGameAction<'removeTroop', { territoryId: string }>
  | BaseGameAction<'confirmDeployment', Record<string, never>>
  | BaseGameAction<'selectAttackSource', { territoryId: string }>
  | BaseGameAction<'selectAttackTarget', { territoryId: string }>
  | BaseGameAction<'selectAttackerDice', { diceCount: number }>
  | BaseGameAction<'selectDefenderDice', { diceCount: number }>
  | BaseGameAction<'useMissile', { side: 'attacker' | 'defender'; dieIndex: number }>
  | BaseGameAction<'resolveCombat', Record<string, never>>
  | BaseGameAction<'attackAgain', Record<string, never>>
  | BaseGameAction<'selectNewTarget', Record<string, never>>
  | BaseGameAction<'confirmConquest', { troops?: number }>
  | BaseGameAction<'endAttackPhase', Record<string, never>>
  | BaseGameAction<'selectManeuverSource', { territoryId: string }>
  | BaseGameAction<'selectManeuverTarget', { territoryId: string }>
  | BaseGameAction<'cancelManeuver', Record<string, never>>
  | BaseGameAction<'confirmManeuver', { troops?: number }>
  | BaseGameAction<'skipManeuver', Record<string, never>>
  | BaseGameAction<'returnToAttackPhase', Record<string, never>>
  | BaseGameAction<'endTurn', Record<string, never>>;

export type GameActionReasonCode =
  | 'NO_ACTIVE_GAME'
  | 'STATE_VERSION_MISMATCH'
  | 'PLAYER_NOT_IN_GAME'
  | 'PLAYER_ELIMINATED'
  | 'SETUP_TURN_MISMATCH'
  | 'SETUP_PHASE_MISMATCH'
  | 'TURN_MISMATCH'
  | 'INVALID_ACTION'
  | 'INVALID_PAYLOAD';

export interface SetupTurnContext {
  setupTurnIndex: number;
  currentSetupPlayerId: string | null;
  currentSetupPlayerName: string | null;
  subPhase: SubPhase;
  version: number;
}

/**
 * Result of applying a game action
 */
export interface GameActionResult {
  success: boolean;
  newVersion: number;
  error?: string;
  statePatch?: Partial<PersistedGameState>;
  phase?: GamePhase;
  subPhase?: SubPhase;
  setupTurnIndex?: number;
  activePlayerId?: string | null;
  serverVersion?: number;
  expectedPlayerId?: string;
  reasonCode?: GameActionReasonCode;
}

export interface LobbyPlayer {
  socketId: string;
  odId: string; // Persistent player identity across reconnections
  name: string;
  isReady: boolean;
  isHost: boolean;
  isSeatHolder: boolean; // True if this identity maps to an in-game seat
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
  'campaign:delete': (data: { campaignId: string }) => void;
  'campaign:list': () => void;
  'campaign:getHistory': (data: { campaignId: string }) => void;
  'campaign:getParticipants': (data: { campaignId: string }) => void;
  'lobby:join': (data: { campaignId: string; playerName: string; playerToken?: string }) => void;
  'lobby:claimSeat': (data: { campaignId: string; targetOdId: string; playerName: string }) => void;
  'game:rejoin': (data: { campaignId: string; playerToken: string }) => void;
  'lobby:leave': () => void;
  'lobby:ready': (data: { isReady: boolean }) => void;
  'lobby:transferHost': (data: { targetSocketId: string }) => void;
  'lobby:kick': (data: { targetSocketId: string }) => void;
  'lobby:start': () => void;
  'game:action': (data: { campaignId: string; action: GameAction }) => void;
  'game:requestState': (data: { campaignId: string }) => void;
  'game:completePostGame': (data: {
    campaignId: string;
    scarsPlaced: ScarPlacement[];
    citiesBuilt: CityPlacement[];
  }) => void;
  'game:declareVictory': (data: {
    campaignId: string;
    winnerId: string;
    winCondition: 'stars' | 'elimination' | 'domination';
  }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'campaign:list': (data: { campaigns: CampaignSummary[] }) => void;
  'campaign:deleteError': (data: { message: string }) => void;
  'campaign:history': (data: { campaign: CampaignFull }) => void;
  'campaign:participants': (data: { campaignId: string; participants: Array<{ odId: string; name: string }> }) => void;
  'lobby:state': (data: { lobby: Lobby }) => void;
  'lobby:playerJoined': (data: { player: LobbyPlayer }) => void;
  'lobby:tokenAssigned': (data: { odId: string; campaignId: string }) => void;
  'lobby:claimSeatResult': (data: { success: boolean; claimedOdId?: string; error?: string }) => void;
  'game:rejoinResult': (data: { success: boolean; state?: PersistedGameState; localPlayerId?: string; error?: string }) => void;
  'lobby:playerLeft': (data: { socketId: string }) => void;
  'lobby:kicked': () => void;
  'lobby:error': (data: { message: string }) => void;
  'game:started': (data: { initialState: GameInitialState }) => void;
  'game:fullState': (data: { state: PersistedGameState }) => void;
  'game:stateUpdate': (data: { patch: Partial<PersistedGameState>; version: number }) => void;
  'game:setupTurn': (data: SetupTurnContext) => void;
  'game:actionResult': (data: GameActionResult) => void;
  'game:postGame': (data: { winnerId: string; winnerName: string; winCondition: 'stars' | 'elimination' | 'domination' }) => void;
  'game:gameComplete': (data: { campaignId: string }) => void;
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
