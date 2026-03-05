import { TerritoryUnitLayoutOverride, UnitPieceKind, UnitStackRenderModel } from './types';

const DEFAULT_VISIBLE_PIECE_CAP = 6;

export function decomposeTroopsToUnitPieces(troopCount: number): UnitPieceKind[] {
  if (troopCount <= 0) return [];

  const threes = Math.floor(troopCount / 3);
  const ones = troopCount % 3;

  return [
    ...Array<UnitPieceKind>(threes).fill(3),
    ...Array<UnitPieceKind>(ones).fill(1),
  ];
}

export function getVisibleUnitPieces(troopCount: number, visiblePieceCap = DEFAULT_VISIBLE_PIECE_CAP): UnitPieceKind[] {
  if (troopCount <= 0) return [];

  const threes = Math.floor(troopCount / 3);
  const ones = troopCount % 3;
  const totalPieces = threes + ones;

  if (totalPieces <= visiblePieceCap) {
    return decomposeTroopsToUnitPieces(troopCount);
  }

  const visibleOnes = ones > 0 ? 1 : 0;
  const visibleThrees = Math.min(threes, Math.max(0, visiblePieceCap - visibleOnes));

  return [
    ...Array<UnitPieceKind>(visibleThrees).fill(3),
    ...Array<UnitPieceKind>(visibleOnes).fill(1),
  ];
}

export function buildUnitStackRenderModel(
  troopCount: number,
  options?: {
    visiblePieceCap?: number;
    layoutOverride?: TerritoryUnitLayoutOverride;
  }
): UnitStackRenderModel {
  const visiblePieceCap = options?.visiblePieceCap ?? DEFAULT_VISIBLE_PIECE_CAP;
  const layoutOverride = options?.layoutOverride;
  const allPieces = decomposeTroopsToUnitPieces(troopCount);
  const visiblePieces = getVisibleUnitPieces(troopCount, visiblePieceCap);
  const visibleTroops = visiblePieces.reduce((sum, kind) => sum + kind, 0);
  const hiddenTroops = Math.max(0, troopCount - visibleTroops);

  if (troopCount <= 0 || visiblePieces.length === 0) {
    return {
      troopCount,
      totalPieces: allPieces.length,
      visiblePieceCap,
      hiddenTroops,
      overflowLabel: hiddenTroops > 0 ? `+${hiddenTroops}` : null,
      pieces: [],
      overflowAnchor: { x: 10, y: -16 },
    };
  }

  const fanStepX = layoutOverride?.fanStepX ?? 4.5;
  const fanStepY = layoutOverride?.fanStepY ?? 2.8;
  const pieceScale = layoutOverride?.pieceScale ?? 0.62;
  const dx = layoutOverride?.dx ?? 0;
  const dy = layoutOverride?.dy ?? 0;
  const rotationStep = layoutOverride?.rotationStep ?? 3;
  const centerOffset = (visiblePieces.length - 1) / 2;

  const pieces = visiblePieces.map((kind, index) => {
    const centered = index - centerOffset;
    const x = dx + centered * fanStepX;
    const y = dy + centered * -fanStepY + (kind === 1 ? 2 : 0);
    const rotation = centered * rotationStep;
    const scale = pieceScale + (kind === 1 ? -0.05 : 0);

    return {
      kind,
      x,
      y,
      scale,
      rotation,
      zIndex: index,
    };
  });

  const maxX = Math.max(...pieces.map((piece) => piece.x));
  const minY = Math.min(...pieces.map((piece) => piece.y));

  return {
    troopCount,
    totalPieces: allPieces.length,
    visiblePieceCap,
    hiddenTroops,
    overflowLabel: hiddenTroops > 0 ? `+${hiddenTroops}` : null,
    pieces,
    overflowAnchor: {
      x: maxX + 10,
      y: minY - 10,
    },
  };
}

export const UNIT_STACK_VISIBLE_PIECE_CAP = DEFAULT_VISIBLE_PIECE_CAP;
