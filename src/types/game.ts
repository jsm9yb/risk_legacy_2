import { TerritoryId, TerritoryState } from './territory';

export type GamePhase =
  | 'SETUP'
  | 'RECRUIT'
  | 'ATTACK'
  | 'MANEUVER'
  | 'END';

export type SubPhase =
  | 'SCAR_PLACEMENT'
  | 'ROLL_FOR_ORDER'
  | 'FACTION_SELECTION'
  | 'HQ_PLACEMENT'
  | 'PLACE_TROOPS'
  | 'IDLE'
  | 'SELECT_ATTACK'
  | 'ATTACKER_DICE'
  | 'DEFENDER_DICE'
  | 'MISSILE_WINDOW'
  | 'RESOLVE'
  | 'TROOP_MOVE'
  // Maneuver phase sub-phases
  | 'SELECT_MANEUVER_SOURCE'
  | 'SELECT_MANEUVER_TARGET'
  | 'SET_MANEUVER_TROOPS'
  | null;

export type FactionId = 'mechaniker' | 'enclave' | 'balkania' | 'khan' | 'saharan';

export interface DeckState {
  drawPile: number[];
  discardPile: number[];
  faceUpCards: number[];
}

export interface GameState {
  gameId: string;
  status: 'lobby' | 'setup' | 'active' | 'finished';
  currentTurn: number;
  activePlayerId: string;
  phase: GamePhase;
  subPhase: SubPhase;
  territories: Record<TerritoryId, TerritoryState>;
  deck: DeckState;
}
