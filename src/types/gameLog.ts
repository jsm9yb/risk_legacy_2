import { TerritoryId } from './territory';

/**
 * Game log entry types
 */
export type LogEntryType =
  | 'DEPLOY'
  | 'ATTACK_DECLARE'
  | 'COMBAT_RESULT'
  | 'CONQUEST'
  | 'MANEUVER'
  | 'CARD_DRAW'
  | 'CARD_TRADE'
  | 'ELIMINATION'
  | 'VICTORY'
  | 'PHASE_CHANGE'
  | 'TURN_START'
  | 'HQ_PLACED'
  | 'FACTION_SELECTED';

/**
 * Base game log entry
 */
export interface GameLogEntry {
  id: string;
  type: LogEntryType;
  timestamp: number;
  turn: number;
  playerId: string;
  playerName: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Deploy troops entry
 */
export interface DeployLogEntry extends GameLogEntry {
  type: 'DEPLOY';
  details: {
    territoryId: TerritoryId;
    territoryName: string;
    troopCount: number;
  };
}

/**
 * Attack declaration entry
 */
export interface AttackDeclareLogEntry extends GameLogEntry {
  type: 'ATTACK_DECLARE';
  details: {
    fromTerritoryId: TerritoryId;
    fromTerritoryName: string;
    toTerritoryId: TerritoryId;
    toTerritoryName: string;
    attackerDice: number;
  };
}

/**
 * Combat result entry
 */
export interface CombatResultLogEntry extends GameLogEntry {
  type: 'COMBAT_RESULT';
  details: {
    attackerRolls: number[];
    defenderRolls: number[];
    attackerLosses: number;
    defenderLosses: number;
    modifiers?: string[];
  };
}

/**
 * Conquest entry
 */
export interface ConquestLogEntry extends GameLogEntry {
  type: 'CONQUEST';
  details: {
    territoryId: TerritoryId;
    territoryName: string;
    troopsMoved: number;
    capturedHQ?: boolean;
  };
}

/**
 * Maneuver entry
 */
export interface ManeuverLogEntry extends GameLogEntry {
  type: 'MANEUVER';
  details: {
    fromTerritoryId: TerritoryId;
    fromTerritoryName: string;
    toTerritoryId: TerritoryId;
    toTerritoryName: string;
    troopCount: number;
  };
}

/**
 * Card trade entry
 */
export interface CardTradeLogEntry extends GameLogEntry {
  type: 'CARD_TRADE';
  details: {
    cardCount: number;
    forType: 'troops' | 'star';
    received: number;
  };
}

/**
 * Elimination entry
 */
export interface EliminationLogEntry extends GameLogEntry {
  type: 'ELIMINATION';
  details: {
    eliminatedPlayerId: string;
    eliminatedPlayerName: string;
  };
}

/**
 * Victory entry
 */
export interface VictoryLogEntry extends GameLogEntry {
  type: 'VICTORY';
  details: {
    winnerId: string;
    winnerName: string;
    condition: string;
    starCount: number;
  };
}

/**
 * Union type of all log entries
 */
export type AnyLogEntry =
  | DeployLogEntry
  | AttackDeclareLogEntry
  | CombatResultLogEntry
  | ConquestLogEntry
  | ManeuverLogEntry
  | CardTradeLogEntry
  | EliminationLogEntry
  | VictoryLogEntry
  | GameLogEntry;

/**
 * Helper to create a unique log entry ID
 */
export function createLogEntryId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
