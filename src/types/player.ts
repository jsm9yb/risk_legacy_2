import { FactionId } from './game';

export interface Player {
  id: string;
  gameId: string;
  userId: string;
  seatIndex: number;
  factionId: FactionId;
  activePower: string;
  color: string;
  hqTerritory: string;
  redStars: number;
  missiles: number;
  cards: number[];
  isEliminated: boolean;
  conqueredThisTurn: boolean;
}
