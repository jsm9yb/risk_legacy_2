import { FactionId } from '@/types/game';
import { TerritoryId } from '@/types/territory';

export type UnitPieceKind = 1 | 3;

export interface VisibleUnitPiece {
  kind: UnitPieceKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface UnitStackRenderModel {
  troopCount: number;
  totalPieces: number;
  visiblePieceCap: number;
  hiddenTroops: number;
  overflowLabel: string | null;
  pieces: VisibleUnitPiece[];
  overflowAnchor: { x: number; y: number };
}

export interface TerritoryUnitLayoutOverride {
  dx?: number;
  dy?: number;
  fanStepX?: number;
  fanStepY?: number;
  pieceScale?: number;
  rotationStep?: number;
}

export interface ManeuverAnimationEvent {
  factionId?: FactionId | null;
  sourceTerritoryId: TerritoryId;
  targetTerritoryId: TerritoryId;
  path: TerritoryId[];
  troopsMoved: number;
  timestamp: number;
}
